/// A timed episode (schema `hikaya.episode.v1`, see docs/BOOK_FORMAT.md).
///
/// Times are milliseconds on the episode's own timeline. Two audio modes:
///  * `track`: one continuous narration file (optionally with music and
///    ambience stems of the same length) is the clock.
///  * `clips`: every segment names a clip (file + start/end) inside an
///    original recording; the player plays the clips in order with the
///    declared gaps, so a long multi-episode character recording never has
///    to be cut into new files.
class Episode {
  final String id;
  final int number;
  final String title;
  final Duration duration;
  final EpisodeAudio audio;
  final Map<String, String> speakers;
  final List<Scene> scenes;
  final List<Segment> segments;

  const Episode({
    required this.id,
    required this.number,
    required this.title,
    required this.duration,
    required this.audio,
    required this.speakers,
    required this.scenes,
    required this.segments,
  });

  factory Episode.fromJson(Map<String, dynamic> json) {
    final speakers = <String, String>{};
    (json['speakers'] as Map<String, dynamic>? ?? const {}).forEach((k, v) {
      speakers[k] = v is Map ? (v['name'] as String? ?? k) : v.toString();
    });
    final segments = (json['segments'] as List).map((s) => Segment.fromJson(s as Map<String, dynamic>)).toList()
      ..sort((a, b) => a.start.compareTo(b.start));
    final scenes = (json['scenes'] as List).map((s) => Scene.fromJson(s as Map<String, dynamic>)).toList()
      ..sort((a, b) => a.start.compareTo(b.start));
    final audio = EpisodeAudio.fromJson(json['audio'] as Map<String, dynamic>? ?? const {});
    if (audio.mode == AudioMode.clips && segments.any((s) => s.clip == null)) {
      throw const FormatException('in clips mode every segment needs a clip');
    }
    if (audio.mode == AudioMode.track && audio.voice == null) {
      throw const FormatException('track mode needs audio.voice');
    }
    final last = segments.isEmpty ? Duration.zero : segments.last.end;
    final declared = Duration(milliseconds: json['durationMs'] as int? ?? 0);
    return Episode(
      id: json['id'] as String,
      number: json['number'] as int? ?? 0,
      title: json['title'] as String? ?? '',
      duration: declared > last ? declared : last,
      audio: audio,
      speakers: speakers,
      scenes: scenes,
      segments: segments,
    );
  }

  /// Index of the scene showing at [position].
  int sceneIndexAt(Duration position) {
    for (var i = scenes.length - 1; i >= 0; i--) {
      if (position >= scenes[i].start) return i;
    }
    return 0;
  }

  /// The segment whose audio is sounding at [position], if any.
  Segment? speakingAt(Duration position) {
    for (final s in segments) {
      if (position >= s.start && position < s.end) return s;
      if (s.start > position) break;
    }
    return null;
  }

  /// The segment to emphasise: the one sounding, else the last one started.
  Segment? activeAt(Duration position) {
    Segment? last;
    for (final s in segments) {
      if (s.start > position) break;
      last = s;
    }
    return last ?? (segments.isEmpty ? null : segments.first);
  }

  List<Segment> segmentsOfScene(int sceneNumber) => segments.where((s) => s.scene == sceneNumber).toList();

  /// Every file the episode needs, relative to the book root.
  Set<String> get referencedFiles => {
        ...audio.files,
        for (final s in segments)
          if (s.clip != null) s.clip!.file,
        for (final s in scenes)
          if (s.image != null) s.image!,
      };
}

enum AudioMode { track, clips }

class EpisodeAudio {
  final AudioMode mode;
  final String? voice;
  final String? music;
  final String? sfx;

  /// True for a short bed that loops independently of the timeline; false
  /// (default) for stems that span the whole episode and follow its clock.
  final bool musicLoop;

  const EpisodeAudio({required this.mode, this.voice, this.music, this.sfx, this.musicLoop = false});

  factory EpisodeAudio.fromJson(Map<String, dynamic> json) => EpisodeAudio(
        mode: json['mode'] == 'clips' ? AudioMode.clips : AudioMode.track,
        voice: json['voice'] as String?,
        music: json['music'] as String?,
        sfx: json['sfx'] as String?,
        musicLoop: json['musicLoop'] as bool? ?? false,
      );

  Set<String> get files => {?voice, ?music, ?sfx};
}

class Scene {
  final int number;
  final String title;
  final String? image;
  final String layout;
  final Duration start;
  final Duration end;

  const Scene({
    required this.number,
    required this.title,
    required this.image,
    required this.layout,
    required this.start,
    required this.end,
  });

  bool get isClosing => layout == 'closing';

  factory Scene.fromJson(Map<String, dynamic> json) => Scene(
        number: json['number'] as int,
        title: json['title'] as String? ?? '',
        image: json['image'] as String?,
        layout: json['layout'] as String? ?? 'plate',
        start: Duration(milliseconds: json['startMs'] as int),
        end: Duration(milliseconds: json['endMs'] as int),
      );
}

/// How far the app may trust a segment's timing for sentence highlighting.
enum Timing { verified, estimated, unverified }

class Segment {
  final String id;
  final int scene;
  final String speakerId;
  final String speakerName;
  final String direction;
  final String text;
  final String? trailingText;
  final Duration start;
  final Duration end;
  final Clip? clip;
  final List<Line> lines;
  final Timing timing;

  const Segment({
    required this.id,
    required this.scene,
    required this.speakerId,
    required this.speakerName,
    required this.direction,
    required this.text,
    required this.trailingText,
    required this.start,
    required this.end,
    required this.clip,
    required this.lines,
    required this.timing,
  });

  bool get isNarrator => speakerId == 'NARRATOR' || speakerId == 'SPEAKER_01';

  factory Segment.fromJson(Map<String, dynamic> json) {
    final start = Duration(milliseconds: json['startMs'] as int);
    final end = Duration(milliseconds: json['endMs'] as int);
    final text = json['text'] as String? ?? '';
    final lines = (json['lines'] as List? ?? const [])
        .map((l) => Line.fromJson(l as Map<String, dynamic>))
        .toList();
    return Segment(
      id: json['id'] as String,
      scene: json['scene'] as int,
      speakerId: json['speakerId'] as String? ?? '',
      speakerName: json['speakerName'] as String? ?? '',
      direction: json['direction'] as String? ?? '',
      text: text,
      trailingText: json['trailingText'] as String?,
      start: start,
      end: end,
      clip: json['clip'] == null ? null : Clip.fromJson(json['clip'] as Map<String, dynamic>),
      lines: lines.isEmpty ? [Line(text: text, start: start, end: end)] : lines,
      timing: switch (json['timing']) {
        'estimated' => Timing.estimated,
        'unverified' => Timing.unverified,
        _ => Timing.verified,
      },
    );
  }
}

class Clip {
  final String file;
  final Duration start;
  final Duration end;

  const Clip({required this.file, required this.start, required this.end});

  Duration get length => end - start;

  factory Clip.fromJson(Map<String, dynamic> json) => Clip(
        file: json['file'] as String,
        start: Duration(milliseconds: json['startMs'] as int),
        end: Duration(milliseconds: json['endMs'] as int),
      );
}

class Line {
  final String text;
  final Duration start;
  final Duration end;

  const Line({required this.text, required this.start, required this.end});

  factory Line.fromJson(Map<String, dynamic> json) => Line(
        text: json['text'] as String,
        start: Duration(milliseconds: json['startMs'] as int),
        end: Duration(milliseconds: json['endMs'] as int),
      );
}
