import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:thumma_ihtadayt/main.dart';
import 'package:thumma_ihtadayt/models/episode.dart';
import 'package:thumma_ihtadayt/services/library_repository.dart';
import 'package:thumma_ihtadayt/services/settings_service.dart';
import 'package:thumma_ihtadayt/theme/app_theme.dart';
import 'package:thumma_ihtadayt/widgets/storybook_widgets.dart';

void tallPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 4000);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('home page shows the book and its actions, right to left', (tester) async {
    tallPhone(tester);
    SharedPreferences.setMockInitialValues({});
    final settings = await SettingsService.load();
    final repo = LibraryRepository();
    final library = await tester.runAsync(repo.loadLibrary);
    await tester.pumpWidget(StorybookApp(settings: settings, repository: repo, library: library!));
    await tester.pump();

    expect(find.text('ثم اهتديت'), findsOneWidget);
    expect(find.text('رحلة البحث عن الحقيقة'), findsOneWidget);
    expect(find.text('ابدأ الاستماع'), findsOneWidget);
    expect(find.text('الحلقات'), findsOneWidget);
    expect(find.text('متابعة الاستماع'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('الحلقات'))), TextDirection.rtl);
  });

  testWidgets('continue button offers the saved position', (tester) async {
    tallPhone(tester);
    SharedPreferences.setMockInitialValues({
      'lastEpisode': 'thumma_ihtadayt/ep01',
      'progress:thumma_ihtadayt/ep01': 65000,
    });
    final settings = await SettingsService.load();
    final repo = LibraryRepository();
    final library = await tester.runAsync(repo.loadLibrary);
    await tester.pumpWidget(StorybookApp(settings: settings, repository: repo, library: library!));
    await tester.pump();
    expect(find.text('متابعة الاستماع · ${formatTime(const Duration(seconds: 65))}'), findsOneWidget);
  });

  testWidgets('episode library lists available and upcoming episodes', (tester) async {
    tallPhone(tester);
    SharedPreferences.setMockInitialValues({});
    final settings = await SettingsService.load();
    final repo = LibraryRepository();
    final library = await tester.runAsync(repo.loadLibrary);
    await tester.pumpWidget(StorybookApp(settings: settings, repository: repo, library: library!));
    await tester.tap(find.text('الحلقات'));
    await tester.pumpAndSettle();
    expect(find.text('ليلة لا تنسى'), findsOneWidget);
    expect(find.text('قريبًا'), findsOneWidget);
  });

  testWidgets('story text marks the line being spoken', (tester) async {
    const seg = Segment(
      id: 's',
      scene: 1,
      speakerId: 'SPEAKER_01',
      speakerName: 'الراوي',
      direction: '',
      text: 'أ ب',
      trailingText: null,
      start: Duration.zero,
      end: Duration(seconds: 4),
      audioSource: '',
      sourceStart: Duration.zero,
      sourceEnd: Duration(seconds: 4),
      lines: [
        Line(text: 'السطر الأول', start: Duration.zero, end: Duration(seconds: 2)),
        Line(text: 'السطر الثاني', start: Duration(seconds: 2), end: Duration(seconds: 4)),
      ],
    );
    await tester.pumpWidget(const MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: StoryText(segment: seg, position: Duration(seconds: 3), scale: 1),
      ),
    ));
    final rich = tester.widget<Text>(find.byType(Text)).textSpan! as TextSpan;
    final spans = rich.children!.whereType<TextSpan>().where((s) => s.text!.trim().isNotEmpty).toList();
    expect(spans[0].style!.color, AppColors.inkSoft);
    expect(spans[1].style!.color, AppColors.ink);
  });
}
