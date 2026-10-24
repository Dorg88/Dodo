# Audio report — ثم اهتديت · الحلقة الأولى: ليلة لا تنسى

## 1. How the recordings were matched to the script

The seven uploaded WAV files (24 kHz mono) had Arabic filenames that were lost in upload, so every file
was identified by its **content**, not its name or order:

1. Each file was transcribed in Arabic with OpenAI Whisper *small* (run locally, used only as an
   alignment tool and not shipped in the app).
2. Each transcript was matched to the script line by line.
3. Cut points were measured with `ffmpeg silencedetect` (−40 dB, ≥0.25 s). Every cut sits in the
   **middle of a measured pause**, so no word is clipped. Each clip also gets a 15 ms fade to avoid
   clicks.

| Renamed file | Original upload | Length | Content heard (Whisper) | Script speaker |
|---|---|---|---|---|
| `narrator.wav` | `Narrator.wav` | 74.64 s | All 7 narrator passages, in script order | SPEAKER_01 الراوي |
| `tijani_child.wav` | `70020ae5-…wav` | 6.36 s | «أبي… هل سأقف أمام كل هؤلاء الناس» + «الله أكبر» | SPEAKER_02 التيجاني الصغير |
| `father.wav` | `9836efc7-…wav` | 7.24 s | «لا تخف يا بني، لقد حفظت القرآن وتعلمت كيف تصلي، توكل على الله» | SPEAKER_03 الأب |
| `teacher.wav` | `b9bde0ea-…wav` | 3.88 s | «تقدم يا بني… واستعن بالله» | SPEAKER_04 المعلم |
| `worshipper_1.wav` | `6510b50b-…wav` | 4.12 s | «ما شاء الله… بارك الله في هذا الغلام» | SPEAKER_05 المصلي الأول |
| `worshipper_2.wav` | `c302e0cb-…8_51PM-1.wav` | 3.72 s | «هنيئاً لوالده… وهنيئاً لمعلمه» | SPEAKER_06 المصلي الثاني |
| `tijani_adult.wav` | `062c3b7e-…wav` | 13.40 s | «كم تغيرت الأيام… ولكن البحث عن الحقيقة…» | SPEAKER_07 التيجاني الكبير |

Two files had to be split:

- **Child**: «أبي… هل سأقف…» = 0.00–4.59 s; «الله أكبر» = 4.59–6.36 s (pause 4.22–4.96 s).
- **Narrator**: split into 10 passages at pauses of ≥0.9 s (see `timeline_report.md` for every in/out
  point). Two narrator passages were divided again at a natural pause so the picture could change
  mid-passage («…يسير إلى جانب والده» | «لم يكن يعلم…» and «…حدود المسجد والحي» | «لكن الحياة…»).

The full editable timeline is `production/ep01/episode_source.json`. The resolved timeline, with
episode times and levels, is `production/ep01/timeline_report.md`.

## 2. Things to check by ear

I matched these from transcripts and waveforms. I could not listen to them myself.

- **Missing recording: «نهاية الحلقة الأولى.»** The narrator file ends after «رحلة البحث عن الحقيقة»
  (the speech stops at 74.33 s of 74.64 s). The app shows the line as text on the closing page, but
  it is never heard. To add it, record the line, add it as a segment in `episode_source.json`, and
  rebuild.
- Whisper wrote small variants where the script differs slightly: «لولده» for «لوالده» (worshipper 2)
  and «أفكار وأسئلة» for «أفكاري وأسئلتي» (adult al-Tijani). These are probably transcription errors,
  but they could also be wording changes in the take. Please listen to confirm. The on-screen text
  follows the script.
- The narrator's «ثم رفع يديه…» ends very close to the pause at 34.92 s. The cut is at 35.40 s, which
  is safe, but please confirm by ear.

## 3. Music and sound effects: where they came from

The task asked me to look locally first and then for openly licensed assets online:

- **Local search:** the repository had no music or sound-effect files.
- **Online search was not possible.** This environment's network policy blocks every audio library
  I tried (freesound.org, pixabay.com, incompetech.com, archive.org, opengameart.org,
  commons.wikimedia.org). **No third-party audio was downloaded.**

So that the episode still has a score and ambience, I **composed every cue procedurally** with
original code (`tools/sound_library.py`). It uses no samples and no recordings, so there are no
licensing or attribution obligations:

| Cue | Where | Technique |
|---|---|---|
| حنين افتتاحي (nostalgic) | Opening, scenes 1–2 | Dm–B♭–Gm–A pad + Karplus-Strong plucked "oud" melody in Nahawand |
| ترقب (suspense) | Approaching the mosque | Low Hijaz drone, soft frame-drum heartbeat, faint high E♭ |
| سكينة المسجد (reverent) | Doors open → teacher | Airy high pad over a soft drone, long reverb |
| *(silence)* | Teacher's last word → worshippers' blessing | No music at all; also no ambience around «الله أكبر» |
| دفء الفرح (warm) | After the blessing | B♭maj7–F–Gm–F/A swell with plucked arpeggios |
| تأمل وغموض (reflective) | Adult al-Tijani, closing narration | Ney-like flute phrase in **Bayati with a true quarter-tone E** over a drone |
| خاتمة سينمائية (ending) | Final narration → end | Rising Dm–B♭–C–D pad and a final ney note, 5.5 s fade |

The sound effects are synthesised too: night breeze and crickets, adult and child footsteps on stone
with alley slapback, a wooden door creak and thud, mosque room tone, congregation whispers, cloth
rustle, and an approving murmur after the prayer.

**Mixing:** dialogue is normalised per speaker to −20 dBFS speech RMS. Peaks stay at or below −1 dBFS.
Music is ducked 12 dB and ambience 7 dB whenever a voice is active (0.12 s attack, 0.7 s release), and
every cue uses equal-power fades. The measured margin between speech and music is **16–24 dB** on every
segment. The music stem is digital silence from 0:54.97 to 1:29.63, which covers the takbir. The app
plays music and ambience as separate stems, so the listener can turn either off or change its volume
without touching the dialogue.

**Honest limit:** these cues are tasteful placeholders. They are not the equal of a recorded
orchestral or oud score. Synthesised crowd murmurs and footsteps also sound less real than field
recordings. For a richer result, replace them with assets such as:

- *Footsteps on stone*, *mosque room tone*, *crowd murmur*, *night crickets* — Freesound, filtered to
  the CC0 licence.
- Gentle oud/ney or string underscore under a CC0 or CC-BY licence. CC-BY needs an attribution line,
  which can go in the app's «حول التطبيق» section.

To swap one in, either replace a generator in `tools/sound_library.py`, or mix your file into the
`music` or `sfx` stem. Then run `python3 tools/build_episode.py production/ep01/episode_source.json`.

## 4. Images

All ten illustrations come from your uploads. They are shown **whole and static**: no zoom, no pan, no
parallax and no animation, only a cross-fade between pages. The only change was trimming the thin
white upload borders (5–12 px, plus a white strip at the bottom of two images that held a sliver of
the next picture). Most images are about 1.41:1 rather than 16:9, so they sit uncropped inside the
16:9 plate on a parchment mat.

Three images are used twice, because the episode has 14 scenes and 10 illustrations: 01 (opening, adult
memories, closing), 02 (walk to the mosque, «رحلة أخرى») and 07 (leading the prayer, «من طفل يقف أمام
المصلين»). Your 11th attachment, the *Pride and Prejudice* screenshot, was used only as the design
reference (`production/design_reference_pride_and_prejudice.jpg`).
