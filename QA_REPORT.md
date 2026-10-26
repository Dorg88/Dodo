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

<!-- QA_TABLE -->

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
3. **Files and characters.** `Ep4.zip/Fellow.wav` holds Episode 03's travel companion and `Ep3.zip/Juniorscholar.wav`
   Episode 04's student (the two files seem swapped); `Ep6.zip/Atrash.wav` is taken as Sheikh Abd al-Basit (the only
   character left in the episode's list, though the file name points to Farid al-Atrash); the episode boundaries
   inside Batch 3's narrator and al-Tijani recordings are inferred from the content.
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
| Background playback / lock-screen controls | NOT VERIFIED ON DEVICE | needs a phone |
| Launch intro | PASS | unchanged since the cloud session |
