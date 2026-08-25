import React from 'react';
import { isBefore, parseISO, startOfDay } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { CheckCircle2, Flame, AlertTriangle, Users } from 'lucide-react';

export default function ProjectAnalytics({ project }) {
  const tasks = project?.tasks || [];
  const today = startOfDay(new Date());

  // Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
  const activeTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'TODO').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === 'DONE') return false;
    const dueDate = startOfDay(parseISO(t.due_date));
    return isBefore(dueDate, today);
  }).length;
  const teamSize = project?.members?.length || 1;

  // 1. Status Distribution Data
  const statusCounts = {
    TODO: tasks.filter((t) => t.status === 'TODO').length,
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    DONE: completedTasks,
  };

  const statusBarData = [
    { name: 'To Do', count: statusCounts.TODO, fill: '#94a3b8' },
    { name: 'In Progress', count: statusCounts.IN_PROGRESS, fill: '#f59e0b' },
    { name: 'Done', count: statusCounts.DONE, fill: '#10b981' },
  ];

  // 2. Type Distribution Data
  const typeCounts = {
    TASK: tasks.filter((t) => t.type === 'TASK').length,
    BUG: tasks.filter((t) => t.type === 'BUG').length,
    FEATURE: tasks.filter((t) => t.type === 'FEATURE').length,
    IMPROVEMENT: tasks.filter((t) => t.type === 'IMPROVEMENT').length,
    OTHER: tasks.filter((t) => t.type === 'OTHER').length,
  };

  const typePieData = [
    { name: 'Features', value: typeCounts.FEATURE, color: '#3b82f6' },
    { name: 'Bugs', value: typeCounts.BUG, color: '#ef4444' },
    { name: 'Tasks', value: typeCounts.TASK, color: '#10b981' },
    { name: 'Improvements', value: typeCounts.IMPROVEMENT, color: '#8b5cf6' },
    { name: 'Other', value: typeCounts.OTHER, color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  // 3. Priority Breakdown
  const priorityCounts = {
    HIGH: tasks.filter((t) => t.priority === 'HIGH').length,
    MEDIUM: tasks.filter((t) => t.priority === 'MEDIUM').length,
    LOW: tasks.filter((t) => t.priority === 'LOW').length,
  };

  const highPct = totalTasks > 0 ? Math.round((priorityCounts.HIGH / totalTasks) * 100) : 0;
  const medPct = totalTasks > 0 ? Math.round((priorityCounts.MEDIUM / totalTasks) * 100) : 0;
  const lowPct = totalTasks > 0 ? Math.round((priorityCounts.LOW / totalTasks) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{completionRate}%</p>
          <p className="text-[11px] text-zinc-400 mt-1">{completedTasks} of {totalTasks} tasks done</p>
        </div>

        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Active Workload</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{activeTasks}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Currently in pipeline</p>
        </div>

        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Overdue Tasks</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{overdueTasks}</p>
          <p className="text-[11px] text-zinc-400 mt-1">{overdueTasks > 0 ? 'Requires attention' : 'On schedule'}</p>
        </div>

        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Team Members</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{teamSize}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Assigned collaborators</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status Breakdown Bar Chart */}
        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            Tasks by Status
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Type Breakdown Pie Chart */}
        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            Tasks by Issue Type
          </h4>
          <div className="h-64">
            {typePieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">
                No tasks available for chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {typePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => <span className="text-zinc-600 dark:text-zinc-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Priority Breakdown Progress Bars */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-4">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          Priority Distribution
        </h4>

        <div className="space-y-3 text-xs">
          {/* High Priority */}
          <div>
            <div className="flex items-center justify-between mb-1 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-rose-600 dark:text-rose-400">High Priority ({priorityCounts.HIGH})</span>
              <span className="font-mono">{highPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${highPct}%` }} />
            </div>
          </div>

          {/* Medium Priority */}
          <div>
            <div className="flex items-center justify-between mb-1 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Medium Priority ({priorityCounts.MEDIUM})</span>
              <span className="font-mono">{medPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${medPct}%` }} />
            </div>
          </div>

          {/* Low Priority */}
          <div>
            <div className="flex items-center justify-between mb-1 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Low Priority ({priorityCounts.LOW})</span>
              <span className="font-mono">{lowPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${lowPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
