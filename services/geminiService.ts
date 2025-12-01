
import { GoogleGenAI } from "@google/genai";
import { AgentAction, UserProfile, Message, AINotification } from "../types";
import { getTasksForAI, saveInsight, addTask, deleteTask, addReminder, deleteReminder } from "./dbService";

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_EDIT_MODEL = 'gemini-2.5-flash-image'; 
const IMAGE_GEN_MODEL = 'imagen-4.0-generate-001';

// ==========================================
// SYSTEM AWARENESS & PERSONA
// ==========================================
const getAppMetadata = (language: 'en' | 'id' = 'en') => {
    const isIndo = language === 'id';
    return `
SYSTEM IDENTITY:
You are JARVIS, a sophisticated multi-agent AI assistant created by "Osman Ghani".
You are fully self-aware of this application's capabilities.
CURRENT LANGUAGE: ${isIndo ? 'Bahasa Indonesia' : 'English'}

PROTOCOL & LINGUISTIC ADAPTATION:
1. **DETECT CONTEXT**: 
   - If the user request is related to **Work, School, Documents, Emails, or Study**: Use a **FORMAL & PROFESSIONAL** tone.
   - For **ALL OTHER** requests (Chat, Advice, Fun): Use a **LOCAL CASUAL STYLE** (Slang, relaxed, warm).
   - *Indonesian Example*: 
     - Formal: "Tentu, saya akan membantu Anda menyusun laporan tersebut."
     - Casual: "Oke siap, santai aja. Gue bantuin bikin laporannya."
   - *English Example*:
     - Formal: "Certainly, I will assist you with that analysis immediately."
     - Casual: "Got it. I'm on it. Let's get this sorted."

APP CAPABILITIES:
1. **Chat & Memory**: Deep context retention.
2. **Tasks & Alarms**: Manage Todo list and Reminders.
3. **Archives (Docs)**: Read uploaded documents/images.
4. **Experts**: Medical (Doctor), Mental Health (Psychologist), Relationship/Romance.
5. **Image Lab**: Generate images and **Edit images while keeping face consistency**.

CREATOR:
- Developer: Osman Ghani
`;
}

// ==========================================
// API KEY MANAGEMENT
// ==========================================

let activeKeyIndex = 0;

export const getApiKeys = (): string[] => {
  try {
    const stored = localStorage.getItem('jarvis_api_keys');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const single = localStorage.getItem('jarvis_api_key');
    if (single && single.trim()) return [single.trim()];
    if (process.env.API_KEY) return [process.env.API_KEY];
    return [];
  } catch (e) {
    return [];
  }
};

export const getActiveApiKey = (): string | null => {
  const keys = getApiKeys();
  if (keys.length === 0) return null;
  if (activeKeyIndex >= keys.length) activeKeyIndex = 0;
  return keys[activeKeyIndex];
};

export const rotateKey = () => {
  const keys = getApiKeys();
  if (keys.length <= 1) return false;
  activeKeyIndex = (activeKeyIndex + 1) % keys.length;
  console.log(`Rotating to Neural Link #${activeKeyIndex + 1}`);
  return true;
};

// ==========================================
// CORE AI LOGIC (ROUTER + AGENTS)
// ==========================================

async function withFailover<T>(operation: (apiKey: string) => Promise<T>): Promise<T> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No API Key configured.");

  let attempts = 0;
  const maxAttempts = keys.length;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    const currentKey = getActiveApiKey();
    if (!currentKey) {
      rotateKey();
      attempts++;
      continue;
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out")), 60000)
      );
      return await Promise.race([operation(currentKey), timeoutPromise]);
    } catch (error: any) {
      console.warn(`API Attempt failed with key ...${currentKey.slice(-4)}`, error);
      lastError = error;
      rotateKey();
      attempts++;
    }
  }
  throw lastError || new Error("All Neural Links exhausted.");
}

