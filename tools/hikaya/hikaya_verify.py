#!/usr/bin/env python3
"""HIKAYA: check an episode the way the app will play it, and render a preview.

    python3 hikaya_verify.py --book-dir BOOK --episode ep01 [--video] [--model large-v3-turbo]

1. Structure — scenes tile the timeline, every segment sits in a scene, every
   illustration exists, is whole and used once, display text holds no
   [directions], sentence timings run in order inside their segment.
2. Playback — the voice track is assembled exactly as the app plays it in clips
   mode (each clip from its original recording, silence between segments) and
   mixed with the music and ambience stems at the app's default levels.
3. Every clip, transcribed on its own, must hold its line and nothing else: no
   performance direction read aloud, no word of a neighbouring line.
4. --video renders preview.mp4: the illustration (whole, never cropped) above
   the Arabic text, the current sentence highlighted, on the episode clock.

Writes BOOK/reports/<episode>/PLAYBACK_CHECK.md, preview.m4a and preview.mp4.
Exit status 1 when a check fails. Needs numpy, scipy, faster-whisper, ffmpeg;
the video needs Pillow with Arabic shaping (raqm): on macOS run with
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib after `brew install libraqm`.
"""

import argparse
import difflib
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
from hikaya_align import DIRECTION_WORDS, norm  # noqa: E402
from hikaya_common import probe_image  # noqa: E402

SR = 16000
VOICE, MUSIC, SFX = 1.0, 0.7, 0.8      # the app's default mix (UserData)


