import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Settings, UserPlus, Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateProject, updateProjectAsync } from '../features/workspaceSlice';
import AddProjectMember from './AddProjectMember';

export default function ProjectSettings({ project }) {
  const dispatch = useDispatch();

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    status: project?.status || 'ACTIVE',
    priority: project?.priority || 'MEDIUM',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    progress: project?.progress || 0,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'progress' ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Project name is required.');
      return;
    }

    try {
      await dispatch(
        updateProjectAsync({
          id: project.id,
          data: formData,
        })
      ).unwrap();
      dispatch(updateProject({ ...project, ...formData }));
    } catch {
      dispatch(updateProject({ ...project, ...formData }));
    }

    toast.success('Project settings updated successfully!');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* General Settings Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs space-y-5"
      >
        <div className="flex items-center space-x-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Project Configuration
          </h3>
        </div>

        {/* Project Name */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Project Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Description
          </label>
          <textarea
            rows="3"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status & Priority Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
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
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Dates Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
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
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Interactive Progress Range Slider (0-100%) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Completion Progress
            </label>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {formData.progress}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            name="progress"
            value={formData.progress}
            onChange={handleChange}
            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>

      {/* Team Members Management */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Assigned Team Members</h3>
            <p className="text-xs text-zinc-500">Collaborators who have direct access to this project</p>
          </div>
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {(project?.members || []).map((member) => {
            const isLead =
              project.team_lead?.id === member.id ||
              project.team_lead?.id === member.userId;

            return (
              <div key={member.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={member.image || member.user?.image}
                    alt={member.name || member.user?.name}
                    className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {member.name || member.user?.name}
                    </h5>
                    <p className="text-[11px] text-zinc-400">
                      {member.email || member.user?.email}
                    </p>
                  </div>
                </div>

                {isLead ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                    <Shield className="w-3 h-3" />
                    <span>Team Lead</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                    Member
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isAddMemberOpen && (
        <AddProjectMember
          project={project}
          onClose={() => setIsAddMemberOpen(false)}
        />
      )}
    </div>
  );
}
