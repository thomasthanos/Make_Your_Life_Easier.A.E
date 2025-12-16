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
  handleBuild,
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
              
              <div className="project-stats">
                <div className="stat-item">
                  <span className="stat-value">{releasesCount}</span>
                  <span className="stat-label">Releases</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{tagsCount}</span>
                  <span className="stat-label">Tags</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">v{projectVersion || '-'}</span>
                  <span className="stat-label">Version</span>
                </div>
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
        
        {/* BUILD BUTTON */}
        <button 
          className={`build-btn glass-panel ${isBuilding ? 'building' : ''}`} 
          onClick={handleBuild}
          disabled={!projectPath || isBuilding}
        >
          <div className="build-btn-content">
            <div className="build-icon">
              {isBuilding ? <FaSpinner className="spin" size={14} /> : <FaRocket size={14} />}
            </div>
            <div className="build-text">
              <span className="build-title">
                {isBuilding ? 'Building...' : 'Build Project'}
              </span>
              <span className="build-subtitle">{buildCommand || 'npm run build-all'}</span>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
