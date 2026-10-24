import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// User preferences and listening progress, persisted on the device.
class SettingsService extends ChangeNotifier {
  final SharedPreferences _prefs;

  SettingsService(this._prefs);

  static Future<SettingsService> load() async => SettingsService(await SharedPreferences.getInstance());

  bool get showCaptions => _prefs.getBool('showCaptions') ?? true;
  double get fontScale => _prefs.getDouble('fontScale') ?? 1.0;
  bool get musicEnabled => _prefs.getBool('musicEnabled') ?? true;
  double get musicVolume => _prefs.getDouble('musicVolume') ?? 0.7;
  bool get sfxEnabled => _prefs.getBool('sfxEnabled') ?? true;
  double get sfxVolume => _prefs.getDouble('sfxVolume') ?? 0.8;
  double get speed => _prefs.getDouble('speed') ?? 1.0;

  static const fontScales = [0.85, 1.0, 1.15, 1.3, 1.5];
  static const speeds = [0.75, 1.0, 1.25, 1.5];

  Future<void> setShowCaptions(bool v) => _set(() => _prefs.setBool('showCaptions', v));
  Future<void> setFontScale(double v) => _set(() => _prefs.setDouble('fontScale', v));
  Future<void> setMusicEnabled(bool v) => _set(() => _prefs.setBool('musicEnabled', v));
  Future<void> setMusicVolume(double v) => _set(() => _prefs.setDouble('musicVolume', v));
  Future<void> setSfxEnabled(bool v) => _set(() => _prefs.setBool('sfxEnabled', v));
  Future<void> setSfxVolume(double v) => _set(() => _prefs.setDouble('sfxVolume', v));
  Future<void> setSpeed(double v) => _set(() => _prefs.setDouble('speed', v));

  Future<void> _set(Future<bool> Function() write) async {
    await write();
    notifyListeners();
  }

  // --- progress ---------------------------------------------------------

  Duration progressFor(String key) => Duration(milliseconds: _prefs.getInt('progress:$key') ?? 0);

  bool finished(String key) => _prefs.getBool('finished:$key') ?? false;

  /// "bookId/episodeId" of the episode listened to most recently.
  String? get lastEpisodeKey => _prefs.getString('lastEpisode');

  Future<void> saveProgress(String key, Duration position, {bool finished = false}) async {
    await _prefs.setInt('progress:$key', position.inMilliseconds);
    await _prefs.setString('lastEpisode', key);
    if (finished) await _prefs.setBool('finished:$key', true);
    notifyListeners();
  }
}
