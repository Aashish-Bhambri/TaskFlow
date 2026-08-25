import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  Users,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import WorkspaceDropdown from './WorkspaceDropdown';
import MyTasksSidebar from './MyTasksSidebar';
import ProjectsSidebar from './ProjectsSidebar';

export default function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  onOpenCreateProject,
}) {
  const sidebarRef = useRef(null);

  // Close mobile drawer on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isMobileOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        setIsMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileOpen, setIsMobileOpen]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderGit2 },
    { name: 'Team', path: '/team', icon: Users },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity" />
      )}

      {/* Sidebar Container */}
      <aside
        ref={sidebarRef}
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-[#10121a] border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header & Logo */}
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center border border-zinc-800 dark:border-zinc-200 shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white flex items-center gap-1">
                  TaskFlow
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-mono font-normal">
                    v2.0
                  </span>
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="p-3">
            <WorkspaceDropdown />
          </div>

          {/* Main Navigation Links */}
          <div className="flex-1 overflow-y-auto px-3 space-y-4 custom-scroll">
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Main
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 font-semibold'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* My Tasks Section */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
              <MyTasksSidebar />
            </div>

            {/* Projects Section */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
              <ProjectsSidebar onOpenCreateProject={onOpenCreateProject} />
            </div>
          </div>

          {/* Sidebar Footer Badge */}
          <div className="p-3 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 font-mono">
                  MCP Protocol v2
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
