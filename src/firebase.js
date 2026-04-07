import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp, writeBatch } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDGw5F7ZydyAtD7eYXKLtJV5Top-muAais",
  authDomain: "personal-life-os-7d65b.firebaseapp.com",
  projectId: "personal-life-os-7d65b",
  storageBucket: "personal-life-os-7d65b.firebasestorage.app",
  messagingSenderId: "107915113136",
  appId: "1:107915113136:web:7f86c49db0bde518bcc175",
  measurementId: "G-F5EHY8YHC5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Detect mobile Chrome/Brave
const isMobileChrome = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(ua);
  return isChrome && isMobile;
};

// Initialize Firestore - SIMPLE is better
// Don't use enableIndexedDbPersistence on mobile Chrome
const db = getFirestore(app);

// Initialize Auth - SIMPLE is better
const auth = getAuth(app);

// Set persistence to localStorage only (works on all browsers)
// Do this ONCE, not multiple times
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});

const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Detect if running in Capacitor
const isCapacitor = () => {
  return typeof window !== 'undefined' && window.Capacitor !== undefined;
};

export { 
  db, auth, 
  signInWithPopup, GoogleAuthProvider, 
  signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, orderBy, Timestamp, writeBatch,
  googleProvider,
  isCapacitor,
  isMobileChrome
};