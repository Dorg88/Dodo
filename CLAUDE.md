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
- `tts/` — Gemini TTS pipeline (voices verified on gemini-3.8-flash-tts); not needed for HIKAYA playback
- `.github/workflows/build-apk.yml` — CI builds debug + release APK → release `apk-latest`

## Rules that must not be broken
- Never regenerate or replace the producer's recordings or illustrations; never overwrite originals.
- Never invent timestamps, image paths, dialogue, verses or quotations; flag uncertainty instead.
- TTS directions in [brackets] are removed from displayed text only; brackets with real content stay.
- Illustrations are shown whole and static (no crop/zoom/pan); only page-level transitions animate.
- No music during prayer / «الله أكبر»; music stays ≥15 dB under speech.
- Don't mark an episode PASS unless its audio and synchronization are verified.

## NEXT STEPS (need the producer's Mac)
1. `python3 tools/hikaya/hikaya_assets.py` → reads `~/Downloads/Audio.zip` and `~/Downloads/IMG.zip`,
   extracts to `~/HIKAYA/assets`, writes `INVENTORY.md`. Report the inventory (counts, episodes, gaps).
2. Batches: Episodes 1–9 produced separately; Batch 1 = Ep 10–14, Batch 2 = Ep 15–19, Batch 3 = Ep 20–22
   (a batch file may hold one character's lines for several episodes). Voices: Riko=Narrator, Enzo=al-Tijani,
   Ludo=Professor Munim, Lumi=Mother, Bodi=Father, Sola=Wife; find other speakers in the scripts.
3. Build `~/HIKAYA/books/thumma_ihtadayt/` (book.json with id `thumma_ihtadayt`, 22 episodes): convert the
   scripts to the align format, write recordings.json per batch, run `hikaya_align.py`, review flags
   (`review.html`), map illustrations to scenes from IMG.zip (by episode/scene numbers — never invent).
4. `hikaya_score.py` per episode, then `hikaya_pack.py check` / `build`; import the ZIP in the app.
5. DONE (cloud session): logos are in `tools/hikaya/intro/logos_original/`, the intro is rendered into
   `storybook/assets/brand/intro.mp4`, and the launcher icon uses the HIKAYA emblem. Re-run
   `render_intro.py` only if a higher-resolution shrine logo arrives (the current one is 591×338).
6. Update `QA_REPORT.md` per episode (PASS / WARNING / FAIL) and `PROGRESS.md`; commit and push.

## Commands
- App: `cd storybook && flutter pub get && flutter analyze && flutter test && flutter build apk --debug`
- Tools' tests: `python3 -m pytest tts/tests` (TTS pipeline); app tests cover importer/timeline/layout.
