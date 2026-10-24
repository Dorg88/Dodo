import 'package:flutter/material.dart';

import '../main.dart';
import '../models/library.dart';
import '../theme/app_theme.dart';
import '../widgets/storybook_widgets.dart';
import 'home_screen.dart';

class EpisodesScreen extends StatelessWidget {
  const EpisodesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('الحلقات')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListenableBuilder(
              listenable: scope.settings,
              builder: (context, _) => ListView(
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
                children: [
                  for (final book in scope.library.books) ...[
                    const Rule(),
                    MetaBand(start: book.title, end: book.author, style: AppText.labelSage),
                    const Rule(),
                    for (final entry in book.episodes) ...[
                      _EpisodeTile(book: book, entry: entry),
                      const Rule(),
                    ],
                    const SizedBox(height: 24),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EpisodeTile extends StatelessWidget {
  final Book book;
  final EpisodeEntry entry;

  const _EpisodeTile({required this.book, required this.entry});

  @override
  Widget build(BuildContext context) {
    final settings = AppScope.of(context).settings;
    final key = '${book.id}/${entry.id}';
    final progress = settings.progressFor(key);
    final finished = settings.finished(key);
    final fraction = entry.duration.inMilliseconds == 0
        ? 0.0
        : (progress.inMilliseconds / entry.duration.inMilliseconds).clamp(0.0, 1.0);
    final muted = !entry.available;

    return InkWell(
      onTap: muted ? null : () => openEpisode(context, book, entry, startAt: progress),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 56,
              child: Text(
                arabicDigits(entry.number.toString().padLeft(2, '0')),
                style: TextStyle(fontSize: 32, color: muted ? AppColors.sageLight : AppColors.sage, height: 1.1),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('الحلقة ${episodeOrdinal(entry.number)}', style: AppText.label),
                  Text(
                    entry.title,
                    style: TextStyle(fontSize: 24, color: muted ? AppColors.muted : AppColors.ink),
                  ),
                  const SizedBox(height: 4),
                  Text(entry.summary, style: AppText.label.copyWith(color: AppColors.inkSoft)),
                  if (!muted) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: LinearProgressIndicator(
                            value: finished && progress == Duration.zero ? 1 : fraction,
                            minHeight: 1.5,
                            backgroundColor: AppColors.rule,
                            color: AppColors.sage,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          finished && progress == Duration.zero
                              ? 'اكتملت · ${formatTime(entry.duration)}'
                              : '${formatTime(progress)} / ${formatTime(entry.duration)}',
                          style: AppText.label,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 8, top: 4),
              child: Text(muted ? 'قريبًا' : 'استمع', style: muted ? AppText.label : AppText.control),
            ),
          ],
        ),
      ),
    );
  }
}
