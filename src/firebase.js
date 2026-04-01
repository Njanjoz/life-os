import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";

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
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { 
  db, auth, 
  signInWithPopup, GoogleAuthProvider, 
  signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, orderBy, Timestamp,
  googleProvider
};
