# HIKAYA — quality report

Updated 2026-10-26 on the producer's Mac. The status of each episode is **computed** by
`tools/hikaya/hikaya_qa_table.py` from the book's own reports, never typed by hand:
PASS = original order and text and every check passing; WARNING = plays correctly but its play order,
picture placement or text still awaits the producer's approval; FAIL = a check failed.

## What was checked for every episode

1. **Alignment** (`hikaya_align.py`): every line found in its original recording; clips cut inside measured
   pauses; directions the voice engine read aloud left outside the clips.
2. **Every clip on its own** (`hikaya_verify.py`): the episode is assembled exactly as the app plays it, and each
   clip is transcribed separately; it must hold its line and nothing else (no spoken direction, no neighbouring
   line). Scenes must tile the timeline, every illustration must exist and be whole, no brackets in the text.
3. **Music** (`hikaya_score.py`): at least 16 dB under every line (rule: 15 dB); silent around prayer and «الله أكبر».
4. **In the app** (`storybook/test/imported_episode_test.dart`): the book ZIP is imported with the app's importer
   and every line of every episode is walked in the real player: right line active, right picture, text and
   speaker on screen, the sentence being spoken highlighted.
5. **Preview** for listening: `~/HIKAYA/books/thumma_ihtadayt/reports/epNN/preview.mp4` (picture, text, sound).

## Episode 01: the first version, unchanged — and the test of the method

At the producer's request the book's Episode 01 is **the first version, byte for byte** (the one bundled in the
app: 10 illustrations, the verified timeline, voice/music/ambience tracks). The 15 Episode 01 illustrations in
`IMG.zip` are not used.

Its original script and hand-verified cut points, with recordings in `Audio.zip` byte-identical to them, were used
to test the automatic pipeline before applying it to the other episodes. The trial build is kept apart
(`~/HIKAYA/books/ep01_pipeline_trial`, reports in `production/thumma_ihtadayt/ep01_pipeline_trial/`):

- automatic cuts vs hand cuts: **16 of 16** passages hold all their speech and nothing outside the hand-cut window
  (`production/thumma_ihtadayt/ep01_pipeline_trial/CUT_VALIDATION.md`); the one miss found on the way («ثم رفع يديه…»,
  last word heard as «يدي») was fixed in the aligner before anything else was built;
- every clip transcribed alone: 21/21; in the app: 21 lines in order, 33 sentences highlighted at the right time;
- music ≥ 18.7 dB under the voice, silent from the boy stepping forward to the end of the congratulations.

## Episodes

| Ep | Title | Status | Lines (timing verified) | Clips OK | Structure | Music under voice | Text | Order and pictures |
|---|---|---|---|---|---|---|---|---|
| 01 | ليلة لا تنسى | **PASS** | 16 (hand-verified cuts) | first session | OK | ≥16 dB (first session) | original script | first version, unchanged |
| 02 | من قفصة إلى بيت الله | **PASS** | 25 (25) | 25/25 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 03 | أمام الكعبة لأول مرة | **PASS** | 24 (24) | 24/24 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 04 | العودة إلى قفصة | **PASS** | 31 (31) | 31/31 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 05 | بين التصوف والتساؤل | **PASS** | 50 (50) | 50/50 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 06 | رحلة إلى أرض الكنانة | **PASS** | 55 (55) | 55/55 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 07 | لقاء في عرض البحر | **PASS** | 25 (25) | 25/25 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 08 | أسئلة لم أجد لها جوابا | **PASS** | 26 (26) | 26/26 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 09 | إلى العراق لأول مرة | **PASS** | 26 (26) | 26/26 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 10 | بين الجيلاني والكاظم | **PASS** | 23 (23) | 23/23 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 11 | الشك والتساؤل | **PASS** | 22 (22) | 22/22 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 12 | الطريق إلى النجف | **PASS** | 22 (21) | 22/22 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 13 | في مجلس العلماء | **PASS** | 19 (19) | 19/19 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 14 | لقاء السيد محمد باقر الصدر | **PASS** | 20 (20) | 20/20 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 15 | بين الشك والحيرة | **PASS** | 21 (21) | 21/21 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 16 | بداية البحث عن الحقيقة | **PASS** | 16 (16) | 16/16 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 17 | الصحابة بين التاريخ والرواية | **PASS** | 16 (16) | 16/16 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 18 | ماذا يقول القرآن؟ | **PASS** | 15 (15) | 15/15 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 19 | لحظة التحول | **PASS** | 17 (17) | 17/17 | OK | 16.0 dB | delivered draft (verbatim) | approved by the producer |
| 20 | أسباب الاستبصار | **PASS** | 14 (14) | 14/14 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 21 | الاجتهاد في مقابل النص | **PASS** | 15 (15) | 15/15 | OK | 16.0 dB | recovered from the recording | approved by the producer |
| 22 | ثم اهتديت — بداية طريق جديد | **PASS** | 30 (30) | 30/30 | OK | 16.0 dB | recovered from the recording | approved by the producer |

