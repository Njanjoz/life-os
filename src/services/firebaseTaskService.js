import { 
  db, auth, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, Timestamp 
} from '../firebase';

// Collection names
const TASKS_COLLECTION = 'tasks';
const WEEKS_COLLECTION = 'weeks';
const SETTINGS_COLLECTION = 'settings';

// Helper to get current user ID
const getUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.uid;
};

// Get start of week
export const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Get or create current week
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
        totalReschedules: 0
      }
    };
    await setDoc(weekRef, weekData);
    return { id: weekId, ...weekData };
  }
  
  return { id: weekDoc.id, ...weekDoc.data() };
};

// Get all tasks for a week
export const getWeekTasks = async (weekId) => {
  const userId = getUserId();
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('userId', '==', userId),
    where('weekId', '==', weekId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Add a new task
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
    completion: 0,
    rescheduleCount: 0,
    actualStart: null,
    actualEnd: null,
    delay: 0,
    accuracy: 0,
    timeSpent: 0,
    priority: taskData.priority || 'medium',
    notes: taskData.notes || '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await setDoc(taskRef, newTask);
  await updateWeekMetrics(weekId);
  
  return { id: taskId, ...newTask };
};

// Update a task
export const updateTask = async (taskId, updates) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { ...updates, updatedAt: Timestamp.now() });
  
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  if (task && task.weekId) {
    await updateWeekMetrics(task.weekId);
  }
};

// Start a task
export const startTask = async (taskId) => {
  const actualStart = new Date();
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (!task) throw new Error('Task not found');
  
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  const plannedStart = new Date(task.createdAt.toDate());
  const dayOffset = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(task.day);
  plannedStart.setDate(plannedStart.getDate() + dayOffset);
  plannedStart.setHours(startHour, startMin, 0, 0);
  
  const delayMinutes = (actualStart - plannedStart) / 60000;
  
  await updateDoc(taskRef, {
    status: 'active',
    actualStart: Timestamp.fromDate(actualStart),
    delay: delayMinutes,
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

// Complete a task
export const completeTask = async (taskId) => {
  const actualEnd = new Date();
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  if (!task) throw new Error('Task not found');
  
  const actualStart = task.actualStart ? task.actualStart.toDate() : new Date();
  
  const [startHour, startMin] = task.startTime.split(':').map(Number);
  const [endHour, endMin] = task.endTime.split(':').map(Number);
  const plannedDuration = ((endHour * 60 + endMin) - (startHour * 60 + startMin));
  const actualDuration = (actualEnd - actualStart) / 60000;
  
  let accuracy = 100;
  if (actualDuration > plannedDuration) {
    accuracy -= Math.min(50, (actualDuration - plannedDuration) * 5);
  } else if (actualDuration < plannedDuration) {
    accuracy += Math.min(20, (plannedDuration - actualDuration) * 2);
  }
  
  if (task.delay > 5) accuracy -= Math.min(30, task.delay);
  accuracy = Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
  
  await updateDoc(taskRef, {
    status: 'completed',
    completion: 100,
    actualEnd: Timestamp.fromDate(actualEnd),
    accuracy: accuracy,
    timeSpent: actualDuration,
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

// Reschedule a task
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
    updatedAt: Timestamp.now()
  });
  
  await updateWeekMetrics(task.weekId);
};

// Delete a task
export const deleteTask = async (taskId) => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const taskDoc = await getDoc(taskRef);
  const task = taskDoc.data();
  
  await deleteDoc(taskRef);
  if (task && task.weekId) await updateWeekMetrics(task.weekId);
};

// Update week metrics
export const updateWeekMetrics = async (weekId) => {
  const tasks = await getWeekTasks(weekId);
  
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const missed = tasks.filter(t => t.status === 'missed').length;
  const totalReschedules = tasks.reduce((sum, t) => sum + (t.rescheduleCount || 0), 0);
  
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const avgAccuracy = completedTasks.length > 0 
    ? completedTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / completedTasks.length
    : 100;
  
  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  let disciplineScore = 100 - (totalReschedules * 3) - (missed * 10);
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  const weeklyScore = (completionRate * 0.5) + (disciplineScore * 0.3) + (avgAccuracy * 0.2);
  
  const weekRef = doc(db, WEEKS_COLLECTION, weekId);
  await updateDoc(weekRef, {
    metrics: {
      completedTasks: completed,
      totalTasks: total,
      completionRate: Math.round(completionRate * 10) / 10,
      disciplineScore: Math.round(disciplineScore * 10) / 10,
      timeAccuracy: Math.round(avgAccuracy * 10) / 10,
      weeklyScore: Math.round(weeklyScore * 10) / 10,
      missedCount: missed,
      totalReschedules: totalReschedules
    },
    updatedAt: Timestamp.now()
  });
};

// Check for missed tasks
export const checkMissedTasks = async (weekId, selectedDate) => {
  const tasks = await getWeekTasks(weekId);
  const now = new Date();
  
  for (const task of tasks) {
    if (task.status === 'pending' && task.title) {
      const [endHour, endMin] = task.endTime.split(':').map(Number);
      const taskDate = new Date(selectedDate);
      const endTime = new Date(taskDate);
      endTime.setHours(endHour, endMin, 0, 0);
      
      if (now > endTime) {
        await updateTask(task.id, { status: 'missed', completion: 0, accuracy: 0 });
      }
    }
  }
};

// Get best focus hours
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

// Get theme
export const getTheme = async () => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  const settingsDoc = await getDoc(settingsRef);
  return settingsDoc.exists() ? settingsDoc.data().theme || { primary: '#a855f7', secondary: '#3b82f6' } : { primary: '#a855f7', secondary: '#3b82f6' };
};

// Update theme
export const updateTheme = async (theme) => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  await setDoc(settingsRef, { theme, updatedAt: Timestamp.now() }, { merge: true });
  return theme;
};

// Get time slots
export const getTimeSlots = async () => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  const settingsDoc = await getDoc(settingsRef);
  return settingsDoc.exists() && settingsDoc.data().timeSlots 
    ? settingsDoc.data().timeSlots 
    : ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
};

// Update time slots
export const updateTimeSlots = async (timeSlots) => {
  const userId = getUserId();
  const settingsRef = doc(db, SETTINGS_COLLECTION, userId);
  await setDoc(settingsRef, { timeSlots, updatedAt: Timestamp.now() }, { merge: true });
  return timeSlots;
};
