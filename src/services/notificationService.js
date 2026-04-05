// src/services/notificationService.js - Complete notification service

// Check if browser notifications are supported and permitted
const checkNotificationSupport = () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }
  return true;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!checkNotificationSupport()) return false;
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Send a notification
const sendNotification = (title, options) => {
  if (!checkNotificationSupport()) return;
  
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, options);
    
    // Auto-close after 5 seconds unless it requires interaction
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
    
    return notification;
  }
};

// Format time display
const formatTimeDisplay = (timeValue) => {
  if (!timeValue) return 'unknown time';
  if (typeof timeValue === 'string' && timeValue.includes(':')) {
    return timeValue;
  }
  if (timeValue instanceof Date) {
    return timeValue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return String(timeValue);
};

// Get current time string
const getCurrentTime = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ============ TASK START NOTIFICATIONS ============
export const notifyTaskStart = (taskTitle, startTime) => {
  const formattedTime = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`▶ Task Started: ${taskTitle}`, {
    body: `You started "${taskTitle}" at ${currentTime}.\nScheduled: ${formattedTime}`,
    icon: '/favicon.ico',
    tag: `task-start-${taskTitle}-${Date.now()}`,
    silent: false,
    badge: '/favicon.ico'
  });
  console.log(`[Notification] Task started: ${taskTitle} at ${currentTime} (scheduled: ${formattedTime})`);
};

// ============ TASK COMPLETION NOTIFICATIONS ============
export const notifyTaskComplete = (taskTitle, completionType, bonus = null, actualTime = null) => {
  const completionTime = actualTime ? formatTimeDisplay(actualTime) : getCurrentTime();
  let body = '';
  let titlePrefix = '✓';
  
  if (completionType === 'early') {
    titlePrefix = '✓ Early';
    body = `Great job! You completed "${taskTitle}" early at ${completionTime}.`;
    if (bonus) body += ` Bonus points: ${bonus}`;
  } else if (completionType === 'on_time' || completionType === 'on-time' || completionType === 'on_time') {
    titlePrefix = '✓ On Time';
    body = `Perfect timing! You completed "${taskTitle}" on time at ${completionTime}.`;
    if (bonus) body += ` Points earned: ${bonus}`;
  } else if (completionType === 'late') {
    titlePrefix = '⚠ Late';
    body = `Task "${taskTitle}" was completed late at ${completionTime}. Consider adjusting future estimates.`;
    if (bonus) body += ` Points penalty: ${bonus}`;
  } else {
    body = `Task "${taskTitle}" completed at ${completionTime}.`;
  }
  
  sendNotification(`${titlePrefix} Task Complete: ${taskTitle}`, {
    body,
    icon: '/favicon.ico',
    tag: `task-complete-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task complete: ${taskTitle} (${completionType}) at ${completionTime}`);
};

// ============ TASK OVERDUE NOTIFICATIONS ============
export const notifyTaskOverdue = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`⚠ OVERDUE: ${taskTitle}`, {
    body: `Task "${taskTitle}" was due at ${formattedTime} and is now overdue (current time: ${currentTime}).\nPlease take action - reschedule or complete.`,
    icon: '/favicon.ico',
    tag: `task-overdue-${taskTitle}`,
    requireInteraction: true, // Stays until user interacts
  });
  console.log(`[Notification] Task overdue: ${taskTitle} (due at ${formattedTime}, now ${currentTime})`);
};

