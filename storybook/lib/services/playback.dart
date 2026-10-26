import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/book.dart';
import '../models/episode.dart';
import 'user_data.dart';

UriAudioSource audioSourceFor(Book book, String relative) {
  final path = book.location.resolve(relative);
  return book.location.bundled ? AudioSource.asset(path) : AudioSource.file(path);
}

/// Plays one episode on a single virtual timeline, whatever its audio mode.
///
/// * track mode: the voice file is the clock; music/ambience stems follow it
///   and are nudged back when they drift.
/// * clips mode: the clips (each a window into an original recording) and the
///   silences between them form one playlist; the timeline position is the
///   playlist item's offset plus the position inside it. Music/ambience
///   stems rendered for the episode follow that virtual clock.
class EpisodeEngine {
  final Book book;
  final Episode episode;
  final AudioPlayer _voice = AudioPlayer();
  AudioPlayer? _music;
  AudioPlayer? _sfx;
  List<Duration> _offsets = const [Duration.zero];
  final _completed = StreamController<void>.broadcast();
  StreamSubscription<PlayerState>? _stateSub;
  bool _disposed = false;

  static const _driftTolerance = Duration(milliseconds: 90);

  EpisodeEngine(this.book, this.episode);

  Stream<void> get completed => _completed.stream;
  bool get playing => _voice.playing;

  Duration get position {
    if (episode.audio.mode == AudioMode.track) return _voice.position;
    final i = (_voice.currentIndex ?? 0).clamp(0, _offsets.length - 1);
    return _offsets[i] + _voice.position;
  }

  Future<void> load(Duration start) async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.speech());
    final a = episode.audio;
    if (a.mode == AudioMode.track) {
      await _voice.setAudioSource(audioSourceFor(book, a.voice!));
    } else {
      final sources = <AudioSource>[];
      final offsets = <Duration>[];
      var cursor = Duration.zero;
      for (final s in episode.segments) {
        if (s.start > cursor) {
          offsets.add(cursor);
          sources.add(SilenceAudioSource(duration: s.start - cursor));
          cursor = s.start;
        }
        final c = s.clip!;
        offsets.add(cursor);
        sources.add(ClippingAudioSource(child: audioSourceFor(book, c.file), start: c.start, end: c.end));
        cursor += c.length;
      }
      _offsets = offsets;
      await _voice.setAudioSources(sources, preload: true);
    }
    if (a.music != null) {
      _music = AudioPlayer();
      await _music!.setAudioSource(audioSourceFor(book, a.music!));
      if (a.musicLoop) await _music!.setLoopMode(LoopMode.one);
    }
    if (a.sfx != null) {
      _sfx = AudioPlayer();
      await _sfx!.setAudioSource(audioSourceFor(book, a.sfx!));
    }
    if (_disposed) return;
    await seek(start);
    _stateSub = _voice.playerStateStream.listen((s) {
      if (s.processingState == ProcessingState.completed) {
        _music?.pause();
        _sfx?.pause();
        _completed.add(null);
      }
    });
  }

  /// Stems that span the episode and must stay on its clock.
  List<AudioPlayer> get _followers => [
        if (_music != null && !episode.audio.musicLoop) _music!,
        ?_sfx,
      ];

  Future<void> play() async {
    if (episode.audio.mode == AudioMode.clips) {
      final t = position;
      await Future.wait(_followers.map((p) => p.seek(t)));
    }
    for (final p in [_music, _sfx]) {
      if (p != null) unawaited(p.play());
    }
    unawaited(_voice.play());
  }

  Future<void> pause() async {
    await Future.wait([
      _voice.pause(),
      if (_music != null) _music!.pause(),
      if (_sfx != null) _sfx!.pause(),
    ]);
  }

  Future<void> seek(Duration t) async {
    var target = t < Duration.zero ? Duration.zero : t;
    if (target > episode.duration) target = episode.duration;
    if (episode.audio.mode == AudioMode.track) {
      await Future.wait([
        _voice.seek(target),
        if (_music != null) _music!.seek(target),
        if (_sfx != null) _sfx!.seek(target),
      ]);
      return;
    }
    var i = 0;
    for (var k = 0; k < _offsets.length; k++) {
      if (_offsets[k] <= target) i = k;
    }
    await Future.wait([
      _voice.seek(target - _offsets[i], index: i),
      ..._followers.map((p) => p.seek(target)),
    ]);
  }

  Future<void> setSpeed(double v) async {
    await _voice.setSpeed(v);
    for (final p in _followers) {
      await p.setSpeed(v);
    }
  }

  Future<void> setMix({required double voice, required double music, required bool sfx}) async {
    await _voice.setVolume(voice);
    await _music?.setVolume(music);
    await _sfx?.setVolume(sfx ? 0.8 : 0);
  }

  bool get hasMusic => _music != null;

  /// Keeps the stems aligned with the episode clock. In clips mode the
  /// clock jumps between playlist items, so a little more slack is allowed.
  void resync() {
    final clock = position;
    final slack = episode.audio.mode == AudioMode.track ? _driftTolerance : const Duration(milliseconds: 250);
    for (final p in _followers) {
      if (p.playing && (p.position - clock).abs() > slack) p.seek(clock);
    }
  }

  Future<void> dispose() async {
    _disposed = true;
    await _stateSub?.cancel();
    await _completed.close();
    await _voice.dispose();
    await _music?.dispose();
    await _sfx?.dispose();
  }
}

