import React from 'react';
import { 
  FaRocket, FaFolderOpen, FaGithub,
  FaCheckCircle, FaExclamationCircle, FaInfoCircle
} from 'react-icons/fa';

function EmptyState({ handleSelectFolder, ghStatus }) {
  const isReady = ghStatus.installed && ghStatus.loggedIn;
  
  return (
    <div className="empty-state-wrapper">
      <div className="empty-state-modern glass-panel">
        {/* Hero Section */}
        <div className="empty-hero">
          <div className="hero-icon">
            <FaRocket size={48} />
          </div>
          <h1>Welcome to GitHub Release Manager</h1>
          <p className="hero-subtitle">Streamline your build and release workflow</p>
        </div>

        {/* Status Check */}
        <div className={`status-check ${isReady ? 'ready' : 'needs-setup'}`}>
          {isReady ? (
            <>
              <FaCheckCircle size={20} />
              <div>
                <strong>Ready to Go!</strong>
                <span>GitHub CLI is configured and ready</span>
              </div>
            </>
          ) : (
            <>
              <FaExclamationCircle size={20} />
              <div>
                <strong>Setup Required</strong>
                <span>Complete the steps below to get started</span>
              </div>
            </>
          )}
        </div>

        {/* Quick Setup Steps */}
        {!isReady && (
          <div className="quick-setup">
            <h3>Quick Setup</h3>
            <div className="setup-steps-compact">
              {!ghStatus.installed && (
                <div className="compact-step">
                  <span className="step-num">1</span>
                  <div className="step-info">
                    <strong>Install GitHub CLI</strong>
                    <code>winget install GitHub.cli</code>
                    <a href="https://cli.github.com" target="_blank" rel="noreferrer" className="learn-more">
                      Download <FaGithub size={12} />
                    </a>
                  </div>
                </div>
              )}
              
              {ghStatus.installed && !ghStatus.loggedIn && (
                <div className="compact-step">
                  <span className="step-num">2</span>
                  <div className="step-info">
                    <strong>Login to GitHub</strong>
                    <code>gh auth login</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button 
          className={`cta-button ${isReady ? 'ready' : 'disabled'}`}
          onClick={handleSelectFolder}
          disabled={!isReady}
        >
          <FaFolderOpen size={16} />
          {isReady ? 'Open Project Folder' : 'Complete Setup First'}
        </button>

        {/* Requirements Info */}
        {isReady && (
          <div className="requirements-info">
            <FaInfoCircle size={14} />
            <p>
              Select a folder with a Git repository, remote origin, and package.json
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
