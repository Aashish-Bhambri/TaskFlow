import { configureStore } from '@reduxjs/toolkit';
import themeReducer from '../features/themeSlice';
import workspaceReducer from '../features/workspaceSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    workspace: workspaceReducer,
  },
});
