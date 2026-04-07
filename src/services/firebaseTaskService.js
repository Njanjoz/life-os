// src/services/firebaseTaskService.js - COMPLETELY FIXED WITH ABSOLUTE DATES
import { 
  db, auth, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, Timestamp, writeBatch 
} from '../firebase';

const TASKS_COLLECTION = 'tasks';
const WEEKS_COLLECTION = 'weeks';
const SETTINGS_COLLECTION = 'settings';

const getUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.uid;
};

export const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper function to calculate absolute task dates
const calculateTaskAbsoluteDates = (weekId, day, startTime, endTime) => {
  const weekStart = new Date(weekId.split('_')[1]);
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const taskDayIndex = daysOfWeek.indexOf(day);
  
  const taskDate = new Date(weekStart);
  taskDate.setDate(weekStart.getDate() + taskDayIndex);
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startDateTime = new Date(taskDate);
  startDateTime.setHours(startHour, startMin, 0, 0);
  
  const endDateTime = new Date(taskDate);
  endDateTime.setHours(endHour, endMin, 0, 0);
  
  return { startDateTime, endDateTime };
};

const calculateMetrics = (tasks) => {
  const baseTasks = tasks.filter(t => !t.rescheduledFrom);
  const total = baseTasks.length;
  const completed = baseTasks.filter(t => t.status === 'completed').length;
  const missed = baseTasks.filter(t => t.status === 'missed').length;
  const rescheduled = baseTasks.filter(t => t.rescheduleReason === 'rescheduled' || t.status === 'missed' && t.rescheduleReason === 'rescheduled').length;
  const overdue = baseTasks.filter(t => t.status === 'pending' && new Date() > new Date(t.endTime)).length;
  
  const completedTasks = baseTasks.filter(t => t.status === 'completed');
  const earlyCount = completedTasks.filter(t => t.completionType === 'early' || t.completionStatus === 'completed_early').length;
  const onTimeCount = completedTasks.filter(t => t.completionType === 'on_time' || t.completionStatus === 'completed_on_time').length;
  const lateCount = completedTasks.filter(t => t.completionType === 'late' || t.completionStatus === 'completed_late').length;
  
  const totalDelay = baseTasks.reduce((sum, t) => sum + Math.max(0, t.delay || 0), 0);
  const avgDelay = totalDelay / (baseTasks.filter(t => t.delay > 0).length || 1);
  
  const avgAccuracy = completedTasks.length > 0 
    ? completedTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / completedTasks.length
    : 100;
  
  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  
  let disciplineScore = 100;
  disciplineScore -= rescheduled * 2;
  disciplineScore -= missed * 10;
  disciplineScore -= lateCount * 5;
  disciplineScore -= overdue * 8;
  disciplineScore -= Math.min(50, avgDelay / 2);
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  const consistency = completed > 0 ? (onTimeCount + earlyCount) / completed : 0;
  
  const intelligenceScore = Math.round(
    (completionRate * 0.25) +
    (avgAccuracy * 0.20) +
    (disciplineScore * 0.25) +
    (consistency * 100 * 0.20) +
    (Math.max(0, 100 - avgDelay * 2) * 0.10)
  );
  
  const focusScore = Math.round(
    (completionRate * 0.5) + ((100 - Math.min(100, avgDelay * 2)) * 0.3) + (avgAccuracy * 0.2)
  );
  
  const riskScore = Math.min(100, (missed * 12) + (overdue * 8) + (avgDelay * 1.5) + (rescheduled * 5));
  let riskLevel = "Low";
  if (riskScore > 60) riskLevel = "High";
  else if (riskScore > 30) riskLevel = "Medium";
  
  let behavior = "Balanced";
  if (missed > 3) behavior = "Unstable";
  else if (total > 10 && completionRate < 60) behavior = "Overloaded";
  else if (avgDelay > 15) behavior = "Delayed Execution";
  else if (consistency > 0.85) behavior = "Highly Disciplined";
  else if (consistency > 0.7) behavior = "Stable Performer";
  
  const weeklyScore = Math.round((completionRate * 0.4) + (disciplineScore * 0.4) + (avgAccuracy * 0.2));
  
  return {
    completedTasks: completed,
    totalTasks: total,
    completionRate: Math.round(completionRate),
    disciplineScore: Math.round(disciplineScore),
    timeAccuracy: Math.round(avgAccuracy),
    weeklyScore,
    missedCount: missed,
    totalReschedules: rescheduled,
    avgDelay: Math.round(avgDelay),
    totalDelay: Math.round(totalDelay),
    earlyCount,
    onTimeCount,
    lateCount,
    overdue,
    intelligenceScore,
    focusScore,
    consistency: Math.round(consistency * 100),
    behavior,
    riskScore: Math.round(riskScore),
    riskLevel
  };
};

