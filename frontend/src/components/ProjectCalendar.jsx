import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  addMonths,
  subMonths,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { taskPriorityStyles, taskStatusStyles } from '../assets/assets';

export default function ProjectCalendar({ project }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const tasks = project?.tasks || [];
  const today = startOfDay(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Navigation handlers
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Get tasks for a given date
  const getTasksForDate = (date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  // Selected Day Tasks
  const selectedDayTasks = getTasksForDate(selectedDay);

  // Overdue and Upcoming tasks
  const overdueTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === 'DONE') return false;
    const dueDate = startOfDay(parseISO(t.due_date));
    return isBefore(dueDate, today);
  });

  const upcomingTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === 'DONE') return false;
    const dueDate = startOfDay(parseISO(t.due_date));
    return !isBefore(dueDate, today);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Calendar Grid View */}
      <div className="lg:col-span-2 bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Month Header & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(`http://localhost:3000/calendar/${project?.id || 'all'}.ics`);
                toast.success('RFC 5545 iCalendar (.ics) subscription URL copied!');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition"
              title="Copy RFC 5545 iCalendar Subscription URL"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .ics</span>
            </button>

            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-zinc-400 uppercase py-1 border-b border-zinc-100 dark:border-zinc-800/60">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Grid Tiles */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysInMonth.map((day) => {
            const dayTasks = getTasksForDate(day);
            const isSelected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, today);
            const hasOverdue = dayTasks.some(
              (t) => t.status !== 'DONE' && isBefore(startOfDay(day), today)
            );

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[70px] p-2 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                    : hasOverdue
                    ? 'border-rose-400/80 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-zinc-200/70 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center'
                        : isSelected
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayTasks.length > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        hasOverdue
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}
                    >
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Mini Dots for Tasks */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        task.status === 'DONE'
                          ? 'bg-emerald-500'
                          : task.priority === 'HIGH'
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                      }`}
                      title={task.title}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] text-zinc-400 font-mono">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Task Drawer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-2">
            Tasks Due on {format(selectedDay, 'MMMM d, yyyy')}:
          </h4>
          {selectedDayTasks.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No tasks scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayTasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/taskDetails?id=${task.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 transition group"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        task.status === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                      {task.title}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      taskPriorityStyles[task.priority] || ''
                    }`}
                  >
                    {task.priority}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Sidebar: Overdue & Upcoming */}
      <div className="space-y-4">
        {/* Overdue Section */}
        <div className="bg-white dark:bg-[#12141e] border border-rose-200/80 dark:border-rose-900/40 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 pb-2.5 border-b border-rose-100 dark:border-rose-950/60 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300">
              Overdue Tasks ({overdueTasks.length})
            </h4>
          </div>

          {overdueTasks.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">No overdue tasks.</p>
          ) : (
            <div className="space-y-2">
              {overdueTasks.slice(0, 4).map((task) => (
                <Link
                  key={task.id}
                  to={`/taskDetails?id=${task.id}`}
                  className="block p-2.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 hover:border-rose-400 transition"
                >
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {task.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                    <span>Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                    <span>{task.priority}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Section */}
        <div className="bg-white dark:bg-[#12141e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/60 mb-3">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
              Upcoming Deadlines ({upcomingTasks.length})
            </h4>
          </div>

          {upcomingTasks.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2">No upcoming deadlines.</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.slice(0, 4).map((task) => (
                <Link
                  key={task.id}
                  to={`/taskDetails?id=${task.id}`}
                  className="block p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 hover:border-indigo-500/50 transition"
                >
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {task.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {task.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
