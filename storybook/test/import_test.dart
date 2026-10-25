import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/services/book_importer.dart';

import 'test_support.dart';

void main() {
  late Directory tmp;
  late Directory books;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('hikaya_import');
    books = Directory('${tmp.path}/books');
  });
  tearDown(() => tmp.deleteSync(recursive: true));

  test('imports a valid book and reads its clips-mode episodes', () {
    final zip = writeZip(tmp, testBookFiles());
    final r = BookImporter(books).importZip(zip);
    expect(r.ok, isTrue, reason: r.errors.join('; '));
    expect(r.bookId, 'test_book');
    expect(r.episodes, 2);
    expect(r.updated, isFalse);
    expect(r.warnings.any((w) => w.contains('unverified timing')), isTrue);

    final dir = Directory('${books.path}/test_book');
    final book = Book.fromJson(jsonDecode(File('${dir.path}/book.json').readAsStringSync()) as Map<String, dynamic>,
        BookLocation.imported(dir.path));
    final ep = Episode.fromJson(
        jsonDecode(File(book.location.resolve(book.episodes[1].manifest!)).readAsStringSync()) as Map<String, dynamic>);
    expect(ep.audio.mode, AudioMode.clips);
    expect(ep.segments.first.clip!.start, const Duration(milliseconds: 2000));
    expect(ep.segments.last.timing, Timing.estimated);
    expect(books.listSync().where((e) => e.path.contains('.staging')), isEmpty);
  });

  test('accepts a ZIP whose files sit inside one top-level folder (macOS style)', () {
    final zip = writeZip(tmp, {...testBookFiles(), '__MACOSX/._x': [0]}, prefix: 'My Book/');
    expect(BookImporter(books).importZip(zip).ok, isTrue);
  });

  test('rejects path traversal and absolute paths', () {
    for (final bad in ['../evil.txt', 'a/../../evil.txt', '/etc/evil']) {
      final zip = writeZip(tmp, {...testBookFiles(), bad: [1]}, name: 'bad.zip');
      final r = BookImporter(books).importZip(zip);
      expect(r.ok, isFalse, reason: bad);
      expect(r.errors.single, contains('unsafe entry'));
    }
    expect(File('${tmp.path}/evil.txt').existsSync(), isFalse);
    expect(BookImporter.unsafeEntry('C:/x', false), 'absolute path');
    expect(BookImporter.unsafeEntry('ok/file.txt', true), contains('symbolic'));
  });

  test('missing audio fails the import; missing images are warnings', () {
    final files = testBookFiles()..remove('audio/batch_hero.wav');
    final r = BookImporter(books).importZip(writeZip(tmp, files));
    expect(r.ok, isFalse);
    expect(r.errors.where((e) => e.contains('batch_hero.wav')), hasLength(2));
    expect(Directory('${books.path}/test_book').existsSync(), isFalse);

    final noImages = BookImporter(books).importZip(writeZip(tmp, testBookFiles(withImages: false), name: 'n.zip'));
    expect(noImages.ok, isTrue);
    expect(noImages.warnings.where((w) => w.contains('scene1.png')), hasLength(2));
  });

  test('re-importing updates the book in place', () {
    final importer = BookImporter(books);
    expect(importer.importZip(writeZip(tmp, testBookFiles())).ok, isTrue);
    final r = importer.importZip(writeZip(tmp, testBookFiles(version: 2), name: 'v2.zip'));
    expect(r.ok && r.updated, isTrue);
    final json = jsonDecode(File('${books.path}/test_book/book.json').readAsStringSync());
    expect(json['version'], 2);
    expect(books.listSync().map((e) => e.path).where((p) => p.contains('.old-') || p.contains('.staging')), isEmpty);
  });

  test('rejects packages without book.json, bad ids or non-ZIP files', () {
    expect(BookImporter(books).importZip(writeZip(tmp, {'readme.txt': [1]})).errors.single, contains('book.json'));
    final badId = testBookFiles(id: 'Bad Id');
    expect(BookImporter(books).importZip(writeZip(tmp, badId, name: 'b.zip')).errors.single, contains('book id'));
    File('${tmp.path}/fake.zip').writeAsStringSync('not a zip');
    expect(BookImporter(books).importZip('${tmp.path}/fake.zip').ok, isFalse);
  });
}
