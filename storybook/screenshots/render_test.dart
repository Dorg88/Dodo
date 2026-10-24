// Renders storybook pages to PNG with the real Amiri font and artwork, for
// visual review. Run with: flutter test screenshots --update-goldens
@Tags(['screenshots'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:thumma_ihtadayt/main.dart';
import 'package:thumma_ihtadayt/models/episode.dart';
import 'package:thumma_ihtadayt/screens/player_screen.dart';
import 'package:thumma_ihtadayt/services/library_repository.dart';
import 'package:thumma_ihtadayt/services/settings_service.dart';
import 'package:thumma_ihtadayt/services/storybook_player.dart';
import 'package:thumma_ihtadayt/theme/app_theme.dart';

Future<void> loadFonts() async {
  final loader = FontLoader('Amiri');
  for (final f in ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
    loader.addFont(Future.value(ByteData.sublistView(File('assets/fonts/Amiri-$f.ttf').readAsBytesSync())));
  }
  await loader.load();
  final icons = FontLoader('MaterialIcons');
  final iconPath = '${Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter'}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf';
  icons.addFont(Future.value(ByteData.sublistView(File(iconPath).readAsBytesSync())));
  await icons.load();
}

void phone(WidgetTester tester, {double height = 2400}) {
  tester.view.physicalSize = Size(1080, height);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
}

Future<void> precache(WidgetTester tester, Iterable<String> assets) async {
  await tester.runAsync(() async {
    for (final a in assets) {
      final el = tester.element(find.byType(Scaffold).first);
      await precacheImage(AssetImage(a), el);
    }
  });
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadFonts);

  testWidgets('home', (tester) async {
    phone(tester);
    SharedPreferences.setMockInitialValues({'lastEpisode': 'thumma_ihtadayt/ep01', 'progress:thumma_ihtadayt/ep01': 42000});
    final settings = await SettingsService.load();
    final repo = LibraryRepository();
    final library = await tester.runAsync(repo.loadLibrary);
    await tester.pumpWidget(StorybookApp(settings: settings, repository: repo, library: library!));
    await precache(tester, [library.books.first.cover]);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('out/home.png'));
  });

  for (final probe in [('n1a', 5200), ('father', 2500), ('child2', 600), ('w1', 2000), ('n7', 6000)]) {
    testWidgets('player ${probe.$1}', (tester) async {
      phone(tester, height: 2600);
      SharedPreferences.setMockInitialValues({});
      final settings = await SettingsService.load();
      final ep = Episode.fromJson(jsonDecode(File('assets/books/thumma_ihtadayt/ep01/episode.json').readAsStringSync()));
      final player = StorybookPlayer(episode: ep, settings: settings);
      final seg = ep.segments.firstWhere((s) => s.id == probe.$1);
      player.debugSetPosition(seg.start + Duration(milliseconds: probe.$2));
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: Scaffold(
          appBar: AppBar(title: const Text('ثم اهتديت', style: TextStyle(fontSize: 19, color: AppColors.inkSoft))),
          body: PlayerPage(player: player, settings: settings),
        ),
      ));
      await precache(tester, ep.scenes.map((s) => s.image).toSet());
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('out/player_${probe.$1}.png'));
    });
  }
}
