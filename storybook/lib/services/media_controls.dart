import 'dart:async';

import 'package:audio_service/audio_service.dart';

import 'playback.dart';

/// Bridges the episode being played to Android's media session: the
/// notification, lock screen and headset buttons. Background playback keeps
/// running through the foreground service this handler starts.
class HikayaAudioHandler extends BaseAudioHandler with SeekHandler {
  EpisodeController? _controller;
  Timer? _positionTimer;

  void attach(EpisodeController c) {
    detach();
    _controller = c;
    c.addListener(_broadcast);
    mediaItem.add(MediaItem(
      id: c.progressKey,
      title: c.entry.title.isEmpty ? c.book.title : c.entry.title,
      album: c.book.title,
      artist: c.book.author,
      duration: c.duration,
    ));
    _positionTimer = Timer.periodic(const Duration(seconds: 2), (_) => _broadcast());
    _broadcast();
  }

  void detach() {
    _controller?.removeListener(_broadcast);
    _controller = null;
    _positionTimer?.cancel();
    playbackState.add(playbackState.value.copyWith(playing: false, processingState: AudioProcessingState.idle));
  }

  void _broadcast() {
    final c = _controller;
    if (c == null) return;
    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        c.playing ? MediaControl.pause : MediaControl.play,
        MediaControl.skipToNext,
      ],
      systemActions: const {MediaAction.seek, MediaAction.seekForward, MediaAction.seekBackward},
      androidCompactActionIndices: const [0, 1, 2],
      processingState: c.completed
          ? AudioProcessingState.completed
          : (c.ready ? AudioProcessingState.ready : AudioProcessingState.loading),
      playing: c.playing,
      updatePosition: c.position,
      speed: c.user.speed,
    ));
  }

  @override
  Future<void> play() async => _controller?.play();

  @override
  Future<void> pause() async => _controller?.pause();

  @override
  Future<void> seek(Duration position) async => _controller?.seek(position);

  @override
  Future<void> skipToNext() async => _controller?.nextScene();

  @override
  Future<void> skipToPrevious() async => _controller?.previousScene();

  @override
  Future<void> fastForward() async => _controller?.skip(const Duration(seconds: 10));

  @override
  Future<void> rewind() async => _controller?.skip(const Duration(seconds: -10));

  @override
  Future<void> stop() async {
    await _controller?.pause();
    await super.stop();
  }
}
