// Intelligent Analytics Engine - Complete Behavioral AI System

export const calculateTaskAnalytics = (tasks) => {
  // ========== RAW METRICS ==========
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const missedTasks = tasks.filter(t => t.status === 'missed').length;
  
  // Rescheduled tasks - only count real reschedules
  const rescheduledTasks = tasks.filter(t => 
    (t.rescheduleCount && t.rescheduleCount > 0) && !t.rescheduledFrom
  ).length;
  
  // Overdue tasks - FIXED date parsing
  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.status !== 'pending') return false;
    if (!t.endTime) return false;
    const [h, m] = t.endTime.split(':').map(Number);
    const endTime = new Date();
    endTime.setHours(h, m, 0, 0);
    return now > endTime;
  }).length;
  
  // Completion quality
  const completedTasksList = tasks.filter(t => t.status === 'completed');
  const earlyCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_early' || t.completionType === 'early'
  ).length;
  const onTimeCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_on_time' || t.completionType === 'on_time'
  ).length;
  const lateCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_late' || t.completionType === 'late'
  ).length;
  
  // Delay metrics
  const tasksWithDelay = tasks.filter(t => t.delay > 0);
  const totalDelay = tasksWithDelay.reduce((sum, t) => sum + t.delay, 0);
  const avgDelay = tasksWithDelay.length > 0 ? totalDelay / tasksWithDelay.length : 0;
  
  // Accuracy metrics
  const tasksWithAccuracy = completedTasksList.filter(t => t.accuracy > 0);
  const avgAccuracy = tasksWithAccuracy.length > 0 
    ? tasksWithAccuracy.reduce((sum, t) => sum + t.accuracy, 0) / tasksWithAccuracy.length 
    : 0;
  
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // ========== BEHAVIOR MODEL ==========
  const consistency = completedTasks > 0 
    ? (onTimeCount + earlyCount) / completedTasks 
    : 0;
  
  const overloadRisk = totalTasks > 10 && completionRate < 60;
  const delayPressure = avgDelay > 15;
  
  // Stability score
  let stabilityScore = 100;
  stabilityScore -= rescheduledTasks * 5;
  stabilityScore -= missedTasks * 10;
  stabilityScore -= Math.min(50, avgDelay * 2);
  stabilityScore = Math.max(0, Math.min(100, stabilityScore));
  
  // Behavior classification
  let behavior = "Balanced";
  if (missedTasks > 3) behavior = "Unstable";
  else if (overloadRisk) behavior = "Overloaded";
  else if (delayPressure) behavior = "Delayed Execution";
  else if (consistency > 0.85) behavior = "Highly Disciplined";
  else if (consistency > 0.7) behavior = "Stable Performer";
  else if (consistency < 0.5) behavior = "Inconsistent";
  
  // ========== FOCUS HOURS (REAL COMPUTATION) ==========
  const focusHoursMap = {};
  tasks.forEach(t => {
    if (!t.startTime) return;
    const hour = parseInt(t.startTime.split(':')[0]);
    if (isNaN(hour)) return;
    
    if (!focusHoursMap[hour]) {
      focusHoursMap[hour] = { total: 0, completed: 0 };
    }
    focusHoursMap[hour].total++;
    if (t.status === 'completed') {
      focusHoursMap[hour].completed++;
    }
  });
  
  const focusHoursArray = Object.entries(focusHoursMap).map(([hour, data]) => ({
    hour: `${hour}:00`,
    score: Math.round((data.completed / data.total) * 100)
  })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  
  // ========== FOCUS SCORE ==========
  const focusScore = Math.round(
    (completionRate * 0.5) +
    ((100 - Math.min(100, avgDelay * 2)) * 0.3) +
    (avgAccuracy * 0.2)
  );
  
  // ========== INTELLIGENCE SCORE (NEW BALANCED MODEL) ==========
  const intelligenceScore = Math.round(
    (completionRate * 0.25) +
    (avgAccuracy * 0.20) +
    (stabilityScore * 0.25) +
    (consistency * 100 * 0.20) +
    (focusScore * 0.10)
  );
  
  // ========== DISCIPLINE SCORE ==========
  let disciplineScore = 100;
  disciplineScore -= rescheduledTasks * 2;
  disciplineScore -= missedTasks * 10;
  disciplineScore -= lateCount * 5;
  disciplineScore -= overdueTasks * 8;
  disciplineScore -= Math.min(50, avgDelay / 2);
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  // ========== RISK PREDICTION ENGINE ==========
  const riskScore = Math.min(100,
    (missedTasks * 12) +
    (overdueTasks * 8) +
    (avgDelay * 1.5) +
    (rescheduledTasks * 5)
  );
  
  let riskLevel = "Low";
  if (riskScore > 60) riskLevel = "High";
  else if (riskScore > 30) riskLevel = "Medium";
  
  // ========== STREAK CALCULATION ==========
  let currentStreak = 0;
  let longestStreak = 0;
  let streakCount = 0;
  
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = a.createdAt ? (a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt)) : new Date();
    const dateB = b.createdAt ? (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt)) : new Date();
    return dateA - dateB;
  });
  
  for (const task of sortedTasks) {
    if (task.status === 'completed') {
      streakCount++;
      longestStreak = Math.max(longestStreak, streakCount);
    } else {
      streakCount = 0;
    }
  }
  
  // Get current streak from last 7 days
  const last7Days = tasks.filter(t => {
    const taskDate = t.createdAt ? (t.createdAt.seconds ? new Date(t.createdAt.seconds * 1000) : new Date(t.createdAt)) : new Date();
    const daysDiff = (new Date() - taskDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });
  
  currentStreak = 0;
  for (let i = last7Days.length - 1; i >= 0; i--) {
    if (last7Days[i].status === 'completed') currentStreak++;
    else break;
  }
  
  // ========== AI INSIGHT GENERATION ==========
  const getAIInsight = () => {
    if (riskLevel === "High") {
      return "High risk detected: you're likely to miss upcoming tasks. Reduce workload or increase buffer time.";
    }
    if (behavior === "Overloaded") {
      return "You're taking on too many tasks. Focus on fewer high-impact tasks.";
    }
    if (behavior === "Delayed Execution") {
      return "Your execution speed is slowing. Start tasks immediately when scheduled.";
    }
    if (behavior === "Highly Disciplined") {
      return "Excellent consistency. You are operating at peak discipline.";
    }
    if (behavior === "Unstable") {
      return "Your performance is unstable. Try to establish a consistent daily routine.";
    }
    if (consistency < 0.6) {
      return "Inconsistent execution detected. Focus on improving task follow-through.";
    }
    if (avgDelay > 10) {
      return "Significant delays detected. Set reminders 10 minutes before each task.";
    }
    return "Your performance is stable. Maintain consistency for long-term growth.";
  };
  
  // ========== BURNOUT DETECTION ==========
  const burnoutRisk = avgDelay > 20 && lateCount > completedTasks * 0.4;
  const recoveryRate = missedTasks > 0 
    ? Math.round((completedTasks / (missedTasks + completedTasks)) * 100)
    : 100;
  
  // ========== FINAL RETURN ==========
  return {
    // Core metrics
    totalTasks,
    completedTasks,
    missedTasks,
    rescheduledTasks,
    overdueTasks,
    earlyCount,
    onTimeCount,
    lateCount,
    avgDelay: Math.round(avgDelay),
    totalDelay: Math.round(totalDelay),
    avgAccuracy: Math.round(avgAccuracy),
    completionRate: Math.round(completionRate),
    disciplineScore: Math.round(disciplineScore),
    
    // Intelligent metrics
    intelligenceScore,
    focusScore,
    consistency: Math.round(consistency * 100),
    stabilityScore: Math.round(stabilityScore),
    behavior,
    
    // Risk prediction
    riskScore: Math.round(riskScore),
    riskLevel,
    burnoutRisk,
    recoveryRate,
    
    // Streak tracking
    streakDays: currentStreak,
    longestStreak,
    
    // Focus hours
    focusHours: focusHoursArray,
    
    // AI Insight
    aiInsight: getAIInsight(),
    
    // Verification
    verifiedTotal: completedTasks + missedTasks + rescheduledTasks + overdueTasks
  };
};

export const validateTaskData = (task) => {
  const issues = [];
  
  if (task.status === 'completed' && !task.completionStatus && !task.completionType) {
    issues.push('Missing completion quality for completed task');
  }
  
  if (task.status === 'pending' && task.delay > 0) {
    issues.push('Pending task has delay recorded');
  }
  
  if (task.rescheduledFrom && task.status === 'pending' && !task.rescheduledTo) {
    issues.push('Rescheduled copy task should be startable');
  }
  
  return issues;
};