// ============ TASK RESCHEDULED NOTIFICATIONS ============
export const notifyTaskRescheduled = (taskTitle, oldStartTime, newStartTime, oldEndTime, newEndTime, newDay = null) => {
  let changes = [];
  
  if (newDay) {
    changes.push(`Day: ${newDay}`);
  }
  
  if (oldStartTime && newStartTime && oldStartTime !== newStartTime) {
    changes.push(`Start: ${formatTimeDisplay(oldStartTime)} → ${formatTimeDisplay(newStartTime)}`);
  }
  
  if (oldEndTime && newEndTime && oldEndTime !== newEndTime) {
    changes.push(`End: ${formatTimeDisplay(oldEndTime)} → ${formatTimeDisplay(newEndTime)}`);
  }
  
  if (changes.length === 0) return;
  
  sendNotification(`↻ Task Rescheduled: ${taskTitle}`, {
    body: `${changes.join(', ')}`,
    icon: '/favicon.ico',
    tag: `task-reschedule-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task rescheduled: ${taskTitle} - ${changes.join(', ')}`);
};

// ============ TASK CANCELLED / MISSED NOTIFICATIONS ============
export const notifyTaskCancelled = (taskTitle, reason = 'cancelled') => {
  const currentTime = getCurrentTime();
  
  sendNotification(`✗ Task ${reason === 'missed' ? 'Missed' : 'Cancelled'}: ${taskTitle}`, {
    body: `Task "${taskTitle}" was ${reason} at ${currentTime}.${reason === 'missed' ? ' This will affect your completion metrics.' : ''}`,
    icon: '/favicon.ico',
    tag: `task-cancel-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task ${reason}: ${taskTitle} at ${currentTime}`);
};

// ============ TASK CREATED NOTIFICATION ============
export const notifyTaskCreated = (taskTitle, day, startTime, endTime) => {
  sendNotification(`+ New Task Created: ${taskTitle}`, {
    body: `Task "${taskTitle}" scheduled for ${day} at ${formatTimeDisplay(startTime)} - ${formatTimeDisplay(endTime)}`,
    icon: '/favicon.ico',
    tag: `task-create-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task created: ${taskTitle} on ${day} at ${startTime}`);
};

// ============ TASK EDITED NOTIFICATION ============
export const notifyTaskEdited = (taskTitle, changes) => {
  if (!changes || changes.length === 0) return;
  
  sendNotification(`✎ Task Updated: ${taskTitle}`, {
    body: changes.join(', '),
    icon: '/favicon.ico',
    tag: `task-edit-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task edited: ${taskTitle} - ${changes.join(', ')}`);
};

// ============ TASK DELETED NOTIFICATION ============
export const notifyTaskDeleted = (taskTitle) => {
  sendNotification(`🗑 Task Deleted: ${taskTitle}`, {
    body: `Task "${taskTitle}" has been permanently deleted.`,
    icon: '/favicon.ico',
    tag: `task-delete-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task deleted: ${taskTitle}`);
};

// ============ UPCOMING TASK REMINDER ============
export const notifyUpcomingTask = (taskTitle, startTime, minutesBefore = 5) => {
  const timeStr = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  let message = '';
  
  if (minutesBefore === 0) {
    message = `Task "${taskTitle}" is starting NOW at ${timeStr} (current time: ${currentTime})`;
  } else {
    message = `Task "${taskTitle}" starts in ${minutesBefore} minutes at ${timeStr}`;
  }
  
  sendNotification(`🔔 Task Reminder: ${taskTitle}`, {
    body: message,
    icon: '/favicon.ico',
    tag: `task-upcoming-${taskTitle}-${minutesBefore}`,
    silent: false
  });
  
  console.log(`[Notification] Upcoming task reminder: ${taskTitle} - ${message}`);
};

// ============ TASK DELAYED NOTIFICATION ============
export const notifyTaskDelayed = (taskTitle, originalStartTime, actualStartTime, delayMinutes) => {
  const originalFormatted = formatTimeDisplay(originalStartTime);
  const actualFormatted = formatTimeDisplay(actualStartTime);
  
  sendNotification(`⏰ Task Started Late: ${taskTitle}`, {
    body: `Task "${taskTitle}" started ${delayMinutes} minutes late.\nScheduled: ${originalFormatted}\nActual: ${actualFormatted}`,
    icon: '/favicon.ico',
    tag: `task-delay-${taskTitle}-${Date.now()}`,
    silent: false
  });
  console.log(`[Notification] Task delayed: ${taskTitle} by ${delayMinutes} minutes`);
};

// ============ TASK COMPLETION REMINDER (for ongoing tasks) ============
export const notifyTaskCompletionReminder = (taskTitle, endTime) => {
  const formattedEnd = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`⏳ Task Ending Soon: ${taskTitle}`, {
    body: `Task "${taskTitle}" is scheduled to end at ${formattedEnd} (current time: ${currentTime}). Don't forget to mark it complete!`,
    icon: '/favicon.ico',
    tag: `task-reminder-${taskTitle}`,
    silent: false
  });
  console.log(`[Notification] Task completion reminder: ${taskTitle} ends at ${formattedEnd}`);
};

// ============ BATCH NOTIFICATION FOR MULTIPLE TASKS ============
export const notifyTasksSummary = (tasks) => {
  if (!tasks || tasks.length === 0) return;
  
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const ongoingTasks = tasks.filter(t => t.status === 'active');
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.isOverdue);
  
  let body = '';
  if (overdueTasks.length > 0) {
    body += `Overdue: ${overdueTasks.length}\n`;
  }
  if (ongoingTasks.length > 0) {
    body += `In Progress: ${ongoingTasks.length}\n`;
  }
  if (pendingTasks.length > 0) {
    body += `Pending: ${pendingTasks.length}\n`;
  }
  
  if (body) {
    sendNotification(`📊 Task Summary`, {
      body: body.trim(),
      icon: '/favicon.ico',
      tag: `task-summary-${Date.now()}`,
      silent: true
    });
    console.log(`[Notification] Task summary sent: ${body.trim()}`);
  }
};

// ============ TIME CHECK NOTIFICATIONS (System A - Time Arrival) ============
export const notifyTaskTimeArrived = (taskTitle, startTime) => {
  const formattedTime = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`⏰ Time to Begin: ${taskTitle}`, {
    body: `The scheduled time for "${taskTitle}" has arrived (${formattedTime}). Current time: ${currentTime}. Time to get started!`,
    icon: '/favicon.ico',
    tag: `task-time-${taskTitle}-${Date.now()}`,
    requireInteraction: false,
    silent: false
  });
  console.log(`[Notification] Task time arrived: ${taskTitle} at ${formattedTime}`);
};

export const notifyTaskTimeEnded = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`⏰ Time's Up: ${taskTitle}`, {
    body: `The scheduled time for "${taskTitle}" has ended (${formattedTime}). Current time: ${currentTime}. Time to wrap up!`,
    icon: '/favicon.ico',
    tag: `task-time-end-${taskTitle}-${Date.now()}`,
    requireInteraction: false,
    silent: false
  });
  console.log(`[Notification] Task time ended: ${taskTitle} at ${formattedTime}`);
};

// ============ OVERSIGHT NOTIFICATION (when task time has passed without action) ============
export const notifyTaskOversight = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  
  sendNotification(`⚠ Task Window Closed: ${taskTitle}`, {
    body: `Task "${taskTitle}" was scheduled to end at ${formattedTime} (current: ${currentTime}). No action was taken. The task has been marked as missed.`,
    icon: '/favicon.ico',
    tag: `task-oversight-${taskTitle}`,
    requireInteraction: true
  });
  console.log(`[Notification] Task oversight: ${taskTitle} - window closed at ${formattedTime}`);
};

// ============ PRODUCTIVITY TIPS ============
export const notifyProductivityTip = (taskTitle, tip) => {
  sendNotification(`💡 Productivity Tip`, {
    body: `While working on "${taskTitle}": ${tip}`,
    icon: '/favicon.ico',
    tag: `tip-${Date.now()}`,
    silent: true
  });
  console.log(`[Notification] Productivity tip for ${taskTitle}: ${tip}`);
};