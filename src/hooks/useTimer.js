// src/hooks/useTimer.js - Enhanced with scheduled task support
import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = (task, onComplete) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const totalSecondsRef = useRef(0);
  
  const calculateTotalSeconds = useCallback((startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startSeconds = startHour * 3600 + startMin * 60;
    const endSeconds = endHour * 3600 + endMin * 60;
    return endSeconds - startSeconds;
  }, []);
  
  // Calculate if task is starting late
  const calculateLateStart = useCallback(() => {
    if (!task) return 0;
    
    const now = new Date();
    const [startHour, startMin] = task.startTime.split(':').map(Number);
    const scheduledStart = new Date();
    scheduledStart.setHours(startHour, startMin, 0, 0);
    
    if (now > scheduledStart) {
      const lateMs = now - scheduledStart;
      const lateSecs = Math.floor(lateMs / 1000);
      const lateMins = Math.floor(lateSecs / 60);
      return { lateSecs, lateMins };
    }
    return { lateSecs: 0, lateMins: 0 };
  }, [task]);
  
  // Initialize or resume timer from saved state
  const initializeTimer = useCallback(() => {
    if (!task) return;
    
    const totalSeconds = calculateTotalSeconds(task.startTime, task.endTime);
    totalSecondsRef.current = totalSeconds;
    
    // Check if task was already started (e.g., from database)
    if (task.status === 'active' && task.actualStart) {
      const actualStart = new Date(task.actualStart);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - actualStart) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      const currentProgress = (elapsedSeconds / totalSeconds) * 100;
      
      setTimeRemaining(remaining);
      setProgress(Math.min(100, currentProgress));
      setIsActive(true);
      
      // Check if already completed
      if (remaining <= 0 && onComplete) {
        onComplete();
        setIsActive(false);
      }
    } else {
      // Not started yet - check if we're late
      const { lateSecs, lateMins } = calculateLateStart();
      if (lateSecs > 0) {
        setIsLate(true);
        setLateMinutes(lateMins);
        // Adjust remaining time for late start
        const adjustedRemaining = Math.max(0, totalSeconds - lateSecs);
        setTimeRemaining(adjustedRemaining);
        setProgress((lateSecs / totalSeconds) * 100);
      } else {
        setTimeRemaining(totalSeconds);
        setProgress(0);
      }
    }
  }, [task, calculateTotalSeconds, calculateLateStart, onComplete]);
  
  const startTimer = useCallback(() => {
    if (!task || isActive) return;
    
    const totalSeconds = calculateTotalSeconds(task.startTime, task.endTime);
    totalSecondsRef.current = totalSeconds;
    
    const now = new Date();
    startTimeRef.current = now;
    
    // Calculate if starting late
    const { lateSecs, lateMins } = calculateLateStart();
    let adjustedRemaining = totalSeconds;
    
    if (lateSecs > 0) {
      setIsLate(true);
      setLateMinutes(lateMins);
      adjustedRemaining = Math.max(0, totalSeconds - lateSecs);
      setTimeRemaining(adjustedRemaining);
      setProgress((lateSecs / totalSeconds) * 100);
    } else {
      setTimeRemaining(totalSeconds);
      setProgress(0);
    }
    
    setIsActive(true);
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    let lastElapsed = lateSecs;
    
    intervalRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      
      const currentElapsed = (new Date() - startTimeRef.current) / 1000 + lateSecs;
      const remaining = Math.max(0, totalSeconds - currentElapsed);
      const currentProgress = (currentElapsed / totalSeconds) * 100;
      
      setTimeRemaining(remaining);
      setProgress(Math.min(100, currentProgress));
      
      // Check for completion
      if (remaining <= 0 && currentElapsed >= totalSeconds) {
        clearInterval(intervalRef.current);
        setIsActive(false);
        if (onComplete) onComplete();
      }
    }, 100);
  }, [task, isActive, calculateTotalSeconds, calculateLateStart, onComplete]);
  
  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
  }, []);
  
  const resumeTimer = useCallback(() => {
    if (!task || isActive) return;
    
    if (timeRemaining > 0) {
      // Resume with remaining time
      const now = new Date();
      startTimeRef.current = now;
      setIsActive(true);
      
      let lastRemaining = timeRemaining;
      
      intervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        
        const elapsed = (new Date() - startTimeRef.current) / 1000;
        const remaining = Math.max(0, lastRemaining - elapsed);
        const currentProgress = ((totalSecondsRef.current - remaining) / totalSecondsRef.current) * 100;
        
        setTimeRemaining(remaining);
        setProgress(Math.min(100, currentProgress));
        
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          setIsActive(false);
          if (onComplete) onComplete();
        }
      }, 100);
    }
  }, [task, isActive, timeRemaining, onComplete]);
  
  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    setIsActive(false);
    setIsLate(false);
    setLateMinutes(0);
    
    if (task) {
      const totalSeconds = calculateTotalSeconds(task.startTime, task.endTime);
      setTimeRemaining(totalSeconds);
      setProgress(0);
    } else {
      setTimeRemaining(0);
      setProgress(0);
    }
  }, [task, calculateTotalSeconds]);
  
  // Initialize timer when task changes
  useEffect(() => {
    if (task) {
      initializeTimer();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [task, initializeTimer]);
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getTimeRemainingPercent = () => {
    if (totalSecondsRef.current === 0) return 0;
    return (timeRemaining / totalSecondsRef.current) * 100;
  };
  
  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    progress,
    isActive,
    isLate,
    lateMinutes,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    getTimeRemainingPercent,
    totalSeconds: totalSecondsRef.current
  };
};