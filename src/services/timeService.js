const STORAGE_KEY = 'lifeos_data_v3';

const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
const loadData = () => {
  const d = localStorage.getItem(STORAGE_KEY);
  if(d) return JSON.parse(d);
  return { 
    weeks: {}, 
    themes: { primary: '#a855f7', secondary: '#3b82f6', accent: '#06b6d4' },
    timeSlots: ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'],
    focusHours: {}
  };
};

export const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
};

const calculateMetrics = (tasks) => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const missed = tasks.filter(t => t.status === 'missed').length;
  const totalReschedules = tasks.reduce((sum, t) => sum + (t.rescheduleCount || 0), 0);
  
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const avgAccuracy = completedTasks.length > 0 
    ? completedTasks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / completedTasks.length
    : 100;
  
  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  
  let disciplineScore = 100;
  disciplineScore -= totalReschedules * 3;
  disciplineScore -= missed * 10;
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  const weeklyScore = (completionRate * 0.5) + (disciplineScore * 0.3) + (avgAccuracy * 0.2);
  
  return {
    completedTasks: completed,
    totalTasks: total,
    completionRate: Math.round(completionRate * 10) / 10,
    disciplineScore: Math.round(disciplineScore * 10) / 10,
    timeAccuracy: Math.round(avgAccuracy * 10) / 10,
    weeklyScore: Math.round(weeklyScore * 10) / 10,
    missedCount: missed,
    totalReschedules: totalReschedules
  };
};

export const getCurrentWeek = async (userId, selectedDate = new Date()) => {
  const data = loadData();
  const weekStart = getStartOfWeek(selectedDate);
  const weekKey = weekStart.toISOString();
  
  if (!data.weeks[weekKey]) {
    const defaultTasks = [];
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    
    days.forEach(day => {
      defaultTasks.push({
        id: `${weekKey}_${day}_08:00_${Date.now()}`,
        day,
        startTime: '08:00',
        endTime: '10:00',
        title: '',
        category: 'Study',
        subcategory: 'Lecture Review',
        status: 'pending',
        completion: 0,
        rescheduleCount: 0,
        actualStart: null,
        actualEnd: null,
        delay: 0,
        accuracy: 0,
        timeSpent: 0,
        priority: 'medium',
        notes: '',
        createdAt: new Date().toISOString()
      });
      
      defaultTasks.push({
        id: `${weekKey}_${day}_10:00_${Date.now()}`,
        day,
        startTime: '10:00',
        endTime: '12:00',
        title: '',
        category: 'Work',
        subcategory: 'Deep Work',
        status: 'pending',
        completion: 0,
        rescheduleCount: 0,
        actualStart: null,
        actualEnd: null,
        delay: 0,
        accuracy: 0,
        timeSpent: 0,
        priority: 'medium',
        notes: '',
        createdAt: new Date().toISOString()
      });
      
      defaultTasks.push({
        id: `${weekKey}_${day}_14:00_${Date.now()}`,
        day,
        startTime: '14:00',
        endTime: '16:00',
        title: '',
        category: 'Study',
        subcategory: 'Practice Problems',
        status: 'pending',
        completion: 0,
        rescheduleCount: 0,
        actualStart: null,
        actualEnd: null,
        delay: 0,
        accuracy: 0,
        timeSpent: 0,
        priority: 'medium',
        notes: '',
        createdAt: new Date().toISOString()
      });
    });
    
    const metrics = calculateMetrics(defaultTasks);
    
    data.weeks[weekKey] = {
      id: weekKey,
      weekStart,
      tasks: defaultTasks,
      metrics: metrics
    };
    saveData(data);
  }
  return data.weeks[weekKey];
};

export const getWeekTasks = async (weekId) => {
  const data = loadData();
  return data.weeks[weekId]?.tasks || [];
};

export const updateWeekMetrics = async (weekId) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const metrics = calculateMetrics(week.tasks);
    week.metrics = metrics;
    saveData(data);
    return metrics;
  }
  return null;
};

export const updateTask = async (weekId, taskId, updates) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const taskIndex = week.tasks.findIndex(t => t.id === taskId);
    if(taskIndex !== -1) {
      week.tasks[taskIndex] = { ...week.tasks[taskIndex], ...updates };
      week.metrics = calculateMetrics(week.tasks);
      saveData(data);
      return week.tasks[taskIndex];
    }
  }
  return null;
};

export const startTask = async (taskId, weekId) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const taskIndex = week.tasks.findIndex(t => t.id === taskId);
    if(taskIndex !== -1 && (week.tasks[taskIndex].status === 'pending' || week.tasks[taskIndex].status === 'rescheduled')) {
      const actualStart = new Date();
      const task = week.tasks[taskIndex];
      
      const [startHour, startMin] = task.startTime.split(':').map(Number);
      const plannedStart = new Date(week.weekStart);
      const dayOffset = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(task.day);
      plannedStart.setDate(plannedStart.getDate() + dayOffset);
      plannedStart.setHours(startHour, startMin, 0, 0);
      
      const delayMinutes = (actualStart - plannedStart) / 60000;
      
      week.tasks[taskIndex] = {
        ...task,
        status: 'active',
        actualStart: actualStart.toISOString(),
        delay: delayMinutes
      };
      
      week.metrics = calculateMetrics(week.tasks);
      saveData(data);
      return week.tasks[taskIndex];
    }
  }
  return null;
};

