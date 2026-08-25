import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Users, Calendar, Layers } from 'lucide-react';
import { projectStatusStyles } from '../assets/assets';

export default function ProjectOverview() {
  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  // Filter top 5 active/planning projects
  const topProjects = [...projects]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  const getPriorityDot = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-rose-500 shadow-rose-500/50';
      case 'MEDIUM':
        return 'bg-blue-500 shadow-blue-500/50';
      case 'LOW':
      default:
        return 'bg-emerald-500 shadow-emerald-500/50';
    }
  };

  return (
    <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Active Projects Overview</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">High priority initiative tracking</p>
        </div>
        <Link
          to="/projects"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 transition"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {topProjects.length === 0 ? (
        <p className="text-xs text-zinc-400 italic py-4 text-center">No projects in this workspace.</p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {topProjects.map((project) => {
            const formattedDate = project.end_date
              ? format(parseISO(project.end_date), 'MMM d, yyyy')
              : 'No deadline';

            return (
              <div
                key={project.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${getPriorityDot(
                        project.priority
                      )}`}
                      title={`Priority: ${project.priority}`}
                    />
                    <Link
                      to={`/projectsDetail?id=${project.id}&tab=tasks`}
                      className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate"
                    >
                      {project.name}
                    </Link>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        projectStatusStyles[project.status] || 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      <span>{formattedDate}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-zinc-400" />
                      <span>{project.members?.length || 1} members</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-zinc-400" />
                      <span>{project.tasks?.length || 0} tasks</span>
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Percentage */}
                <div className="sm:w-44 flex items-center space-x-3 shrink-0">
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${project.progress || 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 w-9 text-right">
                    {project.progress || 0}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
