import React, { useState } from 'react';
import { X, Key, Copy, Check, Sparkles, Terminal, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppUser } from './ClerkAuthAdapter';

export default function DeveloperApiKeysDialog({ onClose }) {
  const { user } = useAppUser();
  const [apiKey, setApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://api.taskflow.com';
  const sseUrl = `${domain}/mcp/sse`;

  const generateKey = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/v1/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.primaryEmailAddress?.emailAddress || user?.email || '',
          'x-user-name': user?.fullName || user?.name || '',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ name: `${user?.fullName || 'User'} AI Client Key` })
      });

      const data = await res.json();
      if (data.apiKey) {
        setApiKey(data.apiKey);
        toast.success('Live API Key generated securely!');
      } else {
        toast.error('Failed to generate key: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      toast.error('Connection error: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success('API Key copied to clipboard!');
    } else {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
      toast.success('mcp_config.json snippet copied!');
    }
  };

  const activeKey = apiKey || 'tf_live_YOUR_GENERATED_API_KEY_HERE';

  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        taskflow: {
          serverUrl: `${sseUrl}?apiKey=${activeKey}`
        }
      }
    },
    null,
    2
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Developer API Keys & AI Integration
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect Antigravity, Claude Desktop, or Cursor to your workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live SSE Endpoint Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Live Remote SSE Endpoint
          </span>
          <div className="flex items-center justify-between font-mono text-xs text-indigo-600 dark:text-indigo-400 break-all">
            <span>{sseUrl}</span>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800/40 ml-2">
              HTTPS / 24/7 Active
            </span>
          </div>
        </div>

        {/* API Key Generation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Your API Secret Key
            </label>
            <button
              onClick={generateKey}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating...' : 'Generate New Key'}</span>
            </button>
          </div>

          {apiKey ? (
            <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <input
                type="text"
                readOnly
                value={apiKey}
                className="flex-1 bg-transparent font-mono text-xs text-amber-800 dark:text-amber-300 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(apiKey, 'key')}
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 shadow-xs cursor-pointer"
                title="Copy API Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic">
              Click &quot;Generate New Key&quot; to produce a secure SHA-256 bearer key for your AI agents.
            </p>
          )}
        </div>

        {/* Ready-to-use mcp_config.json */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <span>Paste into mcp_config.json</span>
            </div>
            <button
              onClick={() => copyToClipboard(mcpConfigSnippet, 'config')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedConfig ? 'Copied!' : 'Copy Config'}</span>
            </button>
          </div>

          <pre className="p-3.5 rounded-xl bg-zinc-900 text-zinc-200 font-mono text-[11px] overflow-x-auto custom-scroll border border-zinc-800 leading-relaxed">
            {mcpConfigSnippet}
          </pre>
        </div>

        {/* Security Note */}
        <div className="flex items-center space-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Zero-Knowledge Hash: We never store your raw key in plain text.</span>
        </div>
      </div>
    </div>
  );
}
