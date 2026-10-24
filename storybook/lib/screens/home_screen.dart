import 'package:flutter/material.dart';

import '../main.dart';
import '../models/library.dart';
import '../services/settings_service.dart';
import '../theme/app_theme.dart';
import '../widgets/storybook_widgets.dart';
import 'episodes_screen.dart';
import 'player_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final book = scope.library.books.first;
    final settings = scope.settings;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListenableBuilder(
              listenable: settings,
              builder: (context, _) {
                final resume = _resumeTarget(scope.library, settings);
                final first = book.firstAvailable;
                return ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextAction(
                          label: '',
                          icon: Icons.tune,
                          tooltip: 'الإعدادات',
                          onTap: () => Navigator.of(context).push(fadeRoute(const SettingsScreen())),
                        ),
                      ],
                    ),
                    const Rule(),
                    MetaBand(start: '${book.volumeLabel} · ${book.author}', end: 'كتاب صوتي مصوّر'),
                    const Rule(),
                    const SizedBox(height: 18),
                    _Cover(book: book),
                    const SizedBox(height: 30),
                    Text(
                      book.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 54, color: AppColors.navy, height: 1.2),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      book.subtitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 24, fontStyle: FontStyle.italic, color: AppColors.sage),
                    ),
                    const SizedBox(height: 6),
                    Text(book.author, textAlign: TextAlign.center, style: AppText.label),
                    const SizedBox(height: 18),
                    const Center(child: Ornament()),
                    const SizedBox(height: 26),
                    PaperButton(
                      label: 'ابدأ الاستماع',
                      primary: true,
                      onPressed: first == null
                          ? null
                          : () => openEpisode(context, book, first, startAt: Duration.zero),
                    ),
                    const SizedBox(height: 12),
                    PaperButton(
                      label: resume == null
                          ? 'متابعة الاستماع'
                          : 'متابعة الاستماع · ${formatTime(resume.$3)}',
                      onPressed: resume == null
                          ? null
                          : () => openEpisode(context, resume.$1, resume.$2, startAt: resume.$3),
                    ),
                    const SizedBox(height: 12),
                    PaperButton(
                      label: 'الحلقات',
                      onPressed: () => Navigator.of(context).push(fadeRoute(const EpisodesScreen())),
                    ),
                    const SizedBox(height: 30),
                    const Rule(),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 14),
                      child: Text(
                        'معالجة درامية مستوحاة من كتاب «ثم اهتديت»؛ بعض الحوار كُتب للعرض الدرامي وليس نقلاً حرفياً عن المؤلف.',
                        style: AppText.label,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  (Book, EpisodeEntry, Duration)? _resumeTarget(Library library, SettingsService settings) {
    final key = settings.lastEpisodeKey;
    if (key == null) return null;
    final parts = key.split('/');
    if (parts.length != 2) return null;
    final book = library.bookById(parts[0]);
    final entry = book?.episodeById(parts[1]);
    if (book == null || entry == null || !entry.available) return null;
    final position = settings.progressFor(key);
    if (position <= Duration.zero) return null;
    return (book, entry, position);
  }
}

class _Cover extends StatelessWidget {
  final Book book;

  const _Cover({required this.book});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: AppColors.plate, border: Border.all(color: AppColors.plateBorder)),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Column(
        children: [
          AspectRatio(aspectRatio: 16 / 9, child: PlateImage(asset: book.cover)),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 2),
            child: Row(
              children: [
                const Text('الغلاف', style: AppText.labelSage),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    book.coverCaption,
                    style: AppText.caption,
                    textAlign: TextAlign.end,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> openEpisode(BuildContext context, Book book, EpisodeEntry entry, {Duration? startAt}) {
  return Navigator.of(context).push(fadeRoute(PlayerScreen(book: book, entry: entry, startAt: startAt)));
}
