import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;

import '../models/book.dart';
import '../models/episode.dart';
import 'book_importer.dart';

/// The library: books bundled in the APK plus books imported from ZIP files.
/// An imported book with the same id as a bundled one replaces it, which is
/// how a complete edition (e.g. all 22 episodes) supersedes the sample that
/// ships with the app — without rebuilding the APK.
class LibraryStore extends ChangeNotifier {
  final AssetBundle bundle;
  final Directory? booksDir;
  final Map<String, Episode> _episodes = {};
  List<Book> _books = const [];
  List<String> loadErrors = const [];

  LibraryStore({AssetBundle? bundle, this.booksDir}) : bundle = bundle ?? rootBundle;

  List<Book> get books => _books;

  Book? bookById(String id) {
    for (final b in _books) {
      if (b.id == id) return b;
    }
    return null;
  }

  Future<void> load() async {
    final byId = <String, Book>{};
    final errors = <String>[];
    final index = jsonDecode(await bundle.loadString('assets/books/index.json')) as Map<String, dynamic>;
    for (final root in (index['books'] as List).cast<String>()) {
      try {
        final json = jsonDecode(await bundle.loadString('$root/book.json')) as Map<String, dynamic>;
        final book = Book.fromJson(json, BookLocation.bundled(root));
        byId[book.id] = book;
      } on Object catch (e) {
        errors.add('$root: $e');
      }
    }
    final dir = booksDir;
    if (dir != null && dir.existsSync()) {
      for (final d in dir.listSync().whereType<Directory>()) {
        final name = p.basename(d.path);
        if (name.startsWith('.') || name.contains('.old-')) continue;
        try {
          final json = jsonDecode(File(p.join(d.path, 'book.json')).readAsStringSync()) as Map<String, dynamic>;
          final book = Book.fromJson(json, BookLocation.imported(d.path));
          byId[book.id] = book;
        } on Object catch (e) {
          errors.add('$name: $e');
        }
      }
    }
    _books = byId.values.toList()..sort((a, b) => a.title.compareTo(b.title));
    _episodes.clear();
    loadErrors = errors;
    notifyListeners();
  }

  Future<Episode> loadEpisode(Book book, EpisodeEntry entry) async {
    final key = '${book.location.root}|${entry.manifest}';
    final cached = _episodes[key];
    if (cached != null) return cached;
    final path = book.location.resolve(entry.manifest!);
    final raw = book.location.bundled ? await bundle.loadString(path) : await File(path).readAsString();
    final ep = Episode.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    _episodes[key] = ep;
    return ep;
  }

  /// Imports a ZIP on a background isolate, then reloads the library.
  Future<ImportResult> importZip(String zipPath) async {
    final dir = booksDir;
    if (dir == null) return const ImportResult(ok: false, errors: ['storage is not available']);
    final dirPath = dir.path;
    final json = await Isolate.run(() => BookImporter(Directory(dirPath)).importZip(zipPath).toJson());
    final result = ImportResult.fromJson(json);
    if (result.ok) await load();
    return result;
  }

  bool canDelete(Book book) => !book.location.bundled;

  Future<void> deleteImported(Book book) async {
    if (book.location.bundled) return;
    final dir = Directory(book.location.root);
    if (dir.existsSync()) await dir.delete(recursive: true);
    await load();
  }
}
