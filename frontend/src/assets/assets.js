// TaskFlow Real Data & Theme Styles
export const mockUsers = [];
export const mockWorkspaces = [];
export const mockAgentEvents = [];

export const currentUser = {
  id: "user_current",
  name: "Aashish Bhambri",
  email: "aashish@taskflow.local",
  image: "https://api.dicebear.com/7.x/bottts/svg?seed=Aashish",
  role: "ADMIN"
};

// Project Status Styles
export const projectStatusStyles = {
  PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
  ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
  ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
  COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
  CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
};

// Task Priority Styles
export const taskPriorityStyles = {
  LOW: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30",
};

// Task Status Styles (Full State Machine)
export const taskStatusStyles = {
  BACKLOG: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60",
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30",
  REVIEW: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30",
  BLOCKED: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30",
};
