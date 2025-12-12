import React from 'react';
import { 
  FaGithub, FaFolderOpen, FaRocket, FaCodeBranch, 
  FaTerminal, FaPen, FaSpinner, FaCopy, FaSun, FaMoon,
  FaFolder, FaCircle, FaPaintBrush
} from 'react-icons/fa';

function Sidebar({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
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

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-content">
        {/* NAVIGATION */}
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'create' ? 'active' : ''}`} 
            onClick={() => setActiveTab('create')}
          >
            <div className="nav-icon">
              <FaPen size={14} />
            </div>
            <span>Create Release</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} 
            onClick={() => setActiveTab('history')}
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
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('logs')}
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

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-actions">
          <div className="project-info">
            <div className="project-name">
              {projectPath ? formatProjectName(projectPath) : 'No Project'}
            </div>
            {projectPath && (
              <div className="project-folder" title={projectPath}>
                {projectPath.length > 40 
                  ? `${projectPath.substring(0, 37)}...` 
                  : projectPath}
              </div>
            )}
          </div>
          
          <div className="connection-status">
            <FaCircle 
              size={6} 
              className={`status-dot ${projectPath ? 'connected' : ''}`} 
            />
            <span>{projectPath ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
