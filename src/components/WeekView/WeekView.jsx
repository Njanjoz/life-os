import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, TrendingUp, Target, Zap, ChevronLeft, ChevronRight, Plus, X, Palette, Clock, Sparkles, Lock } from 'lucide-react';
import { TaskCell } from '../TaskCell/TaskCell';
import { TaskModal } from '../TaskModal/TaskModal';
import { useRealTimeClock } from '../../hooks/useRealTimeClock';
import { 
  getCurrentWeek, getWeekTasks, addTask, updateWeekMetrics, 
  checkMissedTasks, getBestFocusHours, getTheme, updateTheme,
  getTimeSlots, updateTimeSlots
} from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeekView = () => {
  const { user } = useAuth();
  const { now, timeString, dateString, isTimePast, isDayPast, getCurrentTimePosition: getClockPosition } = useRealTimeClock();
  const [week, setWeek] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [theme, setTheme] = useState({ primary: '#a855f7', secondary: '#3b82f6', accent: '#06b6d4' });
  const [timeSlots, setTimeSlots] = useState([]);
  const [bestHours, setBestHours] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState('12:00');
  const isMounted = useRef(true);
  const loadLock = useRef(false);
  
  const loadWeek = useCallback(async () => {
    if (loadLock.current) return;
    if (!user || !isMounted.current) return;
    
    loadLock.current = true;
    
    try {
      setLoading(true);
      
      const currentWeek = await getCurrentWeek(selectedDate);
      if (!isMounted.current) return;
      setWeek(currentWeek);
      
      const weekTasks = await getWeekTasks(currentWeek.id);
      if (!isMounted.current) return;
      setTasks(weekTasks);
      setMetrics(currentWeek.metrics || {});
      
      const savedTheme = await getTheme();
      if (savedTheme && isMounted.current) setTheme(savedTheme);
      
      const savedTimeSlots = await getTimeSlots();
      if (savedTimeSlots && isMounted.current) setTimeSlots(savedTimeSlots);
      
      await checkMissedTasks(currentWeek.id, selectedDate);
      const updatedMetrics = await updateWeekMetrics(currentWeek.id);
      if (updatedMetrics && isMounted.current) setMetrics(updatedMetrics);
      
      const hours = await getBestFocusHours();
      if (hours && isMounted.current) setBestHours(hours);
      
    } catch (error) {
      console.error('Load week error:', error);
    } finally {
      if (isMounted.current) setLoading(false);
      loadLock.current = false;
    }
  }, [user, selectedDate]);
  
  useEffect(() => {
    isMounted.current = true;
    if (user) {
      loadWeek();
    }
    return () => {
      isMounted.current = false;
    };
  }, [user]);
  
  useEffect(() => {
    if (user && isMounted.current && !loadLock.current) {
      loadWeek();
    }
  }, [selectedDate]);
  
  const handleRefresh = async () => {
    if (loadLock.current) return;
    await loadWeek();
  };
  
  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };
  
  // Check if a day is in the past
  const isDayPastForDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };
  
  // Check if current week is in the past
  const isWeekPast = () => {
    const startOfWeek = getWeekStart(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return startOfWeek < today;
  };
  
  const getWeekStart = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };
  
  const getTaskAtSlot = (day, time) => tasks.find(t => t.day === day && t.startTime === time);
  
  const handleSlotClick = (day, time, dayDate) => {
    // Don't allow adding tasks to past days
    if (isDayPastForDate(dayDate)) {
      return;
    }
    // Check if the specific time slot has already passed today
    if (isTimePast(day, time, dayDate)) {
      return;
    }
    const existingTask = getTaskAtSlot(day, time);
    if (existingTask) return;
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
  
  const handleThemeUpdate = async (newTheme) => {
    await updateTheme(newTheme);
    setTheme(newTheme);
  };
  
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
  
  // Get the actual dates for each day of the week
  const getDayDate = (dayName) => {
    const startOfWeek = getWeekStart(selectedDate);
    const dayIndex = DAYS.indexOf(dayName);
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return targetDate;
  };
  
  const formatDateRange = () => {
    const startOfWeek = getWeekStart(selectedDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };
  
  const getCurrentTimePosition = () => {
    const currentTime = getClockPosition();
    const slotIndex = timeSlots.findIndex(slot => slot >= currentTime.timeString);
    if (slotIndex === -1) return null;
    return { slotIndex, timeString: currentTime.timeString };
  };
  
  // Calculate day statistics
  const getDayStats = (dayName, dayDate) => {
    const dayTasks = tasks.filter(t => t.day === dayName);
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.status === 'completed').length;
    const missed = dayTasks.filter(t => t.status === 'missed').length;
    const pending = dayTasks.filter(t => t.status === 'pending' && t.title).length;
    const empty = dayTasks.filter(t => !t.title || t.title === '').length;
    const isPast = isDayPastForDate(dayDate);
    
    return { total, completed, missed, pending, empty, isPast };
  };
  
  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
        <p className="ml-3 text-slate-400">Loading your schedule...</p>
      </div>
    );
  }
  
  const currentPos = getCurrentTimePosition();
  const weekPast = isWeekPast();
  
  return (
    <div className="space-y-6">
      {/* Real-Time Clock Display */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-purple-400 animate-pulse" />
            <div>
              <p className="text-2xl font-mono font-bold text-white">{timeString}</p>
              <p className="text-xs text-slate-400">{dateString}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Current Week</p>
            <p className="text-sm text-white">{formatDateRange()}</p>
          </div>
        </div>
      </div>
      
      {/* Navigation & Stats Bar */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white/10 rounded-xl transition text-white"><ChevronLeft size={20} /></button>
          <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white/10 rounded-xl transition text-white"><ChevronRight size={20} /></button>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <Calendar size={18} className="text-purple-400" />
            <span className="font-semibold text-white">{formatDateRange()}</span>
            {weekPast && (
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-400">Past Week</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {bestHours.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
              <Sparkles size={14} className="text-yellow-500" />
              <span className="text-xs text-white">Best: {bestHours[0]?.hour}:00</span>
            </div>
          )}
          <button onClick={() => setShowThemeModal(true)} className="p-2 hover:bg-white/10 rounded-xl transition"><Palette size={20} className="text-purple-400" /></button>
          <button onClick={() => setShowTimeSlotModal(true)} className="p-2 hover:bg-white/10 rounded-xl transition text-white"><Clock size={20} /></button>
          <button onClick={() => setShowAddModal(true)} className="p-2 rounded-xl transition text-white bg-purple-600 hover:bg-purple-700"><Plus size={20} /></button>
        </div>
      </div>
      
      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Completion</span><Target size={14} className="text-purple-400" /></div>
          <p className="text-2xl font-bold mt-1 text-white">{metrics.completionRate || 0}%</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.completedTasks || 0}/{metrics.totalTasks || 0} tasks</p>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden"><div className="h-full transition-all bg-purple-500" style={{ width: `${metrics.completionRate || 0}%` }} /></div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Discipline</span><Zap size={14} className="text-blue-400" /></div>
          <p className="text-2xl font-bold mt-1 text-white">{metrics.disciplineScore || 0}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Accuracy</span><TrendingUp size={14} className="text-cyan-400" /></div>
          <p className="text-2xl font-bold mt-1 text-white">{metrics.timeAccuracy || 0}%</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Weekly Score</span><Target size={14} className="text-purple-400" /></div>
          <p className="text-2xl font-bold mt-1 text-white">{metrics.weeklyScore || 0}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Missed</span><Clock size={14} className="text-red-400" /></div>
          <p className="text-2xl font-bold mt-1 text-white">{metrics.missedCount || 0}</p>
        </div>
      </div>
      
      {/* Live Timeline Schedule */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden overflow-x-auto relative">
        {/* Header with dates and stats */}
        <div className="grid" style={{ gridTemplateColumns: `auto repeat(${DAYS.length}, minmax(150px, 1fr))`, minWidth: '950px' }}>
          <div className="p-3 text-center text-xs font-bold text-slate-500 uppercase border-r border-white/5 bg-white/5">Time</div>
          {DAYS.map(day => {
            const date = getDayDate(day);
            const isPast = isDayPastForDate(date);
            const dayStats = getDayStats(day, date);
            
            return (
              <div key={day} className={`p-3 text-center border-r border-white/5 bg-white/5 ${isPast ? 'opacity-70' : ''}`}>
                <div className="text-sm font-bold text-white">{day}</div>
                <div className="text-[10px] text-slate-400 mt-1">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                {isPast && (
                  <div className="mt-1 flex items-center justify-center gap-1 text-[9px]">
                    {dayStats.completed > 0 && <span className="text-green-500">✓{dayStats.completed}</span>}
                    {dayStats.missed > 0 && <span className="text-red-500">✗{dayStats.missed}</span>}
                    {dayStats.total === 0 && <span className="text-slate-500">📭</span>}
                  </div>
                )}
                {!isPast && dayStats.total > 0 && (
                  <div className="mt-1 text-[9px] text-blue-400">{dayStats.total} tasks</div>
                )}
              </div>
            );
          })}
        </div>
        
        {timeSlots.map((time, slotIdx) => (
          <div key={time} className="grid relative" style={{ gridTemplateColumns: `auto repeat(${DAYS.length}, minmax(150px, 1fr))`, minWidth: '950px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="p-2 border-r border-white/5 text-xs font-mono text-slate-400 flex items-center justify-center bg-white/5" style={{ minHeight: '85px' }}>
              {time}
            </div>
            {DAYS.map(day => {
              const task = getTaskAtSlot(day, time);
              const date = getDayDate(day);
              const isPast = isDayPastForDate(date);
              const isTimeSlotPast = isTimePast(day, time, date);
              const canAdd = !isPast && !isTimeSlotPast;
              
              return (
                <div 
                  key={`${day}-${time}`} 
                  className={`p-1 border-r border-white/5 transition ${canAdd ? 'cursor-pointer hover:bg-white/5' : ''}`}
                  onClick={() => canAdd && handleSlotClick(day, time, date)}
                >
                  {task ? (
                    <TaskCell 
                      task={task} 
                      weekId={week?.id} 
                      now={now} 
                      selectedDate={date}
                      onUpdate={handleRefresh} 
                      theme={theme}
                      isPast={isPast}
                    />
                  ) : (
                    <div className={`h-full min-h-[70px] rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center transition ${canAdd ? 'hover:border-purple-500/50 hover:bg-purple-500/10 group' : 'opacity-50'}`}>
                      {canAdd ? (
                        <>
                          <Plus size={20} className="text-slate-500 group-hover:text-purple-400 transition" />
                          <span className="text-[8px] text-slate-500 mt-1 group-hover:text-purple-400">Add task</span>
                        </>
                      ) : (
                        <>
                          <Lock size={14} className="text-slate-600" />
                          <span className="text-[8px] text-slate-600 mt-1">
                            {isPast ? 'Past day' : 'Time passed'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Live Timeline Indicator - only for current week and current time slot */}
            {currentPos && currentPos.slotIndex === slotIdx && !weekPast && (
              <div className="absolute left-0 right-0 pointer-events-none z-20">
                <div className="h-[2px] bg-red-500 w-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                <div className="absolute -left-1 top-[-4px] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Modals */}
      <TaskModal
        isOpen={showSlotModal}
        onClose={() => {
          setShowSlotModal(false);
          setSelectedSlot(null);
        }}
        day={selectedSlot?.day}
        time={selectedSlot?.time}
        onSave={handleAddTaskToSlot}
        theme={theme}
      />
      
      <TaskModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddTask}
        theme={theme}
      />
      
      {/* Theme Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-96 border border-white/10">
            <div className="flex justify-between mb-4"><h3 className="text-xl font-bold text-white">Customize Theme</h3><button onClick={() => setShowThemeModal(false)} className="text-white"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-sm text-slate-400 block mb-1">Primary Color</label><input type="color" value={theme.primary} onChange={e => handleThemeUpdate({...theme, primary: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" /></div>
              <div><label className="text-sm text-slate-400 block mb-1">Secondary Color</label><input type="color" value={theme.secondary} onChange={e => handleThemeUpdate({...theme, secondary: e.target.value})} className="w-full h-10 rounded-lg cursor-pointer" /></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Time Slot Modal */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-96 border border-white/10">
            <div className="flex justify-between mb-4"><h3 className="text-xl font-bold text-white">Manage Time Slots</h3><button onClick={() => setShowTimeSlotModal(false)} className="text-white"><X size={20} /></button></div>
            <div className="flex gap-2 mb-4"><input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="flex-1 p-2 rounded-lg bg-slate-800 border border-white/10 text-white" /><button onClick={handleAddTimeSlot} className="px-4 py-2 rounded-lg text-white bg-purple-600 hover:bg-purple-700">Add</button></div>
            <div className="space-y-2 max-h-64 overflow-y-auto">{timeSlots.map(slot => <div key={slot} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/50"><span className="text-sm text-white">{slot}</span><button onClick={() => handleRemoveTimeSlot(slot)} className="text-red-400 text-xs">Remove</button></div>)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
