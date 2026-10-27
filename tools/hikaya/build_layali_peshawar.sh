#!/bin/bash
# Build «ليالي بيشاور» on the producer's Mac.
#
#   tools/hikaya/build_layali_peshawar.sh scripts      # play-order scripts from manifest.csv
#   tools/hikaya/build_layali_peshawar.sh align        # find every line in the recordings
#   tools/hikaya/build_layali_peshawar.sh fix          # hand-measured cuts from \$BOOK/clip_fixes.json
#   tools/hikaya/build_layali_peshawar.sh score 01 03  # music + playback check + preview (default: complete episodes)
#   tools/hikaya/build_layali_peshawar.sh pack         # refresh book.json, check, build the ZIP
#   tools/hikaya/build_layali_peshawar.sh mirror       # copy the text artifacts into production/
#
# Inputs: ~/Downloads/Peshawar_Cinematic (manifest.csv, scenes.csv, scripts/, voices/),
# the recordings copied to $BOOK/audio/<KEY>/ and the 323 scene pictures in
# $BOOK/epNN/images/scene_SS.jpg (originals kept in ~/HIKAYA/assets/peshawar_images).
# The play order and the text are the production's own (manifest.csv); nothing here
# changes a recording, a picture or a word. An episode with lines that were never
# recorded keeps its timeline as epNN/episode.partial.json and stays «قريباً» in the app.
set -euo pipefail
cd "$(dirname "$0")/../.."
PY=${PY:-$HOME/HIKAYA/.venv/bin/python}
BOOK=${BOOK:-$HOME/HIKAYA/books/layali_peshawar}
PROD=${PROD:-$HOME/Downloads/Peshawar_Cinematic}
AMBIENCE=${AMBIENCE:-roomtone}   # the nightly gatherings in the house in Peshawar
COMPLETE="01 03 04 15 16 17 18 19 20 21"

case ${1:-} in
  scripts)
    python3 tools/hikaya/hikaya_from_manifest.py --production "$PROD" --book-dir "$BOOK" ;;
  align)
    for f in "$BOOK"/ep*/episode.json; do cp "$f" "${f%.json}.scored.json"; done
    "$PY" tools/hikaya/hikaya_align.py --book-dir "$BOOK" --scripts "$BOOK"/scripts/ep*.txt \
      --recordings "$BOOK/recordings/all.json" --speakers "$BOOK/speakers.json" \
      --cache "$HOME/HIKAYA/transcripts" --model large-v3-turbo --report-dir "$BOOK/reports/all" \
      --overrides "$BOOK/alignment_overrides.json"   # cuts measured by ear (with why), see that file
    # an episode missing lines is not playable yet
    "$PY" - "$BOOK" "$PROD" <<'PYEOF'
import csv, collections, json, os, sys
book, prod = sys.argv[1:]
want = collections.Counter(int(r["episode"]) for r in csv.DictReader(open(f"{prod}/manifest.csv", encoding="utf-8-sig")))
for n, total in sorted(want.items()):
    d = os.path.join(book, f"ep{n:02d}")
    full, part = os.path.join(d, "episode.json"), os.path.join(d, "episode.partial.json")
    if not os.path.exists(full):
        continue
    got = len(json.load(open(full, encoding="utf-8"))["segments"])
    if got < total:
        os.replace(full, part)
        print(f"ep{n:02d}: {got} of {total} lines recorded → episode.partial.json")
PYEOF
    "$0" fix
    # an episode whose timeline did not change keeps its music (no need to score it again)
    "$PY" - "$BOOK" <<'PYEOF'
import glob, json, os, sys
for kept in sorted(glob.glob(os.path.join(sys.argv[1], "ep*", "episode.scored.json"))):
    new = kept.replace(".scored.json", ".json")
    if os.path.exists(new) and json.load(open(new, encoding="utf-8"))["segments"] == \
            json.load(open(kept, encoding="utf-8"))["segments"]:
        os.replace(kept, new)
    else:
        os.remove(kept)
        print(f"{os.path.basename(os.path.dirname(new))}: timeline changed → score it again")
PYEOF
    ;;
  fix)   # hand-measured cuts (clip_fixes.json) around words the voice engine added
    python3 - "$BOOK" <<'PYEOF'
import json, os, sys
book = sys.argv[1]
fixes = {k: v for k, v in json.load(open(os.path.join(book, "clip_fixes.json"), encoding="utf-8")).items() if not k.startswith("_")}
for ep in sorted({k.split("_")[0] for k in fixes}):
    p = os.path.join(book, ep, "episode.json")
    if not os.path.exists(p):
        continue
    e = json.load(open(p, encoding="utf-8"))
    for s in e["segments"]:
        for k in ("startMs", "endMs"):
            if k in fixes.get(s["id"], {}):
                delta = fixes[s["id"]][k] - s["clip"][k]   # the line keeps its place; only the cut moves
                s["clip"][k] += delta
                s[k] += delta
                print(f"{s['id']}: clip {k} = {s['clip'][k]} ({delta:+d} ms)")
        for ln in s.get("lines", []):   # sentence highlights stay inside the line
            ln["startMs"], ln["endMs"] = max(ln["startMs"], s["startMs"]), min(ln["endMs"], s["endMs"] - 1)
    json.dump(e, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
PYEOF
    ;;
  score)
    shift; for e in ${@:-$COMPLETE}; do
      "$PY" tools/hikaya/hikaya_score.py --book-dir "$BOOK" --episode "ep$e" --ambience "$AMBIENCE" | tail -1 \
        | tee "$BOOK/reports/score_ep$e.log"
      DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib "$PY" tools/hikaya/hikaya_verify.py \
        --book-dir "$BOOK" --episode "ep$e" --video | tail -1 || true   # the report holds the result
    done ;;
  pack)
    python3 tools/hikaya/hikaya_pack.py refresh "$BOOK"
    python3 tools/hikaya/hikaya_pack.py build "$BOOK" -o "$HOME/HIKAYA/layali_peshawar-v$(python3 -c \
      "import json;print(json.load(open('$BOOK/book.json'))['version'])").zip" ;;
  mirror)
    P=production/layali_peshawar; mkdir -p "$P"/{episodes,reports,recordings,scripts,score}
    cp "$BOOK/book.json" "$BOOK/speakers.json" "$BOOK/clip_fixes.json" "$BOOK/alignment_overrides.json" \
      "$BOOK/chatgpt_images.json" "$P/"; mkdir -p "$P/art"; cp "$BOOK"/art/*.svg "$P/art/"
    cp "$BOOK"/scripts/*.txt "$P/scripts/"; cp "$BOOK"/recordings/*.json "$P/recordings/"
    for d in "$BOOK"/ep*/; do
      e=$(basename "$d")
      [ -f "$d/episode.json" ] && cp "$d/episode.json" "$P/episodes/$e.json"
      [ -f "$d/episode.partial.json" ] && cp "$d/episode.partial.json" "$P/episodes/$e.partial.json"
      [ -f "$d/score.json" ] && cp "$d/score.json" "$P/score/$e.json"
    done
    for d in "$BOOK"/reports/*/; do
      n=$(basename "$d"); mkdir -p "$P/reports/$n"
      find "$d" -maxdepth 1 -type f \( -name '*.md' -o -name '*.csv' -o -name '*.json' -o -name '*.html' \) -exec cp {} "$P/reports/$n/" \;
    done
    cp "$BOOK"/reports/*.log "$P/reports/" 2>/dev/null || true ;;
  *) sed -n 2,16p "$0"; exit 1 ;;
esac
