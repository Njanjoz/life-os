// src/components/Timetable/Timetable.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Printer, Calendar, ChevronLeft, ChevronRight,
  LayoutGrid, List, Clock,
} from 'lucide-react';
import { getCurrentWeek, getWeekTasks, updateTask } from '../../services/firebaseTaskService';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const QUOTES = [
  { text: "THE SECRET OF GETTING AHEAD IS GETTING STARTED.", author: "— MARK TWAIN" },
  { text: "DISCIPLINE IS THE BRIDGE BETWEEN GOALS AND ACCOMPLISHMENT.", author: "— JIM ROHN" },
  { text: "YOUR FUTURE SELF WILL THANK YOU FOR TODAY'S DISCIPLINE.", author: "— UNKNOWN" },
  { text: "SMALL DAILY IMPROVEMENTS LEAD TO EXTRAORDINARY RESULTS.", author: "— ROBIN SHARMA" },
  { text: "THE FUTURE DEPENDS ON WHAT YOU DO TODAY.", author: "— MAHATMA GANDHI" },
  { text: "DON'T WATCH THE CLOCK. DO WHAT IT DOES — KEEP GOING.", author: "— SAM LEVENSON" },
  { text: "THE BEST TIME TO PLANT A TREE WAS 20 YEARS AGO. THE SECOND BEST TIME IS NOW.", author: "— CHINESE PROVERB" },
  { text: "IT'S NOT ABOUT HAVING TIME. IT'S ABOUT MAKING TIME.", author: "— UNKNOWN" },
  { text: "YOUR LIMITS ARE ONLY IN YOUR MIND.", author: "— UNKNOWN" },
  { text: "CONSISTENCY BEATS TALENT EVERY TIME.", author: "— UNKNOWN" },
];

