// Renders HIKAYA pages to PNG with the real fonts and artwork for visual
// review. Run with: flutter test screenshots --update-goldens
// This is test tooling run by `flutter test`, so test-only APIs are fine here.
// ignore_for_file: invalid_use_of_visible_for_testing_member
@Tags(['screenshots'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/main.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/screens/book_screen.dart';
import 'package:hikaya/screens/player_screen.dart';
import 'package:hikaya/services/library_store.dart';
import 'package:hikaya/services/playback.dart';
import 'package:hikaya/services/user_data.dart';
import 'package:hikaya/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../test/test_support.dart';

Future<void> loadFonts() async {
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      loader.addFont(Future.value(ByteData.sublistView(File(f).readAsBytesSync())));
    }
    await loader.load();
  }

  await family('Amiri', ['Regular', 'Bold', 'Italic', 'BoldItalic'].map((f) => 'assets/fonts/Amiri-$f.ttf').toList());
  await family('ArefRuqaa', ['assets/fonts/ArefRuqaa-Regular.ttf', 'assets/fonts/ArefRuqaa-Bold.ttf']);
  final root = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter';
  await family('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
}

void phone(WidgetTester tester, {Size size = const Size(1080, 2400)}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
}

Future<void> precacheAll(WidgetTester tester, Iterable<String> assets) async {
  await tester.runAsync(() async {
    final el = tester.element(find.byType(Scaffold).first);
    for (final a in assets) {
      await precacheImage(AssetImage(a), el);
    }
  });
  await tester.pump(const Duration(seconds: 1));
}

const root = 'assets/books/thumma_ihtadayt';
const ui = ['assets/ui/paper_light.png', 'assets/ui/paper_dark.png'];

void main() {
  setUpAll(loadFonts);

  for (final dark in [false, true]) {
    final mode = dark ? 'dark' : 'light';
    testWidgets('home $mode', (tester) async {
      phone(tester);
      SharedPreferences.setMockInitialValues({
        'recent': ['thumma_ihtadayt/ep01'],
        'progress:thumma_ihtadayt/ep01': 42000,
        'themeMode': dark ? 2 : 1,
      });
      final user = await UserData.load();
      final store = LibraryStore();
      await tester.runAsync(store.load);
      await tester.pumpWidget(HikayaApp(store: store, user: user));
      await precacheAll(tester, [...ui, '$root/ep01/images/01_gafsa_moonlit_city.jpg']);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('out/home_$mode.png'));
    });
  }

  testWidgets('book page', (tester) async {
    phone(tester);
    SharedPreferences.setMockInitialValues({'progress:thumma_ihtadayt/ep01': 42000});
    final user = await UserData.load();
    final store = LibraryStore();
    await tester.runAsync(store.load);
    await tester.pumpWidget(HikayaApp(store: store, user: user));
    final nav = tester.state<NavigatorState>(find.byType(Navigator).first);
    nav.push(MaterialPageRoute(builder: (_) => const BookScreen(bookId: 'thumma_ihtadayt')));
    await tester.pumpAndSettle();
    await precacheAll(tester, [...ui, '$root/ep01/images/01_gafsa_moonlit_city.jpg']);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('out/book.png'));
  });

  for (final probe in [('father', 2500, false), ('child2', 600, false), ('w1', 2000, true), ('n7', 6000, false)]) {
    for (final landscape in probe.$3 ? [false, true] : [false]) {
      testWidgets('player ${probe.$1}${landscape ? ' landscape' : ''}', (tester) async {
        phone(tester, size: landscape ? const Size(2400, 1080) : const Size(1080, 2400));
        SharedPreferences.setMockInitialValues({});
        final user = await UserData.load();
        final book = Book.fromJson(jsonDecode(File('$root/book.json').readAsStringSync()) as Map<String, dynamic>,
            const BookLocation.bundled(root));
        final ep = Episode.fromJson(jsonDecode(File('$root/ep01/episode.json').readAsStringSync()) as Map<String, dynamic>);
        final c = EpisodeController(
            book: book, entry: book.episodes.first, episode: ep, user: user, engineFactory: FakeEngine.new);
        await c.init(startAt: Duration.zero);
        final seg = ep.segments.firstWhere((s) => s.id == probe.$1);
        c.debugSetPosition(seg.start + Duration(milliseconds: probe.$2));
        await tester.pumpWidget(MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: Scaffold(body: SafeArea(child: PlayerView(controller: c, user: user))),
        ));
        await precacheAll(tester, {...ui, for (final s in ep.scenes) if (s.image != null) '$root/${s.image}'});
        await expectLater(
            find.byType(MaterialApp), matchesGoldenFile('out/player_${probe.$1}${landscape ? '_landscape' : ''}.png'));
        c.dispose();
      });
    }
  }
}
