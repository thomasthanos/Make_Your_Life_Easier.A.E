import React, { useRef, useEffect } from 'react';
import { FaRocket } from 'react-icons/fa';

function BuildLogs({ 
  logs, 
  setLogs, 
  isBuilding, 
  handleBuild 
}) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="tab-content fade-in full-height">
      <div className="tab-header">
        <div className="tab-header-content">
          <h1>Build Console</h1>
          <p className="tab-description">
            Monitor build process in real-time
          </p>
        </div>
        <div className="log-actions">
          <button 
            className="secondary-btn glass-panel" 
            onClick={() => setLogs('')}
          >
            Clear Logs
          </button>
          <button 
            className="primary-btn glass-panel" 
            onClick={handleBuild}
          >
            <FaRocket size={14} /> Run Build
          </button>
        </div>
      </div>
      
      <div className="terminal-container glass-panel">
        <div className="terminal-header">
          <div className="terminal-title">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <span>console.log</span>
          </div>
          <div className="terminal-stats">
            {isBuilding && (
              <span className="building-indicator">⚡ Building</span>
            )}
            <span className="log-count">
              {logs.length.toLocaleString()} chars
            </span>
          </div>
        </div>
        
        <div className="terminal-body glass-panel-light">
          <pre className="terminal-output">
            {logs || "➜ Ready to build. Click 'Run Build' to start."}
          </pre>
          <div ref={logEndRef} />
        </div>
        
        <div className="terminal-footer">
          <div className="terminal-hint">
            Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run build • 
            Press <kbd>Esc</kbd> to clear logs
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuildLogs;
