import 'package:flutter/material.dart';

import '../main.dart';
import '../services/user_data.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';
import 'help_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final u = AppScope.of(context).user;
    final c = Hk.of(context);
    return PaperBackground(
      child: SafeArea(
        child: ListenableBuilder(
          listenable: u,
          builder: (context, _) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Text('الإعدادات', style: TextStyle(fontFamily: AppTheme.display, fontSize: 34, color: c.walnut)),
              const SectionTitle('المظهر'),
              SegmentedButton<ThemeMode>(
                segments: const [
                  ButtonSegment(value: ThemeMode.system, label: Text('تلقائي'), icon: Icon(Icons.brightness_auto)),
                  ButtonSegment(value: ThemeMode.light, label: Text('فاتح'), icon: Icon(Icons.light_mode_outlined)),
                  ButtonSegment(value: ThemeMode.dark, label: Text('داكن'), icon: Icon(Icons.dark_mode_outlined)),
                ],
                selected: {u.themeMode},
                onSelectionChanged: (s) => u.setThemeMode(s.first),
              ),
              const SectionTitle('القراءة'),
              SwitchListTile(title: const Text('إظهار نص القصة'), value: u.showText, onChanged: u.setShowText),
              SwitchListTile(
                title: const Text('تظليل الجملة المسموعة'),
                subtitle: const Text('حين يكون التوقيت موثّقاً'),
                value: u.highlight,
                onChanged: u.setHighlight,
              ),
              const ListTile(title: Text('حجم الخط')),
              Slider(
                value: UserData.fontScales.indexOf(u.fontScale).clamp(0, UserData.fontScales.length - 1).toDouble(),
                max: UserData.fontScales.length - 1.0,
                divisions: UserData.fontScales.length - 1,
                onChanged: (v) => u.setFontScale(UserData.fontScales[v.round()]),
              ),
              Text('في مدينة قفصة التونسية...', style: TextStyle(fontSize: 23 * u.fontScale, height: u.lineHeight, color: c.ink)),
              const SectionTitle('الصوت'),
              const ListTile(title: Text('سرعة التشغيل')),
              Wrap(
                spacing: 8,
                children: [
                  for (final s in UserData.speeds)
                    ChoiceChip(label: Text(formatSpeed(s)), selected: u.speed == s, onSelected: (_) => u.setSpeed(s)),
                ],
              ),
              const ListTile(title: Text('مستوى صوت الحكاية')),
              Slider(value: u.voiceVolume, onChanged: u.setVoiceVolume),
              SwitchListTile(
                  title: const Text('الموسيقى الخلفية'), value: !u.musicMuted, onChanged: (v) => u.setMusicMuted(!v)),
              Slider(value: u.musicVolume, onChanged: u.musicMuted ? null : u.setMusicVolume),
              SwitchListTile(title: const Text('المؤثرات الصوتية'), value: u.sfxEnabled, onChanged: u.setSfxEnabled),
              SwitchListTile(
                  title: const Text('الانتقال تلقائياً إلى الحلقة التالية'), value: u.autoNext, onChanged: u.setAutoNext),
              const SectionTitle('المساعدة'),
              ListTile(
                leading: const Icon(Icons.menu_book_outlined),
                title: const Text('دليل الاستخدام وإضافة الكتب'),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HelpScreen())),
              ),
              const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('حكايا'),
                subtitle: Text('يعمل دون اتصال. الخطوط: أميري ورقعة عارف (SIL OFL).'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
