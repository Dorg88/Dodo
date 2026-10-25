import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../main.dart';
import '../models/book.dart';
import '../services/book_importer.dart';
import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';
import 'book_screen.dart';
import 'help_screen.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  bool _importing = false;

  Future<void> _import() async {
    final scope = AppScope.of(context);
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['zip'],
      dialogTitle: 'اختر ملف كتاب حكايا (ZIP)',
    );
    final path = picked.isEmpty ? null : picked.single.path;
    if (path == null || !mounted) return;
    setState(() => _importing = true);
    final result = await scope.store.importZip(path);
    if (!mounted) return;
    setState(() => _importing = false);
    await showDialog<void>(context: context, builder: (_) => _ImportReport(result: result));
  }

  Future<void> _delete(Book book) async {
    final scope = AppScope.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الكتاب؟'),
        content: Text('سيُحذف «${book.title}» من هذا الجهاز. يبقى تقدّم الاستماع محفوظاً إن استوردته مجدداً.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) await scope.store.deleteImported(book);
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = Hk.of(context);
    return PaperBackground(
      child: SafeArea(
        child: ListenableBuilder(
          listenable: scope.store,
          builder: (context, _) {
            final books = scope.store.books;
            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('المكتبة',
                              style: TextStyle(fontFamily: AppTheme.display, fontSize: 34, color: c.walnut)),
                        ),
                        IconButton(
                          tooltip: 'كيف أضيف كتاباً؟',
                          icon: const Icon(Icons.help_outline),
                          onPressed: () =>
                              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HelpScreen())),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Card(
                      child: ListTile(
                        leading: _importing
                            ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: c.gold))
                            : Icon(Icons.file_download_outlined, color: c.walnut),
                        title: Text(_importing ? 'جارٍ استيراد الكتاب والتحقق منه…' : 'استيراد كتاب'),
                        subtitle: const Text('ملف ZIP بصيغة حكايا من ذاكرة الجهاز'),
                        onTap: _importing ? null : _import,
                      ),
                    ),
                  ),
                ),
                if (books.isEmpty)
                  const SliverToBoxAdapter(child: EmptyNote(icon: Icons.auto_stories, text: 'المكتبة فارغة.'))
                else
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 190,
                        mainAxisSpacing: 18,
                        crossAxisSpacing: 14,
                        childAspectRatio: 0.52,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        childCount: books.length,
                        (context, i) {
                          final b = books[i];
                          return GestureDetector(
                            onTap: () => Navigator.of(context)
                                .push(MaterialPageRoute(builder: (_) => BookScreen(bookId: b.id))),
                            onLongPress: scope.store.canDelete(b) ? () => _delete(b) : null,
                            child: LayoutBuilder(
                              builder: (context, box) => Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  BookCover(book: b, width: box.maxWidth),
                                  const SizedBox(height: 6),
                                  Text(b.author,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: c.muted, fontSize: 14)),
                                  Text(
                                    '${arabicDigits(b.available.length)} حلقة${b.location.bundled ? '' : ' · مستورد'}',
                                    style: TextStyle(color: c.gold, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ImportReport extends StatelessWidget {
  final ImportResult result;

  const _ImportReport({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = Hk.of(context);
    return AlertDialog(
      title: Text(result.ok ? (result.updated ? 'تم تحديث الكتاب' : 'تمت إضافة الكتاب') : 'تعذّر الاستيراد'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (result.title != null) Text('«${result.title}»', style: TextStyle(fontSize: 19, color: c.walnut)),
            if (result.ok) Text('${arabicDigits(result.episodes)} حلقة جاهزة للاستماع. تقدّم الاستماع السابق محفوظ.'),
            for (final e in result.errors) Text('✗ $e', style: const TextStyle(color: Colors.red, fontSize: 14)),
            if (result.warnings.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('ملاحظات:', style: TextStyle(color: c.muted)),
              for (final w in result.warnings.take(30)) Text('• $w', style: const TextStyle(fontSize: 13)),
            ],
          ],
        ),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('حسناً'))],
    );
  }
}
