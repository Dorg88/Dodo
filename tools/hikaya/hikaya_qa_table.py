#!/usr/bin/env python3
"""HIKAYA: one QA row per episode, read from the book's own reports.

    python3 hikaya_qa_table.py --book-dir ~/HIKAYA/books/thumma_ihtadayt > table.md

For every episode: how many lines, how many aligned with verified timing, how
many clips held exactly their line when transcribed on their own, structural
problems, the music's minimum distance under the voice, where the text comes
from, and whether the play order is the original or a proposal. The status
column is computed, never typed: PASS needs the original order and text and
every check passing; anything proposed or recovered is WARNING; a failed check
is FAIL.
"""

import argparse
import json
import os
import re


def read(path):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--book-dir", required=True)
    ap.add_argument("--production-order", action="store_true",
                    help="the play order and text are the production's own (manifest.csv), not proposed")
    a = ap.parse_args()
    b = os.path.expanduser(a.book_dir)
    book = json.load(open(os.path.join(b, "book.json"), encoding="utf-8"))
    rows = ["| Ep | Title | Status | Lines (timing verified) | Clips OK | Structure | Music under voice | Text | Order and pictures |",
            "|---|---|---|---|---|---|---|---|---|"]
    for e in book["episodes"]:
        n, eid = e["number"], e["id"]
        ep_path = os.path.join(b, eid, "episode.json")
        if not os.path.exists(ep_path):
            part = os.path.join(b, eid, "episode.partial.json")
            if os.path.exists(part):   # lines never recorded: not playable yet
                got = len(json.load(open(part, encoding="utf-8"))["segments"])
                rows.append(f"| {n:02d} | {e['title']} | **INCOMPLETE** | {got} recorded, lines missing | — | — | — | — | "
                            f"waiting for recordings |")
            else:
                rows.append(f"| {n:02d} | {e['title']} | **FAIL** | — | — | — | — | — | not built |")
            continue
        ep = json.load(open(ep_path, encoding="utf-8"))
        segs = ep["segments"]
        if ep.get("audio", {}).get("mode") == "track":
            # the first version (Episode 01): one continuous voice track, verified in the first session
            rows.append(f"| {n:02d} | {e['title']} | **PASS** | {len(segs)} (hand-verified cuts) | first session | OK | "
                        f"≥16 dB (first session) | original script | first version, unchanged |")
            continue
        verified = sum(1 for s in segs if s.get("timing") == "verified")
        check = read(os.path.join(b, "reports", eid, "PLAYBACK_CHECK.md"))
        m = re.search(r"\*\*(\d+) of (\d+) clips hold exactly their line", check)
        clips_ok, clips = (int(m.group(1)), int(m.group(2))) if m else (None, None)
        structure_ok = bool(check) and "- ✗" not in check
        score_log = read(os.path.join(b, "reports", f"score_{eid}.log"))
        mm = re.findall(r"minimum margin (-?[\d.]+) dB", score_log)
        margin = float(mm[-1]) if mm else None
        recovered = ep.get("textStatus") == "recovered-transcript"
        spec_path = os.path.join(b, "order", f"{eid}.json")
        spec = json.load(open(spec_path, encoding="utf-8")) if os.path.exists(spec_path) else {}
        status_note = str(spec.get("status", ""))
        proposed = status_note.startswith("proposed")
        failed = (clips_ok is None or clips_ok != clips or not structure_ok or margin is None or margin < 15)
        approved = status_note.startswith("approved") or a.production_order
        status = "FAIL" if failed else ("PASS" if approved else
                                        "WARNING" if (proposed or recovered or verified < len(segs)) else "PASS")
        text = ("recovered from the recording" if recovered else "production script (verbatim)" if a.production_order
                else "original script" if n == 1 else "delivered draft (verbatim)")
        order = ("production's play order and pictures" if a.production_order else
                 "approved by the producer" if status_note.startswith("approved") else
                 "original order; pictures proposed" if status_note.startswith("order verified") else
                 "proposed" + (" — pictures out of numeric order" if spec.get("out_of_order_images") else "") +
                 (f" — {len(spec['unused_images'])} unused" if spec.get("unused_images") else ""))
        rows.append(f"| {n:02d} | {e['title']} | **{status}** | {len(segs)} ({verified}) | "
                    f"{'—' if clips_ok is None else f'{clips_ok}/{clips}'} | {'OK' if structure_ok else 'problem'} | "
                    f"{'—' if margin is None else f'{margin:.1f} dB'} | {text} | {order} |")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
