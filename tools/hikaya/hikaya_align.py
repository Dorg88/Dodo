#!/usr/bin/env python3
"""HIKAYA step 5: align script lines to the original recordings and write
clips-mode episode timelines. Nothing is cut or re-encoded: each line becomes
a clip (file + start/end) inside the recording it was found in.

    python3 hikaya_align.py --book-dir ~/HIKAYA/books/thumma_ihtadayt \\
        --scripts scripts/ep10.txt scripts/ep11.txt ... \\
        --recordings recordings.json [--model small] [--overrides alignment_overrides.json]

recordings.json maps each speaker to the recording(s) holding all of that
speaker's lines for the given scripts, in order (batch files welcome):

    {"NARRATOR": ["audio/batch1/Riko_ep10-14.wav"], "AL_TIJANI": ["audio/batch1/Enzo_ep10-14.wav"]}

Paths are relative to --book-dir. Script format (one file per episode):

    @episode 10
    @title بين الجيلاني والكاظم
    === SCENE s01 | عنوان المشهد
    @image ep10/images/scene_01.jpg
    NARRATOR [بنبرة هادئة]: النص...
    AL_TIJANI: النص...

Outputs per episode: <book-dir>/epNN/episode.json, plus in --report-dir:
alignment.csv, ALIGNMENT.md and review.html (listen to every clip, adjust
start/end, export alignment_overrides.json, re-run with --overrides).

Needs: pip install faster-whisper numpy ; ffmpeg (brew install ffmpeg).
"""

import argparse
import csv
import difflib
import html
import json
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import DIRECTION_WORDS, clean_directions, write_json  # noqa: E402

SR = 16000
PAUSES = {"lead_in": 500, "same_speaker": 350, "speaker_change": 600, "scene_change": 1200}
DIACRITICS = re.compile(r"[ؗ-ًؚ-ْٰۖ-ۭـ]")
LINE_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_]*)\s*(?:\[([^\]]*)\])?\s*(?:\{[^}]*\})?\s*:\s*(.+)$")


