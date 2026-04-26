import { useState, useEffect, useCallback } from 'react';
import {
  addHistory,
  getHistory,
  clearHistory,
  deleteHistoryEntry,
} from '../db/history';

export function useHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, []);

  const addEntry = useCallback(async (entry) => {
    await addHistory(entry);
    setHistory((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const clear = useCallback(async () => {
    await clearHistory();
    setHistory([]);
  }, []);

  const remove = useCallback(async (id) => {
    await deleteHistoryEntry(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { history, loading, addEntry, clear, remove };
}
