import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentWeek, getWeekTasks, updateWeekMetrics, getBestFocusHours } from '../services/firebaseTaskService';
import { useAuth } from '../context/AuthContext';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, Target, Zap, Clock, Award, Calendar, 
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, 
  Activity, Battery, Cpu, Brain, Sparkles, Eye
} from 'lucide-react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Dashboard = () => {
  const { user } = useAuth();
  const now = useCurrentTime();
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [bestHours, setBestHours] = useState([]);
  const [hoveredBar, setHoveredBar] = useState(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const currentWeek = await getCurrentWeek(selectedDate);
      setWeek(currentWeek);
      const weekTasks = await getWeekTasks(currentWeek.id);
      setTasks(weekTasks);
      setMetrics(currentWeek.metrics || {});
      const hours = await getBestFocusHours();
      setBestHours(hours);
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

  const getDayStats = (day) => {
    const dayTasks = tasks.filter(t => t.day === day);
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.status === 'completed').length;
    const missed = dayTasks.filter(t => t.status === 'missed').length;
    const pending = dayTasks.filter(t => t.status === 'pending' && t.title).length;
    const active = dayTasks.filter(t => t.status === 'active').length;
    const totalDelay = dayTasks.reduce((sum, t) => sum + (t.delay || 0), 0);
    const avgDelay = totalDelay / (dayTasks.filter(t => t.delay > 0).length || 1);
    const avgAccuracy = dayTasks.length ? dayTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / dayTasks.length : 0;
    const reschedules = dayTasks.reduce((sum, t) => sum + (t.rescheduleCount || 0), 0);
    
    return { 
      total, completed, missed, pending, active, 
      avgDelay: Math.round(avgDelay), 
      avgAccuracy: Math.round(avgAccuracy),
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      reschedules
    };
  };

  // Weekly chart data
  const weeklyChartData = days.map(day => {
    const stats = getDayStats(day);
    return {
      name: day.slice(0, 3),
      completion: stats.completionRate,
      missed: stats.missed,
      delay: stats.avgDelay,
      tasks: stats.total
    };
  }).filter(d => d.tasks > 0);

  // Pie chart data for task distribution
  const pieData = [
    { name: 'Completed', value: metrics.completedTasks || 0, color: '#22c55e' },
    { name: 'Missed', value: metrics.missedCount || 0, color: '#ef4444' },
    { name: 'Pending', value: (metrics.totalTasks || 0) - (metrics.completedTasks || 0) - (metrics.missedCount || 0), color: '#eab308' }
  ].filter(d => d.value > 0);

  const COLORS = ['#22c55e', '#ef4444', '#eab308'];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        <p className="ml-2 text-xs text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header with Week Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-xl p-3 border border-white/10">
        <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft size={14} /></button>
        <div className="text-center">
          <div className="flex items-center gap-1 justify-center">
            <Calendar size={12} className="text-purple-400" />
            <span className="text-[11px] font-semibold text-white">{formatDateRange()}</span>
          </div>
        </div>
        <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight size={14} /></button>
      </div>

      {/* AI Insight Banner */}
      <div className="bg-gradient-to-r from-purple-500/15 to-blue-500/15 rounded-xl p-3 border border-purple-500/20">
        <div className="flex items-start gap-2">
          <Brain size={14} className="text-purple-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-[10px] text-purple-400 font-semibold">AI INSIGHT</p>
            <p className="text-[11px] text-white leading-tight">
              {metrics.weeklyScore >= 85 ? "Peak performance! Your time discipline is exceptional." :
               metrics.weeklyScore >= 70 ? "Strong week! Focus on reducing delays to hit 85+." :
               metrics.weeklyScore >= 55 ? "Solid progress. Try starting tasks 5min earlier." :
               "Consistency is key. Small improvements daily add up."}
            </p>
            {bestHours.length > 0 && (
              <p className="text-[9px] text-cyan-400 mt-1">⚡ Best focus: {bestHours[0]?.hour}:00 ({Math.round(bestHours[0]?.score)}% accuracy)</p>
            )}
          </div>
          <Sparkles size={14} className="text-yellow-500" />
        </div>
      </div>

      {/* KPI Cards - Futuristic */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 rounded-xl p-3 border border-purple-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Weekly Score</span>
            <Award size={12} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.weeklyScore || 0}</p>
          <p className="text-[8px] text-slate-500 mt-1">+{Math.round((metrics.weeklyScore || 0) / 10)}% vs last week</p>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-slate-900 rounded-xl p-3 border border-blue-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Discipline</span>
            <Zap size={12} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.disciplineScore || 0}</p>
          <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${metrics.disciplineScore || 0}%` }} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl p-3 border border-green-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Completion</span>
            <Target size={12} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.completionRate || 0}%</p>
          <p className="text-[8px] text-slate-500">{metrics.completedTasks || 0}/{metrics.totalTasks || 0} tasks</p>
        </div>
        <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-xl p-3 border border-orange-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Avg Delay</span>
            <Clock size={12} className="text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.avgDelay || 0}<span className="text-xs">min</span></p>
          <p className="text-[8px] text-orange-400">Total: {metrics.totalDelay || 0} min lost</p>
        </div>
      </div>

      {/* Weekly Performance Chart */}
      {weeklyChartData.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-purple-400" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Weekly Performance</span>
            <span className="text-[8px] text-slate-500 ml-auto">Click bars for details</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                formatter={(value, name) => [`${value}%`, name === 'completion' ? 'Completion Rate' : 'Avg Delay (min)']}
              />
              <Bar 
                dataKey="completion" 
                name="Completion Rate" 
                radius={[4, 4, 0, 0]}
                onMouseEnter={(data) => setHoveredBar(data.name)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {weeklyChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.completion >= 80 ? '#22c55e' : entry.completion >= 60 ? '#eab308' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Task Distribution Pie Chart */}
      {pieData.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={12} className="text-purple-400" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Task Distribution</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[8px] text-slate-400">{item.name}</span>
                <span className="text-[8px] text-white font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Breakdown Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Battery size={12} className="text-cyan-400" />
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Daily Breakdown</span>
          <span className="text-[8px] text-slate-500 ml-auto">Tap to expand</span>
        </div>
        
        {days.map(day => {
          const stats = getDayStats(day);
          if (stats.total === 0) return null;
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              className="w-full bg-white/5 rounded-xl overflow-hidden border border-white/10 transition-all"
            >
              <div className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{day.slice(0, 3)}</span>
                    <span className="text-[9px] text-slate-500">{new Date(getWeekStart(selectedDate)).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {stats.completed > 0 && <CheckCircle size={10} className="text-green-500" />}
                    {stats.missed > 0 && <XCircle size={10} className="text-red-500" />}
                    {stats.active > 0 && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
                  <div className="bg-green-500" style={{ width: `${stats.completionRate}%` }} />
                  <div className="bg-red-500" style={{ width: `${stats.missed / stats.total * 100}%` }} />
                  <div className="bg-yellow-500" style={{ width: `${stats.pending / stats.total * 100}%` }} />
                </div>
                
                <div className="flex justify-between text-[9px]">
                  <span className="text-green-400">✓ {stats.completed}</span>
                  <span className="text-red-400">✗ {stats.missed}</span>
                  <span className="text-yellow-400">○ {stats.pending}</span>
                  <span className="text-purple-400">● {stats.active}</span>
                  <span className="text-slate-500">📊 {stats.completionRate}%</span>
                </div>
              </div>
              
              {selectedDay === day && (
                <div className="bg-white/5 p-3 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex justify-between"><span className="text-slate-400">Total Tasks:</span><span className="text-white font-semibold">{stats.total}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Avg Delay:</span><span className="text-orange-400">{stats.avgDelay} min</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Avg Accuracy:</span><span className="text-cyan-400">{stats.avgAccuracy}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Reschedules:</span><span className="text-yellow-500">{stats.reschedules}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[8px] text-slate-400">
                      {stats.completionRate >= 80 ? "🌟 Excellent day! Keep this momentum." :
                       stats.completionRate >= 60 ? "👍 Good progress! Try to start on time." :
                       stats.completionRate >= 40 ? "📈 Room for improvement. Set reminders." :
                       "⚠️ Tough day. Review your schedule for tomorrow."}
                    </p>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Performance Summary */}
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-xl p-3 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Eye size={12} className="text-purple-400" />
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Performance Summary</span>
        </div>
        <div className="flex justify-between text-[9px]">
          <div><span className="text-slate-400">Best Day:</span><span className="text-green-400 ml-1">
            {weeklyChartData.reduce((best, day) => day.completion > best.completion ? day : best, { completion: 0, name: 'N/A' }).name}
          </span></div>
          <div><span className="text-slate-400">Total Time Lost:</span><span className="text-orange-400 ml-1">{metrics.totalDelay || 0} min</span></div>
          <div><span className="text-slate-400">Productivity:</span><span className="text-purple-400 ml-1">{Math.round((metrics.completionRate || 0) * 0.7 + (metrics.disciplineScore || 0) * 0.3)}%</span></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
