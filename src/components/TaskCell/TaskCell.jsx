// src/components/TaskCell/TaskCell.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Check, RotateCcw, Edit2, X, Clock, AlertTriangle, Battery, Calendar, Ban, Target, Zap } from 'lucide-react';
import { startTask, completeTask, updateTask, addTask } from '../../services/firebaseTaskService';
import { TaskModal } from '../TaskModal/TaskModal';
import { 
  notifyTaskStart, 
  notifyTaskComplete, 
  notifyTaskOverdue,
  notifyTaskRescheduled,
  notifyTaskCancelled,
  notifyTaskDelayed,
  notifyTaskTimeArrived,
  notifyTaskTimeEnded,
  notifyTaskOversight
} from '../../services/notificationService';

// Helper: Convert time string to minutes since midnight
const toMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// ==================== SYSTEM A: VISUAL REALITY (CELL DISPLAY) ====================
const getTimeElapsedProgress = (task, selectedDate, now) => {
  if (!task || task.status === 'completed') return 100;
  if (task.status === 'missed') return 100;
  
  const start = new Date(selectedDate);
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  start.setHours(startHour, startMin, 0, 0);
  
  const end = new Date(selectedDate);
  const [endHour, endMin] = task.endTime.split(':').map(Number);
  end.setHours(endHour, endMin, 0, 0);
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const total = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

const getCellColorState = (task, isPast, now, selectedDate) => {
  if (isPast && task.status !== 'missed') return 'border-slate-600 bg-slate-800/50 opacity-60';
  if (task.status === 'completed') return 'border-green-500 bg-green-500/20';
  if (task.status === 'rescheduled') return 'border-yellow-500 bg-yellow-500/20';
  if (task.status === 'missed') return 'border-red-500 bg-red-500/20';
  
  const end = new Date(selectedDate);
  const [endHour, endMin] = task.endTime.split(':').map(Number);
  end.setHours(endHour, endMin, 0, 0);
  const isOverdue = now > end && task.status !== 'completed';
  
  if (isOverdue) return 'border-red-500 bg-red-500/20 animate-pulse';
  if (task.status === 'active') return 'border-purple-500 bg-purple-500/20';
  if (task.status === 'pending') return 'border-blue-500/50 bg-blue-500/10';
  
  return 'border-blue-500/50 bg-blue-500/10';
};

// ==================== SYSTEM B: PERFORMANCE TRUTH (ANALYTICS) ====================
const calculatePerformanceMetrics = (task) => {
  if (!task) return null;
  
  const scheduledStart = task.startTime;
  const scheduledEnd = task.endTime;
  const actualStart = task.actualStart ? new Date(task.actualStart.seconds * 1000 || task.actualStart) : null;
  const completedAt = task.completedAt ? new Date(task.completedAt.seconds * 1000 || task.completedAt) : null;
  
  let completionType = 'pending';
  let earlyMinutes = 0;
  let lateMinutes = 0;
  let delayMinutes = 0;
  let timeDeviation = 0;
  
  if (task.status === 'missed') {
    return {
      scheduledStart,
      scheduledEnd,
      actualStart: 'Not started',
      completedAt: 'Not completed',
      completionType: 'missed',
      earlyMinutes: 0,
      lateMinutes: 0,
      delayMinutes: 0,
      timeDeviation: 0,
      rescheduleCount: task.rescheduleCount || 0,
      wasEverStarted: false,
      accuracy: 0,
      bonus: 0
    };
  }
  
  if (actualStart) {
    const actualStartStr = actualStart.toTimeString().slice(0, 5);
    delayMinutes = Math.max(0, toMinutes(actualStartStr) - toMinutes(scheduledStart));
  }
  
  if (completedAt && task.status === 'completed') {
    const completedStr = completedAt.toTimeString().slice(0, 5);
    const scheduledEndMinutes = toMinutes(scheduledEnd);
    const completedMinutes = toMinutes(completedStr);
    const diff = completedMinutes - scheduledEndMinutes;
    
    if (diff < -5) {
      completionType = 'early';
      earlyMinutes = Math.abs(diff);
    } else if (diff <= 5) {
      completionType = 'on_time';
    } else {
      completionType = 'late';
      lateMinutes = diff;
    }
    timeDeviation = diff;
  }
  
  return {
    scheduledStart,
    scheduledEnd,
    actualStart: actualStart ? actualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not started',
    completedAt: completedAt ? completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not completed',
    completionType,
    earlyMinutes,
    lateMinutes,
    delayMinutes,
    timeDeviation,
    rescheduleCount: task.rescheduleCount || 0,
    wasEverStarted: !!actualStart,
    accuracy: task.accuracy || 0,
    bonus: task.bonus || 0
  };
};

export default function TaskCell({ task, weekId, now, selectedDate, onUpdate, theme, isPast = false, viewMode = 'week' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  const [localTask, setLocalTask] = useState(task);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // ADDED: Safety lock for reschedule
  const [timeProgress, setTimeProgress] = useState(0);
  const intervalRef = useRef(null);
  const overdueNotifiedRef = useRef(false);
  const timeArrivedNotifiedRef = useRef(false);
  const timeEndedNotifiedRef = useRef(false);
  
  const performance = useMemo(() => calculatePerformanceMetrics(localTask), [localTask]);
  
  useEffect(() => { setLocalTask(task); }, [task]);
  
  // OPTIMIZED: Time-elapsed animation - updates every 30 seconds
  useEffect(() => {
    if (!localTask || isPast || localTask.status === 'completed' || localTask.status === 'missed') return;
    
    const initialProgress = getTimeElapsedProgress(localTask, selectedDate, new Date());
    setTimeProgress(initialProgress);
    
    intervalRef.current = setInterval(() => {
      const progress = getTimeElapsedProgress(localTask, selectedDate, new Date());
      setTimeProgress(progress);
    }, 30000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [localTask, selectedDate, isPast]);
  
  // Body scroll lock
  useEffect(() => {
    if (isExpanded || showCompletionConfirm) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [isExpanded, showCompletionConfirm]);
  
  const currentNow = useMemo(() => new Date(), [timeProgress]);
  
  const isTaskOverdue = useCallback(() => {
    if (!localTask || localTask.status === 'completed' || localTask.status === 'missed') return false;
    const end = new Date(selectedDate);
    const [endHour, endMin] = localTask.endTime.split(':').map(Number);
    end.setHours(endHour, endMin, 0, 0);
    return new Date() > end;
  }, [localTask, selectedDate]);
  
  const isTaskTimeArrived = useCallback(() => {
    if (!localTask || localTask.status !== 'pending') return false;
    const start = new Date(selectedDate);
    const [startHour, startMin] = localTask.startTime.split(':').map(Number);
    start.setHours(startHour, startMin, 0, 0);
    const nowDate = new Date();
    return nowDate >= start;
  }, [localTask, selectedDate]);
  
  const isTaskTimeEnded = useCallback(() => {
    if (!localTask || localTask.status !== 'active') return false;
    const end = new Date(selectedDate);
    const [endHour, endMin] = localTask.endTime.split(':').map(Number);
    end.setHours(endHour, endMin, 0, 0);
    const nowDate = new Date();
    return nowDate > end;
  }, [localTask, selectedDate]);
  
  // Notifications
  useEffect(() => {
    if (isTaskTimeArrived() && localTask && localTask.status === 'pending' && !timeArrivedNotifiedRef.current) {
      notifyTaskTimeArrived(localTask.title, localTask.startTime);
      timeArrivedNotifiedRef.current = true;
    }
  }, [isTaskTimeArrived, localTask]);
  
  useEffect(() => {
    if (isTaskTimeEnded() && localTask && localTask.status === 'active' && !timeEndedNotifiedRef.current) {
      notifyTaskTimeEnded(localTask.title, localTask.endTime);
      timeEndedNotifiedRef.current = true;
    }
  }, [isTaskTimeEnded, localTask]);
  
  useEffect(() => {
    if (isTaskOverdue() && localTask && localTask.status === 'pending' && !overdueNotifiedRef.current) {
      notifyTaskOverdue(localTask.title, localTask.endTime);
      overdueNotifiedRef.current = true;
      updateTask(localTask.id, { notifiedOverdue: true }).catch(console.error);
    }
  }, [isTaskOverdue, localTask]);
  
  const handleStart = useCallback(async () => {
    if (isStarting || isProcessing) return;
    if (!isPast && localTask && localTask.status === 'pending') {
      setIsStarting(true);
      try {
        const actualStartTime = new Date();
        await startTask(localTask.id, actualStartTime);
        
        const scheduledStartMinutes = toMinutes(localTask.startTime);
        const actualStartMinutes = actualStartTime.getHours() * 60 + actualStartTime.getMinutes();
        const delayMinutes = actualStartMinutes - scheduledStartMinutes;
        
        if (delayMinutes > 0) {
          notifyTaskDelayed(localTask.title, localTask.startTime, actualStartTime, delayMinutes);
        } else {
          notifyTaskStart(localTask.title, localTask.startTime);
        }
        
        onUpdate();
        setIsExpanded(false);
      } catch (error) {
        console.error("Error starting task:", error);
      } finally {
        setIsStarting(false);
      }
    }
  }, [isPast, localTask, onUpdate, isStarting, isProcessing]);
  
  const handleCompleteClick = useCallback(() => {
    setShowCompletionConfirm(true);
  }, []);
  
  const confirmCompletion = useCallback(async () => {
    try {
      const completedAt = new Date();
      const completedStr = completedAt.toTimeString().slice(0, 5);
      const scheduledEnd = localTask.endTime;
      const scheduledEndMinutes = toMinutes(scheduledEnd);
      const completedMinutes = toMinutes(completedStr);
      const diff = completedMinutes - scheduledEndMinutes;
      
      let completionType = 'on_time';
      let bonus = 10;
      if (diff < -5) {
        completionType = 'early';
        bonus = 15;
      } else if (diff > 5) {
        completionType = 'late';
        bonus = -Math.min(30, Math.round(diff * 2));
      }
      
      await completeTask(localTask.id, completedAt, completionType);
      await updateTask(localTask.id, {
        completionStatus: `completed_${completionType}`,
        accuracy: bonus > 0 ? 100 - Math.abs(diff) : Math.max(0, 80 - Math.abs(diff)),
        bonus,
        status: 'completed',
        completedAt
      });
      
      notifyTaskComplete(localTask.title, completionType, bonus, completedAt);
      onUpdate();
      setShowCompletionConfirm(false);
      setIsExpanded(false);
    } catch (error) {
      console.error("Error completing task:", error);
    }
  }, [localTask, onUpdate]);
  
  // FIXED: SAFE RESCHEDULE with lockdown to prevent purple screen
  const handleReschedule = useCallback(async () => {
    // SAFETY LOCKDOWN: Prevent multiple taps and race conditions
    if (isProcessing || !localTask) return;
    setIsProcessing(true);
    
    // Store old values for notification
    const oldStartTime = localTask.startTime;
    const oldEndTime = localTask.endTime;
    const oldDay = localTask.day;
    const wasStarted = !!localTask.actualStart;
    const workProgress = localTask.manualProgress || 0;
    
    try {
      // CRITICAL: Close modals IMMEDIATELY to free up GPU memory
      setIsExpanded(false);
      setShowReschedule(false);
      setShowManualEntry(false);
      
      // Mark original as rescheduled
      await updateTask(localTask.id, {
        status: 'rescheduled',
        rescheduledTo: `${newDay} at ${newTime}`,
        rescheduledDate: new Date().toISOString(),
        rescheduleCount: (localTask.rescheduleCount || 0) + 1
      });
      
      // Create new task with carried progress
      const newEndTime = `${parseInt(newTime.split(':')[0]) + 1}:${newTime.split(':')[1]}`;
      await addTask(weekId, {
        title: localTask.title,
        category: localTask.category,
        subcategory: localTask.subcategory,
        day: newDay,
        startTime: newTime,
        endTime: newEndTime,
        originalTaskId: localTask.id,
        rescheduledFrom: true,
        rescheduleCount: (localTask.rescheduleCount || 0) + 1,
        status: 'pending',
        carryOverProgress: wasStarted ? workProgress : 0,
        cumulativeProgress: wasStarted ? workProgress : 0
      });
      
      // Send reschedule notification
      const dayChanged = newDay !== oldDay;
      notifyTaskRescheduled(
        localTask.title, 
        oldStartTime, 
        newTime, 
        oldEndTime, 
        newEndTime, 
        dayChanged ? newDay : null
      );
      
      // Refresh parent component
      await onUpdate();
      
    } catch (error) {
      console.error("Error rescheduling task:", error);
      alert("Could not reschedule. Please check your connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [localTask, newDay, newTime, weekId, onUpdate, isProcessing]);
  
  const handleCancelTask = useCallback(async () => {
    if (isProcessing) return;
    if (localTask && confirm('Cancel this task? It will be marked as missed.')) {
      setIsProcessing(true);
      try {
        await updateTask(localTask.id, { status: 'missed', completion: 0, accuracy: 0 });
        notifyTaskCancelled(localTask.title, 'missed');
        onUpdate();
        setIsExpanded(false);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [localTask, onUpdate, isProcessing]);
  
  const handleManualComplete = useCallback(async () => {
    if (isProcessing) return;
    if (!manualStart || !manualEnd) {
      alert('Please enter both start and end times');
      return;
    }
    
    setIsProcessing(true);
    try {
      const completedAt = new Date();
      completedAt.setHours(parseInt(manualEnd.split(':')[0]), parseInt(manualEnd.split(':')[1]), 0, 0);
      
      const actualStart = new Date();
      actualStart.setHours(parseInt(manualStart.split(':')[0]), parseInt(manualStart.split(':')[1]), 0, 0);
      
      const scheduledEnd = localTask.endTime;
      const completedMinutes = toMinutes(manualEnd);
      const diff = completedMinutes - toMinutes(scheduledEnd);
      
      let completionType = 'on_time';
      let bonus = 10;
      if (diff < -5) {
        completionType = 'early';
        bonus = 15;
      } else if (diff > 5) {
        completionType = 'late';
        bonus = -Math.min(30, Math.round(diff * 2));
      }
      
      await updateTask(localTask.id, {
        status: 'completed',
        actualStart: actualStart,
        completedAt: completedAt,
        completionStatus: `completed_${completionType}`,
        accuracy: bonus > 0 ? 100 - Math.abs(diff) : Math.max(0, 80 - Math.abs(diff)),
        bonus,
        manualEntry: true
      });
      
      notifyTaskComplete(localTask.title, completionType, bonus, completedAt);
      onUpdate();
      setShowManualEntry(false);
      setIsExpanded(false);
      setManualStart('');
      setManualEnd('');
    } catch (error) {
      console.error("Error recording manual completion:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [localTask, manualStart, manualEnd, onUpdate, isProcessing]);
  
  if (!localTask) return null;
  
  const isOngoing = localTask.status === 'active';
  const isPending = localTask.status === 'pending';
  const isCompleted = localTask.status === 'completed';
  const isMissed = localTask.status === 'missed';
  const isRescheduled = localTask.status === 'rescheduled';
  const isOverdue = isTaskOverdue();
  const showStartButton = isPending && !isCompleted && !isMissed && !isRescheduled && !isOngoing;
  const cellColor = getCellColorState(localTask, isPast, currentNow, selectedDate);
  const isHorizontal = viewMode === 'day';
  const isClickable = !isPast || isMissed;
  
  const fillStyle = isHorizontal 
    ? { width: `${timeProgress}%`, height: '100%', left: 0, top: 0 }
    : { height: `${timeProgress}%`, width: '100%', bottom: 0, left: 0 };
  
  const getFillColor = () => {
    if (isOngoing) return isHorizontal ? 'linear-gradient(90deg, #a855f7, #7c3aed)' : 'linear-gradient(0deg, #a855f7, #7c3aed)';
    if (isOverdue && isPending) return isHorizontal ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(0deg, #ef4444, #dc2626)';
    return isHorizontal ? `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` : `linear-gradient(0deg, ${theme.primary}, ${theme.secondary})`;
  };
  
  // Analytics Panel Content (System B)
  const AnalyticsPanel = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Scheduled</p>
          <p className="text-sm font-mono font-bold text-white">{performance.scheduledStart} → {performance.scheduledEnd}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-wide">Actual</p>
          <p className="text-sm font-mono font-bold text-white">
            {performance.completionType === 'missed' ? '—' : `${performance.actualStart} → ${performance.completedAt}`}
          </p>
        </div>
      </div>
      
      {performance.completionType === 'missed' ? (
        <div className="bg-red-500/10 rounded-lg p-4 text-center">
          <Ban size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-red-400">Task Missed</p>
          <p className="text-[10px] text-slate-400 mt-1">No completion recorded for this task</p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-slate-400">Time Deviation</span>
              <span className={`text-sm font-bold ${performance.timeDeviation < -5 ? 'text-green-400' : performance.timeDeviation > 5 ? 'text-red-400' : 'text-blue-400'}`}>
                {performance.timeDeviation !== 0 ? `${performance.timeDeviation > 0 ? '+' : ''}${Math.round(performance.timeDeviation)} min` : 'On time'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">Delay Start</span>
              <span className={`text-sm font-bold ${performance.delayMinutes > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {performance.delayMinutes > 0 ? `${performance.delayMinutes} min late` : 'On time'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Completion Type</p>
              <p className={`text-sm font-bold ${
                performance.completionType === 'early' ? 'text-green-400' :
                performance.completionType === 'on_time' ? 'text-blue-400' : 'text-red-400'
              }`}>
                {performance.completionType.toUpperCase()}
                {performance.earlyMinutes > 0 && ` (${performance.earlyMinutes}m early)`}
                {performance.lateMinutes > 0 && ` (${performance.lateMinutes}m late)`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Points</p>
              <p className={`text-sm font-bold ${performance.bonus > 0 ? 'text-green-400' : performance.bonus < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {performance.bonus > 0 ? `+${performance.bonus}` : performance.bonus}
              </p>
            </div>
          </div>
        </>
      )}
      
      {performance.rescheduleCount > 0 && (
        <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
          <p className="text-[9px] text-yellow-400">↻ Rescheduled {performance.rescheduleCount} time(s)</p>
        </div>
      )}
    </div>
  );
  
  const popupContent = isExpanded && isClickable && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={() => setIsExpanded(false)}>
      <div className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-y-auto" style={{ width: '100%', maxWidth: '480px', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-4 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{localTask.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400"><Clock size={12} className="inline mr-1" />{localTask.startTime} - {localTask.endTime}</span>
                {isOverdue && !isCompleted && <span className="text-[9px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">OVERDUE</span>}
                {isMissed && <span className="text-[9px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">MISSED</span>}
              </div>
            </div>
            <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-white p-1 rounded"><X size={20} /></button>
          </div>
        </div>
        
        {!isMissed && (
          <div className="p-4 border-b border-white/10">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Battery size={10} /> Time Elapsed</span>
                <span className="text-sm font-mono font-bold text-white">{Math.round(timeProgress)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${timeProgress}%`, background: getFillColor() }} />
              </div>
              <p className="text-[8px] text-slate-500 mt-2 text-center">Battery fill = time elapsed in scheduled window (not work progress)</p>
            </div>
          </div>
        )}
        
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-purple-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wide">Performance Analytics</h4>
          </div>
          <AnalyticsPanel />
        </div>
        
        <div className="p-4 pt-0 space-y-2">
          {showStartButton && (
            <button onClick={handleStart} disabled={isStarting || isProcessing} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50">
              {isStarting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={14} />}
              {isStarting ? 'Starting...' : 'Start Task'}
            </button>
          )}
          
          {isOngoing && (
            <button onClick={handleCompleteClick} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white transition">
              <Check size={14} /> Complete Task
            </button>
          )}
          
          {(!isCompleted && !isRescheduled) && (
            <button 
              onClick={() => setShowReschedule(true)} 
              disabled={isProcessing}
              className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white transition disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reschedule {isMissed ? '(Missed Task)' : ''}
            </button>
          )}
          
          {((isOverdue && !isCompleted && !isRescheduled) || isMissed) && (
            <button onClick={() => setShowManualEntry(true)} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white transition">
              <Calendar size={14} /> Record Completion (Log actual times)
            </button>
          )}
          
          {(isOngoing || isPending) && !isCompleted && !isRescheduled && !isMissed && (
            <button onClick={handleCancelTask} disabled={isProcessing} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50">
              <Ban size={14} /> Cancel / Miss
            </button>
          )}
          
          <button onClick={() => setShowEditModal(true)} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white transition">
            <Edit2 size={14} /> Edit Task
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
  
  const completionConfirmContent = showCompletionConfirm && createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-hidden max-w-sm w-full">
        <div className="p-4 border-b bg-purple-500/20 border-purple-500/30">
          <h3 className="text-lg font-bold text-white">Complete Task?</h3>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-300 mb-4">
            Confirm completion of <span className="text-purple-400 font-bold">{localTask.title}</span>
          </p>
          <div className="flex gap-3">
            <button onClick={confirmCompletion} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition">
              Confirm
            </button>
            <button onClick={() => setShowCompletionConfirm(false)} className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
  
  const rescheduleContent = showReschedule && createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setShowReschedule(false)}>
      <div className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-hidden max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b bg-yellow-500/20 border-yellow-500/30">
          <h3 className="text-lg font-bold text-white">Reschedule Task</h3>
          {isMissed && <p className="text-xs text-yellow-300 mt-1">This task was missed. Reschedule to a new time/day.</p>}
        </div>
        <div className="p-5 space-y-3">
          <select value={newDay} onChange={(e) => setNewDay(e.target.value)} className="w-full p-2 text-sm rounded-lg bg-slate-800 border border-white/10 text-white">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d}>{d}</option>)}
          </select>
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full p-2 text-sm rounded-lg bg-slate-800 border border-white/10 text-white" />
          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleReschedule} 
              disabled={isProcessing}
              className="flex-1 py-2 rounded-lg bg-yellow-600 text-white text-sm font-semibold hover:bg-yellow-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                'Reschedule'
              )}
            </button>
            <button onClick={() => setShowReschedule(false)} className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
  
  const manualEntryContent = showManualEntry && createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={() => setShowManualEntry(false)}>
      <div className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-hidden max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b bg-orange-500/20 border-orange-500/30">
          <h3 className="text-lg font-bold text-white">Record Missed Task Completion</h3>
          <p className="text-xs text-orange-300 mt-1">Enter the actual times you completed this task</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Actual Start Time</label>
            <input 
              type="time" 
              value={manualStart} 
              onChange={(e) => setManualStart(e.target.value)} 
              className="w-full p-2 text-sm rounded-lg bg-slate-800 border border-white/10 text-white" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Actual End Time</label>
            <input 
              type="time" 
              value={manualEnd} 
              onChange={(e) => setManualEnd(e.target.value)} 
              className="w-full p-2 text-sm rounded-lg bg-slate-800 border border-white/10 text-white" 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleManualComplete} disabled={isProcessing} className="flex-1 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition disabled:opacity-50">
              {isProcessing ? 'Saving...' : 'Save Completion'}
            </button>
            <button onClick={() => setShowManualEntry(false)} className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
  
  return (
    <>
      <div className="relative h-full w-full">
        <button
          onClick={() => isClickable && !isProcessing && setIsExpanded(!isExpanded)}
          className={`w-full h-14 rounded-lg border relative overflow-hidden transition-all duration-200 text-left ${isClickable && !isProcessing ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} ${cellColor}`}
          disabled={!isClickable || isProcessing}
        >
          {timeProgress > 0 && !isPast && !isMissed && !isCompleted && (
            <div className="absolute transition-all duration-300 ease-out" style={{ ...fillStyle, background: getFillColor(), opacity: 0.7 }} />
          )}
          
          <div className="relative z-10 p-1.5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium truncate text-white max-w-[60px]">
                {localTask.rescheduledFrom ? '↻ ' : ''}{localTask.title?.slice(0, 8)}
              </p>
              <div className="flex items-center gap-0.5">
                {isCompleted && <Check size={10} className="text-green-500" />}
                {isOngoing && <Zap size={10} className="text-purple-500 animate-pulse" />}
                {isOverdue && <AlertTriangle size={10} className="text-red-500 animate-pulse" />}
                {isMissed && <Ban size={10} className="text-red-500" />}
              </div>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-0.5">
                <Clock size={7} className="text-slate-400" />
                <span className="text-[8px] font-mono text-slate-300">{localTask.startTime}</span>
              </div>
              {performance.delayMinutes > 0 && isOngoing && (
                <span className="text-[6px] text-orange-400 font-bold">{performance.delayMinutes}m late</span>
              )}
              {performance.completionType === 'early' && isCompleted && (
                <span className="text-[6px] text-green-400 font-bold">Early</span>
              )}
              {performance.completionType === 'late' && isCompleted && (
                <span className="text-[6px] text-red-400 font-bold">Late</span>
              )}
              {isMissed && (
                <span className="text-[6px] text-red-400 font-bold">Missed</span>
              )}
            </div>
          </div>
        </button>
      </div>
      
      {popupContent}
      {completionConfirmContent}
      {rescheduleContent}
      {manualEntryContent}
      
      {showEditModal && createPortal(
        <TaskModal 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
          task={localTask} 
          weekId={weekId} 
          onUpdate={() => {
            onUpdate();
            setShowEditModal(false);
          }} 
          theme={theme} 
        />,
        document.body
      )}
    </>
  );
}