import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, signInWithPopup, googleProvider, signOut, onAuthStateChanged, isMobileChrome } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    // Clear any corrupted Firebase storage on mobile Chrome
    if (isMobileChrome()) {
      const corruptedKeys = [
        'firebase:previous_websocket_failure',
        'firebase:authUser:apiKey:AIzaSyDGw5F7ZydyAtD7eYXKLtJV5Top-muAais'
      ];
      corruptedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value && (value.includes('error') || value === 'null')) {
          localStorage.removeItem(key);
          console.log(`Removed corrupted storage key: ${key}`);
        }
      });
    }
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (mounted) {
        console.log('Auth state changed:', firebaseUser?.email || 'No user');
        setUser(firebaseUser);
        setLoading(false);
        setError(null);
      }
    }, (err) => {
      if (mounted) {
        console.error("Auth state error:", err);
        setError(err.message);
        setLoading(false);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      console.log('Starting Google sign in...');
      
      // For mobile Chrome, add a small delay to ensure clean state
      if (isMobileChrome()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Sign in successful:', result.user?.email);
      setUser(result.user);
      return result.user;
    } catch (err) {
      console.error("Google sign-in error:", err);
      
      // Handle specific error codes
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in cancelled - popup was closed');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked! Please allow pop-ups for this site');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google Sign-In. Please check Firebase Console.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error - please check your connection');
      } else if (err.code === 'auth/internal-error') {
        // On mobile Chrome, try to recover by clearing storage
        if (isMobileChrome()) {
          console.warn('Internal error on mobile Chrome, attempting recovery...');
          localStorage.removeItem('firebase:previous_websocket_failure');
          setError('Please try again. If issue persists, close and reopen the browser tab.');
        } else {
          setError('Authentication error. Please try again.');
        }
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
      
      // Clean up storage on logout for mobile Chrome
      if (isMobileChrome()) {
        const firebaseKeys = Object.keys(localStorage).filter(key => key.startsWith('firebase:'));
        firebaseKeys.forEach(key => {
          if (key.includes('websocket') || key.includes('authUser')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};