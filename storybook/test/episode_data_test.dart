import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/services/book_importer.dart';

Map<String, dynamic> readJson(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  const root = 'assets/books/thumma_ihtadayt';
  final book = Book.fromJson(readJson('$root/book.json'), const BookLocation.bundled(root));
  final entry = book.episodes.first;
  final raw = readJson(book.location.resolve(entry.manifest!));
  final ep = Episode.fromJson(raw);

  test('bundled index lists the book, and the book folder validates', () {
    final index = readJson('assets/books/index.json');
    expect(index['books'], contains(root));
    final report = validateBookDir(Directory(root));
    expect(report.errors, isEmpty);
    expect(report.availableEpisodes, 1);
    expect(book.plannedEpisodes, 22);
  });

  test('every referenced image and audio stem exists', () {
    for (final f in ep.referencedFiles) {
      expect(File(book.location.resolve(f)).existsSync(), isTrue, reason: f);
    }
    expect(ep.audio.mode, AudioMode.track);
  });

  test('all seven speakers appear in script order', () {
    expect(ep.segments.map((s) => s.speakerId).toSet().length, 7);
    expect(ep.segments.map((s) => s.id).toList(), [
      'n1a', 'n1b', 'child1', 'father', 'n2', 'teacher', 'n3', 'child2', 'n4', 'w1', 'w2', 'n5a', 'n5b',
      'adult', 'n6', 'n7',
    ]);
  });

  test('timeline is ordered, contiguous and inside the episode', () {
    var cursor = Duration.zero;
    for (final s in ep.segments) {
      expect(s.start >= cursor, isTrue, reason: s.id);
      expect(s.end > s.start, isTrue, reason: s.id);
      cursor = s.end;
      expect(s.lines.first.start, s.start, reason: s.id);
      expect(s.lines.last.end, s.end, reason: s.id);
      expect(s.timing, Timing.verified);
    }
    for (var i = 0; i < ep.scenes.length; i++) {
      expect(ep.scenes[i].number, i + 1);
      if (i > 0) expect(ep.scenes[i].start, ep.scenes[i - 1].end);
      expect(ep.segmentsOfScene(ep.scenes[i].number), isNotEmpty);
    }
    expect(ep.scenes.last.end, ep.duration);
  });

  test('story text holds no production directions', () {
    for (final s in ep.segments) {
      expect(s.text.contains('['), isFalse);
    }
  });

  test('no music plays during the takbir', () {
    final takbir = ep.segments.firstWhere((s) => s.text.contains('الله أكبر'));
    for (final c in raw['musicCues'] as List) {
      final start = Duration(milliseconds: c['startMs'] as int);
      final end = Duration(milliseconds: c['endMs'] as int);
      expect(start < takbir.end + const Duration(seconds: 1) && end > takbir.start - const Duration(seconds: 1), isFalse);
    }
  });

  test('position lookups follow the timeline', () {
    final father = ep.segments.firstWhere((s) => s.id == 'father');
    final mid = father.start + const Duration(seconds: 1);
    expect(ep.speakingAt(mid)!.speakerName, 'الأب');
    expect(ep.activeAt(mid)!.id, 'father');
    expect(ep.scenes[ep.sceneIndexAt(mid)].number, father.scene);
    expect(ep.activeAt(Duration.zero)!.id, 'n1a');
    expect(ep.sceneIndexAt(ep.duration), ep.scenes.length - 1);
  });

  test('clips mode requires a clip on every segment', () {
    expect(
      () => Episode.fromJson({
        'id': 'x',
        'audio': {'mode': 'clips'},
        'scenes': [{'number': 1, 'startMs': 0, 'endMs': 10}],
        'segments': [{'id': 'a', 'scene': 1, 'startMs': 0, 'endMs': 10}],
      }),
      throwsFormatException,
    );
  });

  test('an episode awaiting approval is marked for review', () {
    final e = EpisodeEntry.fromJson(
        {'id': 'ep02', 'number': 2, 'title': 'من قفصة إلى بيت الله', 'manifest': 'ep02/episode.json', 'status': 'review'});
    expect(e.available, isTrue);
    expect(e.underReview, isTrue);
    expect(EpisodeEntry.fromJson({'id': 'ep01', 'number': 1, 'title': 'ليلة لا تنسى'}).underReview, isFalse);
  });
}
