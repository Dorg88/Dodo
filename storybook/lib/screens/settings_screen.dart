import 'package:flutter/material.dart';

import '../main.dart';
import '../services/settings_service.dart';
import '../theme/app_theme.dart';
import '../widgets/storybook_widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context).settings;
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: ListenableBuilder(
              listenable: s,
              builder: (context, _) => ListView(
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
                children: [
                  const _Heading('النص'),
                  _SwitchRow(label: 'إظهار نص القصة', value: s.showCaptions, onChanged: s.setShowCaptions),
                  _LabeledSlider(
                    label: 'حجم الخط',
                    value: SettingsService.fontScales.indexOf(s.fontScale).clamp(0, 4).toDouble(),
                    max: SettingsService.fontScales.length - 1.0,
                    divisions: SettingsService.fontScales.length - 1,
                    onChanged: (v) => s.setFontScale(SettingsService.fontScales[v.round()]),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text('في مدينة قفصة التونسية...', style: AppText.story(s.fontScale)),
                  ),
                  const _Heading('الصوت'),
                  _SwitchRow(label: 'الموسيقى التصويرية', value: s.musicEnabled, onChanged: s.setMusicEnabled),
                  _LabeledSlider(
                    label: 'مستوى الموسيقى',
                    value: s.musicVolume,
                    onChanged: s.musicEnabled ? s.setMusicVolume : null,
                  ),
                  _SwitchRow(label: 'المؤثرات الصوتية', value: s.sfxEnabled, onChanged: s.setSfxEnabled),
                  _LabeledSlider(
                    label: 'مستوى المؤثرات',
                    value: s.sfxVolume,
                    onChanged: s.sfxEnabled ? s.setSfxVolume : null,
                  ),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text('صوت الحوار لا يتأثر بهذه الإعدادات.', style: AppText.label),
                  ),
                  const _Heading('سرعة التشغيل'),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final v in SettingsService.speeds)
                        ChoiceChip(
                          label: Text('${arabicDigits(v.toString().replaceAll('.', '٫'))}×'),
                          selected: s.speed == v,
                          onSelected: (_) => s.setSpeed(v),
                          selectedColor: AppColors.sageLight.withValues(alpha: 0.5),
                          backgroundColor: AppColors.paper,
                          side: const BorderSide(color: AppColors.rule),
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const _Heading('حول التطبيق'),
                  const Text(
                    'يعمل التطبيق كاملاً دون اتصال بالإنترنت. أصوات الشخصيات تسجيلات أصلية مقدّمة من صاحب العمل. '
                    'الموسيقى والمؤثرات مؤلفة إجرائياً خصيصاً لهذا العمل دون استخدام تسجيلات خارجية. '
                    'الخط: «أميري» برخصة SIL Open Font License.',
                    style: AppText.label,
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  final String text;

  const _Heading(this.text);

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          const Rule(),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(text, style: AppText.labelSage.copyWith(fontSize: 17)),
          ),
          const Rule(),
          const SizedBox(height: 4),
        ],
      );
}

class _SwitchRow extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 20))),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      );
}

class _LabeledSlider extends StatelessWidget {
  final String label;
  final double value;
  final double max;
  final int? divisions;
  final ValueChanged<double>? onChanged;

  const _LabeledSlider({
    required this.label,
    required this.value,
    required this.onChanged,
    this.max = 1,
    this.divisions,
  });

  @override
  Widget build(BuildContext context) => Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: AppText.label)),
          Expanded(
            child: Slider(value: value.clamp(0, max), max: max, divisions: divisions, onChanged: onChanged),
          ),
        ],
      );
}
