import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  CheckSquare,
  Calendar,
  BarChart2,
  Settings,
  Layers,
  CheckCircle2,
  Flame,
  Users,
  GitFork,
} from 'lucide-react';
import ProjectTasks from '../components/ProjectTasks';
import DAGVisualizer from '../components/DAGVisualizer';
import ProjectCalendar from '../components/ProjectCalendar';
import ProjectAnalytics from '../components/ProjectAnalytics';
import ProjectSettings from '../components/ProjectSettings';
import CreateTaskDialog from '../components/CreateTaskDialog';
import { projectStatusStyles } from '../assets/assets';

export default function ProjectDetails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const projectId = searchParams.get('id');
  const activeTab = searchParams.get('tab') || 'tasks';

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  // Locate project by ID, or fallback to first project
  const project = projects.find((p) => p.id === projectId) || projects[0];

  const handleTabChange = (tabKey) => {
    setSearchParams({ id: project?.id || '', tab: tabKey });
  };

  if (!project) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-sm text-zinc-400">No project selected or project not found.</p>
        <Link
          to="/projects"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  // Metrics
  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter((t) => t.status === 'DONE').length || 0;
  const inProgressTasks = project.tasks?.filter((t) => t.status === 'IN_PROGRESS').length || 0;
  const memberCount = project.members?.length || 1;

  const tabs = [
    { key: 'tasks', label: 'Tasks', icon: CheckSquare, count: totalTasks },
    { key: 'dag', label: 'DAG Workflow', icon: GitFork },
    { key: 'calendar', label: 'Calendar', icon: Calendar },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Back Action */}
      <div className="space-y-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-center justify-between">
          <Link
            to="/projects"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Projects Directory</span>
          </Link>

          <button
            onClick={() => setIsCreateTaskOpen(true)}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>

        {/* Project Title, Status & Description */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {project.name}
              </h1>
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  projectStatusStyles[project.status] || ''
                }`}
              >
                {project.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl">
              {project.description || 'No description provided.'}
            </p>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">Total Tasks</span>
              <p className="text-base font-bold text-zinc-900 dark:text-white">{totalTasks}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">Completed</span>
              <p className="text-base font-bold text-zinc-900 dark:text-white">{completedTasks}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">In Progress</span>
              <p className="text-base font-bold text-zinc-900 dark:text-white">{inProgressTasks}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">Members</span>
              <p className="text-base font-bold text-zinc-900 dark:text-white">{memberCount}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center space-x-1 border-b border-zinc-200/80 dark:border-zinc-800/80 -mb-2 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === 'tasks' && (
          <ProjectTasks
            project={project}
            onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          />
        )}

        {activeTab === 'dag' && (
          <DAGVisualizer
            project={project}
            onSelectTask={(t) => navigate(`/taskDetails?id=${t.id}`)}
          />
        )}

        {activeTab === 'calendar' && <ProjectCalendar project={project} />}

        {activeTab === 'analytics' && <ProjectAnalytics project={project} />}

        {activeTab === 'settings' && <ProjectSettings project={project} />}
      </div>

      {/* Create Task Modal */}
      {isCreateTaskOpen && (
        <CreateTaskDialog
          project={project}
          onClose={() => setIsCreateTaskOpen(false)}
        />
      )}
    </div>
  );
}
