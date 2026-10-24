import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/episode.dart';
import 'settings_service.dart';

/// Plays an episode's three stems (voice, music, ambience) in lockstep.
///
/// The voice stem is the master clock. The music and ambience stems follow
/// it: they are started, paused, seeked and re-speeded together, and are
/// nudged back whenever they drift. Scene, segment and line changes are
/// derived from the voice position only.
class StorybookPlayer extends ChangeNotifier {
  final Episode episode;
  final SettingsService settings;

  final AudioPlayer _voice = AudioPlayer();
  final AudioPlayer _music = AudioPlayer();
  final AudioPlayer _sfx = AudioPlayer();

  static const _driftTolerance = Duration(milliseconds: 90);

  Timer? _ticker;
  StreamSubscription<PlayerState>? _stateSub;
  StreamSubscription<void>? _noisySub;
  StreamSubscription<AudioInterruptionEvent>? _interruptSub;
  Duration _position = Duration.zero;
  Duration _lastSaved = Duration.zero;
  int _tick = 0;
  bool _ready = false;
  bool _playing = false;
  bool _completed = false;
  bool _disposed = false;

  StorybookPlayer({required this.episode, required this.settings}) {
    settings.addListener(_applyMix);
  }

  bool get ready => _ready;
  bool get playing => _playing;
  bool get completed => _completed;
  Duration get position => _position;
  Duration get duration => episode.duration;
  double get speed => settings.speed;

  int get sceneIndex => episode.sceneIndexAt(_position);
  Scene get scene => episode.scenes[sceneIndex];
  Segment? get segment => episode.segmentAt(_position);
  Segment? get speaking => episode.speakingAt(_position);

  @visibleForTesting
  void debugSetPosition(Duration position) {
    _position = position;
    notifyListeners();
  }

  Future<void> init({Duration? startAt}) async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
    _noisySub = session.becomingNoisyEventStream.listen((_) => pause());
    _interruptSub = session.interruptionEventStream.listen((e) {
      if (e.begin) pause();
    });

    await Future.wait([
      _voice.setAsset(episode.voiceAsset),
      _music.setAsset(episode.musicAsset),
      _sfx.setAsset(episode.sfxAsset),
    ]);
    if (_disposed) return;
    await _applyMix();
    await _setSpeedAll(settings.speed);

    var start = startAt ?? Duration.zero;
    if (start >= episode.duration - const Duration(seconds: 2)) start = Duration.zero;
    await _seekAll(start);
    _position = start;

    _stateSub = _voice.playerStateStream.listen((s) {
      if (s.processingState == ProcessingState.completed && !_completed) {
        _completed = true;
        _playing = false;
        _music.pause();
        _sfx.pause();
        _position = episode.duration;
        settings.saveProgress(episode.progressKey, Duration.zero, finished: true);
        notifyListeners();
      }
    });
    _ready = true;
    notifyListeners();
  }

  Future<void> play() async {
    if (!_ready) return;
    if (_completed) {
      _completed = false;
      await _seekAll(Duration.zero);
    }
    _playing = true;
    // Start the followers first so the voice (the clock) is never ahead.
    unawaited(_music.play());
    unawaited(_sfx.play());
    unawaited(_voice.play());
    _ticker ??= Timer.periodic(const Duration(milliseconds: 100), (_) => _onTick());
    notifyListeners();
  }

  Future<void> pause() async {
    if (!_playing) return;
    _playing = false;
    await Future.wait([_voice.pause(), _music.pause(), _sfx.pause()]);
    _position = _voice.position;
    await _saveProgress();
    notifyListeners();
  }

  Future<void> togglePlay() => _playing ? pause() : play();

  Future<void> seek(Duration target) async {
    if (!_ready) return;
    var t = target;
    if (t < Duration.zero) t = Duration.zero;
    if (t > episode.duration) t = episode.duration;
    _completed = false;
    _position = t;
    notifyListeners();
    await _seekAll(t);
    await _saveProgress();
  }

  Future<void> goToScene(int index) async {
    final i = index.clamp(0, episode.scenes.length - 1);
    await seek(episode.scenes[i].start);
  }

  Future<void> nextScene() => goToScene(sceneIndex + 1);

  /// Restarts the current scene, or goes back one scene when already near
  /// its beginning, like a conventional "previous track" control.
  Future<void> previousScene() {
    final current = episode.scenes[sceneIndex];
    if (_position - current.start > const Duration(seconds: 3) || sceneIndex == 0) {
      return goToScene(sceneIndex);
    }
    return goToScene(sceneIndex - 1);
  }

  Future<void> setSpeed(double value) => settings.setSpeed(value);

  Future<void> _setSpeedAll(double v) {
    _appliedSpeed = v;
    return Future.wait([_voice.setSpeed(v), _music.setSpeed(v), _sfx.setSpeed(v)]);
  }

  Future<void> _seekAll(Duration t) => Future.wait([_voice.seek(t), _music.seek(t), _sfx.seek(t)]);

  double? _appliedSpeed;

  /// Applies the mix and speed preferences; runs whenever settings change.
  Future<void> _applyMix() async {
    await _music.setVolume(settings.musicEnabled ? settings.musicVolume : 0);
    await _sfx.setVolume(settings.sfxEnabled ? settings.sfxVolume : 0);
    if (_ready && _appliedSpeed != settings.speed) {
      await _setSpeedAll(settings.speed);
      notifyListeners();
    }
  }

  void _onTick() {
    if (!_playing) return;
    final previousScene = sceneIndex;
    final previousSegment = segment?.id;
    _position = _voice.position;
    _tick++;
    if (_tick % 10 == 0) _resync();
    if ((_position - _lastSaved).abs() > const Duration(seconds: 5)) _saveProgress();
    if (previousScene != sceneIndex || previousSegment != segment?.id || _tick % 2 == 0) {
      notifyListeners();
    }
  }

  void _resync() {
    final clock = _voice.position;
    for (final p in [_music, _sfx]) {
      if (p.playing && (p.position - clock).abs() > _driftTolerance) {
        p.seek(clock);
      }
    }
  }

  Future<void> _saveProgress() async {
    _lastSaved = _position;
    await settings.saveProgress(episode.progressKey, _position);
  }

  @override
  void dispose() {
    _disposed = true;
    settings.removeListener(_applyMix);
    _ticker?.cancel();
    _stateSub?.cancel();
    _noisySub?.cancel();
    _interruptSub?.cancel();
    if (_ready && !_completed) {
      settings.saveProgress(episode.progressKey, _position);
    }
    _voice.dispose();
    _music.dispose();
    _sfx.dispose();
    super.dispose();
  }
}
