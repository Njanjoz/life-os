// src/components/TaskCard/TaskCard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Check, Clock, RotateCcw, Edit2, Trash2, BookOpen, Code, Brain, Coffee, Dumbbell, X } from 'lucide-react';
import { startTask, completeTask, rescheduleTask, deleteTask, getTheme } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  if(cat.includes('study')) return <BookOpen size={14} />;
  if(cat.includes('exam')) return <Brain size={14} />;
  if(cat.includes('break')) return <Coffee size={14} />;
  if(cat.includes('exercise')) return <Dumbbell size={14} />;
  return <Code size={14} />;
};

// Helper to calculate total seconds from time strings
const getTotalSeconds = (startTime, endTime) => {
  if (!startTime || !endTime) return 3600;
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotal = startHour * 3600 + startMin * 60;
  const endTotal = endHour * 3600 + endMin * 60;
  return Math.max(0, endTotal - startTotal);
};

// Format time from seconds
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const TaskCard = ({ task, weekId, onUpdate }) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [theme, setTheme] = useState({ primary: '#a855f7' });
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Load theme on mount
  useEffect(() => {
    getTheme().then(t => t && setTheme(t));
  }, []);

  // Initialize timer if task is already active
  useEffect(() => {
    if (task && task.status === 'active' && task.actualStart) {
      const totalSeconds = getTotalSeconds(task.startTime, task.endTime);
      const actualStart = new Date(task.actualStart);
      const now = new Date();
      const elapsed = Math.floor((now - actualStart) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      const prog = Math.min(100, (elapsed / totalSeconds) * 100);
      
      setTimeRemaining(remaining);
      setProgress(prog);
      setIsActive(true);
      startTimeRef.current = actualStart;
      
      // Start timer interval
      intervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const currentElapsed = Math.floor((new Date() - startTimeRef.current) / 1000);
        const currentRemaining = Math.max(0, totalSeconds - currentElapsed);
        const currentProgress = Math.min(100, (currentElapsed / totalSeconds) * 100);
        
        setTimeRemaining(currentRemaining);
        setProgress(currentProgress);
        
        if (currentRemaining <= 0) {
          clearInterval(intervalRef.current);
          setIsActive(false);
        }
      }, 100);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [task]);

  const handleStart = useCallback(async () => {
    if (!user || !weekId) return;
    try {
      await startTask(task.id, new Date());
      setIsActive(true);
      startTimeRef.current = new Date();
      const totalSeconds = getTotalSeconds(task.startTime, task.endTime);
      setTimeRemaining(totalSeconds);
      setProgress(0);
      
      intervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const elapsed = Math.floor((new Date() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, totalSeconds - elapsed);
        const prog = Math.min(100, (elapsed / totalSeconds) * 100);
        
        setTimeRemaining(remaining);
        setProgress(prog);
        
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          setIsActive(false);
        }
      }, 100);
      
      onUpdate();
      setIsExpanded(false);
    } catch (error) {
      console.error('Error starting task:', error);
    }
  }, [task, weekId, user, onUpdate]);

  const handleComplete = useCallback(async () => {
    if (!user || !weekId) return;
    try {
      await completeTask(task.id, new Date());
      setIsActive(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      onUpdate();
      setIsExpanded(false);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  }, [task, weekId, user, onUpdate]);

  const handleReschedule = useCallback(async () => {
    if (!user || !weekId) return;
    try {
      await rescheduleTask(task.id, weekId, newDay, newTime, `${parseInt(newTime.split(':')[0]) + 1}:00`);
      setShowReschedule(false);
      onUpdate();
      setIsExpanded(false);
    } catch (error) {
      console.error('Error rescheduling task:', error);
      alert('Could not reschedule. Please try again.');
    }
  }, [task, weekId, newDay, newTime, user, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!user || !weekId) return;
    if (confirm('Delete this task?')) {
      try {
        await deleteTask(weekId, task.id);
        onUpdate();
        setIsExpanded(false);
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  }, [task, weekId, user, onUpdate]);

  if (!task) return null;

  const totalSeconds = getTotalSeconds(task.startTime, task.endTime);
  const statusColors = {
    active: `border-purple-500 bg-purple-500/20`,
    completed: 'border-green-500 bg-green-500/20',
    rescheduled: 'border-yellow-500 bg-yellow-500/20',
    pending: 'border-white/10 bg-white/5 hover:bg-white/10'
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className={`w-full p-2 rounded-xl transition-all duration-300 border ${statusColors[task.status] || statusColors.pending} text-left`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {getCategoryIcon(task.category)}
            <div className="truncate">
              <p className="text-[10px] text-slate-400">{task.startTime} - {task.endTime}</p>
              <p className="text-xs font-medium truncate">{task.title || 'Untitled Task'}</p>
            </div>
          </div>
          {isActive && (
            <div className="flex items-center gap-1">
              <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: theme.primary }} />
              </div>
              <span className="text-[10px] font-mono" style={{ color: theme.primary }}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
          {task.status === 'completed' && <Check size={12} className="text-green-500" />}
          {task.status === 'pending' && <Clock size={12} className="text-slate-500" />}
          {task.status === 'rescheduled' && <RotateCcw size={12} className="text-yellow-500" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 p-3 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl min-w-[200px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-slate-400">Task Actions</span>
            <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {task.status !== 'completed' && task.status !== 'active' && (
              <button onClick={handleStart} className="py-1.5 rounded-lg text-xs flex items-center justify-center gap-1" style={{ backgroundColor: theme.primary }}>
                <Play size={12} /> Start
              </button>
            )}
            {task.status === 'active' && (
              <button onClick={handleComplete} className="py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-xs flex items-center justify-center gap-1">
                <Check size={12} /> Done
              </button>
            )}
            <button onClick={() => setShowReschedule(!showReschedule)} className="py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs">
              <RotateCcw size={12} className="inline mr-1" /> Move
            </button>
            <button onClick={handleDelete} className="py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs">
              <Trash2 size={12} className="inline mr-1" /> Delete
            </button>
          </div>
          
          {showReschedule && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <select 
                value={newDay} 
                onChange={(e) => setNewDay(e.target.value)} 
                className="w-full mb-1 p-1 text-xs rounded bg-slate-800 border border-white/10"
              >
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input 
                type="time" 
                value={newTime} 
                onChange={(e) => setNewTime(e.target.value)} 
                className="w-full mb-1 p-1 text-xs rounded bg-slate-800 border border-white/10" 
              />
              <button onClick={handleReschedule} className="w-full py-1 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-xs">
                Confirm Reschedule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};