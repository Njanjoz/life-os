import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

const WeekChart = ({ data, onDayClick }) => {
  const getBarColor = (completion, failure) => {
    if (completion >= 80) return '#22c55e';
    if (completion >= 60) return '#eab308';
    if (failure > 50) return '#ef4444';
    return '#3b82f6';
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-purple-400" />
        <h2 className="text-sm font-medium text-white">Weekly Performance</h2>
        <span className="text-[10px] text-slate-500 ml-auto">Click on bars for day analysis</span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff'
            }}
            formatter={(value, name) => [`${Math.round(value)}%`, name === 'completionRate' ? 'Completion' : 'Missed']}
          />
          <Bar 
            dataKey="completionRate" 
            name="Completion Rate"
            radius={[8, 8, 0, 0]}
            onClick={(data) => onDayClick(data.day)}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.completionRate, entry.failureRate)} />
            ))}
          </Bar>
          <Bar 
            dataKey="failureRate" 
            name="Missed Rate" 
            fill="#ef4444" 
            radius={[8, 8, 0, 0]}
            onClick={(data) => onDayClick(data.day)}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-400">Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-400">Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-slate-400">At Risk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-400">In Progress</span>
        </div>
      </div>
    </div>
  );
};

export default WeekChart;
