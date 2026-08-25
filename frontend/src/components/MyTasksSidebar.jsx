import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { ChevronDown, CheckSquare } from 'lucide-react';
import { useAppUser } from './ClerkAuthAdapter';

export default function MyTasksSidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { user } = useAppUser();
  const { currentWorkspace } = useSelector((state) => state.workspace);

  const currentUserId = user?.id;

  // Extract all tasks assigned to current user across current workspace projects
  const myTasks = [];
  currentWorkspace?.projects?.forEach((proj) => {
    proj.tasks?.forEach((task) => {
      if (
        (currentUserId && (task.assigneeId === currentUserId || task.assignee?.id === currentUserId)) ||
        (!currentUserId && task.assigneeId)
      ) {
        myTasks.push({ ...task, projectName: proj.name });
      }
    });
  });

  const getStatusDot = (status) => {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-500 shadow-emerald-500/40';
      case 'IN_PROGRESS':
        return 'bg-amber-500 shadow-amber-500/40';
      case 'TODO':
      default:
        return 'bg-slate-400 dark:bg-zinc-500';
    }
  };

  return (
    <div className="space-y-1">
      {/* Header Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/40 cursor-pointer"
      >
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>My Tasks</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
            {myTasks.length}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>
      </button>

      {/* Task List */}
      {isExpanded && (
        <div className="pl-2 space-y-0.5 animate-in fade-in duration-150">
          {myTasks.length === 0 ? (
            <p className="px-3 py-1.5 text-[11px] text-zinc-400 italic">No tasks assigned.</p>
          ) : (
            myTasks.slice(0, 6).map((task) => (
              <NavLink
                key={task.id}
                to={`/taskDetails?id=${task.id}`}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 font-medium'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40'
                  }`
                }
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(task.status)}`} />
                  <span className="truncate text-[11px]">{task.title}</span>
                </div>
              </NavLink>
            ))
          )}
        </div>
      )}
    </div>
  );
}
