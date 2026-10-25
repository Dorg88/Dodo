import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:path/path.dart' as p;

import '../models/book.dart';
import '../models/episode.dart';

/// Result of importing a HIKAYA book package (a ZIP with `book.json`).
class ImportResult {
  final bool ok;
  final String? bookId;
  final String? title;
  final bool updated;
  final int episodes;
  final List<String> errors;
  final List<String> warnings;

  const ImportResult({
    required this.ok,
    this.bookId,
    this.title,
    this.updated = false,
    this.episodes = 0,
    this.errors = const [],
    this.warnings = const [],
  });

  Map<String, dynamic> toJson() => {
        'ok': ok,
        'bookId': bookId,
        'title': title,
        'updated': updated,
        'episodes': episodes,
        'errors': errors,
        'warnings': warnings,
      };

  factory ImportResult.fromJson(Map<String, dynamic> j) => ImportResult(
        ok: j['ok'] as bool,
        bookId: j['bookId'] as String?,
        title: j['title'] as String?,
        updated: j['updated'] as bool? ?? false,
        episodes: j['episodes'] as int? ?? 0,
        errors: List<String>.from(j['errors'] as List),
        warnings: List<String>.from(j['warnings'] as List),
      );
}

/// Safely imports a book ZIP into `booksDir/bookId`.
///
/// Pure Dart (no Flutter plugins) so it can run in a background isolate and
/// in unit tests. Safety rules: entries with absolute paths, `..`, drive
/// letters or symbolic links are rejected; total size and entry count are
/// capped; files are extracted to a staging folder and only swapped into
/// place once the whole package validates, so a failed import never damages
/// an installed book. Listening progress is keyed by book and episode id and
/// therefore survives updates.
class BookImporter {
  static const maxEntries = 20000;
  static const maxTotalBytes = 6 * 1024 * 1024 * 1024; // 6 GB uncompressed

  final Directory booksDir;

  BookImporter(this.booksDir);

  ImportResult importZip(String zipPath) {
    final errors = <String>[];
    final warnings = <String>[];
    InputFileStream? input;
    Directory? staging;
    try {
      input = InputFileStream(zipPath);
      final archive = ZipDecoder().decodeStream(input);

      // 1. Inspect every entry before writing anything.
      final entries = <String, ArchiveFile>{};
      var total = 0;
      for (final f in archive.files) {
        final name = f.name.replaceAll('\\', '/');
        if (_ignored(name) || !f.isFile) continue;
        final problem = unsafeEntry(name, f.isSymbolicLink);
        if (problem != null) {
          return ImportResult(ok: false, errors: ['unsafe entry "$name": $problem']);
        }
        total += f.size;
        entries[name] = f;
      }
      if (entries.length > maxEntries) {
        return ImportResult(ok: false, errors: ['too many files (${entries.length})']);
      }
      if (total > maxTotalBytes) {
        return const ImportResult(ok: false, errors: ['package is larger than 6 GB']);
      }

      // 2. Find book.json (at the root, or inside one top-level folder).
      final manifests = entries.keys.where((n) => p.posix.basename(n) == 'book.json').toList()
        ..sort((a, b) => a.length.compareTo(b.length));
      if (manifests.isEmpty) {
        return const ImportResult(ok: false, errors: ['book.json not found in the ZIP']);
      }
      final prefix = p.posix.dirname(manifests.first) == '.' ? '' : '${p.posix.dirname(manifests.first)}/';
      if (prefix.split('/').where((s) => s.isNotEmpty).length > 1) {
        return const ImportResult(ok: false, errors: ['book.json must be at the root of the ZIP or one folder deep']);
      }

      final bookJson = jsonDecode(utf8.decode(entries[manifests.first]!.content)) as Map<String, dynamic>;
      if (bookJson['schema'] != null && bookJson['schema'] != 'hikaya.book.v1') {
        warnings.add('unknown schema ${bookJson['schema']}; importing as hikaya.book.v1');
      }
      final probe = Book.fromJson(bookJson, const BookLocation.imported('/'));

      // 3. Extract into a staging folder inside booksDir (same filesystem,
      //    so the final swap is a rename).
      booksDir.createSync(recursive: true);
      staging = Directory(p.join(booksDir.path, '.staging-${probe.id}-${DateTime.now().microsecondsSinceEpoch}'));
      staging.createSync();
      for (final entry in entries.entries) {
        if (!entry.key.startsWith(prefix)) continue;
        final rel = entry.key.substring(prefix.length);
        final target = p.normalize(p.join(staging.path, rel));
        if (!p.isWithin(staging.path, target)) {
          return ImportResult(ok: false, errors: ['unsafe entry "${entry.key}"']);
        }
        Directory(p.dirname(target)).createSync(recursive: true);
        final out = OutputFileStream(target);
        entry.value.writeContent(out);
        out.closeSync();
      }

      // 4. Validate the extracted book.
      final report = validateBookDir(staging);
      errors.addAll(report.errors);
      warnings.addAll(report.warnings);
      if (errors.isNotEmpty) {
        staging.deleteSync(recursive: true);
        return ImportResult(ok: false, bookId: probe.id, title: probe.title, errors: errors, warnings: warnings);
      }

      // 5. Swap into place, keeping the previous version until the move works.
      final finalDir = Directory(p.join(booksDir.path, probe.id));
      final updated = finalDir.existsSync();
      Directory? backup;
      if (updated) {
        backup = finalDir.renameSync('${finalDir.path}.old-${DateTime.now().microsecondsSinceEpoch}');
      }
      try {
        staging.renameSync(finalDir.path);
        staging = null;
      } catch (e) {
        backup?.renameSync(finalDir.path);
        rethrow;
      }
      backup?.deleteSync(recursive: true);
      return ImportResult(
        ok: true,
        bookId: probe.id,
        title: probe.title,
        updated: updated,
        episodes: report.availableEpisodes,
        warnings: warnings,
      );
    } on ArchiveException catch (e) {
      return ImportResult(ok: false, errors: ['not a valid ZIP file: ${e.message}']);
    } on FormatException catch (e) {
      return ImportResult(ok: false, errors: ['invalid package: ${e.message}'], warnings: warnings);
    } on FileSystemException catch (e) {
      return ImportResult(ok: false, errors: ['storage error: ${e.message} ${e.path ?? ''}']);
    } finally {
      input?.closeSync();
      if (staging != null && staging.existsSync()) staging.deleteSync(recursive: true);
    }
  }

