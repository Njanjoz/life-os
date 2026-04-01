import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar, Tag, Layers, Edit3, AlertCircle } from 'lucide-react';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';

// Fixed Categories with Subcategories
const CATEGORIES = {
  'Study': {
    icon: '📚',
    subcategories: ['Lecture Review', 'Reading', 'Practice Problems', 'Research', 'Group Study', 'Flashcards', 'Exam Prep', 'Essay Writing', '+ Custom']
  },
  'Exam Revision': {
    icon: '📝',
    subcategories: ['Past Papers', 'Summary Notes', 'Memory Work', 'Practice Tests', 'Weak Areas', 'Quick Review', '+ Custom']
  },
  'Break': {
    icon: '☕',
    subcategories: ['Short Break', 'Lunch', 'Walk', 'Meditation', 'Stretch', 'Snack Time', '+ Custom']
  },
  'Exercise': {
    icon: '💪',
    subcategories: ['Cardio', 'Strength Training', 'Yoga', 'Stretching', 'Walk', 'Sports', '+ Custom']
  },
  'Work': {
    icon: '💼',
    subcategories: ['Meetings', 'Deep Work', 'Emails', 'Planning', 'Admin', 'Client Work', '+ Custom']
  },
  'Personal': {
    icon: '🧘',
    subcategories: ['Self Care', 'Family Time', 'Hobby', 'Social', 'Errands', 'Rest', '+ Custom']
  },
  'Meeting': {
    icon: '👥',
    subcategories: ['1-on-1', 'Team Meeting', 'Client Call', 'Workshop', 'Networking', 'Review', '+ Custom']
  },
  'Review': {
    icon: '🔄',
    subcategories: ['Daily Review', 'Weekly Planning', 'Progress Check', 'Reflection', 'Adjustments', '+ Custom']
  }
};

