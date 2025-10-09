// src/store/index.ts (ou "@/store")
import { configureStore } from '@reduxjs/toolkit';

const authInitial = { loading: false, error: null as string | null, user: null as any };
function authReducer(state = authInitial, action: any) {
  switch (action.type) {
    case 'auth/loginStart':   return { ...state, loading: true,  error: null };
    case 'auth/loginSuccess': return { ...state, loading: false, user: action.payload };
    case 'auth/loginError':   return { ...state, loading: false, error: action.payload };
    default: return state;
  }
}

export const store = configureStore({ reducer: { auth: authReducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;