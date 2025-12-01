

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, CheckSquare, Calendar, FileText, User, ChevronLeft, ChevronRight, Bell, X, Image as ImageIcon, Volume2, Play, Trash2, StopCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../services/translations';
import { LiveInterface } from './LiveInterface';
import { createNewConversation } from '../services/dbService';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, logout, notifications, clearNotification, language, showLiveInterface, setShowLiveInterface, liveOptions, setLiveOptions } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Notification Bar State
  const [showNotifications, setShowNotifications] = useState(false);
  const [playingNotificationId, setPlayingNotificationId] = useState<string | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  // Automatically collapse sidebar on Chat view to create "Rail" effect
  // This allows the ChatInterface's Session Logs sidebar to sit next to it without crowding
  useEffect(() => {
    if (location.pathname === '/') {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [location.pathname]);

  const t = (key: any) => getTranslation(language, key);

  const navItems = [
    { path: '/', label: t('chat'), icon: <MessageSquare size={20} /> },
    { path: '/tasks', label: t('tasks'), icon: <CheckSquare size={20} /> },
    { path: '/calendar', label: t('calendar'), icon: <Calendar size={20} /> },
    { path: '/documents', label: t('docs'), icon: <FileText size={20} /> },
    { path: '/gallery', label: t('gallery'), icon: <ImageIcon size={20} /> },
    { path: '/profile', label: t('me'), icon: <User size={20} /> },
  ];

  const handleNotificationClick = (id: string) => {
     // Navigate to chat
     navigate('/');
     clearNotification(id);
     setShowNotifications(false);
  };

  const handlePlayNotification = (e: React.MouseEvent, note: any) => {
      e.stopPropagation();
      
      if (playingNotificationId === note.id) {
          // Stop logic
          if (synthRef.current) synthRef.current.cancel();
          setPlayingNotificationId(null);
          return;
      }
      
      if (synthRef.current) {
          synthRef.current.cancel(); // Stop any previous
          
          const utter = new SpeechSynthesisUtterance(note.message + ". " + (note.generatedContent || ""));
          utter.lang = language === 'id' ? 'id-ID' : 'en-US';
          utter.rate = 1.0;
          
          // Audio Interaction Flow:
          // 1. Play Preview
          // 2. On End -> Prompt for Questions via TTS -> Trigger Live
          
          utter.onstart = () => setPlayingNotificationId(note.id);
          utter.onend = () => {
              setPlayingNotificationId(null);
              // PROMPT PHASE
              const promptText = language === 'id' 
                  ? "Pak, jika Anda punya pertanyaan, silakan tanya saya." 
                  : "Sir, if you have any questions, please ask me.";
              
              const promptUtter = new SpeechSynthesisUtterance(promptText);
              promptUtter.lang = language === 'id' ? 'id-ID' : 'en-US';
              promptUtter.onend = async () => {
                  // AUTO ACTIVATE LIVE MODE
                  if (userProfile) {
                      const newConvo = await createNewConversation(userProfile.uid, `Discussion: ${note.title}`, true, true);
                      setLiveOptions({ 
                          conversationId: newConvo,
                          initialTopic: note.title,
                          initialPrompt: promptText // Pass this so Live Interface knows context
                      });
                      setShowLiveInterface(true);
                      setShowNotifications(false);
                  }
              };
              synthRef.current?.speak(promptUtter);
          };
          
          synthRef.current.speak(utter);
      }
  };

  const handleLiveClose = () => {
      setShowLiveInterface(false);
      setLiveOptions(null);
  };

  const welcomeMsg = language === 'id' 
      ? `${t('welcome')}, Pak ${userProfile?.name?.split(' ')[0]}` 
      : `${t('welcome')}, Sir ${userProfile?.name?.split(' ')[0]}`;

  return (
    <div className="flex flex-col h-screen bg-jarvis-bg text-jarvis-text font-sans overflow-hidden">
      
      {/* GLOBAL LIVE INTERFACE OVERLAY */}
      {showLiveInterface && userProfile && liveOptions && (
         <LiveInterface 
            onClose={handleLiveClose}
            userProfile={userProfile}
            conversationId={liveOptions.conversationId}
            initialTopic={liveOptions.initialTopic}
            initialPrompt={liveOptions.initialPrompt}
         />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-jarvis-bgSec border-b border-jarvis-panel shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-jarvis-accent flex items-center justify-center animate-pulse-slow">
             <div className="w-2 h-2 bg-jarvis-accent rounded-full shadow-[0_0_10px_#00d4ff]"></div>
          </div>
          <h1 className="text-xl font-bold tracking-wider text-jarvis-accent hidden md:block">JARVIS</h1>
        </div>
        
        <div className="flex items-center gap-4">
           {userProfile && (
             <span className="hidden md:block text-sm text-jarvis-textSec">
               {welcomeMsg}
             </span>
           )}
           
           <button 
             onClick={() => setShowNotifications(!showNotifications)}
             className="relative p-2 text-jarvis-accent hover:bg-white/5 rounded-full transition"
           >
             <Bell size={20} className={notifications.length > 0 ? "animate-wiggle" : ""} />
             {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
             )}
           </button>
           
           <button 
             onClick={() => logout()} 
             className="text-xs border border-jarvis-error text-jarvis-error px-3 py-1 rounded hover:bg-jarvis-error/10 transition animate-heartbeat-red"
           >
             {t('logout')}
           </button>
        </div>
      </header>

      {/* NOTIFICATION BAR (Right Drawer) */}
      <div className={`fixed inset-y-0 right-0 z-40 w-80 bg-jarvis-bgSec border-l border-jarvis-panel shadow-2xl transform transition-transform duration-300 ${showNotifications ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="p-4 border-b border-jarvis-panel flex items-center justify-between">
            <h3 className="font-bold text-jarvis-accent flex items-center gap-2">
               <Bell size={16} /> NOTIFICATIONS
            </h3>
            <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-white">
               <X size={18} />
            </button>
         </div>
         <div className="overflow-y-auto h-full pb-20 p-4 space-y-4">
            {notifications.map(note => (
                <div key={note.id} className="bg-jarvis-panel border border-jarvis-accent/20 p-4 rounded-xl relative group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-xs text-jarvis-textSec font-bold uppercase">{note.type}</span>
                       <span className="text-[10px] text-gray-600">{new Date(note.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">{note.title}</h4>
                    <p className="text-xs text-gray-400 mb-3">{note.message}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                        <button 
                           onClick={(e) => handlePlayNotification(e, note)}
                           className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2 transition ${playingNotificationId === note.id ? 'bg-jarvis-accent text-black animate-pulse' : 'bg-white/5 hover:bg-white/10 text-jarvis-accent'}`}
                        >
                           {playingNotificationId === note.id ? <StopCircle size={12} /> : <Play size={12} />}
                           {playingNotificationId === note.id ? 'STOP' : 'PREVIEW'}
                        </button>
                        <button 
                           onClick={() => clearNotification(note.id)}
                           className="p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded transition"
                        >
                           <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
            {notifications.length === 0 && (
               <div className="text-center text-gray-500 mt-10 text-sm">
                  No new signals received.
               </div>
            )}
         </div>
      </div>

      {/* Main Content Area */}
      {/* Added pb-[85px] on mobile to prevent bottom nav from covering text inputs */}
      <main className="flex-1 overflow-hidden relative flex pb-[85px] md:pb-0">
        {/* Desktop Sidebar (Main Nav) */}
        <aside 
          className={`hidden md:flex flex-col bg-jarvis-bgSec border-r border-jarvis-panel transition-all duration-300 ${
            isSidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Toggle Button - Only visible if NOT on chat page, as Chat page enforces collapsed state */}
          <div className="flex justify-end p-2 min-h-[40px]">
            {location.pathname !== '/' && (
              <button 
                onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 text-gray-500 hover:text-white transition"
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            )}
          </div>

          <nav className="flex-1 py-4">
            <ul className="space-y-2 px-3">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      location.pathname === item.path
                        ? 'bg-jarvis-accent text-black shadow-[0_0_15px_#00d4ff] font-bold'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className={`${location.pathname === item.path ? 'animate-pulse-slow' : 'group-hover:scale-110 transition-transform'}`}>
                      {item.icon}
                    </div>
                    {!isSidebarCollapsed && (
                      <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
                        {item.label}
                      </span>
                    )}
                    {/* Tooltip for collapsed mode */}
                    {isSidebarCollapsed && (
                       <div className="fixed left-20 ml-2 bg-jarvis-bgSec border border-jarvis-panel text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap">
                          {item.label}
                       </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          
          {/* Bottom Info */}
          {!isSidebarCollapsed && (
             <div className="p-4 border-t border-jarvis-panel">
                <div className="text-xs text-jarvis-textSec mb-1">SYSTEM STATUS</div>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-jarvis-success animate-pulse"></div>
                   <span className="text-sm font-mono text-white">ONLINE</span>
                </div>
             </div>
          )}
        </aside>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-jarvis-bgSec border-t border-jarvis-panel z-30 px-4 py-2 flex justify-between items-center shadow-2xl">
           {navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${
                   location.pathname === item.path ? 'text-jarvis-accent' : 'text-gray-500'
                }`}
              >
                 {item.icon}
                 <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
           ))}
        </nav>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-jarvis-bg relative w-full h-full">
           {children}
        </div>
      </main>
    </div>
  );
};