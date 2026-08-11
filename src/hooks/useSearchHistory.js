import { useState, useEffect } from 'react';

const HISTORY_KEY = 'school_global_search_history';
const LEGACY_HISTORY_KEY = 'lpq_global_search_history';
const MAX_HISTORY = 10;

export const useSearchHistory = (enabled = true) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (enabled) {
      const stored = localStorage.getItem(HISTORY_KEY) || localStorage.getItem(LEGACY_HISTORY_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setHistory(parsed);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(parsed));
        } catch (e) {
          console.error("Failed to parse search history", e);
        }
      }
    }
  }, [enabled]);

  const addToHistory = (query) => {
    if (!enabled || !query || query.trim() === '') return;

    const trimmedQuery = query.trim();
    setHistory((prev) => {
      // Remove if exists to move to top
      const filtered = prev.filter(q => q.toLowerCase() !== trimmedQuery.toLowerCase());
      const newHistory = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const removeFromHistory = (query) => {
    setHistory((prev) => {
      const newHistory = prev.filter(q => q !== query);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(LEGACY_HISTORY_KEY);
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
};
