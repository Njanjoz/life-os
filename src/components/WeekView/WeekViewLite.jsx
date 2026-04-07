// WeekViewLite.jsx - All features, mobile-optimized rendering
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, TrendingUp, Target, Zap, ChevronLeft, ChevronRight, Plus, X, Palette, Clock, Sparkles, Lock, Grid, List, ChevronDown, ChevronUp, ArrowUpDown, RotateCcw, Filter, Trash2, CheckCircle, Circle } from 'lucide-react';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, checkMissedTasks, getBestFocusHours, getTheme, updateTheme, getTimeSlots, updateTimeSlots, resetAllUserData, deleteAllTasksForWeek, updateTaskStatus } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Ultra-light TaskCell for mobile
const MobileTaskCell = React.memo(({ task, weekId, onUpdate, isPast }) => {
  const [status, setStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    if (isUpdating || isPast) return;
    const newStatus = status === 'completed' ? 'pending' : 'completed';
    setIsUpdating(true);
    setStatus(newStatus);
    try {
      await updateTaskStatus(weekId, task.id, newStatus);
      onUpdate();
    } catch (error) {
      setStatus(status);
      console.error('Failed to update task:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isPast) {
    return (
      <div className="bg-slate-800/30 rounded-lg p-2 opacity-40">
        <p className="text-xs text-slate-400 line-through truncate">{task.title}</p>
        <p className="text-[9px] text-slate-500">{task.startTime}</p>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-lg p-2 transition-all duration-150 ${
        status === 'completed' 
          ? 'bg-green-500/20 border border-green-500/30' 
          : 'bg-slate-800/50 hover:bg-slate-700/50'
      }`}
      onClick={handleToggle}
    >
      <div className="flex items-start gap-2">
        {status === 'completed' ? (
          <CheckCircle size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Circle size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs truncate ${status === 'completed' ? 'line-through text-slate-400' : 'text-white'}`}>
            {task.title}
          </p>
          <p className="text-[9px] text-slate-400">{task.startTime}</p>
        </div>
      </div>
    </div>
  );
});

// Lite Time Grid - only renders what's visible
const LiteTimeGrid = ({ timeSlots, tasksByDay, getTaskAtSlot, getDayDate, handleSlotClick, week, onUpdate, theme, isPastDay }) => {
  const [visibleCount, setVisibleCount] = useState(5);
  const visibleSlots = timeSlots.slice(0, visibleCount);
  const hasMore = timeSlots.length > visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 3, timeSlots.length));
  };

  return (
    <div className="space-y-1">
      {visibleSlots.map(time => {
        let hasAnyTask = false;
        for (let day of DAYS) {
          if (getTaskAtSlot(day, time)) {
            hasAnyTask = true;
            break;
          }
        }
        
        if (!hasAnyTask) return null;
        
        return (
          <div key={time} className="bg-slate-900/30 rounded-lg overflow-hidden">
            <div className="bg-slate-800/50 px-2 py-1">
              <span className="text-[10px] font-mono text-purple-400">{time}</span>
            </div>
            <div className="grid grid-cols-7 gap-0.5 p-1">
              {DAYS.map((day, idx) => {
                const task = getTaskAtSlot(day, time);
                const date = getDayDate(day);
                const isPast = isPastDay(date);
                
                return (
                  <div key={day} className="min-h-[60px]">
                    {task ? (
                      <MobileTaskCell 
                        task={task} 
                        weekId={week?.id} 
                        onUpdate={onUpdate} 
                        isPast={isPast}
                      />
                    ) : !isPast ? (
                      <div 
                        onClick={() => handleSlotClick(day, time, date)}
                        className="h-full min-h-[60px] rounded-lg border border-dashed border-white/20 bg-slate-800/30 flex items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/10 transition cursor-pointer"
                      >
                        <Plus size={12} className="text-slate-500" />
                      </div>
                    ) : (
                      <div className="h-full min-h-[60px] rounded-lg bg-slate-800/30 opacity-30 flex items-center justify-center">
                        <Lock size={10} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {hasMore && (
        <button 
          onClick={loadMore}
          className="w-full py-2 text-center text-[10px] text-purple-400 hover:text-purple-300 transition bg-slate-800/50 rounded-lg"
        >
          Load More ({timeSlots.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
};

export default function WeekViewLite() {
  const { user } = useAuth();
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [theme, setTheme] = useState({ primary: '#a855f7', secondary: '#3b82f6' });
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('week');
  const [resetting, setResetting] = useState(false);
  
  const filterButtonRef = useRef(null);

  const { timeString, dateString } = useRealTimeClock(10000); // Update every 10 seconds on mobile

  // Normalize date
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getCurrentRealDate = () => normalizeDate(new Date());

  const isPastDay = (date) => {
    return normalizeDate(date) < getCurrentRealDate();
  };

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

  const getWeekStart = (date) => {
    const d = normalizeDate(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    return d;
  };

  const formatDateRange = useCallback(() => {
    const startOfWeek = getWeekStart(selectedDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;
  }, [selectedDate]);

  // Load data
  const loadWeek = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const currentWeek = await getCurrentWeek(selectedDate);
      setWeek(currentWeek);
      
      const weekTasks = await getWeekTasks(currentWeek.id);
      const activeTasks = weekTasks.filter(t => t.status !== 'rescheduled' && t.status !== 'rescheduled_with_progress');
      setTasks(activeTasks);
      
      setMetrics(currentWeek.metrics || {});
      
      const savedTheme = await getTheme();
      if (savedTheme) setTheme(savedTheme);
      
      const savedTimeSlots = await getTimeSlots();
      const taskTimes = [...new Set(activeTasks.map(t => t.startTime))].sort();
      setTimeSlots(taskTimes.length > 0 ? taskTimes : savedTimeSlots);
      
      await checkMissedTasks(currentWeek.id, selectedDate);
      await updateWeekMetrics(currentWeek.id);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Process tasks by day
  const tasksByDay = useMemo(() => {
    const byDay = {};
    for (let day of DAYS) byDay[day] = [];
    for (let task of tasks) {
      if (byDay[task.day]) byDay[task.day].push(task);
    }
    return byDay;
  }, [tasks]);

  const taskMap = useMemo(() => {
    const map = {};
    for (let task of tasks) {
      map[`${task.day}-${task.startTime}`] = task;
    }
    return map;
  }, [tasks]);

  const getTaskAtSlot = useCallback((day, time) => {
    return taskMap[`${day}-${time}`];
  }, [taskMap]);

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(normalizeDate(newDate));
  };

  const handleRefresh = () => {
    loadWeek();
  };

  const handleAddTask = async (taskData) => {
    if (!week) return;
    await addTask(week.id, taskData);
    handleRefresh();
    setShowAddModal(false);
  };

  const handleSlotClick = (day, time, dayDate) => {
    if (isPastDay(dayDate)) return;
    if (getTaskAtSlot(day, time)) return;
    setSelectedSlot({ day, time });
    setShowSlotModal(true);
  };

  const handleAddTaskToSlot = async (taskData) => {
    if (!week || !selectedSlot) return;
    await addTask(week.id, {
      title: taskData.title,
      category: taskData.category,
      subcategory: taskData.subcategory,
      day: selectedSlot.day,
      startTime: selectedSlot.time,
      endTime: taskData.endTime || selectedSlot.time
    });
    handleRefresh();
    setShowSlotModal(false);
    setSelectedSlot(null);
  };

  const handleResetWeek = async () => {
    if (confirm('Delete ALL tasks for this week?')) {
      setResetting(true);
      try {
        if (week) await deleteAllTasksForWeek(week.id);
        handleRefresh();
      } finally {
        setResetting(false);
      }
    }
  };

  const sortedTimeSlots = useMemo(() => {
    return sortOrder === 'asc' ? [...timeSlots].sort() : [...timeSlots].sort().reverse();
  }, [timeSlots, sortOrder]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Header */}
      <div className="bg-slate-900/80 rounded-xl p-3 border border-white/10 sticky top-0 z-20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-purple-400" />
            <div>
              <p className="text-xs font-mono font-bold text-white">{timeString}</p>
              <p className="text-[8px] text-slate-400">{dateString}</p>
            </div>
          </div>
          
          <div className="flex gap-1">
            <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-white/10 rounded-lg">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-white/10 rounded-lg">
              <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="flex gap-1">
            <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-lg transition ${viewMode === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>
              <Grid size={14} />
            </button>
            <div className="relative" ref={filterButtonRef}>
              <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="p-1.5 rounded-lg text-slate-400">
                <Filter size={14} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg border border-white/10 shadow-xl z-[100] min-w-[160px]">
                  <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2">
                    <ArrowUpDown size={12} /> Sort: {sortOrder === 'asc' ? 'Earliest' : 'Latest'}
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button onClick={handleResetWeek} disabled={resetting} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                    <Trash2 size={12} /> Reset Week
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg bg-purple-600">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row - Compact */}
      <div className="grid grid-cols-4 gap-1">
        <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
          <p className="text-[8px] text-slate-400">Score</p>
          <p className="text-sm font-bold text-white">{metrics.weeklyScore || 0}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
          <p className="text-[8px] text-slate-400">Complete</p>
          <p className="text-sm font-bold text-white">{metrics.completionRate || 0}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
          <p className="text-[8px] text-slate-400">Discipline</p>
          <p className="text-sm font-bold text-white">{metrics.disciplineScore || 0}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
          <p className="text-[8px] text-slate-400">Delay</p>
          <p className="text-sm font-bold text-orange-400">{metrics.avgDelay || 0}m</p>
        </div>
      </div>

      {/* Week Range */}
      <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2">
        <Calendar size={12} className="text-purple-400" />
        <span className="text-[10px] font-medium text-white">{formatDateRange()}</span>
      </div>

      {/* Time Grid */}
      <LiteTimeGrid 
        timeSlots={sortedTimeSlots}
        tasksByDay={tasksByDay}
        getTaskAtSlot={getTaskAtSlot}
        getDayDate={getDayDate}
        handleSlotClick={handleSlotClick}
        week={week}
        onUpdate={handleRefresh}
        theme={theme}
        isPastDay={isPastDay}
      />

      {/* Modals */}
      <TaskModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSave={handleAddTask} 
        theme={theme}
      />
      
      <TaskModal 
        isOpen={showSlotModal} 
        onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} 
        day={selectedSlot?.day} 
        time={selectedSlot?.time} 
        onSave={handleAddTaskToSlot} 
        theme={theme}
      />
    </div>
  );
}