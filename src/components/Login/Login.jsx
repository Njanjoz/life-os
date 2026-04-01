import React, { useState } from 'react';
import { LogIn, UserPlus, Brain, Target, Zap, Mail, Lock } from 'lucide-react';

export const Login = ({ onLogin, loading }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showGoogleSignIn, setShowGoogleSignIn] = useState(true);

  const handleGoogleSignIn = () => {
    onLogin();
  };

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
          
          {/* Toggle between Login and Sign Up */}
          <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                isLogin ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                !isLogin ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
          
          {/* Email/Password Form (Coming Soon) */}
          <div className="mb-6">
            <div className="relative mb-4">
              <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition"
              />
            </div>
            <div className="relative mb-4">
              <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none transition"
              />
            </div>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-slate-700 text-slate-400 font-medium cursor-not-allowed"
            >
              {isLogin ? 'Sign In' : 'Sign Up'} (Coming Soon)
            </button>
          </div>
          
          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-transparent text-slate-500">OR</span>
            </div>
          </div>
          
          {/* Google Sign In Button */}
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
                Continue with Google
              </>
            )}
          </button>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-400 hover:text-purple-300 transition"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
          
          <p className="text-center text-xs text-slate-500 mt-4">
            By continuing, you agree to track your productivity and improve your time management
          </p>
        </div>
      </div>
    </div>
  );
};
