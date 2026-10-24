import 'package:flutter/material.dart';

import '../main.dart';
import '../models/episode.dart';
import '../models/library.dart';
import '../services/settings_service.dart';
import '../services/storybook_player.dart';
import '../theme/app_theme.dart';
import '../widgets/storybook_widgets.dart';
import 'settings_screen.dart';

class PlayerScreen extends StatefulWidget {
  final Book book;
  final EpisodeEntry entry;
  final Duration? startAt;

  const PlayerScreen({super.key, required this.book, required this.entry, this.startAt});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> with WidgetsBindingObserver {
  StorybookPlayer? _player;
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final scope = AppScope.of(context);
    try {
      final episode = await scope.repository.loadEpisode(widget.entry);
      final player = StorybookPlayer(episode: episode, settings: scope.settings);
      final start = widget.startAt ?? scope.settings.progressFor(episode.progressKey);
      await player.init(startAt: start);
      if (!mounted) {
        player.dispose();
        return;
      }
      setState(() => _player = player);
      await player.play();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final p = _player;
    if (p != null && (state == AppLifecycleState.paused || state == AppLifecycleState.detached)) {
      p.settings.saveProgress(p.episode.progressKey, p.position);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = AppScope.of(context).settings;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.book.title, style: const TextStyle(fontSize: 19, color: AppColors.inkSoft)),
        actions: [
          if (_player != null)
            IconButton(
              tooltip: 'اللوحات',
              icon: const Icon(Icons.collections_outlined, color: AppColors.sage),
              onPressed: () => _showScenes(context, _player!),
            ),
          IconButton(
            tooltip: 'الإعدادات',
            icon: const Icon(Icons.tune, color: AppColors.sage),
            onPressed: () => Navigator.of(context).push(fadeRoute(const SettingsScreen())),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? Center(child: Text('تعذّر تحميل الحلقة\n$_error', textAlign: TextAlign.center))
            : _player == null
                ? const Center(child: CircularProgressIndicator(color: AppColors.sage, strokeWidth: 1.5))
                : ListenableBuilder(
                    listenable: Listenable.merge([_player!, settings]),
                    builder: (context, _) => PlayerPage(player: _player!, settings: settings),
                  ),
      ),
    );
  }
}

/// The storybook page itself; public so it can be rendered in tests.
class PlayerPage extends StatelessWidget {
  final StorybookPlayer player;
  final SettingsService settings;

  const PlayerPage({super.key, required this.player, required this.settings});

  @override
  Widget build(BuildContext context) {
    final ep = player.episode;
    final scene = player.scene;
    final segment = player.segment;
    final position = player.position;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          children: [
            const Rule(),
            MetaBand(start: 'الكتاب الأول · ${ep.author}', end: 'الحلقة ${arabicDigits(ep.number)}'),
            Plate(
              scene: scene,
              total: ep.scenes.length,
              closingTitle: ep.bookTitle,
              closingSubtitle: ep.bookSubtitle,
              closingNote: 'نهاية الحلقة ${episodeOrdinal(ep.number)}',
            ),
            const SizedBox(height: 4),
            const Rule(vertical: 6),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('${ep.genre}\n${ep.location}', style: AppText.label.copyWith(color: AppColors.sage)),
            ),
            const Rule(vertical: 6),
            MetaBand(start: ep.bookTitle, end: 'الحلقة ${episodeOrdinal(ep.number)}: ${ep.title}'),
            const Rule(),
            const SizedBox(height: 18),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              layoutBuilder: startAlignedLayout,
              child: Text.rich(
                key: ValueKey(segment?.id),
                TextSpan(children: [
                  TextSpan(text: segment?.speakerName ?? '', style: AppText.speaker),
                  if ((segment?.direction ?? '').isNotEmpty)
                    TextSpan(text: ' — ${segment!.direction}', style: AppText.direction),
                ]),
              ),
            ),
            const SizedBox(height: 10),
            _Transport(player: player),
            const SizedBox(height: 6),
            const Rule(),
            const SizedBox(height: 22),
            if (segment == null)
              const SizedBox.shrink()
            else if (settings.showCaptions)
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 450),
                layoutBuilder: startAlignedLayout,
                child: StoryText(
                  key: ValueKey(segment.id),
                  segment: segment,
                  position: position,
                  scale: settings.fontScale,
                ),
              )
            else
              const Text('النص مخفي — يمكن إظهاره من زر «النص» أو من الإعدادات.', style: AppText.label),
          ],
        ),
      ),
    );
  }
}

