import React from 'react';
import { 
  FaFolderOpen, FaRocket, FaCodeBranch, 
  FaTerminal, FaPen, FaSpinner, FaCopy,
  FaFolder
} from 'react-icons/fa';

function Sidebar({
  activeTab,
  setActiveTab,
  projectPath,
  projectVersion,
  buildCommand,
  setBuildCommand,
  handleSelectFolder,
  isBuilding,
  releasesCount,
  tagsCount,
  handleCopyToClipboard
}) {
  const formatProjectName = (path) => {
    if (!path) return '';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  const handleNavClick = (tab) => {
    if (!projectPath) return;
    setActiveTab(tab);
  };

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-content">
        {/* NAVIGATION */}
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'create' ? 'active' : ''} ${!projectPath ? 'disabled' : ''}`} 
            onClick={() => handleNavClick('create')}
            disabled={!projectPath}
          >
            <div className="nav-icon">
              <FaPen size={14} />
            </div>
            <span>Create Release</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''} ${!projectPath ? 'disabled' : ''}`} 
            onClick={() => handleNavClick('history')}
            disabled={!projectPath}
          >
            <div className="nav-icon">
              <FaCodeBranch size={14} />
            </div>
            <span>Release History</span>
            {releasesCount > 0 && (
              <span className="nav-badge">{releasesCount}</span>
            )}
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''} ${!projectPath ? 'disabled' : ''}`} 
            onClick={() => handleNavClick('logs')}
            disabled={!projectPath}
          >
            <div className="nav-icon">
              <FaTerminal size={14} />
            </div>
            <span>Build Logs</span>
          </button>
        </nav>

        {/* PROJECT CARD */}
        <div className="project-card">
          <div className="project-header">
            <div className="project-icon">
              <FaFolder size={14} />
            </div>
            <div>
              <div className="project-title">Project</div>
              <div className="project-subtitle">Current Workspace</div>
            </div>
          </div>

          {projectPath ? (
            <>
              <div className="project-path">
                <code title={projectPath}>
                  {formatProjectName(projectPath)}
                </code>
                <button 
                  className="copy-btn" 
                  onClick={() => handleCopyToClipboard(projectPath)}
                  title="Copy path to clipboard"
                >
                  <FaCopy size={11} />
                </button>
              </div>
              
              {/* Build command */}
              <textarea
                className="glass-input"
                style={{
                  height: '32px',
                  minHeight: '32px',
                  maxHeight: '32px',
                  lineHeight: '22px',
                  padding: '5px 10px',
                  resize: 'none',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}
                value={buildCommand}
                onChange={e => setBuildCommand(e.target.value)}
                placeholder="npm run build-all"
              />
              
              <div className="project-subinfo">
                <button 
                  className="select-project-btn" 
                  onClick={handleSelectFolder}
                  style={{ marginLeft: 'auto' }}
                >
                  <FaFolderOpen size={12} /> Change Project
                </button>
              </div>
            </>
          ) : (
            <div className="empty-project">
              <p>No project selected</p>
              <button 
                className="select-project-btn" 
                onClick={handleSelectFolder}
              >
                <FaFolderOpen size={12} /> Select Project Folder
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-stats">
          <div className="footer-stat-item">
            <span className="footer-stat-label">Project</span>
            <span className="footer-stat-value">
              {formatProjectName(projectPath) || 'None'}
            </span>
          </div>
          <div className="footer-stat-item">
            <span className="footer-stat-label">Releases</span>
            <span className="footer-stat-value">{releasesCount}</span>
          </div>
          <div className="footer-stat-item">
            <span className="footer-stat-label">Tags</span>
            <span className="footer-stat-value">{tagsCount}</span>
          </div>
          <div className="footer-stat-item">
            <span className="footer-stat-label">Status</span>
            <span className="footer-stat-value">
              <span className={`status-indicator ${isBuilding ? 'building' : 'idle'}`}>
                {isBuilding ? 'Building' : 'Ready'}
              </span>
            </span>
          </div>
        </div>
        {projectVersion && (
          <div className="sidebar-version">
            v{projectVersion}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
