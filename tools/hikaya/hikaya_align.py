#!/usr/bin/env python3
"""HIKAYA step 5: align script lines to the original recordings and write
clips-mode episode timelines. Nothing is cut or re-encoded: each line becomes
a clip (file + start/end) inside the recording it was found in.

    python3 hikaya_align.py --book-dir ~/HIKAYA/books/thumma_ihtadayt \\
        --scripts scripts/ep10.txt scripts/ep11.txt ... \\
        --recordings recordings.json [--cache ~/HIKAYA/transcripts] [--overrides alignment_overrides.json]

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

With --cache, transcripts written by hikaya_transcribe.py are reused (and new
ones stored), so a recording is transcribed only once.

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
LINE_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_]*)\s*(?:\[([^\]]*)\])?\s*(?:\{([^}]*)\})?\s*:\s*(.+)$")


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
                elif key == "layout" and ep["scenes"]:
                    ep["scenes"][-1]["layout"] = val.strip()
                elif key == "episode":
                    ep["episode"] = int(val)
                elif key == "title":
                    ep["title"] = val.strip()
            else:
                m = LINE_RE.match(line)
                if not m or not ep["scenes"]:
                    raise SystemExit(f"{path}:{no}: cannot parse line: {line[:60]}")
                text, removed, _ = clean_directions(m.group(4))
                meta = dict(kv.split("=", 1) for kv in (m.group(3) or "").split() if "=" in kv)
                ep["scenes"][-1]["lines"].append({
                    "speaker": m.group(1), "direction": (m.group(2) or "").strip() or ", ".join(removed),
                    "text": text, "line_no": no, "src": meta.get("src")})
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


def silences(db, thr, min_frames=5):
    """Quiet runs [(start_s, end_s)] of at least min_frames × 10 ms."""
    quiet = np.concatenate([[0], (db < thr).astype(np.int8), [0]])
    d = np.diff(quiet)
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return [(a / 100, b / 100) for a, b in zip(starts, ends) if b - a >= min_frames]


PRE_ROLL, POST_ROLL = 0.12, 0.25


def gap_between(sil, db, lo, hi):
    """The pause separating two words: the quiet run with the most overlap with
    [lo, hi]. Whisper glues a sentence's first word to the previous word's end,
    so the true pause is found in the audio, not in the word times. Returns
    (start, end, measured) — measured False when no pause exists there."""
    if hi <= lo:
        hi = lo + 0.05
    best = None
    for a, b in sil:
        ov = min(b, hi) - max(a, lo)
        if ov > 0 and (best is None or ov > best[0]):
            best = (ov, a, b)
    if best:
        return best[1], best[2], True
    f0, f1 = int(lo * 100), max(int(lo * 100) + 1, int(hi * 100))
    k = f0 + int(np.argmin(db[f0:f1])) if f1 <= len(db) and f0 < f1 else f0
    return k / 100, k / 100, False


def clip_bounds(words, first, last, sil, db, dur):
    """Start/end of the clip holding words[first..last] of one recording. Both
    cuts sit inside the measured pause before/after the line, so no syllable is
    clipped and no neighbouring speech (another line, a spoken direction, a
    repeated take) is included. Returns (start, end, notes)."""
    notes = []
    if first > 0:
        a, b, ok = gap_between(sil, db, words[first - 1]["e"] - 0.25, words[first]["e"] - 0.05)
    else:
        a, b, ok = gap_between(sil, db, 0.0, words[first]["e"] - 0.05)
    start = b - min(PRE_ROLL, (b - a) / 2)
    if not ok:
        notes.append("no pause before this line — check the start")
    if last + 1 < len(words):
        a, b, ok = gap_between(sil, db, words[last]["e"] - 0.25, words[last + 1]["e"] - 0.05)
    else:
        tail = [(a, b) for a, b in sil if b > words[last]["e"] - 0.25 and b - a >= 0.2] or [(dur, dur)]
        a, b, ok = tail[0][0], tail[0][1], True
    end = a + min(POST_ROLL, (b - a) / 2)
    if not ok:
        notes.append("no pause after this line — check the end")
    return max(0.0, start), min(dur, max(end, start + 0.1)), notes


def transcribe(model, pcm):
    segs, _ = model.transcribe(pcm, language="ar", word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    return [{"w": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or [])]


def words_of(transcript):
    """Words of a cached transcript (hikaya_transcribe.py) as [{w, s, e}], without
    a phrase the transcriber invents in the silence closing a recording."""
    from hikaya_recover import drop_hallucinations
    words = [{"w": w["w"], "s": w["s"], "e": w["e"]} for seg in transcript["segments"] for w in seg["words"]]
    return drop_hallucinations(words, transcript.get("duration_s", words[-1]["e"] if words else 0))[0]


# --- alignment -------------------------------------------------------------------------

def align_speaker(lines, files, model, book_dir, cache, transcribe_cached=None):
    """Locate each of one speaker's lines (in order) in that speaker's recordings.
    Each line's performance direction is part of the expected text too: when the
    voice engine read a direction aloud, it is recognised and left outside the clip."""
    words, tokens = [], []      # words: every transcribed word; tokens: normalised tokens → word index
    for f in files:
        if f not in cache:
            path = os.path.join(book_dir, f)
            pcm = load_audio(path)
            ws = transcribe_cached(path, pcm) if transcribe_cached else transcribe(model, pcm)
            db = frame_db(pcm)
            cache[f] = {"words": ws, "db": db, "dur": len(pcm) / SR, "sil": silences(db, speech_threshold(db))}
        base = len(words)
        for k, w in enumerate(cache[f]["words"]):
            words.append({**w, "file": f})
            tokens += [(t, base + k) for t in norm(w["w"])]
    exp, owner = [], []          # owner: (line index, "d" direction | "t" text)
    for i, ln in enumerate(lines):
        for kind, txt in (("d", ln.get("direction", "")), ("t", ln["text"])):
            toks = norm(txt)
            exp += toks
            owner += [(i, kind)] * len(toks)
    sm = difflib.SequenceMatcher(None, exp, [t for t, _ in tokens], autojunk=False)
    match = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            match[blk.a + k] = tokens[blk.b + k][1]
    matched_any = set(match.values())
    file_of = [w["file"] for w in words]

    def joined(a, b):
        """True when words a and b (consecutive) are not separated by a clear pause."""
        if file_of[a] != file_of[b]:
            return False
        c = cache[file_of[a]]
        lo, hi = words[a]["e"] - 0.25, words[b]["e"] - 0.05
        return not any(e - s >= 0.3 and min(e, hi) - max(s, lo) > 0 for s, e in c["sil"])

    out, spoken_dir = [], set()
    for i, ln in enumerate(lines):
        idx = [match[k] for k in range(len(exp)) if owner[k] == (i, "t") and k in match]
        didx = [match[k] for k in range(len(exp)) if owner[k] == (i, "d") and k in match]
        n_exp = sum(1 for o in owner if o == (i, "t"))
        res = {**ln, "flags": [], "notes": []}
        if not idx:
            res.update(file=None, start=None, end=None, confidence=0.0, coverage=0.0, heard="")
            res["flags"].append("line not found in the recording")
            out.append(res)
            continue
        first, last = min(idx), max(idx)
        # words of the line missing at either edge because the transcriber heard them
        # differently («ورجع سالني» for «وارجع اسألني», «رح» for «راح»): take the
        # neighbouring unmatched words when their letters match what is missing
        tpos = [k for k in range(len(exp)) if owner[k] == (i, "t")]
        mpos = [k for k in tpos if k in match]
        head_missing = [exp[k] for k in tpos if k < mpos[0]]
        tail_missing = [exp[k] for k in tpos if k > mpos[-1]]

        def fuzzy_take(missing, start, step):
            cands, j = [], start
            while (0 <= j < len(words) and j not in matched_any and file_of[j] == file_of[first]
                   and len(cands) < len(missing) + 1):
                cands.append(j)
                j += step
            best, take = 0.0, 0
            for n in range(1, len(cands) + 1):
                got = [t for jj in sorted(cands[:n]) for t in norm(words[jj]["w"])]
                r = difflib.SequenceMatcher(None, " ".join(missing), " ".join(got), autojunk=False).ratio()
                if r > best:
                    best, take = r, n
            return take if best >= 0.6 else 0

        if tail_missing:
            last += fuzzy_take(tail_missing, last + 1, 1)
        if head_missing:
            first -= fuzzy_take(head_missing, first - 1, -1)
        # words the transcriber heard differently («يدي» for «يديه») at either edge of
        # the line still belong to it when no pause separates them from it
        while last + 1 < len(words) and last + 1 not in matched_any and joined(last, last + 1):
            last += 1
        while first > 0 and first - 1 not in matched_any and joined(first - 1, first):
            first -= 1
        if len({words[j]["file"] for j in range(first, last + 1)}) > 1:
            res["flags"].append("line spans two recordings")
            # keep the clip inside the recording where the line starts
            while words[last]["file"] != words[first]["file"]:
                last -= 1
        f = words[first]["file"]
        heard_words = words[first:last + 1]
        heard = [t for w in heard_words for t in norm(w["w"])]
        # letters, not whole words: «يدي» for «يديه» is a small difference, not a missing word
        conf = difflib.SequenceMatcher(None, " ".join(norm(ln["text"])), " ".join(heard), autojunk=False).ratio()
        if len(didx) >= max(1, len(norm(ln.get("direction", ""))) // 2):
            spoken_dir.update(d for d in didx if d < first or d > last)
            res["notes"].append("the direction was read aloud; it is left out of the clip")
        res.update(file=f, first_word=first, last_word=last, confidence=round(conf, 3),
                   coverage=round(len(idx) / max(1, n_exp), 3), heard=" ".join(heard),
                   word_times=[{"w": t, "s": w["s"], "e": w["e"]} for w in heard_words for t in norm(w["w"])])
        out.append(res)
    # cut every clip inside the measured pauses around it
    offsets, k = {}, 0
    for fname in files:
        offsets[fname] = k
        k += len(cache[fname]["words"])
    for r in out:
        if r["file"] is None:
            continue
        c = cache[r["file"]]
        o = offsets[r["file"]]
        fw = c["words"]
        r["start"], r["end"], notes = clip_bounds(fw, r["first_word"] - o, r["last_word"] - o, c["sil"], c["db"], c["dur"])
        r["flags"] += notes
    # pieces of one recorded line split between two pictures play back to back:
    # a cut inside the sentence without a pause is expected there
    for a, b in zip(out, out[1:]):
        if (a["file"] and a["file"] == b["file"] and a.get("src") and b.get("src")
                and a["src"].split(".")[:3] == b["src"].split(".")[:3] and abs(a["end"] - b["start"]) < 0.01):
            a["flags"] = [f for f in a["flags"] if not f.startswith("no pause after")]
            b["flags"] = [f for f in b["flags"] if not f.startswith("no pause before")]
            a["notes"].append("continues without a pause into the next piece of the same line")
    # Speech that no line or spoken direction accounts for: a repeated take or
    # unscripted words. Compare each stray run with the lines around it.
    for fname in files:
        clips = sorted((r for r in out if r["file"] == fname), key=lambda r: r["start"])
        o = offsets[fname]
        stray = [dict(w, i=o + n) for n, w in enumerate(cache[fname]["words"])
                 if o + n not in spoken_dir and norm(w["w"])
                 and not any(cl["first_word"] <= o + n <= cl["last_word"] for cl in clips)]
        runs, cur = [], []
        for w in stray:
            if cur and (w["i"] != cur[-1]["i"] + 1 or w["s"] - cur[-1]["e"] > 1.0):
                runs.append(cur)
                cur = []
            cur.append(w)
        if cur:
            runs.append(cur)
        for run in runs:
            toks = [t for w in run for t in norm(w["w"])]
            if len(toks) < 3:
                continue
            if any(any(d in t for d in DIRECTION_WORDS) for t in toks[:2]) and len(toks) <= 7:
                continue  # a direction read aloud that the script does not list for this line
            after = next((cl for cl in clips if cl["first_word"] > run[-1]["i"]), None)
            before = next((cl for cl in reversed(clips) if cl["last_word"] < run[0]["i"]), None)
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
                target["flags"].append(f"unscripted speech near this line at {where}: {' '.join(toks[:10])}")
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
            base = ".".join((ln.get("src") or "").split(".")[:3]) or None
            if prev is not None:
                if base and prev[2] == base and prev[3] == r["file"]:
                    pass  # the next piece of the same recorded line: its own pause is inside the clips
                elif prev[1] == ln["speaker"]:
                    t += PAUSES["speaker_change"] if prev[0] != si else PAUSES["same_speaker"]
                else:
                    t += PAUSES["scene_change"] if prev[0] != si else PAUSES["speaker_change"]
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
            prev = (si, ln["speaker"], base, r["file"])
        if scene_start is not None:
            scenes.append({"number": si, "id": sc["id"], "title": sc["title"], "image": sc["image"],
                           "startMs": scene_start, "endMs": None, **({"layout": sc["layout"]} if sc.get("layout") else {})})
    # a picture changes in the middle of the pause before its scene's first line,
    # never while the previous line is still being spoken
    for i, s in enumerate(scenes):
        if i == 0:
            s["startMs"] = 0
            continue
        prev_end = max(g["endMs"] for g in segments if g["startMs"] < s["startMs"])
        s["startMs"] = max(scenes[i - 1]["startMs"] + 1, (prev_end + s["startMs"]) // 2)
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
    ap.add_argument("--model", default="large-v3-turbo", help="faster-whisper model size or local model folder")
    ap.add_argument("--cache", help="transcript cache folder from hikaya_transcribe.py (reused, and filled)")
    ap.add_argument("--overrides", help="alignment_overrides.json exported from review.html")
    ap.add_argument("--report-dir", default="alignment_report")
    ap.add_argument("--text-status", help="e.g. recovered-transcript: the script was written down from the recording")
    args = ap.parse_args()

    from hikaya_transcribe import load_model, transcribe_file
    model_box = {}

    def get_model():
        if "m" not in model_box:
            model_box["m"] = load_model(args.model)
        return model_box["m"]

    def transcribe_cached(path, pcm):
        return words_of(transcribe_file(get_model, args.model, path, args.cache, pcm=pcm))
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

    speakers_used = {ln["speaker"] for ep in episodes for sc in ep["scenes"] for ln in sc["lines"]}
    missing = sorted(s for s in speakers_used if s not in recordings)
    if missing:
        raise SystemExit(f"no recording listed for: {', '.join(missing)} — add them to {args.recordings}")
    # Lines are found in the recordings in the order they were recorded: speakers
    # that share recordings are aligned together, and {src=…} (written by
    # hikaya_storyboard.py) gives the recording order when it differs from the play order.
    groups = {}
    for ep in episodes:
        for sc in ep["scenes"]:
            for ln in sc["lines"]:
                groups.setdefault(tuple(recordings[ln["speaker"]]), []).append(ln)

    results, cache = {}, {}
    for files, lines in groups.items():
        if all(ln.get("src") for ln in lines):
            lines = sorted(lines, key=lambda ln: ln["src"])
        who = ", ".join(sorted({ln["speaker"] for ln in lines}))
        print(f"aligning {who}: {len(lines)} lines in {', '.join(files)}", flush=True)
        for r in align_speaker(lines, list(files), None, args.book_dir, cache, transcribe_cached):
            results[r["id"]] = r
    for lid, o in overrides.items():
        if lid in results and results[lid]["file"]:
            results[lid].update(start=float(o["start"]), end=float(o["end"]), timing="verified")
            results[lid]["flags"] = [f for f in results[lid]["flags"]] + ["start/end set by hand"]

    os.makedirs(args.report_dir, exist_ok=True)
    rows = [results[ln["id"]] for ep in episodes for sc in ep["scenes"] for ln in sc["lines"]]
    for ep in episodes:
        data = build_episode(ep, results, speakers)
        if args.text_status:
            data["textStatus"] = args.text_status
        path = os.path.join(args.book_dir, data["id"], "episode.json")
        write_json(path, data)
        n = len(data["segments"])
        ver = sum(1 for s in data["segments"] if s["timing"] == "verified")
        print(f"episode {ep['episode']:02d}: {n} segments ({ver} verified) → {path}")
    with open(os.path.join(args.report_dir, "alignment.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "speaker", "file", "start_s", "end_s", "confidence", "timing", "flags", "notes", "text", "heard"])
        for r in rows:
            w.writerow([r["id"], r["speaker"], r["file"], r["start"] and round(r["start"], 2),
                        r["end"] and round(r["end"], 2), r["confidence"], r["timing"], "; ".join(r["flags"]),
                        "; ".join(r.get("notes", [])), r["text"], r.get("heard", "")])
    md = ["# Alignment report", "", "| Line | Speaker | Clip | Confidence | Timing | Flags | Notes |",
          "|---|---|---|---|---|---|---|"]
    for r in rows:
        clip = f"{os.path.basename(r['file'])} {r['start']:.2f}–{r['end']:.2f}" if r["file"] else "—"
        md.append(f"| {r['id']} | {r['speaker']} | {clip} | {r['confidence']:.2f} | {r['timing']} | "
                  f"{'; '.join(r['flags'])} | {'; '.join(r.get('notes', []))} |")
    with open(os.path.join(args.report_dir, "ALIGNMENT.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")
    review_html(rows, args.book_dir, os.path.join(args.report_dir, "review.html"))
    bad = [r for r in rows if r["timing"] != "verified"]
    print(f"{len(rows)} lines, {len(rows) - len(bad)} verified, {len(bad)} to review → {args.report_dir}/review.html")


if __name__ == "__main__":
    main()
