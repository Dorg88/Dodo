import 'package:flutter/material.dart';

import '../main.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';
import 'book_screen.dart';

/// Saved places: bookmarks inside episodes, and favourite books.
class BookmarksScreen extends StatelessWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = Hk.of(context);
    return PaperBackground(
      child: SafeArea(
        child: ListenableBuilder(
          listenable: Listenable.merge([scope.store, scope.user]),
          builder: (context, _) {
            final marks = scope.user.bookmarks;
            final favs = scope.store.books.where((b) => scope.user.isFavorite(b.id)).toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                Text('المحفوظات', style: TextStyle(fontFamily: AppTheme.display, fontSize: 34, color: c.walnut)),
                const SectionTitle('العلامات'),
                if (marks.isEmpty)
                  const EmptyNote(icon: Icons.bookmark_border, text: 'أضف علامة من زر «علامة» أثناء الاستماع.'),
                for (final m in marks)
                  Builder(builder: (context) {
                    final book = scope.store.bookById(m.bookId);
                    final entry = book?.episodeById(m.episodeId);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Icon(Icons.bookmark, color: c.gold),
                        title: Text(m.label, maxLines: 2, overflow: TextOverflow.ellipsis),
                        subtitle: Text(
                          book == null || entry == null
                              ? 'الكتاب غير متوفر'
                              : '${book.title} · الحلقة ${episodeOrdinal(entry.number)} · ${formatTime(m.position)}',
                          style: TextStyle(color: c.muted),
                        ),
                        trailing: IconButton(
                          tooltip: 'حذف العلامة',
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () => scope.user.removeBookmark(m.id),
                        ),
                        onTap: book == null || entry == null || !entry.available
                            ? null
                            : () => openEpisode(context, book, entry, startAt: m.position),
                      ),
                    );
                  }),
                const SectionTitle('الكتب المفضّلة'),
                if (favs.isEmpty) const EmptyNote(icon: Icons.favorite_border, text: 'اضغط القلب في صفحة الكتاب لإضافته.'),
                for (final b in favs)
                  ListTile(
                    leading: BookCover(book: b, width: 40),
                    title: Text(b.title),
                    subtitle: Text(b.author),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(bookId: b.id))),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
