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

```bash
cd ~/path/to/Dodo                        # this repository

# 1. Inventory: checks Audio.zip and IMG.zip, extracts them safely, records checksums
python3 tools/hikaya/hikaya_assets.py    # reads ~/Downloads/Audio.zip and ~/Downloads/IMG.zip
open ~/HIKAYA/assets/INVENTORY.md        # what was found, per episode; duplicates; gaps

# 2. Write/clean each episode script in the HIKAYA script format (see hikaya_align.py --help),
#    then list which recording holds each speaker's lines (batch files are fine):
#    recordings.json → {"NARRATOR": ["audio/Batch 1/Riko_ep10-14.wav"], "AL_TIJANI": [...], ...}

# 3. Alignment: finds every line in the recordings and writes clips-mode episode.json files
python3 tools/hikaya/hikaya_align.py --book-dir ~/HIKAYA/books/thumma_ihtadayt \
    --scripts scripts/ep10.txt scripts/ep11.txt scripts/ep12.txt scripts/ep13.txt scripts/ep14.txt \
    --recordings recordings.json --speakers speakers.json
open alignment_report/review.html        # listen, fix any flagged line, export overrides, re-run with --overrides

# 4. Per-scene music and ambience (suggested from each scene; edit epNN/score.json and re-run)
python3 tools/hikaya/hikaya_score.py --book-dir ~/HIKAYA/books/thumma_ihtadayt --episode ep10

# 5. Package and import
python3 tools/hikaya/hikaya_pack.py check ~/HIKAYA/books/thumma_ihtadayt
python3 tools/hikaya/hikaya_pack.py build ~/HIKAYA/books/thumma_ihtadayt -o thumma_ihtadayt.zip
#    copy the ZIP to the phone → حكايا → المكتبة → استيراد كتاب
```

## Tools

| Tool | What it does |
|---|---|
| `hikaya_assets.py` | Steps 1–4. Validates both ZIPs and extracts them without path traversal or overwriting. Records SHA-256 for every file and finds duplicates. Detects episode numbers and batch ranges (e.g. `Ep10-14`), audio durations/formats, image sizes and damaged images. Writes cleaned script copies with TTS directions removed, while keeping brackets that hold real content and listing them for review. |
| `hikaya_align.py` | Locates each script line inside the recordings with word timestamps (faster-whisper). Cuts at the real speech boundaries, so words are never clipped. Flags repeated takes, unscripted speech, spoken directions and low confidence. Writes clips-mode timelines, a CSV/Markdown report and `review.html` for manual fixes. |
| `hikaya_score.py` | Suggests a music cue and ambience per scene, renders original stems ducked under the voices (silent during prayer) and links them into the episode. |
| `hikaya_pack.py` | `init` / `check` / `build` the importable book ZIP (format: `docs/BOOK_FORMAT.md`). |
| `intro/render_intro.py` | Renders the launch logo animation (HyperFrames) from the three original logos and installs it in the app. |

Tested here on the Episode 01 recordings. Automatic cuts matched the manually
verified cuts with **no clipped words** in 16/16 lines, and 15/16 lines were
verified automatically. The 16th («هنيئا لوالده») is flagged because the
transcriber hears «لولده». A deliberately doubled take was detected and flagged.
