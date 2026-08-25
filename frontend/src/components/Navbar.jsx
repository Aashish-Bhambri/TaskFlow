import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleTheme } from '../features/themeSlice';
import {
  PanelLeft,
  Search,
  Sun,
  Moon,
  Command,
  Key,
} from 'lucide-react';
import {
  Show,
  AppSignInButton,
  AppSignUpButton,
  AppUserButton,
} from './ClerkAuthAdapter';
import DeveloperApiKeysDialog from './DeveloperApiKeysDialog';

export default function Navbar({ onToggleMobileSidebar, onSearchQuery }) {
  const [query, setQuery] = useState('');
  const [isKeysOpen, setIsKeysOpen] = useState(false);
  const searchInputRef = useRef(null);
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (e) => {
    setQuery(e.target.value);
    if (onSearchQuery) {
      onSearchQuery(e.target.value);
    }
  };

  return (
    <>
      <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-[#10121a]/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Left: Mobile Toggle & Global Search */}
        <div className="flex items-center space-x-3 flex-1 max-w-md">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Toggle Navigation"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Global Search Bar */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search projects, tasks, or members..."
              value={query}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-12 py-1.5 text-xs bg-zinc-100/70 hover:bg-zinc-100 focus:bg-white dark:bg-zinc-800/50 dark:hover:bg-zinc-800/80 dark:focus:bg-zinc-900 border border-zinc-200/70 focus:border-indigo-500 dark:border-zinc-700/60 dark:focus:border-indigo-500 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/60 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 pointer-events-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Right: Connect AI, Theme Toggle & Clerk Authentication */}
        <div className="flex items-center space-x-2.5 ml-4">
          {/* Connect AI / API Keys Button */}
          <Show when="signed-in">
            <button
              onClick={() => setIsKeysOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200/80 dark:border-indigo-800/60 transition cursor-pointer shadow-xs"
              title="Generate MCP Key for Antigravity / Claude"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect AI</span>
            </button>
          </Show>

          {/* Theme Switcher Button */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Clerk Auth Integration */}
          <Show when="signed-out">
            <div className="flex items-center space-x-2">
              <AppSignInButton mode="modal">Sign In</AppSignInButton>
              <AppSignUpButton mode="modal">Sign Up</AppSignUpButton>
            </div>
          </Show>

          <Show when="signed-in">
            <AppUserButton />
          </Show>
        </div>
      </header>

      {/* Developer API Keys Modal */}
      {isKeysOpen && <DeveloperApiKeysDialog onClose={() => setIsKeysOpen(false)} />}
    </>
  );
}
