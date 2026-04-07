// src/components/WeekView/WeekView.jsx - FIXED MOBILE + DESKTOP
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar, TrendingUp, Target, Zap, ChevronLeft, ChevronRight, Plus, X, Palette, Clock, Sparkles, Lock, Grid, List, ChevronDown, ChevronUp, ArrowUpDown, RotateCcw, Filter, Trash2 } from 'lucide-react';
import TaskCell from '../TaskCell/TaskCell';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, checkMissedTasks, getBestFocusHours, getTheme, updateTheme, getTimeSlots, updateTimeSlots, resetAllUserData, deleteAllTasksForWeek } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { notifyUpcomingTask, notifyTaskOverdue, requestNotificationPermission } from '../../services/notificationService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper: Normalize date to start of day (remove time component)
const normalizeDate = (date) => {
  if (!date) return new Date();
  const normalized = new Date(date);
  if (isNaN(normalized.getTime())) return new Date();
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

// Helper: Get current time without seconds
const getNormalizedNow = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

// Helper: Get week start (Monday)
const getWeekStart = (date) => {
  const d = normalizeDate(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: Get current real date (not from selectedDate)
const getCurrentRealDate = () => {
  return normalizeDate(new Date());
};

// Helper: Check if a day is in the past (for the current week)
const isDayInPast = (dayDate) => {
  const today = getCurrentRealDate();
  const dayStart = normalizeDate(dayDate);
  return dayStart < today;
};

// ============ OPTIMIZED NOTIFICATION ENGINE ============
let lastNotificationRun = 0;
const NOTIFICATION_THROTTLE_MS = 15000;

const runNotificationEngine = (tasks, notifiedSet) => {
  // Skip notifications on mobile entirely to prevent Chrome hangs
  if (typeof window !== 'undefined' && window.innerWidth < 768) return;
  
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
    const endMinutes = t.endMinutes;
    const minutesUntilStart = startMinutes - currentMinutes;
    const minutesSinceEnd = currentMinutes - endMinutes;
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
    } else if (minutesSinceEnd > 0 && !notifiedSet.has(`${taskId}-overdue`)) {
      notifyTaskOverdue(t.title, t.endTime);
      notifiedSet.add(`${taskId}-overdue`);
    }
  }
};

// Memoized grid component to prevent full re-renders
const TimeGrid = React.memo(({ children }) => <>{children}</>);

export default function WeekView() {
  const { user } = useAuth();
  
  // Mobile detection inside component with window check
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  }, []);
  
  const WINDOW_SIZE = isMobileDevice ? 2 : 3;
  const LOAD_MORE_STEP = isMobileDevice ? 2 : 3;
  
  // Throttle clock for mobile
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
  const [bestHours, setBestHours] = useState([]);
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSorting, setIsSorting] = useState(false);
  // Desktop only: seconds counter
  const [seconds, setSeconds] = useState(() => new Date().getSeconds());
  const isLoadingRef = useRef(false);
  const notifiedTasksRef = useRef(new Set());
  const notificationIntervalRef = useRef(null);
  const tasksRef = useRef([]);
  const sortTimeoutRef = useRef(null);
  const secondsIntervalRef = useRef(null);
  const filterButtonRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastSelectedDateKeyRef = useRef(null);
  const loadWeekRef = useRef(null); // Add ref to prevent infinite loops
  
  // Cache for sorted results
  const sortedCacheRef = useRef({});
  
  // Keep tasksRef updated
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  // Cleanup all intervals on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up all intervals
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
      if (secondsIntervalRef.current) {
        clearInterval(secondsIntervalRef.current);
      }
      if (sortTimeoutRef.current) {
        clearTimeout(sortTimeoutRef.current);
      }
    };
  }, []);
  
  // Seconds counter — desktop only
  useEffect(() => {
    if (isMobileDevice) return;
    
    secondsIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setSeconds(new Date().getSeconds());
      }
    }, 1000);
    
    return () => {
      if (secondsIntervalRef.current) {
        clearInterval(secondsIntervalRef.current);
      }
    };
  }, [isMobileDevice]);
  
  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterMenu && filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);
  
  // Load tasks with pre-calculated minutes
  const loadWeek = useCallback(async () => {
    // Prevent concurrent loads
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
        .filter(t => 
          t.status !== 'rescheduled' && 
          t.status !== 'rescheduled_with_progress' &&
          !t.rescheduledTo
        )
        .map(t => {
          const [startHour, startMin] = t.startTime.split(':').map(Number);
          const [endHour, endMin] = t.endTime.split(':').map(Number);
          return {
            ...t,
            startMinutes: startHour * 60 + startMin,
            endMinutes: endHour * 60 + endMin
          };
        });
      
      setTasks(activeTasks);
      setMetrics(currentWeek.metrics || {});
      
      const savedTheme = await getTheme();
      if (savedTheme && isMountedRef.current) setTheme(savedTheme);
      
      const savedTimeSlots = await getTimeSlots();
      const taskTimes = [...new Set(activeTasks.map(t => t.startTime))].sort();
      const allSlots = taskTimes.length > 0 ? taskTimes : savedTimeSlots;
      if (isMountedRef.current) setTimeSlots(allSlots);
      
      try {
        await checkMissedTasks(currentWeek.id, selectedDate);
      } catch (missedError) {
        console.warn('Missed tasks check failed:', missedError);
      }
      
      const updatedMetrics = await updateWeekMetrics(currentWeek.id);
      if (updatedMetrics && isMountedRef.current) setMetrics(updatedMetrics);
      
      const hours = await getBestFocusHours();
      if (hours && isMountedRef.current) setBestHours(hours);
      
    } catch (error) {
      console.error('Load week error:', error);
    } finally {
      if (isMountedRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [user, selectedDate]);

  // Store loadWeek in ref to avoid dependency issues
  useEffect(() => {
    loadWeekRef.current = loadWeek;
  }, [loadWeek]);

  // FIXED: Use stable date string to prevent infinite loop
  useEffect(() => {
    if (!user) return;
    
    const currentDateKey = selectedDate.toDateString();
    const lastDateKey = lastSelectedDateKeyRef.current;
    
    // Only load if date has changed or first load
    if (lastDateKey !== currentDateKey) {
      lastSelectedDateKeyRef.current = currentDateKey;
      loadWeekRef.current();
    }
  }, [user, selectedDate]); // Remove loadWeek dependency

  // Reset visible slot count when changing days or view mode
  useEffect(() => {
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
  }, [selectedDay, viewMode, WINDOW_SIZE]);

  // Optimized notification system - DISABLED on mobile
  useEffect(() => {
    if (!user || isMobileDevice) return;
    
    // Only request permission on desktop
    requestNotificationPermission().catch(console.warn);
    
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
    }
    
    if (tasksRef.current.length > 0) {
      runNotificationEngine(tasksRef.current, notifiedTasksRef.current);
    }
    
    notificationIntervalRef.current = setInterval(() => {
      runNotificationEngine(tasksRef.current, notifiedTasksRef.current);
    }, 60000);
    
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [user, isMobileDevice]);

  const handleRefresh = useCallback(async () => { 
    setRefreshKey(prev => prev + 1);
    notifiedTasksRef.current.clear();
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
    sortedCacheRef.current = {};
    // Force reload
    const currentDateKey = selectedDate.toDateString();
    lastSelectedDateKeyRef.current = null;
    setTimeout(() => {
      lastSelectedDateKeyRef.current = currentDateKey;
      loadWeekRef.current();
    }, 0);
  }, [WINDOW_SIZE, selectedDate]);

  const changeWeek = useCallback((direction) => {
    const newDate = normalizeDate(new Date(selectedDate));
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(normalizeDate(newDate));
    notifiedTasksRef.current.clear();
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
    sortedCacheRef.current = {};
  }, [selectedDate, WINDOW_SIZE]);

  // getDayDate with proper date normalization
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

  const getCurrentTimePosition = useCallback(() => {
    const currentTime = getClockPosition();
    const slotIndex = timeSlots.findIndex(slot => slot >= currentTime.timeString);
    if (slotIndex === -1) return null;
    return { slotIndex, timeString: currentTime.timeString };
  }, [getClockPosition, timeSlots]);

  const currentPos = getCurrentTimePosition();
  
  // Single pass preprocessing
  const processed = useMemo(() => {
    const map = {};
    const byDay = {};

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      map[`${t.day}-${t.startTime}`] = t;
      
      if (!byDay[t.day]) byDay[t.day] = [];
      byDay[t.day].push(t);
    }

    return { map, byDay };
  }, [tasks]);
  
  const taskMap = processed.map;
  const tasksByDay = processed.byDay;
  
  const getTaskAtSlot = useCallback((day, time) => {
    return taskMap[`${day}-${time}`];
  }, [taskMap]);
  
  const currentDayTasks = tasksByDay[DAYS[selectedDay]] || [];
  
  const currentDayTimes = useMemo(() => {
    const times = [];
    for (let i = 0; i < currentDayTasks.length; i++) {
      times.push(currentDayTasks[i].startTime);
    }
    return [...new Set(times)].sort();
  }, [currentDayTasks]);

  // Cached sorting function
  const getSortedTimeSlots = useCallback((slots, order) => {
    const cacheKey = `${slots.join(',')}_${order}`;
    
    if (sortedCacheRef.current[cacheKey]) {
      return sortedCacheRef.current[cacheKey];
    }
    
    const result = order === 'asc' 
      ? [...slots].sort() 
      : [...slots].sort().reverse();
    
    sortedCacheRef.current[cacheKey] = result;
    
    if (Object.keys(sortedCacheRef.current).length > 50) {
      sortedCacheRef.current = {};
    }
    
    return result;
  }, []);

  const sortedDayTimes = useMemo(() => 
    getSortedTimeSlots(currentDayTimes, sortOrder),
    [getSortedTimeSlots, currentDayTimes, sortOrder]
  );
  
  const sortedWeekTimes = useMemo(() => 
    getSortedTimeSlots(timeSlots, sortOrder),
    [getSortedTimeSlots, timeSlots, sortOrder]
  );

  const getCurrentTimeSlotIndex = useCallback(() => {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < sortedDayTimes.length; i++) {
      const [hour, minute] = sortedDayTimes[i].split(':').map(Number);
      if (hour * 60 + minute >= currentTime) return i;
    }
    return -1;
  }, [now, sortedDayTimes]);

  const currentSlotIndex = getCurrentTimeSlotIndex();
  const startIndex = Math.max(0, currentSlotIndex - 1);

  const visibleDaySlots = useMemo(() => {
    if (expandedSections['dayView'] || visibleSlotCount > WINDOW_SIZE) {
      return sortedDayTimes.slice(0, visibleSlotCount);
    }
    return sortedDayTimes.slice(startIndex, startIndex + WINDOW_SIZE);
  }, [expandedSections, sortedDayTimes, startIndex, visibleSlotCount, WINDOW_SIZE]);

  const visibleWeekSlots = useMemo(() => {
    if (expandedSections['weekView'] || visibleSlotCount > WINDOW_SIZE) {
      return sortedWeekTimes.slice(0, visibleSlotCount);
    }
    return sortedWeekTimes.slice(0, WINDOW_SIZE);
  }, [expandedSections, sortedWeekTimes, visibleSlotCount, WINDOW_SIZE]);

  const hasMoreSlots = sortedDayTimes.length > visibleSlotCount;
  const hasMoreWeekSlots = sortedWeekTimes.length > visibleSlotCount;

  const toggleSortOrder = useCallback(() => {
    if (isSorting) return;
    
    setIsSorting(true);
    
    if (sortTimeoutRef.current) {
      clearTimeout(sortTimeoutRef.current);
    }
    
    sortTimeoutRef.current = setTimeout(() => {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
      setTimeout(() => setIsSorting(false), 200);
    }, 100);
  }, [isSorting]);

  const loadMoreSlots = useCallback(() => {
    const maxLength = viewMode === 'day' ? sortedDayTimes.length : sortedWeekTimes.length;
    setVisibleSlotCount(prev => Math.min(prev + LOAD_MORE_STEP, maxLength));
    if (viewMode === 'day') {
      setExpandedSections(prev => ({ ...prev, dayView: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, weekView: true }));
    }
  }, [sortedDayTimes.length, sortedWeekTimes.length, viewMode, LOAD_MORE_STEP]);

  const loadAllSlots = useCallback(() => {
    const maxLength = viewMode === 'day' ? sortedDayTimes.length : sortedWeekTimes.length;
    setVisibleSlotCount(maxLength);
    if (viewMode === 'day') {
      setExpandedSections(prev => ({ ...prev, dayView: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, weekView: true }));
    }
  }, [sortedDayTimes.length, sortedWeekTimes.length, viewMode]);

  const showLessSlots = useCallback(() => {
    setVisibleSlotCount(WINDOW_SIZE);
    setExpandedSections({ dayView: false, weekView: false });
  }, [WINDOW_SIZE]);

  const expandAll = useCallback(() => {
    setExpandedSections({ dayView: true, weekView: true });
    setVisibleSlotCount(WINDOW_SIZE);
  }, [WINDOW_SIZE]);

  const collapseAll = useCallback(() => {
    setExpandedSections({ dayView: false, weekView: false });
    setVisibleSlotCount(WINDOW_SIZE);
  }, [WINDOW_SIZE]);

  // ============ PAST PREVENTION ============
  
  const isTaskDateTimeInPast = useCallback((dayName, timeStr, dayDate) => {
    const taskDate = new Date(dayDate);
    const [hour, minute] = timeStr.split(':').map(Number);
    taskDate.setHours(hour, minute, 0, 0);
    const now = getNormalizedNow();
    return taskDate.getTime() < now.getTime();
  }, []);

  const handleSlotClick = useCallback((day, time, dayDate) => {
    const currentRealDate = getCurrentRealDate();
    const taskDateNormalized = normalizeDate(dayDate);
    
    if (taskDateNormalized < currentRealDate) {
      console.warn(`Cannot add tasks to past days (${day} ${dayDate.toLocaleDateString()})`);
      return;
    }
    
    if (taskDateNormalized.getTime() === currentRealDate.getTime() && isTaskDateTimeInPast(day, time, dayDate)) {
      console.warn(`Cannot add tasks to past time slots (${time} on ${day})`);
      return;
    }
    
    if (getTaskAtSlot(day, time)) {
      console.warn(`Task already exists at ${time} on ${day}`);
      return;
    }
    
    setSelectedSlot({ day, time });
    setShowSlotModal(true);
  }, [isTaskDateTimeInPast, getTaskAtSlot]);

  const handleAddTaskToSlot = async (taskData) => {
    if (!week || !selectedSlot) return;
    
    const taskDate = getDayDate(selectedSlot.day);
    const currentRealDate = getCurrentRealDate();
    
    if (taskDate < currentRealDate) {
      console.warn(`Cannot add tasks to past days (${selectedSlot.day})`);
      setShowSlotModal(false);
      setSelectedSlot(null);
      return;
    }
    
    if (taskDate.getTime() === currentRealDate.getTime() && isTaskDateTimeInPast(selectedSlot.day, selectedSlot.time, taskDate)) {
      console.warn(`Cannot add tasks to past time slots (${selectedSlot.time} on ${selectedSlot.day})`);
      setShowSlotModal(false);
      setSelectedSlot(null);
      return;
    }
    
    await addTask(week.id, { 
      title: taskData.title, 
      category: taskData.category, 
      subcategory: taskData.subcategory, 
      day: selectedSlot.day, 
      startTime: selectedSlot.time, 
      endTime: taskData.endTime || `${parseInt(selectedSlot.time.split(':')[0]) + 1}:00` 
    });
    await handleRefresh();
    
    setShowSlotModal(false);
    setSelectedSlot(null);
  };

  const handleAddTask = async (taskData) => {
    if (!week) return;
    
    const taskDate = getDayDate(taskData.day);
    const currentRealDate = getCurrentRealDate();
    
    if (taskDate < currentRealDate) {
      console.warn(`Cannot add tasks to past days (${taskData.day}, ${taskDate.toLocaleDateString()})`);
      return;
    }
    
    if (taskDate.getTime() === currentRealDate.getTime() && isTaskDateTimeInPast(taskData.day, taskData.startTime, taskDate)) {
      console.warn(`Cannot add tasks to past time slots (${taskData.startTime} on ${taskData.day})`);
      return;
    }
    
    await addTask(week.id, { 
      title: taskData.title, 
      category: taskData.category, 
      subcategory: taskData.subcategory, 
      day: taskData.day, 
      startTime: taskData.startTime, 
      endTime: taskData.endTime 
    });
    await handleRefresh();
    setShowAddModal(false);
  };

  const handleThemeUpdate = async (newTheme) => { await updateTheme(newTheme); setTheme(newTheme); };

  const handleAddTimeSlot = async () => {
    if (newTimeSlot && !timeSlots.includes(newTimeSlot)) {
      const updatedSlots = [...timeSlots, newTimeSlot].sort();
      await updateTimeSlots(updatedSlots);
      setTimeSlots(updatedSlots);
      setNewTimeSlot('12:00');
      await handleRefresh();
      sortedCacheRef.current = {};
    }
  };

  const handleRemoveTimeSlot = async (slot) => {
    const updatedSlots = timeSlots.filter(s => s !== slot);
    await updateTimeSlots(updatedSlots);
    setTimeSlots(updatedSlots);
    await handleRefresh();
    sortedCacheRef.current = {};
  };

  const handleResetWeek = async () => {
    if (confirm('⚠️ WARNING: This will delete ALL tasks for the current week only.\n\nYour settings and other weeks will remain.\n\nThis action cannot be undone.\n\nAre you sure you want to reset this week?')) {
      setResetting(true);
      try {
        if (week) {
          await deleteAllTasksForWeek(week.id);
          await handleRefresh();
        }
      } catch (error) {
        console.error('Reset week error:', error);
        alert('Failed to reset week. Please try again.');
      } finally {
        setResetting(false);
        setShowFilterMenu(false);
      }
    }
  };

  const handleResetAll = async () => {
    if (confirm('⚠️⚠️⚠️ COMPLETE DATA RESET ⚠️⚠️⚠️\n\nThis will DELETE ALL your tasks, schedules, and analytics for EVERY week.\n\nYou will start completely fresh with no data.\n\nThis action CANNOT be undone!\n\nAre you ABSOLUTELY sure?')) {
      setResetting(true);
      try {
        await resetAllUserData();
        window.location.reload();
      } catch (error) {
        console.error('Reset all error:', error);
        alert('Failed to reset data. Please try again.');
        setResetting(false);
      }
    }
  };

  // FIXED: Loading state with proper background - ALWAYS clears
  if (loading && tasks.length === 0 && !resetting) {
    return (
      <div className="flex justify-center items-center h-96 w-full bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        <p className="ml-2 text-xs text-slate-400">Loading...</p>
      </div>
    );
  }

  // ================================================================
  // MOBILE LITE RENDER
  // ================================================================
  if (isMobileDevice) {
    return (
      <TimeGrid>
        <div className="w-full max-w-full overflow-x-auto pb-20 relative">
          <div className="min-w-[320px] space-y-3">

            {/* Top Bar */}
            <div className="bg-slate-900 rounded-xl p-3 border border-white/10 sticky top-0 z-20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-purple-400" />
                  <div>
                    <p className="text-sm font-mono font-bold text-white">{timeString}</p>
                    <p className="text-[9px] text-slate-400">{dateString}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft size={14} /></button>
                  <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight size={14} /></button>
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
                          <button onClick={toggleSortOrder} disabled={isSorting} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-50">
                            {isSorting ? <><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Sorting...</> : <><ArrowUpDown size={12} /> Sort: {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}</>}
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
                            <RotateCcw size={12} /> Complete Reset (All Data)
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

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="bg-slate-900 border border-white/5 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Score</p><p className="text-sm font-bold text-white">{metrics.weeklyScore || 0}</p></div>
              <div className="bg-slate-900 border border-white/5 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Complete</p><p className="text-sm font-bold text-white">{metrics.completionRate || 0}%</p></div>
              <div className="bg-slate-900 border border-white/5 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Discipline</p><p className="text-sm font-bold text-white">{metrics.disciplineScore || 0}</p></div>
              <div className="bg-slate-900 border border-white/5 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Delay</p><p className="text-sm font-bold text-orange-400">{metrics.avgDelay || 0}m</p></div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-slate-900 border border-white/10 rounded-lg p-2">
              <Calendar size={12} className="text-purple-400" />
              <span className="text-[10px] font-medium text-white">{formatDateRange()}</span>
              <div className="flex gap-1">
                <button onClick={() => setShowThemeModal(true)} className="p-1 hover:bg-white/10 rounded"><Palette size={12} className="text-purple-400" /></button>
                <button onClick={() => setShowTimeSlotModal(true)} className="p-1 hover:bg-white/10 rounded"><Clock size={12} /></button>
              </div>
            </div>

            {/* Day Selector */}
            {viewMode === 'day' && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {DAYS.map((day, idx) => {
                  const date = getDayDate(day);
                  const isToday = date.toDateString() === getCurrentRealDate().toDateString();
                  const isPastDay = isDayInPast(date);
                  const dayTasks = tasksByDay[day] || [];
                  const hasTasks = dayTasks.length > 0;
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (!isPastDay) {
                          setSelectedDay(idx);
                          setVisibleSlotCount(WINDOW_SIZE);
                          setExpandedSections({ dayView: false, weekView: false });
                        }
                      }}
                      disabled={isPastDay}
                      className={`flex-1 min-w-[60px] py-2 rounded-lg text-center transition ${
                        isPastDay ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500' :
                        selectedDay === idx ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      } ${isToday && !isPastDay ? 'border border-purple-500/50' : ''}`}
                    >
                      <div className="text-[10px] font-bold">{day.slice(0, 3)}</div>
                      <div className="text-[8px]">{date.getDate()}</div>
                      {hasTasks && !isPastDay && <div className="w-1 h-1 rounded-full bg-green-500 mx-auto mt-0.5" />}
                      {isPastDay && <div className="text-[6px] text-slate-600 mt-0.5">Past</div>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Time Slots Grid */}
            <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden w-full relative z-10">
              <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-8'} border-b border-white/10 bg-slate-800 w-full`}>
                <div className="p-2 text-center text-[9px] font-bold text-slate-500 uppercase border-r border-white/5">Time</div>
                {viewMode === 'week' && DAYS.map(day => {
                  const date = getDayDate(day);
                  const isPastDay = isDayInPast(date);
                  return (
                    <div key={day} className={`p-2 text-center ${isPastDay ? 'opacity-40' : ''}`}>
                      <div className="text-[10px] font-bold text-white">{day.slice(0, 3)}</div>
                      <div className="text-[8px] text-slate-400">{date.getDate()}</div>
                      {isPastDay && <div className="text-[6px] text-slate-600 mt-0.5">Past</div>}
                    </div>
                  );
                })}
              </div>

              {viewMode === 'day' ? (
                <>
                  {visibleDaySlots.map((time) => {
                    const task = getTaskAtSlot(DAYS[selectedDay], time);
                    const date = getDayDate(DAYS[selectedDay]);
                    const currentRealDate = getCurrentRealDate();
                    const isPast = date < currentRealDate;
                    const canAdd = !isPast && !isTaskDateTimeInPast(DAYS[selectedDay], time, date);
                    return (
                      <div key={time} className={`grid grid-cols-1 border-b border-white/10 relative w-full ${isPast ? 'opacity-50' : ''}`}>
                        <div className="p-1.5 border-r border-white/5 flex items-center justify-between bg-slate-800">
                          <span className="text-[9px] font-mono text-slate-400">{time}</span>
                        </div>
                        <div className="p-0.5 w-full">
                          {task ? (
                            <TaskCell 
                              key={task.id}
                              task={task} 
                              weekId={week?.id} 
                              now={now} 
                              selectedDate={date} 
                              onUpdate={handleRefresh} 
                              theme={theme} 
                              isPast={isPast} 
                              viewMode={viewMode} 
                            />
                          ) : canAdd ? (
                            <div onClick={() => handleSlotClick(DAYS[selectedDay], time, date)} className="h-12 rounded-lg border border-dashed border-white/20 bg-slate-800 flex items-center justify-center active:bg-slate-700 transition cursor-pointer">
                              <Plus size={14} className="text-slate-500" />
                            </div>
                          ) : (
                            <div className="h-12 rounded-lg border border-white/10 bg-slate-800 opacity-30 flex items-center justify-center cursor-not-allowed">
                              <Lock size={10} className="text-slate-600" />
                              {isPast && <span className="text-[8px] text-slate-600 ml-1">Past Day</span>}
                              {!isPast && <span className="text-[8px] text-slate-600 ml-1">Past Time</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {hasMoreSlots && (
                    <div className="flex gap-2 p-2 bg-slate-800 border-t border-white/10">
                      <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-purple-400 transition flex items-center justify-center gap-1 bg-slate-700 rounded-lg">
                        <ChevronDown size={12} /> Load {LOAD_MORE_STEP} More ({sortedDayTimes.length - visibleSlotCount} remaining)
                      </button>
                      <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-slate-400 transition flex items-center justify-center gap-1 bg-slate-700 rounded-lg">
                        Load All ({sortedDayTimes.length})
                      </button>
                    </div>
                  )}

                  {visibleSlotCount > WINDOW_SIZE && (
                    <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-purple-400 transition flex items-center justify-center gap-1 bg-slate-800 border-t border-white/10">
                      <ChevronUp size={12} /> Show Less (back to {WINDOW_SIZE} slots)
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
                      <div key={time} className="grid grid-cols-8 border-b border-white/10 relative w-full">
                        <div className="p-1.5 border-r border-white/5 flex items-center justify-center bg-slate-800">
                          <span className="text-[9px] font-mono text-slate-400">{time}</span>
                        </div>
                        {DAYS.map(day => {
                          const task = getTaskAtSlot(day, time);
                          const date = getDayDate(day);
                          const currentRealDate = getCurrentRealDate();
                          const isPast = date < currentRealDate;
                          const canAdd = !isPast && !isTaskDateTimeInPast(day, time, date);
                          return (
                            <div key={`${day}-${time}`} className={`p-0.5 w-full ${isPast ? 'opacity-50' : ''}`} onClick={() => canAdd && handleSlotClick(day, time, date)}>
                              {task ? (
                                <TaskCell 
                                  key={task.id}
                                  task={task} 
                                  weekId={week?.id} 
                                  now={now} 
                                  selectedDate={date} 
                                  onUpdate={handleRefresh} 
                                  theme={theme} 
                                  isPast={isPast} 
                                  viewMode={viewMode} 
                                />
                              ) : canAdd ? (
                                <div className="h-12 rounded-lg border border-dashed border-white/20 bg-slate-800 flex items-center justify-center active:bg-slate-700 transition cursor-pointer">
                                  <Plus size={12} className="text-slate-500" />
                                </div>
                              ) : (
                                <div className="h-12 rounded-lg border border-white/10 bg-slate-800 opacity-30 flex items-center justify-center cursor-not-allowed">
                                  <Lock size={10} className="text-slate-600" />
                                  {isPast && <span className="text-[8px] text-slate-600 ml-1">Past Day</span>}
                                  {!isPast && <span className="text-[8px] text-slate-600 ml-1">Past Time</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {currentPos && currentPos.slotIndex === timeSlots.indexOf(time) && (
                          <div className="absolute left-0 right-0 pointer-events-none z-10">
                            <div className="h-[1px] bg-red-500 w-full" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {hasMoreWeekSlots && (
                    <div className="flex gap-2 p-2 bg-slate-800 border-t border-white/10">
                      <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-purple-400 transition flex items-center justify-center gap-1 bg-slate-700 rounded-lg">
                        <ChevronDown size={12} /> Load {LOAD_MORE_STEP} More ({sortedWeekTimes.length - visibleSlotCount} remaining)
                      </button>
                      <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-slate-400 transition flex items-center justify-center gap-1 bg-slate-700 rounded-lg">
                        Load All ({sortedWeekTimes.length})
                      </button>
                    </div>
                  )}

                  {visibleSlotCount > WINDOW_SIZE && (
                    <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-purple-400 transition flex items-center justify-center gap-1 bg-slate-800 border-t border-white/10">
                      <ChevronUp size={12} /> Show Less (back to {WINDOW_SIZE} slots)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Empty State */}
            {viewMode === 'day' && currentDayTimes.length === 0 && (
              <div className="bg-slate-900 border border-white/10 rounded-xl p-6 text-center">
                <Calendar size={24} className="text-slate-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No tasks for {DAYS[selectedDay]}</p>
                <button onClick={() => setShowAddModal(true)} className="mt-2 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs">
                  Add Task
                </button>
              </div>
            )}

            {/* Modals */}
            <TaskModal 
              isOpen={showAddModal} 
              onClose={() => setShowAddModal(false)} 
              onSave={handleAddTask} 
              theme={theme}
              day={DAYS[selectedDay]}
              weekStartDate={getWeekStart(selectedDate)}
            />
            
            <TaskModal 
              isOpen={showSlotModal} 
              onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} 
              day={selectedSlot?.day} 
              time={selectedSlot?.time} 
              onSave={handleAddTaskToSlot} 
              theme={theme}
              weekStartDate={getWeekStart(selectedDate)}
            />

            {/* Theme Modal - No backdrop-blur */}
            {showThemeModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-slate-900 rounded-xl p-4 w-80 border border-white/10">
                  <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Theme</h3><button onClick={() => setShowThemeModal(false)}><X size={14} /></button></div>
                  <div className="space-y-2">
                    <div><label className="text-[10px] text-slate-400">Primary</label><input type="color" value={theme.primary} onChange={e => handleThemeUpdate({...theme, primary: e.target.value})} className="w-full h-8 rounded-lg mt-1" /></div>
                    <div><label className="text-[10px] text-slate-400">Secondary</label><input type="color" value={theme.secondary} onChange={e => handleThemeUpdate({...theme, secondary: e.target.value})} className="w-full h-8 rounded-lg mt-1" /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Time Slot Modal - No backdrop-blur */}
            {showTimeSlotModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-slate-900 rounded-xl p-4 w-80 border border-white/10">
                  <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Time Slots</h3><button onClick={() => setShowTimeSlotModal(false)}><X size={14} /></button></div>
                  <div className="flex gap-2 mb-3"><input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="flex-1 p-1.5 text-xs rounded bg-slate-800 border border-white/10" /><button onClick={handleAddTimeSlot} className="px-3 py-1.5 rounded text-xs bg-purple-600">Add</button></div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {timeSlots.map(slot => (
                      <div key={slot} className="flex justify-between items-center p-1.5 rounded bg-slate-800">
                        <span className="text-xs">{slot}</span>
                        <button onClick={() => handleRemoveTimeSlot(slot)} className="text-red-400 text-[9px]">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </TimeGrid>
    );
  }

  // ================================================================
  // DESKTOP RENDER
  // ================================================================
  return (
    <TimeGrid>
      <div className="w-full max-w-full overflow-x-auto pb-20 relative">
        <div className="min-w-[320px] space-y-3">
          {/* Top Bar */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-white/10 sticky top-0 z-20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-purple-400" />
                <div>
                  <p className="text-sm font-mono font-bold text-white">{timeString}:<span className="text-purple-400 font-bold">{seconds.toString().padStart(2, '0')}</span></p>
                  <p className="text-[9px] text-slate-400">{dateString}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronLeft size={14} /></button>
                <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg"><ChevronRight size={14} /></button>
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
                    <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg border border-white/10 shadow-xl z-[100] min-w-[200px] overflow-visible">
                      <div className="py-1">
                        <button onClick={toggleSortOrder} disabled={isSorting} className="w-full px-4 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-50">
                          {isSorting ? <><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Sorting...</> : <><ArrowUpDown size={12} /> Sort: {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}</>}
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
                          <RotateCcw size={12} /> Complete Reset (All Data)
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

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-slate-900/50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Score</p><p className="text-sm font-bold text-white">{metrics.weeklyScore || 0}</p></div>
            <div className="bg-slate-900/50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Complete</p><p className="text-sm font-bold text-white">{metrics.completionRate || 0}%</p></div>
            <div className="bg-slate-900/50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Discipline</p><p className="text-sm font-bold text-white">{metrics.disciplineScore || 0}</p></div>
            <div className="bg-slate-900/50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-slate-400">Delay</p><p className="text-sm font-bold text-orange-400">{metrics.avgDelay || 0}m</p></div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2">
            <Calendar size={12} className="text-purple-400" />
            <span className="text-[10px] font-medium text-white">{formatDateRange()}</span>
            <div className="flex gap-1">
              <button onClick={() => setShowThemeModal(true)} className="p-1 hover:bg-white/10 rounded"><Palette size={12} className="text-purple-400" /></button>
              <button onClick={() => setShowTimeSlotModal(true)} className="p-1 hover:bg-white/10 rounded"><Clock size={12} /></button>
            </div>
          </div>

          {/* Day Selector */}
          {viewMode === 'day' && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {DAYS.map((day, idx) => {
                const date = getDayDate(day);
                const isToday = date.toDateString() === getCurrentRealDate().toDateString();
                const isPastDay = isDayInPast(date);
                const dayTasks = tasksByDay[day] || [];
                const hasTasks = dayTasks.length > 0;
                return (
                  <button
                    key={day}
                    onClick={() => {
                      if (!isPastDay) {
                        setSelectedDay(idx);
                        setVisibleSlotCount(WINDOW_SIZE);
                        setExpandedSections({ dayView: false, weekView: false });
                      }
                    }}
                    disabled={isPastDay}
                    className={`flex-1 min-w-[60px] py-2 rounded-lg text-center transition ${
                      isPastDay ? 'opacity-40 cursor-not-allowed bg-slate-800/30 text-slate-500' :
                      selectedDay === idx ? 'bg-purple-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                    } ${isToday && !isPastDay ? 'border border-purple-500/50' : ''}`}
                  >
                    <div className="text-[10px] font-bold">{day.slice(0, 3)}</div>
                    <div className="text-[8px]">{date.getDate()}</div>
                    {hasTasks && !isPastDay && <div className="w-1 h-1 rounded-full bg-green-500 mx-auto mt-0.5" />}
                    {isPastDay && <div className="text-[6px] text-slate-600 mt-0.5">Past</div>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Time Slots Grid */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden w-full relative z-10">
            <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-8'} border-b border-white/10 bg-slate-900/40 w-full`}>
              <div className="p-2 text-center text-[9px] font-bold text-slate-500 uppercase border-r border-white/5">Time</div>
              {viewMode === 'week' && DAYS.map(day => {
                const date = getDayDate(day);
                const isPastDay = isDayInPast(date);
                return (
                  <div key={day} className={`p-2 text-center ${isPastDay ? 'opacity-40' : ''}`}>
                    <div className="text-[10px] font-bold text-white">{day.slice(0, 3)}</div>
                    <div className="text-[8px] text-slate-400">{date.getDate()}</div>
                    {isPastDay && <div className="text-[6px] text-slate-600 mt-0.5">Past</div>}
                  </div>
                );
              })}
            </div>

            {viewMode === 'day' ? (
              <>
                {visibleDaySlots.map((time) => {
                  const task = getTaskAtSlot(DAYS[selectedDay], time);
                  const date = getDayDate(DAYS[selectedDay]);
                  const currentRealDate = getCurrentRealDate();
                  const isPast = date < currentRealDate;
                  const canAdd = !isPast && !isTaskDateTimeInPast(DAYS[selectedDay], time, date);
                  return (
                    <div key={time} className={`grid grid-cols-1 border-b border-white/10 relative w-full ${isPast ? 'opacity-50' : ''}`}>
                      <div className="p-1.5 border-r border-white/5 flex items-center justify-between bg-slate-900/30">
                        <span className="text-[9px] font-mono text-slate-400">{time}</span>
                      </div>
                      <div className="p-0.5 w-full">
                        {task ? (
                          <TaskCell 
                            key={task.id}
                            task={task} 
                            weekId={week?.id} 
                            now={now} 
                            selectedDate={date} 
                            onUpdate={handleRefresh} 
                            theme={theme} 
                            isPast={isPast} 
                            viewMode={viewMode} 
                          />
                        ) : canAdd ? (
                          <div onClick={() => handleSlotClick(DAYS[selectedDay], time, date)} className="h-12 rounded-lg border border-dashed border-white/20 bg-slate-800/50 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                            <Plus size={14} className="text-slate-500" />
                          </div>
                        ) : (
                          <div className="h-12 rounded-lg border border-white/10 bg-slate-800/50 opacity-30 flex items-center justify-center cursor-not-allowed">
                            <Lock size={10} className="text-slate-600" />
                            {isPast && <span className="text-[8px] text-slate-600 ml-1">Past Day</span>}
                            {!isPast && <span className="text-[8px] text-slate-600 ml-1">Past Time</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {hasMoreSlots && (
                  <div className="flex gap-2 p-2 bg-slate-900/30 border-t border-white/10">
                    <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-purple-500/10 rounded-lg">
                      <ChevronDown size={12} /> Load {LOAD_MORE_STEP} More ({sortedDayTimes.length - visibleSlotCount} remaining)
                    </button>
                    <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-slate-400 hover:text-white transition flex items-center justify-center gap-1 bg-slate-800/50 rounded-lg">
                      Load All ({sortedDayTimes.length})
                    </button>
                  </div>
                )}
                
                {visibleSlotCount > WINDOW_SIZE && (
                  <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-slate-900/30 border-t border-white/10">
                    <ChevronUp size={12} /> Show Less (back to {WINDOW_SIZE} slots)
                  </button>
                )}
              </>
            ) : (
              <>
                {visibleWeekSlots.map((time) => {
                  let hasAnyTask = false;
                  for (let i = 0; i < DAYS.length; i++) {
                    if (getTaskAtSlot(DAYS[i], time)) {
                      hasAnyTask = true;
                      break;
                    }
                  }
                  if (!hasAnyTask) return null;
                  
                  return (
                    <div key={time} className="grid grid-cols-8 border-b border-white/10 relative w-full">
                      <div className="p-1.5 border-r border-white/5 flex items-center justify-center bg-slate-900/30">
                        <span className="text-[9px] font-mono text-slate-400">{time}</span>
                      </div>
                      {DAYS.map(day => {
                        const task = getTaskAtSlot(day, time);
                        const date = getDayDate(day);
                        const currentRealDate = getCurrentRealDate();
                        const isPast = date < currentRealDate;
                        const canAdd = !isPast && !isTaskDateTimeInPast(day, time, date);
                        return (
                          <div key={`${day}-${time}`} className={`p-0.5 w-full ${isPast ? 'opacity-50' : ''}`} onClick={() => canAdd && handleSlotClick(day, time, date)}>
                            {task ? (
                              <TaskCell 
                                key={task.id}
                                task={task} 
                                weekId={week?.id} 
                                now={now} 
                                selectedDate={date} 
                                onUpdate={handleRefresh} 
                                theme={theme} 
                                isPast={isPast} 
                                viewMode={viewMode} 
                              />
                            ) : canAdd ? (
                              <div className="h-12 rounded-lg border border-dashed border-white/20 bg-slate-800/50 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                                <Plus size={12} className="text-slate-500" />
                              </div>
                            ) : (
                              <div className="h-12 rounded-lg border border-white/10 bg-slate-800/50 opacity-30 flex items-center justify-center cursor-not-allowed">
                                <Lock size={10} className="text-slate-600" />
                                {isPast && <span className="text-[8px] text-slate-600 ml-1">Past Day</span>}
                                {!isPast && <span className="text-[8px] text-slate-600 ml-1">Past Time</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {currentPos && currentPos.slotIndex === timeSlots.indexOf(time) && (
                        <div className="absolute left-0 right-0 pointer-events-none z-10">
                          <div className="h-[1px] bg-red-500 w-full" />
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {hasMoreWeekSlots && (
                  <div className="flex gap-2 p-2 bg-slate-900/30 border-t border-white/10">
                    <button onClick={loadMoreSlots} className="flex-1 py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-purple-500/10 rounded-lg">
                      <ChevronDown size={12} /> Load {LOAD_MORE_STEP} More ({sortedWeekTimes.length - visibleSlotCount} remaining)
                    </button>
                    <button onClick={loadAllSlots} className="py-2 px-3 text-center text-[10px] text-slate-400 hover:text-white transition flex items-center justify-center gap-1 bg-slate-800/50 rounded-lg">
                      Load All ({sortedWeekTimes.length})
                    </button>
                  </div>
                )}
                
                {visibleSlotCount > WINDOW_SIZE && (
                  <button onClick={showLessSlots} className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-slate-900/30 border-t border-white/10">
                    <ChevronUp size={12} /> Show Less (back to {WINDOW_SIZE} slots)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Empty State */}
          {viewMode === 'day' && currentDayTimes.length === 0 && (
            <div className="bg-slate-900/50 rounded-xl p-6 text-center">
              <Calendar size={24} className="text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No tasks for {DAYS[selectedDay]}</p>
              <button onClick={() => setShowAddModal(true)} className="mt-2 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs">
                Add Task
              </button>
            </div>
          )}

          {/* Modals */}
          <TaskModal 
            isOpen={showAddModal} 
            onClose={() => setShowAddModal(false)} 
            onSave={handleAddTask} 
            theme={theme}
            day={DAYS[selectedDay]}
            weekStartDate={getWeekStart(selectedDate)}
          />
          
          <TaskModal 
            isOpen={showSlotModal} 
            onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} 
            day={selectedSlot?.day} 
            time={selectedSlot?.time} 
            onSave={handleAddTaskToSlot} 
            theme={theme}
            weekStartDate={getWeekStart(selectedDate)}
          />
          
          {showThemeModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-slate-900 rounded-xl p-4 w-80">
                <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Theme</h3><button onClick={() => setShowThemeModal(false)}><X size={14} /></button></div>
                <div className="space-y-2">
                  <div><label className="text-[10px] text-slate-400">Primary</label><input type="color" value={theme.primary} onChange={e => handleThemeUpdate({...theme, primary: e.target.value})} className="w-full h-8 rounded-lg mt-1" /></div>
                  <div><label className="text-[10px] text-slate-400">Secondary</label><input type="color" value={theme.secondary} onChange={e => handleThemeUpdate({...theme, secondary: e.target.value})} className="w-full h-8 rounded-lg mt-1" /></div>
                </div>
              </div>
            </div>
          )}
          
          {showTimeSlotModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-slate-900 rounded-xl p-4 w-80">
                <div className="flex justify-between mb-3"><h3 className="text-sm font-bold text-white">Time Slots</h3><button onClick={() => setShowTimeSlotModal(false)}><X size={14} /></button></div>
                <div className="flex gap-2 mb-3"><input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="flex-1 p-1.5 text-xs rounded bg-slate-800 border border-white/10" /><button onClick={handleAddTimeSlot} className="px-3 py-1.5 rounded text-xs bg-purple-600">Add</button></div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {timeSlots.map(slot => (
                    <div key={slot} className="flex justify-between items-center p-1.5 rounded bg-slate-800/50">
                      <span className="text-xs">{slot}</span>
                      <button onClick={() => handleRemoveTimeSlot(slot)} className="text-red-400 text-[9px]">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TimeGrid>
  );
}