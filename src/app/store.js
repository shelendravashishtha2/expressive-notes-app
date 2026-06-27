import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { notesApi } from '../features/notes/notesApi.js';

export const store = configureStore({
  reducer: {
    [notesApi.reducerPath]: notesApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false
  }).concat(notesApi.middleware),
  devTools: import.meta.env.DEV
});

setupListeners(store.dispatch);
