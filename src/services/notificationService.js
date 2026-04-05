// src/services/notificationService.js - Production-grade notification service with rate limiting

// Check if browser notifications are supported and permitted
const checkNotificationSupport = () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }
  return true;
};

// Detect mobile device
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ============ RATE LIMITING SYSTEM ============
const notificationCooldown = new Map();
const globalNotificationCount = {
  count: 0,
  resetTime: Date.now()
};

// Smart rate limiter with cooldown
const safeNotify = (key, fn, customCooldown = null) => {
  const now = Date.now();
  
  // Mobile gets longer cooldowns
  const baseCooldown = isMobile ? 60000 : 30000; // 60s mobile, 30s desktop
  const cooldown = customCooldown || baseCooldown;
  
  // Check per-key cooldown
  if (notificationCooldown.has(key)) {
    const last = notificationCooldown.get(key);
    if (now - last < cooldown) {
      console.log(`[Notification Throttled] ${key} - cooldown active`);
      return false;
    }
  }
  
  // Global rate limit: max 5 notifications per 30 seconds on mobile, 10 on desktop
  const maxPerWindow = isMobile ? 5 : 10;
  const windowMs = 30000;
  
  if (now - globalNotificationCount.resetTime > windowMs) {
    // Reset counter
    globalNotificationCount.count = 0;
    globalNotificationCount.resetTime = now;
  }
  
  if (globalNotificationCount.count >= maxPerWindow) {
    console.log(`[Notification Throttled] Global limit reached (${maxPerWindow}/${windowMs}ms)`);
    return false;
  }
  
  // Update counters
  notificationCooldown.set(key, now);
  globalNotificationCount.count++;
  
  // Execute notification
  fn();
  return true;
};

// Clear cooldown for testing (optional)
export const clearNotificationCooldown = () => {
  notificationCooldown.clear();
  globalNotificationCount.count = 0;
  globalNotificationCount.resetTime = Date.now();
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

// Send a notification with mobile optimization
const sendNotification = (title, options) => {
  if (!checkNotificationSupport()) return;
  
  if (Notification.permission === 'granted') {
    // Mobile optimization: shorter timeout on mobile
    const autoCloseTimeout = isMobile ? 3000 : 5000;
    
    const notification = new Notification(title, options);
    
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), autoCloseTimeout);
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

// Generate stable tag (no Date.now() for grouping)
const getStableTag = (prefix, taskTitle) => {
  return `${prefix}-${taskTitle.toLowerCase().replace(/\s/g, '-')}`;
};

// ============ TASK START NOTIFICATIONS ============
export const notifyTaskStart = (taskTitle, startTime) => {
  const formattedTime = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('start', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`▶ Task Started: ${taskTitle}`, {
      body: `You started "${taskTitle}" at ${currentTime}.\nScheduled: ${formattedTime}`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false,
      badge: '/favicon.ico'
    });
    console.log(`[Notification] Task started: ${taskTitle} at ${currentTime} (scheduled: ${formattedTime})`);
  }, 60000); // 1 minute cooldown
};

