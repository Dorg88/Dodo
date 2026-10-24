/// The bundled catalogue of books and their episodes (assets/library.json).
///
/// New books or episodes are added by editing that file and pointing
/// `manifest` at a generated episode.json; no Dart changes are needed.
class Library {
  final List<Book> books;

  const Library(this.books);

  factory Library.fromJson(Map<String, dynamic> json) => Library(
        (json['books'] as List).map((b) => Book.fromJson(b as Map<String, dynamic>)).toList(),
      );

  Book? bookById(String id) {
    for (final b in books) {
      if (b.id == id) return b;
    }
    return null;
  }
}

class Book {
  final String id;
  final String title;
  final String subtitle;
  final String author;
  final String volumeLabel;
  final String genre;
  final String cover;
  final String coverCaption;
  final List<EpisodeEntry> episodes;

  const Book({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.author,
    required this.volumeLabel,
    required this.genre,
    required this.cover,
    required this.coverCaption,
    required this.episodes,
  });

  factory Book.fromJson(Map<String, dynamic> json) => Book(
        id: json['id'] as String,
        title: json['title'] as String,
        subtitle: json['subtitle'] as String? ?? '',
        author: json['author'] as String? ?? '',
        volumeLabel: json['volumeLabel'] as String? ?? '',
        genre: json['genre'] as String? ?? '',
        cover: json['cover'] as String,
        coverCaption: json['coverCaption'] as String? ?? '',
        episodes: (json['episodes'] as List)
            .map((e) => EpisodeEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  EpisodeEntry? get firstAvailable {
    for (final e in episodes) {
      if (e.available) return e;
    }
    return null;
  }

  EpisodeEntry? episodeById(String id) {
    for (final e in episodes) {
      if (e.id == id) return e;
    }
    return null;
  }
}

class EpisodeEntry {
  final String id;
  final int number;
  final String title;
  final String summary;
  final String manifest;
  final Duration duration;
  final bool available;

  const EpisodeEntry({
    required this.id,
    required this.number,
    required this.title,
    required this.summary,
    required this.manifest,
    required this.duration,
    required this.available,
  });

  factory EpisodeEntry.fromJson(Map<String, dynamic> json) => EpisodeEntry(
        id: json['id'] as String,
        number: json['number'] as int,
        title: json['title'] as String,
        summary: json['summary'] as String? ?? '',
        manifest: json['manifest'] as String? ?? '',
        duration: Duration(milliseconds: json['durationMs'] as int? ?? 0),
        available: json['available'] as bool? ?? false,
      );
}
