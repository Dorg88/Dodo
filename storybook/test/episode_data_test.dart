import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:thumma_ihtadayt/models/episode.dart';
import 'package:thumma_ihtadayt/models/library.dart';

Map<String, dynamic> readJson(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final library = Library.fromJson(readJson('assets/library.json'));
  final entry = library.books.first.episodes.first;
  final raw = readJson(entry.manifest);
  final ep = Episode.fromJson(raw);

  test('library points at bundled, available episode manifests', () {
    for (final book in library.books) {
      expect(File(book.cover).existsSync(), isTrue, reason: book.cover);
      for (final e in book.episodes.where((e) => e.available)) {
        expect(File(e.manifest).existsSync(), isTrue, reason: e.manifest);
        expect(e.duration, Episode.fromJson(readJson(e.manifest)).duration);
      }
    }
  });

  test('every referenced image and audio stem is bundled', () {
    for (final a in [ep.voiceAsset, ep.musicAsset, ep.sfxAsset]) {
      expect(File(a).existsSync(), isTrue, reason: a);
    }
    for (final s in ep.scenes) {
      expect(File(s.image).existsSync(), isTrue, reason: s.image);
    }
  });

  test('all seven speakers appear, in script order', () {
    expect(ep.speakers.length, 7);
    expect(ep.segments.map((s) => s.speakerId).toSet().length, 7);
    expect(ep.segments.map((s) => s.id).toList(), [
      'n1a', 'n1b', 'child1', 'father', 'n2', 'teacher', 'n3', 'child2', 'n4', 'w1', 'w2', 'n5a', 'n5b',
      'adult', 'n6', 'n7',
    ]);
    for (final s in ep.segments) {
      expect(s.speakerName, ep.speakers[s.speakerId]!.name);
    }
  });

  test('timeline is ordered, non-overlapping and inside the episode', () {
    var cursor = Duration.zero;
    for (final s in ep.segments) {
      expect(s.start >= cursor, isTrue, reason: s.id);
      expect(s.end > s.start, isTrue, reason: s.id);
      expect(s.end - s.start, s.sourceEnd - s.sourceStart, reason: '${s.id} keeps its source length');
      cursor = s.end;
      expect(s.lines.first.start, s.start, reason: s.id);
      expect(s.lines.last.end, s.end, reason: s.id);
      for (var i = 1; i < s.lines.length; i++) {
        expect(s.lines[i].start, s.lines[i - 1].end, reason: '${s.id} line $i');
      }
    }
    expect(cursor <= ep.duration, isTrue);

    for (var i = 0; i < ep.scenes.length; i++) {
      expect(ep.scenes[i].number, i + 1);
      if (i > 0) expect(ep.scenes[i].start, ep.scenes[i - 1].end);
      final segs = ep.segmentsOfScene(ep.scenes[i].number);
      expect(segs, isNotEmpty, reason: 'scene ${i + 1}');
      expect(segs.first.start >= ep.scenes[i].start, isTrue);
      expect(segs.last.end <= ep.scenes[i].end, isTrue);
    }
    expect(ep.scenes.first.start, Duration.zero);
    expect(ep.scenes.last.end, ep.duration);
  });

  test('story text holds no production directions', () {
    for (final s in ep.segments) {
      expect(s.text.contains('['), isFalse);
      expect(s.text.contains('SPEAKER'), isFalse);
    }
  });

  test('no music plays during the takbir', () {
    final takbir = ep.segments.firstWhere((s) => s.text.contains('الله أكبر'));
    for (final c in raw['musicCues'] as List) {
      final start = Duration(milliseconds: c['startMs'] as int);
      final end = Duration(milliseconds: c['endMs'] as int);
      final overlaps = start < takbir.end + const Duration(seconds: 1) &&
          end > takbir.start - const Duration(seconds: 1);
      expect(overlaps, isFalse, reason: c['label'] as String);
    }
  });

  test('position lookups follow the timeline', () {
    expect(ep.sceneIndexAt(Duration.zero), 0);
    expect(ep.segmentAt(Duration.zero)!.id, 'n1a');
    final father = ep.segments.firstWhere((s) => s.id == 'father');
    final mid = father.start + const Duration(seconds: 1);
    expect(ep.segmentAt(mid)!.id, 'father');
    expect(ep.speakingAt(mid)!.speakerName, 'الأب');
    expect(ep.scenes[ep.sceneIndexAt(mid)].number, father.scene);
    expect(ep.sceneIndexAt(ep.duration), ep.scenes.length - 1);
    final w2 = ep.segments.firstWhere((s) => s.id == 'w2');
    // Between two segments of one scene the earlier one stays on screen.
    expect(ep.segmentAt(w2.start - const Duration(milliseconds: 100))!.id, 'w1');
  });
}
