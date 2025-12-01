
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, AlertCircle, ArrowLeft, X, User, Lock, Mail, UserPlus, LogIn, Eye, EyeOff, MapPin, Globe, UserCheck, CheckCircle } from 'lucide-react';
import { getTranslation } from '../services/translations';

interface StoredAccount {
  email: string;
  name: string;
  lastLogin: number;
}

type AuthView = 'login' | 'register' | 'reset' | 'accounts';

export const AuthPage: React.FC = () => {
  const { loginWithEmail, registerWithEmail, resetPassword, demoLogin, error: authError, language, setLanguage } = useAuth();
  
  // View State
  const [view, setView] = useState<AuthView>('register'); // Default to Register
  const [isLanguageSelected, setIsLanguageSelected] = useState(false); // Splash screen logic

  // Data State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');

  const [recentAccounts, setRecentAccounts] = useState<StoredAccount[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Translations helper
  const t = (key: any) => getTranslation(language, key);

  // Load recent accounts on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('jarvis_recent_accounts');
      if (stored) {
        const accounts: StoredAccount[] = JSON.parse(stored);
        setRecentAccounts(accounts);
      }
    } catch (e) {
      console.error("Failed to load local accounts");
    }
  }, []);

  const saveToRecentAccounts = (email: string, name: string) => {
    const newAccount: StoredAccount = { email, name, lastLogin: Date.now() };
    const updated = [newAccount, ...recentAccounts.filter(a => a.email !== email)].slice(0, 3);
    setRecentAccounts(updated);
    localStorage.setItem('jarvis_recent_accounts', JSON.stringify(updated));
  };

  const removeAccount = (e: React.MouseEvent, emailToRemove: string) => {
    e.stopPropagation();
    const updated = recentAccounts.filter(a => a.email !== emailToRemove);
    setRecentAccounts(updated);
    localStorage.setItem('jarvis_recent_accounts', JSON.stringify(updated));
    if (updated.length === 0) setView('register');
  };

  // Helper for Email Input
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\s/g, ''); // Remove spaces
      setEmail(val);
  };

  const appendGmail = () => {
      if (!email.includes('@')) {
          setEmail(email + '@gmail.com');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (view === 'login') {
        await loginWithEmail(email, password);
        const existing = recentAccounts.find(a => a.email === email);
        saveToRecentAccounts(email, existing?.name || email.split('@')[0]);
      } else if (view === 'register') {
        if (!name.trim()) throw new Error("Name is required for registration.");
        if (!email.includes('@')) throw new Error("Please enter a valid email address (e.g. name@gmail.com)");
        await registerWithEmail(name, email, password, country, city, gender, language);
        saveToRecentAccounts(email, name);
      } else if (view === 'reset') {
        await resetPassword(email);
        setSuccessMsg(`Recovery protocol initiated. Check frequency ${email} for instructions.`);
        setIsLoading(false); 
        return;
      }
    } catch (err: any) {
      setLocalError(err.message.replace('Firebase: ', ''));
      setIsLoading(false);
    }
  };

  const handleAccountSelect = (account: StoredAccount) => {
    setEmail(account.email);
    setName(account.name);
    setView('login');
  };

  const handleLanguageSelection = (lang: 'en' | 'id') => {
      setLanguage(lang);
      setIsLanguageSelected(true);
      if (recentAccounts.length > 0) {
          setView('accounts');
      }
  };

  // SPLASH SCREEN: LANGUAGE SELECTION
  if (!isLanguageSelected) {
      return (
          <div className="min-h-screen bg-jarvis-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-[800px] h-[800px] bg-jarvis-accent/10 rounded-full blur-[100px] animate-pulse-slow"></div>
             </div>

             <div className="z-10 text-center mb-10">
                 <div className="w-20 h-20 mx-auto rounded-full border-2 border-jarvis-accent flex items-center justify-center mb-6 shadow-[0_0_30px_#00d4ff] bg-jarvis-bg">
                    <Shield size={40} className="text-jarvis-accent" />
                 </div>
                 <h1 className="text-4xl font-bold text-white tracking-widest mb-2">JARVIS</h1>
                 <p className="text-jarvis-textSec uppercase tracking-wider text-sm">System Initialization</p>
             </div>

             <h2 className="text-white text-lg font-bold mb-6 tracking-wide">Select Language / Pilih Bahasa</h2>

             <div className="flex flex-col gap-4 w-full max-w-sm z-10">
                 <button 
                   onClick={() => handleLanguageSelection('en')}
                   className="group relative bg-jarvis-panel border border-jarvis-panel hover:border-jarvis-accent p-6 rounded-2xl flex items-center gap-4 transition-all hover:bg-jarvis-accent/5 hover:scale-105"
                 >
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 border-2 border-white/20">
                       EN
                    </div>
                    <div className="text-left">
                       <div className="text-white font-bold text-lg group-hover:text-jarvis-accent transition">English</div>
                       <div className="text-gray-500 text-sm">Default Protocol</div>
                    </div>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition">
                       <CheckCircle className="text-jarvis-accent" />
                    </div>
                 </button>

                 <button 
                   onClick={() => handleLanguageSelection('id')}
                   className="group relative bg-jarvis-panel border border-jarvis-panel hover:border-red-500 p-6 rounded-2xl flex items-center gap-4 transition-all hover:bg-red-500/5 hover:scale-105"
                 >
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 border-2 border-white/20">
                       ID
                    </div>
                    <div className="text-left">
                       <div className="text-white font-bold text-lg group-hover:text-red-500 transition">Indonesian</div>
                       <div className="text-gray-500 text-sm">Bahasa Indonesia</div>
                    </div>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition">
                       <CheckCircle className="text-red-500" />
                    </div>
                 </button>
             </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-jarvis-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute w-[500px] h-[500px] bg-jarvis-accent/5 rounded-full blur-[100px] -top-20 -left-20 animate-pulse-slow"></div>
      <div className="absolute w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] bottom-0 right-0"></div>

      <div className="bg-jarvis-bgSec/80 backdrop-blur-md border border-jarvis-panel p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full border-2 border-jarvis-accent flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,212,255,0.3)] bg-jarvis-bg">
            <Shield size={32} className="text-jarvis-accent" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest">JARVIS</h1>
          <p className="text-jarvis-textSec text-xs mt-2 font-mono uppercase tracking-wider">
            {view === 'accounts' ? t('select_language') : 
             view === 'register' ? t('register_title') : 
             view === 'reset' ? t('forgot_password') : t('login_title')}
          </p>
        </div>

        {/* Messages */}
        {(authError || localError) && (
          <div className="mb-6 bg-jarvis-error/10 border border-jarvis-error/50 rounded-xl p-3 flex items-start gap-3 text-jarvis-error text-sm animate-pulse">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{localError || authError}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 bg-jarvis-success/10 border border-jarvis-success/50 rounded-xl p-3 flex items-start gap-3 text-jarvis-success text-sm">
            <Shield size={18} className="mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW: RECENT ACCOUNTS */}
        {view === 'accounts' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {recentAccounts.map((acc) => (
                <div 
                  key={acc.email}
                  onClick={() => handleAccountSelect(acc)}
                  className="group relative flex items-center gap-4 p-3 bg-jarvis-panel border border-transparent hover:border-jarvis-accent/50 rounded-xl cursor-pointer transition-all hover:bg-jarvis-accent/5"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-jarvis-accent to-purple-500 p-[2px]">
                     <div className="w-full h-full bg-jarvis-bgSec rounded-full flex items-center justify-center text-white font-bold">
                       {acc.name.charAt(0).toUpperCase()}
                     </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{acc.name}</div>
                    <div className="text-jarvis-textSec text-xs truncate">{acc.email}</div>
                  </div>
                  <button 
                    onClick={(e) => removeAccount(e, acc.email)}
                    className="p-2 text-gray-500 hover:text-jarvis-error opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => { setView('login'); setEmail(''); setPassword(''); }}
              className="w-full py-3 mt-4 text-sm text-jarvis-textSec hover:text-white flex items-center justify-center gap-2 border border-dashed border-jarvis-panel rounded-xl hover:border-jarvis-accent/30 transition"
            >
              <UserPlus size={16} /> {t('create_user')}
            </button>
          </div>
        )}

        {/* VIEW: FORMS (Login / Register / Reset) */}
        {view !== 'accounts' && (
          <div className="space-y-5">

            <form className="space-y-4" onSubmit={handleSubmit}>
              {view === 'register' && (
                <>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder={t('full_name')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-4 py-3 text-white outline-none transition placeholder-gray-600"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative group">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                      <input 
                        type="text" 
                        placeholder={t('country')}
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-4 py-3 text-white outline-none transition placeholder-gray-600"
                      />
                    </div>
                    <div className="relative group">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                      <input 
                        type="text" 
                        placeholder={t('city')}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-4 py-3 text-white outline-none transition placeholder-gray-600"
                      />
                    </div>
                  </div>
                  <div className="relative group">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                    <select 
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-4 py-3 text-white outline-none transition placeholder-gray-600 appearance-none"
                    >
                      <option value="male">{t('gender_male')}</option>
                      <option value="female">{t('gender_female')}</option>
                      <option value="other">{t('gender_other')}</option>
                    </select>
                  </div>
                </>
              )}
              
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder={t('email')}
                  value={email}
                  onChange={handleEmailChange}
                  className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-4 py-3 text-white outline-none transition placeholder-gray-600"
                  required
                />
                {/* Gmail Suggestion Chip */}
                {email.length > 0 && !email.includes('@') && (
                    <button 
                       type="button"
                       onClick={appendGmail}
                       className="absolute right-2 top-1/2 -translate-y-1/2 bg-jarvis-accent/10 text-jarvis-accent text-[10px] px-2 py-1 rounded border border-jarvis-accent/30 hover:bg-jarvis-accent hover:text-black transition animate-in fade-in zoom-in"
                    >
                       {t('suggest_gmail')}
                    </button>
                )}
              </div>
              
              {view !== 'reset' && (
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-jarvis-accent transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-jarvis-panel border border-jarvis-panel focus:border-jarvis-accent rounded-xl pl-10 pr-12 py-3 text-white outline-none transition placeholder-gray-600"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {view === 'login' && (
                <div className="flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => { setView('reset'); setLocalError(''); setSuccessMsg(''); }}
                    className="text-xs text-jarvis-accent hover:text-white transition-colors"
                  >
                    {t('forgot_password')}
                  </button>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className={`w-full font-bold py-3 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  view === 'reset' 
                    ? 'bg-jarvis-warning/20 text-jarvis-warning border border-jarvis-warning hover:bg-jarvis-warning hover:text-black animate-heartbeat-cyan' 
                    : 'bg-jarvis-accent/10 border border-jarvis-accent text-jarvis-accent hover:bg-jarvis-accent hover:text-black hover:shadow-[0_0_15px_#00d4ff] animate-heartbeat-cyan'
                }`}
              >
                {isLoading ? (
                  <span className="animate-pulse">PROCESSING...</span>
                ) : (
                  <>
                    {view === 'login' && <><LogIn size={18} /> {t('initiate_session')}</>}
                    {view === 'register' && <><UserPlus size={18} /> {t('create_user')}</>}
                    {view === 'reset' && 'SEND RECOVERY SIGNAL'}
                  </>
                )}
              </button>
            </form>

            {/* Navigation Buttons */}
            <div className="space-y-3 mt-6 pt-4 border-t border-jarvis-panel">
              {view === 'reset' ? (
                <button 
                  onClick={() => { setView('login'); setLocalError(''); }}
                  className="w-full flex items-center justify-center gap-2 text-jarvis-textSec hover:text-white transition"
                >
                  <ArrowLeft size={16} /> {t('back_login')}
                </button>
              ) : (
                <>
                  {recentAccounts.length > 0 && (
                    <button 
                      onClick={() => { setView('accounts'); setLocalError(''); }}
                      className="w-full text-xs text-gray-500 hover:text-white mb-2"
                    >
                      ← Back to accounts
                    </button>
                  )}
                  
                  {view === 'login' ? (
                    <button 
                      onClick={() => { setView('register'); setLocalError(''); }}
                      className="w-full group relative overflow-hidden bg-jarvis-bg border-2 border-jarvis-accent/30 hover:border-jarvis-accent rounded-xl p-4 transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4 justify-center">
                        <div className="w-10 h-10 rounded-full bg-jarvis-accent/10 flex items-center justify-center text-jarvis-accent group-hover:bg-jarvis-accent group-hover:text-black transition">
                           <UserPlus size={20} />
                        </div>
                        <div className="flex flex-col items-start">
                           <span className="text-sm font-bold text-white group-hover:text-jarvis-accent transition-colors">{t('new_user_prompt')}</span>
                           <span className="text-[10px] text-gray-400 group-hover:text-white/80 transition">{t('register_desc')}</span>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setView('login'); setLocalError(''); }}
                      className="w-full group relative overflow-hidden bg-jarvis-bg border-2 border-jarvis-panel hover:border-white/40 rounded-xl p-4 transition-all shadow-lg"
                    >
                       <div className="flex items-center gap-4 justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition">
                           <LogIn size={20} />
                        </div>
                        <div className="flex flex-col items-start">
                           <span className="text-sm font-bold text-white transition-colors">{t('already_auth')}</span>
                           <span className="text-[10px] text-gray-400 group-hover:text-white/80 transition">{t('login_desc')}</span>
                        </div>
                      </div>
                    </button>
                  )}
                </>
              )}
            </div>
            
            {/* Demo Link */}
            {view === 'login' && (
              <div className="text-center mt-2">
                 <button 
                  onClick={() => demoLogin()} 
                  className="text-[10px] text-gray-600 hover:text-gray-400 transition"
                >
                  System Override: Demo Mode
                </button>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};
