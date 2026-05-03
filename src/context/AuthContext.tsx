import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { grainApi, isNetworkError } from '@/api';
import type { User } from '@/api';
import { StorageKeys, ApiTimeout } from '@/utils/enums';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReconnecting: boolean;
  error: string | null;
}

interface ProfileUpdateData {
  name?: string;
  bio?: string;
  phoneNumber?: string;
  location?: string;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RECONNECTING'; payload: boolean }
  | { type: 'OPTIMISTIC_AUTH' }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isReconnecting: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, user: action.payload, error: null };
    case 'AUTH_ERROR':
      return { ...state, isLoading: false, isAuthenticated: false, user: null, error: action.payload };
    case 'AUTH_LOGOUT':
      return { ...initialState, isLoading: false, isReconnecting: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_RECONNECTING':
      return { ...state, isReconnecting: action.payload };
    case 'OPTIMISTIC_AUTH':
      // Token exists but server unreachable — grant access optimistically
      return { ...state, isLoading: false, isAuthenticated: true, isReconnecting: true };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReconnecting: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  updateProfileImage: (base64: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isReconnecting: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {},
  updateProfile: async () => {},
  updateProfileImage: async () => {},
  refreshProfile: async () => {},
});

const RESTORE_AUTH_TIMEOUT = ApiTimeout.Startup; // 10s timeout for startup auth check (vs 30s default)
const RECONNECT_INTERVAL = 15000; // retry every 15s when reconnecting

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Background retry: when isReconnecting, periodically try to validate the token
  useEffect(() => {
    if (state.isReconnecting) {
      reconnectTimerRef.current = setInterval(async () => {
        try {
          const user = await grainApi.auth.me(RESTORE_AUTH_TIMEOUT);
          try {
            const profile = await grainApi.profile.get();
            dispatch({ type: 'AUTH_SUCCESS', payload: { ...user, ...profile } });
          } catch {
            dispatch({ type: 'AUTH_SUCCESS', payload: user });
          }
        } catch (error: any) {
          if (isNetworkError(error)) {
            // Still unreachable, keep trying
            return;
          }
          // Got a real response (e.g. 401) — token is invalid
          await SecureStore.deleteItemAsync(StorageKeys.AuthToken).catch(() => {});
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      }, RECONNECT_INTERVAL);
    } else if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    return () => {
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    };
  }, [state.isReconnecting]);

  useEffect(() => {
    restoreAuth();
  }, []);

  const restoreAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync(StorageKeys.AuthToken);
      if (token) {
        try {
          // Use shorter timeout for startup — don't block the app for 30s
          const user = await grainApi.auth.me(RESTORE_AUTH_TIMEOUT);
          // Try to fetch full profile including profileImage, bio, etc.
          try {
            const profile = await grainApi.profile.get();
            dispatch({ type: 'AUTH_SUCCESS', payload: { ...user, ...profile } });
          } catch {
            dispatch({ type: 'AUTH_SUCCESS', payload: user });
          }
        } catch (error: any) {
          // If network error (server unreachable), keep token and grant access optimistically
          // Only logout on explicit 401 (invalid/expired token)
          if (isNetworkError(error)) {
            console.warn('Network error during auth restore — granting optimistic auth, will retry in background');
            dispatch({ type: 'OPTIMISTIC_AUTH' });
          } else {
            // 401 or other server errors — token is invalid, logout
            await SecureStore.deleteItemAsync(StorageKeys.AuthToken).catch(() => {});
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        }
      } else {
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    } catch {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { user } = await grainApi.auth.login(email, password);
      dispatch({ type: 'AUTH_SUCCESS', payload: user });
    } catch (error: any) {
      const message = error?.message || 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { user } = await grainApi.auth.register(name, email, password);
      dispatch({ type: 'AUTH_SUCCESS', payload: user });
    } catch (error: any) {
      const message = error?.message || 'Registration failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await grainApi.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    try {
      const updatedUser = await grainApi.profile.update(data);
      dispatch({ type: 'AUTH_SUCCESS', payload: updatedUser });
    } catch (error: any) {
      throw error;
    }
  }, []);

  const updateProfileImage = useCallback(async (base64: string) => {
    try {
      const updatedUser = await grainApi.profile.updateAvatar(base64);
      dispatch({ type: 'AUTH_SUCCESS', payload: updatedUser });
    } catch (error: any) {
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const user = await grainApi.auth.me();
      try {
        const profile = await grainApi.profile.get();
        dispatch({ type: 'AUTH_SUCCESS', payload: { ...user, ...profile } });
      } catch {
        dispatch({ type: 'AUTH_SUCCESS', payload: user });
      }
    } catch {
      // Silently fail — profile will stay stale until next successful refresh
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        isReconnecting: state.isReconnecting,
        error: state.error,
        login,
        register,
        logout,
        clearError,
        updateProfile,
        updateProfileImage,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
