// src/store/index.ts (ou "@/store")
import { configureStore } from '@reduxjs/toolkit';

type AuthSession = {
  token: string;
  expiresAt?: string | null;
  user: {
    email: string;
    name: string | null;
    phone?: string | null;
    language?: string | null;
    genre?: string | null;
  };
};

type AuthPendingPhone = {
  pendingToken: string;
  pendingTokenExpiresAt?: string | null;
  machineCode: string;
  phone?: string | null;
  ddd?: string | null;
};

type AuthPendingTerms = {
  pendingToken: string;
  termsPendingTokenExpiresAt?: string | null;
};

type AuthState = {
  loading: boolean;
  error: string | null;
  session: AuthSession | null;
  pendingPhone: AuthPendingPhone | null;
  pendingTerms: AuthPendingTerms | null;
};

const authInitial: AuthState = {
  loading: false,
  error: null,
  session: null,
  pendingPhone: null,
  pendingTerms: null,
};

function authReducer(state: AuthState = authInitial, action: any): AuthState {
  switch (action.type) {
    case 'auth/loginStart':
      return { ...state, loading: true, error: null };
    case 'auth/loginSuccess':
      return {
        ...state,
        loading: false,
        error: null,
        session: action.payload as AuthSession,
        pendingPhone: null,
        pendingTerms: null,
      };
    case 'auth/loginError':
      return { ...state, loading: false, error: action.payload };
    case 'auth/loginRequiresPhone':
      return {
        ...state,
        loading: false,
        error: null,
        pendingPhone: action.payload as AuthPendingPhone,
        session: null,
        pendingTerms: null,
      };
    case 'auth/loginRequiresTerms':
      return {
        ...state,
        loading: false,
        error: null,
        pendingTerms: action.payload as AuthPendingTerms,
        session: null,
        pendingPhone: null,
      };
    case 'auth/clearPendingTerms':
      return {
        ...state,
        pendingTerms: null,
      };
    case 'auth/phoneRequestSuccess':
      return {
        ...state,
        pendingPhone: state.pendingPhone
          ? {
              ...state.pendingPhone,
              phone: (action.payload?.phone as string | null | undefined) ?? state.pendingPhone.phone,
              ddd: (action.payload?.ddd as string | null | undefined) ?? state.pendingPhone.ddd,
            }
          : state.pendingPhone,
      };
    case 'auth/logout':
      return { ...authInitial };
    default:
      return state;
  }
}

export const store = configureStore({ reducer: { auth: authReducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
