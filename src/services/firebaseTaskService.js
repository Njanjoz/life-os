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

const GRACE_PERIOD_MS = 5 * 60 * 1000;

export const determineCompletionStatus = (scheduledStart, scheduledEnd, actualStart, actualEnd, taskStatus) => {
  if (taskStatus === 'missed') return 'missed';
  if (!actualEnd) {
    const now = new Date();
    if (now > scheduledEnd) return 'overdue';
    return 'pending';
  }
  const isStartedOnTime = actualStart <= scheduledStart;
  const isCompletedOnTime = actualEnd <= scheduledEnd;
  if (isStartedOnTime && isCompletedOnTime) return 'completed_on_time';
  if (actualStart < scheduledStart && actualEnd < scheduledEnd) return 'completed_early';
  if (actualStart > scheduledStart || actualEnd > scheduledEnd) return 'completed_late';
  return 'completed';
};

const calculateMetrics = (tasks) => {
  const total = tasks.length;
  const completedOnTime = tasks.filter(t => t.completionStatus === 'completed_on_time').length;
  const completedEarly = tasks.filter(t => t.completionStatus === 'completed_early').length;
  const completedLate = tasks.filter(t => t.completionStatus === 'completed_late').length;
  const overdue = tasks.filter(t => t.completionStatus === 'overdue' && t.status !== 'completed').length;
  const missed = tasks.filter(t => t.status === 'missed').length;
  const totalReschedules = tasks.reduce((sum, t) => sum + (t.rescheduleCount || 0), 0);
  const totalDelay = tasks.reduce((sum, t) => sum + Math.max(0, t.delay || 0), 0);
  const avgDelay = totalDelay / (tasks.filter(t => t.delay > 0).length || 1);
  const dishonestCount = tasks.filter(t => t.completionType === 'manual_dishonest').length;
  
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const avgAccuracy = completedTasks.length > 0 
    ? completedTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / completedTasks.length
    : 100;
  
  const completionRate = total > 0 ? ((completedOnTime + completedEarly + completedLate) / total) * 100 : 0;
  
  let disciplineScore = 100;
  disciplineScore -= totalReschedules * 2;
  disciplineScore -= missed * 10;
  disciplineScore -= completedLate * 5;
  disciplineScore -= overdue * 8;
  disciplineScore -= Math.min(50, avgDelay / 2);
  disciplineScore -= dishonestCount * 15;
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  const weeklyScore = (completionRate * 0.3) + (disciplineScore * 0.3) + (avgAccuracy * 0.2) + ((completedEarly / (completedTasks.length || 1)) * 20);
  
  return {
    completedTasks: completedOnTime + completedEarly + completedLate,
    totalTasks: total,
    completionRate: Math.round(completionRate * 10) / 10,
    disciplineScore: Math.round(disciplineScore * 10) / 10,
    timeAccuracy: Math.round(avgAccuracy * 10) / 10,
    weeklyScore: Math.round(weeklyScore * 10) / 10,
    missedCount: missed,
    totalReschedules: totalReschedules,
    avgDelay: Math.round(avgDelay * 10) / 10,
    totalDelay: Math.round(totalDelay),
    dishonestCount: dishonestCount,
    completedOnTime: completedOnTime,
    completedEarly: completedEarly,
    completedLate: completedLate,
    overdue: overdue
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
        dishonestCount: 0,
        completedOnTime: 0,
        completedEarly: 0,
        completedLate: 0,
        overdue: 0
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
    status: 'pending',
    completionStatus: 'pending',
    completion: 0,
    rescheduleCount: taskData.rescheduleCount || 0,
    actualStart: null,
    actualEnd: null,
    delay: 0,
    accuracy: 0,
    timeSpent: 0,
    completionType: null,
    bonus: 0,
    priority: taskData.priority || 'medium',
    notes: taskData.notes || '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await setDoc(taskRef, newTask);
  await updateWeekMetrics(weekId);
  return { id: taskId, ...newTask };
};

export const updateTask = async (taskId, updates) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { ...updates, updatedAt: Timestamp.now() });
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  if (task && task.weekId) await updateWeekMetrics(task.weekId);
};

