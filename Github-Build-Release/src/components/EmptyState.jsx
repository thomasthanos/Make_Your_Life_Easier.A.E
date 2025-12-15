import React from 'react';
import { 
  FaCloud, FaFolderOpen, FaCode, FaGithub, FaDatabase,
  FaTerminal, FaCheckCircle, FaCircle
} from 'react-icons/fa';

function EmptyState({ handleSelectFolder, ghStatus }) {
  return (
    <div className="empty-state-wrapper">
      <div className="empty-state glass-panel">
        <div className="empty-state-icon">
          <FaCloud size={80} />
          <div className="empty-state-glow"></div>
        </div>
        <h2>Welcome to ReleaseFlow</h2>
        <p>Select a Git repository to start managing releases and builds</p>
        <button className="primary-btn glass-panel" onClick={handleSelectFolder}>
          <FaFolderOpen size={14} /> Open Project
        </button>
        
        {/* SETUP INSTRUCTIONS */}
        <div className="setup-instructions">
          <h3><FaTerminal size={16} /> Prerequisites</h3>
          
          {/* Status Banner */}
          {ghStatus.installed !== null && (
            <div className={`gh-status-banner ${ghStatus.installed && ghStatus.loggedIn ? 'success' : 'warning'}`}>
              {ghStatus.installed && ghStatus.loggedIn ? (
                <><FaCheckCircle size={14} /> GitHub CLI is ready! Select a project to begin.</>  
              ) : !ghStatus.installed ? (
                <><FaCircle size={10} /> GitHub CLI is not installed. Follow step 1 below.</>  
              ) : (
                <><FaCircle size={10} /> GitHub CLI installed but not logged in. Follow step 2 below.</>  
              )}
            </div>
          )}
          
          <div className={`instruction-step ${ghStatus.installed ? 'completed' : ''}`}>
            <div className="step-number">
              {ghStatus.installed ? <FaCheckCircle size={14} /> : '1'}
            </div>
            <div className="step-content">
              <strong>Install GitHub CLI {ghStatus.installed && <span className="step-badge success">✓ Installed</span>}</strong>
              <p>Download from <a href="https://cli.github.com" target="_blank" rel="noreferrer">cli.github.com</a></p>
              <code>winget install GitHub.cli</code>
            </div>
          </div>
          
          <div className={`instruction-step ${ghStatus.loggedIn ? 'completed' : ''}`}>
            <div className="step-number">
              {ghStatus.loggedIn ? <FaCheckCircle size={14} /> : '2'}
            </div>
            <div className="step-content">
              <strong>Login to GitHub CLI {ghStatus.loggedIn && <span className="step-badge success">✓ Logged In</span>}</strong>
              <p>Open terminal and run:</p>
              <code>gh auth login</code>
              <p className="step-note">Follow prompts to authenticate with your GitHub account</p>
            </div>
          </div>
          
          <div className="instruction-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <strong>Verify Authentication</strong>
              <p>Check if you're logged in:</p>
              <code>gh auth status</code>
            </div>
          </div>
          
          <div className="instruction-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <strong>Select Your Project</strong>
              <p>Open a folder that contains:</p>
              <ul>
                <li>A Git repository (initialized with <code>git init</code>)</li>
                <li>A remote origin (<code>git remote add origin URL</code>)</li>
                <li>A <code>package.json</code> with build scripts</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="empty-state-tips">
          <div className="tip">
            <FaCode size={14} />
            <span>Supports all Node.js projects</span>
          </div>
          <div className="tip">
            <FaGithub size={14} />
            <span>GitHub Releases & Tags</span>
          </div>
          <div className="tip">
            <FaDatabase size={14} />
            <span>Local & Remote Repositories</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