export const getCurrentWeek = async (selectedDate = new Date()) => {
  const userId = getUserId();
  const weekStart = getStartOfWeek(selectedDate);
  const weekId = `${userId}_${weekStart.toISOString()}`;
  
  const weekRef = doc(db, WEEKS_COLLECTION, weekId);
  const weekDoc = await getDoc(weekRef);
  
  if (!weekDoc.exists()) {
    const weekData = {
      id: weekId,
      userId,
      weekStart: Timestamp.fromDate(weekStart),
      weekEnd: Timestamp.fromDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      metrics: {
        completedTasks: 0,
        totalTasks: 0,
        completionRate: 0,
        disciplineScore: 100,
        timeAccuracy: 100,
        weeklyScore: 0,
        missedCount: 0,
        totalReschedules: 0,
        avgDelay: 0,
        totalDelay: 0,
        earlyCount: 0,
        onTimeCount: 0,
        lateCount: 0,
        overdue: 0,
        intelligenceScore: 0,
        focusScore: 0,
        consistency: 0,
        behavior: "Balanced",
        riskScore: 0,
        riskLevel: "Low"
      }
    };
    await setDoc(weekRef, weekData);
    return { id: weekId, ...weekData };
  }
  
  return { id: weekDoc.id, ...weekDoc.data() };
};

