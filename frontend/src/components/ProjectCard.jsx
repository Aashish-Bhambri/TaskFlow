import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Calendar, Layers, Users, ArrowUpRight } from 'lucide-react';
import { projectStatusStyles, taskPriorityStyles } from '../assets/assets';

export default function ProjectCard({ project }) {
  const formattedEndDate = project.end_date
    ? format(parseISO(project.end_date), 'MMM d, yyyy')
    : 'Ongoing';

  return (
    <Link
      to={`/projectsDetail?id=${project.id}&tab=tasks`}
      className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between group cursor-pointer"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              projectStatusStyles[project.status] || 'bg-zinc-100 text-zinc-700'
            }`}
          >
            {project.status.replace('_', ' ')}
          </span>

          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              taskPriorityStyles[project.priority] || taskPriorityStyles.MEDIUM
            }`}
          >
            {project.priority}
          </span>
        </div>

        {/* Title & Description */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white transition line-clamp-1">
            {project.name}
          </h3>
          <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition shrink-0 opacity-0 group-hover:opacity-100 -translate-y-0.5 translate-x-0.5 group-hover:translate-y-0 group-hover:translate-x-0" />
        </div>

        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {project.description || 'No description provided.'}
        </p>
      </div>

      {/* Progress & Metadata */}
      <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span>Progress</span>
            <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
              {project.progress || 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${project.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Footer info: Members & Tasks count & End Date */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
          {/* Members Avatars */}
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {(project.members || []).slice(0, 3).map((member, i) => (
              <img
                key={member.id || i}
                src={member.image || member.user?.image}
                alt={member.name || member.user?.name}
                className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-[#12141e]"
                title={member.name || member.user?.name}
              />
            ))}
            {(project.members?.length || 0) > 3 && (
              <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[9px] font-bold flex items-center justify-center text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-[#12141e]">
                +{(project.members.length - 3)}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <Layers className="w-3 h-3 text-zinc-400" />
              <span>{project.tasks?.length || 0}</span>
            </span>

            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span>{formattedEndDate}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