// ============ TASK COMPLETION NOTIFICATIONS ============
export const notifyTaskComplete = (taskTitle, completionType, bonus = null, actualTime = null) => {
  const completionTime = actualTime ? formatTimeDisplay(actualTime) : getCurrentTime();
  const stableKey = getStableTag('complete', taskTitle);
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
  
  safeNotify(stableKey, () => {
    sendNotification(`${titlePrefix} Task Complete: ${taskTitle}`, {
      body,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task complete: ${taskTitle} (${completionType}) at ${completionTime}`);
  }, 60000);
};

// ============ TASK OVERDUE NOTIFICATIONS ============
export const notifyTaskOverdue = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('overdue', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⚠ OVERDUE: ${taskTitle}`, {
      body: `Task "${taskTitle}" was due at ${formattedTime} and is now overdue (current time: ${currentTime}).\nPlease take action - reschedule or complete.`,
      icon: '/favicon.ico',
      tag: stableKey,
      requireInteraction: !isMobile, // Mobile: don't require interaction (takes too much space)
    });
    console.log(`[Notification] Task overdue: ${taskTitle} (due at ${formattedTime}, now ${currentTime})`);
  }, isMobile ? 180000 : 120000); // 3 min mobile, 2 min desktop
};

// ============ TASK RESCHEDULED NOTIFICATIONS ============
export const notifyTaskRescheduled = (taskTitle, oldStartTime, newStartTime, oldEndTime, newEndTime, newDay = null) => {
  const stableKey = getStableTag('reschedule', taskTitle);
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
  
  safeNotify(stableKey, () => {
    sendNotification(`↻ Task Rescheduled: ${taskTitle}`, {
      body: `${changes.join(', ')}`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task rescheduled: ${taskTitle} - ${changes.join(', ')}`);
  }, 60000);
};

// ============ TASK CANCELLED / MISSED NOTIFICATIONS ============
export const notifyTaskCancelled = (taskTitle, reason = 'cancelled') => {
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('cancel', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`✗ Task ${reason === 'missed' ? 'Missed' : 'Cancelled'}: ${taskTitle}`, {
      body: `Task "${taskTitle}" was ${reason} at ${currentTime}.${reason === 'missed' ? ' This will affect your completion metrics.' : ''}`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task ${reason}: ${taskTitle} at ${currentTime}`);
  }, 120000); // 2 minute cooldown
};

// ============ TASK CREATED NOTIFICATION ============
export const notifyTaskCreated = (taskTitle, day, startTime, endTime) => {
  const stableKey = getStableTag('create', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`+ New Task Created: ${taskTitle}`, {
      body: `Task "${taskTitle}" scheduled for ${day} at ${formatTimeDisplay(startTime)} - ${formatTimeDisplay(endTime)}`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task created: ${taskTitle} on ${day} at ${startTime}`);
  }, 30000);
};

// ============ TASK EDITED NOTIFICATION ============
export const notifyTaskEdited = (taskTitle, changes) => {
  if (!changes || changes.length === 0) return;
  const stableKey = getStableTag('edit', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`✎ Task Updated: ${taskTitle}`, {
      body: changes.join(', '),
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task edited: ${taskTitle} - ${changes.join(', ')}`);
  }, 30000);
};

// ============ TASK DELETED NOTIFICATION ============
export const notifyTaskDeleted = (taskTitle) => {
  const stableKey = getStableTag('delete', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`🗑 Task Deleted: ${taskTitle}`, {
      body: `Task "${taskTitle}" has been permanently deleted.`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task deleted: ${taskTitle}`);
  }, 60000);
};

// ============ UPCOMING TASK REMINDER ============
export const notifyUpcomingTask = (taskTitle, startTime, minutesBefore = 5) => {
  const timeStr = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('upcoming', taskTitle);
  let message = '';
  
  if (minutesBefore === 0) {
    message = `Task "${taskTitle}" is starting NOW at ${timeStr} (current time: ${currentTime})`;
  } else {
    message = `Task "${taskTitle}" starts in ${minutesBefore} minutes at ${timeStr}`;
  }
  
  // Longer cooldown for reminders
  safeNotify(stableKey, () => {
    sendNotification(`🔔 Task Reminder: ${taskTitle}`, {
      body: message,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Upcoming task reminder: ${taskTitle} - ${message}`);
  }, isMobile ? 3600000 : 1800000); // 1 hour mobile, 30 min desktop
};

// ============ TASK DELAYED NOTIFICATION ============
export const notifyTaskDelayed = (taskTitle, originalStartTime, actualStartTime, delayMinutes) => {
  const originalFormatted = formatTimeDisplay(originalStartTime);
  const actualFormatted = formatTimeDisplay(actualStartTime);
  const stableKey = getStableTag('delay', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⏰ Task Started Late: ${taskTitle}`, {
      body: `Task "${taskTitle}" started ${delayMinutes} minutes late.\nScheduled: ${originalFormatted}\nActual: ${actualFormatted}`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task delayed: ${taskTitle} by ${delayMinutes} minutes`);
  }, 120000);
};

