import { useState, useEffect, useCallback } from 'react';
import { log as logFn, clearLogs as clearFn, subscribe, getLogs } from '../utils/logger';

export function useConsole() {
  const [logs, setLogs] = useState(() => getLogs());

  useEffect(() => {
    const unsub = subscribe((newLogs) => setLogs(newLogs));
    return unsub;
  }, []);

  const log = useCallback((level, message, detail = null) => {
    logFn(level, message, detail);
  }, []);

  const clearLogs = useCallback(() => {
    clearFn();
  }, []);

  return { logs, log, clearLogs };
}
