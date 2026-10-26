import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hikaya/models/book.dart';
import 'package:hikaya/models/episode.dart';
import 'package:hikaya/services/playback.dart';
import 'package:hikaya/services/user_data.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'test_support.dart';

/// Only one episode may sound at a time, and an episode closed while it was
/// still loading must never start playing in the background.
void main() {
  const root = 'assets/books/thumma_ihtadayt';
  late Book book;
  late Episode episode;
  late UserData user;
  final engines = <FakeEngine>[];

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    user = await UserData.load();
    book = Book.fromJson(jsonDecode(File('$root/book.json').readAsStringSync()) as Map<String, dynamic>,
        const BookLocation.bundled(root));
    episode = Episode.fromJson(jsonDecode(File('$root/ep01/episode.json').readAsStringSync()) as Map<String, dynamic>);
    engines.clear();
    FakeEngine.loadGate = null;
  });

  EpisodeController controller() => EpisodeController(
      book: book,
      entry: book.episodes.first,
      episode: episode,
      user: user,
      engineFactory: (b, e) => FakeEngine(b, e)..let(engines.add));

  test('starting a second episode stops the first', () async {
    final a = controller();
    final b = controller();
    await a.init(startAt: Duration.zero);
    await b.init(startAt: Duration.zero);
    await a.play();
    expect(a.playing, isTrue);
    await b.play();
    expect(b.playing, isTrue);
    expect(a.playing, isFalse, reason: 'two episodes must never sound together');
    expect(engines.first.playing, isFalse);
    a.dispose();
    b.dispose();
  });

  test('an episode closed while loading releases its players and never plays', () async {
    final gate = Completer<void>();
    FakeEngine.loadGate = gate.future;
    final a = controller();
    final loading = a.init(startAt: Duration.zero);
    a.dispose(); // the listener moved on before it finished loading
    gate.complete();
    await loading;
    await a.play();
    expect(a.playing, isFalse);
    expect(engines.single.disposed, isTrue);
  });
}

extension<T> on T {
  T let(void Function(T) f) {
    f(this);
    return this;
  }
}
