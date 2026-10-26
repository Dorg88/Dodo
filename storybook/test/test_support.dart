import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/services/playback.dart';

/// A tiny but complete test book in clips mode: one recording holds two
/// speakers' lines across two episodes (like a production batch file).
Map<String, List<int>> testBookFiles({String id = 'test_book', int version = 1, bool withImages = true}) {
  final book = {
    'schema': 'hikaya.book.v1',
    'id': id,
    'title': 'كتاب تجريبي',
    'author': 'فريق الاختبار',
    'version': version,
    'cover': 'cover.png',
    'episodes': [
      {'id': 'e1', 'number': 1, 'title': 'الأولى', 'manifest': 'episodes/e1/episode.json', 'durationMs': 4000},
      {'id': 'e2', 'number': 2, 'title': 'الثانية', 'manifest': 'episodes/e2/episode.json', 'durationMs': 3000},
    ],
  };
  Map<String, dynamic> episode(String id, int number, int clipOffset) => {
        'schema': 'hikaya.episode.v1',
        'id': id,
        'number': number,
        'audio': {'mode': 'clips', 'music': 'audio/score_$id.m4a'},
        'speakers': {'NARRATOR': {'name': 'الراوي'}, 'HERO': {'name': 'البطل'}},
        'scenes': [
          {'number': 1, 'title': 'المشهد', 'image': 'episodes/$id/scene1.png', 'startMs': 0, 'endMs': 4000},
        ],
        'segments': [
          {
            'id': '${id}a',
            'scene': 1,
            'speakerId': 'NARRATOR',
            'speakerName': 'الراوي',
            'text': 'كان يا ما كان.',
            'startMs': 300,
            'endMs': 1800,
            'clip': {'file': 'audio/batch_narrator.wav', 'startMs': clipOffset, 'endMs': clipOffset + 1500},
            'timing': 'verified',
          },
          {
            'id': '${id}b',
            'scene': 1,
            'speakerId': 'HERO',
            'speakerName': 'البطل',
            'text': 'مرحباً.',
            'startMs': 2300,
            'endMs': 3100,
            'clip': {'file': 'audio/batch_hero.wav', 'startMs': clipOffset, 'endMs': clipOffset + 800},
            'timing': 'estimated',
          },
        ],
      };
  return {
    'book.json': utf8.encode(jsonEncode(book)),
    'episodes/e1/episode.json': utf8.encode(jsonEncode(episode('e1', 1, 0))),
    'episodes/e2/episode.json': utf8.encode(jsonEncode(episode('e2', 2, 2000))),
    'audio/batch_narrator.wav': List.filled(64, 1),
    'audio/batch_hero.wav': List.filled(64, 2),
    'audio/score_e1.m4a': List.filled(16, 3),
    'audio/score_e2.m4a': List.filled(16, 3),
    if (withImages) 'cover.png': List.filled(16, 4),
    if (withImages) 'episodes/e1/scene1.png': List.filled(16, 5),
    if (withImages) 'episodes/e2/scene1.png': List.filled(16, 6),
  };
}

String writeZip(Directory dir, Map<String, List<int>> files, {String name = 'book.zip', String prefix = ''}) {
  final archive = Archive();
  files.forEach((path, bytes) => archive.addFile(ArchiveFile.bytes('$prefix$path', bytes)));
  final path = '${dir.path}/$name';
  File(path).writeAsBytesSync(ZipEncoder().encode(archive));
  return path;
}

/// Engine stand-in so controller/UI tests run without audio hardware.
class FakeEngine implements EpisodeEngine {
  @override
  final Book book;
  @override
  final Episode episode;
  Duration _pos = Duration.zero;
  bool _playing = false;
  bool disposed = false;

  /// Lets a test hold an episode in the middle of loading.
  static Future<void>? loadGate;

  FakeEngine(this.book, this.episode);

  @override
  Duration get position => _pos;
  @override
  bool get playing => _playing;
  @override
  bool get hasMusic => episode.audio.music != null;
  @override
  Stream<void> get completed => const Stream.empty();
  @override
  Future<void> load(Duration start) async {
    if (loadGate != null) await loadGate;
    _pos = start;
  }
  @override
  Future<void> play() async => _playing = true;
  @override
  Future<void> pause() async => _playing = false;
  @override
  Future<void> seek(Duration t) async => _pos = t;
  @override
  Future<void> setSpeed(double v) async {}
  @override
  Future<void> setMix({required double voice, required double music, required bool sfx}) async {}
  @override
  void resync() {}
  @override
  Future<void> dispose() async => disposed = true;
}
