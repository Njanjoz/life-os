import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Check, RotateCcw, Edit2, X, Clock, AlertTriangle, Battery, Zap, Calendar, AlertCircle, Ban, Award, Target, Shield, ShieldAlert, Zap as ZapIcon } from 'lucide-react';
import { startTask, completeTask, rescheduleTask, rescheduleToNow, updateTask, addTask } from '../../services/firebaseTaskService';
import { TaskModal } from '../TaskModal/TaskModal';

export default function TaskCell({ task, weekId, now, selectedDate, onUpdate, theme, isPast = false, viewMode = 'week' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [showDelayWarning, setShowDelayWarning] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  const [timeProgress, setTimeProgress] = useState(0);
  const [localTask, setLocalTask] = useState(task);
  const [isStarting, setIsStarting] = useState(false);
  const [pendingCompletionType, setPendingCompletionType] = useState(null);
  const [completionDetails, setCompletionDetails] = useState({});
  const popupRef = useRef(null);
  const animationFrameRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  useEffect(() => { setLocalTask(task); }, [task]);

  useEffect(() => {
    if (!localTask || isPast) return;
    
    const updateProgress = () => {
      const nowTime = Date.now();
      
      if (localTask.status === 'completed') {
        setTimeProgress(100);
        return;
      }
      
      if (localTask.status === 'missed' && !localTask.rescheduledFrom) {
        setTimeProgress(100);
        return;
      }
      
      const start = new Date(selectedDate);
      const [startHour, startMin] = localTask.startTime.split(':').map(Number);
      start.setHours(startHour, startMin, 0, 0);
      const end = new Date(selectedDate);
      const [endHour, endMin] = localTask.endTime.split(':').map(Number);
      end.setHours(endHour, endMin, 0, 0);
      
      const total = end - start;
      const elapsed = nowTime - start;
      let progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      
      setTimeProgress(progress);
      
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateProgress);
    return () => { 
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [localTask, selectedDate, isPast]);

  useEffect(() => {
    if (isExpanded || showDelayWarning || showCompletionConfirm) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [isExpanded, showDelayWarning, showCompletionConfirm]);

  const isRescheduledOriginal = localTask?.rescheduledTo || (localTask?.rescheduledFrom === false);
  const isRescheduledCopy = localTask?.rescheduledFrom === true;
  const canEdit = localTask?.status === 'pending' && !isRescheduledOriginal && !localTask?.rescheduledTo;

  const handleStart = useCallback(async () => {
    if (isStarting) return;

    if (!isPast && localTask && (localTask.status === 'pending' || localTask.status === 'rescheduled')) {
      setIsStarting(true);
      try {
        const exactStartTime = new Date();
        await startTask(localTask.id, exactStartTime);
        onUpdate();
        setIsExpanded(false);
      } catch (error) {
        console.error("Error starting task:", error);
      } finally {
        setIsStarting(false);
      }
    }
  }, [isPast, localTask, onUpdate, isStarting]);

  const calculateCompletionType = useCallback(() => {
    const actualEnd = new Date();
    const start = new Date(selectedDate);
    const [startHour, startMin] = localTask.startTime.split(':').map(Number);
    start.setHours(startHour, startMin, 0, 0);
    const scheduledEnd = new Date(selectedDate);
    const [endHour, endMin] = localTask.endTime.split(':').map(Number);
    scheduledEnd.setHours(endHour, endMin, 0, 0);
    
    const totalPlannedDuration = (scheduledEnd - start) / 60000; // in minutes
    const actualDuration = (actualEnd - start) / 60000;
    
    // Calculate how much faster (if early) or slower (if late)
    let speedPercent = 0;
    let speedMessage = '';
    
    if (actualEnd < scheduledEnd) {
      // Early completion - calculate how much faster
      const timeSaved = totalPlannedDuration - actualDuration;
      speedPercent = Math.round((timeSaved / totalPlannedDuration) * 100);
      speedMessage = `⚡ You finished ${speedPercent}% faster than expected!`;
    } else if (actualEnd > scheduledEnd) {
      // Late completion - calculate how much slower
      const timeLost = actualDuration - totalPlannedDuration;
      speedPercent = Math.round((timeLost / totalPlannedDuration) * 100);
      speedMessage = `🐢 You took ${speedPercent}% longer than expected.`;
    }
    
    const diffMinutes = (actualEnd - scheduledEnd) / 60000;
    let type = '';
    let bonus = 0;
    let message = '';
    let color = '';
    
    if (actualEnd < scheduledEnd) {
      type = 'early';
      const earlyMinutes = Math.round((scheduledEnd - actualEnd) / 60000);
      bonus = 15;
      message = `🎉 EARLY COMPLETION!\n\n${speedMessage}\n\nFinished ${earlyMinutes} minutes before scheduled end.\nYou earned +${bonus} bonus points!\n\nProceed with completion?`;
      color = 'text-green-400';
    } else if (actualEnd >= scheduledEnd && actualEnd <= new Date(scheduledEnd.getTime() + 5 * 60 * 1000)) {
      type = 'on_time';
      bonus = 10;
      message = `✓ ON TIME COMPLETION\n\nYou finished within the allowed window.\nStandard reward of +${bonus} points applied.\n\nProceed with completion?`;
      color = 'text-blue-400';
    } else {
      type = 'late';
      const lateMinutes = Math.round(diffMinutes);
      const penalty = Math.min(30, lateMinutes * 2);
      bonus = -penalty;
      message = `⚠️ LATE COMPLETION\n\n${speedMessage}\n\nFinished ${lateMinutes} minutes after scheduled end.\nPenalty of -${penalty} points will be applied.\n\nProceed anyway?`;
      color = 'text-orange-400';
    }
    
    // Add delay info if started late
    if (localTask.delay > 0) {
      message += `\n\nNote: You started ${Math.round(localTask.delay)} minutes late, which also affects your score.`;
    }
    
    return { type, bonus, message, color, diffMinutes, speedPercent, speedMessage };
  }, [localTask, selectedDate]);

  const handleCompleteClick = useCallback(() => {
    const details = calculateCompletionType();
    setPendingCompletionType(details.type);
    setCompletionDetails(details);
    setShowCompletionConfirm(true);
  }, [calculateCompletionType]);

  const confirmCompletion = useCallback(async () => {
    const actualEnd = new Date();
    await completeTask(localTask.id, actualEnd, pendingCompletionType);
    onUpdate();
    setShowCompletionConfirm(false);
    setIsExpanded(false);
  }, [localTask, pendingCompletionType, onUpdate]);

  const handleManualComplete = useCallback(async () => {
    if (manualStart && manualEnd) {
      const startTime = new Date(`${selectedDate.toDateString()} ${manualStart}`);
      const endTime = new Date(`${selectedDate.toDateString()} ${manualEnd}`);
      
      const scheduledEnd = new Date(selectedDate);
      const [endHour, endMin] = localTask.endTime.split(':').map(Number);
      scheduledEnd.setHours(endHour, endMin, 0, 0);
      
      let completionType;
      if (endTime < scheduledEnd) {
        completionType = 'early';
      } else if (endTime >= scheduledEnd && endTime <= new Date(scheduledEnd.getTime() + 5 * 60 * 1000)) {
        completionType = 'on_time';
      } else {
        completionType = 'late';
      }
      
      if (localTask.status !== 'active') {
        await startTask(localTask.id, startTime);
      }
      
      await completeTask(localTask.id, endTime, completionType);
      
      onUpdate();
      setShowManualEntry(false);
      setIsExpanded(false);
    }
  }, [manualStart, manualEnd, localTask, selectedDate, onUpdate]);

  const handleRescheduleToSpecific = useCallback(async () => {
    if (localTask && newDay && newTime && !isRescheduledOriginal) {
      const newRescheduleCount = (localTask.rescheduleCount || 0) + 1;
      
      await updateTask(localTask.id, {
        status: 'missed',
        rescheduledTo: `${newDay} at ${newTime}`,
        rescheduledDate: new Date().toISOString(),
        rescheduleCount: newRescheduleCount,
        completed: false
      });
      
      await addTask(weekId, {
        title: localTask.title,
        category: localTask.category,
        subcategory: localTask.subcategory,
        day: newDay,
        startTime: newTime,
        endTime: `${parseInt(newTime.split(':')[0]) + 1}:00`,
        originalTaskId: localTask.id,
        rescheduledFrom: true,
        rescheduleCount: newRescheduleCount,
        status: 'pending'
      });
      
      onUpdate();
      setIsExpanded(false);
      setShowReschedule(false);
    }
  }, [localTask, newDay, newTime, weekId, onUpdate, isRescheduledOriginal]);

  const handleRescheduleToNow = useCallback(async () => {
    if (localTask && !isRescheduledOriginal) {
      const nowDate = new Date();
      const currentHour = nowDate.getHours();
      const currentMinute = nowDate.getMinutes();
      const newStartTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const newEndTime = `${(currentHour + 1).toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nowDate.getDay()];
      
      const newRescheduleCount = (localTask.rescheduleCount || 0) + 1;
      
      await updateTask(localTask.id, {
        status: 'missed',
        rescheduledTo: `${currentDay} at ${newStartTime}`,
        rescheduledDate: new Date().toISOString(),
        rescheduleCount: newRescheduleCount,
        completed: false
      });
      
      await addTask(weekId, {
        title: localTask.title,
        category: localTask.category,
        subcategory: localTask.subcategory,
        day: currentDay,
        startTime: newStartTime,
        endTime: newEndTime,
        originalTaskId: localTask.id,
        rescheduledFrom: true,
        rescheduleCount: newRescheduleCount,
        status: 'pending'
      });
      
      onUpdate();
      setIsExpanded(false);
      setShowReschedule(false);
    }
  }, [localTask, weekId, onUpdate, isRescheduledOriginal]);

  const handleEdit = useCallback(() => {
    if (canEdit) {
      setShowEditModal(true);
      setIsExpanded(false);
    }
  }, [canEdit]);

  const handleCancelTask = useCallback(async () => {
    if (localTask && confirm('Cancel this task? It will be marked as missed.')) {
      await updateTask(localTask.id, { status: 'missed', completion: 0, accuracy: 0 });
      onUpdate();
      setIsExpanded(false);
    }
  }, [localTask, onUpdate]);

  if (!localTask) return null;

  const scheduledStartTime = localTask.startTime;
  const getActualStartDate = () => {
    if (!localTask.actualStart) return null;
    if (localTask.actualStart.seconds) {
      return new Date(localTask.actualStart.seconds * 1000);
    }
    return new Date(localTask.actualStart);
  };

  const actualStartDate = getActualStartDate();
  const actualStartTimeDisplay = actualStartDate ? actualStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not started';
  const delayMinutes = localTask.delay ? Math.round(localTask.delay) : 0;
  const isOngoing = localTask.status === 'active';
  const isPending = localTask.status === 'pending';
  const isCompleted = localTask.status === 'completed';
  const isMissed = localTask.status === 'missed';
  const isDishonest = localTask.completionType === 'manual_dishonest';
  const rescheduledTo = localTask.rescheduledTo;
  const isRescheduledFrom = localTask.rescheduledFrom;
  
  const startTimeObj = new Date(selectedDate);
  const [startHour, startMin] = localTask.startTime.split(':').map(Number);
  startTimeObj.setHours(startHour, startMin, 0, 0);
  const endTimeObj = new Date(selectedDate);
  const [endHour, endMin] = localTask.endTime.split(':').map(Number);
  endTimeObj.setHours(endHour, endMin, 0, 0);
  const isTimePassed = now > endTimeObj;

  const getStatusColor = () => {
    if (isPast) return 'border-slate-600 bg-slate-800/50 opacity-60';
    if (isCompleted && isDishonest) return 'border-orange-500 bg-orange-500/20';
    if (isCompleted) return 'border-green-500 bg-green-500/20';
    if (isMissed && rescheduledTo) return 'border-yellow-500 bg-yellow-500/20';
    if (isMissed) return 'border-red-500 bg-red-500/20 animate-pulse';
    if (isOngoing) return 'border-purple-500 bg-purple-500/20';
    if (isPending && isTimePassed) return 'border-red-500 bg-red-500/20 animate-pulse';
    if (isPending && isRescheduledFrom) return 'border-cyan-500 bg-cyan-500/10';
    if (isPending) return 'border-blue-500/50 bg-blue-500/10';
    return 'border-blue-500/50 bg-blue-500/10';
  };

  const getStatusIcon = () => {
    if (isCompleted && isDishonest) return <ShieldAlert size={10} className="text-orange-500" />;
    if (isCompleted) return <Check size={10} className="text-green-500" />;
    if (isMissed && rescheduledTo) return <RotateCcw size={10} className="text-yellow-500" />;
    if (isMissed) return <X size={10} className="text-red-500" />;
    if (isOngoing) return <Zap size={10} className="text-purple-500 animate-pulse" />;
    if (isPending && isRescheduledFrom) return <RotateCcw size={10} className="text-cyan-500" />;
    if (isPending && isTimePassed) return <AlertCircle size={10} className="text-red-500 animate-pulse" />;
    return <Battery size={10} className="text-blue-500" />;
  };

  const isTaskTimePassed = () => {
    return now > endTimeObj && !isCompleted && !isMissed;
  };

  const isHorizontal = viewMode === 'day';
  
  const getFillGradient = () => {
    if (isOngoing) {
      return isHorizontal
        ? `linear-gradient(90deg, #a855f7, #7c3aed)`
        : `linear-gradient(0deg, #a855f7, #7c3aed)`;
    }
    if (isCompleted && !isDishonest) {
      return isHorizontal
        ? `linear-gradient(90deg, #22c55e, #15803d)`
        : `linear-gradient(0deg, #22c55e, #15803d)`;
    }
    if (isCompleted && isDishonest) {
      return isHorizontal
        ? `linear-gradient(90deg, #f97316, #ea580c)`
        : `linear-gradient(0deg, #f97316, #ea580c)`;
    }
    if (timeProgress > 0 && isPending && !isCompleted && !isMissed) {
      return isHorizontal
        ? `linear-gradient(90deg, #ef4444, #dc2626)`
        : `linear-gradient(0deg, #ef4444, #dc2626)`;
    }
    return isHorizontal
      ? `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`
      : `linear-gradient(0deg, ${theme.primary}, ${theme.secondary})`;
  };

  const fillGradient = getFillGradient();
  const fillStyle = isHorizontal 
    ? { width: `${timeProgress}%`, height: '100%', left: 0, top: 0 }
    : { height: `${timeProgress}%`, width: '100%', bottom: 0, left: 0 };

  const showStartButton = isPending && !isCompleted && !isMissed && !isOngoing;
  const showRescheduleButton = !isCompleted && !isRescheduledOriginal;
  const showManualEntryButton = (isTaskTimePassed() || isMissed) && !isCompleted;

  const isRescheduledTask = isRescheduledFrom === true;
  const isOriginalRescheduled = rescheduledTo !== undefined && rescheduledTo !== null;

  const popupContent = isExpanded && !isPast && createPortal(
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={() => setIsExpanded(false)}
    >
      <div 
        ref={popupRef}
        className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-y-auto"
        style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-4 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-2">
              <h3 className="text-base font-semibold text-white break-words">{localTask.title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5"><Clock size={11} className="inline mr-1" />{localTask.startTime} - {localTask.endTime}</p>
              {rescheduledTo && <p className="text-[10px] text-yellow-500 mt-1">Rescheduled to: {rescheduledTo}</p>}
              {isRescheduledFrom && <p className="text-[10px] text-cyan-400 mt-1">This task was rescheduled. Click "Start Task" to begin.</p>}
              {isTimePassed && isPending && !isCompleted && !isMissed && <p className="text-[10px] text-red-400 mt-1">Time has passed. You can still start late (penalty applies).</p>}
              {localTask.delay > 0 && !isCompleted && <p className="text-[10px] text-orange-400 mt-1">Started {Math.round(localTask.delay)} minutes late</p>}
            </div>
            <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-white p-1 rounded flex-shrink-0"><X size={18} /></button>
          </div>
        </div>
        
        <div className="p-4 bg-slate-800/30 border-b border-white/10">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><p className="text-[9px] text-slate-400">Scheduled Start</p><p className="text-base font-mono font-bold text-white">{scheduledStartTime}</p></div>
            <div><p className="text-[9px] text-slate-400">Actual Start</p><p className={`text-base font-mono font-bold ${delayMinutes > 0 ? 'text-orange-400' : 'text-green-400'}`}>{actualStartTimeDisplay}</p></div>
          </div>
          {delayMinutes > 0 && !isCompleted && <div className="mt-3 text-center bg-orange-500/20 rounded-lg p-2"><p className="text-[10px] text-orange-400">Started {delayMinutes} minutes late - Penalty applied</p></div>}
          {localTask.rescheduleCount > 0 && <div className="mt-2 text-center bg-yellow-500/20 rounded-lg p-2"><p className="text-[10px] text-yellow-400">Rescheduled {localTask.rescheduleCount} time(s)</p></div>}
        </div>
        
        <div className="p-4 bg-slate-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400">Time Progress</span>
            <span className="text-lg font-bold text-white">{Math.round(timeProgress)}%</span>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${timeProgress}%`, background: isOngoing ? 'linear-gradient(90deg, #a855f7, #7c3aed)' : isCompleted && !isDishonest ? 'linear-gradient(90deg, #22c55e, #15803d)' : isCompleted && isDishonest ? 'linear-gradient(90deg, #f97316, #ea580c)' : 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
          </div>
          <p className="text-[8px] text-slate-500 mt-1 text-center">of scheduled time elapsed</p>
        </div>
        
        {localTask.accuracy > 0 && isCompleted && (
          <div className={`p-4 border-b ${isDishonest ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
            <p className={`text-[11px] flex items-center gap-2 ${isDishonest ? 'text-orange-400' : 'text-green-400'}`}>
              {isDishonest ? <ShieldAlert size={14} /> : <Check size={14} />}
              Task Score: {Math.round(localTask.accuracy)}% | {localTask.completionType === 'early' ? 'Early completion +15' : localTask.completionType === 'on_time' ? 'On time +10' : 'Late completion penalty'}
            </p>
          </div>
        )}
        
        <div className="p-4 space-y-2">
          {showStartButton && (
            <button 
              onClick={handleStart} 
              disabled={isStarting}
              className={`w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white transition disabled:opacity-50 ${
                isTimePassed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isStarting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={14} />}
              {isStarting ? 'Starting...' : (isTimePassed ? 'Start Late (Penalty applies)' : 'Start Task')}
            </button>
          )}
          
          {isOngoing && (
            <button 
              onClick={handleCompleteClick} 
              className="w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white bg-purple-600 hover:bg-purple-700 transition"
            >
              <Check size={14} /> Complete Task
            </button>
          )}
          
          {showRescheduleButton && (
            <button onClick={() => setShowReschedule(!showReschedule)} className="w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white bg-yellow-600 hover:bg-yellow-700 transition">
              <RotateCcw size={14} /> Reschedule {isMissed ? 'Missed Task' : ''} {localTask.rescheduleCount > 0 ? `(Reschedule #${localTask.rescheduleCount + 1})` : ''}
            </button>
          )}
          
          {showManualEntryButton && (
            <button 
              onClick={() => setShowManualEntry(true)} 
              className="w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white bg-orange-600 hover:bg-orange-700 transition"
            >
              <Calendar size={14} /> Record Completion (Log actual times)
            </button>
          )}
          
          {(isOngoing || isPending) && !isCompleted && <button onClick={handleCancelTask} className="w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white bg-red-600 hover:bg-red-700 transition"><Ban size={14} /> Cancel Task</button>}
          
          {canEdit && <button onClick={handleEdit} className="w-full py-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 transition"><Edit2 size={14} /> Edit Task</button>}
        </div>
        
        {showReschedule && (
          <div className="p-4 pt-0 border-t border-white/10">
            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <button onClick={handleRescheduleToNow} className="w-full py-2 rounded-lg bg-green-600/50 text-[10px] text-white hover:bg-green-600 transition">
                Reschedule to now ({new Date().toLocaleTimeString().slice(0,5)})
              </button>
              <div className="border-t border-white/10 my-2"></div>
              <p className="text-[9px] text-slate-400">Or reschedule to specific day and time:</p>
              <select value={newDay} onChange={(e) => setNewDay(e.target.value)} className="w-full p-2 text-[10px] rounded-lg bg-slate-800 border border-white/10 text-white">
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
              </select>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full p-2 text-[10px] rounded-lg bg-slate-800 border border-white/10 text-white" />
              <button onClick={handleRescheduleToSpecific} className="w-full py-2 rounded-lg bg-yellow-600 text-[10px] text-white hover:bg-yellow-700 transition">
                Reschedule to Selected Time {localTask.rescheduleCount > 0 ? `(Will be reschedule #${localTask.rescheduleCount + 1})` : ''}
              </button>
            </div>
          </div>
        )}
        
        {showManualEntry && (
          <div className="p-4 pt-0 border-t border-white/10">
            <div className="bg-orange-500/20 rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-orange-400 flex items-center gap-2">
                <AlertTriangle size={12} /> 
                Record when you actually did this task:
              </p>
              <div>
                <label className="text-[8px] text-slate-400 block mb-1">Actual Start Time</label>
                <input 
                  type="time" 
                  value={manualStart} 
                  onChange={(e) => setManualStart(e.target.value)} 
                  placeholder="Actual start" 
                  className="w-full p-2 text-[10px] rounded-lg bg-slate-800 border border-white/10 text-white" 
                />
              </div>
              <div>
                <label className="text-[8px] text-slate-400 block mb-1">Actual End Time</label>
                <input 
                  type="time" 
                  value={manualEnd} 
                  onChange={(e) => setManualEnd(e.target.value)} 
                  placeholder="Actual end" 
                  className="w-full p-2 text-[10px] rounded-lg bg-slate-800 border border-white/10 text-white" 
                />
              </div>
              <p className="text-[8px] text-slate-400">Completion type will be auto-detected based on end time.</p>
              <button 
                onClick={handleManualComplete} 
                disabled={!manualStart || !manualEnd}
                className="w-full py-2 rounded-lg bg-orange-600 text-[10px] text-white disabled:opacity-50"
              >
                Save Actual Times
              </button>
            </div>
          </div>
        )}
        
        <div className="p-4 pt-0"><button onClick={() => setIsExpanded(false)} className="w-full py-2 rounded-lg bg-slate-700 text-[11px] text-white">Close</button></div>
      </div>
    </div>,
    document.body
  );

  const completionConfirmContent = showCompletionConfirm && createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-slate-900 rounded-xl border border-white/20 shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: '380px' }}>
        <div className={`p-4 border-b ${pendingCompletionType === 'early' ? 'bg-green-500/20 border-green-500/30' : pendingCompletionType === 'on_time' ? 'bg-blue-500/20 border-blue-500/30' : 'bg-orange-500/20 border-orange-500/30'}`}>
          <div className="flex items-center gap-2">
            {pendingCompletionType === 'early' && <ZapIcon size={20} className="text-green-400" />}
            {pendingCompletionType === 'on_time' && <Target size={20} className="text-blue-400" />}
            {pendingCompletionType === 'late' && <AlertTriangle size={20} className="text-orange-400" />}
            <h3 className="text-lg font-bold text-white">
              {pendingCompletionType === 'early' ? 'Early Completion!' : pendingCompletionType === 'on_time' ? 'On Time Completion' : 'Late Completion'}
            </h3>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-300 whitespace-pre-line">{completionDetails.message}</p>
          <div className="mt-4 flex gap-3">
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

  return (
    <>
      <div className="relative h-full w-full">
        <button
          onClick={() => !isPast && setIsExpanded(!isExpanded)}
          className={`w-full h-14 rounded-lg border relative overflow-hidden transition-all duration-200 text-left ${!isPast ? 'cursor-pointer' : 'cursor-default'} ${getStatusColor()}`}
          disabled={isPast}
        >
          {timeProgress > 0 && !isPast && !isMissed && !isCompleted && (
            <>
              <div className="absolute transition-all duration-300 ease-out" style={{ ...fillStyle, background: fillGradient, opacity: 0.85 }} />
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-white drop-shadow-lg block">{Math.round(timeProgress)}%</span>
                  <span className="text-[6px] text-white/70 block -mt-0.5">time</span>
                </div>
              </div>
            </>
          )}
          
          {timeProgress === 0 && !isPast && !isOngoing && !isCompleted && !isMissed && (
            <div className="absolute inset-0 flex items-center justify-center opacity-30"><Battery size={20} className="text-slate-400" /></div>
          )}
          
          <div className="relative z-10 p-1.5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium truncate text-white max-w-[60px]">
                {isRescheduledTask ? '↻ ' : ''}{localTask.title ? localTask.title.slice(0, 8) : 'Task'}
              </p>
              <div className="flex items-center gap-0.5">{getStatusIcon()}</div>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-0.5"><Clock size={7} className="text-slate-400" /><span className="text-[8px] font-mono text-slate-300">{localTask.startTime}</span></div>
              {delayMinutes > 0 && isOngoing && <span className="text-[6px] text-orange-400 font-bold">{delayMinutes}m late</span>}
              {localTask.rescheduleCount > 0 && <span className="text-[6px] text-yellow-500">R{localTask.rescheduleCount}</span>}
              {rescheduledTo && <span className="text-[6px] text-yellow-500">→ {rescheduledTo}</span>}
              {isRescheduledTask && <span className="text-[6px] text-cyan-400 font-bold">Rescheduled</span>}
              {isOriginalRescheduled && <span className="text-[6px] text-yellow-500 font-bold">Rescheduled</span>}
              {isCompleted && localTask.completionType && !isDishonest && (
                <span className={`text-[6px] font-bold ${
                  localTask.completionType === 'early' ? 'text-green-400' : 
                  localTask.completionType === 'on_time' ? 'text-blue-400' : 'text-orange-400'
                }`}>
                  {localTask.completionType === 'early' ? 'Early' : localTask.completionType === 'on_time' ? 'On Time' : 'Late'}
                </span>
              )}
              {isDishonest && <span className="text-[6px] text-orange-500 font-bold">Dishonest</span>}
              {isPending && isTimePassed && !isCompleted && !isMissed && <span className="text-[6px] text-red-400 font-bold">Late</span>}
            </div>
          </div>
        </button>
      </div>
      
      {popupContent}
      {completionConfirmContent}
      
      <TaskModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} task={localTask} weekId={weekId} onUpdate={onUpdate} theme={theme} />
    </>
  );
}
