import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';

/// Arabic user guide: playback, reading settings and importing new books.
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  static const _sections = [
    (
      'الاستماع والقراءة',
      [
        'افتح كتاباً من المكتبة ثم اختر حلقة. تظهر اللوحة المصوّرة في النصف العلوي ونص الحكاية في النصف السفلي.',
        'تنتقل اللوحة تلقائياً عند بداية كل مشهد، ويُبرز النص المقطع الذي يُقرأ الآن.',
        'اضغط على أي فقرة في النص للانتقال إلى موضعها في التسجيل.',
        'أزرار التحكم: المشهد السابق، رجوع ١٠ ثوانٍ، تشغيل/إيقاف، تقديم ١٠ ثوانٍ، المشهد التالي.',
        'الحلقة السابقة والتالية من أعلى الصفحة، ويمكن الانتقال تلقائياً إلى الحلقة التالية من الإعدادات.',
        'يستمر التشغيل عند إغلاق الشاشة، ويمكن التحكم به من الإشعار وشاشة القفل.',
      ],
    ),
    (
      'العلامات والمتابعة',
      [
        'زر «علامة» يحفظ موضعك الحالي، وتجد العلامات في صفحة «المحفوظات».',
        'يُحفظ موضع الاستماع تلقائياً، ويظهر في «متابعة الاستماع» في الصفحة الرئيسية.',
        'اضغط القلب في صفحة الكتاب لإضافته إلى المفضّلة.',
      ],
    ),
    (
      'إضافة كتاب جديد',
      [
        'جهّز الكتاب على جهاز الماك بأداة التحزيم hikaya_pack.py (راجع الدليل المرفق في المشروع).',
        'انسخ ملف ZIP الناتج إلى الهاتف (عبر كابل أو Google Drive أو البريد).',
        'من صفحة «المكتبة» اختر «استيراد كتاب» ثم الملف. يتحقق التطبيق من الملفات قبل إضافتها.',
        'لتحديث كتاب موجود استورد نسخة أحدث بالمعرّف نفسه؛ يبقى تقدّم الاستماع والعلامات محفوظاً.',
        'لحذف كتاب مستورد اضغط مطوّلاً على غلافه في المكتبة.',
        'لا يحتاج استيراد كتاب جديد إلى تعديل التطبيق أو إعادة بنائه.',
      ],
    ),
    (
      'المظهر',
      [
        'من «الإعدادات» اختر المظهر الفاتح أو الداكن أو التلقائي، وحجم الخط وتباعد الأسطر.',
        'يمكن كتم الموسيقى الخلفية أو خفضها دون التأثير في صوت الحكاية.',
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('دليل الاستخدام')),
      body: PaperBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
          children: [
            for (final s in _sections) ...[
              SectionTitle(s.$1),
              for (final line in s.$2)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 9, left: 8),
                        child: Icon(Icons.circle, size: 6, color: c.gold),
                      ),
                      Expanded(child: Text(line, style: TextStyle(fontSize: 18, height: 1.7, color: c.ink))),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
