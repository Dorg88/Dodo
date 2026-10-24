import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'models/library.dart';
import 'screens/home_screen.dart';
import 'services/library_repository.dart';
import 'services/settings_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: AppColors.paper,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  final repository = LibraryRepository();
  final results = await Future.wait([SettingsService.load(), repository.loadLibrary()]);
  runApp(StorybookApp(
    settings: results[0] as SettingsService,
    repository: repository,
    library: results[1] as Library,
  ));
}

/// App-wide services available to every screen.
class AppScope extends InheritedWidget {
  final SettingsService settings;
  final LibraryRepository repository;
  final Library library;

  const AppScope({
    super.key,
    required this.settings,
    required this.repository,
    required this.library,
    required super.child,
  });

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      settings != oldWidget.settings || library != oldWidget.library;
}

class StorybookApp extends StatelessWidget {
  final SettingsService settings;
  final LibraryRepository repository;
  final Library library;

  const StorybookApp({super.key, required this.settings, required this.repository, required this.library});

  @override
  Widget build(BuildContext context) {
    return AppScope(
      settings: settings,
      repository: repository,
      library: library,
      child: MaterialApp(
        title: 'ثم اهتديت',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: const HomeScreen(),
      ),
    );
  }
}

/// Gentle cross-fade between pages.
Route<T> fadeRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 450),
      reverseTransitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut), child: child),
    );
