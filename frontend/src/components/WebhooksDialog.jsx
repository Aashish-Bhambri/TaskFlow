import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Webhook,
  Plus,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Github,
  MessageSquare,
  Radio,
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export function WebhooksDialog({ isOpen, onClose }) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('webhooks'); // 'webhooks' | 'github' | 'chaining'
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState(['*']);
  const [secret, setSecret] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const availableEvents = [
    { id: '*', label: 'All Events (*)' },
    { id: 'TASK_CREATED', label: 'Task Created' },
    { id: 'TASK_STATUS_UPDATED', label: 'Status Changed' },
    { id: 'TASK_UNBLOCKED', label: 'Prerequisite Unblocked' },
    { id: 'COMMENT_ADDED', label: 'Comment Added' },
    { id: 'EPIC_DECOMPOSED', label: 'Auto-Epic Decomposed' }
  ];

  const fetchWebhooks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/webhooks', {
        headers: {
          'x-user-email': user.primaryEmailAddress?.emailAddress || '',
          'x-user-name': user.fullName || user.username || 'User',
          'x-user-id': user.id
        }
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWebhooks();
    }
  }, [isOpen, user]);

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!url.trim()) return toast.error('Webhook URL is required');

    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.primaryEmailAddress?.emailAddress || '',
          'x-user-name': user?.fullName || 'User',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ url, events, secret })
      });

      if (res.ok) {
        toast.success('Webhook registered successfully!');
        setUrl('');
        setSecret('');
        fetchWebhooks();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create webhook');
      }
    } catch (err) {
      toast.error('Network error creating webhook');
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': user?.primaryEmailAddress?.emailAddress || '',
          'x-user-id': user?.id || ''
        }
      });
      if (res.ok) {
        toast.success('Webhook removed');
        setWebhooks(prev => prev.filter(w => w.id !== id));
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const githubActionYaml = `name: TaskFlow CI/CD Bot

on:
  push:
    branches: [ main, master ]
  pull_request:
    types: [ opened, closed ]

jobs:
  taskflow-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch Git Event to TaskFlow
        run: |
          curl -X POST "${window.location.origin}/api/v1/integrations/github/webhook" \\
            -H "Content-Type: application/json" \\
            -H "X-GitHub-Event: \${{ github.event_name }}" \\
            -d '\${{ toJson(github.event) }}'
`;

  const mcpChainingJson = JSON.stringify({
    mcpServers: {
      taskflow: {
        serverUrl: `${window.location.origin}/mcp/sse?apiKey=tf_live_YOUR_API_KEY`
      },
      github: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
      },
      slack: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-slack"],
        env: { "SLACK_BOT_TOKEN": "xoxb-...", "SLACK_TEAM_ID": "T..." }
      }
    }
  }, null, 2);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Integrations & Autonomous CI/CD
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect Slack, Discord, GitHub Actions, and chain multiple MCP servers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'webhooks'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> Outbound Webhooks ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'github'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> GitHub Actions CI/CD
          </button>
          <button
            onClick={() => setActiveTab('chaining')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'chaining'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Multi-MCP Chaining
          </button>
        </div>

        {/* TAB 1: Outbound Webhooks */}
        {activeTab === 'webhooks' && (
          <div className="space-y-5">
            {/* Create Webhook Form */}
            <form onSubmit={handleCreateWebhook} className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3.5">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-violet-500" /> Add Webhook Destination (Slack / Discord / Custom)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Endpoint URL</label>
                  <input
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">HMAC Secret (Optional)</label>
                  <input
                    type="text"
                    placeholder="whsec_..."
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Event checkboxes */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Subscribed Events</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {availableEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => {
                        if (evt.id === '*') {
                          setEvents(['*']);
                        } else {
                          const withoutStar = events.filter(e => e !== '*');
                          if (withoutStar.includes(evt.id)) {
                            const next = withoutStar.filter(e => e !== evt.id);
                            setEvents(next.length === 0 ? ['*'] : next);
                          } else {
                            setEvents([...withoutStar, evt.id]);
                          }
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                        events.includes(evt.id)
                          ? 'bg-violet-500/20 text-violet-600 dark:text-violet-300 border border-violet-500/30'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-transparent'
                      }`}
                    >
                      {evt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Webhook
              </button>
            </form>

            {/* List of active webhooks */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active Webhook Subscriptions</h4>
              {loading ? (
                <div className="text-xs text-zinc-500 py-4 text-center flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading webhooks...
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-xs text-zinc-500 py-4 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800">
                  No active webhooks configured. Add your Slack, Discord or Custom URL above!
                </div>
              ) : (
                webhooks.map((wh) => (
                  <div key={wh.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="space-y-1 overflow-hidden pr-2">
                      <div className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {wh.url}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                          ● Active
                        </span>
                        <span>Events: {wh.events?.join(', ') || '*'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GitHub Actions CI/CD */}
        {activeTab === 'github' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Autonomous Ticket Lifecycle Sync
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                Whenever an engineer or AI agent creates a PR with <code className="bg-white dark:bg-black/40 px-1 py-0.5 rounded text-violet-600 dark:text-violet-300 font-mono">Fixes #TF-123</code> or merges code into main, TaskFlow automatically moves tickets to <strong>REVIEW</strong> or <strong>DONE</strong> and unblocks dependent DAG tasks!
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Add <code className="font-mono text-violet-500">.github/workflows/taskflow-sync.yml</code> to your repository:
                </label>
                <button
                  onClick={() => copyToClipboard(githubActionYaml, 'gh')}
                  className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'gh' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'gh' ? 'Copied' : 'Copy YAML'}
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-zinc-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-zinc-800 leading-relaxed custom-scroll">
                {githubActionYaml}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: Multi-MCP Chaining */}
        {activeTab === 'chaining' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Multi-MCP Server Synergy
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                Antigravity and Claude Desktop allow connecting multiple MCP servers simultaneously. When you combine <strong>TaskFlow</strong> with <strong>GitHub MCP</strong> and <strong>Slack MCP</strong>, your AI agent can read tickets, write code, submit PRs, and ping the team in Slack in one unified workflow!
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Example <code className="font-mono text-violet-500">mcp_config.json</code> Multi-Server Config:
                </label>
                <button
                  onClick={() => copyToClipboard(mcpChainingJson, 'chain')}
                  className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'chain' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'chain' ? 'Copied' : 'Copy Config'}
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-zinc-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-zinc-800 leading-relaxed custom-scroll">
                {mcpChainingJson}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
