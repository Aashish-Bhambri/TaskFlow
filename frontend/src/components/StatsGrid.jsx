import React from 'react';
import { useSelector } from 'react-redux';
import { isBefore, parseISO, startOfDay } from 'date-fns';
import {
  FolderGit2,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
} from 'lucide-react';
import { useAppUser } from './ClerkAuthAdapter';

export default function StatsGrid() {
  const { user } = useAppUser();
  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  // Calculate stats
  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED' || p.progress === 100).length;

  let myTasksCount = 0;
  let overdueTasksCount = 0;
  const today = startOfDay(new Date());

  const currentUserId = user?.id;

  projects.forEach((proj) => {
    proj.tasks?.forEach((task) => {
      if (
        (currentUserId && (task.assigneeId === currentUserId || task.assignee?.id === currentUserId)) ||
        (!currentUserId && task.assigneeId)
      ) {
        myTasksCount++;
      }
      if (task.dueDate && task.status !== 'DONE') {
        const dueDate = startOfDay(parseISO(task.dueDate));
        if (isBefore(dueDate, today)) {
          overdueTasksCount++;
        }
      }
    });
  });

  const cards = [
    {
      label: 'Total Projects',
      value: totalProjects,
      change: totalProjects > 0 ? `${totalProjects} active` : 'No projects yet',
      icon: FolderGit2,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'border-indigo-100 dark:border-indigo-900/40',
    },
    {
      label: 'Completed Projects',
      value: completedProjects,
      change: totalProjects > 0 ? `${Math.round((completedProjects / totalProjects) * 100)}% completed` : '0% completed',
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-100 dark:border-emerald-900/40',
    },
    {
      label: 'My Tasks',
      value: myTasksCount,
      change: 'Assigned to you',
      icon: ListTodo,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      borderColor: 'border-blue-100 dark:border-blue-900/40',
    },
    {
      label: 'Overdue Tasks',
      value: overdueTasksCount,
      change: overdueTasksCount > 0 ? 'Requires attention' : 'All clear',
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-100 dark:border-rose-900/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`p-4 rounded-2xl bg-white dark:bg-[#12141e] border ${card.borderColor} shadow-xs hover:shadow-md transition duration-200 group`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {card.label}
              </span>
              <div className={`p-2 rounded-xl ${card.bgColor} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {card.value}
              </span>
              <span className="text-[11px] font-medium text-zinc-400 flex items-center">
                {card.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
