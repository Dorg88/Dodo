import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import '../theme/app_theme.dart';
import '../widgets/hk_widgets.dart';

/// What the launch intro can show, detected from the bundled brand assets.
class IntroAssets {
  static const video = 'assets/brand/intro.mp4';
  static const logos = [
    'assets/brand/logo_section.png',
    'assets/brand/logo_shrine.png',
    'assets/brand/logo_hikaya.png',
  ];

  final bool hasVideo;
  final List<String> availableLogos;

  const IntroAssets({required this.hasVideo, required this.availableLogos});

  bool get any => hasVideo || availableLogos.isNotEmpty;

  static Future<IntroAssets> detect([AssetBundle? bundle]) async {
    final b = bundle ?? rootBundle;
    Future<bool> exists(String key) async {
      try {
        await b.load(key);
        return true;
      } on Object {
        return false;
      }
    }

    final found = <String>[];
    for (final l in logos) {
      if (await exists(l)) found.add(l);
    }
    return IntroAssets(hasVideo: await exists(video), availableLogos: found);
  }
}

/// The launch motion graphic: the three logos (section, Holy Shrine, HIKAYA)
/// rendered with HyperFrames into intro.mp4. Tap anywhere to skip. When the
/// video is unavailable, the logos are animated natively instead.
class IntroScreen extends StatefulWidget {
  final IntroAssets assets;
  final WidgetBuilder next;

  const IntroScreen({super.key, required this.assets, required this.next});

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> with SingleTickerProviderStateMixin {
  VideoPlayerController? _video;
  AnimationController? _anim;
  bool _done = false;
  Timer? _safety;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    if (widget.assets.hasVideo) {
      _startVideo();
    } else {
      _startNative();
    }
  }

  Future<void> _startVideo() async {
    final v = VideoPlayerController.asset(IntroAssets.video);
    _video = v;
    try {
      await v.initialize();
      if (!mounted) return;
      v.addListener(() {
        final value = v.value;
        if (value.isInitialized && !value.isPlaying && value.position >= value.duration - const Duration(milliseconds: 80)) {
          _finish();
        }
      });
      setState(() {});
      await v.play();
      _safety = Timer(v.value.duration + const Duration(seconds: 2), _finish);
    } on Object {
      _video = null;
      if (mounted) _startNative();
    }
  }

  void _startNative() {
    if (widget.assets.availableLogos.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _finish());
      return;
    }
    final c = AnimationController(vsync: this, duration: Duration(milliseconds: 2300 * widget.assets.availableLogos.length));
    _anim = c;
    c.addStatusListener((s) {
      if (s == AnimationStatus.completed) _finish();
    });
    c.forward();
    setState(() {});
  }

  void _finish() {
    if (_done || !mounted) return;
    _done = true;
    _safety?.cancel();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    Navigator.of(context).pushReplacement(PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 600),
      pageBuilder: (context, _, _) => widget.next(context),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
    ));
  }

  @override
  void dispose() {
    _safety?.cancel();
    _video?.dispose();
    _anim?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = Hk.light;
    final v = _video;
    return Theme(
      data: AppTheme.light(),
      child: Scaffold(
        backgroundColor: c.paper,
        body: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _finish,
          child: PaperBackground(
            child: Stack(
              children: [
                if (v != null && v.value.isInitialized)
                  Center(child: AspectRatio(aspectRatio: v.value.aspectRatio, child: VideoPlayer(v)))
                else if (_anim != null)
                  _NativeLogos(animation: _anim!, logos: widget.assets.availableLogos),
                Positioned(
                  bottom: 24,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Text('اضغط للتخطي', style: TextStyle(color: c.muted.withValues(alpha: 0.7), fontSize: 14)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Fallback: each logo rises in with a soft glow, holds, then lifts away.
class _NativeLogos extends StatelessWidget {
  final Animation<double> animation;
  final List<String> logos;

  const _NativeLogos({required this.animation, required this.logos});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final slot = (animation.value * logos.length).clamp(0, logos.length - 0.0001);
        final i = slot.floor();
        final t = slot - i; // 0..1 inside this logo's slot
        final appear = Curves.easeOutCubic.transform((t / 0.35).clamp(0, 1));
        final leave = Curves.easeInCubic.transform(((t - 0.82) / 0.18).clamp(0, 1));
        final opacity = (appear * (1 - leave)).clamp(0.0, 1.0);
        final scale = 0.9 + 0.1 * appear + 0.04 * leave;
        return Center(
          child: Opacity(
            opacity: opacity,
            child: Transform.translate(
              offset: Offset(0, 24 * (1 - appear) - 16 * leave),
              child: Transform.scale(
                scale: scale,
                child: FractionallySizedBox(
                  widthFactor: 0.72,
                  child: Image.asset(logos[i], fit: BoxFit.contain),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
