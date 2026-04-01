import React, { useState, useEffect } from 'react';
import { Play, Check, Clock, RotateCcw, Edit2, Trash2, BookOpen, Code, Brain, Coffee, Dumbbell } from 'lucide-react';
import { startTask, completeTask, rescheduleTask, deleteTask, getTheme } from '../../services/timeService';

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  if(cat.includes('study')) return <BookOpen size={14} />;
  if(cat.includes('exam')) return <Brain size={14} />;
  if(cat.includes('break')) return <Coffee size={14} />;
  if(cat.includes('exercise')) return <Dumbbell size={14} />;
  return <Code size={14} />;
};

export const TaskCard = ({ task, weekId, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [theme, setTheme] = useState({ primary: '#a855f7' });
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  
  useEffect(() => { getTheme().then(t => t && setTheme(t)); }, []);
  
  useEffect(() => {
    let interval;
    if(isActive && task) {
      const totalSeconds = (parseInt(task.endTime.split(':')[0]) - parseInt(task.startTime.split(':')[0])) * 3600;
      const startTime = new Date();
      interval = setInterval(() => {
        const elapsed = (new Date() - startTime) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);
        const prog = Math.min(100, (elapsed / totalSeconds) * 100);
        setTimeRemaining(remaining);
        setProgress(prog);
        if(remaining <= 0) { clearInterval(interval); setIsActive(false); }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isActive, task]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2,'0')}`;
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return `border-${theme.primary} bg-${theme.primary}/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]`;
      case 'completed': return 'border-green-500 bg-green-500/20';
      case 'rescheduled': return 'border-yellow-500 bg-yellow-500/20';
      default: return 'border-white/10 bg-white/5 hover:bg-white/10';
    }
  };
  
  const handleStart = async () => { await startTask(task.id, weekId); setIsActive(true); onUpdate(); };
  const handleComplete = async () => { await completeTask(task.id, weekId, task); setIsActive(false); onUpdate(); };
  const handleReschedule = async () => { await rescheduleTask(task.id, weekId, newDay, newTime, `${parseInt(newTime.split(':')[0])+1}:00`); setShowReschedule(false); onUpdate(); };
  const handleDelete = async () => { if(confirm('Delete this task?')) { await deleteTask(weekId, task.id); onUpdate(); } };
  
  if(!task) return null;
  
  return (
    <div className="relative">
      <button onClick={() => setIsExpanded(!isExpanded)} className={`w-full p-2 rounded-xl transition-all duration-300 border ${task.status === 'active' ? 'border-purple-500 bg-purple-500/20' : task.status === 'completed' ? 'border-green-500 bg-green-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'} text-left`}>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {getCategoryIcon(task.category)}
            <div className="truncate">
              <p className="text-[10px] text-slate-400">{task.startTime}</p>
              <p className="text-xs font-medium truncate">{task.title || 'Click to edit'}</p>
            </div>
          </div>
          {isActive && <div className="flex items-center gap-1"><div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: theme.primary }} /></div><span className="text-[10px] font-mono" style={{ color: theme.primary }}>{formatTime(timeRemaining)}</span></div>}
          {task.status === 'completed' && <Check size={12} className="text-green-500" />}
          {task.status === 'pending' && <Clock size={12} className="text-slate-500" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 p-3 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl min-w-[200px]">
          <div className="grid grid-cols-2 gap-1">
            {task.status !== 'completed' && task.status !== 'active' && <button onClick={handleStart} className="py-1.5 rounded-lg text-xs flex items-center justify-center gap-1" style={{ backgroundColor: theme.primary }}><Play size={12} /> Start</button>}
            {task.status === 'active' && <button onClick={handleComplete} className="py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-xs flex items-center justify-center gap-1"><Check size={12} /> Done</button>}
            <button onClick={() => setShowReschedule(!showReschedule)} className="py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs"><RotateCcw size={12} className="inline mr-1" /> Move</button>
            <button onClick={handleDelete} className="py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs"><Trash2 size={12} className="inline mr-1" /> Delete</button>
          </div>
          {showReschedule && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <select value={newDay} onChange={(e) => setNewDay(e.target.value)} className="w-full mb-1 p-1 text-xs rounded bg-slate-800 border border-white/10">
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
              </select>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full mb-1 p-1 text-xs rounded bg-slate-800 border border-white/10" />
              <button onClick={handleReschedule} className="w-full py-1 rounded-lg bg-yellow-600 text-xs">Confirm</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
