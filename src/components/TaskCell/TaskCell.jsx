import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Check, RotateCcw, Edit2, X, Clock, AlertTriangle, Battery, Zap, Calendar } from 'lucide-react';
import { startTask, completeTask, rescheduleTask, rescheduleToNow } from '../../services/firebaseTaskService';
import { TaskModal } from '../TaskModal/TaskModal';

export default function TaskCell({ task, weekId, now, selectedDate, onUpdate, theme, isPast = false, viewMode = 'week' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  const [fillPercentage, setFillPercentage] = useState(0);
  const [delayColor, setDelayColor] = useState('');
  const [localTask, setLocalTask] = useState(task);
  const popupRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => { setLocalTask(task); }, [task]);

  // Calculate fill percentage based on actual progress
  useEffect(() => {
    if (!localTask || isPast) return;
    
    const updateFill = () => {
      const nowTime = Date.now();
      
      if (localTask.status === 'completed') {
        setFillPercentage(100);
        return;
      }
      
      if (localTask.status === 'missed') {
        setFillPercentage(0);
        return;
      }
      
      // If task is active with actual start time
      if (localTask.actualStart && localTask.status === 'active') {
        const actualStart = new Date(localTask.actualStart);
        const end = new Date(selectedDate);
        const [endHour, endMin] = localTask.endTime.split(':').map(Number);
        end.setHours(endHour, endMin, 0, 0);
        const total = end - actualStart;
        const elapsed = nowTime - actualStart;
        let progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
        setFillPercentage(progress);
      } 
      // If task is within its scheduled time but not started
      else {
        const start = new Date(selectedDate);
        const [startHour, startMin] = localTask.startTime.split(':').map(Number);
        start.setHours(startHour, startMin, 0, 0);
        const end = new Date(selectedDate);
        const [endHour, endMin] = localTask.endTime.split(':').map(Number);
        end.setHours(endHour, endMin, 0, 0);
        
        const isWithinTime = nowTime >= start && nowTime <= end;
        
        if (isWithinTime && localTask.status === 'pending') {
          // Time is passing but task not started - show time elapsed
          const total = end - start;
          const elapsed = nowTime - start;
          let progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
          setFillPercentage(progress);
        } else if (localTask.status === 'pending') {
          setFillPercentage(0);
        } else if (localTask.status === 'active') {
          // Active task without actual start (should not happen)
          setFillPercentage(0);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(updateFill);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateFill);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [localTask, selectedDate, isPast]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsExpanded(false);
        setShowReschedule(false);
        setShowManualEntry(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  const handleStart = useCallback(async () => {
    if (!isPast && localTask && localTask.status !== 'active' && localTask.status !== 'completed') {
      await startTask(localTask.id);
      onUpdate();
      setIsExpanded(false);
    }
  }, [isPast, localTask, onUpdate]);

  const handleComplete = useCallback(async () => {
    if (!isPast && localTask && localTask.status === 'active') {
      await completeTask(localTask.id);
      onUpdate();
      setIsExpanded(false);
    }
  }, [isPast, localTask, onUpdate]);

  const handleManualComplete = useCallback(async () => {
    if (manualStart && manualEnd) {
      const startTime = new Date(`${selectedDate.toDateString()} ${manualStart}`);
      const endTime = new Date(`${selectedDate.toDateString()} ${manualEnd}`);
      await completeTask(localTask.id, endTime);
      onUpdate();
      setShowManualEntry(false);
      setIsExpanded(false);
    }
  }, [manualStart, manualEnd, localTask, selectedDate, onUpdate]);

  const handleRescheduleAction = useCallback(async () => {
    if (!isPast && localTask) {
      await rescheduleTask(localTask.id, newDay, newTime, `${parseInt(newTime.split(':')[0])+1}:00`);
      setShowReschedule(false);
      onUpdate();
      setIsExpanded(false);
    }
  }, [isPast, localTask, newDay, newTime, onUpdate]);

  const handleRescheduleToNow = useCallback(async () => {
    if (!isPast && localTask) {
      await rescheduleToNow(localTask.id);
      onUpdate();
      setShowReschedule(false);
      setIsExpanded(false);
    }
  }, [isPast, localTask, onUpdate]);

  const handleEdit = useCallback(() => {
    if (!isPast) {
      setShowEditModal(true);
      setIsExpanded(false);
    }
  }, [isPast]);

  if (!localTask) return null;

  const getStatusColor = () => {
    if (isPast) return 'border-slate-600 bg-slate-800/50 opacity-60';
    if (localTask.status === 'completed') return 'border-green-500 bg-green-500/20';
    if (localTask.status === 'missed') return 'border-red-500 bg-red-500/20';
    if (localTask.status === 'active') return `border-purple-500 bg-purple-500/20 ${delayColor}`;
    return 'border-blue-500/50 bg-blue-500/10';
  };

  const getStatusIcon = () => {
    if (localTask.status === 'completed') return <Check size={10} className="text-green-500" />;
    if (localTask.status === 'missed') return <X size={10} className="text-red-500" />;
    if (localTask.status === 'active') return <Zap size={10} className="text-purple-500 animate-pulse" />;
    return <Battery size={10} className="text-blue-500" />;
  };

  const isTaskTimePassed = () => {
    const [endHour, endMin] = localTask.endTime.split(':').map(Number);
    const taskEnd = new Date(selectedDate);
    taskEnd.setHours(endHour, endMin, 0, 0);
    return now > taskEnd && localTask.status !== 'completed' && localTask.status !== 'missed';
  };

  const isTaskActiveTime = () => {
    const [startHour, startMin] = localTask.startTime.split(':').map(Number);
    const [endHour, endMin] = localTask.endTime.split(':').map(Number);
    const taskStart = new Date(selectedDate);
    taskStart.setHours(startHour, startMin, 0, 0);
    const taskEnd = new Date(selectedDate);
    taskEnd.setHours(endHour, endMin, 0, 0);
    return now >= taskStart && now <= taskEnd;
  };

  const canStartBeforeTime = () => {
    const [startHour, startMin] = localTask.startTime.split(':').map(Number);
    const taskStart = new Date(selectedDate);
    taskStart.setHours(startHour, startMin, 0, 0);
    return now < taskStart && localTask.status === 'pending';
  };

  // Determine fill direction based on view mode
  const isHorizontal = viewMode === 'day';
  const fillStyle = isHorizontal 
    ? { width: `${fillPercentage}%`, height: '100%', left: 0, top: 0 }
    : { height: `${fillPercentage}%`, width: '100%', bottom: 0, left: 0 };

  const fillGradient = isHorizontal
    ? `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`
    : `linear-gradient(0deg, ${theme.primary}, ${theme.secondary})`;

  return (
    <>
      <div className="relative h-full">
        <button
          onClick={() => !isPast && setIsExpanded(!isExpanded)}
          className={`w-full h-12 rounded-lg border relative overflow-hidden transition-all duration-200 text-left ${!isPast ? 'cursor-pointer' : 'cursor-default'} ${getStatusColor()}`}
          disabled={isPast}
        >
          {/* Battery Fill Animation */}
          {fillPercentage > 0 && !isPast && localTask.status !== 'missed' && (
            <>
              <div 
                className="absolute transition-all duration-300 ease-out"
                style={{ ...fillStyle, background: fillGradient, opacity: 0.85 }}
              />
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="text-[11px] font-bold text-white drop-shadow-lg">
                  {Math.round(fillPercentage)}%
                </span>
              </div>
            </>
          )}
          
          {/* Battery Icon overlay when not filling */}
          {fillPercentage === 0 && !isPast && localTask.status !== 'active' && localTask.status !== 'completed' && localTask.status !== 'missed' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <Battery size={20} className="text-slate-400" />
            </div>
          )}
          
          <div className="relative z-10 p-1.5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium truncate text-white max-w-[45px]">
                {localTask.title ? localTask.title.slice(0, 6) : 'Task'}
              </p>
              <div className="flex items-center gap-0.5">
                {getStatusIcon()}
              </div>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-0.5">
                <Clock size={7} className="text-slate-400" />
                <span className="text-[7px] font-mono text-slate-300">{localTask.startTime}</span>
              </div>
              {localTask.delay > 0 && localTask.status === 'active' && (
                <span className="text-[6px] text-red-400 font-bold">{Math.round(localTask.delay)}m late</span>
              )}
              {localTask.rescheduleCount > 0 && <span className="text-[6px] text-yellow-500">R{localTask.rescheduleCount}</span>}
            </div>
          </div>
        </button>
        
        {isExpanded && !isPast && (
          <div ref={popupRef} className="absolute bottom-full left-0 right-0 mb-1 z-30 animate-slide-up">
            <div className="bg-slate-900/98 backdrop-blur-2xl rounded-xl border border-white/20 shadow-2xl overflow-hidden min-w-[200px]">
              <div className="p-2 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white">{localTask.title}</h3>
                    <p className="text-[9px] text-slate-400"><Clock size={8} className="inline mr-0.5" />{localTask.startTime} - {localTask.endTime}</p>
                    {localTask.delay > 0 && localTask.status === 'active' && (
                      <p className="text-[8px] text-red-400 mt-0.5">Started {Math.round(localTask.delay)} min late</p>
                    )}
                  </div>
                  <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-white p-0.5 rounded"><X size={12} /></button>
                </div>
              </div>
              
              {/* Battery Percentage Display */}
              <div className="p-2 bg-slate-800/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] text-slate-400">Progress</span>
                  <span className="text-xs font-bold text-white">{Math.round(fillPercentage)}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${fillPercentage}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }} />
                </div>
              </div>
              
              {localTask.accuracy > 0 && localTask.status === 'completed' && (
                <div className="p-2 bg-green-500/10 border-b border-green-500/20">
                  <p className="text-[9px] text-green-400 flex items-center gap-1">
                    <Check size={10} />
                    Accuracy Score: {Math.round(localTask.accuracy)}%
                  </p>
                </div>
              )}
              
              {canStartBeforeTime() && (
                <div className="p-2 bg-yellow-500/10 border-b border-yellow-500/20">
                  <p className="text-[9px] text-yellow-400 flex items-center gap-1">
                    <Clock size={10} />
                    Task starts at {localTask.startTime}
                  </p>
                </div>
              )}
              
              {isTaskTimePassed() && localTask.status !== 'completed' && localTask.status !== 'missed' && (
                <div className="p-2 bg-red-500/10 border-b border-red-500/20">
                  <p className="text-[9px] text-red-400 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Time has passed! Mark as done or it will be marked missed.
                  </p>
                </div>
              )}
              
              <div className="p-2 grid grid-cols-2 gap-1">
                {localTask.status !== 'completed' && localTask.status !== 'missed' && localTask.status !== 'active' && (
                  <button onClick={handleStart} className="py-1 rounded text-[9px] flex items-center justify-center gap-0.5 text-white bg-green-600"><Play size={8} /> Start Task</button>
                )}
                {localTask.status === 'active' && (
                  <button onClick={handleComplete} className="py-1 rounded bg-purple-600 text-[9px] text-white"><Check size={8} className="inline mr-0.5" /> Complete</button>
                )}
                {isTaskTimePassed() && localTask.status !== 'completed' && localTask.status !== 'missed' && (
                  <button onClick={() => setShowManualEntry(true)} className="py-1 rounded bg-orange-600 text-[9px] text-white"><Calendar size={8} className="inline mr-0.5" /> Manual Entry</button>
                )}
                <button onClick={() => setShowReschedule(!showReschedule)} className="py-1 rounded bg-yellow-600 text-[9px] text-white"><RotateCcw size={8} className="inline mr-0.5" /> Reschedule</button>
                <button onClick={handleEdit} className="py-1 rounded bg-blue-600 text-[9px] text-white"><Edit2 size={8} className="inline mr-0.5" /> Edit</button>
              </div>
              
              {showReschedule && (
                <div className="p-2 pt-0 border-t border-white/10">
                  <div className="bg-slate-800/50 rounded p-2 space-y-1">
                    <button onClick={handleRescheduleToNow} className="w-full py-1 rounded bg-green-600/50 text-[9px] text-white hover:bg-green-600 transition">
                      Reschedule to now ({new Date().toLocaleTimeString().slice(0,5)})
                    </button>
                    <select value={newDay} onChange={(e) => setNewDay(e.target.value)} className="w-full p-1 text-[9px] rounded bg-slate-800 border border-white/10 text-white">
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d.slice(0,3)}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1 p-1 text-[9px] rounded bg-slate-800 border border-white/10 text-white" />
                      <button onClick={handleRescheduleAction} className="px-2 py-1 rounded bg-yellow-600 text-[9px] text-white">Confirm</button>
                    </div>
                  </div>
                </div>
              )}
              
              {showManualEntry && (
                <div className="p-2 pt-0 border-t border-white/10">
                  <div className="bg-slate-800/50 rounded p-2 space-y-1">
                    <p className="text-[8px] text-slate-400">Enter actual times</p>
                    <input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} placeholder="Start time" className="w-full p-1 text-[9px] rounded bg-slate-800 border border-white/10 text-white" />
                    <input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} placeholder="End time" className="w-full p-1 text-[9px] rounded bg-slate-800 border border-white/10 text-white" />
                    <button onClick={handleManualComplete} className="w-full py-1 rounded bg-orange-600 text-[9px] text-white">Save</button>
                  </div>
                </div>
              )}
              
              <div className="p-2 pt-0">
                {localTask.status === 'missed' && (
                  <button onClick={() => setShowManualEntry(true)} className="w-full py-1 rounded bg-orange-600 text-[9px] text-white mb-1">Mark as Done (Manual)</button>
                )}
                <button onClick={() => setIsExpanded(false)} className="w-full py-1 rounded bg-slate-700 text-[9px] text-white">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <TaskModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} task={localTask} weekId={weekId} onUpdate={onUpdate} theme={theme} />
    </>
  );
}
