import React, { useState } from 'react';
import { Bot, Terminal, Cpu, CheckCircle2, GitBranch, ArrowUpRight, Copy, Check } from 'lucide-react';
import { mockAgentEvents } from '../assets/assets';

export default function AgentStream() {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const handleCopyEndpoint = () => {
    navigator.clipboard?.writeText('http://localhost:3000/sse');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEvents = filter === 'ALL' 
    ? mockAgentEvents 
    : mockAgentEvents.filter(e => e.agent.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 shadow-xs">
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                MCP Agent Telemetry
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Active • stdio/SSE
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live Model Context Protocol tool execution & DAG mutations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyEndpoint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 rounded-lg transition border border-zinc-200/60 dark:border-zinc-700/60"
            title="Copy MCP SSE Transport Endpoint"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px]">/sse</span>
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 mt-3 space-y-0.5">
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-3 group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 rounded-xl px-2 -mx-2 transition"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 shrink-0 mt-0.5 border border-zinc-200/60 dark:border-zinc-700/40">
                <Bot className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                    {evt.agent}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                    {evt.tool}()
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    via {evt.client}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 font-mono leading-relaxed truncate">
                  {evt.action}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                {evt.timestamp}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Success" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
