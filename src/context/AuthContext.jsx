import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, signInWithPopup, googleProvider, signOut, onAuthStateChanged } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (mounted) {
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
      
      // Clear any existing auth state
      await signOut(auth).catch(() => {});
      
      // Start new sign in
      const result = await signInWithPopup(auth, googleProvider);
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
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Logout error:", err);
      setError(err.message);
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
