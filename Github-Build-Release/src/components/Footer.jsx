import React from 'react';

function Footer({ projectPath, releasesCount, tagsCount, isBuilding }) {
  const formatProjectName = (path) => {
    if (!path) return 'None';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <footer className="app-footer glass-panel">
      <div className="footer-stats">
        <div className="stat">
          <span className="stat-label">Project</span>
          <span className="stat-value">
            {formatProjectName(projectPath)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Releases</span>
          <span className="stat-value">{releasesCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Tags Only</span>
          <span className="stat-value">{tagsCount}</span>
        </div>
        <div className="stat status-stat">
          <span className="stat-label">Status</span>
          <span className="stat-value">
            <span className={`status-indicator ${isBuilding ? 'building' : 'idle'}`}>
              {isBuilding ? 'Building' : 'Ready'}
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
