import React, { createContext, useContext, useState } from 'react';

interface AssistantContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AssistantContext = createContext<AssistantContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <AssistantContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </AssistantContext.Provider>
  );
}

export const useAssistant = () => useContext(AssistantContext);
