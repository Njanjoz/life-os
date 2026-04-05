import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar, TrendingUp, Target, Zap, ChevronLeft, ChevronRight, Plus, X, Palette, Clock, Sparkles, Lock, Grid, List, ChevronDown, ChevronUp, ArrowUpDown, RotateCcw, Filter, Trash2 } from 'lucide-react';
import TaskCell from '../TaskCell/TaskCell';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, checkMissedTasks, getBestFocusHours, getTheme, updateTheme, getTimeSlots, updateTimeSlots, resetAllUserData, deleteAllTasksForWeek } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';
import { notifyUpcomingTask, notifyTaskOverdue, requestNotificationPermission } from '../../services/notificationService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeekView() {
  const { user } = useAuth();
  const { now, timeString, dateString, isTimePast, isDayPast, getCurrentTimePosition: getClockPosition } = useRealTimeClock(1000);
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [expandedSections, setExpandedSections] = useState({});
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isLoadingRef = useRef(false);
  const notifiedTasksRef = useRef(new Set());
  const notificationIntervalRef = useRef(null);

  const loadWeek = useCallback(async () => {
    if (isLoadingRef.current || !user) return;
    isLoadingRef.current = true;
    try {
      const currentWeek = await getCurrentWeek(selectedDate);
      setWeek(currentWeek);
      const weekTasks = await getWeekTasks(currentWeek.id);
      const activeTasks = weekTasks.filter(t => 
        t.status !== 'rescheduled' && 
        t.status !== 'rescheduled_with_progress' &&
        !t.rescheduledTo
      );
      setTasks(activeTasks);
      setMetrics(currentWeek.metrics || {});
      const savedTheme = await getTheme();
      if (savedTheme) setTheme(savedTheme);
      const savedTimeSlots = await getTimeSlots();
      const taskTimes = [...new Set(activeTasks.map(t => t.startTime))].sort();
      const allSlots = taskTimes.length > 0 ? taskTimes : savedTimeSlots;
      setTimeSlots(allSlots);
      await checkMissedTasks(currentWeek.id, selectedDate);
      const updatedMetrics = await updateWeekMetrics(currentWeek.id);
      if (updatedMetrics) setMetrics(updatedMetrics);
      const hours = await getBestFocusHours();
      setBestHours(hours);
    } catch (error) {
      console.error('Load week error:', error);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => { if (user) loadWeek(); }, [user, loadWeek, refreshKey]);

  // ============ OPTIMIZED NOTIFICATION SYSTEM ============
  useEffect(() => {
    if (!user || !tasks.length) return;
    
    requestNotificationPermission();
    notifiedTasksRef.current.clear();
    
    // Clear existing interval if any
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
    }
    
    notificationIntervalRef.current = setInterval(() => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDayIndex = now.getDay();
      const currentDay = DAYS[currentDayIndex === 0 ? 6 : currentDayIndex - 1];
      
      // OPTIMIZATION: Only filter today's tasks once
      const todayTasks = tasks.filter(task => 
        task.day === currentDay && 
        task.status === 'pending'
      );
      
      if (todayTasks.length === 0) return;
      
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;
      
      // OPTIMIZATION: Process tasks without creating Date objects repeatedly
      for (const task of todayTasks) {
        const [startHour, startMinute] = task.startTime.split(':').map(Number);
        const [endHour, endMinute] = task.endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        const minutesUntilStart = startMinutes - currentMinutes;
        const minutesSinceEnd = currentMinutes - endMinutes;
        
        const taskId = task.id;
        
        // Task starting NOW (within 1 minute)
        if (minutesUntilStart <= 1 && minutesUntilStart >= -1) {
          if (!notifiedTasksRef.current.has(`${taskId}-now`)) {
            notifyUpcomingTask(task.title, task.startTime, 0);
            notifiedTasksRef.current.add(`${taskId}-now`);
          }
        }
        
        // Task starting in 5 minutes (exact match to prevent spam)
        if (minutesUntilStart === 5 || (minutesUntilStart > 4 && minutesUntilStart < 6)) {
          if (!notifiedTasksRef.current.has(`${taskId}-5min`)) {
            notifyUpcomingTask(task.title, task.startTime, 5);
            notifiedTasksRef.current.add(`${taskId}-5min`);
          }
        }
        
        // Task starting in 10 minutes
        if (minutesUntilStart === 10 || (minutesUntilStart > 9 && minutesUntilStart < 11)) {
          if (!notifiedTasksRef.current.has(`${taskId}-10min`)) {
            notifyUpcomingTask(task.title, task.startTime, 10);
            notifiedTasksRef.current.add(`${taskId}-10min`);
          }
        }
        
        // Task is overdue
        if (minutesSinceEnd > 0 && !notifiedTasksRef.current.has(`${taskId}-overdue`)) {
          notifyTaskOverdue(task.title, task.endTime);
          notifiedTasksRef.current.add(`${taskId}-overdue`);
        }
      }
    }, 60000);
    
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [user, tasks.length]); // Only depend on tasks.length, not full tasks array

  const handleRefresh = useCallback(async () => { 
    setRefreshKey(prev => prev + 1);
    notifiedTasksRef.current.clear();
  }, []);

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
    notifiedTasksRef.current.clear();
  };

  const getTaskAtSlot = useCallback((day, time) => {
    return tasks.find(t => t.day === day && t.startTime === time);
  }, [tasks]);

  const handleSlotClick = (day, time, dayDate) => {
    if (isDayPast(day) || isTimePast(day, time, dayDate)) return;
    if (getTaskAtSlot(day, time)) return;
    setSelectedSlot({ day, time });
    setShowSlotModal(true);
  };

  const handleAddTaskToSlot = async (taskData) => {
    if (week && selectedSlot) {
      await addTask(week.id, { 
        title: taskData.title, 
        category: taskData.category, 
        subcategory: taskData.subcategory, 
        day: selectedSlot.day, 
        startTime: selectedSlot.time, 
        endTime: taskData.endTime || `${parseInt(selectedSlot.time.split(':')[0]) + 1}:00` 
      });
      await handleRefresh();
    }
    setShowSlotModal(false);
    setSelectedSlot(null);
  };

  const handleAddTask = async (taskData) => {
    if (week) {
      await addTask(week.id, { 
        title: taskData.title, 
        category: taskData.category, 
        subcategory: taskData.subcategory, 
        day: taskData.day, 
        startTime: taskData.startTime, 
        endTime: taskData.endTime 
      });
      await handleRefresh();
    }
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
    }
  };

  const handleRemoveTimeSlot = async (slot) => {
    const updatedSlots = timeSlots.filter(s => s !== slot);
    await updateTimeSlots(updatedSlots);
    setTimeSlots(updatedSlots);
    await handleRefresh();
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

  const getDayDate = useCallback((dayName) => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    const dayIndex = DAYS.indexOf(dayName);
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return targetDate;
  }, [selectedDate]);

  const formatDateRange = useCallback(() => {
    const startOfWeek = new Date(selectedDate);
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

  const isDayPastForDate = useCallback((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  }, []);

  const currentPos = getCurrentTimePosition();
  
  // OPTIMIZATION: Memoize filtered tasks
  const currentDayTasks = useMemo(() => 
    tasks.filter(t => t.day === DAYS[selectedDay]), 
    [tasks, selectedDay]
  );
  
  // OPTIMIZATION: Memoize time slots calculations
  const currentDayTimes = useMemo(() => 
    [...new Set(currentDayTasks.map(t => t.startTime))].sort(),
    [currentDayTasks]
  );

  const getSortedTimeSlots = useCallback((slots) => {
    if (sortOrder === 'asc') {
      return [...slots].sort();
    } else {
      return [...slots].sort().reverse();
    }
  }, [sortOrder]);

  // OPTIMIZATION: Memoize sorted time slots
  const sortedDayTimes = useMemo(() => 
    getSortedTimeSlots(currentDayTimes),
    [getSortedTimeSlots, currentDayTimes]
  );
  
  const sortedWeekTimes = useMemo(() => 
    getSortedTimeSlots(timeSlots),
    [getSortedTimeSlots, timeSlots]
  );

  const getCurrentTimeSlotIndex = useCallback(() => {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    return sortedDayTimes.findIndex(slot => {
      const [hour, minute] = slot.split(':').map(Number);
      return hour * 60 + minute >= currentTime;
    });
  }, [now, sortedDayTimes]);

  const currentSlotIndex = getCurrentTimeSlotIndex();
  const visibleCount = 3;
  const startIndex = Math.max(0, currentSlotIndex - 1);

  // OPTIMIZATION: Memoize visible time slots
  const visibleDaySlots = useMemo(() => {
    if (expandedSections['dayView'] || sortedDayTimes.length <= visibleCount) {
      return sortedDayTimes;
    }
    return sortedDayTimes.slice(startIndex, startIndex + visibleCount);
  }, [expandedSections, sortedDayTimes, startIndex, visibleCount]);

  const visibleWeekSlots = useMemo(() => {
    if (expandedSections['weekView'] || sortedWeekTimes.length <= visibleCount) {
      return sortedWeekTimes;
    }
    return sortedWeekTimes.slice(0, visibleCount);
  }, [expandedSections, sortedWeekTimes, visibleCount]);

  const hasMoreSlots = sortedDayTimes.length > visibleCount && !expandedSections['dayView'];
  const hasMoreWeekSlots = sortedWeekTimes.length > visibleCount && !expandedSections['weekView'];

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const expandAll = () => {
    setExpandedSections({ dayView: true, weekView: true });
  };

  const collapseAll = () => {
    setExpandedSections({ dayView: false, weekView: false });
  };

  if (loading && tasks.length === 0 && !resetting) {
    return <div className="flex justify-center items-center h-96 w-full"><div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div><p className="ml-2 text-xs text-slate-400">Loading...</p></div>;
  }

  return (
    <div className="w-full max-w-full overflow-x-auto pb-20">
      <div className="min-w-[320px] space-y-3">
        {/* Top Bar */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-3 border border-white/10">
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
              <div className="relative">
                <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition">
                  <Filter size={14} />
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-slate-800 rounded-lg border border-white/10 shadow-lg z-20 min-w-[180px]">
                    <button onClick={toggleSortOrder} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                      <ArrowUpDown size={12} />
                      Sort: {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}
                    </button>
                    <button onClick={expandAll} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                      <ChevronDown size={12} />
                      Expand All
                    </button>
                    <button onClick={collapseAll} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition flex items-center gap-2">
                      <ChevronUp size={12} />
                      Collapse All
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button onClick={handleResetWeek} disabled={resetting} className="w-full px-3 py-2 text-left text-xs text-yellow-400 hover:bg-yellow-500/10 transition flex items-center gap-2">
                      <Trash2 size={12} />
                      Reset This Week
                    </button>
                    <button onClick={handleResetAll} disabled={resetting} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 transition flex items-center gap-2">
                      <RotateCcw size={12} />
                      Complete Reset (All Data)
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <p className="text-[8px] text-slate-400">Score</p>
            <p className="text-sm font-bold text-white">{metrics.weeklyScore || 0}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <p className="text-[8px] text-slate-400">Complete</p>
            <p className="text-sm font-bold text-white">{metrics.completionRate || 0}%</p>
          </div>
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <p className="text-[8px] text-slate-400">Discipline</p>
            <p className="text-sm font-bold text-white">{metrics.disciplineScore || 0}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-1.5 text-center">
            <p className="text-[8px] text-slate-400">Delay</p>
            <p className="text-sm font-bold text-orange-400">{metrics.avgDelay || 0}m</p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-white/5 rounded-lg p-2">
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
              const isToday = date.toDateString() === new Date().toDateString();
              const dayTasks = tasks.filter(t => t.day === day);
              const hasTasks = dayTasks.length > 0;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(idx)}
                  className={`flex-1 min-w-[60px] py-2 rounded-lg text-center transition ${selectedDay === idx ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'} ${isToday ? 'border border-purple-500/50' : ''}`}
                >
                  <div className="text-[10px] font-bold">{day.slice(0, 3)}</div>
                  <div className="text-[8px]">{date.getDate()}</div>
                  {hasTasks && <div className="w-1 h-1 rounded-full bg-green-500 mx-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Time Slots Grid */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden w-full">
          <div className={`grid ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-8'} border-b border-white/10 bg-white/5 w-full`}>
            <div className="p-2 text-center text-[9px] font-bold text-slate-500 uppercase border-r border-white/5">Time</div>
            {viewMode === 'week' && DAYS.map(day => {
              const date = getDayDate(day);
              return (
                <div key={day} className="p-2 text-center">
                  <div className="text-[10px] font-bold text-white">{day.slice(0, 3)}</div>
                  <div className="text-[8px] text-slate-400">{date.getDate()}</div>
                </div>
              );
            })}
          </div>

          {viewMode === 'day' ? (
            <>
              {visibleDaySlots.map((time) => {
                const task = getTaskAtSlot(DAYS[selectedDay], time);
                const date = getDayDate(DAYS[selectedDay]);
                const isPast = isDayPastForDate(date);
                const canAdd = !isPast && !isTimePast(DAYS[selectedDay], time, date);
                return (
                  <div key={time} className="grid grid-cols-1 border-b border-white/10 relative w-full">
                    <div className="p-1.5 border-r border-white/5 flex items-center justify-between bg-white/5">
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
                        <div onClick={() => handleSlotClick(DAYS[selectedDay], time, date)} className="h-12 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                          <Plus size={14} className="text-slate-500" />
                        </div>
                      ) : (
                        <div className="h-12 rounded-lg border border-white/10 bg-white/5 opacity-30 flex items-center justify-center">
                          <Lock size={10} className="text-slate-600" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {hasMoreSlots && (
                <button
                  onClick={() => toggleSection('dayView')}
                  className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-white/5 border-t border-white/10"
                >
                  <ChevronDown size={12} /> Show More ({sortedDayTimes.length - visibleCount} more time slots)
                </button>
              )}
              {expandedSections['dayView'] && sortedDayTimes.length > visibleCount && (
                <button
                  onClick={() => toggleSection('dayView')}
                  className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-white/5 border-t border-white/10"
                >
                  <ChevronUp size={12} /> Show Less
                </button>
              )}
            </>
          ) : (
            <>
              {visibleWeekSlots.map((time) => {
                const hasTasks = DAYS.some(day => getTaskAtSlot(day, time));
                if (!hasTasks) return null;
                
                return (
                  <div key={time} className="grid grid-cols-8 border-b border-white/10 relative w-full">
                    <div className="p-1.5 border-r border-white/5 flex items-center justify-center bg-white/5">
                      <span className="text-[9px] font-mono text-slate-400">{time}</span>
                    </div>
                    {DAYS.map(day => {
                      const task = getTaskAtSlot(day, time);
                      const date = getDayDate(day);
                      const isPast = isDayPastForDate(date);
                      const canAdd = !isPast && !isTimePast(day, time, date);
                      return (
                        <div key={`${day}-${time}`} className="p-0.5 w-full" onClick={() => canAdd && handleSlotClick(day, time, date)}>
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
                            <div className="h-12 rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer">
                              <Plus size={12} className="text-slate-500" />
                            </div>
                          ) : (
                            <div className="h-12 rounded-lg border border-white/10 bg-white/5 opacity-30 flex items-center justify-center">
                              <Lock size={10} className="text-slate-600" />
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
                <button
                  onClick={() => toggleSection('weekView')}
                  className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-white/5 border-t border-white/10"
                >
                  <ChevronDown size={12} /> Show More ({sortedWeekTimes.length - visibleCount} more time slots)
                </button>
              )}
              {expandedSections['weekView'] && sortedWeekTimes.length > visibleCount && (
                <button
                  onClick={() => toggleSection('weekView')}
                  className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1 bg-white/5 border-t border-white/10"
                >
                  <ChevronUp size={12} /> Show Less
                </button>
              )}
            </>
          )}
        </div>

        {/* Empty State */}
        {viewMode === 'day' && currentDayTimes.length === 0 && (
          <div className="bg-white/5 rounded-xl p-6 text-center">
            <Calendar size={24} className="text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No tasks for {DAYS[selectedDay]}</p>
            <button onClick={() => setShowAddModal(true)} className="mt-2 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs">Add Task</button>
          </div>
        )}

        {/* Modals */}
        <TaskModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAddTask} theme={theme} />
        <TaskModal isOpen={showSlotModal} onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} day={selectedSlot?.day} time={selectedSlot?.time} onSave={handleAddTaskToSlot} theme={theme} />
        
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
  );
}