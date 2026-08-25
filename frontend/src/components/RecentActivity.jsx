import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Bug,
  Zap,
  Square,
  GitCommit,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { taskStatusStyles } from '../assets/assets';

export default function RecentActivity() {
  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  // Flatten all tasks
  const allTasks = [];
  projects.forEach((proj) => {
    proj.tasks?.forEach((task) => {
      allTasks.push({
        ...task,
        projectName: proj.name,
      });
    });
  });

  // Sort by updatedAt or createdAt desc
  const sortedTasks = [...allTasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      case 'FEATURE':
        return <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'TASK':
        return <Square className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
      case 'IMPROVEMENT':
        return <GitCommit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'OTHER':
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recent Activity</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Live task updates and protocol actions</p>
        </div>
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time</span>
        </div>
      </div>

      {sortedTasks.length === 0 ? (
        <p className="text-xs text-zinc-400 italic py-4 text-center">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const timeString = task.updatedAt
              ? format(parseISO(task.updatedAt), 'MMM d, h:mm a')
              : format(parseISO(task.createdAt), 'MMM d, h:mm a');

            return (
              <Link
                key={task.id}
                to={`/taskDetails?id=${task.id}`}
                className="flex items-start space-x-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition group border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-800/60"
              >
                <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 shrink-0 mt-0.5">
                  {getTypeIcon(task.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                      {task.title}
                    </h4>
                    <span
                      className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${
                        taskStatusStyles[task.status] || ''
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="truncate text-zinc-500 dark:text-zinc-400">
                      in <span className="font-medium text-zinc-700 dark:text-zinc-300">{task.projectName}</span>
                    </span>
                    <div className="flex items-center space-x-2 shrink-0">
                      {task.assignee && (
                        <div className="flex items-center space-x-1">
                          <img
                            src={task.assignee.image}
                            alt={task.assignee.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                          <span className="text-[10px] hidden sm:inline">{task.assignee.name.split(' ')[0]}</span>
                        </div>
                      )}
                      <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{timeString}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
