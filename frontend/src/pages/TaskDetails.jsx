import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Calendar,
  Layers,
  Bug,
  Zap,
  Square,
  GitCommit,
  Clock,
  Folder,
  GitFork,
} from 'lucide-react';
import { addComment, addCommentAsync, updateTask, updateTaskStatusAsync } from '../features/workspaceSlice';
import { currentUser, taskPriorityStyles, taskStatusStyles, projectStatusStyles } from '../assets/assets';

export default function TaskDetails() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('id');
  const dispatch = useDispatch();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentWorkspace } = useSelector((state) => state.workspace);
  const projects = currentWorkspace?.projects || [];

  // Find task and its parent project
  let task = null;
  let parentProject = null;

  for (const proj of projects) {
    if (proj.tasks) {
      const found = proj.tasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        parentProject = proj;
        break;
      }
    }
  }

  // Fallback to first available task if no ID provided
  if (!task && projects.length > 0) {
    for (const proj of projects) {
      if (proj.tasks && proj.tasks.length > 0) {
        task = proj.tasks[0];
        parentProject = proj;
        break;
      }
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (!task) return;
    const originalStatus = task.status;

    try {
      await dispatch(updateTaskStatusAsync({ id: task.id, newStatus })).unwrap();
      dispatch(updateTask({ ...task, status: newStatus }));
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      const errorMsg = typeof err === 'object' ? err.message : String(err);
      if (err?.isBlockerError || errorMsg?.includes('BLOCKED')) {
        toast.error(`🚫 Blocker Alert: ${errorMsg}`, { duration: 5000 });
      } else {
        toast.error(`Transition Error: ${errorMsg}`);
      }
      dispatch(updateTask({ ...task, status: originalStatus }));
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    const newComment = {
      id: `comm_${Date.now()}`,
      user: currentUser,
      content: commentText.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      await dispatch(
        addCommentAsync({
          taskId: task.id,
          content: commentText.trim(),
          userId: currentUser.id,
        })
      ).unwrap();
      dispatch(addComment({ taskId: task.id, comment: newComment }));
    } catch {
      dispatch(addComment({ taskId: task.id, comment: newComment }));
    }

    setCommentText('');
    setIsSubmitting(false);
    toast.success('Comment posted!');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'BUG':
        return <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'FEATURE':
        return <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'TASK':
        return <Square className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'IMPROVEMENT':
        return <GitCommit className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'OTHER':
      default:
        return <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  if (!task) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-sm text-zinc-400">Task not found.</p>
        <Link
          to="/projects"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  const formattedDueDate = task.due_date
    ? format(parseISO(task.due_date), 'MMMM d, yyyy')
    : 'No due date';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Back Action */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <Link
          to={`/projectsDetail?id=${parentProject?.id}&tab=tasks`}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {parentProject?.name || 'Project'} Tasks</span>
        </Link>

        {/* Status Quick Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-zinc-400 font-medium">Status:</span>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl uppercase tracking-wider border focus:outline-none cursor-pointer ${
              taskStatusStyles[task.status] || ''
            }`}
          >
            <option value="BACKLOG">Backlog</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">In Review</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      </div>

      {/* 2-Column Task View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Discussion Thread (2/3 width) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Task Header & Body */}
          <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0">
                {getTypeIcon(task.type)}
              </div>
              <div>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  {task.type} &bull; {task.id}
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                  {task.title}
                </h1>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Description
              </h4>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {task.description || 'No description provided for this task.'}
              </p>
            </div>
          </div>

          {/* Comments / Discussion Stream */}
          <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Discussion Stream
                </h3>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {task.comments?.length || 0} comment{task.comments?.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Comment Stream */}
            <div className="space-y-4 max-h-96 overflow-y-auto custom-scroll pr-1">
              {!task.comments || task.comments.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-6 text-center">
                  No comments yet. Start the conversation below!
                </p>
              ) : (
                task.comments.map((comment) => {
                  const isMe = comment.user?.id === currentUser.id;
                  const timeFormatted = comment.createdAt
                    ? format(parseISO(comment.createdAt), 'dd MMM yyyy, HH:mm')
                    : 'Just now';

                  return (
                    <div
                      key={comment.id}
                      className={`flex items-start gap-3 ${
                        isMe ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <img
                        src={comment.user?.image || currentUser.image}
                        alt={comment.user?.name || 'User'}
                        className="w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                      />

                      <div
                        className={`max-w-md rounded-2xl p-3.5 space-y-1 ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between gap-3 text-[10px] ${
                            isMe ? 'text-indigo-200' : 'text-zinc-400'
                          }`}
                        >
                          <span className="font-semibold">{comment.user?.name || 'User'}</span>
                          <span className="font-mono">{timeFormatted}</span>
                        </div>
                        <p className="text-xs leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2">
              <div className="relative">
                <textarea
                  rows="3"
                  placeholder="Write a comment or protocol update..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Posting...' : 'Comment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Meta Pane (1/3 width) */}
        <div className="space-y-5">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
              Task Details
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Priority</span>
                <span
                  className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                    taskPriorityStyles[task.priority] || ''
                  }`}
                >
                  {task.priority}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Status</span>
                <span
                  className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    taskStatusStyles[task.status] || ''
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Assignee</span>
                {task.assignee ? (
                  <div className="flex items-center space-x-2">
                    <img
                      src={task.assignee.image}
                      alt={task.assignee.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {task.assignee.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-400 italic">Unassigned</span>
                )}
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Due Date</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{formattedDueDate}</span>
                </span>
              </div>

              {/* Created Timestamp */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Created</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {task.createdAt ? format(parseISO(task.createdAt), 'MMM d, yyyy') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* DAG Dependency Relationships */}
          <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5 text-indigo-500" />
              <span>DAG Dependencies</span>
            </h3>

            {/* Upstream Dependencies */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                Upstream Blockers (Must finish first):
              </span>
              {(!task.dependencies || task.dependencies.length === 0) ? (
                <p className="text-[11px] text-zinc-400 italic">No upstream dependencies (Root Node).</p>
              ) : (
                <div className="space-y-1.5">
                  {task.dependencies.map((depId) => {
                    const depTask = parentProject?.tasks?.find((t) => t.id === depId);
                    return (
                      <Link
                        key={depId}
                        to={`/taskDetails?id=${depId}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 transition text-xs"
                      >
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[150px]">
                          #{depId} {depTask ? `• ${depTask.title}` : ''}
                        </span>
                        {depTask && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${taskStatusStyles[depTask.status] || ''}`}>
                            {depTask.status}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Parent Project Summary Card */}
          {parentProject && (
            <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-3.5">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                <span>Parent Initiative</span>
              </h3>

              <div className="space-y-2">
                <Link
                  to={`/projectsDetail?id=${parentProject.id}&tab=tasks`}
                  className="text-xs font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  {parentProject.name}
                </Link>

                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Status</span>
                  <span
                    className={`text-[9px] font-semibold px-2 py-0.2 rounded-full uppercase ${
                      projectStatusStyles[parentProject.status] || ''
                    }`}
                  >
                    {parentProject.status}
                  </span>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Overall Progress</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {parentProject.progress || 0}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${parentProject.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
