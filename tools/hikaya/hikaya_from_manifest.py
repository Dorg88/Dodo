#!/usr/bin/env python3
"""HIKAYA: alignment scripts from a production that already numbers its lines.

    python3 hikaya_from_manifest.py --production ~/Downloads/Peshawar_Cinematic \\
        --book-dir ~/HIKAYA/books/layali_peshawar

For productions such as «ليالي بيشاور», whose manifest.csv lists every line in
play order (line id, episode, order, scene, character key, tone, text) and whose
scenes.csv describes each scene's picture. Writes, without retyping anything:
  BOOK/scripts/epNN.txt      play order, one scene per picture (images/scene_SS.jpg),
                             tone kept as the line's direction (metadata), text verbatim
  BOOK/speakers.json         character key → name
  BOOK/recordings/all.json   character key → its recordings, oldest first; "_pickups": recordings
                             made later for missing lines (audio/<KEY>/pickups/), aligned separately;
                             a pickup with NAME.lines.txt (line ids) re-records exactly those lines
Each line carries {src=EE.OOOO}: its place in the character's recording order
(episode, then order in the episode), which is how the batches were recorded.
"""

import argparse
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hikaya_common import AUDIO_EXT, write_json  # noqa: E402


def short_title(description, limit=48):
    """A scene title for the player's caption: the description up to its first colon or comma."""
    t = re.split(r"[:،,]", description, maxsplit=1)[0].strip()
    return t if len(t) <= limit else t[:limit].rsplit(" ", 1)[0] + "…"


def recorded_at(path):
    """Order of recording: the date and time in «Generated Audio October 27, 2026 - 2_19AM.wav»,
    else the file's modification time."""
    import datetime
    m = re.search(r"([A-Z][a-z]+ \d{1,2}, \d{4}) - (\d{1,2})_(\d{2})\s*([AP]M)", os.path.basename(path))
    if m:
        t = datetime.datetime.strptime(f"{m.group(1)} {m.group(2)}:{m.group(3)} {m.group(4)}", "%B %d, %Y %I:%M %p")
        return t.timestamp()
    return os.path.getmtime(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--production", required=True)
    ap.add_argument("--book-dir", required=True)
    a = ap.parse_args()
    prod, book = os.path.expanduser(a.production), os.path.expanduser(a.book_dir)

    rows = list(csv.DictReader(open(os.path.join(prod, "manifest.csv"), encoding="utf-8-sig")))
    scenes = {(int(r["episode"]), int(r["scene"])): r["description"]
              for r in csv.DictReader(open(os.path.join(prod, "scenes.csv"), encoding="utf-8-sig"))}
    titles = {}
    for n in sorted({int(r["episode"]) for r in rows}):
        with open(os.path.join(prod, "scripts", f"EP{n:02d}_script.txt"), encoding="utf-8-sig") as fh:
            m = re.match(r"\s*الحلقة\s+\d+\s*:\s*(.+)", fh.readline())
        titles[n] = m.group(1).strip() if m else ""

    os.makedirs(os.path.join(book, "scripts"), exist_ok=True)
    speakers = {}
    for n in sorted(titles):
        lines = sorted((r for r in rows if int(r["episode"]) == n), key=lambda r: int(r["order"]))
        out = [f"@episode {n}", f"@title {titles[n]}",
               "# Built by hikaya_from_manifest.py from manifest.csv (play order and text verbatim).", ""]
        current = None
        for r in lines:
            sc = int(r["scene"])
            if sc != current:
                current = sc
                out += ["", f"=== SCENE s{sc:02d} | {short_title(scenes.get((n, sc), ''))}",
                        f"@image ep{n:02d}/images/scene_{sc:02d}.jpg"]
            key = r["character_key"]
            speakers.setdefault(key, r["character"])
            tone = r["tone"].replace("[", "").replace("]", "")
            src = f"{n:02d}.{int(r['order']):04d}"
            out.append(f"{key} [{tone}] {{src={src} id={r['line_id']}}}: {r['text'].strip()}")
        with open(os.path.join(book, "scripts", f"ep{n:02d}.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(out) + "\n")
    write_json(os.path.join(book, "speakers.json"), speakers)

    recordings = {}
    for key in speakers:
        folder = os.path.join(book, "audio", key)
        files = sorted((f for f in os.listdir(folder) if os.path.splitext(f)[1].lower() in AUDIO_EXT),
                       key=lambda f: recorded_at(os.path.join(folder, f))) if os.path.isdir(folder) else []
        recordings[key] = [f"audio/{key}/{f}" for f in files]
    pickups = {}   # recordings made later for lines missing from the first ones: audio/<KEY>/pickups/
    for key in speakers:
        folder = os.path.join(book, "audio", key, "pickups")
        if os.path.isdir(folder):
            pickups[key] = []
            for f in sorted(os.listdir(folder)):
                if os.path.splitext(f)[1].lower() not in AUDIO_EXT:
                    continue
                rel = f"audio/{key}/pickups/{f}"
                listed = os.path.join(folder, os.path.splitext(f)[0] + ".lines.txt")
                if os.path.exists(listed):   # a re-recording of these lines (ids), replacing the earlier takes
                    ids = [w for w in open(listed, encoding="utf-8").read().split() if w]
                    pickups[key].append({"file": rel, "lines": ids})
                else:
                    pickups[key].append(rel)
    if pickups:
        recordings["_pickups"] = pickups
    write_json(os.path.join(book, "recordings", "all.json"), recordings)
    missing = [k for k, v in recordings.items() if not v and not k.startswith("_")]
    print(f"{len(titles)} episodes, {len(rows)} lines, {len(scenes)} scenes → {book}/scripts"
          + (f"; no recording for {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
