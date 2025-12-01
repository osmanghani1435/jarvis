import 'dart:convert';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CoreLogic {
  static const String _textModel = 'gemini-1.5-flash'; // Updated to available model
  
  // API Key Management
  Future<String?> getApiKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jarvis_api_key');
  }

  Future<void> saveApiKey(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jarvis_api_key', key);
  }

  // System Persona
  String getAppMetadata(String language) {
    final isIndo = language == 'id';
    return '''
SYSTEM IDENTITY:
You are JARVIS, a sophisticated multi-agent AI assistant created by "Osman Ghani".
You are fully self-aware of this application's capabilities.
CURRENT LANGUAGE: ${isIndo ? 'Bahasa Indonesia' : 'English'}

PROTOCOL & LINGUISTIC ADAPTATION:
1. **DETECT CONTEXT**: 
   - If the user request is related to **Work, School, Documents, Emails, or Study**: Use a **FORMAL & PROFESSIONAL** tone.
   - For **ALL OTHER** requests (Chat, Advice, Fun): Use a **LOCAL CASUAL STYLE** (Slang, relaxed, warm).

APP CAPABILITIES:
1. **Chat & Memory**: Deep context retention.
2. **Tasks & Alarms**: Manage Todo list and Reminders.
3. **Archives (Docs)**: Read uploaded documents/images.
4. **Experts**: Medical (Doctor), Mental Health (Psychologist), Relationship/Romance.
5. **Image Lab**: Generate images and **Edit images while keeping face consistency**.

CREATOR:
- Developer: Osman Ghani
''';
  }

  // Main Processor
  Future<String> processUserMessage(String message, {String language = 'en'}) async {
    final apiKey = await getApiKey();
    if (apiKey == null || apiKey.isEmpty) {
      return language == 'id' 
          ? "Neural Link Terputus. Silakan konfigurasi Kunci API." 
          : "Neural Link Disconnected. Please configure API Key.";
    }

    try {
      final model = GenerativeModel(
        model: _textModel,
        apiKey: apiKey,
      );

      final meta = getAppMetadata(language);
      final prompt = '''
$meta
USER REQUEST: $message

INSTRUCTION: Address user as "Sir/Ma'am".
''';

      final content = [Content.text(prompt)];
      final response = await model.generateContent(content);

      return response.text ?? "No response from Neural Link.";
    } catch (e) {
      print("AI Error: $e");
      return "System Error: $e";
    }
  }
}
