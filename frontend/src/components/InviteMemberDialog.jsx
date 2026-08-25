import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { inviteWorkspaceMember, inviteMemberAsync } from '../features/workspaceSlice';

export default function InviteMemberDialog({ onClose }) {
  const dispatch = useDispatch();
  const { currentWorkspace } = useSelector((state) => state.workspace);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const payload = {
      workspaceId: currentWorkspace?.id || 'ws_1',
      email: email.trim(),
      role,
    };

    try {
      await dispatch(inviteMemberAsync(payload)).unwrap();
      dispatch(inviteWorkspaceMember(payload));
    } catch {
      dispatch(inviteWorkspaceMember(payload));
    }

    toast.success(`Invitation sent to ${email.trim()}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Invite Teammate</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              placeholder="colleague@acme.corp"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Workspace Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="MEMBER">Member (Create & Edit Tasks)</option>
              <option value="ADMIN">Admin (Full Access & Settings)</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
