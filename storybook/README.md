# ثم اهتديت — Interactive audio storybook (Flutter / Android)

An offline, right-to-left Arabic audio storybook. Each scene shows a static, uncropped illustration on a
parchment "plate". The Arabic text is synchronised line by line to the original voice recordings, with
a separately mixed music stem and ambience stem underneath.

## Screens

- **Home** — cover, title, «ابدأ الاستماع», «متابعة الاستماع» (resumes from the saved position), «الحلقات».
- **Player** — 16:9 plate, plate number and scene title, speaker and performance direction, time,
  play/pause, seek bar, previous/next scene, speed (0.75–1.5×), text size, caption toggle, and a scene
  list («اللوحات») that seeks to any scene.
- **Episodes** — every book and episode from `assets/library.json`, with progress bars.
- **Settings** — captions, font size, music on/off and volume, sound effects on/off and volume, speed.

Progress is saved every 5 s, on pause, on seek and when the app goes to the background.

## How sync works

`lib/services/storybook_player.dart` plays three `just_audio` players: **voice** (the master clock),
**music** and **sfx**. They play, pause, seek and change speed together. Every second the followers are
re-seeked if they drift more than 90 ms. Scene, segment and highlighted line all come from the voice
position and the absolute times in `episode.json`.

## Project layout

```
lib/
  main.dart                  app, RTL Arabic locale, AppScope
  models/                    library.dart, episode.dart (JSON models + timeline lookups)
  services/                  library_repository, settings_service, storybook_player
  screens/                   home, episodes, player, settings
  widgets/storybook_widgets.dart   plate, rules, story text, buttons
  theme/app_theme.dart       parchment palette, Arabic digits/time formatting
assets/
  library.json               catalogue of books → episodes
  books/<book>/<episode>/    episode.json, images/, audio/{voice,music,sfx}.m4a
  fonts/                     Amiri (SIL OFL)
test/                        data/timeline validation + widget tests
screenshots/render_test.dart renders pages to PNG for review
```

## Adding a new episode or book

1. Put the illustrations in `production/<ep>/source_images` and the recordings in
   `production/<ep>/source_audio`.
2. Copy `production/ep01/episode_source.json` and edit it. For each segment set the speaker, text lines,
   source file and in/out seconds. Then set the scenes and the music and sfx cues (anchors such as
   `"n2.end+0.6"`).
3. Run `python3 tools/build_episode.py production/<ep>/episode_source.json` (needs ffmpeg, numpy and
   scipy). This writes `episode.json`, the three AAC stems, `timeline_report.md` and a preview mix.
4. Add the episode to `assets/library.json`, and add its folders under `flutter: assets:` in `pubspec.yaml`.

No Dart changes are needed.

## Build

```
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

The GitHub Actions workflow `.github/workflows/build-apk.yml` runs these on every push that touches
`storybook/`. It uploads the APK as an artifact and to the rolling `apk-latest` pre-release. Release
builds are signed with the debug key. Add your own keystore before publishing to Google Play.
