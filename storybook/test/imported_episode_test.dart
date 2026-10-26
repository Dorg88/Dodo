import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/screens/player_screen.dart';
import 'package:hikaya/services/book_importer.dart';
import 'package:hikaya/services/playback.dart';
import 'package:hikaya/services/user_data.dart';
import 'package:hikaya/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'test_support.dart';

/// End-to-end check of a book ZIP built by tools/hikaya/hikaya_pack.py: import
/// it with the app's importer, then walk one episode through the real player
/// view and check, line by line and sentence by sentence, that the player
/// shows the right picture, speaker and text, highlighting what is being said.
///
/// HIKAYA_TEST_ZIP=/path/book.zip HIKAYA_TEST_EPISODE=1 flutter test test/imported_episode_test.dart
void main() {
  final zip = Platform.environment['HIKAYA_TEST_ZIP'];
  // one episode number, or «all» (the default) for every playable episode of the book
  final only = int.tryParse(Platform.environment['HIKAYA_TEST_EPISODE'] ?? '');

  bool showsText(String text) {
    final want = text.replaceAll(RegExp(r'\s+'), '');
    return find
        .byWidgetPredicate((w) => w is RichText && w.text.toPlainText().replaceAll(RegExp(r'\s+'), '').contains(want))
        .evaluate()
        .isNotEmpty;
  }

  String? highlighted() {
    for (final e in find.byType(RichText).evaluate()) {
      String? hit;
      (e.widget as RichText).text.visitChildren((span) {
        if (span is TextSpan && span.style?.backgroundColor != null && span.text != null) hit = span.text;
        return hit == null;
      });
      if (hit != null) return hit;
    }
    return null;
  }

  testWidgets(
    'imported episode plays in order with its pictures and text',
    (tester) async {
      final tmp = Directory.systemTemp.createTempSync('hikaya_play');
      addTearDown(() => tmp.deleteSync(recursive: true));
      final r = BookImporter(Directory('${tmp.path}/books')).importZip(zip!);
      expect(r.ok, isTrue, reason: r.errors.join('; '));
      final dir = '${tmp.path}/books/${r.bookId}';
      final book = Book.fromJson(
        jsonDecode(File('$dir/book.json').readAsStringSync()) as Map<String, dynamic>,
        BookLocation.imported(dir),
      );
      final entries = book.available.where((e) => only == null || e.number == only).toList();
      expect(entries, isNotEmpty);
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.6;
      addTearDown(tester.view.reset);
      SharedPreferences.setMockInitialValues({});
      final user = await UserData.load();
      for (final entry in entries) {
        final ep = Episode.fromJson(
          jsonDecode(File(book.location.resolve(entry.manifest!)).readAsStringSync()) as Map<String, dynamic>,
        );
        final c = EpisodeController(book: book, entry: entry, episode: ep, user: user, engineFactory: FakeEngine.new);
        await c.init(startAt: Duration.zero);
        await tester.pumpWidget(
          MaterialApp(
            key: ValueKey(entry.id),
            theme: AppTheme.light(),
            locale: const Locale('ar'),
            supportedLocales: const [Locale('ar')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: Scaffold(
              body: SafeArea(
                child: PlayerView(controller: c, user: user),
              ),
            ),
          ),
        );

        var previousEnd = Duration.zero;
        var checkedSentences = 0;
        for (final s in ep.segments) {
          // speaking order: every line starts after the previous one has ended
          expect(s.start >= previousEnd, isTrue, reason: '${s.id} overlaps the previous line');
          previousEnd = s.end;
          c.debugSetPosition(s.start + (s.end - s.start) ~/ 2);
          await tester.pump(); // rebuild, starting any scene transition
          await tester.pump(const Duration(milliseconds: 900)); // let it finish
          expect(c.active?.id, s.id, reason: 'active line at the middle of ${s.id}');
          expect(c.scene.number, s.scene, reason: 'scene shown during ${s.id}');

          // the scene's illustration is the picture on screen (whole, from the imported book)
          final scene = c.scene;
          if (!scene.isClosing && scene.image != null) {
            final shown = tester
                .widgetList<Image>(find.byType(Image))
                .map((i) => i.image)
                .whereType<FileImage>()
                .map((f) => f.file.path)
                .toSet();
            expect(shown, contains(book.location.resolve(scene.image!)), reason: 'picture during ${s.id}');
          }

          // the line's text and, in dialogue scenes, its speaker are displayed
          expect(showsText(s.text), isTrue, reason: 'text of ${s.id} on screen');
          final sceneSegments = ep.segmentsOfScene(scene.number);
          if (!s.isNarrator || sceneSegments.any((o) => !o.isNarrator)) {
            expect(find.text(s.speakerName), findsWidgets, reason: 'speaker of ${s.id}');
          }

          // sentence by sentence: the sentence being spoken is the highlighted one
          if (s.timing == Timing.verified && s.lines.length > 1) {
            for (final l in s.lines) {
              c.debugSetPosition(l.start + (l.end - l.start) ~/ 2);
              await tester.pump();
              await tester.pump(const Duration(milliseconds: 900));
              expect(highlighted(), l.text, reason: 'highlight in ${s.id}');
              checkedSentences++;
            }
          }
        }
        // ignore: avoid_print
        print(
          'episode ${ep.number}: ${ep.segments.length} lines in order, ${ep.scenes.length} scenes, '
          '$checkedSentences highlighted sentences checked',
        );
        await tester.pumpWidget(const SizedBox());
        c.dispose();
      }
    },
    skip: zip == null,
    timeout: const Timeout(Duration(minutes: 20)),
  );
}