const STATUS_CYCLE = ['pending', 'completed', 'missed', 'rescheduled'];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function statusMeta(s) {
  switch (s) {
    case 'completed':   return { label: 'Done', bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: '✓' };
    case 'missed':      return { label: 'Missed', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', icon: '✕' };
    case 'rescheduled': return { label: 'Moved', bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '↻' };
    default:            return { label: 'Pending', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', icon: '○' };
  }
}

export default function Timetable() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [selectedDay, setSelectedDay] = useState((new Date().getDay() + 6) % 7);
  const [reschedulePopover, setReschedulePopover] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const popoverRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const week = await getCurrentWeek(selectedDate);
      const all = await getWeekTasks(week.id);
      setTasks(all.filter(t => !t.rescheduledTo));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target))
        setReschedulePopover(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeWeek = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d);
  };

  const weekStart = getWeekStart(selectedDate);
  const getDayDate = (dayName) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + DAYS.indexOf(dayName));
    return d;
  };

  const formatDateRange = () => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const weekNumber = Math.ceil((selectedDate - new Date(selectedDate.getFullYear(), 0, 1)) / 86400000 / 7);
  const allTimes = [...new Set(tasks.map(t => t.startTime))].sort();
  if (!allTimes.length) for (let h = 6; h <= 22; h++) allTimes.push(`${String(h).padStart(2, '0')}:00`);

  const uniqueTitles = [...new Set(tasks.map(t => t.title))];
  const titleColor = Object.fromEntries(uniqueTitles.map((t, i) => [t, ['#c9a53b', '#8b7355', '#b8860b', '#d4af37', '#cd7f32'][i % 5]]));

  const todayIdx = (new Date().getDay() + 6) % 7;
  const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const missedCount = tasks.filter(t => t.status === 'missed').length;
  const reschdCount = tasks.filter(t => t.status === 'rescheduled').length;
  const pct = tasks.length ? Math.round(completedCount / tasks.length * 100) : 0;

  const cycleStatus = async (task, e) => {
    e.stopPropagation();
    const current = task.status || 'pending';
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    if (next === 'rescheduled') {
      const rect = e.currentTarget.getBoundingClientRect();
      setReschedulePopover({
        taskId: task.id,
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
      setRescheduleTime(task.rescheduledTime || '');
      return;
    }
    const updated = { ...task, status: next, rescheduledTime: undefined };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try { await updateTask(task.id, { status: next, rescheduledTime: null }); } catch (err) { console.error(err); }
  };

  const confirmReschedule = async () => {
    if (!reschedulePopover) return;
    const task = tasks.find(t => t.id === reschedulePopover.taskId);
    if (!task) return;
    const updated = { ...task, status: 'rescheduled', rescheduledTime: rescheduleTime };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try { await updateTask(task.id, { status: 'rescheduled', rescheduledTime: rescheduleTime }); } catch (e) { console.error(e); }
    setReschedulePopover(null);
    setRescheduleTime('');
  };

  const StatusToggle = ({ task, size = 'sm' }) => {
    const sm = statusMeta(task.status || 'pending');
    const isLg = size === 'lg';
    return (
      <button
        onClick={(e) => cycleStatus(task, e)}
        title={`Status: ${sm.label} — click to change`}
        style={{
          background: sm.bg,
          border: `1px solid ${sm.border}`,
          color: sm.color,
          padding: isLg ? '4px 11px' : '2px 7px',
          fontSize: isLg ? '11px' : '7.5px',
          fontWeight: 600,
          borderRadius: '99px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: isLg ? '12px' : '8px' }}>{sm.icon}</span>
        <span>{sm.label}</span>
      </button>
    );
  };

  const printTimetable = () => {
    const win = window.open('', '_blank');
    const firebaseUser = auth.currentUser;
    const userName = firebaseUser?.displayName || firebaseUser?.email || 'User';
    const firstName = userName.split(' ')[0];
    
    const printTimes = [...allTimes];
    if (!printTimes.length) for (let h = 6; h <= 22; h++) printTimes.push(`${String(h).padStart(2, '0')}:00`);
    
    const rows = printTimes.length;
    const basePx = Math.max(5.5, Math.min(9, Math.floor(105 / rows)));
    const rowMinH = Math.max(40, Math.min(70, Math.floor(600 / rows)));
    const weekQuote = QUOTES[weekNumber % QUOTES.length];
    
    win.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>LifeOS Timetable — ${formatDateRange()}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: landscape; margin: 0.2in; }
    body {
      background: #faf8f5;
      font-family: 'Cormorant Garamond', serif;
      color: #2c2418;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 12px;
    }
    .print-buttons { display: flex; justify-content: center; gap: 10px; margin-bottom: 15px; }
    .print-buttons button { padding: 8px 20px; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 600; font-family: 'Inter', sans-serif; }
    .btn-print { background: #8b7355; color: white; }
    .btn-close { background: #e8e0d5; color: #5c4a32; }
    @media print { .print-buttons { display: none; } }
    
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #c9a53b; }
    .title h1 { font-size: 28px; font-weight: 700; color: #2c2418; letter-spacing: 2px; font-family: 'Playfair Display', serif; }
    .title p { font-size: 8px; color: #8b7355; letter-spacing: 0.3em; margin-top: 2px; font-family: 'Inter', sans-serif; text-transform: uppercase; }
    .week-info { text-align: right; }
    .week-number { font-size: 11px; color: #c9a53b; font-weight: 600; font-family: 'Playfair Display', serif; }
    .date-range { font-size: 8px; color: #8b7355; margin-top: 2px; font-family: 'Inter', sans-serif; }
    .user-name { font-size: 10px; color: #5c4a32; margin-top: 4px; font-family: 'Inter', sans-serif; }
    
    .manual-stats { display: flex; gap: 20px; margin-bottom: 12px; padding: 10px; background: #f5f0ea; border-radius: 8px; border: 1px solid #d4c5b0; flex-wrap: wrap; justify-content: space-around; }
    .manual-stat { text-align: center; }
    .manual-stat .label { font-size: 7px; color: #8b7355; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; font-family: 'Inter', sans-serif; }
    .manual-stat .blank-line { width: 60px; border-bottom: 1px solid #d4c5b0; margin: 0 auto; padding: 4px 0; }
    
    .quote-section { background: #f5f0ea; border-left: 3px solid #c9a53b; padding: 8px 12px; margin-bottom: 12px; border-radius: 8px; }
    .quote-text { font-size: 10px; font-style: italic; color: #4a3720; font-family: 'Playfair Display', serif; }
    .quote-author { font-size: 7px; color: #c9a53b; margin-top: 4px; font-family: 'Inter', sans-serif; letter-spacing: 0.05em; }
    
    .checklist-row { display: flex; gap: 16px; margin-bottom: 12px; padding: 8px 12px; background: #f5f0ea; border-radius: 8px; border: 1px solid #d4c5b0; flex-wrap: wrap; }
    .checklist-day { display: flex; align-items: center; gap: 6px; }
    .check-box { width: 12px; height: 12px; border: 1.5px solid #c9a53b; border-radius: 2px; display: inline-block; background: white; }
    .checklist-day label { font-size: 8px; font-weight: 500; color: #5c4a32; text-transform: uppercase; font-family: 'Inter', sans-serif; letter-spacing: 0.05em; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #e8e0d5; padding: 6px 3px; border-bottom: 1px solid #d4c5b0; font-weight: 600; font-size: 9px; text-align: center; color: #4a3720; font-family: 'Playfair Display', serif; letter-spacing: 0.05em; }
    td { border-right: 1px solid #e8e0d5; border-bottom: 1px solid #f0ebe5; vertical-align: top; padding: 4px; }
    td:last-child { border-right: none; }
    .time-col { width: 38px; background: #faf8f5; text-align: center; vertical-align: middle; }
    .time-text { font-family: 'Playfair Display', serif; font-size: ${Math.max(6, basePx - 1)}px; color: #8b7355; font-weight: 500; }
    .task-cell { display: flex; flex-direction: column; gap: 4px; min-height: ${rowMinH}px; }
    .task-card { border-left: 2px solid; border-radius: 4px; padding: 4px 6px; background: white; border: 1px solid #e8e0d5; border-left-width: 3px; }
    .task-title { font-size: ${Math.max(7, basePx)}px; font-weight: 600; color: #2c2418; margin-bottom: 2px; font-family: 'Playfair Display', serif; letter-spacing: 0.02em; }
    .task-time { font-family: 'Inter', sans-serif; font-size: ${Math.max(5, basePx - 1.5)}px; color: #8b7355; margin-bottom: 4px; }
    
    .task-options { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
    .option-row { display: flex; align-items: center; gap: 6px; }
    .option-box { width: 10px; height: 10px; border: 1px solid #c9a53b; border-radius: 2px; display: inline-block; background: white; flex-shrink: 0; }
    .option-label { font-size: ${Math.max(5, basePx - 2)}px; color: #5c4a32; font-family: 'Inter', sans-serif; }
    .reschedule-time { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; }
    .reschedule-time .time-blank { width: 25px; border-bottom: 1px solid #d4c5b0; display: inline-block; }
    
    .notes-section { margin-top: 12px; padding: 10px; background: #f5f0ea; border-radius: 8px; border: 1px solid #d4c5b0; }
    .notes-title { font-size: 9px; font-weight: 600; color: #c9a53b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.2em; font-family: 'Inter', sans-serif; }
    .notes-lines { display: flex; flex-direction: column; gap: 8px; }
    .note-line { border-bottom: 1px dashed #d4c5b0; padding-bottom: 6px; min-height: 22px; }
    
    .manual-scoring { margin-top: 12px; padding: 10px; background: #f5f0ea; border-radius: 8px; border: 1px solid #d4c5b0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .score-item { text-align: center; }
    .score-item .label { font-size: 7px; color: #8b7355; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; font-family: 'Inter', sans-serif; }
    .score-item .blank-box { width: 80px; margin: 0 auto; border-bottom: 1px solid #d4c5b0; padding: 4px 0; }
    .score-item .stars { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
    .score-item .star { width: 12px; height: 12px; border: 1px solid #c9a53b; border-radius: 1px; background: white; }
    
    .footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #e8e0d5; font-size: 6px; color: #8b7355; font-family: 'Inter', sans-serif; }
  </style>
</head>
<body>

<div class="print-buttons">
  <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  <button class="btn-close" onclick="window.close()">✖ Close</button>
</div>

<div class="header">
  <div class="title">
    <h1>LIFEOS TIMETABLE</h1>
    <p>Time Architecture • Discipline • Performance</p>
  </div>
  <div class="week-info">
    <div class="week-number">Week ${weekNumber}</div>
    <div class="date-range">${formatDateRange()}</div>
    <div class="user-name">${userName}</div>
  </div>
</div>

<div class="manual-stats">
  <div class="manual-stat"><div class="label">TASKS COMPLETED</div><div class="blank-line"></div></div>
  <div class="manual-stat"><div class="label">TASKS MISSED</div><div class="blank-line"></div></div>
  <div class="manual-stat"><div class="label">RESCHEDULED</div><div class="blank-line"></div></div>
  <div class="manual-stat"><div class="label">TOTAL TASKS</div><div class="blank-line"></div></div>
  <div class="manual-stat"><div class="label">COMPLETION %</div><div class="blank-line"></div></div>
</div>

<div class="quote-section">
  <div class="quote-text">“${weekQuote.text}”</div>
  <div class="quote-author">${weekQuote.author}</div>
</div>

<div class="checklist-row">
  ${DAYS.map(day => `<div class="checklist-day"><span class="check-box"></span><label>${day.slice(0, 3)}</label></div>`).join('')}
  <div class="checklist-day"><span class="check-box"></span><label>ALL DONE</label></div>
</div>

<table>
  <thead>
    <tr>
      <th class="time-col">TIME</th>
      ${DAYS.map(day => `<th>${day.slice(0, 3)}<br><span style="font-size:6px;font-weight:normal;">${getDayDate(day).toLocaleDateString()}</span></th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${printTimes.map(time => `
      <tr>
        <td class="time-col"><span class="time-text">${time}</span></td>
        ${DAYS.map(day => {
          const task = tasks.find(t => t.day === day && t.startTime === time);
          const taskColor = task ? (titleColor[task.title] || '#c9a53b') : '#d4c5b0';
          return `
            <td>
              <div class="task-cell">
                ${task ? `
                  <div class="task-card" style="border-left-color: ${taskColor};">
                    <div class="task-title">${task.title.length > 22 ? task.title.substring(0, 20) + '..' : task.title}</div>
                    <div class="task-time">${task.startTime}–${task.endTime}</div>
                    <div class="task-options">
                      <div class="option-row">
                        <span class="option-box"></span>
                        <span class="option-label">✓ Done</span>
                      </div>
                      <div class="option-row">
                        <span class="option-box"></span>
                        <span class="option-label">✗ Missed</span>
                      </div>
                      <div class="option-row">
                        <span class="option-box"></span>
                        <span class="option-label">↻ Moved to</span>
                        <span class="reschedule-time"><span class="time-blank"></span> : <span class="time-blank"></span></span>
                      </div>
                    </div>
                    ${task.notes ? `<div style="font-size:${Math.max(5, basePx - 2)}px; color:#8b7355; margin-top:4px;">✒️ ${task.notes.substring(0, 35)}</div>` : ''}
                  </div>
                ` : `
                  <div style="display:flex; align-items:center; justify-content:center; height:${rowMinH}px; opacity:0.3;">
                    <span class="option-box"></span>
                    <span class="option-label" style="margin-left:6px;">Free slot</span>
                  </div>
                `}
              </div>
            </td>
          `;
        }).join('')}
      </tr>
    `).join('')}
  </tbody>
</table>

<div class="manual-scoring">
  <div class="score-item">
    <div class="label">DISCIPLINE SCORE</div>
    <div class="blank-box"></div>
    <div class="stars">
      <span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span>
    </div>
  </div>
  <div class="score-item">
    <div class="label">FOCUS SCORE</div>
    <div class="blank-box"></div>
    <div class="stars">
      <span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span>
    </div>
  </div>
  <div class="score-item">
    <div class="label">OVERALL RATING</div>
    <div class="blank-box"></div>
    <div class="stars">
      <span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span>
    </div>
  </div>
</div>

<div class="notes-section">
  <div class="notes-title">WEEKLY NOTES & REFLECTIONS</div>
  <div class="notes-lines">
    <div class="note-line"></div>
    <div class="note-line"></div>
    <div class="note-line"></div>
    <div class="note-line"></div>
    <div class="note-line"></div>
    <div class="note-line"></div>
  </div>
</div>

<div class="footer">
  <span>LifeOS — Time Management System</span>
  <span>${firstName}'s Planner</span>
  <span>✧ Tick boxes with pen | Fill in moved time | Rate your week ✧</span>
</div>

</body>
</html>`);
    win.document.close();
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent"/>
    </div>
  );

  const dayTasks = tasks.filter(t => t.day === DAYS[selectedDay]);
  const dayTimes = [...new Set(dayTasks.map(t => t.startTime))].sort();

  const WeekCell = ({ task }) => {
    if (!task) return (
      <div className="h-full min-h-[36px] rounded flex items-center justify-center opacity-20">
        <div className="w-1 h-1 rounded-full bg-slate-400"/>
      </div>
    );
    const ac = titleColor[task.title] || '#c9a53b';
    return (
      <div className="rounded p-1.5 flex flex-col gap-1 bg-white border border-gray-100" style={{ borderLeft: `2.5px solid ${ac}`, minHeight: 36 }}>
        <p className="text-[8.5px] font-semibold text-gray-800 leading-snug line-clamp-2 flex-1 font-serif">{task.title}</p>
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[7px] text-gray-500 font-mono">{task.startTime}</span>
          <StatusToggle task={task} size="sm"/>
        </div>
        {task.status === 'rescheduled' && task.rescheduledTime && (
          <div className="text-[7px] text-amber-600 font-mono">→ {task.rescheduledTime}</div>
        )}
      </div>
    );
  };

  const DayCard = ({ task }) => {
    const ac = titleColor[task.title] || '#c9a53b';
    const done = task.status === 'completed';
    return (
      <div className="rounded-xl p-3 flex gap-3 transition-all bg-white border border-gray-100" style={{ borderLeft: `3px solid ${ac}`, opacity: done ? 0.7 : 1 }}>
        <div className="flex flex-col items-center pt-0.5 gap-1 shrink-0 w-10">
          <span className="text-[9px] font-mono text-gray-500">{task.startTime}</span>
          <div className="w-px flex-1 bg-gray-200"/>
          <span className="text-[9px] font-mono text-gray-400">{task.endTime}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-800'} font-serif`}>{task.title}</p>
          {task.notes && <p className="text-[10px] text-gray-500 mt-1 leading-snug line-clamp-3">{task.notes}</p>}
          {task.status === 'rescheduled' && task.rescheduledTime && (
            <p className="text-[10px] text-amber-600 font-mono mt-1">↻ Moved → {task.rescheduledTime}</p>
          )}
          <div className="mt-2"><StatusToggle task={task} size="lg"/></div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-full overflow-x-auto relative">
      <div className="min-w-[320px] space-y-3">

        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-indigo-500 shrink-0"/>
            <span className="text-xs font-medium text-gray-800">{formatDateRange()}</span>
            <span className="text-[9px] text-gray-400 font-mono">W{weekNumber}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => changeWeek(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700">
              <ChevronLeft size={14}/>
            </button>
            <button onClick={() => changeWeek(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700">
              <ChevronRight size={14}/>
            </button>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-1">
              <button onClick={() => setViewMode('week')} className={`p-1.5 rounded transition ${viewMode === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                <LayoutGrid size={12}/>
              </button>
              <button onClick={() => setViewMode('day')} className={`p-1.5 rounded transition ${viewMode === 'day' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                <List size={12}/>
              </button>
            </div>
            <button onClick={printTimetable} className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition ml-1 shadow-sm">
              <Printer size={13}/>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
          {[
            { n: tasks.length, l: 'Total', c: 'text-gray-600' },
            { n: completedCount, l: 'Done', c: 'text-emerald-600' },
            { n: missedCount, l: 'Missed', c: 'text-red-600' },
            { n: reschdCount, l: 'Moved', c: 'text-amber-600' },
          ].map(({ n, l, c }) => (
            <div key={l} className="text-center min-w-[36px]">
              <div className={`text-lg font-bold leading-none ${c}`}>{n}</div>
              <div className="text-[8px] text-gray-400 uppercase tracking-wider mt-0.5">{l}</div>
            </div>
          ))}
          <div className="flex-1 min-w-[80px]">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-gray-500 font-mono">Progress</span>
              <span className="text-[9px] text-gray-500 font-mono">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #818cf8, #a855f7)' }}/>
            </div>
          </div>
          <div className="hidden sm:block flex-1 min-w-0 border-l border-gray-200 pl-3">
            <p className="text-[9px] text-gray-500 italic leading-snug line-clamp-2 font-serif">"{randomQuote.text}"</p>
            <p className="text-[8px] text-gray-400 font-mono mt-0.5">{randomQuote.author}</p>
          </div>
        </div>

        <div className="flex gap-1">
          {DAYS.map((day, idx) => {
            const isSel = selectedDay === idx;
            const isToday = todayIdx === idx;
            const dt = tasks.filter(t => t.day === day);
            const dp = dt.length ? Math.round(dt.filter(t => t.status === 'completed').length / dt.length * 100) : 0;
            return (
              <button key={day} onClick={() => { setSelectedDay(idx); setViewMode('day'); }}
                className={`flex-1 rounded-xl py-2 px-1 text-center transition border ${
                  isSel ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : isToday ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}>
                <div className="text-[9px] font-bold uppercase tracking-wide">{day.slice(0,3)}</div>
                <div className="text-[8px] mt-0.5 opacity-60 font-mono">{getDayDate(day).getDate()}</div>
                {dt.length > 0 && (
                  <div className="mt-1 h-0.5 rounded-full overflow-hidden bg-gray-200 mx-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${dp}%`, background: isSel ? '#fff' : '#818cf8' }}/>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {viewMode === 'week' ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-8 border-b border-gray-100 bg-gray-50">
              <div className="p-2 text-center text-[8px] font-mono text-gray-500 uppercase border-r border-gray-100">Time</div>
              {DAYS.map(day => (
                <div key={day} className="p-2 text-center border-r border-gray-100 last:border-r-0">
                  <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">{day.slice(0,3)}</div>
                  <div className="text-[8px] text-gray-400 font-mono">{getDayDate(day).getDate()}</div>
                </div>
              ))}
            </div>
            {allTimes.map(time => {
              const tasksInRow = DAYS.map(d => tasks.filter(t => t.day === d && t.startTime === time));
              const maxStack = Math.max(1, ...tasksInRow.map(a => a.length));
              return (
                <div key={time} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0" style={{ minHeight: `${Math.max(44, maxStack * 52)}px` }}>
                  <div className="p-2 text-center border-r border-gray-100 bg-gray-50 flex items-center justify-center">
                    <span className="text-[8px] font-mono text-gray-500">{time}</span>
                  </div>
                  {DAYS.map((day, di) => {
                    const slotTasks = tasksInRow[di];
                    return (
                      <div key={day} className="p-1 border-r border-gray-100 last:border-r-0 flex flex-col gap-1">
                        {slotTasks.length > 0 ? slotTasks.map(task => <WeekCell key={task.id} task={task}/>) : <WeekCell task={null}/>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-semibold text-gray-800 font-serif">{DAYS[selectedDay]}</h2>
              <span className="text-[10px] text-gray-500 font-mono">{getDayDate(DAYS[selectedDay]).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
              <span className="text-[9px] text-gray-400 ml-auto">{dayTasks.length} tasks</span>
            </div>
            {dayTasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <div className="text-3xl mb-3">🌿</div>
                <p className="text-sm text-gray-500">No tasks this day</p>
                <p className="text-[10px] text-gray-400 mt-1">Enjoy the space</p>
              </div>
            ) : (
              dayTimes.flatMap(time => dayTasks.filter(t => t.startTime === time).map(task => <DayCard key={task.id} task={task}/>))
            )}
          </div>
        )}
      </div>

      {reschedulePopover && (
        <div ref={popoverRef} className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-52" style={{ top: Math.min(reschedulePopover.top, window.innerHeight - 170), left: Math.min(reschedulePopover.left, window.innerWidth - 220) }}>
          <p className="text-[11px] font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Clock size={11} className="text-amber-500"/> Reschedule to</p>
          <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:border-indigo-400 mb-3" autoFocus/>
          <div className="flex gap-2">
            <button onClick={confirmReschedule} className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-bold transition">Confirm</button>
            <button onClick={() => setReschedulePopover(null)} className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}