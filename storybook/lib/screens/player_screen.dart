import 'package:flutter/material.dart';

import '../main.dart';
import '../models/book.dart';
import '../models/episode.dart';
import '../services/playback.dart';
import '../services/user_data.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';

class PlayerScreen extends StatefulWidget {
  final Book book;
  final EpisodeEntry entry;
  final Duration? startAt;

  const PlayerScreen({super.key, required this.book, required this.entry, this.startAt});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> with WidgetsBindingObserver {
  EpisodeController? _controller;
  late EpisodeEntry _entry;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _entry = widget.entry;
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _open(_entry, widget.startAt, autoplay: true));
  }

  Future<void> _open(EpisodeEntry entry, Duration? start, {required bool autoplay}) async {
    final scope = AppScope.of(context);
    final old = _controller;
    setState(() {
      _loading = true;
      _error = null;
      _controller = null;
      _entry = entry;
    });
    scope.media?.detach();
    old?.dispose();
    try {
      final episode = await scope.store.loadEpisode(widget.book, entry);
      final c = EpisodeController(book: widget.book, entry: entry, episode: episode, user: scope.user);
      await c.init(startAt: start);
      if (!mounted) {
        c.dispose();
        return;
      }
      c.onFinished = _autoNext;
      scope.media?.attach(c);
      setState(() {
        _controller = c;
        _loading = false;
      });
      if (autoplay) await c.play();
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    }
  }

  void _autoNext() {
    final next = widget.book.neighbour(_entry, 1);
    if (next != null && mounted) _open(next, Duration.zero, autoplay: true);
  }

  void _goEpisode(int step) {
    final target = widget.book.neighbour(_entry, step);
    if (target != null) _open(target, null, autoplay: true);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final c = _controller;
    if (c != null && state == AppLifecycleState.paused) {
      c.user.saveProgress(c.progressKey, c.position, notify: false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final scope = AppScope.of(context);
    scope.media?.detach();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final user = AppScope.of(context).user;
    final controller = _controller;
    return Scaffold(
      body: PaperBackground(
        child: SafeArea(
          child: _error != null
              ? _ErrorPane(error: _error!, onBack: () => Navigator.of(context).pop())
              : controller == null || _loading
                  ? Center(child: CircularProgressIndicator(color: c.gold, strokeWidth: 2))
                  : PlayerView(
                      controller: controller,
                      user: user,
                      onPrevEpisode: widget.book.neighbour(_entry, -1) == null ? null : () => _goEpisode(-1),
                      onNextEpisode: widget.book.neighbour(_entry, 1) == null ? null : () => _goEpisode(1),
                    ),
        ),
      ),
    );
  }
}

/// The reading page: illustration on the top half and story text with
/// controls on the bottom half; side by side on wide screens.
class PlayerView extends StatelessWidget {
  final EpisodeController controller;
  final UserData user;
  final VoidCallback? onPrevEpisode;
  final VoidCallback? onNextEpisode;

  const PlayerView({super.key, required this.controller, required this.user, this.onPrevEpisode, this.onNextEpisode});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([controller, user]),
      builder: (context, _) => LayoutBuilder(builder: (context, box) {
        final wide = box.maxWidth >= 840 || box.maxWidth > box.maxHeight * 1.15;
        final image = _ImagePane(controller: controller, onPrevEpisode: onPrevEpisode, onNextEpisode: onNextEpisode);
        final text = _TextPane(controller: controller, user: user);
        if (wide) {
          return Row(children: [Expanded(child: image), VerticalDivider(color: c.rule, width: 1), Expanded(child: text)]);
        }
        return Column(children: [SizedBox(height: box.maxHeight * 0.5, child: image), Expanded(child: text)]);
      }),
    );
  }
}

/// Top half: the scene illustration with the episode bar and scene caption.
class _ImagePane extends StatelessWidget {
  final EpisodeController controller;
  final VoidCallback? onPrevEpisode;
  final VoidCallback? onNextEpisode;

