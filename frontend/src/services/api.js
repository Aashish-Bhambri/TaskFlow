const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

let currentAuthUser = null;

export function setAuthUser(user) {
  currentAuthUser = user;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const authHeaders = currentAuthUser
    ? {
        'x-user-id': currentAuthUser.id || '',
        'x-user-email': currentAuthUser.primaryEmailAddress?.emailAddress || currentAuthUser.email || '',
        'x-user-name': currentAuthUser.fullName || currentAuthUser.name || 'User',
      }
    : {};

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.isBlockerError = !!data.isBlockerError;
    throw error;
  }

  return data;
}

export const api = {
  setAuthUser,

  // Workspaces
  async getWorkspaces() {
    return request('/workspaces');
  },

  async createWorkspace(data) {
    return request('/workspaces', {
      method: 'POST',
      body: data,
    });
  },

  // Projects
  async getProjects(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/projects${query ? `?${query}` : ''}`);
  },

  async getProjectById(id) {
    return request(`/projects/${id}`);
  },

  async createProject(data) {
    return request('/projects', {
      method: 'POST',
      body: data,
    });
  },

  async updateProject(id, data) {
    return request(`/projects/${id}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async addProjectMember(projectId, userId) {
    return request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId },
    });
  },

  // Tasks
  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/tasks${query ? `?${query}` : ''}`);
  },

  async getTaskById(id) {
    return request(`/tasks/${id}`);
  },

  async createTask(data) {
    return request('/tasks', {
      method: 'POST',
      body: data,
    });
  },

  async updateTask(id, data) {
    return request(`/tasks/${id}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async updateTaskStatus(id, newStatus) {
    return request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: { newStatus },
    });
  },

  async batchDeleteTasks(taskIds) {
    return request('/tasks/batch-delete', {
      method: 'POST',
      body: { taskIds },
    });
  },

  // Comments
  async addComment(taskId, data) {
    return request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: data,
    });
  },

  // Calendar
  getCalendarFeedUrl(userId) {
    return `${API_BASE_URL}/calendar/${userId}/feed.ics`;
  },

  // Dashboard Stats
  async getDashboardStats(workspaceId, userId) {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (userId) params.append('userId', userId);
    return request(`/dashboard/stats?${params.toString()}`);
  },

  // Invites
  async inviteMember(workspaceId, data) {
    return request(`/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      body: data,
    });
  },

  // SSE Stream URL
  getEventsStreamUrl() {
    const email = currentAuthUser?.primaryEmailAddress?.emailAddress || currentAuthUser?.email || '';
    return `${API_BASE_URL}/events/stream?email=${encodeURIComponent(email)}`;
  },
};
