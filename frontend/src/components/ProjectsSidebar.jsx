import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Folder,
  ChevronDown,
  CheckSquare,
  Calendar,
  BarChart2,
  Settings,
  Plus,
} from 'lucide-react';

export default function ProjectsSidebar({ onOpenCreateProject }) {
  const [expandedProjects, setExpandedProjects] = useState({});
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [searchParams] = useSearchParams();
  const currentProjectId = searchParams.get('id');
  const currentTab = searchParams.get('tab') || 'tasks';

  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  const toggleProject = (projectId) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const tabs = [
    { key: 'tasks', label: 'Tasks', icon: CheckSquare },
    { key: 'calendar', label: 'Calendar', icon: Calendar },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <button
          onClick={() => setIsSectionOpen(!isSectionOpen)}
          className="flex items-center space-x-2 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Projects</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isSectionOpen ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        <button
          onClick={onOpenCreateProject}
          title="Create New Project"
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Projects List */}
      {isSectionOpen && (
        <div className="space-y-1 pl-1">
          {projects.length === 0 ? (
            <p className="px-3 py-1 text-[11px] text-zinc-400 italic">No projects yet.</p>
          ) : (
            projects.map((project) => {
              const isExpanded = !!expandedProjects[project.id];
              const isSelectedProject = currentProjectId === project.id;

              return (
                <div key={project.id} className="space-y-0.5">
                  {/* Project Accordion Item */}
                  <div
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition group cursor-pointer ${
                      isSelectedProject
                        ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40'
                    }`}
                    onClick={() => toggleProject(project.id)}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div className="w-2 h-2 rounded-sm bg-indigo-500 shrink-0" />
                      <span className="truncate text-xs">{project.name}</span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400">
                        {project.tasks?.length || 0}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Sub-links (Tasks, Calendar, Analytics, Settings) */}
                  {isExpanded && (
                    <div className="pl-5 space-y-0.5 animate-in fade-in duration-150">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isTabActive = isSelectedProject && currentTab === tab.key;

                        return (
                          <NavLink
                            key={tab.key}
                            to={`/projectsDetail?id=${project.id}&tab=${tab.key}`}
                            className={`flex items-center space-x-2 px-2 py-1 rounded-md text-[11px] transition ${
                              isTabActive
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 font-medium'
                                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/30'
                            }`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{tab.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
