// src/hooks/useNotifications.js
import { useEffect, useCallback, useRef } from 'react';
import { 
  requestNotificationPermission,
  notifyTaskStart,
  notifyTaskComplete,
  notifyTaskOverdue,
  notifyTaskRescheduled,
  notifyUpcomingTask
} from '../services/notificationService';

export const useNotifications = (tasks = []) => {
  const notifiedOverdueTasks = useRef(new Set());
  const reminderIntervals = useRef(new Map());

  // Request permissions on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Check for overdue tasks
  useEffect(() => {
    const checkOverdueTasks = () => {
      const now = new Date();
      
      tasks.forEach(task => {
        if (task.status === 'pending' && task.endTime) {
          const endTime = new Date(task.endTime);
          
          if (endTime < now && !notifiedOverdueTasks.current.has(task.id)) {
            notifyTaskOverdue(task.title, task.endTime);
            notifiedOverdueTasks.current.add(task.id);
          }
        }
      });
    };
    
    checkOverdueTasks();
    const interval = setInterval(checkOverdueTasks, 60000);
    
    return () => clearInterval(interval);
  }, [tasks]);

  // Set up reminders for upcoming tasks
  useEffect(() => {
    // Clear existing reminders
    reminderIntervals.current.forEach(clearTimeout);
    reminderIntervals.current.clear();
    
    const now = new Date();
    
    tasks.forEach(task => {
      if (task.status === 'pending' && task.startTime) {
        const startTime = new Date(task.startTime);
        const timeUntilStart = startTime - now;
        
        // Set reminder 5 minutes before start
        if (timeUntilStart > 0 && timeUntilStart <= 5 * 60 * 1000) {
          const reminderId = setTimeout(() => {
            notifyUpcomingTask(task.title, task.startTime, 5);
          }, timeUntilStart);
          
          reminderIntervals.current.set(task.id, reminderId);
        }
      }
    });
    
    return () => {
      reminderIntervals.current.forEach(clearTimeout);
      reminderIntervals.current.clear();
    };
  }, [tasks]);

  const notifyStart = useCallback((taskTitle, startTime) => {
    notifyTaskStart(taskTitle, startTime);
  }, []);

  const notifyComplete = useCallback((taskTitle, completionType, bonus = null) => {
    notifyTaskComplete(taskTitle, completionType, bonus);
  }, []);

  const notifyReschedule = useCallback((taskTitle, oldStartTime, newStartTime, oldEndTime, newEndTime) => {
    notifyTaskRescheduled(taskTitle, oldStartTime, newStartTime, oldEndTime, newEndTime);
  }, []);

  return {
    notifyStart,
    notifyComplete,
    notifyReschedule,
    requestPermission: requestNotificationPermission
  };
};
