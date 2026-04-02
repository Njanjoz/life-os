import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, Calendar, Tag, Layers, Edit3, AlertCircle } from 'lucide-react';
import { updateTask, deleteTask } from '../../services/firebaseTaskService';

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

export const TaskModal = ({ isOpen, onClose, task, weekId, onUpdate, theme }) => {
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      setError('');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const currentCategory = CATEGORIES[formData.category];
  const availableSubcategories = currentCategory?.subcategories || [];

  const handleSubcategoryChange = (value) => {
    setFormData({ ...formData, subcategory: value });
    setShowCustomInput(value === '+ Custom');
  };

  const handleSave = async () => {
    if (formData.startTime >= formData.endTime) {
      setError('End time must be after start time');
      return;
    }
    
    if (!formData.title.trim()) {
      setError('Task title is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      let finalSubcategory = formData.subcategory;
      if (formData.subcategory === '+ Custom' && formData.customSubcategory.trim()) {
        finalSubcategory = formData.customSubcategory.trim();
      } else if (formData.subcategory === '+ Custom' && !formData.customSubcategory.trim()) {
        setError('Please enter a custom subcategory');
        setSaving(false);
        return;
      }
      
      await updateTask(task.id, {
        title: formData.title,
        category: formData.category,
        subcategory: finalSubcategory,
        startTime: formData.startTime,
        endTime: formData.endTime,
        day: formData.day
      });
      
      onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to update task: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this task? This cannot be undone.')) {
      setSaving(true);
      try {
        await deleteTask(task.id);
        onUpdate();
        onClose();
      } catch (err) {
        setError('Failed to delete task: ' + err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-slate-900 rounded-2xl border border-white/20 shadow-2xl overflow-hidden w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
        
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-5 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar size={20} style={{ color: theme?.primary || '#a855f7' }} />
              Edit Task
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 rounded">
              <X size={20} />
            </button>
          </div>
          {task.status === 'active' && (
            <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
              <AlertCircle size={12} />
              Task is currently active. Time changes will affect your schedule.
            </p>
          )}
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Task Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Study Mathematics Chapter 5"
                className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Calendar size={14} /> Day
              </label>
              <select
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>

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
                    className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none"
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
            </div>

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
              
              {showCustomInput && (
                <div className="mt-2 animate-fade-in">
                  <label className="block text-xs text-purple-400 mb-1 flex items-center gap-1">
                    <Edit3 size={10} /> Enter your custom subcategory
                  </label>
                  <input
                    type="text"
                    value={formData.customSubcategory}
                    onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                    placeholder="e.g., Advanced Calculus, Project Alpha"
                    className="w-full p-2 rounded-lg bg-purple-900/30 border border-purple-500/50 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <p className="text-xs text-slate-400 mb-2">Task Preview:</p>
              <p className="text-sm text-white font-medium break-words">
                {formData.title || 'Untitled Task'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="text-purple-400">{CATEGORIES[formData.category]?.icon} {formData.category}</span>
                <span className="text-cyan-400">
                  → {formData.subcategory === '+ Custom' ? (formData.customSubcategory || 'Custom') : formData.subcategory}
                </span>
                <span className="text-slate-400">{formData.day} • {formData.startTime}-{formData.endTime}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: theme?.primary || '#a855f7' }}
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-50"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