  const _ImagePane({required this.controller, this.onPrevEpisode, this.onNextEpisode});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final book = controller.book;
    final scene = controller.scene;
    final ep = controller.episode;
    return Column(
      children: [
        SizedBox(
          height: 46,
          child: Row(
            children: [
              IconButton(
                tooltip: 'رجوع',
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(book.title, maxLines: 1, style: TextStyle(color: c.muted, fontSize: 13, height: 1.1)),
                    Text('الحلقة ${episodeOrdinal(controller.entry.number)}: ${controller.entry.title}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.walnut, fontSize: 16, height: 1.2)),
                  ],
                ),
              ),
              IconButton(tooltip: 'الحلقة السابقة', icon: const Icon(Icons.keyboard_double_arrow_right), onPressed: onPrevEpisode),
              IconButton(tooltip: 'الحلقة التالية', icon: const Icon(Icons.keyboard_double_arrow_left), onPressed: onNextEpisode),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 650),
              switchInCurve: Curves.easeOut,
              child: KeyedSubtree(
                key: ValueKey('${scene.number}|${scene.image}'),
                child: SizedBox.expand(
                  child: ArtworkFrame(
                    book: book,
                    image: scene.isClosing ? null : scene.image,
                    fallback: scene.isClosing ? _ClosingCard(controller: controller) : null,
                  ),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
          child: Row(
            children: [
              Text('المشهد ${arabicDigits(scene.number)} من ${arabicDigits(ep.scenes.length)}',
                  style: TextStyle(color: c.gold, fontSize: 15)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(scene.title,
                    textAlign: TextAlign.end,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 18, fontStyle: FontStyle.italic, color: c.ink)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ClosingCard extends StatelessWidget {
  final EpisodeController controller;

  const _ClosingCard({required this.controller});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Ornament(),
            const SizedBox(height: 8),
            Text(controller.book.title,
                style: TextStyle(fontFamily: AppTheme.display, fontSize: 44, color: c.walnut, height: 1.3)),
            if (controller.book.subtitle.isNotEmpty)
              Text(controller.book.subtitle, style: TextStyle(fontSize: 20, fontStyle: FontStyle.italic, color: c.gold)),
            const SizedBox(height: 8),
            const Ornament(),
            const SizedBox(height: 8),
            Text('نهاية الحلقة ${episodeOrdinal(controller.entry.number)}', style: TextStyle(color: c.muted, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}

/// Bottom half: the scene's story text and the playback controls.
class _TextPane extends StatelessWidget {
  final EpisodeController controller;
  final UserData user;

  const _TextPane({required this.controller, required this.user});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Column(
      children: [
        Divider(color: c.rule, height: 1),
        Expanded(
          child: user.showText
              ? _StoryText(controller: controller, user: user)
              : Center(
                  child: TextButton.icon(
                    onPressed: () => user.setShowText(true),
                    icon: const Icon(Icons.subtitles_outlined),
                    label: const Text('إظهار نص القصة'),
                  ),
                ),
        ),
        _Controls(controller: controller, user: user),
      ],
    );
  }
}

class _StoryText extends StatefulWidget {
  final EpisodeController controller;
  final UserData user;

  const _StoryText({required this.controller, required this.user});

  @override
  State<_StoryText> createState() => _StoryTextState();
}

class _StoryTextState extends State<_StoryText> {
  final _keys = <String, GlobalKey>{};
  String? _lastActive;

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final ctl = widget.controller;
    final user = widget.user;
    final scene = ctl.scene;
    final segments = ctl.episode.segmentsOfScene(scene.number);
    final active = ctl.active;
    final speaking = ctl.episode.speakingAt(ctl.position);
    if (active != null && active.id != _lastActive) {
      _lastActive = active.id;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _keys[active.id]?.currentContext;
        if (ctx != null && ctx.mounted) {
          Scrollable.ensureVisible(ctx, alignment: 0.15, duration: const Duration(milliseconds: 450), curve: Curves.easeOut);
        }
      });
    }
    final base = TextStyle(fontSize: 23 * user.fontScale, height: user.lineHeight, color: c.ink);
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 400),
      child: ListView(
        key: ValueKey(scene.number),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        children: [
          for (final s in segments)
            InkWell(
              key: _keys.putIfAbsent(s.id, GlobalKey.new),
              borderRadius: BorderRadius.circular(6),
              onTap: () => ctl.seek(s.start),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: s.id == active?.id && user.highlight ? c.highlight.withValues(alpha: 0.12) : null,
                  borderRadius: BorderRadius.circular(6),
                  border: Border(
                    right: BorderSide(color: s.id == active?.id ? c.gold : Colors.transparent, width: 2.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!s.isNarrator || segments.any((o) => !o.isNarrator))
                      Text(s.speakerName, style: TextStyle(color: c.gold, fontSize: 15 * user.fontScale)),
                    _segmentText(s, base, c, isActive: s.id == active?.id, isSpeaking: s.id == speaking?.id),
                    if (s.trailingText != null && ctl.position >= s.end)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(s.trailingText!,
                            style: base.copyWith(color: c.gold, fontStyle: FontStyle.italic, fontSize: base.fontSize! * 0.85)),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _segmentText(Segment s, TextStyle base, Hk c, {required bool isActive, required bool isSpeaking}) {
    final pos = widget.controller.position;
    final lineLevel = widget.user.highlight && isActive && s.timing == Timing.verified && s.lines.length > 1;
    if (!lineLevel) {
      final upcoming = pos < s.start;
      return Text(s.text, style: base.copyWith(color: isActive ? c.ink : (upcoming ? c.inkSoft : c.inkSoft)));
    }
    final spans = <InlineSpan>[];
    for (var i = 0; i < s.lines.length; i++) {
      final l = s.lines[i];
      final now = pos >= l.start && pos < l.end && isSpeaking;
      spans.add(TextSpan(
        text: l.text,
        style: base.copyWith(
          color: now ? c.ink : (pos >= l.end ? c.inkSoft : c.muted),
          backgroundColor: now ? c.highlight : null,
        ),
      ));
      if (i < s.lines.length - 1) spans.add(const TextSpan(text: ' '));
    }
    return Text.rich(TextSpan(children: spans));
  }
}

class _Controls extends StatelessWidget {
  final EpisodeController controller;
  final UserData user;

  const _Controls({required this.controller, required this.user});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final total = controller.duration.inMilliseconds.toDouble();
    final pos = controller.position.inMilliseconds.clamp(0, total).toDouble();
    return Container(
      decoration: BoxDecoration(color: c.parchment.withValues(alpha: 0.92), border: Border(top: BorderSide(color: c.rule))),
      padding: const EdgeInsets.fromLTRB(8, 2, 8, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Media transport keeps its universal left-to-right orientation.
          Directionality(
            textDirection: TextDirection.ltr,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(formatTime(controller.position), style: TextStyle(color: c.muted, fontSize: 13)),
                    Expanded(
                      child: Slider(
                        value: pos,
                        max: total <= 0 ? 1 : total,
                        onChanged: (v) => controller.seek(Duration(milliseconds: v.round())),
                      ),
                    ),
                    Text(formatTime(controller.duration), style: TextStyle(color: c.muted, fontSize: 13)),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    IconButton(tooltip: 'المشهد السابق', icon: const Icon(Icons.skip_previous), onPressed: controller.previousScene),
                    IconButton(
                        tooltip: 'رجوع ١٠ ثوانٍ',
                        icon: const Icon(Icons.replay_10),
                        onPressed: () => controller.skip(const Duration(seconds: -10))),
                    _PlayButton(controller: controller),
                    IconButton(
                        tooltip: 'تقديم ١٠ ثوانٍ',
                        icon: const Icon(Icons.forward_10),
                        onPressed: () => controller.skip(const Duration(seconds: 10))),
                    IconButton(tooltip: 'المشهد التالي', icon: const Icon(Icons.skip_next), onPressed: controller.nextScene),
                  ],
                ),
              ],
            ),
          ),
          Row(
            children: [
              _Chip(
                icon: Icons.speed,
                label: formatSpeed(user.speed),
                tooltip: 'سرعة التشغيل',
                onTap: () {
                  const s = UserData.speeds;
                  user.setSpeed(s[(s.indexOf(user.speed) + 1) % s.length]);
                },
              ),
              _Chip(
                icon: Icons.bookmark_add_outlined,
                label: 'علامة',
                tooltip: 'إضافة علامة',
                onTap: () async {
                  await controller.addBookmark();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('أُضيفت علامة عند ${formatTime(controller.position)}')));
                  }
                },
              ),
              _Chip(
                icon: user.showText ? Icons.subtitles_outlined : Icons.subtitles_off_outlined,
                label: 'النص',
                tooltip: 'إظهار النص أو إخفاؤه',
                onTap: () => user.setShowText(!user.showText),
              ),
              if (controller.hasMusic)
                _Chip(
                  icon: user.musicMuted ? Icons.music_off_outlined : Icons.music_note_outlined,
                  label: 'الموسيقى',
                  tooltip: 'كتم الموسيقى أو تشغيلها',
                  onTap: () => user.setMusicMuted(!user.musicMuted),
                ),
              _Chip(
                icon: Icons.text_fields,
                label: 'القراءة',
                tooltip: 'إعدادات القراءة والصوت',
                onTap: () => showModalBottomSheet<void>(
                  context: context,
                  showDragHandle: true,
                  builder: (_) => ReadingSettingsSheet(user: user, hasMusic: controller.hasMusic),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlayButton extends StatelessWidget {
  final EpisodeController controller;

  const _PlayButton({required this.controller});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Tooltip(
      message: controller.playing ? 'إيقاف مؤقت' : (controller.completed ? 'إعادة' : 'تشغيل'),
      child: Material(
        color: c.walnut,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: controller.togglePlay,
          child: SizedBox(
            width: 58,
            height: 58,
            child: Icon(
              controller.playing ? Icons.pause : (controller.completed ? Icons.replay : Icons.play_arrow),
              color: c.paper,
              size: 32,
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback onTap;

  const _Chip({required this.icon, required this.label, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Expanded(
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 21, color: c.walnut),
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.fade,
                    softWrap: false,
                    style: TextStyle(fontSize: 12.5, color: c.inkSoft, height: 1.2)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ReadingSettingsSheet extends StatelessWidget {
  final UserData user;
  final bool hasMusic;

  const ReadingSettingsSheet({super.key, required this.user, required this.hasMusic});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return ListenableBuilder(
      listenable: user,
      builder: (context, _) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          children: [
            Text('حجم الخط', style: TextStyle(color: c.muted)),
            Slider(
              value: UserData.fontScales.indexOf(user.fontScale).clamp(0, UserData.fontScales.length - 1).toDouble(),
              max: UserData.fontScales.length - 1.0,
              divisions: UserData.fontScales.length - 1,
              onChanged: (v) => user.setFontScale(UserData.fontScales[v.round()]),
            ),
            Text('تباعد الأسطر', style: TextStyle(color: c.muted)),
            Slider(value: user.lineHeight, min: 1.4, max: 2.4, divisions: 5, onChanged: user.setLineHeight),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('تظليل الجملة المسموعة'),
              subtitle: const Text('يعمل فقط حين يكون التوقيت موثّقاً'),
              value: user.highlight,
              onChanged: user.setHighlight,
            ),
            Text('مستوى صوت الحكاية', style: TextStyle(color: c.muted)),
            Slider(value: user.voiceVolume, onChanged: user.setVoiceVolume),
            if (hasMusic) ...[
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('الموسيقى الخلفية'),
                value: !user.musicMuted,
                onChanged: (v) => user.setMusicMuted(!v),
              ),
              Slider(value: user.musicVolume, onChanged: user.musicMuted ? null : user.setMusicVolume),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('المؤثرات الصوتية'),
                value: user.sfxEnabled,
                onChanged: user.setSfxEnabled,
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('الانتقال تلقائياً إلى الحلقة التالية'),
              value: user.autoNext,
              onChanged: user.setAutoNext,
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  final Object error;
  final VoidCallback onBack;

  const _ErrorPane({required this.error, required this.onBack});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const EmptyNote(icon: Icons.error_outline, text: 'تعذّر فتح هذه الحلقة.'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text('$error', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13)),
            ),
            TextButton(onPressed: onBack, child: const Text('رجوع')),
          ],
        ),
      );
}
