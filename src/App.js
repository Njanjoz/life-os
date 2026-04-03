import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import WeekView from './components/WeekView/WeekView';
import Dashboard from './pages/Dashboard';
import { Login } from './components/Login/Login';
import { LayoutDashboard, CalendarDays, Bell } from 'lucide-react';
import { requestNotificationPermission } from './components/services/notificationService';
import './index.css';

function AppContent() {
  const { user, loading, signInWithGoogle, logout, error } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    // Check notification permission status on load
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      // Auto-request permissions when user is logged in
      if (user && Notification.permission === 'default') {
        requestNotificationPermission().then(granted => {
          setNotificationPermission(granted ? 'granted' : 'denied');
        });
      }
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
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
        <header className="mb-6 flex justify-between items-end">
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
            </div>
            
            {/* Notification permission button - only show if not granted */}
            {notificationPermission !== 'granted' && (
              <button
                onClick={handleEnableNotifications}
                className="bg-purple-600/20 hover:bg-purple-600/30 px-3 py-2 rounded-xl text-xs text-purple-400 transition flex items-center gap-1"
              >
                <Bell size={14} />
                Enable Notifications
              </button>
            )}
            
            {/* Show notification status when granted */}
            {notificationPermission === 'granted' && (
              <div className="bg-green-600/20 px-3 py-2 rounded-xl text-xs text-green-400 flex items-center gap-1">
                <Bell size={14} />
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
        
        {activeTab === 'schedule' ? <WeekView /> : <Dashboard />}
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
