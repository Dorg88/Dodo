import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/main.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/screens/intro_screen.dart';
import 'package:hikaya/screens/player_screen.dart';
import 'package:hikaya/services/library_store.dart';
import 'package:hikaya/services/playback.dart';
import 'package:hikaya/services/user_data.dart';
import 'package:hikaya/theme/app_theme.dart';
import 'package:hikaya/widgets/hk_widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'test_support.dart';

void phone(WidgetTester tester, {Size size = const Size(1080, 2400)}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
}

Future<(LibraryStore, UserData)> services(WidgetTester tester, [Map<String, Object> prefs = const {}]) async {
  SharedPreferences.setMockInitialValues(prefs);
  final user = await UserData.load();
  final store = LibraryStore();
  await tester.runAsync(store.load);
  return (store, user);
}

void main() {
  testWidgets('home shows the HIKAYA identity and the bundled book, right to left', (tester) async {
    phone(tester);
    final (store, user) = await services(tester);
    await tester.pumpWidget(HikayaApp(store: store, user: user));
    await tester.pump();
    expect(find.byType(HikayaLogo), findsOneWidget);
    expect(find.bySemanticsLabel('حكايا'), findsWidgets);
    expect(find.text('مكتبتي'), findsOneWidget);
    expect(find.text('ثم اهتديت'), findsWidgets);
    expect(Directionality.of(tester.element(find.text('مكتبتي'))), TextDirection.rtl);
  });

  testWidgets('continue listening offers the saved position', (tester) async {
    phone(tester);
    final (store, user) = await services(tester, {
      'recent': ['thumma_ihtadayt/ep01'],
      'progress:thumma_ihtadayt/ep01': 65000,
    });
    await tester.pumpWidget(HikayaApp(store: store, user: user));
    await tester.pump();
    expect(find.text('متابعة الاستماع'), findsOneWidget);
    expect(find.textContaining(formatTime(const Duration(seconds: 65))), findsOneWidget);
  });

  testWidgets('library offers import; book page lists episodes; favourites work', (tester) async {
    phone(tester);
    final (store, user) = await services(tester);
    await tester.pumpWidget(HikayaApp(store: store, user: user));
    await tester.tap(find.text('المكتبة').last);
    await tester.pumpAndSettle();
    expect(find.text('استيراد كتاب'), findsOneWidget);
    await tester.tap(find.text('ثم اهتديت').last);
    await tester.pumpAndSettle();
    expect(find.text('ليلة لا تنسى'), findsOneWidget);
    expect(find.textContaining('من ٢٢ متاحة'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.favorite_border));
    await tester.pump();
    expect(user.isFavorite('thumma_ihtadayt'), isTrue);
  });

  testWidgets('dark mode switches the palette', (tester) async {
    phone(tester);
    final (store, user) = await services(tester);
    await user.setThemeMode(ThemeMode.dark);
    await tester.pumpWidget(HikayaApp(store: store, user: user));
    await tester.pump();
    expect(Hk.of(tester.element(find.text('مكتبتي'))).paper, Hk.dark.paper);
  });

  Future<EpisodeController> controllerFor(UserData user) async {
    const root = 'assets/books/thumma_ihtadayt';
    final book = Book.fromJson(jsonDecode(File('$root/book.json').readAsStringSync()) as Map<String, dynamic>,
        const BookLocation.bundled(root));
    final ep = Episode.fromJson(jsonDecode(File('$root/ep01/episode.json').readAsStringSync()) as Map<String, dynamic>);
    final c =
        EpisodeController(book: book, entry: book.episodes.first, episode: ep, user: user, engineFactory: FakeEngine.new);
    await c.init(startAt: Duration.zero);
    return c;
  }

  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        home: Directionality(textDirection: TextDirection.rtl, child: Scaffold(body: child)),
      );

  testWidgets('portrait player: illustration in the top half, text and controls below', (tester) async {
    phone(tester);
    final (_, user) = await services(tester);
    final c = await controllerFor(user);
    final father = c.episode.segments.firstWhere((s) => s.id == 'father');
    await c.seek(father.start + const Duration(seconds: 2));
    await tester.pumpWidget(host(PlayerView(controller: c, user: user)));
    await tester.pump(const Duration(seconds: 1));

    final screenH = tester.view.physicalSize.height / tester.view.devicePixelRatio;
    final art = tester.getRect(find.byType(ArtworkFrame).first);
    expect(art.width, greaterThan(380), reason: 'artwork uses the available width');
    expect(art.bottom, lessThanOrEqualTo(screenH * 0.5 + 1), reason: 'artwork stays in the top half');
    expect(find.text('الأب'), findsOneWidget);
    expect(find.textContaining('لا تخف يا بني'), findsOneWidget);

    final scene = c.sceneIndex;
    await tester.tap(find.byTooltip('المشهد التالي'));
    await tester.pump();
    expect(c.sceneIndex, scene + 1);
    await tester.tap(find.byTooltip('تشغيل'));
    await tester.pump();
    expect(c.playing, isTrue);
    await tester.tap(find.byTooltip('إضافة علامة'));
    await tester.pump();
    expect(user.bookmarks, hasLength(1));
    await tester.tap(find.byTooltip('سرعة التشغيل'));
    await tester.pump();
    expect(user.speed, 1.25);
    await c.pause();
    c.dispose();
  });

  testWidgets('landscape player shows illustration and text side by side', (tester) async {
    phone(tester, size: const Size(2400, 1080));
    final (_, user) = await services(tester);
    final c = await controllerFor(user);
    await tester.pumpWidget(host(PlayerView(controller: c, user: user)));
    await tester.pump(const Duration(seconds: 1));
    final screenW = tester.view.physicalSize.width / tester.view.devicePixelRatio;
    final art = tester.getRect(find.byType(ArtworkFrame).first);
    final text = tester.getRect(find.textContaining('في مدينة قفصة'));
    expect(art.width, lessThanOrEqualTo(screenW / 2));
    expect((art.center.dx - screenW / 2).sign != (text.center.dx - screenW / 2).sign, isTrue);
    c.dispose();
  });

  testWidgets('hiding the story text keeps the controls', (tester) async {
    phone(tester);
    final (_, user) = await services(tester);
    await user.setShowText(false);
    final c = await controllerFor(user);
    await tester.pumpWidget(host(PlayerView(controller: c, user: user)));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('إظهار نص القصة'), findsOneWidget);
    expect(find.byTooltip('تشغيل'), findsOneWidget);
    c.dispose();
  });

  testWidgets('launch intro plays the logos then opens the app; tap skips', (tester) async {
    phone(tester);
    const assets = IntroAssets(hasVideo: false, availableLogos: ['assets/ui/paper_light.png', 'assets/ui/paper_dark.png']);
    Widget app() => MaterialApp(
          theme: AppTheme.light(),
          home: IntroScreen(assets: assets, next: (_) => const Scaffold(body: Text('APP'))),
        );
    await tester.pumpWidget(app());
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('APP'), findsNothing);
    await tester.pump(const Duration(milliseconds: 4200));
    await tester.pumpAndSettle();
    expect(find.text('APP'), findsOneWidget);

    await tester.pumpWidget(Container());
    await tester.pumpWidget(app());
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byType(IntroScreen));
    await tester.pumpAndSettle();
    expect(find.text('APP'), findsOneWidget);
  });

  testWidgets('no intro assets means the app opens directly', (tester) async {
    phone(tester);
    final (store, user) = await services(tester);
    await tester.pumpWidget(HikayaApp(
        store: store, user: user, intro: const IntroAssets(hasVideo: false, availableLogos: [])));
    await tester.pump();
    expect(find.text('مكتبتي'), findsOneWidget);
  });
}
