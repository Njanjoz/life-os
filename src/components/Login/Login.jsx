import React, { useState } from 'react';
import { LogIn, Brain, Target, Zap, AlertCircle } from 'lucide-react';

export const Login = ({ onLogin, loading, error }) => {
  const [localError, setLocalError] = useState('');

  const handleGoogleSignIn = async () => {
    setLocalError('');
    try {
      await onLogin();
    } catch (err) {
      setLocalError(err.message || 'Failed to sign in');
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px] opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-30 animate-pulse"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-600/20 border border-purple-500/50 mb-4">
              <Brain size={40} className="text-purple-400" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white">
              Life<span className="text-purple-400">OS</span>
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Your Personal Time Operating System
            </p>
          </div>
          
          {displayError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {displayError}
            </div>
          )}
          
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Target size={18} className="text-purple-400" />
              <span className="text-sm text-slate-300">Track your time with precision</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Zap size={18} className="text-yellow-400" />
              <span className="text-sm text-slate-300">Real-time task progress visualization</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Brain size={18} className="text-cyan-400" />
              <span className="text-sm text-slate-300">AI-powered insights & discipline scoring</span>
            </div>
          </div>
          
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Sign in with Google
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-slate-500 mt-6">
            By signing in, you agree to track your productivity and improve your time management
          </p>
        </div>
      </div>
    </div>
  );
};