export const getWeekTasks = async (weekId) => {
  const userId = getUserId();
  const q = query(collection(db, TASKS_COLLECTION), where('userId', '==', userId), where('weekId', '==', weekId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTask = async (weekId, taskData) => {
  const userId = getUserId();
  const taskId = `${weekId}_${taskData.day}_${taskData.startTime}_${Date.now()}`;
  
  // Calculate absolute dates
  const { startDateTime, endDateTime } = calculateTaskAbsoluteDates(
    weekId, 
    taskData.day, 
    taskData.startTime, 
    taskData.endTime
  );
  
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const newTask = {
    id: taskId,
    userId,
    weekId,
    title: taskData.title,
    category: taskData.category,
    subcategory: taskData.subcategory || 'General',
    day: taskData.day,
    startTime: taskData.startTime,
    endTime: taskData.endTime,
    // CRITICAL: Store absolute dates
    scheduledStart: Timestamp.fromDate(startDateTime),
    scheduledEnd: Timestamp.fromDate(endDateTime),
    status: 'pending',
    completion: 0,
    actualStart: null,
    actualEnd: null,
    delay: 0,
    accuracy: 0,
    timeSpent: 0,
    completionType: null,
    bonus: 0,
    priority: taskData.priority || 'medium',
    notes: taskData.notes || '',
    rescheduledFrom: taskData.rescheduledFrom || false,
    rescheduledTo: null,
    originalTaskId: taskData.originalTaskId || null,
    cumulativeProgress: 0,
    rescheduleHistory: [],
    rescheduleCount: 0,
    carryOverProgress: 0,
    remainingWork: 100,
    wasRescheduledFromActive: false,
    manualProgress: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await setDoc(taskRef, newTask);
  await updateWeekMetrics(weekId);
  return { id: taskId, ...newTask };
};

export const updateTask = async (taskId, updates) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const existingTask = taskDoc.data();
  
  if (!existingTask) throw new Error('Task not found');
  
  // If day, startTime, or endTime changed, recalculate absolute dates
  let updatedData = { ...updates, updatedAt: Timestamp.now() };
  
  if (updates.day || updates.startTime || updates.endTime) {
    const finalDay = updates.day || existingTask.day;
    const finalStartTime = updates.startTime || existingTask.startTime;
    const finalEndTime = updates.endTime || existingTask.endTime;
    
    const { startDateTime, endDateTime } = calculateTaskAbsoluteDates(
      existingTask.weekId,
      finalDay,
      finalStartTime,
      finalEndTime
    );
    
    updatedData.scheduledStart = Timestamp.fromDate(startDateTime);
    updatedData.scheduledEnd = Timestamp.fromDate(endDateTime);
  }
  
  await updateDoc(taskRef, updatedData);
  
  if (existingTask.weekId) await updateWeekMetrics(existingTask.weekId);
};

export const startTask = async (taskId, actualStartTime = null) => {
  const actualStart = actualStartTime ? new Date(actualStartTime) : new Date();
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (!task) throw new Error('Task not found');
  if (task.status === 'completed') return;
  
  // Use scheduledStart for accurate delay calculation
  const plannedStart = task.scheduledStart ? task.scheduledStart.toDate() : new Date();
  
  const delayMinutes = Math.max(0, (actualStart - plannedStart) / 60000);
  
  await updateDoc(taskRef, {
    status: 'active',
    actualStart: Timestamp.fromDate(actualStart),
    delay: delayMinutes,
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

export const completeTask = async (taskId, actualEndTime = null, completionType = null) => {
  const actualEnd = actualEndTime ? new Date(actualEndTime) : new Date();
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (!task) throw new Error('Task not found');
  
  const actualStart = task.actualStart ? task.actualStart.toDate() : new Date();
  
  // Use scheduled dates for accurate comparison
  const scheduledStart = task.scheduledStart ? task.scheduledStart.toDate() : new Date();
  const scheduledEnd = task.scheduledEnd ? task.scheduledEnd.toDate() : new Date();
  
  let finalCompletionType = completionType;
  if (!finalCompletionType) {
    if (actualEnd < scheduledEnd) finalCompletionType = 'early';
    else if (actualEnd <= new Date(scheduledEnd.getTime() + 5 * 60 * 1000)) finalCompletionType = 'on_time';
    else finalCompletionType = 'late';
  }
  
  const plannedDuration = (scheduledEnd - scheduledStart) / 60000;
  const actualDuration = (actualEnd - actualStart) / 60000;
  
  let accuracy = 100;
  let bonus = 0;
  
  const cumulativeProgress = task.cumulativeProgress || task.completion || 0;
  if (cumulativeProgress < 100 && cumulativeProgress > 0) {
    accuracy -= Math.min(30, (100 - cumulativeProgress) / 2);
  }
  
  if (finalCompletionType === 'early') {
    bonus = 15;
    accuracy += bonus;
  } else if (finalCompletionType === 'on_time') {
    bonus = 10;
    accuracy += bonus;
  } else if (finalCompletionType === 'late') {
    const lateMinutes = Math.max(0, (actualEnd - scheduledEnd) / 60000);
    accuracy -= Math.min(30, lateMinutes * 2);
  }
  
  if (actualDuration > plannedDuration) {
    accuracy -= Math.min(40, (actualDuration - plannedDuration) * 4);
  } else if (actualDuration < plannedDuration) {
    accuracy += Math.min(20, (plannedDuration - actualDuration) * 2);
  }
  
  if (task.delay > 0) {
    accuracy -= Math.min(40, task.delay / 2);
  }
  
  accuracy = Math.max(0, Math.min(100, Math.round(accuracy)));
  
  await updateDoc(taskRef, {
    status: 'completed',
    completion: 100,
    actualEnd: Timestamp.fromDate(actualEnd),
    accuracy: accuracy,
    completionType: finalCompletionType,
    timeSpent: actualDuration,
    bonus: bonus,
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

export const rescheduleTask = async (taskId, newDay, newStartTime, newEndTime, weekId, carriedProgress = null) => {
  const userId = getUserId();
  const batch = writeBatch(db);
  
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const originalTask = taskDoc.data();
  
  if (!originalTask) throw new Error('Task not found');
  
  const wasStarted = originalTask.status === 'active' || originalTask.status === 'in_progress';
  const hasActualStart = originalTask.actualStart !== null;
  const wasEverStarted = wasStarted && hasActualStart;
  
  let currentProgress = 0;
  if (wasEverStarted) {
    currentProgress = carriedProgress !== null ? carriedProgress : (originalTask.manualProgress || originalTask.completion || 0);
  }
  
  const previousCumulative = originalTask.cumulativeProgress || 0;
  const newCumulativeProgress = wasEverStarted ? Math.min(100, previousCumulative + currentProgress) : previousCumulative;
  const newRescheduleCount = (originalTask.rescheduleCount || 0) + 1;
  
  batch.update(taskRef, {
    status: 'rescheduled',
    rescheduledTo: `${newDay} at ${newStartTime}`,
    rescheduledDate: Timestamp.now(),
    rescheduleCount: newRescheduleCount,
    progressAtReschedule: currentProgress,
    cumulativeProgress: newCumulativeProgress,
    wasStartedBeforeReschedule: wasEverStarted,
    updatedAt: Timestamp.now()
  });
  
  const newTaskId = `${originalTask.weekId}_${newDay}_${newStartTime}_${Date.now()}`;
  const newTaskRef = doc(db, TASKS_COLLECTION, newTaskId);
  
  // Calculate absolute dates for the rescheduled task
  const { startDateTime, endDateTime } = calculateTaskAbsoluteDates(
    originalTask.weekId,
    newDay,
    newStartTime,
    newEndTime
  );
  
  batch.set(newTaskRef, {
    id: newTaskId,
    userId: originalTask.userId,
    weekId: originalTask.weekId,
    title: originalTask.title,
    category: originalTask.category,
    subcategory: originalTask.subcategory,
    day: newDay,
    startTime: newStartTime,
    endTime: newEndTime,
    scheduledStart: Timestamp.fromDate(startDateTime),
    scheduledEnd: Timestamp.fromDate(endDateTime),
    status: 'pending',
    completion: 0,
    manualProgress: 0,
    actualStart: null,
    actualEnd: null,
    delay: 0,
    accuracy: 0,
    timeSpent: 0,
    completionType: null,
    bonus: 0,
    priority: originalTask.priority,
    notes: originalTask.notes,
    rescheduledFrom: true,
    originalTaskId: taskId,
    cumulativeProgress: newCumulativeProgress,
    rescheduleCount: newRescheduleCount,
    carryOverProgress: wasEverStarted ? currentProgress : 0,
    remainingWork: wasEverStarted ? 100 - newCumulativeProgress : 100,
    wasRescheduledFromActive: wasEverStarted,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  await batch.commit();
  await updateWeekMetrics(originalTask.weekId);
  
  return newTaskId;
};

export const rescheduleToNow = async (taskId, weekId) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const newStartTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  const newEndTime = `${(currentHour + 1).toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  
  return await rescheduleTask(taskId, currentDay, newStartTime, newEndTime, weekId);
};

export const deleteTask = async (taskId) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  await deleteDoc(taskRef);
  if (task && task.weekId) await updateWeekMetrics(task.weekId);
};

let metricsUpdateTimeout = null;

export const updateWeekMetrics = async (weekId) => {
  if (metricsUpdateTimeout) {
    clearTimeout(metricsUpdateTimeout);
  }
  
  return new Promise((resolve) => {
    metricsUpdateTimeout = setTimeout(async () => {
      try {
        const tasks = await getWeekTasks(weekId);
        const metrics = calculateMetrics(tasks);
        const weekRef = doc(db, WEEKS_COLLECTION, weekId);
        await updateDoc(weekRef, { metrics, updatedAt: Timestamp.now() });
        resolve(metrics);
      } catch (error) {
        console.error('Error updating metrics:', error);
        resolve(null);
      } finally {
        metricsUpdateTimeout = null;
      }
    }, 100);
  });
};

// ============ FIXED: checkMissedTasks USING ABSOLUTE DATES ============
export const checkMissedTasks = async (weekId, selectedDate) => {
  const tasks = await getWeekTasks(weekId);
  let updated = false;
  const batch = writeBatch(db);
  
  const now = new Date();
  
  for (const task of tasks) {
    // Skip completed, rescheduled, or placeholder tasks
    if (task.status === 'completed' || task.status === 'rescheduled') continue;
    if (!task.title || task.title.trim() === '') continue;
    if (task.rescheduledFrom) continue;
    
    // Use the stored absolute end date if available
    let taskEndTime;
    if (task.scheduledEnd) {
      taskEndTime = task.scheduledEnd.toDate();
    } else {
      // Fallback for old tasks (calculate from weekId)
      const weekStart = new Date(weekId.split('_')[1]);
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const taskDayIndex = daysOfWeek.indexOf(task.day);
      const taskDate = new Date(weekStart);
      taskDate.setDate(weekStart.getDate() + taskDayIndex);
      const [endHour, endMin] = task.endTime.split(':').map(Number);
      taskEndTime = new Date(taskDate);
      taskEndTime.setHours(endHour, endMin, 0, 0);
    }
    
    // Check if task is in the future
    const isTaskInFuture = taskEndTime > now;
    
    // Check if task is overdue (end time passed)
    const isOverdue = taskEndTime < now;
    
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    
    if (isOverdue && task.status === 'pending' && !isTaskInFuture) {
      // Mark as missed only if not in future
      batch.update(taskRef, {
        status: 'missed',
        missedReason: 'overdue',
        updatedAt: Timestamp.now()
      });
      updated = true;
      console.log(`[MISSED] ${task.title} (${task.day} ${task.startTime}) ended at ${taskEndTime}`);
    } 
    else if (!isOverdue && task.status === 'missed') {
      // Restore if not overdue
      batch.update(taskRef, {
        status: 'pending',
        missedReason: null,
        updatedAt: Timestamp.now()
      });
      updated = true;
      console.log(`[RESTORED] ${task.title} (${task.day} ${task.startTime}) - was incorrectly marked as missed`);
    }
    else if (isTaskInFuture && task.status === 'missed') {
      // Restore future tasks that were wrongly marked
      batch.update(taskRef, {
        status: 'pending',
        missedReason: null,
        updatedAt: Timestamp.now()
      });
      updated = true;
      console.log(`[RESTORED FUTURE] ${task.title} (${task.day} ${task.startTime}) - future tasks cannot be missed`);
    }
  }
  
  if (updated) {
    await batch.commit();
    await updateWeekMetrics(weekId);
    console.log(`[checkMissedTasks] Completed with updates`);
  }
};

// ============ RESTORE ALL MISSED TASKS ============
export const restoreAllMissedTasks = async () => {
  const userId = getUserId();
  const q = query(
    collection(db, TASKS_COLLECTION), 
    where('userId', '==', userId), 
    where('status', '==', 'missed')
  );
  const querySnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  let count = 0;
  
  for (const taskDoc of querySnapshot.docs) {
    batch.update(taskDoc.ref, {
      status: 'pending',
      missedReason: null,
      updatedAt: Timestamp.now()
    });
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`[restoreAllMissedTasks] Restored ${count} tasks from missed to pending`);
  }
  
  return count;
};

// ============ FIX MISSED TASKS FOR A SPECIFIC WEEK ============
export const fixMissedTasksForWeek = async (weekId) => {
  const tasks = await getWeekTasks(weekId);
  const batch = writeBatch(db);
  let count = 0;
  
  for (const task of tasks) {
    if (task.status === 'missed') {
      // Check if it should actually be missed
      let taskEndTime;
      if (task.scheduledEnd) {
        taskEndTime = task.scheduledEnd.toDate();
      } else {
        const weekStart = new Date(weekId.split('_')[1]);
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const taskDayIndex = daysOfWeek.indexOf(task.day);
        const taskDate = new Date(weekStart);
        taskDate.setDate(weekStart.getDate() + taskDayIndex);
        const [endHour, endMin] = task.endTime.split(':').map(Number);
        taskEndTime = new Date(taskDate);
        taskEndTime.setHours(endHour, endMin, 0, 0);
      }
      
      const now = new Date();
      const shouldBeMissed = taskEndTime < now;
      
      if (!shouldBeMissed) {
        batch.update(doc(db, TASKS_COLLECTION, task.id), {
          status: 'pending',
          missedReason: null,
          updatedAt: Timestamp.now()
        });
        count++;
      }
    }
  }
  
  if (count > 0) {
    await batch.commit();
    await updateWeekMetrics(weekId);
  }
  
  return count;
};

export const getBestFocusHours = async () => {
  const userId = getUserId();
  const q = query(collection(db, TASKS_COLLECTION), where('userId', '==', userId), where('status', '==', 'completed'));
  const querySnapshot = await getDocs(q);
  const focusHours = {};
  
  querySnapshot.docs.forEach(doc => {
    const task = doc.data();
    const hour = task.startTime.split(':')[0];
    focusHours[hour] = (focusHours[hour] || 0) + (task.accuracy || 0);
  });
  
  const sorted = Object.entries(focusHours).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 3).map(([hour, score]) => ({ hour, score: Math.min(100, score / 10) }));
};

export const getTheme = async () => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  const settingsDoc = await getDoc(settingsRef);
  return settingsDoc.exists() ? settingsDoc.data().theme || { primary: '#a855f7', secondary: '#3b82f6' } : { primary: '#a855f7', secondary: '#3b82f6' };
};

export const updateTheme = async (theme) => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  await setDoc(settingsRef, { theme, updatedAt: Timestamp.now() }, { merge: true });
  return theme;
};

export const getTimeSlots = async () => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  const settingsDoc = await getDoc(settingsRef);
  return settingsDoc.exists() && settingsDoc.data().timeSlots 
    ? settingsDoc.data().timeSlots 
    : ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
};

export const updateTimeSlots = async (timeSlots) => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  await setDoc(settingsRef, { timeSlots, updatedAt: Timestamp.now() }, { merge: true });
  return timeSlots;
};

export const deleteAllTasksForWeek = async (weekId) => {
  const tasks = await getWeekTasks(weekId);
  const batch = writeBatch(db);
  for (const task of tasks) {
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    batch.delete(taskRef);
  }
  await batch.commit();
  
  const weekRef = doc(db, WEEKS_COLLECTION, weekId);
  await updateDoc(weekRef, {
    metrics: {
      completedTasks: 0,
      totalTasks: 0,
      completionRate: 0,
      disciplineScore: 100,
      timeAccuracy: 100,
      weeklyScore: 0,
      missedCount: 0,
      totalReschedules: 0,
      avgDelay: 0,
      totalDelay: 0,
      earlyCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      overdue: 0,
      intelligenceScore: 0,
      focusScore: 0,
      consistency: 0,
      behavior: "Balanced",
      riskScore: 0,
      riskLevel: "Low"
    },
    updatedAt: Timestamp.now()
  });
  
  return true;
};

export const resetAllUserData = async () => {
  const userId = getUserId();
  
  const tasksQuery = query(collection(db, TASKS_COLLECTION), where('userId', '==', userId));
  const tasksSnapshot = await getDocs(tasksQuery);
  
  const batch = writeBatch(db);
  tasksSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  const weeksQuery = query(collection(db, WEEKS_COLLECTION), where('userId', '==', userId));
  const weeksSnapshot = await getDocs(weeksQuery);
  
  const weekBatch = writeBatch(db);
  weeksSnapshot.docs.forEach(doc => {
    weekBatch.delete(doc.ref);
  });
  await weekBatch.commit();
  
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  await setDoc(settingsRef, {
    theme: { primary: '#a855f7', secondary: '#3b82f6' },
    timeSlots: ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'],
    updatedAt: Timestamp.now()
  }, { merge: true });
  
  return true;
};