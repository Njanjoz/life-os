// src/components/TaskModal/TaskModal.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Clock, Calendar, Tag, AlertCircle, Flag, FileText } from 'lucide-react';

export function TaskModal({ isOpen, onClose, onSave, task, weekId, onUpdate, theme, day, time, weekStartDate }) {
  // ===== ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN =====
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [subcategory, setSubcategory] = useState('');
  const [taskDay, setTaskDay] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [timeWarning, setTimeWarning] = useState('');
  
  // Refs to track state
  const isTaskBeingEdited = useRef(false);
  const initialLoadDone = useRef(false);
  const userEditedEndTime = useRef(false);
  const userEditedStartTime = useRef(false);

  // Helper functions
  function getCurrentDay() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date();
    const dayIndex = today.getDay();
    if (dayIndex === 0) return 'Sunday';
    return days[dayIndex - 1];
  }

  function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function getActualDate(dayName) {
    if (!weekStartDate || !dayName) return null;
    
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIndex = daysOfWeek.indexOf(dayName);
    if (dayIndex === -1) return null;
    
    const startOfWeek = new Date(weekStartDate);
    const actualDate = new Date(startOfWeek);
    actualDate.setDate(startOfWeek.getDate() + dayIndex);
    return actualDate;
  }

  function formatDateShort(date) {
    if (!date || !(date instanceof Date)) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getDefaultEndTime(start) {
    if (!start || typeof start !== 'string') {
      return '13:00';
    }
    
    const parts = start.split(':');
    if (parts.length !== 2) {
      return '13:00';
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return '13:00';
    }
    
    const endHours = (hours + 1) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Callbacks
  const isTimePassed = useCallback((dayName, timeStr) => {
    if (!timeStr || !weekStartDate || !dayName) return false;
    
    const actualDate = getActualDate(dayName);
    if (!actualDate) return false;
    
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const taskDateTime = new Date(actualDate);
    taskDateTime.setHours(hours, minutes, 0, 0);
    
    return taskDateTime < now;
  }, [weekStartDate]);

  const isEndTimeValid = useCallback((start, end) => {
    if (!start || !end) return true;
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);
    
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;
    
    return endTotal > startTotal;
  }, []);

  const checkTimeWarnings = useCallback((dayName, start, end) => {
    const warnings = [];
    
    if (dayName && start && isTimePassed(dayName, start)) {
      warnings.push('⚠️ Start time has already passed for today');
    }
    
    if (start && end && !isEndTimeValid(start, end)) {
      warnings.push('⚠️ End time must be after start time');
    }
    
    setTimeWarning(warnings.join(' • '));
    return warnings.length === 0;
  }, [isTimePassed, isEndTimeValid]);

  // useMemo hooks
  const actualDate = useMemo(() => {
    return getActualDate(taskDay);
  }, [taskDay, weekStartDate]);
  
  const formattedDate = useMemo(() => {
    return actualDate ? formatDateShort(actualDate) : '';
  }, [actualDate]);

  // Reset modal when opened
  useEffect(() => {
    if (!isOpen) {
      isTaskBeingEdited.current = false;
      initialLoadDone.current = false;
      userEditedEndTime.current = false;
      userEditedStartTime.current = false;
      setTimeWarning('');
      return;
    }

    if (task) {
      // Editing existing task
      isTaskBeingEdited.current = true;
      setTitle(task.title || '');
      setCategory(task.category || 'Work');
      setSubcategory(task.subcategory || '');
      setTaskDay(task.day || getCurrentDay());
      setStartTime(task.startTime || getCurrentTime());
      setEndTime(task.endTime || getDefaultEndTime(task.startTime || getCurrentTime()));
      setPriority(task.priority || 'medium');
      setNotes(task.notes || '');
      // Mark that these are from existing task, not user edits yet
      userEditedStartTime.current = !!task.startTime;
      userEditedEndTime.current = !!task.endTime;
    } else {
      // Creating new task
      isTaskBeingEdited.current = false;
      setTitle('');
      setCategory('Work');
      setSubcategory('');
      const initialDay = day || getCurrentDay();
      const initialStartTime = time || getCurrentTime();
      setTaskDay(initialDay);
      setStartTime(initialStartTime);
      setEndTime(getDefaultEndTime(initialStartTime));
      setPriority('medium');
      setNotes('');
      userEditedStartTime.current = false;
      userEditedEndTime.current = false;
    }
    initialLoadDone.current = true;
  }, [task, isOpen, day, time]);

  // Only auto-set end time for NEW tasks when start time changes AND user hasn't edited end time
  useEffect(() => {
    // Don't run until initial load is done
    if (!initialLoadDone.current) return;
    // Don't auto-set for existing tasks being edited
    if (isTaskBeingEdited.current) return;
    // Don't auto-set if user has manually edited end time
    if (userEditedEndTime.current) return;
    // Don't auto-set if no start time
    if (!startTime) return;
    
    // Only auto-set if this is a new task and end time hasn't been edited
    setEndTime(getDefaultEndTime(startTime));
  }, [startTime]);

  // Check warnings when relevant fields change
  useEffect(() => {
    if (initialLoadDone.current && startTime && endTime && taskDay) {
      checkTimeWarnings(taskDay, startTime, endTime);
    }
  }, [taskDay, startTime, endTime, checkTimeWarnings]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // ===== CONDITIONAL RETURN AFTER ALL HOOKS =====
  if (!isOpen) return null;

  // Event handlers
  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value;
    userEditedStartTime.current = true;
    setStartTime(newStartTime);
    
    // Only auto-update end time for new tasks if end time hasn't been edited
    if (!isTaskBeingEdited.current && !userEditedEndTime.current) {
      setEndTime(getDefaultEndTime(newStartTime));
    }
    
    // Check warnings
    if (endTime && !isEndTimeValid(newStartTime, endTime)) {
      setTimeWarning('⚠️ End time must be after start time');
    } else if (taskDay) {
      checkTimeWarnings(taskDay, newStartTime, endTime);
    }
  };

  const handleEndTimeChange = (e) => {
    userEditedEndTime.current = true;
    const newEndTime = e.target.value;
    setEndTime(newEndTime);
    
    // Validate against start time
    if (startTime && !isEndTimeValid(startTime, newEndTime)) {
      setTimeWarning('⚠️ End time must be after start time');
    } else if (taskDay) {
      checkTimeWarnings(taskDay, startTime, newEndTime);
    }
  };

  const handleDayChange = (e) => {
    const newDay = e.target.value;
    setTaskDay(newDay);
    if (startTime && endTime) {
      checkTimeWarnings(newDay, startTime, endTime);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }
    
    if (!startTime) {
      alert('Please select a start time');
      return;
    }
    
    if (!endTime) {
      alert('Please select an end time');
      return;
    }
    
    if (!isEndTimeValid(startTime, endTime)) {
      alert('End time must be after start time');
      return;
    }
    
    const hasPastTime = isTimePassed(taskDay, startTime);
    if (hasPastTime) {
      const confirmSave = window.confirm(
        'Warning: This task\'s start time has already passed for today. Are you sure you want to save it?'
      );
      if (!confirmSave) return;
    }
    
    const taskData = {
      title: title.trim(),
      category,
      subcategory: subcategory.trim() || 'General',
      day: taskDay,
      startTime,
      endTime,
      priority,
      notes: notes.trim()
    };
    
    if (onSave) {
      await onSave(taskData);
    }
    onClose();
  };

  const getPriorityColor = (p) => {
    switch(p) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  // Static data
  const categories = ['Work', 'Study', 'Health', 'Personal', 'Social', 'Rest'];
  const priorities = [
    { value: 'high', label: 'High', color: 'text-red-400', bg: 'bg-red-600/20', border: 'border-red-500/50' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-600/20', border: 'border-yellow-500/50' },
    { value: 'low', label: 'Low', color: 'text-green-400', bg: 'bg-green-600/20', border: 'border-green-500/50' }
  ];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Check if time is passed for warning display
  const isStartTimePassed = isTimePassed(taskDay, startTime);
  const isEndTimeInvalid = startTime && endTime && !isEndTimeValid(startTime, endTime);

  // JSX return
  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={task ? 'Edit Task' : 'Create New Task'}
    >
      <div className="bg-slate-900 rounded-xl w-full max-w-md border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-200" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 flex items-center justify-between p-4 border-b border-white/10 rounded-t-xl">
          <h2 className="text-base font-bold text-white">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-white/10"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Time Warning Banner */}
          {timeWarning && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-300">{timeWarning}</p>
            </div>
          )}
          
          {/* Task Title */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Complete React project"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none transition"
              autoFocus
            />
          </div>
          
          {/* Category & Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Tag size={10} /> Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Subcategory</label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g., Frontend"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          
          {/* Day & Start Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={10} /> Day
              </label>
              <div className="flex flex-col gap-1">
                <select
                  value={taskDay}
                  onChange={handleDayChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
                >
                  {days.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {formattedDate && (
                  <div className="flex items-center gap-1 text-[9px] text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">
                    <Calendar size={10} />
                    <span>{taskDay}, {formattedDate}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={10} /> Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={handleStartTimeChange}
                className={`w-full px-3 py-2 rounded-lg bg-slate-800 border text-white text-sm focus:border-purple-500 focus:outline-none ${
                  isStartTimePassed ? 'border-yellow-500/50' : 'border-white/10'
                }`}
                step="60"
              />
              {isStartTimePassed && (
                <p className="text-[8px] text-yellow-500 mt-1">⚠️ This time has already passed</p>
              )}
            </div>
          </div>
          
          {/* End Time */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock size={10} /> End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={handleEndTimeChange}
              className={`w-full px-3 py-2 rounded-lg bg-slate-800 border text-white text-sm focus:border-purple-500 focus:outline-none ${
                isEndTimeInvalid ? 'border-red-500/50' : 'border-white/10'
              }`}
              step="60"
            />
            {!isTaskBeingEdited.current && !userEditedEndTime.current && (
              <p className="text-[8px] text-slate-500 mt-1">Auto-sets 1 hour after start — you can edit</p>
            )}
            {isTaskBeingEdited.current && (
              <p className="text-[8px] text-slate-500 mt-1">Edit the end time as needed</p>
            )}
            {isEndTimeInvalid && (
              <p className="text-[8px] text-red-400 mt-1">⚠️ End time must be after start time</p>
            )}
          </div>
          
          {/* Priority */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Flag size={10} /> Priority
            </label>
            <div className="flex gap-2">
              {priorities.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                    priority === p.value 
                      ? `${p.bg} border ${p.border} text-white`
                      : 'bg-white/10 text-slate-400 hover:bg-white/20'
                  }`}
                  aria-label={`Set priority to ${p.label}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText size={10} /> Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details, subtasks, or reminders..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>
          
          {/* Preview */}
          <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
            <p className="text-[8px] text-slate-400 uppercase tracking-wider mb-2">Preview</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-medium ${getPriorityColor(priority)}`}>
                {priority === 'high' ? '🔴 High' : priority === 'medium' ? '🟡 Medium' : '🟢 Low'}
              </span>
              <span className="text-[9px] text-slate-500">•</span>
              <span className="text-[9px] text-slate-400">{taskDay}</span>
              {formattedDate && (
                <span className="text-[8px] text-purple-400">({formattedDate})</span>
              )}
              <span className="text-[9px] text-slate-500">•</span>
              <span className="text-[9px] text-slate-400">{startTime || '--:--'} - {endTime || '--:--'}</span>
              {subcategory && (
                <>
                  <span className="text-[9px] text-slate-500">•</span>
                  <span className="text-[9px] text-slate-400">{subcategory}</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-white mt-1 truncate">{title || 'Task title will appear here'}</p>
            {notes && <p className="text-[8px] text-slate-500 mt-1 truncate">📝 {notes.substring(0, 50)}</p>}
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !startTime || !endTime}
              className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme?.primary }}
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}