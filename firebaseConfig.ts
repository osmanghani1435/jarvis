import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Config provided by user
const firebaseConfig = {
  apiKey: "AIzaSyD2OMA-phN53--ENePSfGoSuhkwSbl4Pqo",
  authDomain: "jarves-c8f91.firebaseapp.com",
  projectId: "jarves-c8f91",
  storageBucket: "jarves-c8f91.firebasestorage.app",
  messagingSenderId: "1082905448202",
  appId: "1:1082905448202:web:10eefa3704d79dcb8bb4f3",
  measurementId: "G-DFTXXM2YVR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Using initializeFirestore with experimentalForceLongPolling to prevent WebChannelConnection transport errors
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);

export const isConfigured = true;