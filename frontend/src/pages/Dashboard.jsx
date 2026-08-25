import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useAppUser } from '../components/ClerkAuthAdapter';
import StatsGrid from '../components/StatsGrid';
import ProjectOverview from '../components/ProjectOverview';
import RecentActivity from '../components/RecentActivity';
import TasksSummary from '../components/TasksSummary';
import CreateProjectDialog from '../components/CreateProjectDialog';
import AgentStream from '../components/AgentStream';

export default function Dashboard() {
  const { user } = useAppUser();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const userName = user?.fullName || user?.firstName || 'Alex Johnson';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Greeting & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Welcome back, {userName}
            </h1>
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Here is your daily engineering sprint briefing and workflow progress.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <StatsGrid />

      {/* 2-Column Overview & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProjectOverview />
          <AgentStream />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>

      {/* Stacked Summaries */}
      <div>
        <TasksSummary />
      </div>

      {/* Create Project Modal */}
      {isCreateOpen && <CreateProjectDialog onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
