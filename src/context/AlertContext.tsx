import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AlertItem } from '@/api';

interface AlertContextType {
  alerts: AlertItem[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertItem[]>>;
  reset: () => void;
}

const AlertContext = createContext<AlertContextType>({
  alerts: [],
  setAlerts: () => {},
  reset: () => {},
});

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const reset = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <AlertContext.Provider value={{ alerts, setAlerts, reset }}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlertContext = () => useContext(AlertContext);
export default AlertContext;
