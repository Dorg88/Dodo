# HIKAYA — quality report

Updated 2026-10-25 (cloud session). PASS = verified; WARNING = works with
items to check; FAIL/BLOCKED = cannot be verified yet.

## Episodes of «ثم اهتديت»

| Episode | Status | Evidence / reason |
|---|---|---|
| 01 «ليلة لا تنسى» | **PASS** | Bundled. 16 segments with all 7 speakers in script order; cut points hand-verified at silences; sentence timings verified; all 10 images present, whole and uncropped; music silent around the takbir, ≥16 dB under speech elsewhere. Known gap: «نهاية الحلقة الأولى» was never recorded, so it is shown as text only. Two wordings to confirm by ear: «لوالده» and «أفكاري وأسئلتي». |
| 02–09 | **BLOCKED** | `Audio.zip`/`IMG.zip` are on the producer's Mac and unreachable from the cloud session. Nothing generated or assumed. |
| 10–14 (batch 1) | **BLOCKED** | Same as above. The aligner handles multi-episode batch files, but has not run on these files yet. |
| 15–19 (batch 2) | **BLOCKED** | Same as above. |
| 20–22 (batch 3) | **BLOCKED** | Same as above. |

## Application checks

| Check | Status | Evidence |
|---|---|---|
| Builds | PASS | GitHub Actions run 40226683640 built `hikaya.apk` (65 MB, release, debug-signed) and `hikaya-debug.apk`. The APK was downloaded and inspected: app code for arm64/armv7/x86_64, bundled book, fonts, media service and permissions. |
| Static analysis | PASS | `flutter analyze`: no issues |
| Automated tests | PASS | 23 tests: book/episode data, safe importer (traversal, symlinks, missing files, updates), player layout in portrait and landscape, controls, bookmarks, speed, dark mode, intro flow |
| Arabic RTL rendering | PASS | Rendered screenshots with Amiri and Aref Ruqaa (`storybook/screenshots/out/`) |
| Half image / half text | PASS | Test asserts the artwork uses the full width and stays in the top 50%; side by side in landscape |
| Image scaling | PASS | `BoxFit.contain` on a parchment mat; no crop or stretch |
| Controls | PASS (tested in widget tests) | Play/pause, ±10 s, previous/next scene, previous/next episode, speed, bookmark, text toggle, music mute, reading settings |
| Saved progress / continue listening | PASS | Widget test plus persistence keys per book/episode, which survive updates |
| Offline operation | PASS by design | All media is bundled or imported locally; no network code in the app |
| Background playback / media controls | NOT VERIFIED ON DEVICE | audio_service is configured (foreground service, notification, headset/lock screen), but it has not been run on a phone |
| Import of a second book | PASS | A ZIP built by `hikaya_pack.py` (Episode 01 re-aligned automatically in clips mode with per-scene score) imported by the app's importer with every file present (`test/external_book_test.dart`) |
| Launch intro | WAITING | Composition and render pipeline tested with placeholder shapes. Needs the three original logo files. |
| Automatic alignment accuracy | PASS on Episode 01 | 16/16 lines with no clipped words compared with the hand-verified cuts; 15/16 auto-verified; doubled take detected |
