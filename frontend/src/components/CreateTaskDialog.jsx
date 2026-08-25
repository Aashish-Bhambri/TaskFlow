import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { addTask, createTaskAsync } from '../features/workspaceSlice';
import { useAppUser } from './ClerkAuthAdapter';

export default function CreateTaskDialog({ project, onClose }) {
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

  const projects = currentWorkspace?.projects || [];
  const targetProjectId = project?.id || projects[0]?.id;

  const [formData, setFormData] = useState({
    projectId: targetProjectId,
    title: '',
    description: '',
    type: 'FEATURE',
    priority: 'MEDIUM',
    status: 'TODO',
    assigneeId: availableMembers[0]?.id || fallbackUser.id,
    dependencies: [],
    due_date: new Date().toISOString().split('T')[0],
  });

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const existingProjectTasks = (projects.find(p => p.id === formData.projectId) || project)?.tasks || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDependencyToggle = (depId) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.includes(depId)
        ? prev.dependencies.filter(id => id !== depId)
        : [...prev.dependencies, depId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    const assignee = availableMembers.find((u) => u.id === formData.assigneeId) || fallbackUser;

    const newTask = {
      id: `task_${Date.now()}`,
      projectId: formData.projectId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.dependencies.length > 0 && formData.status === 'TODO' ? 'BLOCKED' : formData.status,
      type: formData.type,
      priority: formData.priority,
      assigneeId: assignee.id,
      assignee,
      dependencies: formData.dependencies,
      dueDate: formData.due_date,
      due_date: formData.due_date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };

    try {
      await dispatch(createTaskAsync(newTask)).unwrap();
      dispatch(addTask(newTask));
    } catch {
      dispatch(addTask(newTask));
    }

    toast.success(`Task "${newTask.title}" created!`);
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
        className="bg-white dark:bg-[#12141e] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create New Task</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Project Selector (if multiple projects exist) */}
          {!project && projects.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Project *
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              name="title"
              placeholder="e.g. Implement Webhook Dispatcher"
              value={formData.title}
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
              placeholder="Task details and acceptance criteria..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Issue Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                <option value="FEATURE">Feature</option>
                <option value="BUG">Bug</option>
                <option value="TASK">Task</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="OTHER">Other</option>
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

          {/* Status & Due Date Row */}
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
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Assignee
            </label>
            <select
              name="assigneeId"
              value={formData.assigneeId}
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
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
