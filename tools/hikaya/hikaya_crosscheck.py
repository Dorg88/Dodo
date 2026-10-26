#!/usr/bin/env python3
"""HIKAYA: compare an automatically aligned episode with hand-verified cut points.

    python3 hikaya_crosscheck.py --book-dir BOOK --episode ep01 \\
        --source production/ep01/episode_source.json --files files_ep01.json -o CUT_VALIDATION.md

For every hand-cut passage it measures where the speech really is (energy above
the recording's speech threshold) and checks that the automatic clips (1) hold
all of that speech and (2) stay inside the hand-cut window, i.e. contain nothing
of the neighbouring passages. Exit status 1 when a passage fails.
"""

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_align import frame_db, load_audio, speech_threshold  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--book-dir", required=True)
    ap.add_argument("--episode", required=True)
    ap.add_argument("--source", required=True)
    ap.add_argument("--files", required=True, help="JSON: source file name → path relative to the book")
    ap.add_argument("-o", "--output")
    a = ap.parse_args()
    with open(a.source, encoding="utf-8") as fh:
        src = json.load(fh)
    with open(os.path.join(a.book_dir, a.episode, "episode.json"), encoding="utf-8") as fh:
        ep = json.load(fh)
    with open(a.files, encoding="utf-8") as fh:
        fmap = json.load(fh)
    clips = [(s["clip"]["file"], s["clip"]["startMs"] / 1000, s["clip"]["endMs"] / 1000) for s in ep["segments"]]
    dbs, rows, bad = {}, [], 0
    for h in src["segments"]:
        f = fmap[h["source"]]
        if f not in dbs:
            db = frame_db(load_audio(os.path.join(a.book_dir, f)))
            dbs[f] = (db, speech_threshold(db))
        db, thr = dbs[f]
        loud = np.where(db[int(h["in"] * 100):int(h["out"] * 100)] > thr)[0]
        sa, sb = h["in"] + loud[0] / 100, h["in"] + loud[-1] / 100 + 0.01
        mine = [c for c in clips if c[0] == f and c[2] > h["in"] and c[1] < h["out"]]
        lo, hi = min(c[1] for c in mine), max(c[2] for c in mine)
        cover = lo <= sa + 0.005 and hi >= sb - 0.005
        inside = lo >= h["in"] - 0.005 and hi <= h["out"] + 0.005
        bad += not (cover and inside)
        verdict = "OK" if cover and inside else ("speech cut" if not cover else "includes neighbouring audio")
        rows.append(f"| {h['id']} | {os.path.basename(f)} | {h['in']:.2f}–{h['out']:.2f} | {sa:.2f}–{sb:.2f} | "
                    f"{lo:.2f}–{hi:.2f} | {verdict} |")
    md = [f"# Automatic cuts vs hand-verified cuts — {a.episode}", "",
          f"{len(rows) - bad} of {len(rows)} passages OK.", "",
          "| Passage | Recording | Hand cut (s) | Speech measured (s) | Automatic clips (s) | Result |",
          "|---|---|---|---|---|---|"] + rows
    text = "\n".join(md) + "\n"
    if a.output:
        with open(a.output, "w", encoding="utf-8") as fh:
            fh.write(text)
    print(text)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