// ============ TASK COMPLETION REMINDER (for ongoing tasks) ============
export const notifyTaskCompletionReminder = (taskTitle, endTime) => {
  const formattedEnd = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('reminder', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⏳ Task Ending Soon: ${taskTitle}`, {
      body: `Task "${taskTitle}" is scheduled to end at ${formattedEnd} (current time: ${currentTime}). Don't forget to mark it complete!`,
      icon: '/favicon.ico',
      tag: stableKey,
      silent: false
    });
    console.log(`[Notification] Task completion reminder: ${taskTitle} ends at ${formattedEnd}`);
  }, 3600000); // 1 hour cooldown
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
    // Use a global summary key to prevent spam
    safeNotify('tasks-summary', () => {
      sendNotification(`📊 Task Summary`, {
        body: body.trim(),
        icon: '/favicon.ico',
        tag: 'tasks-summary',
        silent: true
      });
      console.log(`[Notification] Task summary sent: ${body.trim()}`);
    }, 1800000); // 30 minutes between summaries
  }
};

// ============ TIME CHECK NOTIFICATIONS (System A - Time Arrival) ============
export const notifyTaskTimeArrived = (taskTitle, startTime) => {
  const formattedTime = formatTimeDisplay(startTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('time-arrived', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⏰ Time to Begin: ${taskTitle}`, {
      body: `The scheduled time for "${taskTitle}" has arrived (${formattedTime}). Current time: ${currentTime}. Time to get started!`,
      icon: '/favicon.ico',
      tag: stableKey,
      requireInteraction: false,
      silent: false
    });
    console.log(`[Notification] Task time arrived: ${taskTitle} at ${formattedTime}`);
  }, isMobile ? 3600000 : 1800000); // 1 hour mobile, 30 min desktop
};

export const notifyTaskTimeEnded = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('time-ended', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⏰ Time's Up: ${taskTitle}`, {
      body: `The scheduled time for "${taskTitle}" has ended (${formattedTime}). Current time: ${currentTime}. Time to wrap up!`,
      icon: '/favicon.ico',
      tag: stableKey,
      requireInteraction: false,
      silent: false
    });
    console.log(`[Notification] Task time ended: ${taskTitle} at ${formattedTime}`);
  }, isMobile ? 3600000 : 1800000);
};

// ============ OVERSIGHT NOTIFICATION (when task time has passed without action) ============
export const notifyTaskOversight = (taskTitle, endTime) => {
  const formattedTime = formatTimeDisplay(endTime);
  const currentTime = getCurrentTime();
  const stableKey = getStableTag('oversight', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`⚠ Task Window Closed: ${taskTitle}`, {
      body: `Task "${taskTitle}" was scheduled to end at ${formattedTime} (current: ${currentTime}). No action was taken. The task has been marked as missed.`,
      icon: '/favicon.ico',
      tag: stableKey,
      requireInteraction: !isMobile
    });
    console.log(`[Notification] Task oversight: ${taskTitle} - window closed at ${formattedTime}`);
  }, 3600000); // 1 hour cooldown
};

// ============ PRODUCTIVITY TIPS ============
export const notifyProductivityTip = (taskTitle, tip) => {
  const stableKey = getStableTag('tip', taskTitle);
  
  safeNotify(stableKey, () => {
    sendNotification(`💡 Productivity Tip`, {
      body: `While working on "${taskTitle}": ${tip}`,
      icon: '/favicon.ico',
      tag: `tip-${taskTitle}`,
      silent: true
    });
    console.log(`[Notification] Productivity tip for ${taskTitle}: ${tip}`);
  }, 7200000); // 2 hours between tips
};

// ============ EXPORT HELPER FOR DEBUGGING ============
export const getNotificationStats = () => {
  return {
    cooldownSize: notificationCooldown.size,
    recentCount: globalNotificationCount.count,
    isMobile: isMobile,
    resetTime: new Date(globalNotificationCount.resetTime).toISOString()
  };
};