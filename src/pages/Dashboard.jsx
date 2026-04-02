import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentWeek, getWeekTasks, updateWeekMetrics, getBestFocusHours } from '../services/firebaseTaskService';
import { calculateTaskAnalytics } from '../services/analyticsService';
import { useAuth } from '../context/AuthContext';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, Target, Zap, Clock, Award, Calendar, 
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, 
  Activity, Battery, Cpu, Brain, Sparkles, RotateCcw, AlertOctagon, 
  Eye, List, LayoutGrid
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
  const [viewMode, setViewMode] = useState('week');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const currentWeek = await getCurrentWeek(selectedDate);
      setWeek(currentWeek);
      const weekTasks = await getWeekTasks(currentWeek.id);
      setTasks(weekTasks);
      
      // Use unified analytics engine
      const analytics = calculateTaskAnalytics(weekTasks);
      setMetrics(analytics);
      
      const hours = await getBestFocusHours();
      setBestHours(hours);
      
      // Debug log to verify numbers
      console.log('Analytics:', analytics);
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
    const analytics = calculateTaskAnalytics(dayTasks);
    return analytics;
  };

  const weeklyChartData = days.map(day => {
    const stats = getDayStats(day);
    return {
      name: day.slice(0, 3),
      completion: stats.completionRate,
      missed: stats.missedTasks,
      overdue: stats.overdueTasks,
      rescheduled: stats.rescheduledTasks,
      tasks: stats.totalTasks
    };
  }).filter(d => d.tasks > 0);

  const mainPieData = [
    { name: 'Completed', value: metrics.completedTasks || 0, color: '#22c55e' },
    { name: 'Missed', value: metrics.missedTasks || 0, color: '#ef4444' },
    { name: 'Overdue', value: metrics.overdueTasks || 0, color: '#8b5cf6' },
    { name: 'Rescheduled', value: metrics.rescheduledTasks || 0, color: '#eab308' }
  ].filter(d => d.value > 0);

  const qualityPieData = [
    { name: 'Early', value: metrics.earlyCount || 0, color: '#22c55e' },
    { name: 'On Time', value: metrics.onTimeCount || 0, color: '#3b82f6' },
    { name: 'Late', value: metrics.lateCount || 0, color: '#f97316' }
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        <p className="ml-2 text-xs text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  // Verification that totals add up
  const totalFromPie = (metrics.completedTasks || 0) + (metrics.missedTasks || 0) + (metrics.overdueTasks || 0) + (metrics.rescheduledTasks || 0);
  const totalsMatch = totalFromPie === metrics.totalTasks;

  return (
    <div className="space-y-4 pb-20">
      {/* Header with Toggle */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl p-3 border border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft size={14} /></button>
            <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight size={14} /></button>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Calendar size={12} className="text-purple-400" />
              <span className="text-[11px] font-semibold text-white">{formatDateRange()}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setViewMode('week')} 
              className={`p-1.5 rounded-lg transition ${viewMode === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button 
              onClick={() => setViewMode('day')} 
              className={`p-1.5 rounded-lg transition ${viewMode === 'day' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Insight */}
      <div className="bg-gradient-to-r from-purple-500/15 to-blue-500/15 rounded-xl p-3 border border-purple-500/20">
        <div className="flex items-start gap-2">
          <Brain size={14} className="text-purple-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-[10px] text-purple-400 font-semibold">AI INSIGHT</p>
            <p className="text-[11px] text-white leading-tight">
              {metrics.weeklyScore >= 85 ? "Outstanding week! Your time discipline is elite." :
               metrics.weeklyScore >= 70 ? "Great progress! Focus on starting tasks on time." :
               metrics.weeklyScore >= 55 ? "Solid effort. Small improvements will boost your score." :
               "Delays and overdue tasks are affecting your score."}
            </p>
            {bestHours.length > 0 && (
              <p className="text-[9px] text-cyan-400 mt-1">Peak focus: {bestHours[0]?.hour}:00 ({Math.round(bestHours[0]?.score)}% accuracy)</p>
            )}
          </div>
          <Sparkles size={14} className="text-yellow-500" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 rounded-xl p-3 border border-purple-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase">Weekly Score</span>
            <Award size={12} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.weeklyScore || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl p-3 border border-green-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase">Completion</span>
            <Target size={12} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.completionRate || 0}%</p>
          <p className="text-[8px] text-slate-500">{metrics.completedTasks || 0}/{metrics.totalTasks || 0} tasks</p>
        </div>
        <div className="bg-gradient-to-br from-blue-900/30 to-slate-900 rounded-xl p-3 border border-blue-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase">Discipline</span>
            <Zap size={12} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.disciplineScore || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-xl p-3 border border-orange-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-400 uppercase">Avg Delay</span>
            <Clock size={12} className="text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.avgDelay || 0}<span className="text-xs">min</span></p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-1">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <CheckCircle size={12} className="text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{metrics.completedTasks || 0}</p>
          <p className="text-[7px] text-slate-400">Completed</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <XCircle size={12} className="text-red-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{metrics.missedTasks || 0}</p>
          <p className="text-[7px] text-slate-400">Missed</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <AlertOctagon size={12} className="text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{metrics.overdueTasks || 0}</p>
          <p className="text-[7px] text-slate-400">Overdue</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <RotateCcw size={12} className="text-yellow-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{metrics.rescheduledTasks || 0}</p>
          <p className="text-[7px] text-slate-400">Rescheduled</p>
        </div>
      </div>

      {/* Totals Verification (hidden in production, shows if mismatch) */}
      {!totalsMatch && (
        <div className="bg-yellow-500/10 rounded-lg p-2 text-center border border-yellow-500/20">
          <p className="text-[8px] text-yellow-400">
            Warning: Task totals mismatch. Expected {metrics.totalTasks}, got {totalFromPie}
          </p>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {mainPieData.length > 0 && (
              <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <Target size={10} className="text-purple-400" />
                  <span className="text-[8px] font-semibold text-white">Task Status</span>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie data={mainPieData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2} dataKey="value" isAnimationActive={false}>
                      {mainPieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-2 mt-1">
                  {mainPieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[6px] text-slate-400">{item.name}</span>
                      <span className="text-[6px] text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {qualityPieData.length > 0 && (
              <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <TrendingUp size={10} className="text-purple-400" />
                  <span className="text-[8px] font-semibold text-white">Completion Quality</span>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie data={qualityPieData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2} dataKey="value" isAnimationActive={false}>
                      {qualityPieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-2 mt-1">
                  {qualityPieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[6px] text-slate-400">{item.name}</span>
                      <span className="text-[6px] text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {weeklyChartData.length > 0 && (
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={12} className="text-purple-400" />
                <span className="text-[10px] font-semibold text-white">Weekly Performance</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weeklyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} />
                  <Bar dataKey="completion" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completion %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {days.map((day, idx) => {
              const date = getWeekStart(selectedDate);
              const dayDate = new Date(date);
              dayDate.setDate(date.getDate() + idx);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const dayTasks = tasks.filter(t => t.day === day);
              const hasTasks = dayTasks.length > 0;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 min-w-[60px] py-2 rounded-lg text-center transition ${selectedDay === day ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'} ${isToday ? 'border border-purple-500/50' : ''}`}
                >
                  <div className="text-[10px] font-bold">{day.slice(0, 3)}</div>
                  <div className="text-[8px]">{dayDate.getDate()}</div>
                  {hasTasks && <div className="w-1 h-1 rounded-full bg-green-500 mx-auto mt-0.5" />}
                </button>
              );
            })}
          </div>

          {selectedDay && (() => {
            const stats = getDayStats(selectedDay);
            if (stats.totalTasks === 0) {
              return (
                <div className="bg-white/5 rounded-xl p-6 text-center">
                  <Calendar size={24} className="text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No tasks for {selectedDay}</p>
                </div>
              );
            }
            return (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-white">{selectedDay} Performance</h3>
                  <Target size={12} className="text-purple-400" />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[8px] text-slate-400">Completion Rate</p>
                    <p className="text-xl font-bold text-green-400">{stats.completionRate}%</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[8px] text-slate-400">Avg Accuracy</p>
                    <p className="text-xl font-bold text-cyan-400">{stats.avgAccuracy}%</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[8px] text-slate-400">Avg Delay</p>
                    <p className="text-xl font-bold text-orange-400">{stats.avgDelay}m</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[8px] text-slate-400">Total Tasks</p>
                    <p className="text-xl font-bold text-white">{stats.totalTasks}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-center text-[9px]">
                  <div><p className="text-green-400">Early</p><p className="text-white font-bold">{stats.earlyCount}</p></div>
                  <div><p className="text-blue-400">On Time</p><p className="text-white font-bold">{stats.onTimeCount}</p></div>
                  <div><p className="text-orange-400">Late</p><p className="text-white font-bold">{stats.lateCount}</p></div>
                  <div><p className="text-red-400">Missed</p><p className="text-white font-bold">{stats.missedTasks}</p></div>
                </div>
                
                {(stats.overdueTasks > 0 || stats.rescheduledTasks > 0) && (
                  <div className="mt-3 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-center text-[9px]">
                    {stats.overdueTasks > 0 && <div><p className="text-purple-400">Overdue</p><p className="text-white font-bold">{stats.overdueTasks}</p></div>}
                    {stats.rescheduledTasks > 0 && <div><p className="text-yellow-500">Rescheduled</p><p className="text-white font-bold">{stats.rescheduledTasks}</p></div>}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Integrity Warning */}
      {(metrics.missedTasks > 0 || metrics.overdueTasks > 0) && (
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl p-3 border border-red-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle size={12} className="text-red-400 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-red-400">Performance Alert</p>
              <p className="text-[9px] text-slate-300">
                {metrics.missedTasks > 0 && metrics.overdueTasks > 0
                  ? `${metrics.missedTasks} missed and ${metrics.overdueTasks} overdue tasks. Complete tasks on time to improve your score.`
                  : metrics.missedTasks > 0
                  ? `${metrics.missedTasks} missed tasks. Start tasks on time to avoid penalties.`
                  : `${metrics.overdueTasks} overdue tasks. Complete them before they become missed.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