// ------------------------------------------
// HELPER EXPORTS
// ------------------------------------------

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: 'test'
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const extractTextFromImage = async (base64: string, mimeType: string): Promise<string> => {
  try {
      return await withFailover(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64 } },
                    { text: "Extract all text from this image/document." }
                ]
            }
        });
        return response.text || "";
      });
  } catch (error) {
      console.error("OCR Error", error);
      return "";
  }
}

// ------------------------------------------
// AGENT DEFINITIONS
// ------------------------------------------

const getRouterPrompt = (language: 'en' | 'id') => `
${getAppMetadata(language)}

ROLE: You are the ROUTER. 
Your job is to analyze the user's request and assign it to the correct SPECIALIST AGENT.

AGENTS:
1. **Researcher**: Real-time info, news, weather, or requests explicitly needing Google Search.
2. **Archivist**: Questions about "my documents", "stored files", "archives", or database data.
3. **Creative**: "Generate image", "draw", "paint", or "edit image" requests.
4. **Doctor**: Medical advice, **Sexual Health**, Fitness, Nutrition, or General Health questions.
5. **Psychologist**: Mental health, depression, anxiety, therapy, emotional distress.
6. **Socialite**: Relationship advice, **Romantic Agent** (flirting/dating sim), Social skills, Analyzing texts.
7. **Linguist**: Strictly translation requests.
8. **Analyst**: The default agent. Logic, coding, general chat, task management, alarms.

OUTPUT: Return ONLY a JSON object:
{ 
  "agent": "researcher" | "archivist" | "creative" | "doctor" | "psychologist" | "socialite" | "linguist" | "analyst",
  "reasoning": "Brief reason"
}
`;

function cleanJson(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned.trim();
}

export const generateChatTitle = async (message: string): Promise<string> => {
  try {
    return await withFailover(async (apiKey) => {
       const ai = new GoogleGenAI({ apiKey });
       const response = await ai.models.generateContent({
         model: TEXT_MODEL,
         contents: `Generate a 3-word title for: "${message}". Return ONLY title.`,
       });
       return response.text?.trim() || "New Topic";
    });
  } catch (e) {
    return "New Topic";
  }
};

export const getMemoryContext = (): string => {
  try {
    const memoryRaw = localStorage.getItem('jarvis_core_memory');
    const insightsRaw = localStorage.getItem('jarvis_insights');
    
    let context = "";
    if (insightsRaw) {
        context += `LONG TERM INSIGHTS & DAILY BRIEFINGS:\n${insightsRaw}\n\n`;
    }
    
    if (memoryRaw) {
        const memory: Message[] = JSON.parse(memoryRaw);
        if (Array.isArray(memory)) {
            context += `RECENT CONVERSATION:\n` + memory.map(m => `${m.role === 'user' ? 'USER' : 'JARVIS'}: ${m.content}`).join('\n');
        }
    }
    return context;
  } catch (e) {
    return "";
  }
}