export const completeTask = async (taskId, weekId) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const taskIndex = week.tasks.findIndex(t => t.id === taskId);
    if(taskIndex !== -1 && week.tasks[taskIndex].status === 'active') {
      const actualEnd = new Date();
      const task = week.tasks[taskIndex];
      const actualStart = new Date(task.actualStart);
      
      const [startHour, startMin] = task.startTime.split(':').map(Number);
      const [endHour, endMin] = task.endTime.split(':').map(Number);
      const plannedDuration = ((endHour * 60 + endMin) - (startHour * 60 + startMin));
      const actualDuration = (actualEnd - actualStart) / 60000;
      
      let accuracy = 100;
      if (actualDuration > plannedDuration) {
        const overtime = actualDuration - plannedDuration;
        accuracy -= Math.min(50, overtime * 5);
      } else if (actualDuration < plannedDuration) {
        const earlyFinish = plannedDuration - actualDuration;
        accuracy += Math.min(20, earlyFinish * 2);
      }
      
      if (task.delay > 5) {
        accuracy -= Math.min(30, task.delay);
      }
      
      accuracy = Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
      
      const completionPercentage = Math.min(100, Math.max(0, Math.round((actualDuration / plannedDuration) * 100)));
      
      week.tasks[taskIndex] = {
        ...task,
        status: 'completed',
        completion: completionPercentage,
        actualEnd: actualEnd.toISOString(),
        accuracy: accuracy,
        timeSpent: actualDuration
      };
      
      const hourKey = task.startTime.split(':')[0];
      data.focusHours[hourKey] = (data.focusHours[hourKey] || 0) + accuracy;
      
      week.metrics = calculateMetrics(week.tasks);
      saveData(data);
      return week.tasks[taskIndex];
    }
  }
  return null;
};

export const rescheduleTask = async (taskId, weekId, newDay, newStartTime, newEndTime) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const taskIndex = week.tasks.findIndex(t => t.id === taskId);
    if(taskIndex !== -1) {
      week.tasks[taskIndex] = {
        ...week.tasks[taskIndex],
        day: newDay,
        startTime: newStartTime,
        endTime: newEndTime,
        rescheduleCount: (week.tasks[taskIndex].rescheduleCount || 0) + 1,
        status: 'rescheduled'
      };
      
      week.metrics = calculateMetrics(week.tasks);
      saveData(data);
    }
  }
};

export const addCustomTask = async (weekId, task) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const newTask = {
      id: `${weekId}_${task.day}_${task.startTime}_${Date.now()}`,
      day: task.day,
      startTime: task.startTime,
      endTime: task.endTime,
      title: task.title,
      category: task.category,
      subcategory: task.subcategory || 'General',
      status: 'pending',
      completion: 0,
      rescheduleCount: 0,
      actualStart: null,
      actualEnd: null,
      delay: 0,
      accuracy: 0,
      timeSpent: 0,
      priority: task.priority || 'medium',
      notes: task.notes || '',
      createdAt: new Date().toISOString()
    };
    week.tasks.push(newTask);
    week.metrics = calculateMetrics(week.tasks);
    saveData(data);
    return newTask;
  }
  return null;
};

export const deleteTask = async (weekId, taskId) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    week.tasks = week.tasks.filter(t => t.id !== taskId);
    week.metrics = calculateMetrics(week.tasks);
    saveData(data);
  }
};

export const checkMissedTasks = async (weekId, selectedDate) => {
  const data = loadData();
  const week = data.weeks[weekId];
  if(week) {
    const now = new Date();
    let updated = false;
    
    week.tasks = week.tasks.map(task => {
      if(task.status === 'pending' && task.title) {
        const [endHour, endMin] = task.endTime.split(':').map(Number);
        const taskDate = new Date(selectedDate);
        const endTime = new Date(taskDate);
        endTime.setHours(endHour, endMin, 0, 0);
        
        if(now > endTime) {
          updated = true;
          return { ...task, status: 'missed', completion: 0, accuracy: 0 };
        }
      }
      return task;
    });
    
    if(updated) {
      week.metrics = calculateMetrics(week.tasks);
      saveData(data);
    }
  }
};

export const getBestFocusHours = async () => {
  const data = loadData();
  const sorted = Object.entries(data.focusHours).sort((a,b) => b[1] - a[1]);
  return sorted.slice(0, 3).map(([hour, score]) => ({ hour, score: Math.min(100, score/10) }));
};

export const getTheme = async () => {
  const data = loadData();
  return data.themes;
};

export const updateTheme = async (theme) => {
  const data = loadData();
  data.themes = { ...data.themes, ...theme };
  saveData(data);
  return data.themes;
};

export const getTimeSlots = async () => {
  const data = loadData();
  return data.timeSlots;
};

export const updateTimeSlots = async (timeSlots) => {
  const data = loadData();
  data.timeSlots = timeSlots;
  saveData(data);
  return timeSlots;
};
