import React, { useState, useRef, useEffect } from 'react';
import { Send, Cpu, Trash2, AlertTriangle, MessageSquare, Plus, Star, BrainCircuit, X, ChevronRight, ChevronLeft, Menu, Paperclip, Image as ImageIcon, Zap, Globe, Link as LinkIcon, Download, Copy, Check, Reply, ZoomIn, ZoomOut, Maximize2, Square, Phone, Radio, Pin, PinOff, Headphones, Eraser, Upload, Grid, Archive, RotateCcw } from 'lucide-react';
import { Message, AgentAction, Conversation } from '../types';
import { useAuth } from '../context/AuthContext';
import { processUserMessage, generateChatTitle, getApiKeys } from '../services/geminiService';
import { saveMessage, getConversationHistory, createNewConversation, updateConversationTitle, softDeleteConversation, deleteConversationPermanently, restoreConversation, getConversations, getTrashedConversations, getAllDocuments, toggleConversationPin, clearChatHistory, addToGallery, deleteSingleMessage } from '../services/dbService';
import { GalleryView } from './GalleryView'; 
import { getTranslation, translations } from '../services/translations';

export const ChatInterface: React.FC = () => {
  const { userProfile, notifications, clearNotification, isNewUser, setIsNewUser, language, setShowLiveInterface, setLiveOptions } = useAuth();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Chat History & Navigation State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('primary');
  const [isNewSession, setIsNewSession] = useState(false);
  
  // Modes
  const [showHistory, setShowHistory] = useState(window.innerWidth >= 768);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isAgentic, setIsAgentic] = useState(false); 
  const [useWebSearch, setUseWebSearch] = useState(false);
  
  // Data Context
  const [docContext, setDocContext] = useState<string>("");

  // Attachments & Reply
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false); 
  const [showGalleryPicker, setShowGalleryPicker] = useState(false); 
  const [isDragging, setIsDragging] = useState(false); 

  // Thinking Timer & Process Control
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const abortRef = useRef(false);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Image Modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pinchDist, setPinchDist] = useState<number | null>(null); 

  // Trash System
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashConversations, setTrashConversations] = useState<Conversation[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  // Animation & Scroll
  const [showFlash, setShowFlash] = useState(false);
  const isAutoScrollEnabled = useRef(true);

  // Translations
  const t = (key: any) => getTranslation(language, key);

  // ONBOARDING AUTO-POPUP
  useEffect(() => {
    if (isNewUser && userProfile) {
        setLiveOptions({ 
           conversationId: activeConversationId, 
           initialTopic: translations['en'].intro_topic 
        });
        setShowLiveInterface(true);
        setIsNewUser(false);
    }
  }, [isNewUser, userProfile, setIsNewUser]);

  useEffect(() => {
    if (userProfile?.uid) {
      loadConversations();
      loadDocContext();
    }
  }, [userProfile]);

  const loadConversations = async () => {
    if (!userProfile) return;
    const list = await getConversations(userProfile.uid);
    setConversations(list);
  };

  const loadDocContext = async () => {
    if(!userProfile) return;
    const context = await getAllDocuments(userProfile.uid);
    setDocContext(context);
  }

  // Handle Notifications Click (Monitoring Agent)
  useEffect(() => {
     if (notifications.length > 0) {
        // Just checking if we need to do anything specific automatically.
     }
  }, [notifications]);

  const changeConversation = async (newId: string) => {
      const currentConvo = conversations.find(c => c.id === activeConversationId);
      if (currentConvo?.isTemporary && !currentConvo.isPinned && activeConversationId !== newId) {
          if(userProfile) deleteConversationPermanently(userProfile.uid, activeConversationId);
          setConversations(prev => prev.filter(c => c.id !== activeConversationId));
      }

      setActiveConversationId(newId);
      setIsNewSession(false);
      setIsAgentic(false);
      if(window.innerWidth < 768) setShowHistory(false);
  };

  useEffect(() => {
    const loadActiveChat = async () => {
      if (!userProfile || !activeConversationId) return;

      if (isNewSession) {
        setMessages([{
          id: 'welcome_new',
          role: 'model',
          content: language === 'id' ? "Sesi baru dimulai. Ada yang bisa saya bantu, Pak?" : "New session initialized. How may I assist you, Sir?",
          timestamp: Date.now(),
          conversationId: 'temp'
        }]);
        return;
      }
      
      const history = await getConversationHistory(userProfile.uid, activeConversationId);
      const currentConvo = conversations.find(c => c.id === activeConversationId);
      
      if (currentConvo) {
         setMemoryEnabled(currentConvo.useMemory !== false); 
         if (currentConvo.isPrimary) setIsAgentic(true);
      }

      if (history.length > 0) {
        setMessages(history);
      } else {
        const honorific = userProfile.gender === 'female' ? "Ma'am" : "Sir";
        const welcome = language === 'id' 
            ? `Salam, ${honorific} ${userProfile?.name?.split(' ')[0]}. Protokol Utama aktif.`
            : `Greetings, ${honorific} ${userProfile?.name?.split(' ')[0]}. Primary Protocol engaged. Multi-Expert Agent System online.`;
        
        const newWelcome = language === 'id' 
            ? `Sesi baru. Ada yang bisa saya bantu?`
            : `New session initialized. How may I assist you, ${honorific}?`;

        setMessages([{
          id: 'welcome',
          role: 'model',
          content: activeConversationId === 'primary' ? welcome : newWelcome,
          timestamp: Date.now(),
          conversationId: activeConversationId
        }]);
      }
    };
    loadActiveChat();
  }, [activeConversationId, userProfile, conversations, isNewSession, language]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isAutoScrollEnabled.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const scrollToBottom = () => {
    if (isAutoScrollEnabled.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingSeconds]);

  const handleNewChat = () => {
    const currentConvo = conversations.find(c => c.id === activeConversationId);
    if (currentConvo?.isTemporary && !currentConvo.isPinned) {
        if(userProfile) deleteConversationPermanently(userProfile.uid, activeConversationId);
        setConversations(prev => prev.filter(c => c.id !== activeConversationId));
    }

    setIsNewSession(true);
    setActiveConversationId('temp_session'); 
    setMessages([]);
    if (window.innerWidth < 768) setShowHistory(false);
  };

  const handleSoftDeleteConversation = async (e: React.MouseEvent, id: string) => {
    // STOP PROPAGATION is Critical here to prevent navigation
    e.stopPropagation();
    e.preventDefault();
    
    if (!userProfile || !id) return;
    
    const confirmMsg = language === 'id' ? "Pindahkan ke Sampah?" : "Move this session to Trash?";
    if (window.confirm(confirmMsg)) {
       
       // Visual Confirmation: Immediate DOM manipulation
       const el = document.getElementById(`chat-item-${id}`);
       if (el) el.style.display = 'none';

       try {
           // 1. Optimistic Update (Remove from list immediately)
           const updatedList = conversations.filter(c => c.id !== id);
           setConversations(updatedList);
           
           if (activeConversationId === id) {
               setActiveConversationId('primary');
               setIsNewSession(false);
           }
           
           // 2. Perform DB Operation
           await softDeleteConversation(userProfile.uid, id);
           
       } catch (error: any) {
           console.error("Delete Error", error);
           // Revert visual on error
           if (el) el.style.display = 'flex';
           loadConversations();
       }
    }
  };

  const handleOpenTrash = async () => {
      if(!userProfile) return;
      setShowTrashModal(true);
      setShowHistory(false);
      setTrashLoading(true);
      try {
        const trash = await getTrashedConversations(userProfile.uid);
        setTrashConversations(trash);
      } catch (e) {
        console.error("Error loading trash", e);
      }
      setTrashLoading(false);
  };

  const handleRestoreFromTrash = async (id: string) => {
      if(!userProfile) return;
      try {
        await restoreConversation(userProfile.uid, id);
        // Remove from trash UI
        setTrashConversations(prev => prev.filter(c => c.id !== id));
        // Add back to main list (simplified, a full reload is safer)
        loadConversations();
      } catch (error: any) {
         alert(`Restore failed: ${error.message}`);
      }
  };

  const handlePermanentDelete = async (id: string) => {
      if(!userProfile) return;
      if(window.confirm("Permanently delete? This cannot be undone.")) {
          try {
            await deleteConversationPermanently(userProfile.uid, id);
            setTrashConversations(prev => prev.filter(c => c.id !== id));
          } catch (error: any) {
             alert(`Hard delete failed: ${error.message}`);
          }
      }
  };

  const handleClearHistory = async () => {
    if (!userProfile || isNewSession) return;
    const confirmMsg = language === 'id' ? "Hapus semua pesan di obrolan ini?" : "Clear all messages in this chat?";
    if (window.confirm(confirmMsg)) {
       try {
         await clearChatHistory(userProfile.uid, activeConversationId);
         setMessages([]);
       } catch (error: any) {
          alert(`Clear history failed: ${error.message}`);
       }
    }
  };

  const handleSingleMessageDelete = async (msgId: string) => {
      if (!userProfile) return;
      if (window.confirm(language === 'id' ? "Hapus pesan ini?" : "Delete this message?")) {
          try {
              // Optimistic remove
              setMessages(prev => prev.filter(m => m.id !== msgId));
              await deleteSingleMessage(userProfile.uid, activeConversationId, msgId);
          } catch (error: any) {
              alert(`Message delete failed: ${error.message}`);
          }
      }
  };

  const handlePinConversation = async (e: React.MouseEvent, id: string, currentPinState: boolean) => {
    e.stopPropagation();
    if (!userProfile) return;
    setConversations(prev => prev.map(c => c.id === id ? { ...c, isPinned: !currentPinState, isTemporary: !currentPinState ? false : c.isTemporary } : c));
    await toggleConversationPin(userProfile.uid, id, currentPinState);
  };

  const spawnMonitoringChat = async (note: any) => {
     if (!userProfile) return;
     const newId = await createNewConversation(userProfile.uid, note.title || "Monitoring Insight", true, true);
     const aiMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        content: `**MONITORING UPDATE**\n\n${note.generatedContent}\n\n${note.message}`,
        timestamp: Date.now(),
        conversationId: newId,
        discussionTopic: note.generatedContent 
     };
     await saveMessage(userProfile.uid, aiMsg);
     await loadConversations();
     changeConversation(newId);
     clearNotification(note.id);
  };

  const handleStartLiveChat = async () => {
      if (!userProfile) return;
      
      const title = `Voice Session - ${new Date().toLocaleTimeString()}`;
      
      // OPTIMIZATION: Await ID creation only (fast), do not await full list reload (slow)
      const newLiveId = await createNewConversation(userProfile.uid, title, true, false); 
      
      // Set options and show interface immediately
      setLiveOptions({
         conversationId: newLiveId,
         initialTopic: undefined
      });
      setShowLiveInterface(true);
      
      // Perform background updates
      loadConversations();
      setActiveConversationId(newLiveId);
      setIsNewSession(false);
  };

  // DRAG AND DROP HANDLERS
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachment(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
        setShowUploadMenu(false); // Close menu
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySelect = (base64: string) => {
    setAttachment(`data:image/jpeg;base64,${base64}`);
    setShowGalleryPicker(false);
    setShowUploadMenu(false);
  };

  const startTimer = () => {
    setThinkingSeconds(0);
    timerRef.current = setInterval(() => {
      setThinkingSeconds(s => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStop = () => {
      abortRef.current = true;
      setIsProcessing(false);
      stopTimer();
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isProcessing) return;

    abortRef.current = false;
    setIsProcessing(true);
    const textToSend = input;
    const attachmentToSend = attachment;
    
    setInput('');
    setAttachment(null);
    setReplyingTo(null);

    let targetConversationId = activeConversationId;
    let isFirstMessage = false;

    if (isNewSession) {
        if (!userProfile) {
            setIsProcessing(false);
            return;
        }
        targetConversationId = await createNewConversation(userProfile.uid, "New Session", memoryEnabled, true);
        setActiveConversationId(targetConversationId);
        setIsNewSession(false);
        isFirstMessage = true;
        loadConversations();
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      conversationId: targetConversationId,
      attachment: attachmentToSend || undefined,
      replyToId: replyingTo?.id,
      replyToContent: replyingTo?.content
    };

    setMessages(prev => [...prev, userMsg]);
    startTimer();

    const safetyTimeout = setTimeout(() => {
       if (isProcessing) {
          console.warn("Forcing generation stop due to timeout");
          setIsProcessing(false);
          stopTimer();
          setMessages(prev => [...prev, {
             id: 'error_timeout',
             role: 'model',
             content: language === 'id' ? "Maaf, permintaan Anda memakan waktu terlalu lama. Silakan coba lagi." : "Apologies, your request timed out. Please try again.",
             timestamp: Date.now(),
             conversationId: targetConversationId
          }]);
       }
    }, 60000); 

    if (userProfile?.uid) {
      await saveMessage(userProfile.uid, userMsg);
      
      // NEW: Save to Gallery Automatically
      if (attachmentToSend) {
         await addToGallery(userProfile.uid, attachmentToSend.split(',')[1]);
      }
      
      if (isFirstMessage || (activeConversationId !== 'primary' && messages.length <= 2)) {
         generateChatTitle(userMsg.content).then(newTitle => {
            updateConversationTitle(userProfile!.uid, targetConversationId, newTitle);
            loadConversations(); 
         });
      }
    }

    try {
      const currentConvo = conversations.find(c => c.id === activeConversationId);
      const useAgentic = isAgentic || currentConvo?.isPrimary;

      const action: AgentAction = await processUserMessage(
        userMsg.content, 
        userProfile!, 
        memoryEnabled, 
        !!useAgentic,
        userMsg.attachment ? userMsg.attachment.split(',')[1] : undefined,
        useWebSearch,
        docContext,
        userMsg.replyToContent ? { id: userMsg.replyToId!, content: userMsg.replyToContent } : undefined
      );

      clearTimeout(safetyTimeout);
      if (abortRef.current) return;

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: action.responseToUser,
        timestamp: Date.now(),
        conversationId: targetConversationId,
        isAgentic: !!useAgentic,
        thinkingTime: thinkingSeconds, 
        generatedImage: action.generatedImage,
        groundingMetadata: action.groundingMetadata
      };
      
      // NEW: Save Generated Image to Gallery
      if (action.generatedImage && userProfile?.uid) {
         await addToGallery(userProfile.uid, action.generatedImage);
      }
      
      setMessages(prev => [...prev, aiMsg]);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 800);

      if (userProfile?.uid) {
        await saveMessage(userProfile.uid, aiMsg);
      }
    } catch (err) {
      console.error(err);
    } finally {
      clearTimeout(safetyTimeout);
      if (!abortRef.current) {
          setIsProcessing(false);
          stopTimer();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1') 
      .replace(/`(.*?)`/g, '$1') 
      .replace(/\[(.*?)\]/g, '')
      .replace(/`/g, '');
      
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openImageModal = (base64: string) => {
      setSelectedImage(base64);
      setZoomLevel(1);
      setPinchDist(null); // Reset pinch
  };

  const closeImageModal = () => {
      setSelectedImage(null);
  };

  const handleDownloadImage = (base64: string) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64}`;
    link.download = `jarvis_img_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PINCH ZOOM LOGIC
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Basic smooth zooming
      const delta = dist / pinchDist;
      setZoomLevel(prev => Math.min(Math.max(0.5, prev * (1 + (delta - 1) * 0.5)), 4)); 
      setPinchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setPinchDist(null);
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const renderStyledText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
       if (part.startsWith('**') && part.endsWith('**')) {
         return <strong key={index} className="text-jarvis-accent font-bold">{part.slice(2, -2)}</strong>;
       } else if (part.startsWith('*') && part.endsWith('*')) {
         return <em key={index} className="text-jarvis-accentSec not-italic font-medium">{part.slice(1, -1)}</em>;
       } else if (part.startsWith('`') && part.endsWith('`')) {
         return <code key={index} className="bg-jarvis-warning/10 text-jarvis-warning px-1 rounded font-mono text-xs">{part.slice(1, -1)}</code>;
       }
       return part;
    });
  };

  const isApiKeyMissing = getApiKeys().length === 0;

  return (
    <div 
        className="flex h-full relative overflow-hidden bg-jarvis-bg"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      
      {/* Drag Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-jarvis-accent border-dashed animate-pulse">
              <Upload size={64} className="text-jarvis-accent mb-4" />
              <h2 className="text-2xl font-bold text-white">DROP TO UPLOAD</h2>
              <p className="text-jarvis-accent">Image Analysis Protocol</p>
          </div>
      )}

      {/* Gallery Modal Picker */}
      {showGalleryPicker && (
         <div className="fixed inset-0 z-50 bg-black/90 flex flex-col p-4 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Grid size={24} className="text-jarvis-accent" /> Select from Gallery
                 </h2>
                 <button onClick={() => setShowGalleryPicker(false)} className="text-gray-400 hover:text-white p-2">
                    <X size={24} />
                 </button>
             </div>
             <div className="flex-1 overflow-hidden bg-jarvis-bgSec rounded-xl border border-jarvis-panel">
                 <GalleryView isModalMode={true} onSelect={handleGallerySelect} />
             </div>
         </div>
      )}

      {/* TRASH BIN MODAL */}
      {showTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col p-4 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-4 border-b border-jarvis-panel pb-4">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Trash2 size={24} className="text-jarvis-error" /> Recycle Bin
                 </h2>
                 <button onClick={() => setShowTrashModal(false)} className="text-gray-400 hover:text-white p-2">
                    <X size={24} />
                 </button>
             </div>
             
             {trashLoading ? (
                 <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-jarvis-accent border-t-transparent rounded-full animate-spin"></div>
                 </div>
             ) : (
                 <div className="flex-1 overflow-y-auto space-y-2">
                    {trashConversations.length === 0 && (
                        <div className="text-center text-gray-500 mt-20">Trash is empty.</div>
                    )}
                    {trashConversations.map(c => (
                        <div key={c.id} className="bg-jarvis-panel p-4 rounded-xl flex items-center justify-between group">
                            <div>
                                <h4 className="text-white font-bold">{c.title}</h4>
                                <span className="text-xs text-gray-500">Deleted: {c.deletedAt?.toDate?.().toLocaleDateString() || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                   onClick={() => handleRestoreFromTrash(c.id)}
                                   className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 text-xs font-bold flex items-center gap-1"
                                >
                                   <RotateCcw size={12} /> Restore
                                </button>
                                <button 
                                   onClick={() => handlePermanentDelete(c.id)}
                                   className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 text-xs font-bold flex items-center gap-1"
                                >
                                   <X size={12} /> Delete Forever
                                </button>
                            </div>
                        </div>
                    ))}
                 </div>
             )}
          </div>
      )}
      
      {/* Reflection Animation Overlay */}
      {showFlash && (
          <div className="pointer-events-none fixed inset-0 z-50 bg-gradient-to-tr from-white/10 to-transparent animate-reflection mix-blend-overlay"></div>
      )}

      {/* --- INJECTED NOTIFICATION HANDLER (Visual Only) --- */}
      {notifications.length > 0 && (
         <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
             {notifications.map(note => (
                 <div key={note.id} className="bg-jarvis-panel border border-jarvis-accent/50 p-4 rounded-xl shadow-[0_0_20px_rgba(0,212,255,0.2)] animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                     <div className="flex items-start justify-between mb-1">
                         <div className="flex items-center gap-2 text-jarvis-accent font-bold text-sm">
                             <Zap size={14} className="animate-wiggle" />
                             {note.title}
                         </div>
                         <button onClick={() => clearNotification(note.id)} className="text-gray-500 hover:text-white"><X size={14}/></button>
                     </div>
                     <p className="text-xs text-gray-300 mb-2">{note.message}</p>
                     {note.generatedContent && (
                       <button 
                          onClick={() => spawnMonitoringChat(note)}
                          className="text-[10px] bg-jarvis-accent/10 text-jarvis-accent px-2 py-1 rounded border border-jarvis-accent/20 hover:bg-jarvis-accent hover:text-black transition w-full font-bold flex items-center justify-center gap-2"
                       >
                          <MessageSquare size={12} /> OPEN INTEL REPORT
                       </button>
                     )}
                 </div>
             ))}
         </div>
      )}
      
      {/* HISTORY SIDEBAR */}
      <div 
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          flex flex-col bg-jarvis-bg border-r border-jarvis-panel transition-all duration-300
          ${showHistory ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}
        `}
      >
        <div className="p-4 border-b border-jarvis-panel flex items-center justify-between bg-jarvis-bgSec whitespace-nowrap overflow-hidden shrink-0">
           <h3 className="text-xs font-bold text-jarvis-textSec uppercase tracking-wider">Session Logs</h3>
           <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white md:hidden"><X size={18}/></button>
        </div>
        
        <div className="p-3 whitespace-nowrap overflow-hidden shrink-0">
          <button 
             onClick={handleNewChat}
             className="w-full bg-jarvis-accent/10 hover:bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-2 transition animate-heartbeat-purple"
          >
             <Plus size={16} /> <span>{t('new_session')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 whitespace-nowrap">
           <button 
              onClick={() => { changeConversation('primary'); }}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition ${activeConversationId === 'primary' ? 'bg-jarvis-panel border-l-2 border-jarvis-accent text-white' : 'text-gray-400 hover:bg-white/5'}`}
           >
              <Star size={16} className={activeConversationId === 'primary' ? 'text-jarvis-accent fill-jarvis-accent' : 'text-gray-500'} />
              <div className="flex-1 truncate">
                 <div className="text-sm font-bold">{t('primary_protocol')}</div>
                 <div className="text-[10px] opacity-70">Main System Context</div>
              </div>
           </button>

           <div className="text-[10px] text-gray-500 uppercase mt-4 mb-2 px-3">Recent Logs</div>
           
           {conversations.filter(c => !c.isPrimary).map(convo => (
             <div 
               key={convo.id}
               id={`chat-item-${convo.id}`}
               className={`group relative flex items-center rounded-lg hover:bg-white/5 transition pr-2 ${activeConversationId === convo.id && !isNewSession ? 'bg-jarvis-panel text-white' : 'text-gray-400'}`}
             >
               <button 
                  onClick={() => changeConversation(convo.id)}
                  className="flex-1 text-left px-3 py-3 flex items-center gap-3 overflow-hidden"
               >
                  <div className="relative">
                    <MessageSquare size={16} className="shrink-0 opacity-50" />
                    {convo.isTemporary && !convo.isPinned && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Temporary"></div>}
                  </div>
                  <div className="flex-1 truncate flex flex-col">
                     <span className={`text-sm truncate ${convo.isTemporary && !convo.isPinned ? 'text-yellow-500/80 italic' : ''}`}>{convo.title}</span>
                     {convo.isPinned && <span className="text-[9px] flex items-center gap-1 text-jarvis-accent"><Pin size={8} /> {t('pinned')}</span>}
                  </div>
               </button>
               
               <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-jarvis-bgSec p-1 rounded-lg absolute right-2 top-1/2 -translate-y-1/2 z-20 shadow-md">
                  <button 
                    onClick={(e) => handlePinConversation(e, convo.id, !!convo.isPinned)}
                    className={`p-1 hover:text-white ${convo.isPinned ? 'text-jarvis-accent' : 'text-gray-400'}`}
                    title={convo.isPinned ? "Unpin Chat" : "Pin Chat (Saves Permanently)"}
                  >
                     {convo.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button 
                    onClick={(e) => handleSoftDeleteConversation(e, convo.id)}
                    className="p-1 hover:bg-jarvis-error/20 hover:text-jarvis-error rounded transition text-gray-400"
                    title="Move to Trash"
                  >
                    <Trash2 size={14} />
                  </button>
               </div>
             </div>
           ))}
        </div>

        {/* TRASH BUTTON IN SIDEBAR */}
        <div className="p-3 border-t border-jarvis-panel mt-auto">
            <button 
               onClick={handleOpenTrash}
               className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition"
            >
                <Trash2 size={16} />
                <span className="text-sm">Recycle Bin</span>
            </button>
        </div>
      </div>

      {showHistory && <div className="absolute inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" onClick={() => setShowHistory(false)} />}

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden min-w-0">
        
        {/* Chat Header */}
        <div className="bg-jarvis-bgSec/50 backdrop-blur border-b border-jarvis-panel p-3 flex flex-col md:flex-row md:items-center justify-between z-10 shrink-0 gap-3">
           <div className="flex items-center gap-3">
              <button onClick={() => setShowHistory(!showHistory)} className="p-2 text-jarvis-accent hover:bg-white/5 rounded-lg transition">
                 {showHistory ? <ChevronLeft size={20} /> : <Menu size={20} />}
              </button>

              <div className="flex flex-col min-w-0">
                 <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    {activeConversationId === 'primary' ? <Star size={14} className="text-jarvis-accent" /> : <MessageSquare size={14} className="text-gray-400" />}
                    <span className="truncate max-w-[150px] md:max-w-xs">{isNewSession ? t('new_session') : (conversations.find(c => c.id === activeConversationId)?.title || t('primary_protocol'))}</span>
                 </h2>
                 <span className="text-[10px] text-jarvis-textSec font-mono hidden md:block flex items-center gap-2">
                    SECURE CONNECTION • {isNewSession ? 'UNSAVED' : `ID: ${activeConversationId.substring(0,8)}...`}
                    {conversations.find(c => c.id === activeConversationId)?.isTemporary && !conversations.find(c => c.id === activeConversationId)?.isPinned && 
                       <span className="text-yellow-500 flex items-center gap-1 ml-2"><AlertTriangle size={8} /> {t('temp_storage')}</span>
                    }
                 </span>
              </div>
           </div>
           
           <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              
              {/* MEMORY BUTTON */}
              <button
                onClick={() => setMemoryEnabled(!memoryEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition shrink-0 ${
                  memoryEnabled 
                   ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                   : 'bg-transparent border-gray-700 text-gray-500'
                }`}
                title="Toggle System Memory"
              >
                 <BrainCircuit size={14} />
                 <span>{memoryEnabled ? 'MEM: ON' : 'MEM: OFF'}</span>
              </button>

              {/* Pin Button for Active Chat */}
              {!isNewSession && activeConversationId !== 'primary' && (
                 <button 
                    onClick={(e) => {
                        const convo = conversations.find(c => c.id === activeConversationId);
                        if (convo) handlePinConversation(e, convo.id, !!convo.isPinned);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition shrink-0 ${
                       conversations.find(c => c.id === activeConversationId)?.isPinned 
                       ? 'bg-jarvis-accent text-black border-jarvis-accent' 
                       : 'bg-transparent border-gray-700 text-gray-500 hover:text-white'
                    }`}
                 >
                    <Pin size={12} />
                    <span>{conversations.find(c => c.id === activeConversationId)?.isPinned ? t('pinned') : t('pin_chat')}</span>
                 </button>
              )}

              {/* LIVE CALL BUTTON */}
              <button
                onClick={handleStartLiveChat}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition shrink-0 bg-jarvis-accent/20 border-jarvis-accent text-jarvis-accent hover:bg-jarvis-accent hover:text-black animate-pulse"
              >
                 <Radio size={14} className="animate-ping" />
                 <span className="whitespace-nowrap">{t('live_link')}</span>
              </button>
              
              <div className="w-px h-6 bg-gray-700 mx-2 hidden md:block"></div>

              <button
                onClick={() => setUseWebSearch(!useWebSearch)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition shrink-0 ${
                  useWebSearch
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                    : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                 <Globe size={14} />
                 <span className="whitespace-nowrap">{useWebSearch ? t('web_on') : t('web_off')}</span>
              </button>

              {/* CLEAR CHAT BUTTON */}
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border border-transparent hover:border-jarvis-error hover:bg-jarvis-error/10 hover:text-jarvis-error text-gray-500 transition shrink-0"
                title="Clear current chat messages"
              >
                 <Eraser size={14} />
              </button>
           </div>
        </div>

        {isApiKeyMissing && (
          <div className="bg-jarvis-warning/20 text-jarvis-warning border-b border-jarvis-warning px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
             <AlertTriangle size={14} />
             <span>Neural Link Disconnected. Please configure in 'Me' section.</span>
          </div>
        )}

        {/* Messages */}
        <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 space-y-4 p-4 overflow-y-auto scroll-smooth"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {msg.replyToContent && (
                 <div className={`text-[10px] mb-1 px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 max-w-[80%] truncate flex items-center gap-1 ${msg.role === 'user' ? 'mr-2' : 'ml-2'}`}>
                    <Reply size={10} /> Replying to: "{msg.replyToContent.substring(0, 30)}..."
                 </div>
              )}

              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-sm text-sm md:text-base leading-relaxed break-words relative overflow-hidden group ${
                  msg.role === 'user'
                    ? 'bg-jarvis-accent text-black font-medium rounded-tr-none shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                    : msg.role === 'system' 
                      ? 'bg-jarvis-error/20 text-jarvis-error border border-jarvis-error/30'
                      : 'bg-jarvis-panel text-gray-100 border border-jarvis-accent/10 rounded-tl-none'
                }`}>
                 
                 {/* AI Header Info */}
                 {msg.role === 'model' && (
                   <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                     <div className="text-[10px] uppercase tracking-widest text-jarvis-accent font-mono opacity-70 flex items-center gap-1">
                       {msg.isLiveInteraction ? (
                          <><Radio size={10} className="animate-pulse text-red-400" /> LIVE VOICE LOG</>
                       ) : (
                          <><Cpu size={10} /> {msg.isAgentic ? 'JARVIS (AGENTIC)' : 'JARVIS'}</>
                       )}
                     </div>
                     <div className="flex items-center gap-2">
                        {msg.thinkingTime !== undefined && (
                            <div className="text-[9px] text-gray-500 font-mono">
                              {formatTime(msg.thinkingTime)}
                            </div>
                        )}
                        <button 
                           onClick={() => setReplyingTo(msg)}
                           className="text-gray-500 hover:text-jarvis-accent transition p-1 hover:bg-white/10 rounded"
                           title="Reply"
                        >
                           <Reply size={12} />
                        </button>
                        <button 
                           onClick={() => handleCopy(msg.content, msg.id)}
                           className="text-gray-500 hover:text-white transition p-1 hover:bg-white/10 rounded"
                           title="Copy Clean Text"
                        >
                           {copiedId === msg.id ? <Check size={12} className="text-jarvis-success" /> : <Copy size={12} />}
                        </button>
                        <button 
                           onClick={() => handleSingleMessageDelete(msg.id)}
                           className="text-gray-500 hover:text-jarvis-error transition p-1 hover:bg-white/10 rounded"
                           title="Delete Message"
                        >
                           <Trash2 size={12} />
                        </button>
                     </div>
                   </div>
                 )}

                 {/* User Action Info */}
                 {msg.role === 'user' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                         {msg.isLiveInteraction && <Radio size={10} className="text-red-400 animate-pulse" />}
                         <button 
                           onClick={() => setReplyingTo(msg)}
                           className="text-black/50 hover:text-black p-1"
                           title="Reply"
                        >
                           <Reply size={12} />
                        </button>
                        <button 
                           onClick={() => handleCopy(msg.content, msg.id)}
                           className="text-black/50 hover:text-black p-1"
                           title="Copy Text"
                        >
                           {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button 
                           onClick={() => handleSingleMessageDelete(msg.id)}
                           className="text-black/50 hover:text-red-700 p-1"
                           title="Delete Message"
                        >
                           <Trash2 size={12} />
                        </button>
                    </div>
                 )}

                 {/* User Attachment */}
                 {msg.role === 'user' && msg.attachment && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-black/20">
                      <img src={msg.attachment} alt="Attachment" className="max-w-full max-h-48 object-cover" />
                    </div>
                 )}

                 {/* Content with Coloring */}
                 <div className="whitespace-pre-wrap">
                    {msg.role === 'model' ? renderStyledText(msg.content) : msg.content}
                 </div>
                 
                 {/* Discussion Topic Action Button */}
                 {msg.discussionTopic && (
                    <div className="mt-4">
                        <button 
                           onClick={() => {
                               setLiveOptions({
                                  conversationId: activeConversationId,
                                  initialTopic: msg.discussionTopic
                               });
                               setShowLiveInterface(true);
                           }}
                           className="w-full bg-jarvis-accent/20 border border-jarvis-accent text-jarvis-accent rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-2 hover:bg-jarvis-accent hover:text-black transition animate-pulse"
                        >
                           <Headphones size={14} /> DISCUSS LIVE WITH JARVIS
                        </button>
                    </div>
                 )}

                 {/* Generated Image */}
                 {msg.generatedImage && (
                    <div className="mt-3 relative group/image">
                       <div 
                          className="rounded-xl overflow-hidden border border-jarvis-accent/30 shadow-[0_0_15px_rgba(0,212,255,0.1)] cursor-pointer"
                          onClick={() => openImageModal(msg.generatedImage!)}
                        >
                          <img src={`data:image/jpeg;base64,${msg.generatedImage}`} alt="Generated Result" className="w-full h-auto hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
                             <Maximize2 className="text-white drop-shadow-md" />
                          </div>
                       </div>
                    </div>
                 )}

                 {/* Sources / Grounding Display */}
                 {msg.groundingMetadata && msg.groundingMetadata.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                       <div className="flex items-center gap-2 mb-2">
                          <div className="p-1 bg-blue-500/20 rounded text-blue-400">
                             <LinkIcon size={12} />
                          </div>
                          <span className="text-xs font-bold text-gray-400">VERIFIED SOURCES</span>
                       </div>
                       <div className="grid grid-cols-1 gap-1">
                          {msg.groundingMetadata.map((chunk, idx) => (
                             chunk.web?.uri && (
                               <a 
                                 key={idx} 
                                 href={chunk.web.uri} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 border border-white/5 hover:border-jarvis-accent/30 transition group/link"
                               >
                                 <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-mono shrink-0">
                                   {idx + 1}
                                 </span>
                                 <span className="text-xs text-jarvis-textSec group-hover/link:text-jarvis-accent truncate">
                                   {chunk.web.title || chunk.web.uri}
                                 </span>
                               </a>
                             )
                          ))}
                       </div>
                    </div>
                 )}

                 <div className={`text-[10px] mt-2 text-right opacity-50 ${msg.role === 'user' ? 'text-black' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                 </div>
              </div>
            </div>
          ))}

          {/* Thinking Animation */}
          {isProcessing && (
            <div className="flex justify-start w-full">
               <div className="bg-jarvis-panel rounded-2xl rounded-tl-none px-6 py-4 border border-jarvis-accent/10 flex flex-col gap-3 min-w-[200px]">
                 <div className="flex items-center gap-3">
                    <div className="relative w-4 h-4">
                       <div className="absolute inset-0 bg-jarvis-accent rounded-full animate-ping opacity-75"></div>
                       <div className="relative w-4 h-4 bg-jarvis-accent rounded-full shadow-[0_0_10px_#00d4ff]"></div>
                    </div>
                    <span className="text-xs font-bold text-jarvis-accent font-mono tracking-wider animate-pulse">
                       {thinkingSeconds < 2 ? "ANALYZING INTENT..." : 
                        thinkingSeconds < 4 ? "ROUTING TO AGENT..." : 
                        thinkingSeconds < 8 ? "CONSULTING EXPERT..." : "FINALIZING..."}
                    </span>
                 </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-jarvis-bgSec p-3 md:p-4 border-t border-jarvis-panel flex flex-col gap-3 z-10 shrink-0">
          
          {/* Context Banners */}
          {(attachment || replyingTo) && (
             <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                 {/* Reply Banner */}
                 {replyingTo && (
                    <div className="flex items-center justify-between bg-jarvis-panel/50 border-l-2 border-jarvis-accent p-2 rounded-r-lg">
                        <div className="flex flex-col text-xs pl-2">
                           <span className="text-jarvis-accent font-bold">Replying to {replyingTo.role === 'user' ? 'Yourself' : 'JARVIS'}</span>
                           <span className="text-gray-400 truncate max-w-[250px]">{replyingTo.content}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-white p-1"><X size={14}/></button>
                    </div>
                 )}

                 {/* Attachment Banner */}
                 {attachment && (
                    <div className="flex items-center gap-2 bg-jarvis-panel p-2 rounded-lg w-fit border border-jarvis-accent/30">
                        <div className="w-10 h-10 rounded overflow-hidden bg-black">
                            <img src={attachment} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400">Image Attached</span>
                            <span className="text-xs text-jarvis-accent font-bold">Ready to analyze/edit</span>
                        </div>
                        <button onClick={() => setAttachment(null)} className="ml-2 text-gray-500 hover:text-white"><X size={14} /></button>
                    </div>
                 )}
             </div>
          )}

          <div className="flex items-center gap-3 relative">
            
            {/* Upload Button with Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                className={`p-3 rounded-xl transition ${showUploadMenu ? 'bg-jarvis-accent text-black' : 'text-jarvis-textSec hover:text-white hover:bg-white/5'}`}
                title="Attach Options"
              >
                <Paperclip size={20} />
              </button>
              
              {showUploadMenu && (
                 <div className="absolute bottom-full left-0 mb-2 w-48 bg-jarvis-bgSec border border-jarvis-panel rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 z-50">
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-3 text-gray-300 hover:text-white"
                    >
                       <Upload size={16} /> {t('upload_device')}
                    </button>
                    <button 
                       onClick={() => { setShowGalleryPicker(true); setShowUploadMenu(false); }}
                       className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-3 text-gray-300 hover:text-white"
                    >
                       <Grid size={16} /> {t('select_gallery')}
                    </button>
                 </div>
              )}
            </div>

            <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*"
               onChange={handleFileSelect}
            />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isApiKeyMissing ? "Configure API Key..." : userProfile ? t('type_command') : t('type_command_guest')}
              disabled={isApiKeyMissing}
              rows={1}
              className="flex-1 bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl py-3 px-4 text-white placeholder-gray-500 outline-none resize-none min-h-[48px] max-h-32 font-mono text-sm shadow-inner transition-colors"
            />
            
            {isProcessing ? (
               <button 
                  onClick={handleStop}
                  className="p-3 rounded-xl transition-all duration-300 shrink-0 bg-jarvis-error text-white hover:bg-red-600 animate-pulse"
                  title="Stop Generation"
               >
                  <Square size={20} fill="currentColor" />
               </button>
            ) : (
               <button 
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachment) || isApiKeyMissing}
                  className={`p-3 rounded-xl transition-all duration-300 shrink-0 ${
                    (input.trim() || attachment) && !isApiKeyMissing
                      ? 'bg-jarvis-accent text-black hover:shadow-[0_0_15px_#00d4ff] animate-heartbeat-cyan' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
               >
                  <Send size={20} />
               </button>
            )}
          </div>
        </div>

      </div>

      {/* Image Modal / Lightbox with Pinch Zoom */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
           <button 
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 p-2 rounded-full z-50"
           >
             <X size={30} />
           </button>

           <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
               <img 
                  src={`data:image/jpeg;base64,${selectedImage}`} 
                  alt="Full Screen"
                  className="max-w-full max-h-full object-contain transition-transform duration-75"
                  style={{ transform: `scale(${zoomLevel})` }}
               />
           </div>

           {/* Zoom Controls */}
           <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/70 px-6 py-3 rounded-full border border-white/20">
               <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} className="text-white hover:text-jarvis-accent"><ZoomOut size={24} /></button>
               <span className="text-xs font-mono w-12 text-center text-white">{Math.round(zoomLevel * 100)}%</span>
               <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))} className="text-white hover:text-jarvis-accent"><ZoomIn size={24} /></button>
               <div className="w-px h-6 bg-white/20 mx-2"></div>
               <button onClick={() => handleDownloadImage(selectedImage)} className="text-white hover:text-jarvis-success"><Download size={24} /></button>
           </div>
        </div>
      )}
    </div>
  );
};