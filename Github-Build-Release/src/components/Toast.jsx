import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle, FaTimes, FaRocket } from 'react-icons/fa';

const ICONS = {
  success: FaCheckCircle,
  warning: FaExclamationTriangle,
  error: FaTimesCircle,
  info: FaInfoCircle,
  release: FaRocket
};

function Toast({ id, type = 'info', title, message, duration = 5000, onClose }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  
  const Icon = ICONS[type] || ICONS.info;

  useEffect(() => {
    if (duration > 0) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);
        
        if (remaining <= 0) {
          clearInterval(interval);
          handleClose();
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  };

  return (
    <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="toast-icon-wrapper">
        <Icon className="toast-icon" />
      </div>
      <div className="toast-content">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{message}</div>
      </div>
      <button className="toast-close" onClick={handleClose}>
        <FaTimes size={12} />
      </button>
      {duration > 0 && (
        <div className="toast-progress">
          <div className="toast-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
}

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

export default Toast;
