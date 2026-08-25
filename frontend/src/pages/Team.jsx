import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  FolderGit2,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import InviteMemberDialog from '../components/InviteMemberDialog';

export default function Team() {
  const { currentWorkspace } = useSelector((state) => state.workspace);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const members = currentWorkspace?.members || [];
  const projects = currentWorkspace?.projects || [];

  // Metrics
  const totalMembers = members.length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  let totalTasks = 0;
  projects.forEach((p) => {
    totalTasks += p.tasks?.length || 0;
  });

  // Filter members
  const filteredMembers = members.filter((m) => {
    const name = (m.user?.name || m.name || '').toLowerCase();
    const email = (m.user?.email || m.email || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Workspace Team & Members
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage engineers, project leads, and role access in{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {currentWorkspace?.name}
            </span>
          </p>
        </div>

        <button
          onClick={() => setIsInviteOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              Total Members
            </span>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{totalMembers}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              Active Projects
            </span>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{activeProjects}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              Total Managed Tasks
            </span>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{totalTasks}</p>
          </div>
        </div>
      </div>

      {/* Member List Toolbar */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search member by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            No team members matched your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-800/60 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Member</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Workspace Role</th>
                  <th className="p-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredMembers.map((m) => {
                  const userObj = m.user || m;
                  const isAdmin = m.role === 'ADMIN';

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <img
                            src={userObj.image}
                            alt={userObj.name}
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                          />
                          <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {userObj.name}
                            </h4>
                            <span className="text-[10px] text-zinc-400">ID: {userObj.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{userObj.email}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {isAdmin ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                            <Shield className="w-3 h-3" />
                            <span>ADMIN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                            MEMBER
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && <InviteMemberDialog onClose={() => setIsInviteOpen(false)} />}
    </div>
  );
}
