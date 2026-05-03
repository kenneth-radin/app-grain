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
  reconnectMessage: string | null;
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
  | { type: 'OPTIMISTIC_AUTH'; payload?: string }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isReconnecting: false,
  reconnectMessage: null,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, isLoading: false, isAuthenticated: true, isReconnecting: false, reconnectMessage: null, user: action.payload, error: null };
    case 'AUTH_ERROR':
      return { ...state, isLoading: false, isAuthenticated: false, user: null, error: action.payload };
    case 'AUTH_LOGOUT':
      return { ...initialState, isLoading: false, isReconnecting: false, reconnectMessage: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_RECONNECTING':
      return { ...state, isReconnecting: action.payload };
    case 'OPTIMISTIC_AUTH':
      // Token exists but server unreachable — grant access optimistically
      return { ...state, isLoading: false, isAuthenticated: true, isReconnecting: true, reconnectMessage: action.payload ?? 'Connecting to server…' };
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
  reconnectMessage: string | null;
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
  reconnectMessage: null,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {},
  updateProfile: async () => {},
  updateProfileImage: async () => {},
  refreshProfile: async () => {},
});

const RESTORE_AUTH_TIMEOUT = ApiTimeout.Startup; // 30s timeout for startup auth check
const RECONNECT_INTERVAL = 10000; // retry every 10s when reconnecting
const STARTUP_RETRIES = 3;
const STARTUP_RETRY_DELAYS = [5000, 5000, 5000]; // 5s backoff between startup retries

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
        } catch (error: unknown) {
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
      if (!token) {
        dispatch({ type: 'AUTH_LOGOUT' });
        return;
      }

      // Try up to STARTUP_RETRIES times with backoff before giving up
      let lastError: unknown = null;
      for (let attempt = 0; attempt < STARTUP_RETRIES; attempt++) {
        try {
          const user = await grainApi.auth.me(RESTORE_AUTH_TIMEOUT);
          try {
            const profile = await grainApi.profile.get();
            dispatch({ type: 'AUTH_SUCCESS', payload: { ...user, ...profile } });
          } catch {
            dispatch({ type: 'AUTH_SUCCESS', payload: user });
          }
          return; // success — done
        } catch (error: unknown) {
          lastError = error;
          if (!isNetworkError(error)) {
            // 401 or other server errors — token is invalid, logout immediately
            await SecureStore.deleteItemAsync(StorageKeys.AuthToken).catch(() => {});
            dispatch({ type: 'AUTH_LOGOUT' });
            return;
          }
          // Network error — server may be cold-starting, retry with backoff
          if (attempt < STARTUP_RETRIES - 1) {
            dispatch({ type: 'OPTIMISTIC_AUTH', payload: `Connecting to server… (attempt ${attempt + 2}/${STARTUP_RETRIES})` });
            await new Promise((r) => setTimeout(r, STARTUP_RETRY_DELAYS[attempt]));
          }
        }
      }

      // All retries exhausted — grant optimistic auth and retry in background
      console.warn('All startup auth retries failed — granting optimistic auth, will retry in background every 10s');
      dispatch({ type: 'OPTIMISTIC_AUTH', payload: 'Connecting to server…' });
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
        reconnectMessage: state.reconnectMessage,
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
