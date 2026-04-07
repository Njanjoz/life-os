// src/components/WeekView/WeekView.jsx - COMPLETE FULLY FIXED VERSION
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Palette, Clock, Lock, Grid, List, ChevronDown, ChevronUp, ArrowUpDown, RotateCcw, Filter, Trash2, Check, Zap, Ban } from 'lucide-react';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, checkMissedTasks, getTheme, updateTheme, getTimeSlots, updateTimeSlots, resetAllUserData, deleteAllTasksForWeek, updateTask } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';
import { notifyUpcomingTask, notifyTaskOverdue, requestNotificationPermission } from '../../services/notificationService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper functions
const normalizeDate = (date) => {
  if (!date) return new Date();
  const normalized = new Date(date);
  if (isNaN(normalized.getTime())) return new Date();
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getNormalizedNow = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

const getWeekStart = (date) => {
  const d = normalizeDate(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getCurrentRealDate = () => normalizeDate(new Date());

const isDayInPast = (dayDate) => {
  const today = getCurrentRealDate();
  const dayStart = normalizeDate(dayDate);
  return dayStart < today;
};

// Notification Engine
let lastNotificationRun = 0;
const NOTIFICATION_THROTTLE_MS = 15000;

const runNotificationEngine = (tasks, notifiedSet) => {
  const now = Date.now();
  if (now - lastNotificationRun < NOTIFICATION_THROTTLE_MS) return;
  lastNotificationRun = now;
  
  const currentDate = new Date();
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const dayIndex = currentDate.getDay();
  const currentDay = DAYS[dayIndex === 0 ? 6 : dayIndex - 1];
  
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.day !== currentDay || t.status !== 'pending') continue;
    
    const startMinutes = t.startMinutes;
    const minutesUntilStart = startMinutes - currentMinutes;
    const taskId = t.id;
    
    if (minutesUntilStart === 5 && !notifiedSet.has(`${taskId}-5min`)) {
      notifyUpcomingTask(t.title, t.startTime, 5);
      notifiedSet.add(`${taskId}-5min`);
    } else if (minutesUntilStart === 10 && !notifiedSet.has(`${taskId}-10min`)) {
      notifyUpcomingTask(t.title, t.startTime, 10);
      notifiedSet.add(`${taskId}-10min`);
    } else if (minutesUntilStart <= 1 && minutesUntilStart >= -1 && !notifiedSet.has(`${taskId}-now`)) {
      notifyUpcomingTask(t.title, t.startTime, 0);
      notifiedSet.add(`${taskId}-now`);
    }
  }
};

// Mobile Task Cell with FIXED POPUP (higher z-index)
const MobileTaskCell = ({ task, onUpdate }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const handleStatusToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.status === 'completed') return;
    setShowConfirm(true);
  };
  
  const handleComplete = async () => {
    await updateTask(task.id, { status: 'completed', completedAt: new Date() });
    onUpdate();
    setShowConfirm(false);
  };
  
  const getStatusColor = () => {
    if (task.status === 'completed') return 'border-green-500/50 bg-green-500/10';
    if (task.status === 'missed') return 'border-red-500/50 bg-red-500/10';
    if (task.status === 'active') return 'border-white/30 bg-white/10';
    return 'border-white/20 bg-white/5';
  };
  
  return (
    <>
      <button
        onClick={handleStatusToggle}
        className={`w-full h-14 rounded-lg border relative overflow-hidden text-left ${getStatusColor()}`}
      >
        <div className="relative z-10 p-1.5 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium truncate text-white max-w-[60px]">
              {task.title?.slice(0, 8)}
            </p>
            <div className="flex items-center gap-0.5">
              {task.status === 'completed' && <Check size={10} className="text-green-500" />}
              {task.status === 'active' && <Zap size={10} className="text-white animate-pulse" />}
              {task.status === 'missed' && <Ban size={10} className="text-red-500" />}
            </div>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-0.5">
              <Clock size={7} className="text-white/40" />
              <span className="text-[8px] font-mono text-white/60">{task.startTime}</span>
            </div>
          </div>
        </div>
      </button>
      
      {/* FIXED: Higher z-index and proper positioning */}
      {showConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90" onClick={() => setShowConfirm(false)}>
          <div className="bg-black rounded-xl border border-white/20 p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-white mb-4">Complete "{task.title}"?</p>
            <div className="flex gap-3">
              <button onClick={handleComplete} className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-semibold">Complete</button>
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Desktop Task Cell
const DesktopTaskCell = ({ task, onUpdate, theme }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const getStatusColor = () => {
    if (task.status === 'completed') return 'border-green-500/50 bg-green-500/20';
    if (task.status === 'missed') return 'border-red-500/50 bg-red-500/20';
    if (task.status === 'active') return 'border-purple-500/50 bg-purple-500/20';
    return 'border-blue-500/50 bg-blue-500/10';
  };
  
  const getStatusIcon = () => {
    if (task.status === 'completed') return <Check size={10} className="text-green-500" />;
    if (task.status === 'active') return <Zap size={10} className="text-purple-500 animate-pulse" />;
    if (task.status === 'missed') return <Ban size={10} className="text-red-500" />;
    return null;
  };
  
  const handleClick = async () => {
    if (task.status === 'completed') return;
    if (task.status === 'pending' || task.status === 'active') {
      setShowConfirm(true);
    }
  };
  
  const handleComplete = async () => {
    await updateTask(task.id, { status: 'completed', completedAt: new Date() });
    onUpdate();
    setShowConfirm(false);
  };
  
  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full h-14 rounded-lg border relative overflow-hidden text-left transition-all hover:brightness-110 ${getStatusColor()}`}
      >
        <div className="relative z-10 p-1.5 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium truncate text-white max-w-[60px]">
              {task.title?.slice(0, 8)}
            </p>
            {getStatusIcon()}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-0.5">
              <Clock size={7} className="text-slate-400" />
              <span className="text-[8px] font-mono text-slate-300">{task.startTime}</span>
            </div>
          </div>
        </div>
      </button>
      
      {showConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80" onClick={() => setShowConfirm(false)}>
          <div className="bg-slate-900 rounded-xl border border-white/20 p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-white mb-4">Complete "{task.title}"?</p>
            <div className="flex gap-3">
              <button onClick={handleComplete} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">Complete</button>
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function WeekView() {
  const { user } = useAuth();
  
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);
  
  const WINDOW_SIZE = isMobileDevice ? 2 : 3;
  const LOAD_MORE_STEP = isMobileDevice ? 2 : 3;
  const clockInterval = isMobileDevice ? 10000 : 1000;
  const { now, timeString, dateString, getCurrentTimePosition: getClockPosition } = useRealTimeClock(clockInterval);
  
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => normalizeDate(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [theme, setTheme] = useState({ primary: '#a855f7', secondary: '#3b82f6' });
  const [timeSlots, setTimeSlots] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState('12:00');
  const [viewMode, setViewMode] = useState('day');
  const [selectedDay, setSelectedDay] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });
  const [expandedSections, setExpandedSections] = useState({});
  const [visibleSlotCount, setVisibleSlotCount] = useState(WINDOW_SIZE);
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seconds, setSeconds] = useState(() => new Date().getSeconds());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const isLoadingRef = useRef(false);
  const notifiedTasksRef = useRef(new Set());
  const notificationIntervalRef = useRef(null);
  const tasksRef = useRef([]);
  const secondsIntervalRef = useRef(null);
  const filterButtonRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastSelectedDateKeyRef = useRef(null);
  
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (notificationIntervalRef.current) clearInterval(notificationIntervalRef.current);
      if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (isMobileDevice) return;
    secondsIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) setSeconds(new Date().getSeconds());
    }, 1000);
    return () => {
      if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);
    };
  }, [isMobileDevice]);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterMenu && filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);
  
  const loadWeek = useCallback(async () => {
    if (isLoadingRef.current || !user || !isMountedRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      const currentWeek = await getCurrentWeek(selectedDate);
      if (!isMountedRef.current) return;
      setWeek(currentWeek);
      
      const weekTasks = await getWeekTasks(currentWeek.id);
      if (!isMountedRef.current) return;
      
      const activeTasks = weekTasks
        .filter(t => t.status !== 'rescheduled' && t.status !== 'rescheduled_with_progress' && !t.rescheduledTo)
        .map(t => {
          const [startHour, startMin] = t.startTime.split(':').map(Number);
          const [endHour, endMin] = t.endTime.split(':').map(Number);
          return { ...t, startMinutes: startHour * 60 + startMin, endMinutes: endHour * 60 + endMin };
        });
      
      setTasks(activeTasks);
      setMetrics(currentWeek.metrics || {});
      
      const savedTheme = await getTheme();
      if (savedTheme && isMountedRef.current) setTheme(savedTheme);
      
      const savedTimeSlots = await getTimeSlots();
      const taskTimes = [...new Set(activeTasks.map(t => t.startTime))].sort();
      const allSlots = taskTimes.length > 0 ? taskTimes : savedTimeSlots;
      if (isMountedRef.current) setTimeSlots(allSlots);
      
      try { await checkMissedTasks(currentWeek.id, selectedDate); } catch (e) { console.warn(e); }
      
      const updatedMetrics = await updateWeekMetrics(currentWeek.id);
      if (updatedMetrics && isMountedRef.current) setMetrics(updatedMetrics);
      
    } catch (error) {
      console.error('Load week error:', error);
    } finally {
      if (isMountedRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [user, selectedDate]);
  
  useEffect(() => {
    if (!user) return;
    const currentDateKey = selectedDate.toDateString();
    if (lastSelectedDateKeyRef.current !== currentDateKey) {
      lastSelectedDateKeyRef.current = currentDateKey;
      loadWeek();
    }
  }, [user, selectedDate, refreshTrigger, loadWeek]);
  
  useEffect(() => {
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
  }, [selectedDay, viewMode, WINDOW_SIZE]);
  
  useEffect(() => {
    if (!user) return;
    requestNotificationPermission().catch(console.warn);
    if (notificationIntervalRef.current) clearInterval(notificationIntervalRef.current);
    if (tasksRef.current.length > 0) runNotificationEngine(tasksRef.current, notifiedTasksRef.current);
    notificationIntervalRef.current = setInterval(() => {
      runNotificationEngine(tasksRef.current, notifiedTasksRef.current);
    }, 60000);
    return () => { if (notificationIntervalRef.current) clearInterval(notificationIntervalRef.current); };
  }, [user]);
  
  const handleRefresh = useCallback(() => {
    notifiedTasksRef.current.clear();
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  const changeWeek = useCallback((direction) => {
    const newDate = normalizeDate(new Date(selectedDate));
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(normalizeDate(newDate));
    notifiedTasksRef.current.clear();
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
  }, [selectedDate, WINDOW_SIZE]);
  
  const getDayDate = useCallback((dayName) => {
    const startOfWeek = normalizeDate(selectedDate);
    const day = startOfWeek.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    const dayIndex = DAYS.indexOf(dayName);
    const targetDate = normalizeDate(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return normalizeDate(targetDate);
  }, [selectedDate]);
  
  const formatDateRange = useCallback(() => {
    const startOfWeek = normalizeDate(selectedDate);
    const day = startOfWeek.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [selectedDate]);
  
  const getTaskAtSlot = useCallback((day, time) => {
    return tasks.find(t => t.day === day && t.startTime === time);
  }, [tasks]);
  
  const tasksByDay = useMemo(() => {
    const byDay = {};
    DAYS.forEach(day => { byDay[day] = tasks.filter(t => t.day === day); });
    return byDay;
  }, [tasks]);
  
  const currentDayTimes = useMemo(() => {
    const times = [...new Set(tasksByDay[DAYS[selectedDay]]?.map(t => t.startTime) || [])].sort();
    return times;
  }, [tasksByDay, selectedDay]);
  
  const sortedDayTimes = useMemo(() => {
    return sortOrder === 'asc' ? [...currentDayTimes].sort() : [...currentDayTimes].sort().reverse();
  }, [currentDayTimes, sortOrder]);
  
  const sortedWeekTimes = useMemo(() => {
    return sortOrder === 'asc' ? [...timeSlots].sort() : [...timeSlots].sort().reverse();
  }, [timeSlots, sortOrder]);
  
  const visibleDaySlots = useMemo(() => {
    if (expandedSections['dayView'] || visibleSlotCount > WINDOW_SIZE) {
      return sortedDayTimes.slice(0, visibleSlotCount);
    }
    return sortedDayTimes.slice(0, WINDOW_SIZE);
  }, [expandedSections, sortedDayTimes, visibleSlotCount, WINDOW_SIZE]);
  
  const visibleWeekSlots = useMemo(() => {
    if (expandedSections['weekView'] || visibleSlotCount > WINDOW_SIZE) {
      return sortedWeekTimes.slice(0, visibleSlotCount);
    }
    return sortedWeekTimes.slice(0, WINDOW_SIZE);
  }, [expandedSections, sortedWeekTimes, visibleSlotCount, WINDOW_SIZE]);
  
  const hasMoreSlots = sortedDayTimes.length > visibleSlotCount;
  const hasMoreWeekSlots = sortedWeekTimes.length > visibleSlotCount;
  
  const toggleSortOrder = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  const loadMoreSlots = () => {
    const maxLength = viewMode === 'day' ? sortedDayTimes.length : sortedWeekTimes.length;
    setVisibleSlotCount(prev => Math.min(prev + LOAD_MORE_STEP, maxLength));
    setExpandedSections(prev => ({ ...prev, [viewMode === 'day' ? 'dayView' : 'weekView']: true }));
  };
  const loadAllSlots = () => {
    const maxLength = viewMode === 'day' ? sortedDayTimes.length : sortedWeekTimes.length;
    setVisibleSlotCount(maxLength);
    setExpandedSections(prev => ({ ...prev, [viewMode === 'day' ? 'dayView' : 'weekView']: true }));
  };
  const showLessSlots = () => {
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
  };
  const expandAll = () => setExpandedSections({ dayView: true, weekView: true });
  const collapseAll = () => setExpandedSections({ dayView: false, weekView: false });
  
  const isTaskDateTimeInPast = useCallback((dayName, timeStr, dayDate) => {
    const taskDate = new Date(dayDate);
    const [hour, minute] = timeStr.split(':').map(Number);
    taskDate.setHours(hour, minute, 0, 0);
    return taskDate.getTime() < getNormalizedNow().getTime();
  }, []);
  
  const handleSlotClick = useCallback((day, time, dayDate) => {
    const taskDateNormalized = normalizeDate(dayDate);
    if (taskDateNormalized < getCurrentRealDate()) return;
    if (getTaskAtSlot(day, time)) return;
    setSelectedSlot({ day, time });
    setShowSlotModal(true);
  }, [getTaskAtSlot]);
  
  const handleAddTaskToSlot = async (taskData) => {
    if (!week || !selectedSlot) return;
    await addTask(week.id, {
      title: taskData.title,
      category: taskData.category,
      subcategory: taskData.subcategory,
      day: selectedSlot.day,
      startTime: selectedSlot.time,
      endTime: taskData.endTime || `${parseInt(selectedSlot.time.split(':')[0]) + 1}:00`
    });
    handleRefresh();
    setShowSlotModal(false);
    setSelectedSlot(null);
  };
  
  const handleAddTask = async (taskData) => {
    if (!week) return;
    await addTask(week.id, {
      title: taskData.title,
      category: taskData.category,
      subcategory: taskData.subcategory,
      day: taskData.day,
      startTime: taskData.startTime,
      endTime: taskData.endTime
    });
    handleRefresh();
    setShowAddModal(false);
  };
  
  const handleThemeUpdate = async (newTheme) => { await updateTheme(newTheme); setTheme(newTheme); };
  
  const handleAddTimeSlot = async () => {
    if (newTimeSlot && !timeSlots.includes(newTimeSlot)) {
      const updatedSlots = [...timeSlots, newTimeSlot].sort();
      await updateTimeSlots(updatedSlots);
      setTimeSlots(updatedSlots);
      setNewTimeSlot('12:00');
      handleRefresh();
    }
  };
  
  const handleRemoveTimeSlot = async (slot) => {
    const updatedSlots = timeSlots.filter(s => s !== slot);
    await updateTimeSlots(updatedSlots);
    setTimeSlots(updatedSlots);
    handleRefresh();
  };
  
  const handleResetWeek = async () => {
    if (window.confirm('⚠️ Delete ALL tasks for this week? This cannot be undone.')) {
      setResetting(true);
      try {
        if (week) await deleteAllTasksForWeek(week.id);
        handleRefresh();
      } catch (error) { console.error(error); alert('Failed to reset week.'); }
      finally { setResetting(false); setShowFilterMenu(false); }
    }
  };
  
  const handleResetAll = async () => {
    if (window.confirm('⚠️ COMPLETE DATA RESET - This will delete EVERYTHING. Cannot be undone.')) {
      setResetting(true);
      try { await resetAllUserData(); window.location.reload(); } 
      catch (error) { console.error(error); alert('Failed to reset data.'); setResetting(false); }
    }
  };
  
  if (loading && tasks.length === 0 && !resetting) {
    return (
      <div className="flex justify-center items-center h-96 w-full bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        <p className="ml-2 text-xs text-slate-400">Loading...</p>
      </div>
    );
  }
  
  // ================================================================
  // MOBILE B&W LITE RENDER - WITH VERTICAL SCROLLING
  // ================================================================
  if (isMobileDevice) {
    return (
      <div className="h-screen flex flex-col bg-black overflow-hidden">
        {/* Fixed Header - Doesn't scroll */}
        <div className="flex-shrink-0 p-3 space-y-3 border-b border-white/10">
          {/* Top Bar */}
          <div className="bg-black rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-white" />
                <div>
                  <p className="text-sm font-mono font-bold text-white">{timeString}</p>
                  <p className="text-[9px] text-white/40">{dateString}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white"><ChevronLeft size={14} /></button>
                <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white"><ChevronRight size={14} /></button>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-lg transition ${viewMode === 'day' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                  <List size={14} />
                </button>
                <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-lg transition ${viewMode === 'week' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                  <Grid size={14} />
                </button>
                <div className="relative" ref={filterButtonRef}>
                  <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="p-1.5 rounded-lg text-white/60 hover:text-white transition">
                    <Filter size={14} />
                  </button>
                  {showFilterMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-black rounded-lg border border-white/20 shadow-xl z-[100] min-w-[200px]">
                      <div className="py-1">
                        <button onClick={toggleSortOrder} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                          <ArrowUpDown size={12} /> Sort: {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}
                        </button>
                        <button onClick={expandAll} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                          <ChevronDown size={12} /> Expand All
                        </button>
                        <button onClick={collapseAll} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                          <ChevronUp size={12} /> Collapse All
                        </button>
                        <div className="h-px bg-white/10 my-1" />
                        <button onClick={handleResetWeek} disabled={resetting} className="w-full px-4 py-2 text-left text-xs text-yellow-400 hover:bg-yellow-500/10 transition flex items-center gap-2">
                          <Trash2 size={12} /> Reset This Week
                        </button>
                        <button onClick={handleResetAll} disabled={resetting} className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 transition flex items-center gap-2">
                          <RotateCcw size={12} /> Complete Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg text-black bg-white hover:bg-white/90">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-center">
              <p className="text-[8px] text-white/40">Score</p>
              <p className="text-sm font-bold text-white">{metrics.weeklyScore || 0}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-center">
              <p className="text-[8px] text-white/40">Complete</p>
              <p className="text-sm font-bold text-white">{metrics.completionRate || 0}%</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-center">
              <p className="text-[8px] text-white/40">Discipline</p>
              <p className="text-sm font-bold text-white">{metrics.disciplineScore || 0}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-center">
              <p className="text-[8px] text-white/40">Delay</p>
              <p className="text-sm font-bold text-orange-400">{metrics.avgDelay || 0}m</p>
            </div>
          </div>
          
          {/* Week Nav */}
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2">
            <Calendar size={12} className="text-white/60" />
            <span className="text-[10px] font-medium text-white">{formatDateRange()}</span>
            <div className="flex gap-1">
              <button onClick={() => setShowThemeModal(true)} className="p-1 hover:bg-white/10 rounded"><Palette size={12} className="text-white/60" /></button>
              <button onClick={() => setShowTimeSlotModal(true)} className="p-1 hover:bg-white/10 rounded"><Clock size={12} className="text-white/60" /></button>
            </div>
          </div>
          
          {/* Day Selector */}
          {viewMode === 'day' && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {DAYS.map((day, idx) => {
                const date = getDayDate(day);
                const isToday = date.toDateString() === getCurrentRealDate().toDateString();
                const isPastDay = isDayInPast(date);
                const hasTasks = (tasksByDay[day] || []).length > 0;
                return (
                  <button
                    key={day}
                    onClick={() => { if (!isPastDay) { setSelectedDay(idx); setVisibleSlotCount(WINDOW_SIZE); setExpandedSections({ dayView: false, weekView: false }); } }}
                    disabled={isPastDay}
                    className={`flex-1 min-w-[60px] py-2 rounded-lg text-center transition ${
                      isPastDay ? 'opacity-40 cursor-not-allowed bg-white/5 text-white/40' :
                      selectedDay === idx ? 'bg-white text-black' : 'bg-white/10 text-white/80'
                    } ${isToday && !isPastDay ? 'border border-white' : ''}`}
                  >
                    <div className="text-[10px] font-bold">{day.slice(0, 3)}</div>
                    <div className="text-[8px]">{date.getDate()}</div>
                    {hasTasks && !isPastDay && <div className="w-1 h-1 rounded-full bg-green-500 mx-auto mt-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-20">
          <div className="space-y-3">
            {/* Time Grid */}
            <div className="bg-black border border-white/20 rounded-xl overflow-hidden w-full">
              <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-8'} border-b border-white/10 bg-white/5 sticky top-0 z-10`}>
                <div className="p-2 text-center text-[9px] font-bold text-white/60 uppercase border-r border-white/10">Time</div>
                {viewMode === 'week' && DAYS.map(day => {
                  const date = getDayDate(day);
                  const isPastDay = isDayInPast(date);
                  return (
                    <div key={day} className={`p-2 text-center ${isPastDay ? 'opacity-40' : ''}`}>
                      <div className="text-[10px] font-bold text-white">{day.slice(0, 3)}</div>
                      <div className="text-[8px] text-white/40">{date.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              
              {viewMode === 'day' ? (
                <>
                  {visibleDaySlots.map((time) => {
                    const task = getTaskAtSlot(DAYS[selectedDay], time);
                    const date = getDayDate(DAYS[selectedDay]);
                    const isPast = date < getCurrentRealDate();
                    const canAdd = !isPast && !isTaskDateTimeInPast(DAYS[selectedDay], time, date);
                    return (
                      <div key={time} className={`grid grid-cols-1 border-b border-white/10 ${isPast ? 'opacity-50' : ''}`}>
                        <div className="p-1.5 border-r border-white/10 flex items-center justify-between bg-white/5">
                          <span className="text-[9px] font-mono text-white/60">{time}</span>
                        </div>
                        <div className="p-0.5 w-full bg-black">
                          {task ? (
                            <MobileTaskCell task={task} onUpdate={handleRefresh} />
                          ) : canAdd ? (
                            <div onClick={() => handleSlotClick(DAYS[selectedDay], time, date)} className="h-14 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center active:bg-white/10 transition cursor-pointer">
                              <Plus size={14} className="text-white/40" />
                            </div>
                          ) : (
                            <div className="h-14 rounded-lg border border-white/10 bg-white/5 opacity-30 flex items-center justify-center cursor-not-allowed">
                              <Lock size={10} className="text-white/40" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {hasMoreSlots && (
                    <div className="flex gap-2 p-2 bg-white/5 border-t border-white/10">
                      <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-white bg-white/10 rounded-lg">Load More</button>
                      <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-white/60 bg-white/10 rounded-lg">Load All ({sortedDayTimes.length})</button>
                    </div>
                  )}
                  {visibleSlotCount > WINDOW_SIZE && (
                    <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-white bg-white/5 border-t border-white/10">Show Less</button>
                  )}
                </>
              ) : (
                <>
                  {visibleWeekSlots.map((time) => (
                    <div key={time} className="grid grid-cols-8 border-b border-white/10">
                      <div className="p-1.5 border-r border-white/10 flex items-center justify-center bg-white/5">
                        <span className="text-[9px] font-mono text-white/60">{time}</span>
                      </div>
                      {DAYS.map(day => {
                        const task = getTaskAtSlot(day, time);
                        const date = getDayDate(day);
                        const isPast = date < getCurrentRealDate();
                        const canAdd = !isPast && !isTaskDateTimeInPast(day, time, date);
                        return (
                          <div key={`${day}-${time}`} className={`p-0.5 w-full bg-black ${isPast ? 'opacity-50' : ''}`}>
                            {task ? (
                              <MobileTaskCell task={task} onUpdate={handleRefresh} />
                            ) : canAdd ? (
                              <div onClick={() => handleSlotClick(day, time, date)} className="h-14 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center active:bg-white/10 transition cursor-pointer">
                                <Plus size={12} className="text-white/40" />
                              </div>
                            ) : (
                              <div className="h-14 rounded-lg border border-white/10 bg-white/5 opacity-30 flex items-center justify-center cursor-not-allowed">
                                <Lock size={10} className="text-white/40" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {hasMoreWeekSlots && (
                    <div className="flex gap-2 p-2 bg-white/5 border-t border-white/10">
                      <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-white bg-white/10 rounded-lg">Load More</button>
                      <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-white/60 bg-white/10 rounded-lg">Load All ({sortedWeekTimes.length})</button>
                    </div>
                  )}
                  {visibleSlotCount > WINDOW_SIZE && (
                    <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-white bg-white/5 border-t border-white/10">Show Less</button>
                  )}
                </>
              )}
            </div>
            
            {/* Empty State */}
            {viewMode === 'day' && currentDayTimes.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <Calendar size={24} className="text-white/30 mx-auto mb-2" />
                <p className="text-xs text-white/60">No tasks for {DAYS[selectedDay]}</p>
                <button onClick={() => setShowAddModal(true)} className="mt-2 px-3 py-1.5 rounded-lg bg-white text-black text-xs">Add Task</button>
              </div>
            )}
          </div>
        </div>
        
        {/* Modals */}
        <TaskModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAddTask} theme={theme} day={DAYS[selectedDay]} weekStartDate={getWeekStart(selectedDate)} isMobile={true} />
        <TaskModal isOpen={showSlotModal} onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} day={selectedSlot?.day} time={selectedSlot?.time} onSave={handleAddTaskToSlot} theme={theme} weekStartDate={getWeekStart(selectedDate)} isMobile={true} />
        
        {showThemeModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-black rounded-xl p-4 w-80 border border-white/20">
              <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Theme</h3><button onClick={() => setShowThemeModal(false)}><X size={14} className="text-white/60" /></button></div>
              <div className="space-y-2">
                <div><label className="text-[10px] text-white/60">Primary</label><input type="color" value={theme.primary} onChange={e => handleThemeUpdate({...theme, primary: e.target.value})} className="w-full h-8 rounded-lg mt-1 bg-white/10 border border-white/20" /></div>
                <div><label className="text-[10px] text-white/60">Secondary</label><input type="color" value={theme.secondary} onChange={e => handleThemeUpdate({...theme, secondary: e.target.value})} className="w-full h-8 rounded-lg mt-1 bg-white/10 border border-white/20" /></div>
              </div>
            </div>
          </div>
        )}
        
        {showTimeSlotModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-black rounded-xl p-4 w-80 border border-white/20">
              <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Time Slots</h3><button onClick={() => setShowTimeSlotModal(false)}><X size={14} className="text-white/60" /></button></div>
              <div className="flex gap-2 mb-3"><input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="flex-1 p-1.5 text-xs rounded bg-white/10 border border-white/20 text-white" /><button onClick={handleAddTimeSlot} className="px-3 py-1.5 rounded text-xs bg-white text-black">Add</button></div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {timeSlots.map(slot => (
                  <div key={slot} className="flex justify-between items-center p-1.5 rounded bg-white/10">
                    <span className="text-xs text-white">{slot}</span>
                    <button onClick={() => handleRemoveTimeSlot(slot)} className="text-red-400 text-[9px]">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // ================================================================
  // DESKTOP RENDER - FULL ORIGINAL STYLES WITH PROPER CELLS
  // ================================================================
  return (
    <div className="w-full max-w-full overflow-x-auto pb-20 relative">
      <div className="min-w-[320px] space-y-3 p-4">
        
        {/* Desktop Top Bar */}
        <div className="bg-slate-900/80 rounded-xl p-3 border border-white/10 sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-purple-400" />
              <div>
                <p className="text-sm font-mono font-bold text-white">{timeString}:<span className="text-purple-400 font-bold">{seconds.toString().padStart(2, '0')}</span></p>
                <p className="text-[9px] text-slate-400">{dateString}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white"><ChevronLeft size={14} /></button>
              <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white"><ChevronRight size={14} /></button>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-lg transition ${viewMode === 'day' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <List size={14} />
              </button>
              <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-lg transition ${viewMode === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Grid size={14} />
              </button>
              <div className="relative" ref={filterButtonRef}>
                <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition">
                  <Filter size={14} />
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg border border-white/10 shadow-xl z-[100] min-w-[200px]">
                    <div className="py-1">
                      <button onClick={toggleSortOrder} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                        <ArrowUpDown size={12} /> Sort: {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}
                      </button>
                      <button onClick={expandAll} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                        <ChevronDown size={12} /> Expand All
                      </button>
                      <button onClick={collapseAll} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                        <ChevronUp size={12} /> Collapse All
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button onClick={handleResetWeek} disabled={resetting} className="w-full px-4 py-2 text-left text-xs text-yellow-400 hover:bg-yellow-500/10 transition flex items-center gap-2">
                        <Trash2 size={12} /> Reset This Week
                      </button>
                      <button onClick={handleResetAll} disabled={resetting} className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 transition flex items-center gap-2">
                        <RotateCcw size={12} /> Complete Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Desktop Stats */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-slate-900/50 rounded-lg p-2 text-center backdrop-blur-sm"><p className="text-[8px] text-slate-400 uppercase">Score</p><p className="text-lg font-bold text-white">{metrics.weeklyScore || 0}</p></div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center backdrop-blur-sm"><p className="text-[8px] text-slate-400 uppercase">Complete</p><p className="text-lg font-bold text-white">{metrics.completionRate || 0}%</p></div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center backdrop-blur-sm"><p className="text-[8px] text-slate-400 uppercase">Discipline</p><p className="text-lg font-bold text-white">{metrics.disciplineScore || 0}</p></div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center backdrop-blur-sm"><p className="text-[8px] text-slate-400 uppercase">Delay</p><p className="text-lg font-bold text-orange-400">{metrics.avgDelay || 0}m</p></div>
        </div>
        
        {/* Desktop Week Nav */}
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3 backdrop-blur-sm">
          <Calendar size={14} className="text-purple-400" />
          <span className="text-xs font-medium text-white">{formatDateRange()}</span>
          <div className="flex gap-2">
            <button onClick={() => setShowThemeModal(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Palette size={14} className="text-purple-400" /></button>
            <button onClick={() => setShowTimeSlotModal(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Clock size={14} className="text-purple-400" /></button>
          </div>
        </div>
        
        {/* Desktop Day Selector */}
        {viewMode === 'day' && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {DAYS.map((day, idx) => {
              const date = getDayDate(day);
              const isToday = date.toDateString() === getCurrentRealDate().toDateString();
              const isPastDay = isDayInPast(date);
              const hasTasks = (tasksByDay[day] || []).length > 0;
              return (
                <button
                  key={day}
                  onClick={() => { if (!isPastDay) { setSelectedDay(idx); setVisibleSlotCount(WINDOW_SIZE); setExpandedSections({ dayView: false, weekView: false }); } }}
                  disabled={isPastDay}
                  className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-center transition ${
                    isPastDay ? 'opacity-40 cursor-not-allowed bg-slate-800/30 text-slate-500' :
                    selectedDay === idx ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  } ${isToday && !isPastDay ? 'border-2 border-purple-500' : ''}`}
                >
                  <div className="text-xs font-bold">{day.slice(0, 3)}</div>
                  <div className="text-[10px] opacity-75">{date.getDate()}</div>
                  {hasTasks && !isPastDay && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mx-auto mt-1" />}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Desktop Time Grid - FULL ORIGINAL */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden w-full backdrop-blur-sm">
          <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-8'} border-b border-white/10 bg-slate-900/40`}>
            <div className="p-2 text-center text-[10px] font-bold text-slate-500 uppercase border-r border-white/10">Time</div>
            {viewMode === 'week' && DAYS.map(day => {
              const date = getDayDate(day);
              const isPastDay = isDayInPast(date);
              return (
                <div key={day} className={`p-2 text-center ${isPastDay ? 'opacity-40' : ''}`}>
                  <div className="text-xs font-bold text-white">{day.slice(0, 3)}</div>
                  <div className="text-[9px] text-slate-400">{date.getDate()}</div>
                </div>
              );
            })}
          </div>
          
          {viewMode === 'day' ? (
            <>
              {visibleDaySlots.map((time) => {
                const task = getTaskAtSlot(DAYS[selectedDay], time);
                const date = getDayDate(DAYS[selectedDay]);
                const isPast = date < getCurrentRealDate();
                const canAdd = !isPast && !isTaskDateTimeInPast(DAYS[selectedDay], time, date);
                return (
                  <div key={time} className={`grid grid-cols-1 border-b border-white/10 relative ${isPast ? 'opacity-50' : ''}`}>
                    <div className="p-2 border-r border-white/10 flex items-center justify-between bg-slate-900/30">
                      <span className="text-[10px] font-mono text-slate-400">{time}</span>
                    </div>
                    <div className="p-1">
                      {task ? (
                        <DesktopTaskCell task={task} onUpdate={handleRefresh} theme={theme} />
                      ) : canAdd ? (
                        <div onClick={() => handleSlotClick(DAYS[selectedDay], time, date)} className="h-14 rounded-lg border border-dashed border-white/20 bg-slate-800/50 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                          <Plus size={16} className="text-slate-500" />
                        </div>
                      ) : (
                        <div className="h-14 rounded-lg border border-white/10 bg-slate-800/50 opacity-30 flex items-center justify-center cursor-not-allowed">
                          <Lock size={12} className="text-slate-600" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMoreSlots && (
                <div className="flex gap-2 p-3 bg-slate-900/30 border-t border-white/10">
                  <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-xs text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-2 bg-purple-500/10 rounded-lg">
                    <ChevronDown size={14} /> Load {LOAD_MORE_STEP} More
                  </button>
                  <button onClick={loadAllSlots} className="py-2 px-4 text-center text-xs text-slate-400 hover:text-white transition bg-slate-800/50 rounded-lg">
                    Load All ({sortedDayTimes.length})
                  </button>
                </div>
              )}
              {visibleSlotCount > WINDOW_SIZE && (
                <button onClick={showLessSlots} className="w-full py-2 text-center text-xs text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-2 bg-slate-900/30 border-t border-white/10">
                  <ChevronUp size={14} /> Show Less
                </button>
              )}
            </>
          ) : (
            <>
              {visibleWeekSlots.map((time) => {
                let hasAnyTask = false;
                for (let i = 0; i < DAYS.length; i++) {
                  if (getTaskAtSlot(DAYS[i], time)) { hasAnyTask = true; break; }
                }
                if (!hasAnyTask) return null;
                
                return (
                  <div key={time} className="grid grid-cols-8 border-b border-white/10 relative">
                    <div className="p-2 border-r border-white/10 flex items-center justify-center bg-slate-900/30">
                      <span className="text-[10px] font-mono text-slate-400">{time}</span>
                    </div>
                    {DAYS.map(day => {
                      const task = getTaskAtSlot(day, time);
                      const date = getDayDate(day);
                      const isPast = date < getCurrentRealDate();
                      const canAdd = !isPast && !isTaskDateTimeInPast(day, time, date);
                      return (
                        <div key={`${day}-${time}`} className={`p-1 ${isPast ? 'opacity-50' : ''}`} onClick={() => canAdd && !task && handleSlotClick(day, time, date)}>
                          {task ? (
                            <DesktopTaskCell task={task} onUpdate={handleRefresh} theme={theme} />
                          ) : canAdd ? (
                            <div className="h-14 rounded-lg border border-dashed border-white/20 bg-slate-800/50 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                              <Plus size={14} className="text-slate-500" />
                            </div>
                          ) : (
                            <div className="h-14 rounded-lg border border-white/10 bg-slate-800/50 opacity-30 flex items-center justify-center cursor-not-allowed">
                              <Lock size={10} className="text-slate-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {hasMoreWeekSlots && (
                <div className="flex gap-2 p-3 bg-slate-900/30 border-t border-white/10">
                  <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-xs text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-2 bg-purple-500/10 rounded-lg">
                    <ChevronDown size={14} /> Load {LOAD_MORE_STEP} More
                  </button>
                  <button onClick={loadAllSlots} className="py-2 px-4 text-center text-xs text-slate-400 hover:text-white transition bg-slate-800/50 rounded-lg">
                    Load All ({sortedWeekTimes.length})
                  </button>
                </div>
              )}
              {visibleSlotCount > WINDOW_SIZE && (
                <button onClick={showLessSlots} className="w-full py-2 text-center text-xs text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-2 bg-slate-900/30 border-t border-white/10">
                  <ChevronUp size={14} /> Show Less
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Desktop Empty State */}
        {viewMode === 'day' && currentDayTimes.length === 0 && (
          <div className="bg-slate-900/50 rounded-xl p-8 text-center backdrop-blur-sm">
            <Calendar size={32} className="text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No tasks for {DAYS[selectedDay]}</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 transition">
              Add Task
            </button>
          </div>
        )}
        
        {/* Desktop Modals */}
        <TaskModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAddTask} theme={theme} day={DAYS[selectedDay]} weekStartDate={getWeekStart(selectedDate)} isMobile={false} />
        <TaskModal isOpen={showSlotModal} onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} day={selectedSlot?.day} time={selectedSlot?.time} onSave={handleAddTaskToSlot} theme={theme} weekStartDate={getWeekStart(selectedDate)} isMobile={false} />
        
        {showThemeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-xl p-5 w-96 shadow-2xl">
              <div className="flex justify-between mb-4"><h3 className="text-base font-bold text-white">Customize Theme</h3><button onClick={() => setShowThemeModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button></div>
              <div className="space-y-3">
                <div><label className="text-xs text-slate-400 block mb-1">Primary Color</label><input type="color" value={theme.primary} onChange={e => handleThemeUpdate({...theme, primary: e.target.value})} className="w-full h-10 rounded-lg bg-slate-800 border border-white/10 cursor-pointer" /></div>
                <div><label className="text-xs text-slate-400 block mb-1">Secondary Color</label><input type="color" value={theme.secondary} onChange={e => handleThemeUpdate({...theme, secondary: e.target.value})} className="w-full h-10 rounded-lg bg-slate-800 border border-white/10 cursor-pointer" /></div>
              </div>
            </div>
          </div>
        )}
        
        {showTimeSlotModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-xl p-5 w-96 shadow-2xl">
              <div className="flex justify-between mb-4"><h3 className="text-base font-bold text-white">Manage Time Slots</h3><button onClick={() => setShowTimeSlotModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button></div>
              <div className="flex gap-2 mb-4"><input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="flex-1 p-2 text-sm rounded-lg bg-slate-800 border border-white/10 text-white" /><button onClick={handleAddTimeSlot} className="px-4 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 transition">Add</button></div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {timeSlots.map(slot => (
                  <div key={slot} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/50">
                    <span className="text-sm text-white">{slot}</span>
                    <button onClick={() => handleRemoveTimeSlot(slot)} className="text-red-400 text-xs hover:text-red-300 transition">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}