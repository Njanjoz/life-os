import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { X, CheckCircle, XCircle, Clock, TrendingUp, Calendar } from 'lucide-react';

const DayAnalysis = ({ day, dayData, tasks, onClose }) => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const missed = tasks.filter(t => t.status === 'missed').length;
  const pending = tasks.filter(t => t.status === 'pending' && t.title).length;
  const active = tasks.filter(t => t.status === 'active').length;

  const avgAccuracy = tasks.length
    ? tasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / tasks.length
    : 0;

  const avgDelay = tasks.length
    ? tasks.reduce((sum, t) => sum + Math.max(0, t.delay || 0), 0) / tasks.filter(t => t.delay > 0).length
    : 0;

  const pieData = [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'Active', value: active, color: '#a855f7' },
    { name: 'Pending', value: pending, color: '#eab308' },
    { name: 'Missed', value: missed, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Hourly performance data
  const hourlyData = tasks
    .filter(t => t.startTime)
    .map(t => ({
      hour: t.startTime.split(':')[0] + ':00',
      accuracy: t.accuracy || 0,
      status: t.status
    }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

  const COLORS = ['#22c55e', '#a855f7', '#eab308', '#ef4444'];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-5">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={20} className="text-purple-400" />
                {day} Analysis
              </h2>
              <p className="text-xs text-slate-400 mt-1">Deep dive into your daily performance</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">Completion</p>
              <p className="text-xl font-bold text-green-400">{Math.round(dayData?.completionRate || 0)}%</p>
              <p className="text-[10px] text-slate-500">{completed}/{total} tasks</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">Missed</p>
              <p className="text-xl font-bold text-red-400">{Math.round(dayData?.failureRate || 0)}%</p>
              <p className="text-[10px] text-slate-500">{missed} tasks</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">Accuracy</p>
              <p className="text-xl font-bold text-cyan-400">{Math.round(avgAccuracy)}%</p>
              <p className="text-[10px] text-slate-500">Time precision</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">Avg Delay</p>
              <p className="text-xl font-bold text-orange-400">{Math.round(avgDelay)} min</p>
              <p className="text-[10px] text-slate-500">Late start</p>
            </div>
          </div>

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-400" />
                Task Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-3">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-400">{item.name}</span>
                    <span className="text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hourly Performance */}
          {hourlyData.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-purple-400" />
                Hourly Performance
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <Bar dataKey="accuracy" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Task List */}
          {tasks.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Clock size={14} className="text-yellow-400" />
                Task Breakdown
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">{task.title || 'Untitled Task'}</p>
                      <p className="text-[9px] text-slate-400">{task.startTime} - {task.endTime}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === 'completed' && (
                        <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Done</span>
                      )}
                      {task.status === 'missed' && (
                        <span className="text-[10px] text-red-400 flex items-center gap-1"><XCircle size={10} /> Missed</span>
                      )}
                      {task.status === 'active' && (
                        <span className="text-[10px] text-purple-400 animate-pulse">● Active</span>
                      )}
                      {task.status === 'pending' && (
                        <span className="text-[10px] text-yellow-400">○ Pending</span>
                      )}
                      {task.accuracy > 0 && (
                        <span className="text-[9px] text-cyan-400">{Math.round(task.accuracy)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20">
            <p className="text-xs text-purple-400 mb-1">🧠 AI Insight</p>
            <p className="text-sm text-white">
              {dayData?.completionRate >= 80 ? 'Excellent day! You\'re on fire! 🔥 Keep this momentum!' :
               dayData?.completionRate >= 60 ? 'Good progress, keep pushing! 💪 Focus on consistency.' :
               dayData?.failureRate > 50 ? 'Tough day. Tomorrow is a fresh start! 🌅 Review what caused the misses.' :
               'Consistent effort builds discipline. Keep going! ⚡ Track your patterns to improve.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayAnalysis;