Imported-book test (`thumma_ihtadayt-v2.zip`, 434 MB): **all 22 episodes pass** — 524 lines in order, right picture, text and speaker at every line, 283 sentences highlighted at the right time. Recovered texts have little punctuation, so their lines highlight whole rather than sentence by sentence.

## Questions only the producer can answer

These cannot be recovered from the supplied assets:

1. **Scripts.** Episodes 02–06 have no script in the delivered files, and Batch 3 (Episodes 20–22) was recorded
   from a script that is not among them (0 of 51 draft lines match). Their text was written down from the
   recordings (two local transcriptions) and needs listening review; the words the two transcriptions heard
   differently are listed in each `Episode_NN_review.md`. The TTS directions the voice engine read aloud are
   deleted from these texts, from the display text and from the audio clips. See
   `production/thumma_ihtadayt/recovered_scripts/`.
2. **Speaking order.** Only Episode 01 has its original order. For 02–22 the order between narrator and characters
   (and the picture for each passage) is proposed from the content, the dialogue's question-and-answer chains and
   the numbering of the 15 illustrations, in `order/epNN.json`. Each character's own lines always stay in their
   recorded order.
3. **Files and characters — confirmed by the producer:** `Ep4.zip/Fellow.wav` is Episode 03's travel companion,
   `Ep3.zip/Juniorscholar.wav` Episode 04's student, `Ep6.zip/Atrash.wav` Sheikh Abd al-Basit; Episode 01 stays the
   first version. The producer reviewed every episode and approved the order, pictures and corrected text (2026-10-26).
4. **Illustrations.** Episode 02 leaves 12 and 14 unused, 22 leaves 10, 20 leaves 14; Episode 05 shows 10 and 12 after
   13 and 14, and 20 opens with 12, to follow the narration; Episode 06's first pictures show a sea and train
   journey while the narration describes a taxi through Libya.
5. Episode 01's closing line «نهاية الحلقة الأولى.» is in the script but was never recorded.

## Application checks

| Check | Status | Evidence |
|---|---|---|
| Static analysis | PASS | `flutter analyze`: no issues (Flutter 3.47.8 on the Mac) |
| Automated tests | PASS | 26 tests, plus the imported-book test over every playable episode |
| Imported book end to end | see table | `HIKAYA_TEST_ZIP=… flutter test test/imported_episode_test.dart` |
| Text of the line being spoken always visible | PASS (fixed) | A line below a long one was never scrolled into view (lazy list); all lines of a scene are now laid out |
| Picture changes in the pause, never mid-word | PASS (fixed) | A scene could start 0.6 s before the previous line ended; scene changes now sit in the pause |
| Storybook page turns | PASS | Swipe the picture or tap a page dot to turn the page; page-turn slide in reading direction; pictures never cropped or moved inside their frame |
| Episodes awaiting approval marked | PASS | «قيد المراجعة» under the episode title (`status: review` in book.json) |
| Arabic right-to-left rendering | PASS | Screenshots `storybook/screenshots/out/`, preview videos |
| Background playback / lock-screen controls | PASS (background) | Producer's phone, 2026-10-27: sound continues with the screen off; lock-screen controls and «one episode at a time» on the phone to be confirmed |
| Launch intro | PASS | unchanged since the cloud session |

---

# Second book: «ليالي بيشاور» (سلطان الواعظين الشيرازي) — 2026-10-27

The production numbers every line in play order (`manifest.csv`: line id, episode, order, scene, character, tone,
text) and gives one picture per scene (323 pictures = 323 scenes). So the play order, the text and the pictures are
the production's own; nothing is proposed. Built with `tools/hikaya/build_layali_peshawar.sh`; the same checks as
for the first book (alignment, every clip transcribed on its own, music margin, imported-book test in the real player).

