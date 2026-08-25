import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../services/api';

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  isBackendConnected: false,
  isLoading: false,
  error: null,
};

// Async Thunks
export const fetchWorkspacesAsync = createAsyncThunk(
  'workspace/fetchWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.getWorkspaces();
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createProjectAsync = createAsyncThunk(
  'workspace/createProject',
  async (projectData, { rejectWithValue }) => {
    try {
      const created = await api.createProject(projectData);
      return created;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateProjectAsync = createAsyncThunk(
  'workspace/updateProject',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const updated = await api.updateProject(id, data);
      return updated;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createTaskAsync = createAsyncThunk(
  'workspace/createTask',
  async (taskData, { rejectWithValue }) => {
    try {
      const created = await api.createTask(taskData);
      return created;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateTaskStatusAsync = createAsyncThunk(
  'workspace/updateTaskStatus',
  async ({ id, newStatus }, { rejectWithValue }) => {
    try {
      const updated = await api.updateTaskStatus(id, newStatus);
      return updated;
    } catch (err) {
      return rejectWithValue({
        message: err.message,
        isBlockerError: err.isBlockerError,
      });
    }
  }
);

export const batchDeleteTasksAsync = createAsyncThunk(
  'workspace/batchDeleteTasks',
  async (taskIds, { rejectWithValue }) => {
    try {
      await api.batchDeleteTasks(taskIds);
      return taskIds;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addCommentAsync = createAsyncThunk(
  'workspace/addComment',
  async ({ taskId, content, userId }, { rejectWithValue }) => {
    try {
      const comment = await api.addComment(taskId, { content, userId });
      return { taskId, comment };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addProjectMemberAsync = createAsyncThunk(
  'workspace/addProjectMember',
  async ({ projectId, member }, { rejectWithValue }) => {
    try {
      await api.addProjectMember(projectId, member.id || member.userId);
      return { projectId, member };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const inviteMemberAsync = createAsyncThunk(
  'workspace/inviteMember',
  async ({ workspaceId, email, role }, { rejectWithValue }) => {
    try {
      const user = await api.inviteMember(workspaceId, { email, role });
      return { workspaceId, user, role };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    clearWorkspaces: (state) => {
      state.workspaces = [];
      state.currentWorkspace = null;
      state.isBackendConnected = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('taskflow_current_workspace_id');
        localStorage.removeItem('taskflow_current_workspace_data');
      }
    },
    setCurrentWorkspace: (state, action) => {
      const ws = state.workspaces.find((w) => w.id === action.payload);
      if (ws) {
        state.currentWorkspace = ws;
        if (typeof window !== 'undefined') {
          localStorage.setItem('taskflow_current_workspace_id', ws.id);
          localStorage.setItem('taskflow_current_workspace_data', JSON.stringify(ws));
        }
      }
    },
    addWorkspace: (state, action) => {
      state.workspaces.push(action.payload);
      state.currentWorkspace = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('taskflow_current_workspace_id', action.payload.id);
        localStorage.setItem('taskflow_current_workspace_data', JSON.stringify(action.payload));
      }
    },
    addProject: (state, action) => {
      const newProject = action.payload;
      const ws = state.workspaces.find((w) => w.id === newProject.workspaceId);
      if (ws) {
        ws.projects = [newProject, ...(ws.projects || [])];
      }
      if (state.currentWorkspace?.id === newProject.workspaceId) {
        state.currentWorkspace.projects = [newProject, ...(state.currentWorkspace.projects || [])];
      }
    },
    updateProject: (state, action) => {
      const updatedProject = action.payload;
      const ws = state.workspaces.find((w) => w.id === updatedProject.workspaceId);
      if (ws && ws.projects) {
        const idx = ws.projects.findIndex((p) => p.id === updatedProject.id);
        if (idx !== -1) {
          ws.projects[idx] = { ...ws.projects[idx], ...updatedProject };
        }
      }
      if (state.currentWorkspace?.id === updatedProject.workspaceId && state.currentWorkspace.projects) {
        const idx = state.currentWorkspace.projects.findIndex((p) => p.id === updatedProject.id);
        if (idx !== -1) {
          state.currentWorkspace.projects[idx] = { ...state.currentWorkspace.projects[idx], ...updatedProject };
        }
      }
    },
    addTask: (state, action) => {
      const newTask = action.payload;
      const ws = state.workspaces.find((w) => w.projects?.some((p) => p.id === newTask.projectId));
      if (ws) {
        const project = ws.projects.find((p) => p.id === newTask.projectId);
        if (project) {
          project.tasks = [newTask, ...(project.tasks || [])];
        }
      }
      if (state.currentWorkspace) {
        const project = state.currentWorkspace.projects?.find((p) => p.id === newTask.projectId);
        if (project) {
          project.tasks = [newTask, ...(project.tasks || [])];
        }
      }
    },
    updateTask: (state, action) => {
      const updatedTask = action.payload;
      const updateInProject = (projects) => {
        if (!projects) return;
        for (const proj of projects) {
          if (proj.tasks) {
            const taskIndex = proj.tasks.findIndex((t) => t.id === updatedTask.id);
            if (taskIndex !== -1) {
              proj.tasks[taskIndex] = {
                ...proj.tasks[taskIndex],
                ...updatedTask,
                updatedAt: new Date().toISOString(),
              };
              return;
            }
          }
        }
      };

      state.workspaces.forEach((ws) => updateInProject(ws.projects));
      if (state.currentWorkspace) {
        updateInProject(state.currentWorkspace.projects);
      }
    },
    deleteTask: (state, action) => {
      const taskIdsToDelete = Array.isArray(action.payload) ? action.payload : [action.payload];
      const deleteInProject = (projects) => {
        if (!projects) return;
        for (const proj of projects) {
          if (proj.tasks) {
            proj.tasks = proj.tasks.filter((t) => !taskIdsToDelete.includes(t.id));
          }
        }
      };

      state.workspaces.forEach((ws) => deleteInProject(ws.projects));
      if (state.currentWorkspace) {
        deleteInProject(state.currentWorkspace.projects);
      }
    },
    addComment: (state, action) => {
      const { taskId, comment } = action.payload;
      const appendCommentInProject = (projects) => {
        if (!projects) return;
        for (const proj of projects) {
          if (proj.tasks) {
            const task = proj.tasks.find((t) => t.id === taskId);
            if (task) {
              task.comments = [...(task.comments || []), comment];
              return;
            }
          }
        }
      };

      state.workspaces.forEach((ws) => appendCommentInProject(ws.projects));
      if (state.currentWorkspace) {
        appendCommentInProject(state.currentWorkspace.projects);
      }
    },
    addProjectMember: (state, action) => {
      const { projectId, member } = action.payload;
      const addMemberInProject = (projects) => {
        if (!projects) return;
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          if (!project.members?.some((m) => m.id === member.id)) {
            project.members = [...(project.members || []), member];
          }
        }
      };

      state.workspaces.forEach((ws) => addMemberInProject(ws.projects));
      if (state.currentWorkspace) {
        addMemberInProject(state.currentWorkspace.projects);
      }
    },
    inviteWorkspaceMember: (state, action) => {
      const { workspaceId, email, role } = action.payload;
      const ws = state.workspaces.find((w) => w.id === workspaceId);
      const newUser = {
        id: `user_${Date.now()}`,
        name: email.split('@')[0],
        email,
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newMember = {
        id: `m_${Date.now()}`,
        userId: newUser.id,
        workspaceId,
        role: role || 'MEMBER',
        user: newUser,
      };

      if (ws) {
        ws.members = [...(ws.members || []), newMember];
      }
      if (state.currentWorkspace?.id === workspaceId) {
        state.currentWorkspace.members = [...(state.currentWorkspace.members || []), newMember];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWorkspaces
      .addCase(fetchWorkspacesAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchWorkspacesAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.workspaces = action.payload;
          const currentId = state.currentWorkspace?.id;
          const matching = action.payload.find((w) => w.id === currentId) || action.payload[0];
          state.currentWorkspace = matching;
          state.isBackendConnected = true;
        } else {
          state.workspaces = [];
          state.currentWorkspace = null;
          state.isBackendConnected = true;
        }
      })
      .addCase(fetchWorkspacesAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.isBackendConnected = false;
        state.error = action.payload;
      })
      // updateTaskStatusAsync fulfilled
      .addCase(updateTaskStatusAsync.fulfilled, (state, action) => {
        if (action.payload?.id) {
          const updated = action.payload;
          const updateInProject = (projects) => {
            if (!projects) return;
            for (const proj of projects) {
              if (proj.tasks) {
                const tIndex = proj.tasks.findIndex((t) => t.id === updated.id);
                if (tIndex !== -1) {
                  proj.tasks[tIndex] = { ...proj.tasks[tIndex], status: updated.status };
                  return;
                }
              }
            }
          };
          state.workspaces.forEach((ws) => updateInProject(ws.projects));
          if (state.currentWorkspace) {
            updateInProject(state.currentWorkspace.projects);
          }
        }
      });
  },
});

export const {
  clearWorkspaces,
  setCurrentWorkspace,
  addWorkspace,
  addProject,
  updateProject,
  addTask,
  updateTask,
  deleteTask,
  addComment,
  addProjectMember,
  inviteWorkspaceMember,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
