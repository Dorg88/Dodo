import 'package:flutter/material.dart';

/// HIKAYA palette: ivory paper, parchment, antique gold and walnut brown.
/// Each colour has a light and a dark (lamplit library) variant.
@immutable
class Hk extends ThemeExtension<Hk> {
  final Color paper;
  final Color parchment;
  final Color frame;
  final Color rule;
  final Color ink;
  final Color inkSoft;
  final Color muted;
  final Color gold;
  final Color walnut;
  final Color highlight;
  final String texture;

  const Hk({
    required this.paper,
    required this.parchment,
    required this.frame,
    required this.rule,
    required this.ink,
    required this.inkSoft,
    required this.muted,
    required this.gold,
    required this.walnut,
    required this.highlight,
    required this.texture,
  });

  static const light = Hk(
    paper: Color(0xFFF6EFE0),
    parchment: Color(0xFFEFE4CC),
    frame: Color(0xFFD3C09A),
    rule: Color(0xFFDCCDAE),
    ink: Color(0xFF2E2419),
    inkSoft: Color(0xFF5C4C3A),
    muted: Color(0xFF8E7D66),
    gold: Color(0xFFA9844C),
    walnut: Color(0xFF5B3A24),
    highlight: Color(0x33B08D57),
    texture: 'assets/ui/paper_light.png',
  );

  static const dark = Hk(
    paper: Color(0xFF1E1712),
    parchment: Color(0xFF2A2018),
    frame: Color(0xFF5A4630),
    rule: Color(0xFF3E3022),
    ink: Color(0xFFEFE5D1),
    inkSoft: Color(0xFFC9BBA2),
    muted: Color(0xFF9A8B74),
    gold: Color(0xFFCDA769),
    walnut: Color(0xFFD9B98C),
    highlight: Color(0x33CDA769),
    texture: 'assets/ui/paper_dark.png',
  );

  static Hk of(BuildContext context) => Theme.of(context).extension<Hk>()!;

  @override
  Hk copyWith() => this;

  @override
  Hk lerp(ThemeExtension<Hk>? other, double t) => t < 0.5 ? this : (other as Hk? ?? this);
}

class AppTheme {
  static const body = 'Amiri';
  static const display = 'ArefRuqaa';

  static ThemeData light() => _build(Hk.light, Brightness.light);
  static ThemeData dark() => _build(Hk.dark, Brightness.dark);

  static ThemeData _build(Hk c, Brightness b) {
    final scheme = ColorScheme.fromSeed(
      seedColor: c.gold,
      brightness: b,
      surface: c.paper,
      primary: c.walnut,
      secondary: c.gold,
      onSurface: c.ink,
    );
    final base = ThemeData(useMaterial3: true, fontFamily: body, colorScheme: scheme, brightness: b);
    return base.copyWith(
      scaffoldBackgroundColor: c.paper,
      extensions: [c],
      textTheme: base.textTheme.apply(bodyColor: c.ink, displayColor: c.ink),
      iconTheme: IconThemeData(color: c.walnut),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: c.walnut,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(fontFamily: body, fontSize: 21, color: c.walnut),
      ),
      dividerTheme: DividerThemeData(color: c.rule, thickness: 1, space: 1),
      sliderTheme: SliderThemeData(
        trackHeight: 2,
        activeTrackColor: c.gold,
        inactiveTrackColor: c.rule,
        thumbColor: c.walnut,
        overlayColor: c.highlight,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.paper : c.muted),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.gold : c.rule),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      cardTheme: CardThemeData(
        color: c.parchment,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: BorderSide(color: c.frame)),
      ),
      bottomSheetTheme: BottomSheetThemeData(backgroundColor: c.paper, surfaceTintColor: Colors.transparent),
      dialogTheme: DialogThemeData(backgroundColor: c.paper, surfaceTintColor: Colors.transparent),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.parchment,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: c.frame)),
        enabledBorder:
            OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: c.frame)),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: PageTurnTransitionsBuilder(),
        TargetPlatform.iOS: PageTurnTransitionsBuilder(),
        TargetPlatform.linux: PageTurnTransitionsBuilder(),
        TargetPlatform.macOS: PageTurnTransitionsBuilder(),
      }),
    );
  }
}

/// A restrained "turning page": the new page slides in from the reading
/// edge with a soft fade and a slight perspective tilt.
class PageTurnTransitionsBuilder extends PageTransitionsBuilder {
  const PageTurnTransitionsBuilder();

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation,
      Animation<double> secondaryAnimation, Widget child) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final curve = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return AnimatedBuilder(
      animation: curve,
      child: child,
      builder: (context, child) {
        final t = 1 - curve.value;
        return Opacity(
          opacity: curve.value.clamp(0.0, 1.0),
          child: Transform(
            alignment: rtl ? Alignment.centerRight : Alignment.centerLeft,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0012)
              ..rotateY((rtl ? -1 : 1) * t * 0.35)
              ..translateByDouble((rtl ? -1 : 1) * t * 40, 0, 0, 1),
            child: child,
          ),
        );
      },
    );
  }
}

const _arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

String arabicDigits(Object value) => value.toString().split('').map((ch) {
      final d = int.tryParse(ch);
      return d == null ? ch : _arabicDigits[d];
    }).join();

String formatTime(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  final s = d.inSeconds % 60;
  final core = h > 0 ? '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}' : '$m:${s.toString().padLeft(2, '0')}';
  return arabicDigits(core);
}

String formatSpeed(double v) => '${arabicDigits(v.toString().replaceAll(RegExp(r'\.0$'), '').replaceAll('.', '٫'))}×';

const _ordinals = [
  'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
  'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة', 'الخامسة عشرة', 'السادسة عشرة',
  'السابعة عشرة', 'الثامنة عشرة', 'التاسعة عشرة', 'العشرون', 'الحادية والعشرون', 'الثانية والعشرون',
];

String episodeOrdinal(int n) => n >= 1 && n <= _ordinals.length ? _ordinals[n - 1] : arabicDigits(n);
