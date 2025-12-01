import 'dart:convert';
import 'package:flutter/services.dart';

class VersionManager {
  Map<String, dynamic>? _data;

  /// Reads the JSON file from assets
  Future<void> loadVersionHistory() async {
    try {
      final String response = await rootBundle.loadString('assets/app_version_log.json');
      _data = json.decode(response);
    } catch (e) {
      print("Error loading version history: $e");
    }
  }

  /// Returns the "last_update" string
  String getLatestUpdate() {
    if (_data == null) return "Data not loaded";
    return _data!['last_update'] ?? "Unknown";
  }

  /// Returns the "history" array
  List<dynamic> getAllHistory() {
    if (_data == null) return [];
    return _data!['history'] ?? [];
  }
}