def pcm_of(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def check_structure(book, ep, ep_id):
    problems, notes = [], []
    dur = ep["durationMs"]
    scenes = ep["scenes"]
    if scenes[0]["startMs"] != 0:
        problems.append("the first scene does not start at 0")
    for a, b in zip(scenes, scenes[1:]):
        if a["endMs"] != b["startMs"]:
            problems.append(f"gap or overlap between scenes {a['number']} and {b['number']}")
    if scenes[-1]["endMs"] != dur:
        problems.append("the last scene does not end with the episode")
    by_no = {s["number"]: s for s in scenes}
    prev_end = 0
    for s in ep["segments"]:
        sc = by_no.get(s["scene"])
        if not sc:
            problems.append(f"{s['id']}: scene {s['scene']} does not exist")
        elif not (sc["startMs"] <= s["startMs"] and s["endMs"] <= sc["endMs"]):
            problems.append(f"{s['id']}: outside its scene's time")
        if s["startMs"] < prev_end:
            problems.append(f"{s['id']}: starts before the previous segment ends")
        prev_end = s["endMs"]
        if "[" in s["text"] or "]" in s["text"]:
            problems.append(f"{s['id']}: display text holds a bracket")
        t = s["startMs"]
        for ln in s.get("lines", []):
            if ln["startMs"] < t or ln["endMs"] < ln["startMs"] or ln["endMs"] > s["endMs"] + 1:
                problems.append(f"{s['id']}: sentence timings out of order")
                break
            t = ln["endMs"]
    used = [s["image"] for s in scenes if s.get("image")]
    for img in used:
        p = os.path.join(book, img)
        info = probe_image(p) if os.path.exists(p) else {"damaged": "missing"}
        if info.get("damaged"):
            problems.append(f"image {img}: {info['damaged']}")
    dupes = sorted({u for u in used if used.count(u) > 1})
    if dupes:
        notes.append(f"illustrations shown in more than one scene: {', '.join(dupes)}")
    folder = os.path.join(book, ep_id, "images")
    have = sorted(f"{ep_id}/images/{f}" for f in os.listdir(folder)) if os.path.isdir(folder) else []
    unused = [h for h in have if h not in used]
    if unused:
        notes.append(f"illustrations not used: {', '.join(os.path.basename(u) for u in unused)}")
    return problems, notes


def assemble(book, ep):
    """The voice track as the app plays it, plus the stems at default levels."""
    total = int(ep["durationMs"] / 1000 * SR) + SR
    voice = np.zeros(total, np.float32)
    cache = {}
    for s in ep["segments"]:
        c = s["clip"]
        if c["file"] not in cache:
            cache[c["file"]] = pcm_of(os.path.join(book, c["file"]))
        x = cache[c["file"]][int(c["startMs"] / 1000 * SR): int(c["endMs"] / 1000 * SR)]
        st = int(s["startMs"] / 1000 * SR)
        voice[st: st + len(x)] += x[: max(0, total - st)]
    mix = voice * VOICE
    for key, gain in (("music", MUSIC), ("sfx", SFX)):
        if ep["audio"].get(key):
            x = pcm_of(os.path.join(book, ep["audio"][key]))[:total]
            mix[: len(x)] += x * gain
    return voice, mix, cache


def check_clips(ep, cache, model):
    rows, bad = [], 0
    for s in ep["segments"]:
        c = s["clip"]
        x = cache[c["file"]][int(c["startMs"] / 1000 * SR): int(c["endMs"] / 1000 * SR)]
        segs, _ = model.transcribe(x, language="ar", beam_size=5, vad_filter=False, condition_on_previous_text=False)
        heard = " ".join(seg.text.strip() for seg in segs)
        exp, got = norm(s["text"]), norm(heard)
        ratio = difflib.SequenceMatcher(None, " ".join(exp), " ".join(got), autojunk=False).ratio()
        sm = difflib.SequenceMatcher(None, exp, got, autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size]
        extra_head = got[: blocks[0].b] if blocks else got
        extra_tail = got[blocks[-1].b + blocks[-1].size:] if blocks else []
        issues = []
        # a phrase the transcriber invents in the silence that closes a clip
        # («المترجم للقناة»…) is not speech in the clip
        from hikaya_recover import HALLUCINATIONS
        if extra_tail and any(extra_tail[-len(h):] == [norm(x)[0] if norm(x) else x for x in h] and len(extra_tail) == len(h)
                              for h in HALLUCINATIONS if len(h) > 1):
            extra_tail = []
        for side, extra in (("start", extra_head), ("end", extra_tail)):
            if not extra:
                continue
            fuzzy = difflib.SequenceMatcher(None, " ".join(extra), " ".join(exp[:len(extra)] if side == "start"
                                                                            else exp[-len(extra):])).ratio()
            if any(any(d in w for d in DIRECTION_WORDS) for w in extra):
                issues.append(f"direction heard at the {side}: {' '.join(extra)}")
            elif len(extra) >= 2 and fuzzy < 0.6:
                issues.append(f"extra speech at the {side}: {' '.join(extra)}")
        if ratio < 0.75:
            issues.append(f"clip differs from the text ({ratio:.2f})")
        bad += bool(issues)
        rows.append((s, heard, ratio, issues))
    return rows, bad


def render_video(book, ep, ep_id, audio_path, out_path, width=720, height=1280):
    from PIL import Image, ImageDraw, ImageFont, features
    if not features.check("raqm"):
        raise SystemExit("Pillow cannot shape Arabic here (raqm missing): run with "
                         "DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib after brew install libraqm")
    fonts = os.path.join(os.path.dirname(HERE), "..", "storybook", "assets", "fonts")
    body = ImageFont.truetype(os.path.join(fonts, "Amiri-Regular.ttf"), 34, layout_engine=ImageFont.Layout.RAQM)
    bold = ImageFont.truetype(os.path.join(fonts, "Amiri-Bold.ttf"), 30, layout_engine=ImageFont.Layout.RAQM)
    small = ImageFont.truetype(os.path.join(fonts, "Amiri-Regular.ttf"), 24, layout_engine=ImageFont.Layout.RAQM)
    paper, ink, gold, dim = (246, 239, 224), (46, 36, 25), (150, 105, 40), (140, 125, 105)

    def wrap(draw, text, font, maxw):
        words, lines, cur = text.split(), [], ""
        for w in words:
            t = f"{cur} {w}".strip()
            if draw.textlength(t, font=font, direction="rtl") <= maxw or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    # every moment where the picture or the highlighted sentence changes
    marks = {0, ep["durationMs"]}
    for sc in ep["scenes"]:
        marks.update((sc["startMs"], sc["endMs"]))
    for s in ep["segments"]:
        marks.update((s["startMs"], s["endMs"]))
        for ln in s.get("lines", []):
            marks.update((ln["startMs"], ln["endMs"]))
    marks = sorted(m for m in marks if 0 <= m <= ep["durationMs"])
    tmp = tempfile.mkdtemp(prefix="hikaya_preview_")
    concat = []
    images = {}
    for k, (a, b) in enumerate(zip(marks, marks[1:])):
        if b - a < 40:
            continue
        t = (a + b) / 2
        sc = next(s for s in ep["scenes"] if s["startMs"] <= t < s["endMs"] or s is ep["scenes"][-1])
        seg = next((s for s in ep["segments"] if s["startMs"] <= t < s["endMs"]), None)
        if seg is None:   # between lines: keep the last line visible, nothing highlighted
            prev = [s for s in ep["segments"] if s["endMs"] <= t and s["scene"] == sc["number"]]
            seg_show, active = (prev[-1] if prev else None), None
        else:
            seg_show = seg
            active = next((ln for ln in seg.get("lines", []) if ln["startMs"] <= t < ln["endMs"]), None)
        frame = Image.new("RGB", (width, height), paper)
        d = ImageDraw.Draw(frame)
        top = height // 2
        if sc.get("image"):
            if sc["image"] not in images:
                images[sc["image"]] = Image.open(os.path.join(book, sc["image"])).convert("RGB")
            im = images[sc["image"]].copy()
            im.thumbnail((width - 40, top - 40))       # whole image, never cropped
            frame.paste(im, ((width - im.width) // 2, (top - im.height) // 2))
        else:
            d.text((width // 2, top // 2), ep["title"], font=bold, fill=gold, anchor="mm", direction="rtl")
        d.text((width - 24, top + 16), f"المشهد {sc['number']} — {sc['title']}", font=small, fill=gold,
               anchor="ra", direction="rtl")
        y = top + 70
        if seg_show:
            d.text((width - 24, y), seg_show["speakerName"], font=bold, fill=gold, anchor="ra", direction="rtl")
            y += 52
            parts = seg_show.get("lines") or [{"text": seg_show["text"]}]
            for ln in parts:
                colour = ink if (active is ln or (active is None and seg is not None)) else dim
                for row in wrap(d, ln["text"], body, width - 48):
                    if y > height - 60:
                        break
                    d.text((width - 24, y), row, font=body, fill=colour, anchor="ra", direction="rtl")
                    y += 50
        d.text((24, height - 40), f"{a / 1000:6.1f} s", font=small, fill=dim, anchor="la")
        path = os.path.join(tmp, f"f{k:05d}.png")
        frame.save(path)
        concat.append(f"file '{path}'\nduration {(b - a) / 1000:.3f}")
    concat.append(f"file '{path}'")
    listing = os.path.join(tmp, "frames.txt")
    with open(listing, "w") as fh:
        fh.write("\n".join(concat) + "\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-i", audio_path,
                    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                    "-c:a", "aac", "-b:a", "96k", "-shortest", out_path], check=True)
    return len(concat) - 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--book-dir", required=True)
    ap.add_argument("--episode", required=True)
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--video", action="store_true")
    ap.add_argument("--preview-only", action="store_true", help="only re-render preview.m4a/mp4 (e.g. after new music)")
    a = ap.parse_args()
    book = os.path.expanduser(a.book_dir)
    with open(os.path.join(book, a.episode, "episode.json"), encoding="utf-8") as fh:
        ep = json.load(fh)
    out_dir = os.path.join(book, "reports", a.episode)
    os.makedirs(out_dir, exist_ok=True)

    problems, notes = check_structure(book, ep, a.episode)
    voice, mix, cache = assemble(book, ep)
    peak = float(np.max(np.abs(mix)) or 1)
    audio_path = os.path.join(out_dir, "preview.m4a")
    proc = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                           "-c:a", "aac", "-b:a", "96k", audio_path],
                          input=(mix / max(1.0, peak / 0.98)).astype(np.float32).tobytes(), capture_output=True)
    if proc.returncode:
        problems.append(f"could not write preview audio: {proc.stderr.decode()[:200]}")

    if a.preview_only:
        render_video(book, ep, a.episode, audio_path, os.path.join(out_dir, "preview.mp4"))
        print(f"preview → {out_dir}/preview.mp4")
        return
    from faster_whisper import WhisperModel
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    rows, bad = check_clips(ep, cache, model)

    md = [f"# Playback check — {a.episode} «{ep['title']}»", "",
          f"Duration {ep['durationMs'] / 60000:.2f} min · {len(ep['scenes'])} scenes · {len(ep['segments'])} segments · "
          f"mix: voice {VOICE}, music {MUSIC}, ambience {SFX} (app defaults)", "",
          "## Structure", ""]
    md += [f"- ✗ {p}" for p in problems] or ["- ✓ scenes tile the timeline; segments inside their scenes; "
                                             "illustrations present and whole; no brackets in the display text"]
    md += [f"- {n}" for n in notes]
    md += ["", "## Speaking order and clips (each clip transcribed on its own)", "",
           "| # | Time | Scene | Speaker | Text | Heard in the clip | Match | Result |", "|---|---|---|---|---|---|---|---|"]
    for i, (s, heard, ratio, issues) in enumerate(rows, 1):
        md.append(f"| {i} | {s['startMs'] / 1000:.1f}–{s['endMs'] / 1000:.1f} | {s['scene']} | {s['speakerName']} | "
                  f"{s['text']} | {heard} | {ratio:.2f} | {'; '.join(issues) or 'OK'} |")
    md += ["", f"**{len(rows) - bad} of {len(rows)} clips hold exactly their line.**"]
    if a.video:
        n = render_video(book, ep, a.episode, audio_path, os.path.join(out_dir, "preview.mp4"))
        md += ["", f"Preview video: `preview.mp4` ({n} frames: the picture changes with the scene, the sentence "
                   "being spoken is highlighted)."]
    with open(os.path.join(out_dir, "PLAYBACK_CHECK.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")
    print("\n".join(md[:8]))
    print(f"{len(rows) - bad}/{len(rows)} clips OK · {len(problems)} structural problem(s) → {out_dir}/PLAYBACK_CHECK.md")
    sys.exit(1 if problems or bad else 0)


if __name__ == "__main__":
    main()
