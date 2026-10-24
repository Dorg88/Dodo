import 'package:flutter/material.dart';

import '../models/episode.dart';
import '../theme/app_theme.dart';

/// AnimatedSwitcher layout that keeps children at the start edge (the
/// default centres them, which misplaces short right-to-left lines).
Widget startAlignedLayout(Widget? current, List<Widget> previous) => Stack(
      alignment: AlignmentDirectional.topStart,
      children: [...previous, ?current],
    );

/// Hairline rule used between the page's typographic bands.
class Rule extends StatelessWidget {
  final double vertical;

  const Rule({super.key, this.vertical = 0});

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.symmetric(vertical: vertical),
        child: const Divider(),
      );
}

/// A band with text at the start and end of the line, between two rules.
class MetaBand extends StatelessWidget {
  final String start;
  final String end;
  final TextStyle style;

  const MetaBand({super.key, required this.start, this.end = '', this.style = AppText.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text(start, style: style)),
            if (end.isNotEmpty) Text(end, style: style),
          ],
        ),
      );
}

/// The mounted illustration "plate": a static image on a matte inside a thin
/// frame, captioned with the plate number and scene title. Images are shown
/// whole (never cropped, zoomed or animated) inside a fixed 16:9 window so
/// the page does not jump between scenes.
class Plate extends StatelessWidget {
  final Scene scene;
  final int total;
  final String closingTitle;
  final String closingSubtitle;
  final String closingNote;

  const Plate({
    super.key,
    required this.scene,
    required this.total,
    this.closingTitle = '',
    this.closingSubtitle = '',
    this.closingNote = '',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.plate,
        border: Border.all(color: AppColors.plateBorder),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 700),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: KeyedSubtree(
                key: ValueKey('${scene.number}-${scene.image}'),
                child: scene.isClosing
                    ? ClosingPage(title: closingTitle, subtitle: closingSubtitle, note: closingNote)
                    : PlateImage(asset: scene.image),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text('اللوحة ${arabicDigits(scene.number)} من ${arabicDigits(total)}', style: AppText.labelSage),
                const SizedBox(width: 12),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 500),
                    child: Text(
                      scene.title,
                      key: ValueKey(scene.number),
                      style: AppText.caption,
                      textAlign: TextAlign.end,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
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

class PlateImage extends StatelessWidget {
  final String asset;

  const PlateImage({super.key, required this.asset});

  @override
  Widget build(BuildContext context) => Center(
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.plateBorder, width: 0.8),
            boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 2))],
          ),
          child: Image.asset(asset, fit: BoxFit.contain, filterQuality: FilterQuality.medium),
        ),
      );
}

/// Typographic closing page shown in place of an illustration.
class ClosingPage extends StatelessWidget {
  final String title;
  final String subtitle;
  final String note;

  const ClosingPage({super.key, required this.title, required this.subtitle, required this.note});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.paper,
        border: Border.all(color: AppColors.plateBorder, width: 0.8),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Ornament(),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(fontSize: 46, color: AppColors.navy, height: 1.3)),
              Text(subtitle, style: const TextStyle(fontSize: 22, fontStyle: FontStyle.italic, color: AppColors.sage)),
              const SizedBox(height: 12),
              const Ornament(),
              const SizedBox(height: 10),
              Text(note, style: AppText.label),
            ],
          ),
        ),
      ),
    );
  }
}

class Ornament extends StatelessWidget {
  const Ornament({super.key});

  @override
  Widget build(BuildContext context) => const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: 48, child: Divider(color: AppColors.sageLight)),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 10),
            child: RotationTransition(
              turns: AlwaysStoppedAnimation(1 / 8),
              child: SizedBox(width: 7, height: 7, child: ColoredBox(color: AppColors.amber)),
            ),
          ),
          SizedBox(width: 48, child: Divider(color: AppColors.sageLight)),
        ],
      );
}

/// The active passage, with the line being spoken in full ink, finished
/// lines softened and upcoming lines faint.
class StoryText extends StatelessWidget {
  final Segment segment;
  final Duration position;
  final double scale;

  const StoryText({super.key, required this.segment, required this.position, required this.scale});

  @override
  Widget build(BuildContext context) {
    final base = AppText.story(scale);
    final spans = <InlineSpan>[];
    for (var i = 0; i < segment.lines.length; i++) {
      final line = segment.lines[i];
      final Color color;
      if (position >= line.start && position < line.end) {
        color = AppColors.ink;
      } else if (position >= line.end) {
        color = AppColors.inkSoft;
      } else {
        color = AppColors.muted.withValues(alpha: 0.75);
      }
      spans.add(TextSpan(text: line.text, style: base.copyWith(color: color)));
      if (i < segment.lines.length - 1) spans.add(TextSpan(text: ' ', style: base));
    }
    final trailing = segment.trailingText;
    if (trailing != null && position >= segment.end) {
      spans.add(TextSpan(
        text: '\n\n$trailing',
        style: base.copyWith(color: AppColors.sage, fontStyle: FontStyle.italic, fontSize: base.fontSize! * 0.85),
      ));
    }
    return Text.rich(TextSpan(children: spans), textAlign: TextAlign.start);
  }
}

/// Small text-style button in the sage accent, matching the page typography.
class TextAction extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final String? tooltip;

  const TextAction({super.key, required this.label, this.onTap, this.icon, this.tooltip});

  @override
  Widget build(BuildContext context) {
    final color = onTap == null ? AppColors.sageLight : AppColors.sage;
    final child = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon, size: 20, color: color),
            if (icon != null && label.isNotEmpty) const SizedBox(width: 4),
            if (label.isNotEmpty) Text(label, style: AppText.control.copyWith(color: color)),
          ],
        ),
      ),
    );
    return tooltip == null ? child : Tooltip(message: tooltip!, child: child);
  }
}

/// Outlined, book-like button used on the home page.
class PaperButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool primary;

  const PaperButton({super.key, required this.label, this.onPressed, this.primary = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: primary ? AppColors.sage : Colors.transparent,
          foregroundColor: primary ? AppColors.paper : AppColors.sage,
          disabledForegroundColor: AppColors.sageLight,
          side: BorderSide(color: onPressed == null ? AppColors.rule : AppColors.sage),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2))),
          padding: const EdgeInsets.symmetric(vertical: 14),
          textStyle: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 20),
        ),
        child: Text(label),
      ),
    );
  }
}
