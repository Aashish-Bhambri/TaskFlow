import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, FolderPlus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { addProject, createProjectAsync } from '../features/workspaceSlice';
import { useAppUser } from './ClerkAuthAdapter';

export default function CreateProjectDialog({ onClose }) {
  const dispatch = useDispatch();
  const { user } = useAppUser();
  const { currentWorkspace } = useSelector((state) => state.workspace);

  const fallbackUser = {
    id: user?.id || 'admin_user',
    name: user?.fullName || 'Aashish Bhambri',
    email: user?.primaryEmailAddress?.emailAddress || 'aashish@taskflow.local'
  };

  const availableMembers = (currentWorkspace?.members && currentWorkspace.members.length > 0)
    ? currentWorkspace.members.map(m => m.user || m)
    : [fallbackUser];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PLANNING',
    priority: 'MEDIUM',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    teamLeadId: availableMembers[0]?.id || fallbackUser.id,
    selectedMemberIds: [availableMembers[0]?.id || fallbackUser.id],
  });

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMember = (userId) => {
    setFormData((prev) => {
      const exists = prev.selectedMemberIds.includes(userId);
      return {
        ...prev,
        selectedMemberIds: exists
          ? prev.selectedMemberIds.filter((id) => id !== userId)
          : [...prev.selectedMemberIds, userId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter a project name.');
      return;
    }

    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      toast.error('Target completion date cannot be earlier than start date.');
      return;
    }

    const teamLead = availableMembers.find((u) => u.id === formData.teamLeadId) || fallbackUser;
    const members = availableMembers.filter((u) => formData.selectedMemberIds.includes(u.id));

    const projectPayload = {
      id: `proj_${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      status: formData.status,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      team_lead: teamLead,
      teamLeadId: teamLead.id,
      memberIds: formData.selectedMemberIds,
      workspaceId: currentWorkspace?.id || 'ws_1',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: members.length > 0 ? members : [teamLead],
      tasks: [],
    };

    try {
      await dispatch(createProjectAsync(projectPayload)).unwrap();
      dispatch(addProject(projectPayload));
    } catch {
      dispatch(addProject(projectPayload));
    }

    toast.success(`Project "${projectPayload.name}" created!`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create New Project</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Protocol Gateway V2"
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Description
            </label>
            <textarea
              rows="2"
              name="description"
              placeholder="Brief summary of goals and deliverables..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Initial Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Target End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Team Lead Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Team Lead
            </label>
            <select
              name="teamLeadId"
              value={formData.teamLeadId}
              onChange={handleChange}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              {availableMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Team Members Tag Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Assign Collaborators
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scroll p-1 border border-zinc-200 dark:border-zinc-700/60 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/40">
              {availableMembers.map((u) => {
                const isSelected = formData.selectedMemberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleMember(u.id)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-zinc-200/70 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    <span>{u.name.split(' ')[0]}</span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
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
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
