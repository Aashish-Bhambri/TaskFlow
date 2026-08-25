import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentWorkspace, addWorkspace } from '../features/workspaceSlice';
import { ChevronDown, Check, Plus, Building, Layers } from 'lucide-react';

export default function WorkspaceDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const dropdownRef = useRef(null);

  const dispatch = useDispatch();
  const { workspaces, currentWorkspace } = useSelector((state) => state.workspace);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsCreateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id) => {
    dispatch(setCurrentWorkspace(id));
    setIsOpen(false);
  };

  const handleCreateWorkspace = (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    const newWs = {
      id: `ws_${Date.now()}`,
      name: newWsName.trim(),
      slug: newWsName.toLowerCase().replace(/\s+/g, '-'),
      description: 'Workspace created by team lead.',
      ownerId: 'user_1',
      image_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: currentWorkspace?.members || [],
      projects: [],
    };

    dispatch(addWorkspace(newWs));
    setNewWsName('');
    setIsCreateOpen(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Workspace Selector Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 transition group cursor-pointer"
      >
        <div className="flex items-center space-x-3 overflow-hidden text-left">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-zinc-100 flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-700/60 shadow-xs overflow-hidden">
            {currentWorkspace?.image_url ? (
              <img
                src={currentWorkspace.image_url}
                alt={currentWorkspace.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building className="w-4 h-4" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {currentWorkspace?.name || 'Select Workspace'}
            </h4>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
              {workspaces.length} workspace{workspaces.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Workspaces
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 custom-scroll">
            {workspaces.map((ws) => {
              const isCurrent = ws.id === currentWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      {ws.name.charAt(0)}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
            {!isCreateOpen ? (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 rounded-lg transition font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="p-1 space-y-2">
                <input
                  type="text"
                  placeholder="Workspace name..."
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center space-x-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
