import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { loadTheme } from '../features/themeSlice';
import { fetchWorkspacesAsync, clearWorkspaces } from '../features/workspaceSlice';
import { api } from '../services/api';
import { useAppUser, AppSignInButton, AppSignUpButton } from '../components/ClerkAuthAdapter';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import CreateProjectDialog from '../components/CreateProjectDialog';
import { Shield, Sparkles, FolderGit2, CheckCircle2, Lock } from 'lucide-react';

export default function Layout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const dispatch = useDispatch();
  const { isLoaded, isSignedIn, user } = useAppUser();

  useEffect(() => {
    dispatch(loadTheme());

    if (isSignedIn && user) {
      api.setAuthUser(user);
      dispatch(fetchWorkspacesAsync());
    } else if (isLoaded && !isSignedIn) {
      api.setAuthUser(null);
      dispatch(clearWorkspaces());
    }

    // Connect to Real-time SSE event stream if signed in
    let eventSource;
    if (isSignedIn && user) {
      try {
        eventSource = new EventSource(api.getEventsStreamUrl());

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            if (payload.type === 'TASK_BLOCKED') {
              toast.error(
                `⚠️ Blocker Alert: Task "${payload.data?.taskTitle || 'Task'}" blocked by [${(
                  payload.data?.blockerIds || []
                ).join(', ')}]`,
                { duration: 5000 }
              );
              dispatch(fetchWorkspacesAsync());
            } else if (payload.type === 'TASK_ASSIGNED') {
              toast(
                `📌 Task Assigned: "${payload.data?.taskTitle || 'Task'}" assigned to team member.`,
                { icon: '🔔' }
              );
              dispatch(fetchWorkspacesAsync());
            } else if (payload.type === 'TASK_CREATED' || payload.type === 'PROJECT_CREATED') {
              dispatch(fetchWorkspacesAsync());
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource?.close();
        };
      } catch {}
    }

    return () => {
      eventSource?.close();
    };
  }, [dispatch, isSignedIn, user, isLoaded]);

  // If signed out, display secure Auth Gate / Landing Page
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-[#0c0d12] dark:text-zinc-100 transition-colors">
        {/* Top Minimal Navbar with Sign In / Sign Up */}
        <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-6 flex items-center justify-between bg-white/80 dark:bg-[#12141e]/80 backdrop-blur">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              TF
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white">
              TaskFlow <span className="text-[10px] text-zinc-400 font-mono">v2.0</span>
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <AppSignInButton />
            <AppSignUpButton />
          </div>
        </header>

        {/* Hero Landing for Signed-Out Visitors */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10 mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Tenant Cloud Security</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Sign In to Your Workspace
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              Your projects, DAG workflow states, and team tasks are private and encrypted. Sign in or create an account to manage your engineering initiatives.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <AppSignUpButton>
              <span className="px-6 py-2.5 text-xs font-semibold flex items-center gap-2">
                <span>Create Free Workspace</span>
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </AppSignUpButton>
            <AppSignInButton>
              <span className="px-6 py-2.5 text-xs font-semibold">
                Sign In to Existing Account
              </span>
            </AppSignInButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-8 text-left">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
              <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                <Shield className="w-4 h-4" />
                <span>Zero-Leak Isolation</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Tasks and workspaces are strictly private to the signed-in account.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>DAG Engine</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Cycle-detected state machines with blocker dependency graphs.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                <FolderGit2 className="w-4 h-4" />
                <span>MCP Protocol v2</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Direct integration with Claude, Antigravity, and AI Agents.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#0c0d12] dark:text-zinc-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scroll">
          <Outlet context={{ onOpenCreateProject: () => setIsCreateProjectOpen(true) }} />
        </main>
      </div>

      {/* Global Project Creator Modal */}
      {isCreateProjectOpen && (
        <CreateProjectDialog onClose={() => setIsCreateProjectOpen(false)} />
      )}
    </div>
  );
}
