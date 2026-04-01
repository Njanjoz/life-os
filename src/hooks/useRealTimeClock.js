import { useState, useEffect, useRef } from 'react';

export const useRealTimeClock = (updateInterval = 100) => {
  const [now, setNow] = useState(new Date());
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');
  const [isPastTime, setIsPastTime] = useState(false);
  const animationFrameRef = useRef();

  useEffect(() => {
    let lastTimestamp = performance.now();
    
    const updateTime = (timestamp) => {
      const delta = timestamp - lastTimestamp;
      if (delta >= updateInterval) {
        const currentTime = new Date();
        setNow(currentTime);
        setTimeString(currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setDateString(currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
        lastTimestamp = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateTime);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateInterval]);

  // Check if a given time is in the past for a specific date
  const isTimePast = (day, time, selectedDate) => {
    const now = new Date();
    const taskDate = new Date(selectedDate);
    
    // Get the actual date for the day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayOffset = days.indexOf(day);
    const startOfWeek = new Date(selectedDate);
    const diff = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayOffset);
    
    const [hour, minute] = time.split(':').map(Number);
    targetDate.setHours(hour, minute, 0, 0);
    
    return targetDate < now;
  };

  // Check if a date is in the past
  const isDatePast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  // Check if a specific day of current week is in the past
  const isDayPast = (dayName) => {
    const now = new Date();
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = now.getDay();
    const todayName = days[todayIndex === 0 ? 6 : todayIndex - 1];
    const targetIndex = days.indexOf(dayName);
    
    if (targetIndex < days.indexOf(todayName)) return true;
    if (targetIndex === days.indexOf(todayName)) {
      // Same day, check if current time has passed
      return false; // We'll handle time separately
    }
    return false;
  };

  // Get current hour and minute for display
  const getCurrentTimePosition = () => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return { hours, minutes, timeString: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` };
  };

  return { 
    now, 
    timeString, 
    dateString, 
    isTimePast, 
    isDatePast, 
    isDayPast,
    getCurrentTimePosition,
    currentHour: now.getHours(),
    currentMinute: now.getMinutes(),
    currentSecond: now.getSeconds()
  };
};
