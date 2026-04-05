import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, Tag, AlertCircle } from 'lucide-react';

export function TaskModal({ isOpen, onClose, onSave, task, weekId, onUpdate, theme, day, time }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [subcategory, setSubcategory] = useState('');
  const [taskDay, setTaskDay] = useState(day || getCurrentDay());
  const [startTime, setStartTime] = useState(time || getCurrentTime());
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');

  // Helper to get current day name
  function getCurrentDay() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date();
    const dayIndex = today.getDay();
    if (dayIndex === 0) return 'Sunday';
    return days[dayIndex - 1];
  }

  // Helper to get current time in HH:MM format
  function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Helper to get default end time (1 hour after start) - COMPLETELY FIXED
  function getDefaultEndTime(start) {
    // Guard against undefined or null
    if (!start || typeof start !== 'string') {
      const now = new Date();
      const hours = (now.getHours() + 1).toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    const parts = start.split(':');
    if (parts.length !== 2) {
      const now = new Date();
      const hours = (now.getHours() + 1).toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      const now = new Date();
      const endHours = (now.getHours() + 1).toString().padStart(2, '0');
      const endMinutes = now.getMinutes().toString().padStart(2, '0');
      return `${endHours}:${endMinutes}`;
    }
    
    const endHours = (hours + 1) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Initialize end time
  useEffect(() => {
    if (!task && startTime) {
      setEndTime(getDefaultEndTime(startTime));
    }
  }, [startTime, task]);

  // Populate form when editing existing task or creating new
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setCategory(task.category || 'Work');
      setSubcategory(task.subcategory || '');
      setTaskDay(task.day || getCurrentDay());
      setStartTime(task.startTime || getCurrentTime());
      setEndTime(task.endTime || getDefaultEndTime(task.startTime || getCurrentTime()));
      setPriority(task.priority || 'medium');
      setNotes(task.notes || '');
    } else {
      setTitle('');
      setCategory('Work');
      setSubcategory('');
      setTaskDay(day || getCurrentDay());
      const start = time || getCurrentTime();
      setStartTime(start);
      setEndTime(getDefaultEndTime(start));
      setPriority('medium');
      setNotes('');
    }
  }, [task, isOpen, day, time]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
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

  if (!isOpen) return null;

  const categories = ['Work', 'Study', 'Health', 'Personal', 'Social', 'Rest'];
  const priorities = [
    { value: 'high', label: 'High', color: 'text-red-400', bg: 'bg-red-600/20', border: 'border-red-500/50' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-600/20', border: 'border-yellow-500/50' },
    { value: 'low', label: 'Low', color: 'text-green-400', bg: 'bg-green-600/20', border: 'border-green-500/50' }
  ];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 rounded-xl w-full max-w-md border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-200" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 flex items-center justify-between p-4 border-b border-white/10 rounded-t-xl">
          <h2 className="text-base font-bold text-white">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Category</label>
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
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={10} /> Day
              </label>
              <select
                value={taskDay}
                onChange={(e) => setTaskDay(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {days.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={10} /> Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock size={10} /> End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
            />
            <p className="text-[8px] text-slate-500 mt-1">Default: 1 hour after start</p>
          </div>
          
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
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
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details, subtasks, or reminders..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
            />
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
              disabled={!title.trim()}
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