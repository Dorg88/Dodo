# HIKAYA (حكايا) — project brief for Claude Code

An offline Arabic illustrated-audiobook app for Android (Flutter), produced for
شعبة البحوث والدراسات — قسم الشؤون الدينية — الأمانة العامة للعتبة الحسينية المقدسة.
Idea and design: ضرغام الگيار. First book: «ثم اهتديت», محمد التيجاني السماوي (22 episodes).

Work on branch `ccr-98ead9b4-z932hl`. Progress log: `PROGRESS.md`. QA status: `QA_REPORT.md`.

## Layout
- `storybook/` — Flutter app (package `hikaya`, Android id `com.dodo.hikaya`).
  - `lib/models/` book + episode timeline models (`hikaya.book.v1`, `hikaya.episode.v1`, see `docs/BOOK_FORMAT.md`)
  - `lib/services/` library store (bundled + imported books), safe ZIP importer, playback engine
    (track/clips modes, stems follow the clock), media session, user data
  - `lib/screens/` intro, home, library/import, book, player (image on top half, text below), bookmarks, search, settings, help
  - `assets/books/thumma_ihtadayt/` bundled sample (Episode 1, verified timeline); `assets/brand/` launch intro + logos
  - `test/` unit + widget tests; `screenshots/render_test.dart` renders PNGs (`flutter test screenshots --update-goldens`)
- `tools/hikaya/` — Mac tools: `hikaya_assets.py` (inventory), `hikaya_align.py` (align lines to recordings),
  `hikaya_score.py` (per-scene music/SFX), `hikaya_pack.py` (book ZIP), `intro/render_intro.py` (HyperFrames logo intro)
- `tools/sound_library.py`, `tools/build_episode.py` — procedural music/ambience, Episode 1 builder
- `production/ep01/` — Episode 1 sources (recordings, images, timeline report)
- `production/thumma_ihtadayt/` — the full book's text artifacts: scene orders, play-order scripts, recording
  maps, alignment/playback reports, recovered scripts and Word documents, inventory
- `production/layali_peshawar/` — second book «ليالي بيشاور»: built from the production's manifest.csv with
  `tools/hikaya/build_layali_peshawar.sh` (book in `~/HIKAYA/books/layali_peshawar/`); 10 of 22 episodes playable,
  the rest wait for 313 unrecorded lines (see `QA_REPORT.md`)
- `tts/` — Gemini TTS pipeline (voices verified on gemini-3.8-flash-tts); not needed for HIKAYA playback
- `.github/workflows/build-apk.yml` — CI builds debug + release APK → release `apk-latest`

## Rules that must not be broken
- Never regenerate or replace the producer's recordings or illustrations; never overwrite originals.
- Never invent timestamps, image paths, dialogue, verses or quotations; flag uncertainty instead.
- TTS directions in [brackets] are removed from displayed text only; brackets with real content stay.
- Illustrations are shown whole and static (no crop/zoom/pan); only page-level transitions animate.
- No music during prayer / «الله أكبر»; music stays ≥15 dB under speech.
- Don't mark an episode PASS unless its audio and synchronization are verified.

## STATE (2026-10-26, on the producer's Mac)
Book folder `~/HIKAYA/books/thumma_ihtadayt/` (originals copied unchanged; build with `hikaya_pack.py`).
Text artifacts mirrored in `production/thumma_ihtadayt/` (orders, scripts, maps, reports, recovered scripts).
- Episodes 02–22 built in clips mode from the original recordings and the 15 IMG.zip illustrations each.
- Ep 01: the FIRST VERSION, unchanged (producer's decision): copied byte for byte from the bundled book; never
  rebuild it. The pipeline trial on it (automatic cuts = hand cuts 16/16) lives in ~/HIKAYA/books/ep01_pipeline_trial.
- Ep 07–19: delivered per-character drafts; play order and picture placement PROPOSED (order/epNN.json).
- Ep 02–06, 20–22: no script matches the recordings → text recovered from the audio (two local transcriptions),
  marked `textStatus: recovered-transcript`; spoken TTS directions deleted from the texts, the display and the clips
  (a copy with them, needed by alignment, is in ~/HIKAYA/recovered_scripts/data/).
- Episodes awaiting the producer's approval carry `status: review` in book.json («قيد المراجعة» in the app).

## NEXT STEPS (need the producer)
1. Listen and approve/correct the proposed orders (`order/epNN.json`, preview videos in `reports/epNN/`).
2. Review the recovered texts (`~/HIKAYA/recovered_scripts/…`, Word documents) and the open questions in
   `QA_REPORT.md` (swapped Fellow/Juniorscholar files, Atrash = Sheikh Abd al-Basit?, Batch 3 boundaries). After a change: storyboard build → align → score → verify → pack refresh/build.
3. Test the imported book on a phone (background playback, lock-screen controls).

## Commands
- App: `cd storybook && flutter pub get && flutter analyze && flutter test && flutter build apk --debug`
  (on the Mac, Flutter 3.47.8 is at `~/HIKAYA/flutter/bin/flutter`; tools' Python venv at `~/HIKAYA/.venv`)
- Imported book in the real player: `HIKAYA_TEST_ZIP=/path/book.zip flutter test test/imported_episode_test.dart`
- Workflow of the Mac tools: `tools/hikaya/README.md`
- Tools' tests: `python3 -m pytest tts/tests` (TTS pipeline); app tests cover importer/timeline/layout.