export const startTask = async (taskId, actualStartTime = null) => {
  const actualStart = actualStartTime ? new Date(actualStartTime) : new Date();
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (!task) throw new Error('Task not found');
  if (task.status === 'completed') return;
  
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  const plannedStart = new Date(task.createdAt.toDate());
  const dayOffset = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(task.day);
  plannedStart.setDate(plannedStart.getDate() + dayOffset);
  plannedStart.setHours(startHour, startMin, 0, 0);
  
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
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  const [endHour, endMin] = task.endTime.split(':').map(Number);
  
  const plannedStart = new Date(task.createdAt.toDate());
  const dayOffset = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(task.day);
  plannedStart.setDate(plannedStart.getDate() + dayOffset);
  plannedStart.setHours(startHour, startMin, 0, 0);
  const scheduledEnd = new Date(plannedStart);
  scheduledEnd.setHours(endHour, endMin, 0, 0);
  
  let finalCompletionType = completionType;
  if (!finalCompletionType) {
    const isStartedOnTime = actualStart <= plannedStart;
    const isCompletedOnTime = actualEnd <= scheduledEnd;
    if (isStartedOnTime && isCompletedOnTime) finalCompletionType = 'on_time';
    else if (actualStart < plannedStart && actualEnd < scheduledEnd) finalCompletionType = 'early';
    else finalCompletionType = 'late';
  }
  
  const plannedDuration = ((endHour * 60 + endMin) - (startHour * 60 + startMin));
  const actualDuration = (actualEnd - actualStart) / 60000;
  
  let accuracy = 100;
  let bonus = 0;
  
  if (finalCompletionType === 'early') {
    bonus = 15;
    accuracy += bonus;
  } else if (finalCompletionType === 'on_time') {
    bonus = 10;
    accuracy += bonus;
  } else if (finalCompletionType === 'late') {
    const lateMinutes = Math.max(0, (actualEnd - scheduledEnd) / 60000);
    const penalty = Math.min(30, lateMinutes * 2);
    accuracy -= penalty;
  }
  
  if (actualDuration > plannedDuration) {
    const overtime = actualDuration - plannedDuration;
    accuracy -= Math.min(40, overtime * 4);
  } else if (actualDuration < plannedDuration) {
    const earlyFinish = plannedDuration - actualDuration;
    accuracy += Math.min(20, earlyFinish * 2);
  }
  
  if (task.delay > 0) {
    accuracy -= Math.min(40, task.delay / 2);
  }
  
  accuracy = Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
  
  await updateDoc(taskRef, {
    status: 'completed',
    completionStatus: finalCompletionType === 'early' ? 'completed_early' : finalCompletionType === 'on_time' ? 'completed_on_time' : 'completed_late',
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

export const markTaskOverdue = async (taskId) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (task && task.status === 'pending') {
    await updateDoc(taskRef, {
      completionStatus: 'overdue',
      updatedAt: Timestamp.now()
    });
    await updateWeekMetrics(task.weekId);
  }
};

export const markTaskMissed = async (taskId) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, {
    status: 'missed',
    completionStatus: 'missed',
    completion: 0,
    accuracy: 0,
    updatedAt: Timestamp.now()
  });
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  if (task && task.weekId) await updateWeekMetrics(task.weekId);
};

export const rescheduleTask = async (taskId, newDay, newStartTime, newEndTime) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  await updateDoc(taskRef, {
    day: newDay,
    startTime: newStartTime,
    endTime: newEndTime,
    rescheduleCount: (task.rescheduleCount || 0) + 1,
    status: 'rescheduled',
    completionStatus: 'rescheduled',
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

export const rescheduleToNow = async (taskId) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const newStartTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  const newEndTime = `${(currentHour + 1).toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  await updateDoc(taskRef, {
    startTime: newStartTime,
    endTime: newEndTime,
    rescheduleCount: (task.rescheduleCount || 0) + 1,
    status: 'rescheduled',
    completionStatus: 'rescheduled',
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

export const deleteTask = async (taskId) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  await deleteDoc(taskRef);
  if (task && task.weekId) await updateWeekMetrics(task.weekId);
};

export const updateWeekMetrics = async (weekId) => {
  const tasks = await getWeekTasks(weekId);
  const metrics = calculateMetrics(tasks);
  const weekRef = doc(db, WEEKS_COLLECTION, weekId);
  await updateDoc(weekRef, { metrics, updatedAt: Timestamp.now() });
  return metrics;
};

export const checkMissedTasks = async (weekId, selectedDate) => {
  const tasks = await getWeekTasks(weekId);
  const now = new Date();
  let updated = false;
  
  for (const task of tasks) {
    if (task.status === 'pending' && task.title) {
      const [endHour, endMin] = task.endTime.split(':').map(Number);
      const taskDate = new Date(selectedDate);
      const endTime = new Date(taskDate);
      endTime.setHours(endHour, endMin, 0, 0);
      
      if (now > endTime) {
        if (now > new Date(endTime.getTime() + 24 * 60 * 60 * 1000)) {
          await markTaskMissed(task.id);
        } else {
          await markTaskOverdue(task.id);
        }
        updated = true;
      }
    }
  }
  
  if (updated) await updateWeekMetrics(weekId);
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

// NEW RESET FUNCTIONS
export const deleteAllTasksForWeek = async (weekId) => {
  const userId = getUserId();
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
      dishonestCount: 0,
      completedOnTime: 0,
      completedEarly: 0,
      completedLate: 0,
      overdue: 0
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