  static bool _ignored(String name) =>
      name.startsWith('__MACOSX/') || p.posix.basename(name) == '.DS_Store' || name.endsWith('/');

  /// Why an archive entry name is unsafe, or null when it is fine.
  static String? unsafeEntry(String name, bool isSymlink) {
    if (isSymlink) return 'symbolic links are not allowed';
    if (name.startsWith('/') || RegExp(r'^[A-Za-z]:').hasMatch(name)) return 'absolute path';
    if (name.split('/').any((s) => s == '..')) return 'path traversal';
    if (name.contains('\u0000')) return 'invalid character';
    return null;
  }
}

class BookReport {
  final List<String> errors = [];
  final List<String> warnings = [];
  int availableEpisodes = 0;
}

/// Checks a book folder: book.json, every episode manifest and every file
/// they reference. Missing narration audio is an error for that episode;
/// a missing illustration is a warning (the scene shows a plain page).
BookReport validateBookDir(Directory dir) {
  final report = BookReport();
  final bookFile = File(p.join(dir.path, 'book.json'));
  if (!bookFile.existsSync()) {
    report.errors.add('book.json is missing');
    return report;
  }
  final Book book;
  try {
    book = Book.fromJson(jsonDecode(bookFile.readAsStringSync()) as Map<String, dynamic>,
        BookLocation.imported(dir.path));
  } on FormatException catch (e) {
    report.errors.add('book.json: ${e.message}');
    return report;
  }
  if (book.cover != null && !File(book.location.resolve(book.cover!)).existsSync()) {
    report.warnings.add('cover image ${book.cover} is missing');
  }
  final numbers = <int>{};
  for (final entry in book.episodes) {
    if (!numbers.add(entry.number)) report.errors.add('episode number ${entry.number} is used twice');
    if (!entry.available) continue;
    final manifest = File(book.location.resolve(entry.manifest!));
    if (!manifest.existsSync()) {
      report.errors.add('episode ${entry.number}: ${entry.manifest} is missing');
      continue;
    }
    try {
      final ep = Episode.fromJson(jsonDecode(manifest.readAsStringSync()) as Map<String, dynamic>);
      var episodeOk = true;
      for (final f in ep.referencedFiles) {
        if (File(book.location.resolve(f)).existsSync()) continue;
        final isImage = RegExp(r'\.(jpe?g|png|webp)$', caseSensitive: false).hasMatch(f);
        if (isImage) {
          report.warnings.add('episode ${entry.number}: image $f is missing');
        } else {
          report.errors.add('episode ${entry.number}: audio $f is missing');
          episodeOk = false;
        }
      }
      if (ep.segments.isEmpty) {
        report.errors.add('episode ${entry.number}: no segments');
        episodeOk = false;
      }
      final unverified = ep.segments.where((s) => s.timing != Timing.verified).length;
      if (unverified > 0) {
        report.warnings.add('episode ${entry.number}: $unverified segments have unverified timing');
      }
      if (episodeOk) report.availableEpisodes++;
    } on Object catch (e) {
      report.errors.add('episode ${entry.number}: invalid episode.json ($e)');
    }
  }
  if (book.available.isEmpty) report.errors.add('the book has no playable episodes');
  return report;
}
