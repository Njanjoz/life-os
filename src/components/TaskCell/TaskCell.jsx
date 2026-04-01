import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, RotateCcw, Edit2, X } from 'lucide-react';
import { startTask, completeTask, rescheduleTask } from '../../services/firebaseTaskService';
import { TaskModal } from '../TaskModal/TaskModal';

export const TaskCell = ({ task, weekId, now, selectedDate, onUpdate, theme, isPast = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDay, setNewDay] = useState(task?.day || 'Monday');
  const [newTime, setNewTime] = useState(task?.startTime || '08:00');
  const [fillPercentage, setFillPercentage] = useState(0);
  const [pressureIntensity, setPressureIntensity] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const popupRef = useRef(null);

  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsExpanded(false);
        setShowReschedule(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate times based on actual date
  const start = new Date(selectedDate);
  const [startHour, startMin] = localTask?.startTime?.split(':').map(Number) || [8, 0];
  start.setHours(startHour, startMin, 0, 0);
  
  const end = new Date(selectedDate);
  const [endHour, endMin] = localTask?.endTime?.split(':').map(Number) || [10, 0];
  end.setHours(endHour, endMin, 0, 0);

  // Determine task state based on real time
  const isActive = !isPast && (localTask?.status === 'active' || (now >= start && now <= end && localTask?.status !== 'completed'));
  const isExpired = now > end && localTask?.status !== 'completed' && localTask?.status !== 'missed';
  const isLate = (localTask?.delay || 0) > 5 && (localTask?.delay || 0) < 30;
  const isVeryLate = (localTask?.delay || 0) >= 30;

  // Calculate fill percentage based on real time
  useEffect(() => {
    if (!localTask) return;
    
    if (localTask.status === 'completed') {
      setFillPercentage(100);
    } else if (localTask.status === 'missed' || isExpired) {
      setFillPercentage(100);
    } else if (isActive && !localTask.actualStart) {
      const total = end - start;
      const elapsed = now - start;
      let progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      if (localTask.delay > 0) {
        progress = Math.min(100, progress * (1 - (localTask.delay / 100)));
      }
      setFillPercentage(progress);
    } else if (localTask.actualStart && localTask.status === 'active') {
      const actualStart = new Date(localTask.actualStart);
      const total = end - actualStart;
      const elapsed = now - actualStart;
      setFillPercentage(Math.min(100, Math.max(0, (elapsed / total) * 100)));
    } else {
      setFillPercentage(0);
    }
  }, [now, localTask, start, end, isActive, isExpired]);

  // Calculate pressure intensity for late tasks
  useEffect(() => {
    if (isLate && isActive && !isPast) {
      const intensity = Math.min(1, (localTask?.delay || 0) / 30);
      setPressureIntensity(intensity);
      setIsShaking(intensity > 0.5);
    } else {
      setPressureIntensity(0);
      setIsShaking(false);
    }
  }, [isLate, isVeryLate, isActive, localTask?.delay, isPast]);

  const getFillColor = () => {
    if (localTask?.status === 'completed') return 'linear-gradient(135deg, #22c55e, #15803d)';
    if (localTask?.status === 'missed' || isExpired) return 'linear-gradient(135deg, #ef4444, #991b1b)';
    if (isVeryLate && !isPast) return 'linear-gradient(135deg, #dc2626, #7f1a1a)';
    if (isLate && !isPast) return 'linear-gradient(135deg, #eab308, #ca8a04)';
    if (isActive && !isPast) return `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`;
    return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
  };

  const getStatusColor = () => {
    if (isPast) return 'border-slate-600 bg-slate-800/50 opacity-70';
    if (localTask?.status === 'completed') return 'border-green-500 bg-green-500/20';
    if (localTask?.status === 'missed' || isExpired) return 'border-red-500 bg-red-500/20';
    if (isActive) return `border-purple-500 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]`;
    return 'border-blue-500/50 bg-blue-500/10';
  };

  const getGlowEffect = () => {
    if (isPast) return 'none';
    if (localTask?.status === 'completed') return '0 0 20px rgba(34,197,94,0.5)';
    if (isVeryLate) return '0 0 20px rgba(239,68,68,0.8)';
    if (isLate) return '0 0 15px rgba(234,179,8,0.5)';
    if (isActive && fillPercentage > 50) return `0 0 20px ${theme.primary}80`;
    return 'none';
  };

  const handleStart = async () => {
    if (!isPast && localTask && localTask.status !== 'active') {
      await startTask(localTask.id);
      onUpdate();
      setIsExpanded(false);
    }
  };

  const handleComplete = async () => {
    if (!isPast && localTask && localTask.status === 'active') {
      await completeTask(localTask.id);
      onUpdate();
      setIsExpanded(false);
    }
  };

  const handleReschedule = async () => {
    if (!isPast && localTask) {
      await rescheduleTask(localTask.id, newDay, newTime, `${parseInt(newTime.split(':')[0])+1}:00`);
      setShowReschedule(false);
      onUpdate();
      setIsExpanded(false);
    }
  };

  const handleEdit = () => {
    if (!isPast) {
      setShowEditModal(true);
      setIsExpanded(false);
    }
  };

  if (!localTask) return null;

  const getCategoryIcon = () => {
    const icons = {
      'Study': '📚',
      'Exam Revision': '📝',
      'Break': '☕',
      'Exercise': '💪',
      'Work': '💼',
      'Personal': '🧘',
      'Meeting': '👥',
      'Review': '🔄'
    };
    return icons[localTask.category] || '📌';
  };

  const getStatusText = () => {
    if (localTask.status === 'completed') return '✓ Completed';
    if (localTask.status === 'missed') return '✗ Missed';
    if (localTask.status === 'active') return '● Active';
    return '○ Pending';
  };

  const getStatusIcon = () => {
    if (localTask.status === 'completed') return <Check size={12} className="text-green-500" />;
    if (localTask.status === 'missed') return <X size={12} className="text-red-500" />;
    if (localTask.status === 'active') return <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />;
    return <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />;
  };

  return (
    <>
      <div className="relative h-full">
        {/* Task Button */}
        <button
          onClick={() => !isPast && setIsExpanded(!isExpanded)}
          className={`w-full h-full min-h-[70px] rounded-xl border-2 relative overflow-hidden transition-all duration-300 ${!isPast ? 'cursor-pointer' : 'cursor-default'} ${getStatusColor()}`}
          style={{
            boxShadow: getGlowEffect()
          }}
          disabled={isPast}
        >
          {/* Time Fill Layer */}
          {isActive && !isPast && (
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out"
              style={{
                height: `${fillPercentage}%`,
                background: getFillColor(),
                opacity: 0.85
              }}
            />
          )}

          {/* Pressure Overlay */}
          {pressureIntensity > 0 && !isPast && (
            <div
              className="absolute top-0 left-0 right-0 transition-all duration-500 ease-out"
              style={{
                height: `${pressureIntensity * 100}%`,
                background: 'linear-gradient(180deg, rgba(239,68,68,0.4), rgba(239,68,68,0))',
                opacity: pressureIntensity * 0.6
              }}
            />
          )}

          {/* Live Time Cursor */}
          {isActive && !isPast && fillPercentage > 0 && fillPercentage < 100 && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-20 animate-pulse"
              style={{
                top: `${fillPercentage}%`,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${theme.primary}, transparent)`,
                boxShadow: `0 0 10px ${theme.primary}`,
                transform: 'translateY(-50%)'
              }}
            />
          )}

          {/* Content */}
          <div className="relative z-10 p-2 text-left h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[10px]">{getCategoryIcon()}</span>
                <p className="text-[9px] text-slate-400 font-mono">{localTask.startTime}</p>
              </div>
              <p className="text-xs font-medium truncate mt-0.5 text-white">
                {localTask.title || 'Untitled Task'}
              </p>
              {localTask.subcategory && localTask.subcategory !== 'General' && (
                <p className="text-[8px] text-slate-500 truncate">{localTask.subcategory}</p>
              )}
            </div>
            
            <div className="flex justify-between items-center mt-1">
              <div className="flex gap-0.5">
                {localTask.rescheduleCount > 0 && (
                  <span className="text-[8px] text-yellow-500">🔄{localTask.rescheduleCount}</span>
                )}
                {localTask.delay > 0 && localTask.delay < 30 && !isPast && (
                  <span className="text-[8px] text-orange-500 animate-pulse">⏰{Math.round(localTask.delay)}m</span>
                )}
              </div>
              {getStatusIcon()}
            </div>
          </div>
        </button>

        {/* Popup - Expands UPWARD from the task */}
        {isExpanded && !isPast && (
          <div 
            ref={popupRef}
            className="absolute bottom-full left-0 right-0 mb-2 z-30 animate-slide-up"
          >
            <div className="bg-slate-900/98 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getCategoryIcon()}</span>
                    <h3 className="font-semibold text-white">{localTask.title}</h3>
                  </div>
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
                {localTask.subcategory && localTask.subcategory !== 'General' && (
                  <p className="text-xs text-purple-400 mt-1 ml-7">{localTask.subcategory}</p>
                )}
              </div>

              {/* Stats Grid */}
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-white/10">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">Progress</p>
                  <p className="text-lg font-bold text-white">{Math.round(fillPercentage)}%</p>
                  <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${fillPercentage}%` }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">Status</p>
                  <p className="text-sm font-medium text-white">{getStatusText()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">Time</p>
                  <p className="text-sm font-mono text-white">{localTask.startTime} - {localTask.endTime}</p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/10">
                {localTask.delay !== 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Delay:</span>
                    <span className={`text-xs font-medium ${localTask.delay > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {Math.round(localTask.delay)} min
                    </span>
                  </div>
                )}
                {localTask.accuracy > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Accuracy:</span>
                    <span className="text-xs font-medium text-cyan-400">{Math.round(localTask.accuracy)}%</span>
                  </div>
                )}
                {localTask.timeSpent > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Time Spent:</span>
                    <span className="text-xs font-medium text-white">{Math.round(localTask.timeSpent)} min</span>
                  </div>
                )}
                {localTask.rescheduleCount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Reschedules:</span>
                    <span className="text-xs font-medium text-yellow-500">{localTask.rescheduleCount}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 grid grid-cols-2 gap-2">
                {localTask.status !== 'completed' && localTask.status !== 'missed' && !isExpired && localTask.status !== 'active' && (
                  <button 
                    onClick={handleStart} 
                    className="py-2 rounded-xl text-xs flex items-center justify-center gap-1 text-white bg-green-600 hover:bg-green-700 transition-all"
                  >
                    <Play size={12} /> Start Task
                  </button>
                )}
                {isActive && (
                  <button 
                    onClick={handleComplete} 
                    className="py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs flex items-center justify-center gap-1 text-white transition-all"
                  >
                    <Check size={12} /> Complete Task
                  </button>
                )}
                <button 
                  onClick={handleEdit}
                  className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs flex items-center justify-center gap-1 text-white transition-all"
                >
                  <Edit2 size={12} /> Edit Details
                </button>
                <button 
                  onClick={() => setShowReschedule(!showReschedule)} 
                  className="py-2 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-xs text-white transition-all"
                >
                  <RotateCcw size={12} className="inline mr-1" /> Move Task
                </button>
              </div>

              {/* Reschedule Section */}
              {showReschedule && (
                <div className="p-4 pt-0 border-t border-white/10">
                  <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-slate-400 mb-2">Reschedule Task</p>
                    <select 
                      value={newDay} 
                      onChange={(e) => setNewDay(e.target.value)} 
                      className="w-full p-2 text-xs rounded-lg bg-slate-800 border border-white/10 text-white"
                    >
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        value={newTime} 
                        onChange={(e) => setNewTime(e.target.value)} 
                        className="flex-1 p-2 text-xs rounded-lg bg-slate-800 border border-white/10 text-white" 
                      />
                      <button 
                        onClick={handleReschedule} 
                        className="px-3 py-2 rounded-lg bg-yellow-600 text-xs text-white hover:bg-yellow-700 transition-all"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="p-4 pt-0">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs text-white transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <TaskModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        task={localTask}
        weekId={weekId}
        onUpdate={onUpdate}
        theme={theme}
      />
    </>
  );
};
