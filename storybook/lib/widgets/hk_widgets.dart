import 'dart:io';

import 'package:flutter/material.dart';

import '../models/book.dart';
import '../theme/app_theme.dart';

ImageProvider? bookImage(Book book, String? relative) {
  if (relative == null) return null;
  final path = book.location.resolve(relative);
  return book.location.bundled ? AssetImage(path) : FileImage(File(path));
}

/// Paper background with a faint, original grain texture.
class PaperBackground extends StatelessWidget {
  final Widget child;

  const PaperBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: c.paper,
        image: DecorationImage(image: AssetImage(c.texture), repeat: ImageRepeat.repeat, opacity: 0.9),
      ),
      // Transparent Material so ink ripples paint above the paper.
      child: Material(type: MaterialType.transparency, child: child),
    );
  }
}

/// The حكايا wordmark in Ruqaa calligraphy with a gold flourish.
class HikayaLogo extends StatelessWidget {
  final double size;

  const HikayaLogo({super.key, this.size = 44});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final wordmark = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('حكايا', style: TextStyle(fontFamily: AppTheme.display, fontSize: size, color: c.walnut, height: 1.3)),
        Ornament(width: size * 1.4),
      ],
    );
    // The official HIKAYA logo has dark lettering, so it is used on light
    // paper; the gold calligraphic wordmark stands in on the dark theme.
    if (Theme.of(context).brightness == Brightness.dark) return wordmark;
    return Image.asset(
      'assets/brand/logo_hikaya.png',
      height: size * 3,
      filterQuality: FilterQuality.medium,
      semanticLabel: 'حكايا',
      errorBuilder: (_, _, _) => wordmark,
    );
  }
}

class Ornament extends StatelessWidget {
  final double width;

  const Ornament({super.key, this.width = 56});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(width: width, child: Divider(color: c.gold.withValues(alpha: 0.6))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: RotationTransition(
            turns: const AlwaysStoppedAnimation(1 / 8),
            child: SizedBox(width: 7, height: 7, child: ColoredBox(color: c.gold)),
          ),
        ),
        SizedBox(width: width, child: Divider(color: c.gold.withValues(alpha: 0.6))),
      ],
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final Widget? trailing;

  const SectionTitle(this.text, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
      child: Row(
        children: [
          Container(width: 3, height: 20, color: c.gold),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 21, color: c.walnut, fontWeight: FontWeight.w700))),
          ?trailing,
        ],
      ),
    );
  }
}

/// A book cover: the cover art in a gilt frame, or a typographic cover when
/// the package has no image.
class BookCover extends StatelessWidget {
  final Book book;
  final double width;

  const BookCover({super.key, required this.book, this.width = 150});

  @override
  Widget build(BuildContext context) {
    // A cover is a physical object: walnut leather and gold in both themes.
    const c = Hk.light;
    final img = bookImage(book, book.cover);
    return Container(
      width: width,
      height: width * 1.42,
      decoration: BoxDecoration(
        color: c.walnut,
        borderRadius: const BorderRadius.horizontal(left: Radius.circular(3), right: Radius.circular(8)),
        boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 10, offset: Offset(0, 4))],
      ),
      padding: const EdgeInsets.all(5),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: c.gold, width: 1.2),
          borderRadius: BorderRadius.circular(4),
          color: c.parchment,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Expanded(
              child: img == null
                  ? Center(child: Icon(Icons.auto_stories, color: c.gold, size: width * 0.3))
                  : Image(image: img, fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, _, _) => const SizedBox()),
            ),
            Container(
              width: double.infinity,
              color: c.walnut,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
              child: Text(
                book.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: c.paper, fontSize: width * 0.11, height: 1.3, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A static illustration shown whole (never cropped, stretched or animated)
/// on a parchment matte inside a fine frame.
class ArtworkFrame extends StatelessWidget {
  final Book book;
  final String? image;
  final Widget? fallback;

  const ArtworkFrame({super.key, required this.book, required this.image, this.fallback});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    final provider = bookImage(book, image);
    final empty = fallback ??
        Center(child: Icon(Icons.image_not_supported_outlined, color: c.muted.withValues(alpha: 0.6), size: 40));
    return Container(
      decoration: BoxDecoration(color: c.parchment, border: Border.all(color: c.frame)),
      padding: const EdgeInsets.all(6),
      child: provider == null
          ? empty
          : Center(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: c.frame.withValues(alpha: 0.8), width: 0.8),
                  boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 6, offset: Offset(0, 2))],
                ),
                child: Image(
                  image: provider,
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.medium,
                  errorBuilder: (_, _, _) => empty,
                ),
              ),
            ),
    );
  }
}

class EmptyNote extends StatelessWidget {
  final IconData icon;
  final String text;

  const EmptyNote({super.key, required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 44, color: c.gold),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: TextStyle(color: c.muted, fontSize: 18)),
        ],
      ),
    );
  }
}