def norm(text):
    t = DIACRITICS.sub("", text)
    t = re.sub("[إأآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    t = re.sub(r"[^ء-ي0-9a-zA-Z ]", " ", t)
    return t.split()


# --- script ------------------------------------------------------------------------

def parse_script(path):
    ep = {"file": path, "episode": None, "title": "", "scenes": []}
    with open(path, encoding="utf-8-sig") as fh:
        for no, raw in enumerate(fh, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("=== SCENE"):
                m = re.match(r"=== SCENE\s+(\S+)\s*(?:\|\s*(.*))?$", line)
                ep["scenes"].append({"id": m.group(1), "title": (m.group(2) or "").strip(), "image": None, "lines": []})
            elif line.startswith("@"):
                key, _, val = line[1:].partition(" ")
                if key == "image" and ep["scenes"]:
                    ep["scenes"][-1]["image"] = None if val.strip() in ("", "none") else val.strip()
                elif key == "episode":
                    ep["episode"] = int(val)
                elif key == "title":
                    ep["title"] = val.strip()
            else:
                m = LINE_RE.match(line)
                if not m or not ep["scenes"]:
                    raise SystemExit(f"{path}:{no}: cannot parse line: {line[:60]}")
                text, removed, _ = clean_directions(m.group(3))
                ep["scenes"][-1]["lines"].append({
                    "speaker": m.group(1), "direction": (m.group(2) or "").strip() or ", ".join(removed),
                    "text": text, "line_no": no})
    if ep["episode"] is None:
        raise SystemExit(f"{path}: missing @episode")
    for i, sc in enumerate(ep["scenes"], 1):
        for j, ln in enumerate(sc["lines"], 1):
            ln["id"] = f"ep{ep['episode']:02d}_s{i:02d}_l{j:02d}"
    return ep


# --- audio ---------------------------------------------------------------------------

def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def frame_db(pcm, hop=0.01):
    n = int(SR * hop)
    k = len(pcm) // n
    rms = np.sqrt((pcm[: k * n].reshape(k, n) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(rms)


def speech_threshold(db):
    """Energy level separating speech from room noise for this recording."""
    floor = float(np.percentile(db, 10))
    return max(-50.0, min(-30.0, floor + 10))


def speech_end(db, t, limit, thr, hold=15, pad=0.15):
    """First moment after t where the voice stays below thr for `hold` frames
    (10 ms each), plus a small pad; never past `limit`. Whisper's word end
    times run early, so this keeps the last syllable intact."""
    a, b = int(t * 100), min(len(db), int(limit * 100))
    for f in range(max(0, a - 5), b - hold):
        if np.all(db[f:f + hold] < thr):
            return min(limit, f / 100 + pad)
    return min(limit, t + 0.35)


def speech_start(db, t, limit, thr, hold=15, pad=0.10):
    """Last moment before t where the preceding `hold` frames are silent, minus a pad."""
    a, b = int(t * 100), max(0, int(limit * 100))
    for f in range(min(len(db), a + 5), b + hold, -1):
        if f - hold >= 0 and np.all(db[f - hold:f] < thr):
            return max(limit, f / 100 - pad)
    return max(limit, t - 0.25)


def transcribe(model, pcm):
    segs, _ = model.transcribe(pcm, language="ar", word_timestamps=True, beam_size=5, vad_filter=False)
    words = []
    for s in segs:
        for w in s.words or []:
            for tok in norm(w.word):
                words.append({"w": tok, "s": float(w.start), "e": float(w.end)})
    return words


# --- alignment -------------------------------------------------------------------------

def align_speaker(lines, files, model, book_dir, cache):
    """Locate each of one speaker's lines (in order) in that speaker's recordings."""
    words, dbs = [], {}
    for f in files:
        if f not in cache:
            pcm = load_audio(os.path.join(book_dir, f))
            cache[f] = {"words": transcribe(model, pcm), "db": frame_db(pcm), "dur": len(pcm) / SR}
        dbs[f] = cache[f]
        words += [{**w, "file": f} for w in cache[f]["words"]]
    exp, owner = [], []
    for i, ln in enumerate(lines):
        toks = norm(ln["text"])
        exp += toks
        owner += [i] * len(toks)
    sm = difflib.SequenceMatcher(None, exp, [w["w"] for w in words], autojunk=False)
    match = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            match[blk.a + k] = blk.b + k
    used = set()
    out = []
    for i, ln in enumerate(lines):
        idx = [match[k] for k in range(len(exp)) if owner[k] == i and k in match]
        n_exp = sum(1 for o in owner if o == i)
        res = {**ln, "flags": []}
        if not idx:
            res.update(file=None, start=None, end=None, confidence=0.0, heard="")
            res["flags"].append("line not found in the recording")
            out.append(res)
            continue
        first, last = min(idx), max(idx)
        files_hit = {words[j]["file"] for j in range(first, last + 1)}
        if len(files_hit) > 1:
            res["flags"].append("line spans two recordings")
        f = words[first]["file"]
        heard = [words[j]["w"] for j in range(first, last + 1)]
        conf = difflib.SequenceMatcher(None, norm(ln["text"]), heard, autojunk=False).ratio()
        coverage = len(idx) / max(1, n_exp)
        res.update(file=f, start=words[first]["s"], end=words[last]["e"], confidence=round(conf, 3),
                   coverage=round(coverage, 3), heard=" ".join(heard), word_times=[words[j] for j in range(first, last + 1)])
        extra = [w for w in heard if w not in set(norm(ln["text"]))]
        if any(any(d in w for d in DIRECTION_WORDS) for w in extra):
            res["flags"].append("a performance direction may have been spoken")
        used.update(range(first, last + 1))
        out.append(res)
    # refine boundaries to where the voice really starts/stops, keeping order inside each file
    raw = [(r["start"], r["end"]) for r in out]
    for i, r in enumerate(out):
        if r["file"] is None:
            continue
        db = dbs[r["file"]]["db"]
        thr = speech_threshold(db)
        prev_end = max([raw[j][1] for j in range(i) if out[j]["file"] == r["file"] and raw[j][1]] or [0.0])
        nxt = [raw[j][0] for j in range(i + 1, len(out)) if out[j]["file"] == r["file"] and raw[j][0]]
        next_start = min(nxt) if nxt else dbs[r["file"]]["dur"]
        r["start"] = speech_start(db, r["start"], max(prev_end, r["start"] - 1.5), thr)
        r["end"] = speech_end(db, r["end"], min(next_start, r["end"] + 1.5), thr)
    # neighbouring clips in one file must not overlap: split any overlap at its middle
    for i in range(1, len(out)):
        a, b = out[i - 1], out[i]
        if a["file"] and a["file"] == b["file"] and a["end"] > b["start"]:
            mid = (a["end"] + b["start"]) / 2
            a["end"], b["start"] = mid, mid
    # Speech in a recording that no line accounts for: a repeated take, a
    # spoken direction or unscripted words. Compare each stray run with the
    # lines around it and flag the line it belongs to.
    for f in files:
        clips = sorted((r for r in out if r["file"] == f), key=lambda r: r["start"])
        stray = [w for w in words if w["file"] == f and not any(c["start"] - 0.05 <= w["s"] <= c["end"] + 0.05 for c in clips)]
        runs, cur = [], []
        for w in stray:
            if cur and w["s"] - cur[-1]["e"] > 1.0:
                runs.append(cur)
                cur = []
            cur.append(w)
        if cur:
            runs.append(cur)
        for run in runs:
            if len(run) < 3:
                continue
            toks = [w["w"] for w in run]
            after = next((c for c in clips if c["start"] >= run[-1]["e"] - 0.3), None)
            before = next((c for c in reversed(clips) if c["end"] <= run[0]["s"] + 0.3), None)
            best, target = 0.0, after or before
            for cand in (after, before):
                if cand:
                    score = difflib.SequenceMatcher(None, norm(cand["text"]), toks, autojunk=False).ratio()
                    if score > best:
                        best, target = score, cand
            if target is None:
                continue
            where = f"{run[0]['s']:.1f}–{run[-1]['e']:.1f}s"
            if best > 0.6:
                target["flags"].append(f"repeated take of this line at {where} (the other take was used)")
            else:
                target["flags"].append(f"unscripted speech near this line at {where}: {' '.join(toks[:8])}")
    for r in out:
        r["timing"] = ("verified" if r["confidence"] >= 0.75 and r.get("coverage", 0) >= 0.7 and not r["flags"]
                       else "estimated" if r["confidence"] >= 0.45 else "unverified")
    return out


def sentence_lines(r, seg_start_ms):
    """Split a segment into sentences timed from its word timestamps."""
    parts = [p.strip() for p in re.split(r"(?<=[.!؟?…])\s+", r["text"]) if p.strip()]
    if len(parts) < 2 or r["timing"] != "verified":
        return [{"text": r["text"], "startMs": seg_start_ms,
                 "endMs": seg_start_ms + int((r["end"] - r["start"]) * 1000)}]
    words = r["word_times"]
    out, k, cursor = [], 0, seg_start_ms
    clip0 = r["start"]
    for n, p in enumerate(parts):
        k += len(norm(p))
        if n == len(parts) - 1:
            end = seg_start_ms + int((r["end"] - clip0) * 1000)
        else:
            w = words[min(k, len(words)) - 1]
            end = seg_start_ms + int((w["e"] - clip0) * 1000)
        end = max(end, cursor + 200)
        out.append({"text": p, "startMs": cursor, "endMs": end})
        cursor = end
    out[-1]["endMs"] = seg_start_ms + int((r["end"] - clip0) * 1000)
    return out


def build_episode(ep, results, speakers):
    t = PAUSES["lead_in"]
    segments, scenes = [], []
    prev = None
    for si, sc in enumerate(ep["scenes"], 1):
        scene_start = None
        for ln in sc["lines"]:
            r = results[ln["id"]]
            if r["file"] is None:
                continue
            if prev is not None:
                t += PAUSES["scene_change"] if prev[0] != si else (
                    PAUSES["same_speaker"] if prev[1] == ln["speaker"] else PAUSES["speaker_change"])
            start = t
            length = int(round((r["end"] - r["start"]) * 1000))
            t += length
            if scene_start is None:
                scene_start = start
            segments.append({
                "id": ln["id"], "scene": si, "speakerId": ln["speaker"],
                "speakerName": speakers.get(ln["speaker"], ln["speaker"]), "direction": ln["direction"],
                "text": ln["text"], "startMs": start, "endMs": t,
                "clip": {"file": r["file"], "startMs": int(round(r["start"] * 1000)), "endMs": int(round(r["end"] * 1000))},
                "lines": sentence_lines(r, start), "timing": r["timing"],
                "alignment": {"confidence": r["confidence"], "flags": r["flags"]},
            })
            prev = (si, ln["speaker"])
        if scene_start is not None:
            scenes.append({"number": si, "id": sc["id"], "title": sc["title"], "image": sc["image"],
                           "startMs": scene_start, "endMs": None})
    for i, s in enumerate(scenes):
        s["startMs"] = 0 if i == 0 else max(scenes[i - 1]["startMs"] + 1, s["startMs"] - PAUSES["scene_change"] // 2)
    total = t + 1500
    for i, s in enumerate(scenes):
        s["endMs"] = scenes[i + 1]["startMs"] if i + 1 < len(scenes) else total
    return {"schema": "hikaya.episode.v1", "id": f"ep{ep['episode']:02d}", "number": ep["episode"],
            "title": ep["title"], "durationMs": total, "audio": {"mode": "clips"},
            "speakers": {k: {"name": v} for k, v in speakers.items()}, "scenes": scenes, "segments": segments}


def review_html(rows, book_dir, out_path):
    rel = os.path.relpath(book_dir, os.path.dirname(os.path.abspath(out_path)))
    items = []
    for r in rows:
        src = html.escape(f"{rel}/{r['file']}") if r["file"] else ""
        flags = html.escape("; ".join(r["flags"]))
        cls = {"verified": "ok", "estimated": "mid"}.get(r["timing"], "bad")
        items.append(f"""<tr class="{cls}" data-id="{r['id']}" data-src="{src}">
<td>{r['id']}<br><small>{html.escape(r['speaker'])}</small></td><td dir="rtl">{html.escape(r['text'])}
<br><small>سُمع: {html.escape(r.get('heard') or '')}</small><br><small class="f">{flags}</small></td>
<td>{r['confidence']:.2f}<br>{r['timing']}</td>
<td><input class="s" type="number" step="0.05" value="{(r['start'] or 0):.2f}"> –
<input class="e" type="number" step="0.05" value="{(r['end'] or 0):.2f}"><br>
<button onclick="play(this)">▶</button></td></tr>""")
    page = f"""<!doctype html><html lang="ar"><meta charset="utf-8"><title>HIKAYA alignment review</title>
<style>body{{font-family:-apple-system,sans-serif;background:#f6efe0;color:#2e2419;margin:16px}}
table{{border-collapse:collapse;width:100%}}td{{border-bottom:1px solid #dccdae;padding:6px;vertical-align:top}}
tr.mid{{background:#f3e3bf}}tr.bad{{background:#f2c9b8}}input{{width:5.5em}}small{{color:#7a6a55}}.f{{color:#a33}}
button{{margin-top:4px}}</style>
<h2>مراجعة المحاذاة</h2><p>Listen to each clip, correct start/end (seconds inside the recording), then
<button onclick="exportJson()">Export alignment_overrides.json</button> and re-run hikaya_align.py with --overrides.</p>
<audio id="a"></audio><table>{''.join(items)}</table>
<script>
let stopAt=null;const a=document.getElementById('a');
a.ontimeupdate=()=>{{if(stopAt!==null&&a.currentTime>=stopAt){{a.pause();stopAt=null;}}}};
function play(b){{const tr=b.closest('tr');const s=+tr.querySelector('.s').value,e=+tr.querySelector('.e').value;
if(!tr.dataset.src)return;if(!a.src.endsWith(tr.dataset.src))a.src=tr.dataset.src;a.currentTime=s;stopAt=e;a.play();}}
function exportJson(){{const o={{}};document.querySelectorAll('tr[data-id]').forEach(tr=>{{
o[tr.dataset.id]={{start:+tr.querySelector('.s').value,end:+tr.querySelector('.e').value}};}});
const blob=new Blob([JSON.stringify(o,null,1)],{{type:'application/json'}});const l=document.createElement('a');
l.href=URL.createObjectURL(blob);l.download='alignment_overrides.json';l.click();}}
</script></html>"""
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--book-dir", required=True)
    ap.add_argument("--scripts", nargs="+", required=True)
    ap.add_argument("--recordings", required=True, help="JSON: speaker -> [recording paths relative to book-dir]")
    ap.add_argument("--speakers", help="JSON: speaker id -> display name")
    ap.add_argument("--model", default="small", help="faster-whisper model size or local model folder")
    ap.add_argument("--overrides", help="alignment_overrides.json exported from review.html")
    ap.add_argument("--report-dir", default="alignment_report")
    args = ap.parse_args()

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    episodes = sorted((parse_script(p) for p in args.scripts), key=lambda e: e["episode"])
    with open(args.recordings, encoding="utf-8") as fh:
        recordings = json.load(fh)
    speakers = {}
    if args.speakers:
        with open(args.speakers, encoding="utf-8") as fh:
            speakers = json.load(fh)
    overrides = {}
    if args.overrides:
        with open(args.overrides, encoding="utf-8") as fh:
            overrides = json.load(fh)

    by_speaker = {}
    for ep in episodes:
        for sc in ep["scenes"]:
            for ln in sc["lines"]:
                by_speaker.setdefault(ln["speaker"], []).append(ln)
    missing = [s for s in by_speaker if s not in recordings]
    if missing:
        raise SystemExit(f"no recording listed for: {', '.join(missing)} — add them to {args.recordings}")

    results, cache = {}, {}
    for spk, lines in by_speaker.items():
        print(f"aligning {spk}: {len(lines)} lines in {', '.join(recordings[spk])}")
        for r in align_speaker(lines, recordings[spk], model, args.book_dir, cache):
            results[r["id"]] = r
    for lid, o in overrides.items():
        if lid in results and results[lid]["file"]:
            results[lid].update(start=float(o["start"]), end=float(o["end"]), timing="verified")
            results[lid]["flags"] = [f for f in results[lid]["flags"]] + ["start/end set by hand"]

    os.makedirs(args.report_dir, exist_ok=True)
    rows = [results[ln["id"]] for ep in episodes for sc in ep["scenes"] for ln in sc["lines"]]
    for ep in episodes:
        data = build_episode(ep, results, speakers)
        path = os.path.join(args.book_dir, data["id"], "episode.json")
        write_json(path, data)
        n = len(data["segments"])
        ver = sum(1 for s in data["segments"] if s["timing"] == "verified")
        print(f"episode {ep['episode']:02d}: {n} segments ({ver} verified) → {path}")
    with open(os.path.join(args.report_dir, "alignment.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "speaker", "file", "start_s", "end_s", "confidence", "timing", "flags", "text", "heard"])
        for r in rows:
            w.writerow([r["id"], r["speaker"], r["file"], r["start"] and round(r["start"], 2),
                        r["end"] and round(r["end"], 2), r["confidence"], r["timing"], "; ".join(r["flags"]),
                        r["text"], r.get("heard", "")])
    md = ["# Alignment report", "", "| Line | Speaker | Clip | Confidence | Timing | Flags |", "|---|---|---|---|---|---|"]
    for r in rows:
        clip = f"{os.path.basename(r['file'])} {r['start']:.2f}–{r['end']:.2f}" if r["file"] else "—"
        md.append(f"| {r['id']} | {r['speaker']} | {clip} | {r['confidence']:.2f} | {r['timing']} | {'; '.join(r['flags'])} |")
    with open(os.path.join(args.report_dir, "ALIGNMENT.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")
    review_html(rows, args.book_dir, os.path.join(args.report_dir, "review.html"))
    bad = [r for r in rows if r["timing"] != "verified"]
    print(f"{len(rows)} lines, {len(rows) - len(bad)} verified, {len(bad)} to review → {args.report_dir}/review.html")


if __name__ == "__main__":
    main()
