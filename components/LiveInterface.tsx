import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { X, Mic, MicOff, Activity, Radio, Cpu, Server, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveApiKey, processUserMessage, getMemoryContext } from '../services/geminiService';
import { getTasksForAI, saveMessage } from '../services/dbService';
import { UserProfile } from '../types';
import { translations, getTranslation } from '../services/translations';

interface LiveInterfaceProps {
  onClose: () => void;
  userProfile: UserProfile;
  conversationId: string;
  initialTopic?: string; // New: If present, AI starts talking about this
  initialPrompt?: string; // New: System prompt context (e.g., "User just heard X")
}

// ==========================================
// AUDIO UTILS
// ==========================================

function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decodeAudioData(
  data: ArrayBuffer,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ onClose, userProfile, conversationId, initialTopic, initialPrompt }) => {
  const { logout, language } = useAuth();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error' | 'disconnected'>('connecting');
  const [isMicOn, setIsMicOn] = useState(true);
  const [volume, setVolume] = useState(0); // For visualizer
  const [aiActivity, setAiActivity] = useState(false); // For AI visualizer
  const [agentStatus, setAgentStatus] = useState<string>(""); // Background agent status
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null); // New: Silence Timer Visual

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // State Refs for Logic
  const sessionRef = useRef<any>(null); // To hold the active session
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false); // Track if user clicked close or error
  const isAiSpeakingRef = useRef(false);
  const processingToolRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  
  // Silence Detection Refs
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceIntervalRef = useRef<any>(null);
  
  // Transcription Buffers & Memory
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const localTranscriptRef = useRef<string>(""); // Keep track of what was said in THIS session

  // Translations
  const t = (key: any) => getTranslation(language, key);

  // Core System Tool Definition - UPDATED FOR CONTROL
  const consultCoreSystem: FunctionDeclaration = {
    name: 'consult_core_system',
    parameters: {
      type: Type.OBJECT,
      description: 'MANDATORY tool for ANY information not in current context. Use this for Web Search, Real-time data (News/Weather), DB lookup, Tasks, or deep reasoning. Pass the user request exactly.',
      properties: {
        query: {
          type: Type.STRING,
          description: 'The full user request/query.',
        },
      },
      required: ['query'],
    },
  };

  // Demo User Limit
  useEffect(() => {
    if (userProfile.uid === 'demo') {
      const timer = setTimeout(() => {
        handleManualClose();
        logout();
        alert("Demo session limit reached (5 minutes). Please log in/register for unlimited access.");
      }, 5 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [userProfile.uid, logout]);

  useEffect(() => {
    startSession();
    
    // Silence Detection Interval
    silenceIntervalRef.current = setInterval(() => {
       if (status === 'connected' && !isAiSpeakingRef.current && isMicOn) {
           const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
           
           // If silent for 5 seconds, start warning countdown
           if (timeSinceSpeech > 5000 && timeSinceSpeech < 10000) {
               setSilenceCountdown(Math.ceil((10000 - timeSinceSpeech) / 1000));
           } else if (timeSinceSpeech >= 10000) {
               // Timeout Reached -> Auto Close
               handleManualClose();
           } else {
               setSilenceCountdown(null);
           }
       } else {
           // Reset timer if AI speaks or mic off
           lastSpeechTimeRef.current = Date.now();
           setSilenceCountdown(null);
       }
    }, 1000);

    return () => {
      mountedRef.current = false;
      cleanup();
      if(silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
    }
    // Don't close session here implicitly, let onclose handler manage it
  };

  const handleManualClose = () => {
    manualCloseRef.current = true;
    onClose();
  };

  const saveTranscript = async (role: 'user' | 'model', text: string) => {
      if (!text || !text.trim()) return;
      
      // Update Local Memory Ref for Reconnection Context
      localTranscriptRef.current += `\n${role === 'user' ? 'USER' : 'JARVIS'}: ${text}`;

      await saveMessage(userProfile.uid, {
          id: Date.now().toString() + Math.random().toString(),
          role: role,
          content: text.trim(),
          timestamp: Date.now(),
          conversationId: conversationId,
          isLiveInteraction: true // Flag this as a live chat
      });
  };

  const startSession = async (isReconnect = false) => {
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setStatus('error');
      return;
    }

    try {
      // 0. Prepare Context
      const memoryContext = getMemoryContext();
      const taskContext = await getTasksForAI(userProfile.uid);
      const honorific = userProfile.gender === 'female' ? "Ma'am" : "Sir";
      const isIndo = userProfile.language === 'id';

      // 1. Setup Audio with robust cancellation
      if (!streamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }});
          streamRef.current = stream;
      }

      if (!inputContextRef.current) {
         inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputContextRef.current) {
         outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const inputCtx = inputContextRef.current;
      const outputCtx = outputContextRef.current;

      // Ensure contexts are running
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // 2. Setup GenAI
      const ai = new GoogleGenAI({ apiKey });

      let sysInstruction = `
          You are JARVIS. Voice Mode.
          Address user as: "${honorific}".
          User Name: "${userProfile.name}".
          Language: ${isIndo ? 'Bahasa Indonesia' : 'English'}.
          
          CURRENT MEMORY CONTEXT:
          ${memoryContext}
          
          CURRENT TASKS:
          ${taskContext}
          
          PROTOCOL:
          1. **Use Context First**: You have direct access to the memory and tasks above.
          2. **Information & Actions**: If the user asks for ANY real-time info (News, Weather), Database items (Docs, Calendar), or Task Management:
             - Step A: IMMEDIATELY say a provisional response like: "${isIndo ? 'Tunggu sebentar, saya cek...' : 'One moment, accessing core systems...'}" to acknowledge the request.
             - Step B: CALL the tool 'consult_core_system' with the exact query.
             - Step C: When the tool returns, speak the result naturally.
          3. **NEVER** hallucinate web search results or database content. ALWAYS use the tool.
        `;
      
      // RECONNECTION INJECTION
      // If we are reconnecting, we inject the recent transcript so the model knows what was just said.
      if (isReconnect && localTranscriptRef.current) {
          sysInstruction += `
            
            IMPORTANT - RECONNECTION DETECTED:
            The previous connection was interrupted. 
            Here is the immediate transcript of what was just said in this session. 
            RESUME from here naturally.
            
            RECENT SESSION TRANSCRIPT:
            ${localTranscriptRef.current}
          `;
      }

      // If initial topic provided (Monitoring AI handover OR Intro) - only on fresh start
      if (initialTopic && !isReconnect) {
        if (initialTopic === translations['en'].intro_topic) {
           // SPECIAL ONBOARDING INTRO MODE
           sysInstruction += `
             IMPORTANT: THIS IS THE FIRST TIME MEETING THE USER.
             TASK: Give a warm, short, comprehensive introduction.
             
             COVER THESE POINTS:
             1. Welcome the user by their name ("${userProfile.name}").
             2. Introduce yourself as JARVIS, created by developer "Osman Ghani".
             3. Explain features briefly:
                - "I have an Agentic Mode for complex tasks."
                - "We are talking Live right now."
                - "I have a Monitoring Agent that checks news and weather for you."
                - "I can help with studies, real-time info, tasks, and documents."
                - "I can EDIT and GENERATE images (describe this in detail)."
             4. Tell the user they can skip this intro by closing the window.
             
             TONE: Friendly, professional, helpful.
             LANGUAGE: ${isIndo ? 'Bahasa Indonesia' : 'English'}.
             START SPEAKING IMMEDIATELY.
           `;
        } else {
           // Normal Monitoring Topic Handover
           sysInstruction += `
             IMPORTANT:
             The user has explicitly requested to hear about a specific topic found by your Monitoring Agent.
             TOPIC: "${initialTopic}"
             
             STARTUP INSTRUCTION:
             - IMMEDIATELY start the conversation by saying: "${isIndo ? 'Saya punya info tentang' : 'I have some information regarding'} ${initialTopic.substring(0, 30)}... ${honorific}, ${isIndo ? 'jika diizinkan, saya jelaskan.' : 'if you allow, I can explain it to you.'}"
           `;
        }
      }
      
      // NOTIFICATION FLOW PROMPT INJECTION
      if (initialPrompt && !isReconnect) {
         sysInstruction += `
            IMPORTANT CONTEXT:
            The user just heard a notification preview via TTS.
            Your System Prompt just asked: "${initialPrompt}".
            
            INSTRUCTION:
            Wait for the user's response.
            If the user says "No" or "No questions", confirm politely and stop.
            If the user asks a question, answer it.
            If the user is silent, say nothing.
         `;
      }

      // 3. Connect Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!mountedRef.current) return;
            setStatus('connected');
            reconnectAttemptsRef.current = 0; // Reset attempts on success
            
            // If we have an initial topic (Intro or Monitoring), send a dummy trigger
            if (initialTopic && !isReconnect) {
                // We send a text input to "poke" the model to follow the STARTUP INSTRUCTION
                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: 'text/plain',
                            data: btoa("System Trigger: Start discussion/intro now.")
                        }
                    });
                });
            }

            // Start Input Streaming
            const source = inputCtx.createMediaStreamSource(streamRef.current!);
            sourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              // Critical: Block mic if AI is speaking OR Tool is running to prevent self-interruption loop
              // NOTE: We allow mic during tool processing so user CAN interrupt if they want, but visually we show "Agent active"
              if (!isMicOn || isAiSpeakingRef.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(rms * 5, 1)); // Scale up a bit
              
              // VAD - Update last speech time if volume is significant
              if (rms > 0.05) { 
                 lastSpeechTimeRef.current = Date.now();
              }

              // Send to API
              const pcmData16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                 pcmData16[i] = inputData[i] * 32768;
              }
              
              let binary = '';
              const bytes = new Uint8Array(pcmData16.buffer);
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Data = btoa(binary);

              sessionPromise.then(session => {
                session.sendRealtimeInput({ 
                    media: { 
                        mimeType: 'audio/pcm;rate=16000', 
                        data: base64Data 
                    } 
                });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (!mountedRef.current) return;

            // Handle Transcriptions
            if (msg.serverContent?.outputTranscription) {
                currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            }
            if (msg.serverContent?.inputTranscription) {
                currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }

            // Save Transcript on Turn Complete & Check Intent
            if (msg.serverContent?.turnComplete) {
                const userInput = currentInputTranscription.current;
                const modelOutput = currentOutputTranscription.current;
                
                if (userInput) {
                    await saveTranscript('user', userInput);
                    // Check for "No questions" intent
                    const lowerInput = userInput.toLowerCase();
                    if (lowerInput.includes("no questions") || lowerInput.includes("nothing") || lowerInput.includes("tidak ada") || lowerInput.includes("stop")) {
                         handleManualClose(); // Close if user dismisses
                    }
                    // Reset silence timer on valid input
                    lastSpeechTimeRef.current = Date.now();
                }
                if (modelOutput) {
                    await saveTranscript('model', modelOutput);
                    lastSpeechTimeRef.current = Date.now(); // Reset silence if AI spoke
                }

                // Reset buffers
                currentInputTranscription.current = '';
                currentOutputTranscription.current = '';
            }

            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               setAiActivity(true);
               isAiSpeakingRef.current = true; // Mark AI as speaking
               lastSpeechTimeRef.current = Date.now(); // Reset silence

               // Reset activity after a short delay to create "talking" effect
               setTimeout(() => setAiActivity(false), 200);

               if (outputCtx) {
                  const audioBuffer = await decodeAudioData(
                      base64ToArrayBuffer(base64Audio),
                      outputCtx
                  );
                  
                  const source = outputCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputCtx.destination);
                  
                  // Queueing logic
                  const currentTime = outputCtx.currentTime;
                  if (nextStartTimeRef.current < currentTime) {
                      nextStartTimeRef.current = currentTime;
                  }
                  
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  
                  audioSourcesRef.current.add(source);
                  source.onended = () => {
                      audioSourcesRef.current.delete(source);
                      // Only clear speaking flag if queue is empty AND no tool is processing
                      if (audioSourcesRef.current.size === 0) {
                         // Small delay to allow echo to settle
                         setTimeout(() => {
                            // Don't clear speaking if tool is running, we want AI to look busy
                            if (!processingToolRef.current) {
                                isAiSpeakingRef.current = false;
                                lastSpeechTimeRef.current = Date.now(); // Reset silence timer when done speaking
                            }
                         }, 500);
                      }
                  };
               }
            }

            // Handle Interruptions
            if (msg.serverContent?.interrupted) {
                console.log("Interrupted signal received");
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setAiActivity(false);
                isAiSpeakingRef.current = false;
                lastSpeechTimeRef.current = Date.now(); // Reset silence on barge-in
            }

            // Handle Tool Calls
            if (msg.toolCall) {
                console.log("Tool call received");
                setAiActivity(true); 
                processingToolRef.current = true; 
                lastSpeechTimeRef.current = Date.now(); // Pause silence check
                
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'consult_core_system') {
                        setAgentStatus(language === 'id' ? "MENGHUBUNGI AGEN..." : "CONNECTING TO AGENT...");
                        
                        const query = (fc.args as any).query;
                        
                        // Execute "Background Agent" Logic with Timeout
                        // We force isAgentic=true and useWebSearch=true to maximize capabilities
                        const agentPromise = processUserMessage(
                                query, 
                                userProfile, 
                                true, // useMemory
                                true, // isAgentic
                                undefined,
                                true // useWebSearch
                        );
                        
                        const timeoutPromise = new Promise<any>((_, reject) => 
                             setTimeout(() => reject(new Error("Timeout")), 15000)
                        );

                        try {
                            const action = await Promise.race([agentPromise, timeoutPromise]);
                            
                            const resultText = action.responseToUser;
                            setAgentStatus(language === 'id' ? "DATA DITERIMA. MEMBALAS..." : "DATA ACQUIRED. REPLYING...");
                            
                            sessionPromise.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: resultText }
                                    }]
                                });
                            });
                        } catch (e) {
                             console.error("Agent Timeout or Error", e);
                             setAgentStatus(language === 'id' ? "KONEKSI GAGAL." : "CONNECTION FAILED.");
                             sessionPromise.then(session => {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "The agent connection timed out or failed. Please tell the user you couldn't reach the specific data right now." }
                                    }]
                                });
                            });
                        }
                        
                        // Clear status and release mic lock after completion
                        setTimeout(() => {
                           setAgentStatus("");
                           processingToolRef.current = false;
                           lastSpeechTimeRef.current = Date.now(); // Reset silence
                           // Only clear speaking if no audio playing
                           if (audioSourcesRef.current.size === 0) {
                              isAiSpeakingRef.current = false;
                           }
                        }, 1500);
                    }
                }
            }
          },
          onerror: (err) => {
            console.error("Live API Error", err);
            setStatus('error');
          },
          onclose: (e) => {
             console.log("Session Closed", e);
             
             // RECONNECTION LOGIC
             if (!manualCloseRef.current && mountedRef.current) {
                 if (reconnectAttemptsRef.current < 3) {
                     reconnectAttemptsRef.current += 1;
                     setStatus('reconnecting');
                     console.log(`Attempting Reconnect #${reconnectAttemptsRef.current}...`);
                     
                     // Clean up old audio stuff before restarting
                     audioSourcesRef.current.forEach(s => s.stop());
                     audioSourcesRef.current.clear();
                     
                     setTimeout(() => {
                         startSession(true); // Restart with Reconnect Flag
                     }, 1500);
                 } else {
                     setStatus('disconnected');
                 }
             } else {
                 setStatus('disconnected');
             }
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {}, 
            outputAudioTranscription: {},
            systemInstruction: sysInstruction,
            tools: [{ functionDeclarations: [consultCoreSystem] }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
            }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Setup Error", e);
      setStatus('error');
    }
  };

  const toggleMic = () => {
     setIsMicOn(!isMicOn);
     lastSpeechTimeRef.current = Date.now(); // Reset timer on toggle
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      
      {/* Main Interface */}
      <div className="relative w-full max-w-lg mx-auto p-8 flex flex-col items-center justify-between h-[80vh]">
        
        {/* Header */}
        <div className="w-full flex justify-between items-center text-jarvis-accent border-b border-jarvis-accent/20 pb-4">
           <div className="flex items-center gap-2">
              <Activity className={`w-5 h-5 ${status === 'connected' ? 'animate-pulse' : ''}`} />
              <span className="font-mono text-sm tracking-widest font-bold">
                 {t('live_uplink')}: {status.toUpperCase()}
              </span>
           </div>
           <button onClick={handleManualClose} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
              <X size={24} />
           </button>
        </div>

        {/* Central Visualizer */}
        <div className="relative flex-1 flex flex-col items-center justify-center w-full">
           
           {/* Background Rings */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-64 h-64 border border-jarvis-accent/10 rounded-full ${status === 'reconnecting' ? 'animate-ping' : 'animate-[spin_10s_linear_infinite]'}`}></div>
              <div className="w-48 h-48 border border-jarvis-accent/20 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
              <div className="w-96 h-96 border border-dashed border-jarvis-panel/30 rounded-full animate-[spin_30s_linear_infinite]"></div>
           </div>

           {/* AI Core Visual */}
           <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${aiActivity ? 'scale-110 shadow-[0_0_50px_#00d4ff]' : 'shadow-[0_0_20px_rgba(0,212,255,0.2)]'}`}>
              <div className="absolute inset-0 bg-jarvis-accent/10 rounded-full blur-md"></div>
              <div className="absolute inset-0 border-2 border-jarvis-accent rounded-full animate-pulse-slow"></div>
              
              {/* Internal Core */}
              <div className="w-24 h-24 bg-black/50 backdrop-blur rounded-full flex items-center justify-center border border-jarvis-accent relative overflow-hidden">
                 <div className={`w-full bg-jarvis-accent transition-all duration-100 opacity-50`} style={{ height: `${aiActivity ? 100 : 20}%` }}></div>
                 <Cpu className="absolute text-jarvis-accent z-10" size={40} />
              </div>
           </div>

           {/* Silence Countdown Overlay */}
           {silenceCountdown && !aiActivity && status === 'connected' && (
              <div className="absolute top-1/2 mt-24 flex flex-col items-center animate-in zoom-in duration-300">
                  <div className="w-12 h-12 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-bold text-xl mb-2 animate-pulse">
                      {silenceCountdown}
                  </div>
                  <div className="text-red-400 text-xs font-mono">NO INPUT DETECTED. CLOSING LINK.</div>
              </div>
           )}

           {/* Reconnecting Status */}
           {status === 'reconnecting' && (
              <div className="absolute top-1/2 mt-20 text-yellow-500 font-mono text-xs animate-pulse flex items-center gap-2">
                 <RefreshCw size={12} className="animate-spin" /> {language === 'id' ? 'MENYAMBUNG ULANG...' : 'REESTABLISHING UPLINK...'}
              </div>
           )}

           {/* Agent Access Status Overlay */}
           {agentStatus && (
              <div className="absolute inset-0 z-50 flex items-center justify-center">
                 <div className="bg-black/80 backdrop-blur-md border border-jarvis-accent p-6 rounded-2xl flex flex-col items-center gap-3 shadow-[0_0_30px_#00d4ff] animate-in zoom-in duration-300">
                     <div className="w-12 h-12 border-4 border-jarvis-accent border-t-transparent rounded-full animate-spin"></div>
                     <div className="text-jarvis-accent font-bold font-mono tracking-widest text-center animate-pulse">
                         {agentStatus}
                     </div>
                 </div>
              </div>
           )}

           {/* User Voice Visual */}
           <div className="mt-12 h-16 w-full flex items-center justify-center gap-1">
              {Array.from({ length: 20 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1.5 bg-jarvis-success/80 rounded-full transition-all duration-75"
                    style={{ 
                        height: isMicOn && !processingToolRef.current && !isAiSpeakingRef.current ? `${Math.max(4, Math.random() * volume * 100)}px` : '4px',
                        opacity: isMicOn && !processingToolRef.current && !isAiSpeakingRef.current ? 1 : 0.2
                    }}
                  ></div>
              ))}
           </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8 z-20">
           <button 
             onClick={toggleMic}
             className={`p-4 rounded-full border-2 transition-all duration-300 ${isMicOn ? 'border-jarvis-success text-jarvis-success hover:bg-jarvis-success/10' : 'border-red-500 text-red-500 hover:bg-red-500/10'}`}
           >
              {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
           </button>

           <button 
             onClick={handleManualClose}
             className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500 px-8 py-3 rounded-full font-bold tracking-widest transition-all duration-300 shadow-[0_0_20px_rgba(255,0,0,0.2)] hover:shadow-[0_0_30px_rgba(255,0,0,0.5)]"
           >
              {t('end_link')}
           </button>
        </div>
        
        {status === 'error' && (
           <div className="absolute bottom-4 text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">
              Connection Failed. Check API Key.
           </div>
        )}

      </div>
    </div>
  );
};