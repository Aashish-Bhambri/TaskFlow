import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { isBefore, parseISO, startOfDay, format } from 'date-fns';
import {
  ListTodo,
  AlertTriangle,
  Flame,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { currentUser } from '../assets/assets';

export default function TasksSummary() {
  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  const allTasks = [];
  projects.forEach((proj) => {
    proj.tasks?.forEach((task) => {
      allTasks.push({ ...task, projectName: proj.name });
    });
  });

  const today = startOfDay(new Date());

  // 1. My Tasks
  const myTasks = allTasks.filter(
    (t) => t.assigneeId === currentUser.id || t.assignee?.id === currentUser.id
  );

  // 2. Overdue Tasks
  const overdueTasks = allTasks.filter((t) => {
    if (!t.due_date || t.status === 'DONE') return false;
    const due = startOfDay(parseISO(t.due_date));
    return isBefore(due, today);
  });

  // 3. In Progress Tasks
  const inProgressTasks = allTasks.filter((t) => t.status === 'IN_PROGRESS');

  const sections = [
    {
      title: 'My Tasks',
      icon: ListTodo,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      borderColor: 'border-indigo-100 dark:border-indigo-900/30',
      count: myTasks.length,
      tasks: myTasks.slice(0, 3),
      emptyText: 'No tasks currently assigned.',
    },
    {
      title: 'Overdue Attention',
      icon: AlertTriangle,
      iconColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
      borderColor: 'border-rose-100 dark:border-rose-900/30',
      count: overdueTasks.length,
      tasks: overdueTasks.slice(0, 3),
      emptyText: 'Zero overdue tasks. Great job!',
    },
    {
      title: 'In Progress',
      icon: Flame,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-100 dark:border-amber-900/30',
      count: inProgressTasks.length,
      tasks: inProgressTasks.slice(0, 3),
      emptyText: 'No tasks currently in progress.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div
            key={section.title}
            className={`bg-white dark:bg-[#12141e] border ${section.borderColor} rounded-2xl p-4 shadow-xs flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60 mb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${section.bgColor} ${section.iconColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{section.title}</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300">
                  {section.count}
                </span>
              </div>

              {section.tasks.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-3 text-center">{section.emptyText}</p>
              ) : (
                <div className="space-y-2">
                  {section.tasks.map((task) => (
                    <Link
                      key={task.id}
                      to={`/taskDetails?id=${task.id}`}
                      className="block p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 transition group"
                    >
                      <h5 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                        {task.title}
                      </h5>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="truncate">{task.projectName}</span>
                        {task.due_date && (
                          <span className="font-mono">
                            {format(parseISO(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-right">
              <Link
                to="/projects"
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 inline-flex items-center gap-1"
              >
                <span>View projects</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