/// UI-facing state for the episode being read: position, scene, active
/// segment and line, progress saving, bookmarks and auto-advance.
class EpisodeController extends ChangeNotifier {
  final Book book;
  final EpisodeEntry entry;
  final Episode episode;
  final UserData user;
  final EpisodeEngine Function(Book, Episode) engineFactory;
  late final EpisodeEngine _engine;

  Timer? _ticker;
  StreamSubscription<void>? _doneSub;
  Duration _position = Duration.zero;
  Duration _lastSaved = Duration.zero;
  bool _loaded = false;
  bool _ready = false;
  bool _playing = false;
  bool _completed = false;
  int _tick = 0;
  double? _appliedSpeed;

  /// Called when the episode ends and auto-advance is on.
  VoidCallback? onFinished;

  EpisodeController({
    required this.book,
    required this.entry,
    required this.episode,
    required this.user,
    EpisodeEngine Function(Book, Episode)? engineFactory,
  }) : engineFactory = engineFactory ?? EpisodeEngine.new {
    user.addListener(_applySettings);
  }

  String get progressKey => book.progressKey(entry);
  bool get ready => _ready;
  bool get playing => _playing;
  bool get completed => _completed;
  Duration get position => _position;
  Duration get duration => episode.duration;
  int get sceneIndex => episode.sceneIndexAt(_position);
  Scene get scene => episode.scenes[sceneIndex];
  Segment? get active => episode.activeAt(_position);
  bool get hasMusic => _ready && _engine.hasMusic;

  /// The one episode allowed to sound: starting another pauses this one.
  static EpisodeController? _sounding;
  bool _disposed = false;

  Future<void> init({Duration? startAt}) async {
    _engine = engineFactory(book, episode);
    var start = startAt ?? user.progress(progressKey);
    if (start >= episode.duration - const Duration(seconds: 2)) start = Duration.zero;
    await _engine.load(start);
    _loaded = true;
    if (_disposed) {
      // closed while it was loading: release the players it just opened
      await _engine.dispose();
      return;
    }
    _position = start;
    await _applySettings();
    _doneSub = _engine.completed.listen((_) => _finish());
    _ready = true;
    notifyListeners();
  }

  @visibleForTesting
  void debugSetPosition(Duration p) {
    _position = p;
    notifyListeners();
  }

  Future<void> play() async {
    if (!_ready || _disposed) return;
    final other = _sounding;
    if (other != null && !identical(other, this)) await other.pause();
    _sounding = this;
    if (_completed) {
      _completed = false;
      await _engine.seek(Duration.zero);
    }
    _playing = true;
    await _engine.play();
    _ticker ??= Timer.periodic(const Duration(milliseconds: 100), (_) => _onTick());
    notifyListeners();
  }

  Future<void> pause() async {
    if (!_playing) return;
    _playing = false;
    await _engine.pause();
    _position = _engine.position;
    await _save();
    notifyListeners();
  }

  Future<void> togglePlay() => _playing ? pause() : play();

  Future<void> seek(Duration t) async {
    if (!_ready) return;
    _completed = false;
    _position = t < Duration.zero ? Duration.zero : (t > duration ? duration : t);
    notifyListeners();
    await _engine.seek(_position);
    await _save();
  }

  Future<void> skip(Duration by) => seek(_position + by);

  Future<void> goToScene(int index) => seek(episode.scenes[index.clamp(0, episode.scenes.length - 1)].start);

  Future<void> nextScene() async {
    if (sceneIndex < episode.scenes.length - 1) await goToScene(sceneIndex + 1);
  }

  Future<void> previousScene() {
    final current = episode.scenes[sceneIndex];
    if (_position - current.start > const Duration(seconds: 3) || sceneIndex == 0) return goToScene(sceneIndex);
    return goToScene(sceneIndex - 1);
  }

  Future<Bookmark> addBookmark() {
    final seg = active;
    final label = '${scene.title}${seg == null ? '' : ' — ${seg.text.length > 60 ? '${seg.text.substring(0, 60)}…' : seg.text}'}';
    return user.addBookmark(book.id, entry.id, _position, label);
  }

  Future<void> _applySettings() async {
    if (!_loaded) return;
    await _engine.setMix(
      voice: user.voiceVolume,
      music: user.musicMuted ? 0 : user.musicVolume,
      sfx: user.sfxEnabled,
    );
    if (_appliedSpeed != user.speed) {
      _appliedSpeed = user.speed;
      await _engine.setSpeed(user.speed);
      notifyListeners();
    }
  }

  void _onTick() {
    if (!_playing) return;
    final before = (sceneIndex, active?.id);
    _position = _engine.position;
    if (++_tick % 10 == 0) _engine.resync();
    if ((_position - _lastSaved).abs() > const Duration(seconds: 5)) _save();
    if (before != (sceneIndex, active?.id) || _tick % 2 == 0) notifyListeners();
  }

  void _finish() {
    if (_completed) return;
    _completed = true;
    _playing = false;
    _position = duration;
    user.saveProgress(progressKey, Duration.zero, finished: true);
    notifyListeners();
    if (user.autoNext) onFinished?.call();
  }

  Future<void> _save() async {
    _lastSaved = _position;
    await user.saveProgress(progressKey, _position, notify: false);
  }

  @override
  void dispose() {
    _disposed = true;
    if (identical(_sounding, this)) _sounding = null;
    user.removeListener(_applySettings);
    _ticker?.cancel();
    _doneSub?.cancel();
    if (_ready && !_completed) user.saveProgress(progressKey, _position, notify: false);
    if (_loaded) _engine.dispose();
    super.dispose();
  }
}
