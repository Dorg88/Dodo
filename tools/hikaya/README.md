# HIKAYA Mac tools

These tools turn your production files into HIKAYA books. They run on macOS with
Python 3. They never modify or overwrite your original files.

## One-time setup (Terminal)

```bash
xcode-select --install                   # Python 3 + git, if not installed yet
brew install ffmpeg node                 # https://brew.sh for Homebrew
pip3 install -r tools/hikaya/requirements.txt
```

## The workflow

Validated end to end on Episode 01: the automatic cuts matched the hand-verified
cuts 16/16, every clip transcribed on its own held exactly its line (21/21), and
the app showed the right picture, speaker and highlighted sentence at every line.

```bash
cd ~/path/to/Dodo                        # this repository
python3 -m venv ~/HIKAYA/.venv && ~/HIKAYA/.venv/bin/pip install -r tools/hikaya/requirements.txt
PY=~/HIKAYA/.venv/bin/python; B=~/HIKAYA/books/thumma_ihtadayt

# 1. Inventory: checks Audio.zip and IMG.zip (and the ZIPs inside them), extracts safely, records checksums
python3 tools/hikaya/hikaya_assets.py    # reads ~/Downloads/Audio.zip and ~/Downloads/IMG.zip
open ~/HIKAYA/assets/INVENTORY.md        # what was found, per episode; duplicates; gaps

# 2. Transcribe every recording once (word timestamps, kept in a cache)
$PY tools/hikaya/hikaya_transcribe.py ~/HIKAYA/assets/audio --model large-v3-turbo --cache ~/HIKAYA/transcripts

# 3. A per-character script for each episode: the delivered one (sections «[الراوي — Riko]»),
#    or, when none exists, one recovered from the recordings (marked as such):
$PY tools/hikaya/hikaya_recover.py audio --episode 2 --title "…" --speakers speakers_ep02.json \
    --cache ~/HIKAYA/transcripts_large --model large-v3 --check-cache ~/HIKAYA/transcripts \
    --directions-from ALL_EPISODES.txt -o Episode_02.txt

# 4. Play order: list the numbered lines, write order/epNN.json (scenes, pictures, line references),
#    build the alignment script; the builder refuses dropped, repeated or reordered lines
python3 tools/hikaya/hikaya_storyboard.py list Episode_10.txt
python3 tools/hikaya/hikaya_storyboard.py build Episode_10.txt --spec $B/order/ep10.json \
    --images-dir ep10/images -o $B/scripts/ep10.txt --speakers $B/speakers.json

# 5. Alignment: finds every line in the recordings (batch files: give all their episodes at once)
$PY tools/hikaya/hikaya_align.py --book-dir $B --scripts $B/scripts/ep1{0,1,2,3,4}.txt \
    --recordings $B/recordings/batch1.json --speakers $B/speakers.json --cache ~/HIKAYA/transcripts \
    --report-dir $B/reports/batch1
open $B/reports/batch1/review.html       # listen, fix any flagged line, export overrides, re-run with --overrides

# 6. Per-scene music and ambience (edit epNN/score.json and re-run), then the playback check
$PY tools/hikaya/hikaya_score.py --book-dir $B --episode ep10
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib $PY tools/hikaya/hikaya_verify.py --book-dir $B --episode ep10 --video
open $B/reports/ep10/preview.mp4         # pictures, text and sound as in the app

# 7. Package, test in the app, import
python3 tools/hikaya/hikaya_pack.py build $B -o thumma_ihtadayt.zip
(cd storybook && HIKAYA_TEST_ZIP=$PWD/../thumma_ihtadayt.zip HIKAYA_TEST_EPISODE=10 flutter test test/imported_episode_test.dart)
#    copy the ZIP to the phone → حكايا → المكتبة → استيراد كتاب
```

## Tools

| Tool | What it does |
|---|---|
| `hikaya_assets.py` | Steps 1–4. Validates both ZIPs and extracts them without path traversal or overwriting. Records SHA-256 for every file and finds duplicates. Detects episode numbers and batch ranges (e.g. `Ep10-14`), audio durations/formats, image sizes and damaged images. Writes cleaned script copies with TTS directions removed, while keeping brackets that hold real content and listing them for review. |
| `hikaya_align.py` | Locates each script line inside the recordings with word timestamps (faster-whisper). Cuts at the real speech boundaries, so words are never clipped. Flags repeated takes, unscripted speech, spoken directions and low confidence. Writes clips-mode timelines, a CSV/Markdown report and `review.html` for manual fixes. |
| `hikaya_score.py` | Suggests a music cue and ambience per scene, renders original stems ducked under the voices (silent during prayer) and links them into the episode. |
| `hikaya_pack.py` | `init` / `check` / `build` the importable book ZIP (format: `docs/BOOK_FORMAT.md`). |
| `hikaya_transcribe.py` | Transcribes recordings once with word timestamps (faster-whisper, local) and keeps the result for the other tools. |
| `hikaya_recover.py` | Writes a per-character script from the project's original script, or recovers one from the recordings when none exists: passages split at the pauses heard, spoken directions kept in brackets, file and time of each passage, agreement of two transcriptions, documented hand corrections. Marked as a recovered transcript. |
| `hikaya_storyboard.py` | Turns a per-character script into a play-order script from a scene order (pictures and line references). The text is copied verbatim; it refuses a dropped, repeated or reordered line, and records each line's place in the recording order. |
| `hikaya_verify.py` | Assembles the episode exactly as the app plays it, transcribes every clip on its own (no spoken direction, no neighbouring line), checks scenes, pictures and display text, and renders a preview video. |
| `hikaya_crosscheck.py` | Compares automatic cuts with hand-verified ones. |
| `hikaya_scripts_docx.js` | Word document (Arabic, right to left) of per-character scripts. |
| `intro/render_intro.py` | Renders the launch logo animation (HyperFrames) from the three original logos and installs it in the app. |

Tested here on the Episode 01 recordings. Automatic cuts matched the manually
verified cuts with **no clipped words** in 16/16 lines, and 15/16 lines were
verified automatically. The 16th («هنيئا لوالده») is flagged because the
transcriber hears «لولده». A deliberately doubled take was detected and flagged.
