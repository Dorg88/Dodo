# HIKAYA — progress log

## 2026-10-25 (cloud session)
- [x] Checkpoint before rebuild: commit `37d3bb9` (local tag `checkpoint-before-hikaya`)
- [x] App rebuilt as **حكايا / HIKAYA**: multi-book library, book pages, favourites, bookmarks, search,
      light/dark themes, half-image/half-text player (side by side on wide screens), all controls,
      background media session, progress saving, auto-advance
- [x] Book package format v1 + safe ZIP importer (staging, validation, in-place updates)
- [x] Clips-mode playback: lines played directly from original multi-episode recordings
- [x] Episode 01 migrated to the new format (bundled sample)
- [x] Mac tools: inventory (`hikaya_assets.py`), alignment (`hikaya_align.py`), per-scene music/SFX
      (`hikaya_score.py`), packager (`hikaya_pack.py`); end-to-end test passed
- [x] Launch intro: HyperFrames composition + render script + in-app player (waiting for original logos)
- [x] Docs: `docs/BOOK_FORMAT.md`, `docs/دليل_حكايا.md`, `tools/hikaya/README.md`, `CLAUDE.md`
- [x] APK built in CI and verified (release `apk-latest`)
- [ ] **Blocked:** process `~/Downloads/Audio.zip` and `~/Downloads/IMG.zip` (on the producer's Mac)
- [ ] **Blocked:** Episodes 02–22 timelines, images, scores and QA
- [x] Launch intro rendered with the three original logos (HyperFrames, 7.6 s, 1.3 MB); launcher icon and
      light-mode home header use the official HIKAYA logo; credit «فكرةً وتصميماً: ضرغام الگيار»
- [ ] Optional: a higher-resolution shrine logo (current file is 591×338)
- [ ] On-device check of background playback and lock-screen controls

## 2026-10-26 (producer's Mac)
- [x] Inventory of `Audio.zip` (13 ZIPs inside: Ep1–Ep9, Batch 1–3, scripts handover → 64 recordings, 91 min,
      26 script files) and `IMG.zip` (330 illustrations = 15 per episode × 22); `hikaya_assets.py` fixed for
      nested ZIPs, folder episode ranges and per-character scripts
- [x] Scripts: Ep 01 original (from the repository); Ep 07–19 delivered per-character drafts (verbatim);
      Ep 02–06 and 20–22 recovered from the recordings (no matching script exists) — TXT per episode, Word
      documents and `RECOVERY_REPORT.md` in `~/HIKAYA/recovered_scripts/` and `production/thumma_ihtadayt/`;
      TTS directions deleted from the recovered texts (producer's decision)
- [x] New tools: transcribe once (local Whisper), recover scripts, play-order builder, verify playback and
      render previews, cut cross-check, QA table, Word export, book build script
- [x] Episode 01 end to end as the test of the method: automatic cuts = hand cuts 16/16; clips 21/21; app test
      passes. The book keeps the FIRST VERSION of Episode 01 unchanged (producer's decision); the trial is kept apart
- [x] Episodes 02–22 built in clips mode with the 15 illustrations each; play order and picture placement
      proposed for 02–22 (`order/epNN.json`), marked «قيد المراجعة» in the app
- [x] App: page turns by swipe or page dots with a page-turn transition; spoken line always scrolled into view;
      scene changes in the pause; review badge; end-to-end imported-book test
- [ ] Producer: approve or correct the proposed orders and the recovered texts (see `QA_REPORT.md` questions)
- [ ] On-device check of background playback and lock-screen controls
