#!/usr/bin/env python3
"""HIKAYA: transcribe the original recordings once, with word timestamps, and keep the result.

    python3 hikaya_transcribe.py ~/HIKAYA/assets/audio [more files or folders] \\
        [--model large-v3-turbo] [--cache ~/HIKAYA/transcripts]

For every recording writes <cache>/<sha256 prefix>.<model>.json (segments with
words, start/end and probability). hikaya_align.py --cache reuses these files,
so a recording is only transcribed once. Also writes <cache>/TRANSCRIPTS.md:
each recording's text with segment times, for listening and checking.

A transcript is machine output. It shows what the recording says so that a
script can be checked or a missing one written down and reviewed; it is never
published as the text of an episode without that review.

Needs: pip install faster-whisper ; ffmpeg.
"""

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import AUDIO_EXT, sha256, write_json  # noqa: E402

SR = 16000


def load_pcm(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def cache_path(cache_dir, digest, model_name):
    return os.path.join(cache_dir, f"{digest[:16]}.{os.path.basename(model_name.rstrip('/'))}.json")


def transcribe_file(model, model_name, path, cache_dir, pcm=None):
    """Transcript of one recording, from the cache when it exists. `model` may be
    a function returning the model, so it is only loaded when needed."""
    digest = sha256(path)
    cp = cache_path(cache_dir, digest, model_name) if cache_dir else None
    if cp and os.path.exists(cp):
        with open(cp, encoding="utf-8") as fh:
            return json.load(fh)
    if pcm is None:
        pcm = load_pcm(path)
    if callable(model):
        model = model()
    segs, info = model.transcribe(pcm, language="ar", word_timestamps=True, beam_size=5, vad_filter=False,
                                  condition_on_previous_text=False)
    out = {"file": os.path.basename(path), "sha256": digest, "model": model_name,
           "duration_s": round(len(pcm) / SR, 3), "segments": []}
    for s in segs:
        out["segments"].append({
            "start": round(float(s.start), 3), "end": round(float(s.end), 3), "text": s.text.strip(),
            "words": [{"w": w.word.strip(), "s": round(float(w.start), 3), "e": round(float(w.end), 3),
                       "p": round(float(w.probability), 3)} for w in (s.words or [])]})
    if cp:
        write_json(cp, out)
    return out


def load_model(name):
    from faster_whisper import WhisperModel
    return WhisperModel(name, device="cpu", compute_type="int8")


def collect(paths):
    files = []
    for p in paths:
        p = os.path.expanduser(p)
        if os.path.isdir(p):
            for root, _, names in os.walk(p):
                files += [os.path.join(root, n) for n in names if os.path.splitext(n)[1].lower() in AUDIO_EXT]
        elif os.path.splitext(p)[1].lower() in AUDIO_EXT:
            files.append(p)
    return sorted(set(files))


def fmt(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="recordings or folders holding them")
    ap.add_argument("--model", default="large-v3-turbo", help="faster-whisper model name or local folder")
    ap.add_argument("--cache", default=os.path.expanduser("~/HIKAYA/transcripts"))
    args = ap.parse_args()

    files = collect(args.paths)
    if not files:
        sys.exit("no recordings found")
    loaded = {}

    def model():
        if "m" not in loaded:
            loaded["m"] = load_model(args.model)
        return loaded["m"]

    md = ["# Transcripts (machine output — for checking, not for publishing)", "",
          f"Model: `{args.model}`. Times are seconds inside each original recording.", ""]
    for i, f in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {f}", flush=True)
        t = transcribe_file(model, args.model, f, args.cache)
        md += [f"## {os.path.relpath(f, os.path.commonpath(files) if len(files) > 1 else os.path.dirname(f))}",
               "", f"duration {fmt(t['duration_s'])} · `{t['sha256'][:16]}`", ""]
        md += [f"- `{fmt(s['start'])}–{fmt(s['end'])}` {s['text']}" for s in t["segments"]] + [""]
    os.makedirs(args.cache, exist_ok=True)
    with open(os.path.join(args.cache, "TRANSCRIPTS.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")
    print(f"{len(files)} recordings → {args.cache}/TRANSCRIPTS.md")


if __name__ == "__main__":
    main()
