// WeekViewMobile.jsx - Ultra Lite for Mobile Chrome
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, Lock, ChevronDown, ChevronUp, ArrowUpDown, Filter, Trash2, CheckCircle, Circle } from 'lucide-react';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { 
  getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, checkMissedTasks, 
  getTheme, updateTheme, getTimeSlots, updateTimeSlots, resetAllUserData, 
  deleteAllTasksForWeek, completeTask 
} from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Ultra-light Task component using existing completeTask function
const MobileTask = React.memo(({ task, weekId, onUpdate, isPast }) => {
  const [status, setStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (isUpdating || isPast) return;
    
    setIsUpdating(true);
    
    try {
      if (status !== 'completed') {
        // Use existing completeTask function
        await completeTask(task.id);
      }
      onUpdate(); // Refresh the view
    } catch (error) {
      console.error('Error toggling task:', error);
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
      className={`rounded-lg p-2 transition-colors duration-150 ${
        status === 'completed' 
          ? 'bg-green-500/20 border border-green-500/30' 
          : 'bg-slate-800/50 active:bg-slate-700/50'
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

export default function WeekViewMobile() {
  const { user } = useAuth();
  
  // State
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
  const [sortOrder, setSortOrder] = useState('asc');
  const [visibleCount, setVisibleCount] = useState(4);
  const [resetting, setResetting] = useState(false);
  
  const filterButtonRef = useRef(null);
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  const { timeString, dateString } = useRealTimeClock(30000); // Update every 30 seconds on mobile

  // Helpers
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getCurrentRealDate = () => normalizeDate(new Date());

  const isPastDay = (date) => normalizeDate(date) < getCurrentRealDate();

  const getWeekStart = (date) => {
    const d = normalizeDate(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    return d;
  };

  const getDayDate = useCallback((dayName) => {
    const startOfWeek = getWeekStart(selectedDate);
    const dayIndex = DAYS.indexOf(dayName);
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return normalizeDate(targetDate);
  }, [selectedDate]);

  const formatDateRange = () => {
    const startOfWeek = getWeekStart(selectedDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;
  };

  // Load data
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
      
      const activeTasks = weekTasks.filter(t => 
        t.status !== 'rescheduled' && t.status !== 'rescheduled_with_progress' && !t.rescheduledTo
      );
      setTasks(activeTasks);
      setMetrics(currentWeek.metrics || {});
      
      const savedTimeSlots = await getTimeSlots();
      const taskTimes = [...new Set(activeTasks.map(t => t.startTime))].sort();
      setTimeSlots(taskTimes.length > 0 ? taskTimes : savedTimeSlots);
      
      await checkMissedTasks(currentWeek.id, selectedDate);
      await updateWeekMetrics(currentWeek.id);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      if (isMountedRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [user, selectedDate]);

  useEffect(() => {
    isMountedRef.current = true;
    loadWeek();
    return () => { isMountedRef.current = false; };
  }, [loadWeek]);

  // Process tasks for quick lookup
  const taskMap = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      map[`${task.day}-${task.startTime}`] = task;
    }
    return map;
  }, [tasks]);

  const getTaskAtSlot = useCallback((day, time) => taskMap[`${day}-${time}`], [taskMap]);

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(normalizeDate(newDate));
    setVisibleCount(4);
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
        setShowFilterMenu(false);
      }
    }
  };

  // Sort time slots
  const sortedTimeSlots = useMemo(() => {
    return sortOrder === 'asc' ? [...timeSlots].sort() : [...timeSlots].sort().reverse();
  }, [timeSlots, sortOrder]);

  const visibleSlots = sortedTimeSlots.slice(0, visibleCount);
  const hasMore = sortedTimeSlots.length > visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + 3, sortedTimeSlots.length));
  };

  const showLess = () => {
    setVisibleCount(4);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-20">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-white/10 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-purple-400" />
            <p className="text-xs font-mono font-bold text-white">{timeString}</p>
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
            <div className="relative" ref={filterButtonRef}>
              <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="p-1.5 rounded-lg text-slate-400">
                <Filter size={14} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-2 bg-slate-800 rounded-lg border border-white/10 shadow-xl z-[100] min-w-[140px]">
                  <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2">
                    <ArrowUpDown size={12} /> {sortOrder === 'asc' ? 'Earliest' : 'Latest'}
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
        <div className="text-[8px] text-slate-400 mt-1 text-center">{dateString}</div>
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
        <span className="text-[9px] font-medium text-white">{formatDateRange()}</span>
      </div>

      {/* Time Slots Grid - Simplified */}
      <div className="space-y-1">
        {visibleSlots.map(time => {
          // Check if any task exists for this time
          let hasAnyTask = false;
          for (const day of DAYS) {
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
                {DAYS.map((day) => {
                  const task = getTaskAtSlot(day, time);
                  const date = getDayDate(day);
                  const isPast = isPastDay(date);
                  
                  return (
                    <div key={day} className="min-h-[60px]">
                      {task ? (
                        <MobileTask 
                          task={task} 
                          weekId={week?.id} 
                          onUpdate={handleRefresh} 
                          isPast={isPast}
                        />
                      ) : !isPast ? (
                        <div 
                          onClick={() => handleSlotClick(day, time, date)}
                          className="h-full min-h-[60px] rounded-lg border border-dashed border-white/20 bg-slate-800/30 flex items-center justify-center active:border-purple-500/50 active:bg-purple-500/10 transition cursor-pointer"
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
            <ChevronDown size={12} className="inline mr-1" />
            Load More ({sortedTimeSlots.length - visibleCount} remaining)
          </button>
        )}
        
        {visibleCount > 4 && (
          <button 
            onClick={showLess}
            className="w-full py-2 text-center text-[10px] text-slate-400 hover:text-white transition bg-slate-800/50 rounded-lg"
          >
            <ChevronUp size={12} className="inline mr-1" />
            Show Less
          </button>
        )}
      </div>

      {/* Modals */}
      <TaskModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSave={handleAddTask} 
        day={DAYS[0]}
        weekStartDate={getWeekStart(selectedDate)}
      />
      
      <TaskModal 
        isOpen={showSlotModal} 
        onClose={() => { setShowSlotModal(false); setSelectedSlot(null); }} 
        day={selectedSlot?.day} 
        time={selectedSlot?.time} 
        onSave={handleAddTaskToSlot}
        weekStartDate={getWeekStart(selectedDate)}
      />
    </div>
  );
}