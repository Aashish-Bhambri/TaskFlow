import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, UserPlus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { addProjectMember, addProjectMemberAsync } from '../features/workspaceSlice';

export default function AddProjectMember({ project, onClose }) {
  const dispatch = useDispatch();
  const { currentWorkspace } = useSelector((state) => state.workspace);

  const existingMemberIds = (project?.members || []).map((m) => m.id || m.userId);

  // Available workspace members not in this project
  const availableMembers = (currentWorkspace?.members || []).filter(
    (m) => !existingMemberIds.includes(m.userId) && !existingMemberIds.includes(m.id)
  );

  const [selectedUserId, setSelectedUserId] = useState(
    availableMembers[0]?.userId || availableMembers[0]?.id || ''
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('No member selected.');
      return;
    }

    const memberObj = currentWorkspace?.members.find(
      (m) => m.userId === selectedUserId || m.id === selectedUserId
    );

    if (memberObj) {
      const member = memberObj.user || memberObj;
      try {
        await dispatch(
          addProjectMemberAsync({
            projectId: project.id,
            member,
          })
        ).unwrap();
        dispatch(addProjectMember({ projectId: project.id, member }));
      } catch {
        dispatch(addProjectMember({ projectId: project.id, member }));
      }

      toast.success('Member added to project successfully!');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Add Member to Project
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {availableMembers.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400 space-y-2">
            <p>All workspace members are already part of this project.</p>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Select Workspace Member
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {availableMembers.map((m) => (
                  <option key={m.userId || m.id} value={m.userId || m.id}>
                    {m.user?.name || m.name} ({m.user?.email || m.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-sm shadow-indigo-600/20"
              >
                Add Member
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
