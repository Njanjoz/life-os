// src/services/notificationService.js

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
    
    // Auto-close after 5 seconds (except for overdue which requires interaction)
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
    
    return notification;
  } else if (Notification.permission !== 'denied') {
    requestNotificationPermission().then(granted => {
      if (granted) {
        new Notification(title, options);
      }
    });
  }
};

// Format time for display
const formatTime = (date) => {
  if (!date) return 'unknown time';
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date for display
const formatDate = (date) => {
  if (!date) return 'unknown date';
  const d = new Date(date);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Notification for task start
export const notifyTaskStart = (taskTitle, startTime) => {
  sendNotification(`⏰ Task Starting: ${taskTitle}`, {
    body: `"${taskTitle}" is scheduled to start at ${formatTime(startTime)} on ${formatDate(startTime)}`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `task-start-${taskTitle}-${Date.now()}`,
    silent: false
  });
  
  console.log(`[Notification] Task started: ${taskTitle} at ${formatTime(startTime)}`);
};

// Notification for task completion
export const notifyTaskComplete = (taskTitle, completionType, bonus = null) => {
  let body = `Task "${taskTitle}" marked as ${completionType}`;
  let emoji = '✅';
  
  if (completionType === 'early' && bonus) {
    emoji = '🎉';
    body = `Great job! "${taskTitle}" completed early! Bonus: ${bonus}`;
  } else if (completionType === 'on-time') {
    emoji = '✅';
    body = `"${taskTitle}" completed on time!`;
  } else if (completionType === 'late') {
    emoji = '⚠️';
    body = `"${taskTitle}" completed late. Consider planning better next time.`;
  }
  
  sendNotification(`${emoji} Task Complete: ${taskTitle}`, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `task-complete-${taskTitle}-${Date.now()}`
  });
  
  console.log(`[Notification] Task completed: ${taskTitle} (${completionType})`);
};

// Notification for task overdue
export const notifyTaskOverdue = (taskTitle, endTime) => {
  sendNotification(`⚠️ Task Overdue: ${taskTitle}`, {
    body: `"${taskTitle}" was due at ${formatTime(endTime)} on ${formatDate(endTime)} and is now overdue. Please update its status.`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `task-overdue-${taskTitle}`,
    requireInteraction: true,
  });
  
  console.log(`[Notification] Task overdue: ${taskTitle} (due at ${formatTime(endTime)})`);
};

// Notification for task rescheduled
export const notifyTaskRescheduled = (taskTitle, oldStartTime, newStartTime, oldEndTime, newEndTime) => {
  let changes = [];
  
  if (oldStartTime && newStartTime && new Date(oldStartTime).getTime() !== new Date(newStartTime).getTime()) {
    changes.push(`Start: ${formatTime(oldStartTime)} → ${formatTime(newStartTime)}`);
  }
  
  if (oldEndTime && newEndTime && new Date(oldEndTime).getTime() !== new Date(newEndTime).getTime()) {
    changes.push(`End: ${formatTime(oldEndTime)} → ${formatTime(newEndTime)}`);
  }
  
  if (changes.length === 0) return;
  
  sendNotification(`📅 Task Rescheduled: ${taskTitle}`, {
    body: changes.join('\n'),
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `task-reschedule-${taskTitle}-${Date.now()}`
  });
  
  console.log(`[Notification] Task rescheduled: ${taskTitle}`, changes);
};

// Notification for upcoming task (reminder)
export const notifyUpcomingTask = (taskTitle, startTime, minutesBefore = 5) => {
  sendNotification(`🔔 Upcoming Task: ${taskTitle}`, {
    body: `"${taskTitle}" starts in ${minutesBefore} minutes at ${formatTime(startTime)}`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `task-upcoming-${taskTitle}`,
    silent: false
  });
  
  console.log(`[Notification] Upcoming task reminder: ${taskTitle} at ${formatTime(startTime)}`);
};
