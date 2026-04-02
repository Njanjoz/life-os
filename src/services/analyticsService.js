// Unified analytics engine - ONE SOURCE OF TRUTH

export const calculateTaskAnalytics = (tasks) => {
  // Total tasks - ALL tasks in the week
  const totalTasks = tasks.length;
  
  // Completed tasks - status is 'completed'
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  
  // Missed tasks - status is 'missed'
  const missedTasks = tasks.filter(t => t.status === 'missed').length;
  
  // Rescheduled tasks - check multiple flags for consistency
  const rescheduledTasks = tasks.filter(t => 
    t.status === 'rescheduled' || 
    t.isRescheduled === true || 
    t.rescheduledFrom === true ||
    t.rescheduledTo !== null
  ).length;
  
  // Overdue tasks - pending tasks where time has passed
  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.status !== 'pending') return false;
    if (!t.endTime) return false;
    const endTime = new Date(t.endTime);
    return now > endTime;
  }).length;
  
  // Completion quality - ONLY for completed tasks
  const completedTasksList = tasks.filter(t => t.status === 'completed');
  
  const earlyCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_early' || 
    t.completionType === 'early'
  ).length;
  
  const onTimeCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_on_time' || 
    t.completionType === 'on_time'
  ).length;
  
  const lateCount = completedTasksList.filter(t => 
    t.completionStatus === 'completed_late' || 
    t.completionType === 'late'
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
  
  // Completion rate
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Discipline score
  let disciplineScore = 100;
  disciplineScore -= rescheduledTasks * 2;
  disciplineScore -= missedTasks * 10;
  disciplineScore -= lateCount * 5;
  disciplineScore -= overdueTasks * 8;
  disciplineScore -= Math.min(50, avgDelay / 2);
  disciplineScore = Math.max(0, Math.min(100, disciplineScore));
  
  // Weekly score
  const weeklyScore = (completionRate * 0.3) + (disciplineScore * 0.3) + (avgAccuracy * 0.2) + ((earlyCount / (completedTasks || 1)) * 20);
  
  // Verification - these numbers should add up to totalTasks
  const accountedTasks = completedTasks + missedTasks + rescheduledTasks;
  
  return {
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
    weeklyScore: Math.round(weeklyScore),
    // Debug info
    accountedTasks,
    unaccountedTasks: totalTasks - accountedTasks
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
  
  if (task.rescheduledFrom && task.status !== 'missed') {
    issues.push('Rescheduled from task should be marked as missed');
  }
  
  return issues;
};