export const TaskModal = ({ isOpen, onClose, task, day, time, weekId, onSave, onUpdate, theme }) => {
  const { isTimePast, isDayPast, currentHour, currentMinute } = useRealTimeClock();
  const [formData, setFormData] = useState({
    title: '',
    category: 'Study',
    subcategory: 'Lecture Review',
    customSubcategory: '',
    startTime: '08:00',
    endTime: '10:00',
    day: 'Monday'
  });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (task) {
      const categoryData = CATEGORIES[task.category];
      const isCustomSubcategory = categoryData && !categoryData.subcategories.includes(task.subcategory);
      
      setFormData({
        title: task.title || '',
        category: task.category || 'Study',
        subcategory: isCustomSubcategory ? '+ Custom' : (task.subcategory || 'Lecture Review'),
        customSubcategory: isCustomSubcategory ? task.subcategory : '',
        startTime: task.startTime || '08:00',
        endTime: task.endTime || '10:00',
        day: task.day || 'Monday'
      });
      setShowCustomInput(isCustomSubcategory);
    } else if (day && time) {
      setFormData({
        title: '',
        category: 'Study',
        subcategory: 'Lecture Review',
        customSubcategory: '',
        startTime: time,
        endTime: `${parseInt(time.split(':')[0]) + 1}:00`,
        day: day
      });
      setShowCustomInput(false);
    }
  }, [task, day, time]);

  // Check if selected time is in the past
  useEffect(() => {
    if (formData.day && formData.startTime) {
      const isPast = isTimePast(formData.day, formData.startTime, new Date());
      if (isPast && !task) {
        setTimeError(`Cannot schedule tasks in the past. Current time: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`);
      } else {
        setTimeError('');
      }
    }
  }, [formData.day, formData.startTime, isTimePast, task, currentHour, currentMinute]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate time is not in the past
    if (!task && isTimePast(formData.day, formData.startTime, new Date())) {
      setTimeError('Cannot schedule tasks in the past!');
      return;
    }
    
    if (formData.startTime >= formData.endTime) {
      setTimeError('End time must be after start time');
      return;
    }
    
    if (formData.title.trim()) {
      let finalSubcategory = formData.subcategory;
      if (formData.subcategory === '+ Custom' && formData.customSubcategory.trim()) {
        finalSubcategory = formData.customSubcategory.trim();
      } else if (formData.subcategory === '+ Custom' && !formData.customSubcategory.trim()) {
        setTimeError('Please enter a custom subcategory or select from the list');
        return;
      }
      
      const taskData = {
        title: formData.title,
        category: formData.category,
        subcategory: finalSubcategory,
        startTime: formData.startTime,
        endTime: formData.endTime,
        day: formData.day
      };
      
      if (onSave) {
        onSave(taskData);
      } else if (task && onUpdate) {
        const data = localStorage.getItem('lifeos_data_v3');
        if (data) {
          const parsed = JSON.parse(data);
          const week = parsed.weeks[weekId];
          if (week) {
            const taskIndex = week.tasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
              week.tasks[taskIndex] = {
                ...week.tasks[taskIndex],
                ...taskData
              };
              localStorage.setItem('lifeos_data_v3', JSON.stringify(parsed));
              onUpdate();
            }
          }
        }
      }
      onClose();
    }
  };

  const handleDelete = () => {
    if (task && confirm('Delete this task?')) {
      const data = localStorage.getItem('lifeos_data_v3');
      if (data) {
        const parsed = JSON.parse(data);
        const week = parsed.weeks[weekId];
        if (week) {
          week.tasks = week.tasks.filter(t => t.id !== task.id);
          localStorage.setItem('lifeos_data_v3', JSON.stringify(parsed));
          onUpdate();
        }
      }
      onClose();
    }
  };

  const currentCategory = CATEGORIES[formData.category];
  const availableSubcategories = currentCategory?.subcategories || [];

  const handleSubcategoryChange = (value) => {
    setFormData({ ...formData, subcategory: value });
    setShowCustomInput(value === '+ Custom');
  };

  const isDayPastValue = isDayPast(formData.day);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-[500px] max-w-[90vw] bg-slate-900 rounded-2xl border border-white/20 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-slate-900/50 sticky top-0 bg-slate-900">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar size={20} style={{ color: theme?.primary || '#a855f7' }} />
              {task ? 'Edit Task' : 'Create New Task'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Task Title */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Task Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Study Mathematics Chapter 5, Complete Project Report..."
                className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                autoFocus
                required
              />
            </div>

            {/* Day Selection with Past Day Warning */}
            <div>
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Calendar size={14} /> Day
              </label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className={`w-full p-3 rounded-xl bg-slate-800 border ${
                  isDayPastValue && !task ? 'border-red-500/50 bg-red-900/20' : 'border-white/10'
                } text-white text-sm focus:border-purple-500 focus:outline-none transition`}
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => {
                  const isPast = isDayPast(d);
                  return (
                    <option key={d} value={d} disabled={isPast && !task}>
                      {d} {isPast && !task ? '(Past Day - Cannot Schedule)' : ''}
                    </option>
                  );
                })}
              </select>
              {isDayPastValue && !task && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> This day has already passed. Cannot schedule new tasks.
                </p>
              )}
            </div>

            {/* Time Selection with Past Time Warning */}
            <div>
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Clock size={14} /> Time Period
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={`w-full p-3 rounded-xl bg-slate-800 border ${
                      !task && isTimePast(formData.day, formData.startTime, new Date()) ? 'border-red-500/50 bg-red-900/20' : 'border-white/10'
                    } text-white text-sm focus:border-purple-500 focus:outline-none transition`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              {timeError && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {timeError}
                </p>
              )}
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Tag size={14} /> Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const newSubcategories = CATEGORIES[newCategory]?.subcategories || [];
                  setFormData({ 
                    ...formData, 
                    category: newCategory,
                    subcategory: newSubcategories[0] || '',
                    customSubcategory: ''
                  });
                  setShowCustomInput(false);
                }}
                className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {Object.keys(CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORIES[cat].icon} {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory Selection with Custom Option */}
            <div>
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Layers size={14} /> Subcategory
              </label>
              <select
                value={formData.subcategory}
                onChange={(e) => handleSubcategoryChange(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {availableSubcategories.map(sub => (
                  <option key={sub} value={sub}>
                    {sub === '+ Custom' ? '✏️ + Add Custom Subcategory' : sub}
                  </option>
                ))}
              </select>
              
              {/* Custom Subcategory Input */}
              {showCustomInput && (
                <div className="mt-2 animate-fade-in">
                  <label className="block text-xs text-purple-400 mb-1 flex items-center gap-1">
                    <Edit3 size={10} /> Enter your custom subcategory
                  </label>
                  <input
                    type="text"
                    value={formData.customSubcategory}
                    onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                    placeholder="e.g., Advanced Calculus, Project Alpha, Team Sync..."
                    className="w-full p-2 rounded-lg bg-purple-900/30 border border-purple-500/50 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                    autoFocus={showCustomInput}
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <p className="text-xs text-slate-400 mb-2">Task Preview:</p>
              <p className="text-sm text-white font-medium">
                {formData.title || 'Untitled Task'}
              </p>
              <div className="flex gap-3 mt-2 text-xs flex-wrap">
                <span className="text-purple-400">{CATEGORIES[formData.category]?.icon} {formData.category}</span>
                <span className="text-cyan-400">
                  → {formData.subcategory === '+ Custom' ? (formData.customSubcategory || 'Custom') : formData.subcategory}
                </span>
                <span className="text-slate-400">{formData.day} • {formData.startTime}-{formData.endTime}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={(!task && isTimePast(formData.day, formData.startTime, new Date())) || isDayPastValue}
                className={`flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition ${
                  (!task && (isTimePast(formData.day, formData.startTime, new Date()) || isDayPastValue))
                    ? 'bg-slate-600 cursor-not-allowed opacity-50'
                    : 'hover:opacity-90'
                }`}
                style={{ backgroundColor: (!task && (isTimePast(formData.day, formData.startTime, new Date()) || isDayPastValue)) ? undefined : (theme?.primary || '#a855f7') }}
              >
                <Save size={18} />
                {task ? 'Update Task' : 'Add Task'}
              </button>
              {task && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition"
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
