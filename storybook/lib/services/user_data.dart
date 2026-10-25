import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Bookmark {
  final String id;
  final String bookId;
  final String episodeId;
  final Duration position;
  final String label;
  final DateTime created;

  const Bookmark({
    required this.id,
    required this.bookId,
    required this.episodeId,
    required this.position,
    required this.label,
    required this.created,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'bookId': bookId,
        'episodeId': episodeId,
        'positionMs': position.inMilliseconds,
        'label': label,
        'created': created.toIso8601String(),
      };

  factory Bookmark.fromJson(Map<String, dynamic> j) => Bookmark(
        id: j['id'] as String,
        bookId: j['bookId'] as String,
        episodeId: j['episodeId'] as String,
        position: Duration(milliseconds: j['positionMs'] as int),
        label: j['label'] as String? ?? '',
        created: DateTime.tryParse(j['created'] as String? ?? '') ?? DateTime.now(),
      );
}

/// Preferences, listening progress, bookmarks and favourites, stored on the
/// device. Progress is keyed "bookId/episodeId", so it survives book updates.
class UserData extends ChangeNotifier {
  final SharedPreferences _p;

  UserData(this._p);

  static Future<UserData> load() async => UserData(await SharedPreferences.getInstance());

  // --- settings ------------------------------------------------------------

  ThemeMode get themeMode => ThemeMode.values[(_p.getInt('themeMode') ?? 0).clamp(0, 2)];
  double get fontScale => _p.getDouble('fontScale') ?? 1.0;
  double get lineHeight => _p.getDouble('lineHeight') ?? 1.8;
  bool get showText => _p.getBool('showText') ?? true;
  bool get highlight => _p.getBool('highlight') ?? true;
  double get speed => _p.getDouble('speed') ?? 1.0;
  double get voiceVolume => _p.getDouble('voiceVolume') ?? 1.0;
  double get musicVolume => _p.getDouble('musicVolume') ?? 0.7;
  bool get musicMuted => _p.getBool('musicMuted') ?? false;
  bool get sfxEnabled => _p.getBool('sfxEnabled') ?? true;
  bool get autoNext => _p.getBool('autoNext') ?? true;
  bool get showIntro => _p.getBool('showIntro') ?? true;

  static const fontScales = [0.85, 1.0, 1.15, 1.3, 1.5, 1.75];
  static const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  Future<void> setThemeMode(ThemeMode v) => _set(() => _p.setInt('themeMode', v.index));
  Future<void> setFontScale(double v) => _set(() => _p.setDouble('fontScale', v));
  Future<void> setLineHeight(double v) => _set(() => _p.setDouble('lineHeight', v));
  Future<void> setShowText(bool v) => _set(() => _p.setBool('showText', v));
  Future<void> setHighlight(bool v) => _set(() => _p.setBool('highlight', v));
  Future<void> setSpeed(double v) => _set(() => _p.setDouble('speed', v));
  Future<void> setVoiceVolume(double v) => _set(() => _p.setDouble('voiceVolume', v));
  Future<void> setMusicVolume(double v) => _set(() => _p.setDouble('musicVolume', v));
  Future<void> setMusicMuted(bool v) => _set(() => _p.setBool('musicMuted', v));
  Future<void> setSfxEnabled(bool v) => _set(() => _p.setBool('sfxEnabled', v));
  Future<void> setAutoNext(bool v) => _set(() => _p.setBool('autoNext', v));
  Future<void> setShowIntro(bool v) => _set(() => _p.setBool('showIntro', v));

  Future<void> _set(Future<bool> Function() write) async {
    await write();
    notifyListeners();
  }

  // --- progress --------------------------------------------------------------

  Duration progress(String key) => Duration(milliseconds: _p.getInt('progress:$key') ?? 0);
  bool finished(String key) => _p.getBool('finished:$key') ?? false;

  /// Most recently played episodes, newest first ("bookId/episodeId").
  List<String> get recent => _p.getStringList('recent') ?? const [];

  Future<void> saveProgress(String key, Duration position, {bool finished = false, bool notify = true}) async {
    await _p.setInt('progress:$key', position.inMilliseconds);
    if (finished) await _p.setBool('finished:$key', true);
    final list = [key, ...recent.where((k) => k != key)].take(12).toList();
    await _p.setStringList('recent', list);
    if (notify) notifyListeners();
  }

  // --- favourites ------------------------------------------------------------

  Set<String> get favorites => (_p.getStringList('favorites') ?? const []).toSet();
  bool isFavorite(String bookId) => favorites.contains(bookId);

  Future<void> toggleFavorite(String bookId) {
    final f = favorites;
    f.contains(bookId) ? f.remove(bookId) : f.add(bookId);
    return _set(() => _p.setStringList('favorites', f.toList()));
  }

  // --- bookmarks -------------------------------------------------------------

  List<Bookmark> get bookmarks {
    final raw = _p.getString('bookmarks');
    if (raw == null) return const [];
    return (jsonDecode(raw) as List).map((b) => Bookmark.fromJson(b as Map<String, dynamic>)).toList()
      ..sort((a, b) => b.created.compareTo(a.created));
  }

  Future<Bookmark> addBookmark(String bookId, String episodeId, Duration position, String label) async {
    final b = Bookmark(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      bookId: bookId,
      episodeId: episodeId,
      position: position,
      label: label,
      created: DateTime.now(),
    );
    await _saveBookmarks([b, ...bookmarks]);
    return b;
  }

  Future<void> removeBookmark(String id) => _saveBookmarks(bookmarks.where((b) => b.id != id).toList());

  Future<void> _saveBookmarks(List<Bookmark> list) =>
      _set(() => _p.setString('bookmarks', jsonEncode(list.map((b) => b.toJson()).toList())));
}
