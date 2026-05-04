import { Alert } from 'react-native';

export interface AppError {
  message: string;
  code?: string;
  isNetwork: boolean;
  originalError?: any;
}

export function normalizeError(err: any): AppError {
  const message = err?.response?.data?.message || err?.message || 'An unexpected error occurred';
  const code = err?.response?.status?.toString() || err?.code;
  const isNetwork = !err?.response && (err?.message?.includes('Network Error') || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK');
  return { message, code, isNetwork, originalError: err };
}

export function handleError(
  err: any,
  options?: {
    silent?: boolean;
    fallbackMessage?: string;
    onNetworkError?: () => void;
  },
): AppError {
  const { silent = false, fallbackMessage, onNetworkError } = options || {};
  const appErr = normalizeError(err);
  const displayMessage = fallbackMessage || appErr.message;

  if (appErr.isNetwork && onNetworkError) {
    onNetworkError();
    return appErr;
  }

  if (!silent) {
    Alert.alert('Error', displayMessage);
  }

  return appErr;
}

export function logError(context: string, err: any) {
  const appErr = normalizeError(err);
  console.error(`[${context}]`, appErr.message, appErr.code ? `(code: ${appErr.code})` : '', appErr.isNetwork ? '[NETWORK]' : '');
}
