import 'package:flutter/material.dart';

import '../main.dart';
import '../models/book.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';
import 'book_screen.dart';
import 'search_screen.dart';

class HomeScreen extends StatelessWidget {
  final VoidCallback onOpenLibrary;

  const HomeScreen({super.key, required this.onOpenLibrary});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = Hk.of(context);
    return PaperBackground(
      child: SafeArea(
        child: ListenableBuilder(
          listenable: Listenable.merge([scope.store, scope.user]),
          builder: (context, _) {
            final books = scope.store.books;
            final favs = books.where((b) => scope.user.isFavorite(b.id)).toList();
            final recent = _recent(context);
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                Row(
                  children: [
                    IconButton(
                      tooltip: 'بحث',
                      icon: const Icon(Icons.search),
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
                    ),
                    const Expanded(child: Center(child: HikayaLogo())),
                    const SizedBox(width: 48),
                  ],
                ),
                Center(
                  child: Text('كتب مصوّرة ومسموعة', style: TextStyle(color: c.muted, fontSize: 17)),
                ),
                if (recent.isNotEmpty) ...[
                  const SectionTitle('متابعة الاستماع'),
                  for (final r in recent) _ContinueCard(item: r),
                ],
                if (favs.isNotEmpty) ...[
                  const SectionTitle('المفضّلة'),
                  _Shelf(books: favs),
                ],
                SectionTitle(
                  'مكتبتي',
                  trailing: TextButton(onPressed: onOpenLibrary, child: const Text('عرض الكل')),
                ),
                if (books.isEmpty)
                  const EmptyNote(icon: Icons.auto_stories, text: 'لا توجد كتب بعد. استورد كتاباً من صفحة المكتبة.')
                else
                  _Shelf(books: books),
              ],
            );
          },
        ),
      ),
    );
  }

  List<_Recent> _recent(BuildContext context) {
    final scope = AppScope.of(context);
    final out = <_Recent>[];
    for (final key in scope.user.recent) {
      final parts = key.split('/');
      if (parts.length != 2) continue;
      final book = scope.store.bookById(parts[0]);
      final entry = book?.episodeById(parts[1]);
      if (book == null || entry == null || !entry.available) continue;
      final pos = scope.user.progress(key);
      if (pos <= Duration.zero) continue;
      out.add(_Recent(book, entry, pos));
      if (out.length == 3) break;
    }
    return out;
  }
}

class _Recent {
  final Book book;
  final EpisodeEntry entry;
  final Duration position;

  _Recent(this.book, this.entry, this.position);
}

class _ContinueCard extends StatelessWidget {
  final _Recent item;

  const _ContinueCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final total = item.entry.duration.inMilliseconds;
    final frac = total == 0 ? 0.0 : (item.position.inMilliseconds / total).clamp(0.0, 1.0);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: () => openEpisode(context, item.book, item.entry, startAt: item.position),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              BookCover(book: item.book, width: 54),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.book.title, style: TextStyle(color: c.muted, fontSize: 15)),
                    Text(
                      'الحلقة ${episodeOrdinal(item.entry.number)}: ${item.entry.title}',
                      style: TextStyle(fontSize: 19, color: c.ink),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: frac, minHeight: 2, color: c.gold, backgroundColor: c.rule),
                    const SizedBox(height: 4),
                    Text('${formatTime(item.position)} / ${formatTime(item.entry.duration)}',
                        style: TextStyle(color: c.muted, fontSize: 14)),
                  ],
                ),
              ),
              Icon(Icons.play_circle_outline, color: c.walnut, size: 36),
            ],
          ),
        ),
      ),
    );
  }
}

class _Shelf extends StatelessWidget {
  final List<Book> books;

  const _Shelf({required this.books});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return SizedBox(
      height: 250,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: books.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final b = books[i];
          return GestureDetector(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(bookId: b.id))),
            child: SizedBox(
              width: 140,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  BookCover(book: b, width: 140),
                  const SizedBox(height: 6),
                  Text(b.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted, fontSize: 14)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