| Ep | Title | Status | Lines (timing verified) | Clips OK | Structure | Music under voice | Text | Order and pictures |
|---|---|---|---|---|---|---|---|---|
| 01 | الطريق إلى بيشاور | **PASS** | 44 (44) | 44/44 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 02 | الصلاتان والقبر المخفيّ | **PASS** | 41 (41) | 41/41 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 03 | خير البريّة | **PASS** | 45 (45) | 45/45 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 04 | الشرك والوسيلة | **PASS** | 53 (53) | 53/53 | OK | 16.1 dB | production script (verbatim) | production's play order and pictures |
| 05 | السفينة والدماء | **PASS** | 60 (60) | 60/60 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 06 | منزلة هارون | **PASS** | 59 (57) | 59/59 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 07 | يوم الإنذار | **PASS** | 49 (49) | 49/49 | OK | 16.5 dB | production script (verbatim) | production's play order and pictures |
| 08 | الطائر المشويّ | **PASS** | 50 (49) | 50/50 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 09 | الفتى الذي نام على الفراش | **PASS** | 46 (46) | 46/46 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 10 | الراية والربذة | **PASS** | 47 (47) | 47/47 | OK | 16.1 dB | production script (verbatim) | production's play order and pictures |
| 11 | الخاتم في الركوع | **PASS** | 53 (53) | 53/53 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 12 | وأنفسنا وأنفسكم | **PASS** | 53 (49) | 53/53 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 13 | ما بعد السقيفة | **PASS** | 50 (50) | 50/50 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 14 | مدينة العلم وبابها | **PASS** | 53 (53) | 53/53 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 15 | أصحابي كالنجوم | **PASS** | 50 (49) | 50/50 | OK | 16.2 dB | production script (verbatim) | production's play order and pictures |
| 16 | غدير خمّ | **PASS** | 55 (55) | 55/55 | OK | 16.8 dB | production script (verbatim) | production's play order and pictures |
| 17 | فدك… حتى الفجر | **PASS** | 52 (51) | 52/52 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 18 | يوم الجمل وما بعده | **PASS** | 53 (51) | 53/53 | OK | 16.8 dB | production script (verbatim) | production's play order and pictures |
| 19 | حامي الرسول | **PASS** | 56 (53) | 56/56 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |
| 20 | الصبر وفي العين قذى | **PASS** | 51 (51) | 51/51 | OK | 16.7 dB | production script (verbatim) | production's play order and pictures |
| 21 | سؤال ابن النواب | **PASS** | 48 (48) | 48/48 | OK | 16.7 dB | production script (verbatim) | production's play order and pictures |
| 22 | سلوني قبل أن تفقدوني | **PASS** | 55 (54) | 55/55 | OK | 16.0 dB | production script (verbatim) | production's play order and pictures |

Imported-book test (`layali_peshawar-v2.zip`, 946 MB, 204 min): **all 22 episodes pass**: 1,123 lines in order,
right picture, text and speaker at every line, 1,164 sentences highlighted at the right time.

## How the book was completed

1. The first recordings lacked 313 lines (the author's batches 04–06, most of 03 and half of 07, a few scattered
   lines; 15 of al-Hafiz's lines). The producer recorded them (`AUTHOR_pickup_1/2.wav`, `HAFIZ_missing_01.wav`);
   they are aligned as *pickup recordings* (`audio/<KEY>/pickups/`), separately from the first takes.
2. Lines the voice engine said incompletely or out of order were re-recorded (`AUTHOR_redo.wav`, the lines it
   covers listed in `AUTHOR_redo.lines.txt`): EP03-L031 (first sentence skipped), EP06-L051 (its opening «نعم،»
   was said once for two lines), EP15-L010/L011 (the hadith's source read before it).
3. Measured by ear (`alignment_overrides.json`, `clip_fixes.json`, each with its reason; recordings untouched):
   EP06-L049 «نعم.» is the single «نعم» of the first take; Ep21 EP21-L028/L029 leave out «يقول أبو طالب», words the
   voice engine added that are not in the script.
4. Fifteen lines have estimated timing (the aligner was unsure of an edge word); each clip was transcribed on its
   own and holds exactly its line.

## Pictures of the Prophet, Ahl al-Bayt and the prophets

The producer replaced the 45 pictures with new ones made with ChatGPT (`imgs.zip`, 52 pictures, originals kept in
`~/HIKAYA/assets/peshawar_images_chatgpt/`; the earlier pictures stay in `~/HIKAYA/assets/peshawar_images/`). The new
pictures carry descriptive names, not scene numbers, so each was matched to its scene by its content
(`chatgpt_images.json`): 44 scenes replaced, whole and uncropped. To confirm with the producer (review page on the
Desktop, `مراجعة الصور الجديدة.html`): four closest matches (Ep10 s11 grief vs gesture, Ep14 s08 the boy seated,
Ep15 s09 daylight for a night scene, Ep21 s06 the woman not visible); Ep08 s06 (the two roasted birds), with no new
picture, uses an SVG drawn for it (`art/ep08_scene06.svg`, the Prophet seen only from behind); eight new pictures are unused variants. `layali_peshawar-v3.zip`: imported-book
test passes for all 22 episodes; previews re-rendered.
