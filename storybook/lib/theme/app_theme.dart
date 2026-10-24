import 'package:flutter/material.dart';

/// Light parchment palette modelled on the classic audio-storybook look:
/// warm paper, hairline rules, sage headings and deep ink text.
class AppColors {
  static const paper = Color(0xFFF4F0E7);
  static const plate = Color(0xFFECE6DA);
  static const plateBorder = Color(0xFFCFC6B4);
  static const rule = Color(0xFFDAD2C2);
  static const ink = Color(0xFF2B2722);
  static const inkSoft = Color(0xFF5E574D);
  static const muted = Color(0xFF8C8577);
  static const sage = Color(0xFF66785F);
  static const sageLight = Color(0xFFA9B5A1);
  static const navy = Color(0xFF26324A);
  static const amber = Color(0xFFB88A3E);
}

class AppTheme {
  static const fontFamily = 'Amiri';

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: AppColors.paper,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.sage,
        brightness: Brightness.light,
        surface: AppColors.paper,
        primary: AppColors.sage,
        onSurface: AppColors.ink,
      ),
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: AppColors.ink, displayColor: AppColors.ink),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 21, color: AppColors.ink),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.rule, thickness: 1, space: 1),
      sliderTheme: const SliderThemeData(
        trackHeight: 1.5,
        activeTrackColor: AppColors.sage,
        inactiveTrackColor: AppColors.rule,
        thumbColor: AppColors.sage,
        overlayColor: Color(0x2266785F),
        thumbShape: RoundSliderThumbShape(enabledThumbRadius: 6),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? AppColors.paper : AppColors.muted,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? AppColors.sage : AppColors.rule,
        ),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      bottomSheetTheme: const BottomSheetThemeData(backgroundColor: AppColors.paper),
    );
  }
}

/// Recurring text styles. Arabic is never letter-spaced (it would break
/// the joined script), so hierarchy comes from size, colour and italics.
class AppText {
  static const label = TextStyle(fontSize: 15, color: AppColors.muted, height: 1.4);
  static const labelSage = TextStyle(fontSize: 15, color: AppColors.sage, height: 1.4);
  static const caption = TextStyle(fontSize: 20, fontStyle: FontStyle.italic, color: AppColors.ink);
  static const speaker = TextStyle(fontSize: 19, color: AppColors.sage);
  static const direction = TextStyle(fontSize: 19, fontStyle: FontStyle.italic, color: AppColors.sage);
  static const control = TextStyle(fontSize: 17, color: AppColors.sage);
  static TextStyle story(double scale) =>
      TextStyle(fontSize: 25 * scale, height: 1.75, color: AppColors.ink);
}

const _arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

String arabicDigits(Object value) =>
    value.toString().split('').map((c) {
      final d = int.tryParse(c);
      return d == null ? c : _arabicDigits[d];
    }).join();

String formatTime(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds % 60;
  return arabicDigits('$m:${s.toString().padLeft(2, '0')}');
}

const _ordinals = [
  'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة',
  'العاشرة',
];

String episodeOrdinal(int n) => n >= 1 && n <= _ordinals.length ? _ordinals[n - 1] : arabicDigits(n);
