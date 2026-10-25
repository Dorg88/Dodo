import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'models/book.dart';
import 'screens/bookmarks_screen.dart';
import 'screens/home_screen.dart';
import 'screens/library_screen.dart';
import 'screens/player_screen.dart';
import 'screens/settings_screen.dart';
import 'services/library_store.dart';
import 'services/media_controls.dart';
import 'services/user_data.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final docs = await getApplicationDocumentsDirectory();
  final store = LibraryStore(booksDir: Directory(p.join(docs.path, 'hikaya', 'books')));
  final user = await UserData.load();
  await store.load();
  HikayaAudioHandler? media;
  try {
    media = await AudioService.init(
      builder: HikayaAudioHandler.new,
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.dodo.hikaya.playback',
        androidNotificationChannelName: 'حكايا — التشغيل',
        androidNotificationOngoing: true,
        androidStopForegroundOnPause: true,
      ),
    );
  } on Object catch (e) {
    debugPrint('media session unavailable: $e');
  }
  runApp(HikayaApp(store: store, user: user, media: media));
}

/// App-wide services.
class AppScope extends InheritedWidget {
  final LibraryStore store;
  final UserData user;
  final HikayaAudioHandler? media;

  const AppScope({super.key, required this.store, required this.user, required this.media, required super.child});

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope old) => store != old.store || user != old.user;
}

class HikayaApp extends StatelessWidget {
  final LibraryStore store;
  final UserData user;
  final HikayaAudioHandler? media;

  const HikayaApp({super.key, required this.store, required this.user, this.media});

  @override
  Widget build(BuildContext context) {
    return AppScope(
      store: store,
      user: user,
      media: media,
      child: ListenableBuilder(
        listenable: user,
        builder: (context, _) => MaterialApp(
          title: 'حكايا',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: user.themeMode,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: const ShellScreen(),
        ),
      ),
    );
  }
}

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final pages = [
      HomeScreen(onOpenLibrary: () => setState(() => _tab = 1)),
      const LibraryScreen(),
      const BookmarksScreen(),
      const SettingsScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: c.parchment,
        indicatorColor: c.highlight,
        surfaceTintColor: Colors.transparent,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
          NavigationDestination(
              icon: Icon(Icons.local_library_outlined), selectedIcon: Icon(Icons.local_library), label: 'المكتبة'),
          NavigationDestination(
              icon: Icon(Icons.bookmarks_outlined), selectedIcon: Icon(Icons.bookmarks), label: 'المحفوظات'),
          NavigationDestination(icon: Icon(Icons.tune_outlined), selectedIcon: Icon(Icons.tune), label: 'الإعدادات'),
        ],
      ),
    );
  }
}

Future<void> openEpisode(BuildContext context, Book book, EpisodeEntry entry, {Duration? startAt}) {
  return Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => PlayerScreen(book: book, entry: entry, startAt: startAt),
  ));
}