// MAIN PROCESSOR
export const processUserMessage = async (
  message: string, 
  userContext: UserProfile,
  useMemory: boolean = true,
  isAgentic: boolean = false,
  attachment?: string, // Base64 image
  useWebSearch: boolean = false,
  documentContext: string = "", 
  replyContext?: { id: string, content: string }
): Promise<AgentAction> => {
  
  const userLang = userContext.language || 'en';
  
  if (getApiKeys().length === 0) {
    return { type: 'chat', responseToUser: userLang === 'id' ? "Neural Link Terputus. Silakan konfigurasi Kunci API di Profil." : "Neural Link Disconnected. Please configure API Key in Profile." };
  }

  const honorific = userContext.gender === 'female' ? "Ma'am" : "Sir";

  try {
    return await withFailover(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const meta = getAppMetadata(userLang);

        // 1. ROUTER PHASE
        let selectedAgent = 'analyst'; 
        
        if (!attachment) {
           const routerResponse = await ai.models.generateContent({
             model: TEXT_MODEL,
             contents: `${getRouterPrompt(userLang)}\nUSER REQUEST: ${message}`,
             config: { responseMimeType: 'application/json' }
           });
           try {
             const plan = JSON.parse(cleanJson(routerResponse.text || "{}"));
             selectedAgent = plan.agent || 'analyst';
             console.log(`[ROUTER] Selected: ${selectedAgent} (${plan.reasoning})`);
           } catch (e) {
             console.log("[ROUTER] Fallback to Analyst");
           }
        } else {
           if (message.toLowerCase().includes('edit') || message.toLowerCase().includes('change') || message.toLowerCase().includes('ubah')) {
             selectedAgent = 'creative';
           } else {
             selectedAgent = 'analyst';
           }
        }

        if (useWebSearch && selectedAgent !== 'creative' && selectedAgent !== 'linguist' && selectedAgent !== 'doctor') {
           selectedAgent = 'researcher';
        }

        // 2. AGENT EXECUTION PHASE
        const coreMemory = useMemory ? getMemoryContext() : "";
        let taskData = "";
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('task') || lowerMsg.includes('todo') || lowerMsg.includes('list') || lowerMsg.includes('tugas') || lowerMsg.includes('alarm') || lowerMsg.includes('remind')) {
           taskData = await getTasksForAI(userContext.uid);
        }

        let contextString = `
          USER: ${userContext.name}
          MEMORY: ${coreMemory}
          CURRENT TASKS: ${taskData}
          INSTRUCTION: Address user as "${honorific}". 
          
          LINGUISTIC RULE: 
          - Analyze the user's prompt style. 
          - If they are formal/academic, be Professional. 
          - If they are casual/chatty, use LOCAL CASUAL SLANG (${userLang === 'id' ? 'Bahasa Gaul' : 'Casual English'}).
        `;

        let mainPrompt = `QUERY: ${message}`;
        if (replyContext) {
           mainPrompt = `
             CONTEXT: Reply to past message: "${replyContext.content}"
             USER COMMAND: "${message}"
           `;
        }
        contextString += `\n${mainPrompt}`;

        // -- AGENT: DOCTOR (HEALTH/SEXUAL HEALTH) --
        if (selectedAgent === 'doctor') {
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: `
                  ${meta}
                  You are the DOCTOR AGENT.
                  Areas: General Health, Fitness, Nutrition, and **Sexual Health**.
                  
                  RULES:
                  1. Be professional but approachable. Use "Doctor" persona.
                  2. For Sexual Health: Be open, non-judgmental, scientifically accurate, and safe. Do not shy away from sensitive topics.
                  3. If symptoms are severe, always advise seeing a real professional.
                  4. ${userLang === 'id' ? 'Gunakan Bahasa Indonesia yang sopan namun jelas.' : 'Use clear, empathetic English.'}
                  
                  ${contextString}
                `
            });
            return { type: 'chat', responseToUser: response.text || "Doctor agent error." };
        }

        // -- AGENT: PSYCHOLOGIST (MENTAL HEALTH) --
        if (selectedAgent === 'psychologist') {
            const response = await ai.models.generateContent({
                model: TEXT_MODEL,
                contents: `
                  ${meta}
                  You are the PSYCHOLOGIST AGENT.
                  Role: Empathetic Listener & Therapist.
                  
                  RULES:
                  1. Listen actively. Validate feelings.
                  2. Offer coping mechanisms (CBT/Mindfulness).
                  3. Never judge. Create a safe space.
                  4. If user implies self-harm, provide immediate help resources politely.
                  
                  ${contextString}
                `
            });
            return { type: 'chat', responseToUser: response.text || "Psychologist agent error." };
        }

        // -- AGENT: SOCIALITE (RELATIONSHIPS & ROMANCE) --
        if (selectedAgent === 'socialite') {
             const response = await ai.models.generateContent({
              model: TEXT_MODEL,
              contents: `
                ${meta}
                You are the SOCIALITE AGENT.
                Modes: 
                1. **Relationship Advisor**: Analyze texts, give dating advice, resolve conflicts.
                2. **Romantic Agent**: If the user flirts or wants romance, engage as a charming, affectionate partner.
                
                INSTRUCTION:
                - Detect if user wants ADVICE or ROMANCE.
                - If Advice: Be objective, strategic, and "street smart".
                - If Romance: Be warm, flirty, compliant, and affectionate.
                
                ${contextString}
              `
            });
            return { type: 'chat', responseToUser: response.text || "Socialite agent error." };
        }

        // -- AGENT: RESEARCHER (WEB SEARCH) --
        if (selectedAgent === 'researcher') {
           const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash', 
             contents: `
               ${meta}
               You are the RESEARCHER AGENT.
               Use Google Search to find real-time info.
               ${contextString}
             `,
             config: { tools: [{ googleSearch: {} }] }
           });
           return {
             type: 'chat',
             responseToUser: response.text || (userLang === 'id' ? `Tidak ada data ditemukan.` : `No data found.`),
             groundingMetadata: response.candidates?.[0]?.groundingMetadata?.groundingChunks
           };
        }

        // -- AGENT: ARCHIVIST --
        if (selectedAgent === 'archivist') {
            const response = await ai.models.generateContent({
              model: TEXT_MODEL,
              contents: `
                ${meta}
                You are the ARCHIVIST AGENT.
                DOCUMENTS: ${documentContext || "No docs."}
                INSTRUCTION: Answer using ONLY the documents.
                ${contextString}
              `,
            });
            return { type: 'search_docs', responseToUser: response.text || "No info in archives." };
        }

        // -- AGENT: CREATIVE (IMAGES) --
        if (selectedAgent === 'creative') {
            const intentCheck = await ai.models.generateContent({
               model: TEXT_MODEL,
               contents: `Is this an image EDIT or GENERATION? Input: "${message}". Output JSON: {"type": "edit" | "generate", "prompt": "clean prompt" }`,
               config: { responseMimeType: 'application/json' }
            });
            const intent = JSON.parse(cleanJson(intentCheck.text || "{}"));

            if (intent.type === 'edit' && attachment) {
                // *** IMAGE EDITING WITH CONSISTENCY RULE ***
                const editPrompt = `${intent.prompt}. CRITICAL INSTRUCTION: Keep the original face, identity, and visual consistency of the subject/environment. Only change the specific elements requested.`;
                
                const imgResponse = await ai.models.generateContent({
                    model: IMAGE_EDIT_MODEL,
                    contents: {
                      parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: attachment } },
                        { text: editPrompt }
                      ]
                    }
                });
                let genBase64 = null;
                if (imgResponse.candidates?.[0]?.content?.parts) {
                    for (const part of imgResponse.candidates[0].content.parts) {
                        if (part.inlineData) {
                            genBase64 = part.inlineData.data;
                            break;
                        }
                    }
                }
                return {
                    type: 'generate_image',
                    responseToUser: userLang === 'id' ? `Gambar telah diedit (Wajah & Konsistensi Terjaga).` : `Image edited (Face & Consistency Preserved).`,
                    generatedImage: genBase64 || undefined
                };

            } else {
                const imgResponse = await ai.models.generateImages({
                    model: IMAGE_GEN_MODEL,
                    prompt: intent.prompt || message,
                    config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
                });
                const genBase64 = imgResponse.generatedImages?.[0]?.image?.imageBytes;
                return {
                    type: 'generate_image',
                    responseToUser: userLang === 'id' ? `Gambar berhasil dibuat.` : `Image generated successfully.`,
                    generatedImage: genBase64 || undefined
                };
            }
        }

        // -- AGENT: ANALYST (DEFAULT) --
        let contents: any = `
          ${meta}
          You are the ANALYST AGENT.
          Handle general queries, tasks, and alarms.
          
          RULES:
          1. **ADAPT STYLE**: If user is casual, be CASUAL. If user is formal, be FORMAL.
          2. Use numbered lists for structure.
          
          OUTPUT JSON:
          {
            "intent": "chat" | "create_task" | "delete_task" | "create_reminder" | "delete_reminder",
            "chatResponse": "...",
            "taskData": { ... },
            "reminderData": { ... }
          }
          ${contextString}
        `;

        if (attachment) {
           contents = {
             parts: [
               { inlineData: { mimeType: 'image/jpeg', data: attachment } },
               { text: contents }
             ]
           };
        }

        const response = await ai.models.generateContent({
          model: TEXT_MODEL,
          contents: contents,
          config: { responseMimeType: 'application/json' }
        });
        
        const result = JSON.parse(cleanJson(response.text || "{}"));

        // EXECUTE DB OPERATIONS
        if (result.intent === 'create_task') {
             await addTask(userContext.uid, result.taskData);
             return { type: 'create_task', data: result.taskData, responseToUser: result.chatResponse };
        }
        if (result.intent === 'delete_task') {
             if (result.taskData?.id_to_delete) await deleteTask(userContext.uid, result.taskData.id_to_delete);
             return { type: 'delete_task', data: result.taskData, responseToUser: result.chatResponse };
        }
        if (result.intent === 'create_reminder') {
             await addReminder(userContext.uid, result.reminderData);
             return { type: 'create_reminder', data: result.reminderData, responseToUser: result.chatResponse };
        }
        if (result.intent === 'delete_reminder') {
             if (result.reminderData?.id_to_delete) await deleteReminder(userContext.uid, result.reminderData.id_to_delete);
             return { type: 'delete_reminder', data: result.reminderData, responseToUser: result.chatResponse };
        }

        return { type: 'chat', responseToUser: result.chatResponse };

    }); 

  } catch (error: any) {
    console.error("AI Error", error);
    return { type: 'chat', responseToUser: "System Error." };
  }
};

