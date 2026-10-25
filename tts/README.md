# ثم اهتديت — Arabic multi-voice TTS pipeline (Episodes 07–22)

This pipeline turns plain-text episode scripts into finished audio for the Flutter storybook. It uses
Google Gemini TTS through the official `google-genai` SDK. Every character keeps one fixed, verified
voice. Runs can be resumed and are cached, and the full paid batch is locked until you approve it.

## Status

| Item | State |
|---|---|
| Pipeline code + 14 tests | done, all passing (offline, with a fake backend) |
| Offline dry run of the Episode 07 preview | done (42.7 s; correct speakers, timings and JSON) |
| API key | **missing**: set `GEMINI_API_KEY` (see below) |
| Voice verification (Riko, Enzo, Lumi, Bodi, Sola, Ludo) | **pending**: needs the key; see "Voices" |
| Real Enzo/Ludo preview audio | **pending**: needs the key and verified voices |
| Episode 07–22 scripts | **blocked**: the book text and the 22-episode outline are not in the workspace |
| Full paid batch | locked until you approve the preview and the estimate |

## Setup

```bash
pip install google-genai numpy scipy faster-whisper   # faster-whisper is optional (transcript checks)
echo 'GEMINI_API_KEY=your-key-here' > .env           # repo root; .env is git-ignored, never printed
```

`GOOGLE_API_KEY` or `GEMINI_API_KEY` set as environment variables also work.

## Commands (run from the repository root)

```bash
python3 -m tts.pipeline verify-voices    # live catalog lookup + test synthesis for every voice
python3 -m tts.pipeline preview          # ~38 s Episode 07 Enzo/Ludo test -> tts/output/preview/
python3 -m tts.pipeline estimate         # cost + time for 07–22 (uses real scripts when present)
python3 -m tts.pipeline run --episodes 07-22 --i-approve-paid-batch --export-app
python3 -m tts.pipeline dry-run --episode 07  # whole pipeline offline, no API calls
python3 -m tts.pipeline status
python3 -m pytest tts/tests
```

## Voices: how the six choices are verified

The SDK's own documentation (google-genai 2.33.0) says:

- `client.voices.list(search=...)` searches the live voice catalog by display name or description.
  It returns each voice's `id`, `type`, `accent` and `language_code`.
- That `id` is what goes into `SpeechConfig.voice_config.voice`. For the classic prebuilt voices the
  ID is simply the name (for example `Puck`).
- Multi-speaker requests take **exactly two** voices. This pipeline therefore makes one single-voice
  request per line, which allows any number of characters and keeps each voice consistent.

`verify-voices` searches for "Riko", "Enzo", "Lumi", "Bodi", "Sola" and "Ludo". It accepts only an
exact name match, then synthesises a short Arabic phrase with that voice. Only then does it write
`api_voice` and `status: verified` into `config/voice_registry.json`. A name that is not found is
marked `not_found_in_catalog` and the similar names are listed. **Nothing is substituted
automatically.** Any character whose voice is not verified cannot be synthesised. To choose a
replacement, edit `api_voice` and set `status` to `verified` yourself.

None of the six names is in the 30-voice prebuilt list in Google's docs. Google's docs also describe
an Extended Voice Library of 2,000+ voices, and AI Studio display names may come from there. Only the
live lookup can confirm this.

Secondary characters have proposed voices from the 30-voice prebuilt list, for example the ship
passenger = Iapetus and the Najaf scholar = Algenib. Edit them freely; each stays fixed for all
episodes. Named historical figures (al-Sadr, al-Khoei and others) speak only through the narrator.
The exception is a direct quotation from the book, tagged with its page.

## Script format

`scripts/episode_NN.txt`:

```
@episode 07
@title لقاء في عرض البحر
@source_status verified            # or pending_book_verification

=== SCENE ep07_s01 | على سطح الباخرة
@image none                        # or a real asset path; never invented
NARRATOR [بصوت هادئ]: ...
AL_TIJANI [بتردد وحيرة]: ...                       # default type=fictional (dramatised re-enactment)
NARRATOR {type=quote source="ص 45"}: ...           # verbatim from the book, with its page
```

`[...]` is the performance direction and `{...}` is metadata. Neither is ever spoken. Instead, the
direction is turned into a delivery instruction in the prompt (`prompt_template` in `pipeline.json`).
The Whisper check then flags any chunk where those instructions were read aloud.

## What one episode produces

`tts/output/episode_NN/`:

- `script_chronological.md`: the full script, with fictional and quoted lines marked.
- `script_by_character.md`: each character's lines grouped together, with emotions, ready to copy.
- `lines/*.wav` and `*.mp3`: one normalised recording per line.
- `episode_NN_full.wav` and `.mp3`: the whole episode with natural pauses (450 ms for the same
  speaker, 650 ms on a speaker change, 1.4 s between scenes).
- `episode_NN.json`: the timeline. Every line has `speaker_id`, `voice_choice`, `text`, `emotion`,
  `audio_file`, `start_ms`, `end_ms` and `image_scene_id`, plus a scene list and `missing_images`.
- `review.md`: chunks to check by ear (low transcript match, dropped words, odd duration) and scenes
  with no image.
- `tts/output/episode_NN.zip`: all of the above in one file.

With `--export-app`, the line and full-episode MP3s are copied to
`storybook/assets/audio/episode_NN/`, and the JSON to `storybook/assets/data/episode_NN.json`.

## Reliability

- **Cache:** each chunk is cached under a hash of the backend, model, voice, prompt and language.
  Finished chunks are never requested again, so rerunning after a crash resumes where it stopped
  (this is tested).
- **Retries:** HTTP 408, 429 and 5xx errors and network errors are retried with exponential
  backoff and jitter, up to `max_retries`. Other errors stop the run. A client-side rate limiter
  enforces `requests_per_minute`.
- **Logs:** `tts/work/logs/requests.jsonl` and `episode_NN.jsonl` record every request, error,
  token count and validation result. The API key is never logged.
- **Validation:** each chunk's format, silence and speaking rate are checked. If the local Whisper
  model is present, the chunk is also transcribed and compared with the script. Diacritics and
  hamza/ta-marbuta spellings are ignored, and dropped phrases and Latin words are flagged. On short
  lines the transcriber's own errors can trigger a flag, so treat `review.md` as a listening list,
  not an automatic rejection.
- **Regenerating a chunk:** delete its `tts/work/cache/<key>.wav` and `.json` (the key is in
  `review.md` and the logs), then rerun.
