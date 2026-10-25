import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/services/book_importer.dart';

/// Imports a real book ZIP produced by tools/hikaya/hikaya_pack.py.
/// Run with: HIKAYA_TEST_ZIP=/path/book.zip flutter test test/external_book_test.dart
void main() {
  final zip = Platform.environment['HIKAYA_TEST_ZIP'];
  test('imports a packaged book from the Mac tools', () {
    final tmp = Directory.systemTemp.createTempSync('hikaya_ext');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final r = BookImporter(Directory('${tmp.path}/books')).importZip(zip!);
    expect(r.ok, isTrue, reason: r.errors.join('; '));
    final dir = Directory('${tmp.path}/books/${r.bookId}');
    final book = Book.fromJson(jsonDecode(File('${dir.path}/book.json').readAsStringSync()) as Map<String, dynamic>,
        BookLocation.imported(dir.path));
    for (final e in book.available) {
      final ep = Episode.fromJson(
          jsonDecode(File(book.location.resolve(e.manifest!)).readAsStringSync()) as Map<String, dynamic>);
      for (final f in ep.referencedFiles) {
        expect(File(book.location.resolve(f)).existsSync(), isTrue, reason: f);
      }
      // ignore: avoid_print
      print('episode ${e.number}: ${ep.audio.mode.name}, ${ep.segments.length} segments, '
          '${ep.scenes.length} scenes, music=${ep.audio.music}, ${r.warnings.length} warnings');
    }
  }, skip: zip == null ? 'set HIKAYA_TEST_ZIP to run' : false);
}
