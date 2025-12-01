import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Zap, Info, Key, Eye, EyeOff, Save, Check, Wifi, Trash2, Plus, Cloud, Globe, GitBranch, Calendar } from 'lucide-react';
import { validateApiKey } from '../services/geminiService';
import { saveUserApiKeys } from '../services/dbService';
import { getTranslation } from '../services/translations';

export const Profile: React.FC = () => {
  const { userProfile, logout, language, setLanguage } = useAuth();
  
  // API Keys State
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid' | 'saved'>('idle');
  const t = (key: any) => getTranslation(language, key);

  useEffect(() => {
    const stored = localStorage.getItem('jarvis_api_keys');
    if (stored) {
      try {
        setApiKeys(JSON.parse(stored));
      } catch (e) {
        setApiKeys([]);
      }
    } else {
        const single = localStorage.getItem('jarvis_api_key');
        if (single) setApiKeys([single]);
    }
  }, []);

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    
    setSaveStatus('testing');
    const isValid = await validateApiKey(newKey.trim());
    
    if (isValid) {
      const updatedKeys = [...apiKeys, newKey.trim()];
      setApiKeys(updatedKeys);
      localStorage.setItem('jarvis_api_keys', JSON.stringify(updatedKeys));
      if (userProfile) {
         await saveUserApiKeys(userProfile.uid, updatedKeys);
      }
      setNewKey('');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('invalid');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const removeKey = async (index: number) => {
    const updated = apiKeys.filter((_, i) => i !== index);
    setApiKeys(updated);
    localStorage.setItem('jarvis_api_keys', JSON.stringify(updated));
    if (userProfile) {
        await saveUserApiKeys(userProfile.uid, updated);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0">
       <div className="flex items-center justify-between mb-8">
           <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
             <Settings className="text-jarvis-accent" /> {t('me')}
           </h2>
       </div>

       {/* System Info Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* User Card */}
          <div className="bg-jarvis-bgSec border border-jarvis-panel rounded-2xl p-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <Cloud size={100} />
             </div>
             <h3 className="text-jarvis-accent font-bold mb-4 flex items-center gap-2">
                <Info size={18} /> IDENTITY MATRIX
             </h3>
             <div className="space-y-3 relative z-10">
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-gray-500 text-sm">Designation</span>
                   <span className="text-white font-mono">{userProfile?.name || 'Guest User'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-gray-500 text-sm">Comm Frequency</span>
                   <span className="text-white font-mono text-sm">{userProfile?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-gray-500 text-sm">Location</span>
                   <span className="text-white font-mono text-sm">{userProfile?.city}, {userProfile?.country}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                   <span className="text-gray-500 text-sm">{t('language')}</span>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => setLanguage('en')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${language === 'en' ? 'bg-jarvis-accent text-black' : 'bg-white/5 text-gray-400'}`}
                      >
                        EN
                      </button>
                      <button 
                        onClick={() => setLanguage('id')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${language === 'id' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400'}`}
                      >
                        ID
                      </button>
                   </div>
                </div>
             </div>
          </div>

          {/* Neural Links (API Keys) */}
          <div className="bg-jarvis-bgSec border border-jarvis-panel rounded-2xl p-6 relative overflow-hidden">
             <h3 className="text-jarvis-accent font-bold mb-4 flex items-center gap-2">
                <Zap size={18} /> {t('neural_links')}
             </h3>
             
             <div className="mb-4">
               <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type={showKey ? "text" : "password"}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Enter Gemini API Key"
                      className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-lg pl-10 pr-10 py-2 text-sm text-white outline-none"
                    />
                    <button 
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button 
                    onClick={handleAddKey}
                    disabled={saveStatus === 'testing'}
                    className={`px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
                      saveStatus === 'testing' ? 'bg-yellow-500/20 text-yellow-500' :
                      saveStatus === 'valid' || saveStatus === 'saved' ? 'bg-green-500 text-black' :
                      saveStatus === 'invalid' ? 'bg-red-500 text-white' :
                      'bg-jarvis-accent text-black hover:shadow-[0_0_10px_#00d4ff]'
                    }`}
                  >
                    {saveStatus === 'testing' ? 'TESTING...' : 
                     saveStatus === 'saved' ? <Check size={16} /> : 
                     saveStatus === 'invalid' ? 'INVALID' : <Plus size={16} />}
                  </button>
               </div>
               <p className="text-[10px] text-gray-500 mt-2">
                 *Keys are stored locally and encrypted. Multiple keys allow for load balancing and higher rate limits.
               </p>
             </div>

             <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {apiKeys.map((k, i) => (
                  <div key={i} className="flex items-center justify-between bg-jarvis-panel p-2 rounded-lg border border-white/5">
                     <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                        <span className="text-xs font-mono text-gray-300">
                           ••••••••{k.slice(-4)}
                        </span>
                     </div>
                     <button onClick={() => removeKey(i)} className="text-gray-600 hover:text-red-500">
                        <Trash2 size={14} />
                     </button>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <div className="text-center text-xs text-jarvis-error py-4 border border-dashed border-jarvis-error/30 rounded-lg bg-jarvis-error/5">
                     NO NEURAL LINKS DETECTED
                  </div>
                )}
             </div>
          </div>
       </div>

       {/* System Version Log */}
       <div className="bg-jarvis-bgSec border border-jarvis-panel rounded-2xl p-6">
           <h3 className="text-gray-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
               <GitBranch size={16} /> System Changelog
           </h3>
           
           <div className="space-y-6 relative border-l border-jarvis-panel ml-2 pl-6">
               
               {/* Current Version */}
               <div className="relative">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-jarvis-accent shadow-[0_0_10px_#00d4ff]"></div>
                  <div className="flex justify-between items-start">
                      <h4 className="text-jarvis-accent font-bold">v1.5.2 - Connection Stability Fix</h4>
                      <span className="text-xs text-gray-500 font-mono">CURRENT</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                      Switched to Long Polling to resolve Firestore transport errors.
                  </p>
               </div>

               {/* Previous */}
               <div className="relative opacity-70">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-gray-600"></div>
                  <div className="flex justify-between items-start">
                      <h4 className="text-white font-bold">v1.5.1 - Delete Logic Debug</h4>
                      <span className="text-xs text-gray-500 font-mono">PREVIOUS</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                      Fixed unresponsive delete button in sidebar. Implemented visual debugging alerts, robust error handling for Firestore operations, and z-index UI fixes.
                  </p>
               </div>

               <div className="relative opacity-50">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-gray-700"></div>
                  <h4 className="text-white font-bold">v1.5 - Database Logic Update</h4>
                  <p className="text-sm text-gray-400 mt-1">
                     Implemented Soft Delete architecture (Trash Bin), Restore capability, and granular message deletion.
                  </p>
               </div>
           </div>
       </div>

       <div className="mt-8 text-center">
          <button 
             onClick={logout}
             className="text-jarvis-error hover:text-red-400 text-sm font-bold border border-jarvis-error/30 hover:border-jarvis-error px-6 py-2 rounded-full transition"
          >
             TERMINATE SESSION
          </button>
          <div className="mt-4 text-[10px] text-gray-600 font-mono">
             JARVIS SYSTEM ID: {userProfile?.uid || 'UNKNOWN'}
          </div>
       </div>
    </div>
  );
};