class _Transport extends StatelessWidget {
  final StorybookPlayer player;

  const _Transport({required this.player});

  @override
  Widget build(BuildContext context) {
    final settings = player.settings;
    final total = player.duration.inMilliseconds.toDouble();
    final pos = player.position.inMilliseconds.clamp(0, total).toDouble();
    final speedLabel = '${arabicDigits(player.speed.toString().replaceAll('.', '٫'))}×';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text('${formatTime(player.position)} / ${formatTime(player.duration)}', style: AppText.labelSage.copyWith(fontSize: 17)),
            const Text('  ·  ', style: AppText.labelSage),
            TextAction(
              label: player.playing ? 'إيقاف مؤقت' : (player.completed ? 'إعادة الاستماع' : 'تشغيل'),
              onTap: player.togglePlay,
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(overlayShape: SliderComponentShape.noOverlay),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Slider(
              value: pos,
              max: total,
              onChanged: (v) => player.seek(Duration(milliseconds: v.round())),
            ),
          ),
        ),
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextAction(label: 'السابق', icon: Icons.arrow_back_ios, onTap: player.previousScene),
            _PlayButton(player: player),
            TextAction(label: 'التالي', icon: Icons.arrow_forward_ios, onTap: player.nextScene),
            TextAction(
              label: speedLabel,
              tooltip: 'سرعة التشغيل',
              onTap: () {
                const speeds = SettingsService.speeds;
                final i = speeds.indexOf(player.speed);
                player.setSpeed(speeds[(i + 1) % speeds.length]);
              },
            ),
            TextAction(
              label: 'أ',
              icon: Icons.format_size,
              tooltip: 'حجم الخط',
              onTap: () {
                const scales = SettingsService.fontScales;
                final i = scales.indexOf(settings.fontScale);
                settings.setFontScale(scales[(i + 1) % scales.length]);
              },
            ),
            TextAction(
              label: 'النص',
              icon: settings.showCaptions ? Icons.subtitles_outlined : Icons.subtitles_off_outlined,
              tooltip: 'إظهار النص أو إخفاؤه',
              onTap: () => settings.setShowCaptions(!settings.showCaptions),
            ),
          ],
        ),
      ],
    );
  }
}

class _PlayButton extends StatelessWidget {
  final StorybookPlayer player;

  const _PlayButton({required this.player});

  @override
  Widget build(BuildContext context) => Tooltip(
        message: player.playing ? 'إيقاف مؤقت' : 'تشغيل',
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: player.togglePlay,
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.sage)),
            child: Icon(player.playing ? Icons.pause : Icons.play_arrow, color: AppColors.sage, size: 28),
          ),
        ),
      );
}

void _showScenes(BuildContext context, StorybookPlayer player) {
  final ep = player.episode;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.92,
      builder: (_, controller) => ListView.separated(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        itemCount: ep.scenes.length,
        separatorBuilder: (_, _) => const Rule(),
        itemBuilder: (_, i) {
          final sc = ep.scenes[i];
          final current = i == player.sceneIndex;
          return InkWell(
            onTap: () {
              Navigator.of(sheetContext).pop();
              player.goToScene(i);
              if (!player.playing) player.play();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  SizedBox(
                    width: 112,
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: sc.isClosing
                          ? Container(
                              color: AppColors.plate,
                              alignment: Alignment.center,
                              child: const Ornament(),
                            )
                          : Image.asset(sc.image, fit: BoxFit.cover, cacheWidth: 320),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('اللوحة ${arabicDigits(sc.number)} · ${formatTime(sc.start)}', style: AppText.labelSage),
                        Text(
                          sc.title,
                          style: TextStyle(fontSize: 20, color: current ? AppColors.sage : AppColors.ink),
                        ),
                        Text(_sceneSpeakers(ep, sc), style: AppText.label),
                      ],
                    ),
                  ),
                  if (current) const Icon(Icons.graphic_eq, color: AppColors.sage, size: 20),
                ],
              ),
            ),
          );
        },
      ),
    ),
  );
}

String _sceneSpeakers(Episode ep, Scene sc) =>
    ep.segmentsOfScene(sc.number).map((s) => s.speakerName).toSet().join('، ');
