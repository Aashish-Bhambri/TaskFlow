import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Search,
  Filter,
  Trash2,
  Plus,
  Bug,
  Zap,
  Square,
  GitCommit,
  MessageSquare,
  Calendar,
  RotateCcw,
  AlertOctagon,
} from 'lucide-react';
import {
  updateTask,
  deleteTask,
  updateTaskStatusAsync,
  batchDeleteTasksAsync,
} from '../features/workspaceSlice';
import { taskPriorityStyles, taskStatusStyles } from '../assets/assets';

export default function ProjectTasks({ project, onOpenCreateTask }) {
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const tasks = project?.tasks || [];

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || task.type === typeFilter;
    const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
    const matchesAssignee =
      assigneeFilter === 'ALL' ||
      task.assigneeId === assigneeFilter ||
      task.assignee?.id === assigneeFilter;

    return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesAssignee;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedTaskIds.length === 0) return;

    try {
      await dispatch(batchDeleteTasksAsync(selectedTaskIds)).unwrap();
      dispatch(deleteTask(selectedTaskIds));
      toast.success(`Deleted ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
    } catch {
      // Local fallback
      dispatch(deleteTask(selectedTaskIds));
      toast.success(`Deleted ${selectedTaskIds.length} task(s)`);
    }
    setSelectedTaskIds([]);
  };

  const handleStatusChange = async (task, newStatus) => {
    const originalStatus = task.status;

    try {
      const result = await dispatch(
        updateTaskStatusAsync({ id: task.id, newStatus })
      ).unwrap();

      dispatch(updateTask({ ...task, status: newStatus }));
      toast.success(`Task status updated to "${newStatus.replace('_', ' ')}"`);
    } catch (err) {
      const errorMsg = typeof err === 'object' ? err.message : String(err);

      if (err?.isBlockerError || errorMsg?.includes('BLOCKED')) {
        toast.error(`🚫 Blocker Alert: ${errorMsg}`, { duration: 5000 });
      } else {
        toast.error(`Transition Error: ${errorMsg || 'Unable to update status'}`);
      }

      // Revert state
      dispatch(updateTask({ ...task, status: originalStatus }));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPriorityFilter('ALL');
    setAssigneeFilter('ALL');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'BUG':
        return <Bug className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      case 'FEATURE':
        return <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'TASK':
        return <Square className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
      case 'IMPROVEMENT':
        return <GitCommit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'OTHER':
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    }
  };

  const today = startOfDay(new Date());

  return (
    <div className="space-y-4">
      {/* Control Bar: Filters & Actions */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {selectedTaskIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-800/40 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedTaskIds.length})</span>
              </button>
            )}

            <button
              onClick={onOpenCreateTask}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
          <div className="flex items-center space-x-1.5 text-zinc-400 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="FEATURE">Feature</option>
            <option value="IMPROVEMENT">Improvement</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            {project?.members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.user?.name}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="flex items-center space-x-1 px-2 py-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition cursor-pointer ml-auto"
            title="Reset All Filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Task List / Table */}
      <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-zinc-400 italic">No tasks match your filter criteria.</p>
            <button
              onClick={onOpenCreateTask}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              + Create a new task
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-800/60 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="pill-checkbox"
                      checked={
                        selectedTaskIds.length > 0 &&
                        selectedTaskIds.length === filteredTasks.length
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-3 w-14">Type</th>
                  <th className="p-3">Title</th>
                  <th className="p-3 w-32">Status</th>
                  <th className="p-3 w-28">Priority</th>
                  <th className="p-3 w-36">Assignee</th>
                  <th className="p-3 w-28">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredTasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  const isOverdue =
                    task.due_date &&
                    task.status !== 'DONE' &&
                    isBefore(startOfDay(parseISO(task.due_date)), today);

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="pill-checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectTask(task.id)}
                        />
                      </td>

                      {/* Type Icon */}
                      <td className="p-3">
                        <div
                          className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 inline-flex"
                          title={`Type: ${task.type}`}
                        >
                          {getTypeIcon(task.type)}
                        </div>
                      </td>

                      {/* Title */}
                      <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          to={`/taskDetails?id=${task.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                          {task.title}
                        </Link>
                      </td>

                      {/* Status Dropdown with DAG State Machine */}
                      <td className="p-3">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg uppercase tracking-wider border focus:outline-none cursor-pointer ${
                            taskStatusStyles[task.status] || ''
                          }`}
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="DONE">Done</option>
                        </select>
                      </td>

                      {/* Priority */}
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            taskPriorityStyles[task.priority] || ''
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="p-3">
                        {task.assignee ? (
                          <div className="flex items-center space-x-2">
                            <img
                              src={task.assignee.image}
                              alt={task.assignee.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="truncate text-zinc-700 dark:text-zinc-300">
                              {task.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="p-3 font-mono text-[11px]">
                        {task.due_date ? (
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }
                          >
                            <Calendar className="w-3 h-3 shrink-0" />
                            {format(parseISO(task.due_date), 'MMM d')}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
