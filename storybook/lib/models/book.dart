/// A book in the HIKAYA library, read from its `book.json` (schema
/// `hikaya.book.v1`; see docs/BOOK_FORMAT.md). Every path inside a book is
/// relative to the book's root folder, so the same package works whether it
/// is bundled with the app or imported from a ZIP file.
class Book {
  final String id;
  final String title;
  final String subtitle;
  final String author;
  final String description;
  final String language;
  final int version;
  final String? cover;
  final int? plannedEpisodes;
  final List<EpisodeEntry> episodes;
  final BookLocation location;

  const Book({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.author,
    required this.description,
    required this.language,
    required this.version,
    required this.cover,
    required this.plannedEpisodes,
    required this.episodes,
    required this.location,
  });

  static final idPattern = RegExp(r'^[a-z0-9][a-z0-9_\-]{0,63}$');

  factory Book.fromJson(Map<String, dynamic> json, BookLocation location) {
    final id = json['id'] as String? ?? '';
    if (!idPattern.hasMatch(id)) {
      throw FormatException('book id "$id" must be lowercase latin letters, digits, _ or -');
    }
    final title = (json['title'] as String? ?? '').trim();
    if (title.isEmpty) throw const FormatException('book title is missing');
    final episodes = (json['episodes'] as List? ?? const [])
        .map((e) => EpisodeEntry.fromJson(e as Map<String, dynamic>))
        .toList()
      ..sort((a, b) => a.number.compareTo(b.number));
    return Book(
      id: id,
      title: title,
      subtitle: json['subtitle'] as String? ?? '',
      author: json['author'] as String? ?? '',
      description: json['description'] as String? ?? '',
      language: json['language'] as String? ?? 'ar',
      version: json['version'] as int? ?? 1,
      cover: json['cover'] as String?,
      plannedEpisodes: json['plannedEpisodes'] as int?,
      episodes: episodes,
      location: location,
    );
  }

  List<EpisodeEntry> get available => episodes.where((e) => e.available).toList();

  EpisodeEntry? episodeById(String id) {
    for (final e in episodes) {
      if (e.id == id) return e;
    }
    return null;
  }

  /// The available episode after/before [current], in episode order.
  EpisodeEntry? neighbour(EpisodeEntry current, int step) {
    final list = available;
    final i = list.indexWhere((e) => e.id == current.id);
    final j = i + step;
    return i < 0 || j < 0 || j >= list.length ? null : list[j];
  }

  String progressKey(EpisodeEntry e) => '$id/${e.id}';
}

class EpisodeEntry {
  final String id;
  final int number;
  final String title;
  final String summary;
  final String? manifest;
  final Duration duration;

  const EpisodeEntry({
    required this.id,
    required this.number,
    required this.title,
    required this.summary,
    required this.manifest,
    required this.duration,
  });

  bool get available => manifest != null && manifest!.isNotEmpty;

  factory EpisodeEntry.fromJson(Map<String, dynamic> json) => EpisodeEntry(
        id: json['id'] as String,
        number: json['number'] as int,
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        manifest: json['manifest'] as String?,
        duration: Duration(milliseconds: json['durationMs'] as int? ?? 0),
      );
}

/// Where a book's files live: inside the APK's assets, or in a folder in
/// the app's private storage after an import.
class BookLocation {
  final bool bundled;
  final String root;

  const BookLocation.bundled(this.root) : bundled = true;
  const BookLocation.imported(this.root) : bundled = false;

  /// Full asset key or file path for a path relative to the book root.
  String resolve(String relative) {
    final clean = relative.replaceAll('\\', '/');
    return '$root/$clean';
  }
}
