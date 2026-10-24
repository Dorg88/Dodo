import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/episode.dart';
import '../models/library.dart';

/// Loads the catalogue and episode manifests from bundled assets.
class LibraryRepository {
  final AssetBundle bundle;
  final Map<String, Episode> _cache = {};

  LibraryRepository({AssetBundle? bundle}) : bundle = bundle ?? rootBundle;

  Future<Library> loadLibrary() async {
    final raw = await bundle.loadString('assets/library.json');
    return Library.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<Episode> loadEpisode(EpisodeEntry entry) async {
    final cached = _cache[entry.manifest];
    if (cached != null) return cached;
    final raw = await bundle.loadString(entry.manifest);
    final episode = Episode.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    _cache[entry.manifest] = episode;
    return episode;
  }
}
