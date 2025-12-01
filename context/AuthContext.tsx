

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider, isConfigured } from '../firebaseConfig';
import { UserProfile, AINotification } from '../types';
import { createUserProfile, getUserApiKeys, syncMemoryToLocal } from '../services/dbService';
import { analyzeUserActivity, generateDailyBriefing } from '../services/geminiService';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../firebaseConfig'; 

interface LiveOptions {
   conversationId: string;
   initialTopic?: string;
   initialPrompt?: string; // New: For saying "Any questions?"
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  notifications: AINotification[];
  language: 'en' | 'id';
  setLanguage: (lang: 'en' | 'id') => void;
  isNewUser: boolean; // Flag to trigger onboarding
  setIsNewUser: (val: boolean) => void;
  clearNotification: (id: string) => void;
  // signInWithGoogle: () => Promise<void>; // Removed as requested
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, country?: string, city?: string, gender?: 'male' | 'female' | 'other', language?: 'en' | 'id') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: () => void;
  error: string | null;
  
  // GLOBAL LIVE INTERFACE CONTROL
  showLiveInterface: boolean;
  setShowLiveInterface: (show: boolean) => void;
  liveOptions: LiveOptions | null;
  setLiveOptions: (opts: LiveOptions | null) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [language, setLanguageState] = useState<'en' | 'id'>('en');
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Global Live Interface State
  const [showLiveInterface, setShowLiveInterface] = useState(false);
  const [liveOptions, setLiveOptions] = useState<LiveOptions | null>(null);

  // Monitoring Interval Ref
  const monitoringRef = useRef<any>(null);

  // Persistence for language across sessions (before auth)
  useEffect(() => {
    const savedLang = localStorage.getItem('jarvis_lang');
    if (savedLang === 'en' || savedLang === 'id') {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: 'en' | 'id') => {
    setLanguageState(lang);
    localStorage.setItem('jarvis_lang', lang);
    if (userProfile) {
      // Sync to DB immediately if logged in
      const updated = { ...userProfile, language: lang };
      setUserProfile(updated);
      createUserProfile(updated);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch full profile from DB
        let profileData: UserProfile = {
          uid: currentUser.uid,
          name: currentUser.displayName,
          email: currentUser.email,
          createdAt: Date.now(),
          language: language // Default to current local state if not found
        };

        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                profileData = { ...profileData, ...data };
                // If DB has language, update local state
                if (data.language) {
                   setLanguageState(data.language);
                   localStorage.setItem('jarvis_lang', data.language);
                }
            }
        } catch (e) {
            console.error("Failed to fetch extended profile", e);
        }

        setUserProfile(profileData);
        
        // Ensure profile exists in DB (updates lastActive)
        await createUserProfile(profileData);

        // LOAD MEMORY
        await syncMemoryToLocal(currentUser.uid);

        try {
          const keys = await getUserApiKeys(currentUser.uid);
          if (keys && keys.length > 0) {
            localStorage.setItem('jarvis_api_keys', JSON.stringify(keys));
          }
        } catch (e) {
          console.error("Error loading keys", e);
        }

        // TRIGGER DAILY BRIEFING (Monitoring Agent Feature)
        generateDailyBriefing(profileData);

        // START MONITORING AGENT
        if (monitoringRef.current) clearInterval(monitoringRef.current);
        monitoringRef.current = setInterval(async () => {
             console.log("Running Monitoring Agent...");
             const suggestion = await analyzeUserActivity(currentUser.uid);
             if (suggestion) {
                 setNotifications(prev => [suggestion, ...prev]);
             }
        }, 10 * 60 * 1000); 

      } else {
        setUserProfile(null);
        // Do not reset language here, keep selection for login screen
        localStorage.removeItem('jarvis_core_memory');
        localStorage.removeItem('jarvis_insights');
        localStorage.removeItem('jarvis_last_briefing_date');
        if (monitoringRef.current) clearInterval(monitoringRef.current);
      }
      setLoading(false);
    });
    return () => {
        unsubscribe();
        if (monitoringRef.current) clearInterval(monitoringRef.current);
    };
  }, []);

  const signInWithGoogle = async () => {
    // Hidden implementation
    setError(null);
    if (!isConfigured) {
      demoLogin();
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
         if (result.user.metadata.creationTime === result.user.metadata.lastSignInTime) {
             setIsNewUser(true);
         }
      }
    } catch (err: any) {
      console.error("Auth Error", err);
      setError(err.message);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    if (!isConfigured) {
      demoLogin();
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login Error", err);
      setError(err.message);
      throw err;
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string, country?: string, city?: string, gender?: 'male' | 'female' | 'other', lang?: 'en' | 'id') => {
    setError(null);
    if (!isConfigured) {
      demoLogin();
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await updateProfile(result.user, { displayName: name });
        const newProfile: UserProfile = {
           uid: result.user.uid,
           name: name,
           email: email,
           country, 
           city,
           gender,
           language: lang || language,
           createdAt: Date.now()
        };
        setUserProfile(newProfile);
        await createUserProfile(newProfile);
        setIsNewUser(true); // Flag for onboarding
      }
    } catch (err: any) {
      console.error("Registration Error", err);
      setError(err.message);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    if (!isConfigured) return; 
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error("Reset Password Error", err);
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    localStorage.removeItem('jarvis_api_keys'); 
    localStorage.removeItem('jarvis_core_memory');
    localStorage.removeItem('jarvis_insights');
    localStorage.removeItem('jarvis_last_briefing_date');

    if (monitoringRef.current) clearInterval(monitoringRef.current);
    
    if (!isConfigured) {
      setUser(null);
      setUserProfile(null);
      return;
    }
    await signOut(auth);
  };

  const demoLogin = () => {
    const mockUser: any = { uid: 'demo', displayName: 'Osman Ghani', email: 'osman.ghani@jarvis.ai' };
    setUser(mockUser);
    setUserProfile({
      uid: 'demo',
      name: 'Osman Ghani',
      email: 'osman.ghani@jarvis.ai',
      country: 'USA',
      city: 'New York',
      gender: 'male',
      language: language,
      createdAt: Date.now()
    });
    setLoading(false);
  };

  const clearNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      notifications,
      language,
      setLanguage,
      isNewUser,
      setIsNewUser,
      clearNotification,
      loginWithEmail, 
      registerWithEmail,
      resetPassword,
      logout, 
      demoLogin,
      error,
      // Global Live State
      showLiveInterface,
      setShowLiveInterface,
      liveOptions,
      setLiveOptions
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};