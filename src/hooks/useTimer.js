import { useState, useEffect, useRef } from 'react';

export const useTimer = (task, onComplete) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);
  
  const calculateTotalSeconds = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startSeconds = startHour * 3600 + startMin * 60;
    const endSeconds = endHour * 3600 + endMin * 60;
    return endSeconds - startSeconds;
  };
  
  const startTimer = () => {
    if (!task) return;
    
    const totalSeconds = calculateTotalSeconds(task.startTime, task.endTime);
    setTimeRemaining(totalSeconds);
    setIsActive(true);
    
    const startTime = new Date();
    
    intervalRef.current = setInterval(() => {
      const elapsed = (new Date() - startTime) / 1000;
      const remaining = Math.max(0, totalSeconds - elapsed);
      const currentProgress = (elapsed / totalSeconds) * 100;
      
      setTimeRemaining(remaining);
      setProgress(Math.min(100, currentProgress));
      
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setIsActive(false);
        if (onComplete) onComplete();
      }
    }, 100);
  };
  
  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      setIsActive(false);
    }
  };
  
  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setTimeRemaining(0);
    setProgress(0);
    setIsActive(false);
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    progress,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer
  };
};
