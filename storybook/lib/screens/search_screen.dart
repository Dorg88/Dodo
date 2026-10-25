import 'package:flutter/material.dart';

import '../main.dart';
import '../models/book.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';
import 'book_screen.dart';

/// Searches book titles, authors, episode titles and the story text itself.
/// Arabic matching ignores diacritics and common letter variants.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _Hit {
  final Book book;
  final EpisodeEntry? entry;
  final Duration? at;
  final String title;
  final String snippet;

  _Hit(this.book, this.entry, this.at, this.title, this.snippet);
}

String normalizeArabic(String s) => s
    .replaceAll(RegExp('[ً-ْٰـ]'), '')
    .replaceAll(RegExp('[إأآٱ]'), 'ا')
    .replaceAll('ى', 'ي')
    .replaceAll('ة', 'ه')
    .toLowerCase();

class _SearchScreenState extends State<SearchScreen> {
  final _query = TextEditingController();
  List<_Hit> _hits = const [];
  bool _busy = false;
  int _generation = 0;

  Future<void> _run(String q) async {
    final scope = AppScope.of(context);
    final gen = ++_generation;
    final needle = normalizeArabic(q.trim());
    if (needle.length < 2) {
      setState(() => _hits = const []);
      return;
    }
    setState(() => _busy = true);
    final hits = <_Hit>[];
    for (final b in scope.store.books) {
      if (normalizeArabic('${b.title} ${b.author} ${b.description}').contains(needle)) {
        hits.add(_Hit(b, null, null, b.title, b.author));
      }
      for (final e in b.available) {
        if (normalizeArabic(e.title).contains(needle)) {
          hits.add(_Hit(b, e, Duration.zero, 'الحلقة ${episodeOrdinal(e.number)}: ${e.title}', b.title));
        }
        try {
          final ep = await scope.store.loadEpisode(b, e);
          for (final s in ep.segments) {
            if (normalizeArabic(s.text).contains(needle)) {
              hits.add(_Hit(b, e, s.start, '${s.speakerName} — الحلقة ${episodeOrdinal(e.number)}', s.text));
              if (hits.length > 200) break;
            }
          }
        } on Object {
          // An unreadable episode is reported by the importer; skip it here.
        }
      }
    }
    if (mounted && gen == _generation) {
      setState(() {
        _hits = hits;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _query,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'ابحث في الكتب والحلقات والنصوص', isDense: true),
          onChanged: _run,
        ),
      ),
      body: PaperBackground(
        child: _busy && _hits.isEmpty
            ? Center(child: CircularProgressIndicator(color: c.gold, strokeWidth: 2))
            : _hits.isEmpty
                ? EmptyNote(icon: Icons.search, text: _query.text.trim().length < 2 ? 'اكتب كلمتين أو أكثر.' : 'لا نتائج.')
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _hits.length,
                    separatorBuilder: (_, _) => Divider(color: c.rule),
                    itemBuilder: (context, i) {
                      final h = _hits[i];
                      return ListTile(
                        title: Text(h.title, style: TextStyle(color: c.walnut)),
                        subtitle: Text(h.snippet, maxLines: 3, overflow: TextOverflow.ellipsis),
                        onTap: () => h.entry == null
                            ? Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(bookId: h.book.id)))
                            : openEpisode(context, h.book, h.entry!, startAt: h.at),
                      );
                    },
                  ),
      ),
    );
  }
}
