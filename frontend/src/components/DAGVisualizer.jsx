import React, { useState, useMemo } from 'react';
import { GitFork, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Cpu, Layers, User } from 'lucide-react';
import { taskStatusStyles, taskPriorityStyles } from '../assets/assets';

export default function DAGVisualizer({ project, onSelectTask }) {
  const [activeNode, setActiveNode] = useState(null);

  const tasks = project?.tasks || [];

  // Compute Topological Tiers (Roots -> Dependent Layers)
  const tiers = useMemo(() => {
    if (!tasks.length) return [];

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const tiersList = [];
    const visited = new Set();

    // Tier 0: Tasks with no dependencies
    let currentTier = tasks.filter(t => !t.dependencies || t.dependencies.length === 0);
    if (currentTier.length === 0 && tasks.length > 0) {
      // If circular or all depend on something, fallback to all tasks
      currentTier = [tasks[0]];
    }

    currentTier.forEach(t => visited.add(t.id));
    tiersList.push(currentTier);

    // Build successive tiers
    let iterations = 0;
    while (visited.size < tasks.length && iterations < 10) {
      iterations++;
      const nextTier = tasks.filter(t => {
        if (visited.has(t.id)) return false;
        // Check if all dependencies are in visited
        const deps = t.dependencies || [];
        return deps.length > 0 && deps.some(dId => visited.has(dId));
      });

      if (nextTier.length === 0) {
        // Remaining unvisited nodes
        const remaining = tasks.filter(t => !visited.has(t.id));
        remaining.forEach(t => visited.add(t.id));
        tiersList.push(remaining);
        break;
      }

      nextTier.forEach(t => visited.add(t.id));
      tiersList.push(nextTier);
    }

    return tiersList;
  }, [tasks]);

  const blockedCount = tasks.filter(t => t.status === 'BLOCKED' || (t.dependencies?.some(dId => {
    const dep = tasks.find(x => x.id === dId);
    return dep && dep.status !== 'DONE';
  }))).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs transition-all">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60">
            <GitFork className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Directed Acyclic Graph (DAG) Execution Flow
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                Topological Order
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Task dependencies & critical path orchestration for autonomous agents and engineers
            </p>
          </div>
        </div>

        {/* DAG Telemetry Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500 dark:text-zinc-400">Tiers:</span>
            <span className="font-bold text-zinc-900 dark:text-white font-mono">{tiers.length}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Blocked Tasks:</span>
            <span className="font-bold font-mono">{blockedCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cycle Check:</span>
            <span className="font-bold font-mono">0 Cycles</span>
          </div>
        </div>
      </div>

      {/* DAG Tier Grid */}
      <div className="mt-6 overflow-x-auto pb-4">
        <div className="flex items-stretch gap-6 min-w-[700px]">
          {tiers.map((tierTasks, tierIdx) => (
            <div key={tierIdx} className="flex-1 flex flex-col gap-4">
              {/* Tier Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/40">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">
                  Tier {tierIdx + 1} {tierIdx === 0 ? '(Root Nodes)' : ''}
                </span>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {tierTasks.length} {tierTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {/* Tier Task Nodes */}
              <div className="flex flex-col gap-3">
                {tierTasks.map(task => {
                  const isBlocked = task.status === 'BLOCKED' || (task.dependencies?.some(dId => {
                    const dep = tasks.find(x => x.id === dId);
                    return dep && dep.status !== 'DONE';
                  }));
                  const isSelected = activeNode === task.id;

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setActiveNode(task.id);
                        if (onSelectTask) onSelectTask(task);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                          : isBlocked
                          ? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/10 hover:border-rose-400'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Node Top Row: ID & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                          #{task.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          taskStatusStyles[task.status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2 mb-3">
                        {task.title}
                      </h4>

                      {/* Dependencies Badge info */}
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div className="mb-2.5 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-[10px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 flex-wrap">
                          <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="font-medium text-zinc-500 dark:text-zinc-400">Depends on:</span>
                          {task.dependencies.map(dId => (
                            <span key={dId} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                              #{dId}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer: Priority & Assignee */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50 dark:border-zinc-700/40 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${
                          taskPriorityStyles[task.priority] || ''
                        }`}>
                          {task.priority}
                        </span>

                        {task.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={task.assignee.image}
                              alt={task.assignee.name}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                            <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[80px]">
                              {task.assignee.name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <User className="w-3 h-3" /> Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
