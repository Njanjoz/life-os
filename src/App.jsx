import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import WeekView from './components/WeekView/WeekView';
import Dashboard from './pages/Dashboard';
import Timetable from './components/Timetable/Timetable';
import { Login } from './components/Login/Login';
import { LayoutDashboard, CalendarDays, Bell, Printer } from 'lucide-react';
import { requestNotificationPermission } from './services/notificationService';
import './index.css';

function AppContent() {
  const { user, loading, signInWithGoogle, logout, error } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Check notification permission on load
  useEffect(() => {
    if (user && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, [user]);

  // Request notification permission when user logs in
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification("✅ Notifications Enabled", {
        body: "You will now receive automatic task reminders and alerts.",
        icon: "/favicon.ico"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading LifeOS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={signInWithGoogle} loading={loading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-6 font-sans">
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>
      
      <div className="max-w-[1600px] mx-auto relative z-10">
        <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white">
              Life<span className="text-purple-400">OS</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
              Time Management • Discipline • Performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition ${
                  activeTab === 'schedule' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays size={14} />
                Schedule
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition ${
                  activeTab === 'dashboard' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard size={14} />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('timetable')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition ${
                  activeTab === 'timetable' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Printer size={14} />
                Timetable
              </button>
            </div>
            
            {/* Notification Enable Button */}
            {!notificationsEnabled && (
              <button 
                onClick={handleEnableNotifications}
                className="bg-green-600/20 hover:bg-green-600/30 px-3 py-2 rounded-xl text-xs text-green-400 transition flex items-center gap-1 border border-green-500/30"
              >
                <Bell size={12} />
                Enable Notifications
              </button>
            )}
            
            {notificationsEnabled && (
              <div className="bg-green-600/20 px-3 py-2 rounded-xl text-xs text-green-400 flex items-center gap-1">
                <Bell size={12} />
                Notifications ON
              </div>
            )}
            
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded-xl">
              <span className="text-xs">👤 {user.displayName || user.email}</span>
            </div>
            <button 
              onClick={logout}
              className="bg-red-600/20 hover:bg-red-600/30 px-3 py-2 rounded-xl text-xs text-red-400 transition"
            >
              Sign Out
            </button>
          </div>
        </header>
        
        {activeTab === 'schedule' && <WeekView />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'timetable' && <Timetable />}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;