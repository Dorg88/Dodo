import 'package:flutter/material.dart';

import '../main.dart';
import '../models/book.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';

/// Book detail: cover, description, favourite toggle and the episode list.
class BookScreen extends StatelessWidget {
  final String bookId;

  const BookScreen({super.key, required this.bookId});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = Hk.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([scope.store, scope.user]),
      builder: (context, _) {
        final book = scope.store.bookById(bookId);
        if (book == null) {
          return const Scaffold(body: EmptyNote(icon: Icons.menu_book, text: 'هذا الكتاب لم يعد في المكتبة.'));
        }
        final fav = scope.user.isFavorite(book.id);
        final planned = book.plannedEpisodes;
        return Scaffold(
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            actions: [
              IconButton(
                tooltip: fav ? 'إزالة من المفضّلة' : 'إضافة إلى المفضّلة',
                icon: Icon(fav ? Icons.favorite : Icons.favorite_border, color: fav ? c.gold : c.walnut),
                onPressed: () => scope.user.toggleFavorite(book.id),
              ),
            ],
          ),
          body: PaperBackground(
            child: SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  Center(child: BookCover(book: book, width: 170)),
                  const SizedBox(height: 16),
                  Text(book.title,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontFamily: AppTheme.display, fontSize: 38, color: c.walnut, height: 1.3)),
                  if (book.subtitle.isNotEmpty)
                    Text(book.subtitle,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 20, fontStyle: FontStyle.italic, color: c.gold)),
                  Text(book.author, textAlign: TextAlign.center, style: TextStyle(color: c.muted, fontSize: 17)),
                  const SizedBox(height: 10),
                  const Center(child: Ornament()),
                  if (book.description.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(book.description, style: TextStyle(fontSize: 18, height: 1.7, color: c.inkSoft)),
                  ],
                  SectionTitle(
                    'الحلقات',
                    trailing: Text(
                      planned != null && planned > book.available.length
                          ? '${arabicDigits(book.available.length)} من ${arabicDigits(planned)} متاحة'
                          : '${arabicDigits(book.available.length)} حلقة',
                      style: TextStyle(color: c.muted, fontSize: 15),
                    ),
                  ),
                  for (final e in book.episodes) _EpisodeRow(book: book, entry: e),
                  if (planned != null && planned > book.episodes.length)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        'بقية الحلقات تُضاف عند استيراد النسخة الكاملة من الكتاب.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: c.muted, fontSize: 15),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _EpisodeRow extends StatelessWidget {
  final Book book;
  final EpisodeEntry entry;

  const _EpisodeRow({required this.book, required this.entry});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = Hk.of(context);
    final key = book.progressKey(entry);
    final pos = scope.user.progress(key);
    final done = scope.user.finished(key);
    final total = entry.duration.inMilliseconds;
    final frac = done && pos == Duration.zero ? 1.0 : (total == 0 ? 0.0 : (pos.inMilliseconds / total).clamp(0.0, 1.0));
    return InkWell(
      onTap: entry.available ? () => openEpisode(context, book, entry, startAt: pos) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule))),
        child: Row(
          children: [
            SizedBox(
              width: 46,
              child: Text(arabicDigits(entry.number.toString().padLeft(2, '0')),
                  style: TextStyle(fontSize: 26, color: entry.available ? c.gold : c.rule)),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.title, style: TextStyle(fontSize: 19, color: entry.available ? c.ink : c.muted)),
                  if (entry.available && entry.underReview)
                    Container(
                      margin: const EdgeInsets.only(top: 2, bottom: 2),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(border: Border.all(color: c.gold), borderRadius: BorderRadius.circular(4)),
                      child: Text('قيد المراجعة', style: TextStyle(color: c.gold, fontSize: 12)),
                    ),
                  if (entry.summary.isNotEmpty)
                    Text(entry.summary,
                        maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted, fontSize: 14)),
                  if (entry.available) ...[
                    const SizedBox(height: 6),
                    LinearProgressIndicator(value: frac, minHeight: 2, color: c.gold, backgroundColor: c.rule),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            entry.available
                ? Column(
                    children: [
                      Icon(done ? Icons.check_circle_outline : Icons.play_circle_outline, color: c.walnut),
                      Text(formatTime(entry.duration), style: TextStyle(color: c.muted, fontSize: 13)),
                    ],
                  )
                : Text('قريباً', style: TextStyle(color: c.muted)),
          ],
        ),
      ),
    );
  }
}
