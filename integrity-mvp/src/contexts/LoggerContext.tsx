import { createContext, useContext, useState, useCallback } from 'react';

export interface LogEntry {
  id: string;
  time: string;
  event: string;
  source: string;
  status: 'Success' | 'Failed' | 'Pending';
  detail: string;
}

interface LoggerContextType {
  logs: LogEntry[];
  addLog: (event: string, source: string, status: 'Success' | 'Failed' | 'Pending', detail: string) => void;
  clearLogs: () => void;
}

const LoggerContext = createContext<LoggerContextType | undefined>(undefined);

// Initial mock data to keep the UI looking populated immediately
const INITIAL_LOGS: LogEntry[] = [
  { id: 'LOG-8991', time: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString(), event: 'Intent Pre-Execution Validated', source: 'BCC Middleware', status: 'Success', detail: 'ZK Proof verified. OPA Policy check passed.' },
  { id: 'LOG-8990', time: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString(), event: 'Drift Detected: Contract Call', source: 'Oracle', status: 'Failed', detail: 'Agent attempted swap>10,000 ITK. Blocked.' },
  { id: 'LOG-8989', time: new Date(Date.now() - 1000 * 60 * 30).toLocaleTimeString(), event: 'SmartBAA Patient Consent Signed', source: 'Smart Contract', status: 'Success', detail: 'TxHash: 0x44f2...a90b. Recorded on Base L2.' },
];

export const LoggerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  
  // Create a rolling counter for IDs
  const [counter, setCounter] = useState(8992);

  const addLog = useCallback((event: string, source: string, status: 'Success' | 'Failed' | 'Pending', detail: string) => {
    setLogs(prev => {
      const newLog: LogEntry = {
        id: `LOG-${counter}`,
        time: new Date().toLocaleTimeString(),
        event,
        source,
        status,
        detail
      };
      
      // Add new log to the beginning and keep max 500 logs
      const updatedLogs = [newLog, ...prev];
      if (updatedLogs.length > 500) {
        return updatedLogs.slice(0, 500);
      }
      return updatedLogs;
    });
    setCounter(prev => prev + 1);
  }, [counter]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <LoggerContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LoggerContext.Provider>
  );
};

export const useLogger = () => {
  const context = useContext(LoggerContext);
  if (context === undefined) {
    throw new Error('useLogger must be used within a LoggerProvider');
  }
  return context;
};
