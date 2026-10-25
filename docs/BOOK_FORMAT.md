# HIKAYA book package format (v1)

A HIKAYA book is a ZIP file. Import it from the app's **المكتبة → استيراد كتاب**.
Importing never requires changing or rebuilding the app. Build packages with
`tools/hikaya/hikaya_pack.py`, which runs the same checks as the app.

```
my_book.zip
├── book.json                 required, at the root (or inside one top folder)
├── cover.jpg                 optional
├── checksums.json            written by hikaya_pack.py (SHA-256 of every file)
├── ep01/
│   ├── episode.json
│   ├── images/scene_01.jpg …
│   └── audio/…               narration, or original batch recordings, plus score stems
└── audio/batch1/Riko_ep10-14.wav   a file can be shared by several episodes
```

All paths inside the JSON files are **relative to the book root**, use `/`, and
may not contain `..` or start with `/`. The importer rejects unsafe entries and
symbolic links, extracts into a staging folder, validates, and only then
replaces any installed copy.

## book.json — `hikaya.book.v1`

| Field | Type | Notes |
|---|---|---|
| `schema` | `"hikaya.book.v1"` | |
| `id` | string | lowercase latin, digits, `_`, `-`. Same id = an update of the same book. Progress, bookmarks and favourites are kept. |
| `title`, `subtitle`, `author`, `description` | string | Arabic text |
| `language` | string | `ar` |
| `version` | int | increase when you publish an update |
| `cover` | path | optional |
| `plannedEpisodes` | int | optional, e.g. 22, to show "3 of 22 available" |
| `episodes[]` | list | `id`, `number`, `title`, `summary`, `manifest` (path to episode.json, or omit for "coming soon"), `durationMs` |

## episode.json — `hikaya.episode.v1`

| Field | Notes |
|---|---|
| `id`, `number`, `title`, `durationMs` | |
| `audio.mode` | `track`: one continuous narration file in `audio.voice` is the clock. `clips`: every segment has a `clip`. |
| `audio.voice` | track mode only |
| `audio.music`, `audio.sfx` | optional stems spanning the whole episode timeline (written by `hikaya_score.py`); `musicLoop: true` for a short looping bed |
| `speakers` | `{ "NARRATOR": {"name": "الراوي"}, … }` |
| `scenes[]` | `number`, `title`, `image` (path or null), `layout` (`plate` / `closing`), `startMs`, `endMs`. Scenes tile the timeline. |
| `segments[]` | one spoken line: `id`, `scene`, `speakerId`, `speakerName`, `text` (clean, no directions), `direction` (metadata, never shown or spoken), `startMs`, `endMs`, `lines[]` (sentence timings for highlighting), `timing` (`verified` / `estimated` / `unverified`; the app highlights sentences only when verified), and in clips mode `clip: {file, startMs, endMs}` = where the line is inside the original recording |

In clips mode the app plays the clips in order, with silence filling the gaps
between segment times. A long recording that holds one character's lines for
several episodes is therefore used as it is, without being cut into new files.

## Minimal example (clips mode)

```json
{
  "schema": "hikaya.episode.v1", "id": "ep10", "number": 10, "title": "بين الجيلاني والكاظم",
  "durationMs": 9000, "audio": {"mode": "clips"},
  "speakers": {"NARRATOR": {"name": "الراوي"}},
  "scenes": [{"number": 1, "title": "بغداد", "image": "ep10/images/scene_01.jpg", "startMs": 0, "endMs": 9000}],
  "segments": [{
    "id": "ep10_s01_l01", "scene": 1, "speakerId": "NARRATOR", "speakerName": "الراوي",
    "text": "وصلنا إلى بغداد…", "startMs": 500, "endMs": 4200, "timing": "verified",
    "clip": {"file": "audio/batch1/Riko_ep10-14.wav", "startMs": 61230, "endMs": 64930},
    "lines": [{"text": "وصلنا إلى بغداد…", "startMs": 500, "endMs": 4200}]
  }]
}
```