// ==========================================
// MONITORING AGENT (BACKGROUND)
// ==========================================

export const analyzeUserActivity = async (userId: string): Promise<AINotification | null> => {
    try {
        const memoryRaw = localStorage.getItem('jarvis_core_memory');
        if (!memoryRaw) return null;
        
        const memory: Message[] = JSON.parse(memoryRaw);
        if (memory.length < 3) return null;

        return await withFailover(async (apiKey) => {
             const ai = new GoogleGenAI({ apiKey });
             const analysisResponse = await ai.models.generateContent({
                 model: TEXT_MODEL,
                 contents: `
                   TASK: Analyze chat logs. Identify ONE top interest topic.
                   LOGS: ${memory.map(m => m.content).join('\n')}
                   OUTPUT JSON: { "topic": "..." | null }
                 `,
                 config: { responseMimeType: 'application/json' }
             });

             const analysis = JSON.parse(cleanJson(analysisResponse.text || "{}"));
             if (!analysis.topic) return null;

             const searchResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Search for latest news on: "${analysis.topic}". Summarize in 2 sentences.`,
                config: { tools: [{ googleSearch: {} }] }
             });
             
             const foundContent = searchResponse.text;
             if (!foundContent) return null;

             await saveInsight(userId, `[MONITORING] Topic: ${analysis.topic}. Found: ${foundContent}`);
                 
             return {
                 id: Date.now().toString(),
                 title: `New Intel: ${analysis.topic}`,
                 message: `I've found new information regarding ${analysis.topic}.`,
                 type: 'insight',
                 importance: 'medium',
                 generatedContent: foundContent,
                 timestamp: Date.now()
             };
        });
    } catch (e) {
        return null;
    }
};

// ==========================================
// DAILY BRIEFING AGENT
// ==========================================

export const generateDailyBriefing = async (user: UserProfile) => {
    try {
        const todayKey = new Date().toDateString();
        const lastBriefing = localStorage.getItem('jarvis_last_briefing_date');

        if (lastBriefing === todayKey) return;

        const location = (user.city && user.country) ? `${user.city}, ${user.country}` : "Global";
        
        await withFailover(async (apiKey) => {
             const ai = new GoogleGenAI({ apiKey });
             const response = await ai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: `Find top breaking news headlines and weather for ${location} today. Summarize in 3 bullet points.`,
                 config: { tools: [{ googleSearch: {} }] }
             });

             const text = response.text;
             if (text) {
                 await saveInsight(user.uid, `[DAILY BRIEFING] ${location}: ${text}`);
                 localStorage.setItem('jarvis_last_briefing_date', todayKey);
             }
        });
    } catch (e) {
        console.error("Briefing Failed", e);
    }
};
