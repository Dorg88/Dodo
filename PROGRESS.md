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
