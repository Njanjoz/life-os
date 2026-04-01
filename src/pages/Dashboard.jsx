import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentWeek, getWeekTasks, updateWeekMetrics } from '../services/firebaseTaskService';
import { useAuth } from '../context/AuthContext';
import WeekChart from '../components/dashboard/WeekChart';
import DayAnalysis from '../components/dashboard/DayAnalysis';
import { TrendingUp, Target, Zap, Clock, Award, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Dashboard = () => {
  const { user } = useAuth();
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const currentWeek = await getCurrentWeek(selectedDate);
      setWeek(currentWeek);
      const weekTasks = await getWeekTasks(currentWeek.id);
      setTasks(weekTasks);
      setMetrics(currentWeek.metrics || {});
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };

  const getWeekStart = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const formatDateRange = () => {
    const startOfWeek = getWeekStart(selectedDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Build per-day analytics
  const dayData = days.map(day => {
    const dayTasks = tasks.filter(t => t.day === day);
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.status === 'completed').length;
    const missed = dayTasks.filter(t => t.status === 'missed').length;
    const pending = dayTasks.filter(t => t.status === 'pending' && t.title).length;
    const rescheduled = dayTasks.reduce((sum, t) => sum + (t.rescheduleCount || 0), 0);
    const avgAccuracy = dayTasks.length ? dayTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / dayTasks.length : 0;

    const completionRate = total ? (completed / total) * 100 : 0;
    const failureRate = total ? (missed / total) * 100 : 0;

    return {
      day,
      completionRate: Math.round(completionRate),
      failureRate: Math.round(failureRate),
      rescheduled,
      total,
      completed,
      missed,
      pending,
      avgAccuracy
    };
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
        <p className="ml-3 text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
        <div className="flex gap-2">
          <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white/10 rounded-xl transition text-white">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white/10 rounded-xl transition text-white">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <Calendar size={18} className="text-purple-400" />
            <span className="font-semibold text-white">{formatDateRange()}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Performance Dashboard</p>
        </div>
        <div className="w-16" />
      </div>

      {/* Week Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Weekly Score" 
          value={metrics.weeklyScore || 0} 
          icon={<Award size={18} className="text-yellow-400" />}
          color="from-yellow-500/20 to-orange-500/20"
        />
        <MetricCard 
          title="Completion Rate" 
          value={metrics.completionRate || 0} 
          icon={<Target size={18} className="text-green-400" />}
          color="from-green-500/20 to-emerald-500/20"
        />
        <MetricCard 
          title="Discipline Score" 
          value={metrics.disciplineScore || 0} 
          icon={<Zap size={18} className="text-blue-400" />}
          color="from-blue-500/20 to-cyan-500/20"
        />
        <MetricCard 
          title="Time Accuracy" 
          value={metrics.timeAccuracy || 0} 
          icon={<Clock size={18} className="text-purple-400" />}
          color="from-purple-500/20 to-pink-500/20"
        />
      </div>

      {/* Week Graph */}
      <WeekChart data={dayData} onDayClick={setSelectedDay} />

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Total Tasks" 
          value={metrics.totalTasks || 0}
          subtitle={`${metrics.completedTasks || 0} completed`}
          color="text-blue-400"
        />
        <StatCard 
          title="Missed Tasks" 
          value={metrics.missedCount || 0}
          subtitle={`${Math.round((metrics.missedCount || 0) / (metrics.totalTasks || 1) * 100)}% of total`}
          color="text-red-400"
        />
        <StatCard 
          title="Reschedules" 
          value={metrics.totalReschedules || 0}
          subtitle={`Avg ${Math.round((metrics.totalReschedules || 0) / (dayData.filter(d => d.total > 0).length || 1))} per day`}
          color="text-yellow-400"
        />
      </div>

      {/* Day Deep Analysis Modal */}
      {selectedDay && (
        <DayAnalysis 
          day={selectedDay} 
          dayData={dayData.find(d => d.day === selectedDay)}
          tasks={tasks.filter(t => t.day === selectedDay)} 
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }) => (
  <div className={`bg-gradient-to-br ${color} backdrop-blur-xl rounded-2xl p-4 border border-white/10`}>
    <div className="flex justify-between items-start">
      <p className="text-xs text-slate-400">{title}</p>
      {icon}
    </div>
    <p className="text-2xl font-bold mt-2 text-white">{Math.round(value)}%</p>
    <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
      <div className="h-full transition-all bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  </div>
);

const StatCard = ({ title, value, subtitle, color }) => (
  <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
    <p className="text-xs text-slate-400">{title}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>
  </div>
);

export default Dashboard;
