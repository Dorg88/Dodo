#!/bin/bash
# Rebuild «ثم اهتديت» (22 episodes) on the producer's Mac, exactly as it was built.
#
#   tools/hikaya/build_thumma_ihtadayt.sh scripts      # play-order scripts from the orders
#   tools/hikaya/build_thumma_ihtadayt.sh align        # find every line in the recordings
#   tools/hikaya/build_thumma_ihtadayt.sh score 05 06  # music + playback check + preview (default: all)
#   tools/hikaya/build_thumma_ihtadayt.sh pack         # refresh book.json, check, build the ZIP
#   tools/hikaya/build_thumma_ihtadayt.sh mirror       # copy the text artifacts into production/
#
# Inputs: ~/HIKAYA/assets (hikaya_assets.py), the transcripts (hikaya_transcribe.py:
# large-v3-turbo in ~/HIKAYA/transcripts for all recordings, large-v3 in
# ~/HIKAYA/transcripts_large for Episodes 01–06 and Batch 3), the per-character
# scripts (delivered drafts for 07–22, recovered scripts for 01–06 and 20–22), and
# the scene orders in $BOOK/order/. Nothing here changes a recording or an image.
set -euo pipefail
cd "$(dirname "$0")/../.."
PY=${PY:-$HOME/HIKAYA/.venv/bin/python}
BOOK=${BOOK:-$HOME/HIKAYA/books/thumma_ihtadayt}
DRAFTS=$HOME/HIKAYA/assets/audio/HIKAYA_TTS_Scripts_01_22_Handover/HIKAYA_TTS_Handover
REC=$HOME/HIKAYA/recovered_scripts
ALL="01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22"

source_script() {  # per-character script of an episode
  case $1 in
    0[1-6]) echo "$REC/episodes_01_06/Episode_$1.txt" ;;
    2[0-2]) echo "$REC/episodes_20_22/Episode_$1.txt" ;;
    *) echo "$DRAFTS/Episode_$1.txt" ;;
  esac
}

align() {  # align <group> <cache> <model> <text-status or -> <episodes…>
  local name=$1 cache=$2 model=$3 status=$4; shift 4
  local scripts=(); for e in "$@"; do scripts+=("$BOOK/scripts/ep$e.txt"); done
  local extra=(); [ "$status" != "-" ] && extra=(--text-status "$status")
  "$PY" tools/hikaya/hikaya_align.py --book-dir "$BOOK" --scripts "${scripts[@]}" \
    --recordings "$BOOK/recordings/$name.json" --speakers "$BOOK/speakers.json" \
    --cache "$cache" --model "$model" --report-dir "$BOOK/reports/$name" "${extra[@]}"
}

case ${1:-} in
  scripts)
    for e in $ALL; do
      python3 tools/hikaya/hikaya_storyboard.py build "$(source_script "$e")" --spec "$BOOK/order/ep$e.json" \
        --images-dir "ep$e/images" -o "$BOOK/scripts/ep$e.txt" --speakers "$BOOK/speakers.json"
    done ;;
  align)
    T=$HOME/HIKAYA/transcripts; L=$HOME/HIKAYA/transcripts_large
    align ep01 "$T" large-v3-turbo - 01
    for e in 02 03 04 05 06; do align "ep$e" "$L" large-v3 recovered-transcript "$e"; done
    align ep07 "$T" large-v3-turbo - 07
    align ep08 "$T" large-v3-turbo - 08
    align ep09 "$T" large-v3-turbo - 09
    align batch1 "$T" large-v3-turbo - 10 11 12 13 14
    align batch2 "$T" large-v3-turbo - 15 16 17 18 19
    align batch3 "$L" large-v3 recovered-transcript 20 21 22 ;;
  score)
    shift; for e in ${@:-$ALL}; do
      "$PY" tools/hikaya/hikaya_score.py --book-dir "$BOOK" --episode "ep$e" | tail -1
      DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib "$PY" tools/hikaya/hikaya_verify.py \
        --book-dir "$BOOK" --episode "ep$e" --video | tail -1
    done ;;
  pack)
    python3 tools/hikaya/hikaya_pack.py refresh "$BOOK"
    python3 tools/hikaya/hikaya_pack.py build "$BOOK" -o "$HOME/HIKAYA/thumma_ihtadayt-v$(python3 -c \
      "import json;print(json.load(open('$BOOK/book.json'))['version'])").zip" ;;
  mirror)
    P=production/thumma_ihtadayt; mkdir -p "$P"/{episodes,reports,recordings,order,scripts,score}
    cp "$BOOK/book.json" "$BOOK/speakers.json" "$P/"
    cp "$BOOK"/order/*.json "$P/order/"; cp "$BOOK"/scripts/*.txt "$P/scripts/"; cp "$BOOK"/recordings/*.json "$P/recordings/"
    for e in $ALL; do
      [ -f "$BOOK/ep$e/episode.json" ] && cp "$BOOK/ep$e/episode.json" "$P/episodes/ep$e.json"
      [ -f "$BOOK/ep$e/score.json" ] && cp "$BOOK/ep$e/score.json" "$P/score/ep$e.json"
    done
    for d in "$BOOK"/reports/*/; do
      n=$(basename "$d"); mkdir -p "$P/reports/$n"
      cp "$d"/*.md "$P/reports/$n/" 2>/dev/null || true
      [ -f "$d/alignment.csv" ] && cp "$d/alignment.csv" "$P/reports/$n/"
    done
    rsync -a --include='*/' --include='*.txt' --include='*.md' --include='*.csv' --include='*.docx' --include='*.json' \
      --exclude='*' "$REC/" "$P/recovered_scripts/"
    cp "$HOME/HIKAYA/assets/INVENTORY.md" "$P/INVENTORY.md" ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
