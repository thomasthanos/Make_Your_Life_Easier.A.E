import { useState } from 'react';

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (options) => {
    const id = Date.now() + Math.random();
    const toast = { id, ...options };
    setToasts(prev => [...prev, toast]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const success = (message, title = 'Success') => addToast({ type: 'success', title, message });
  const error = (message, title = 'Error') => addToast({ type: 'error', title, message });
  const warning = (message, title = 'Warning') => addToast({ type: 'warning', title, message });
  const info = (message, title = 'Info') => addToast({ type: 'info', title, message });
  const release = (message, title = 'Release') => addToast({ type: 'release', title, message, duration: 8000 });

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    release
  };
}
