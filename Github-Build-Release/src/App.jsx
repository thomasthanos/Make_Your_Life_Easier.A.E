import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FaGithub, FaFolderOpen, FaRocket, FaCodeBranch, 
  FaTerminal, FaPen, FaTrash, FaExternalLinkAlt, 
  FaSpinner, FaCopy, FaRegClock, FaRegCalendarAlt, 
  FaSync, FaSun, FaMoon, FaCloud, FaCode, FaTimes,
  FaCheckCircle, FaFolder, FaDatabase, FaCircle,
  FaPaintBrush // Νέο εικονίδιο για το theme
} from 'react-icons/fa';
import './App.css';

function App() {
  const [projectPath, setProjectPath] = useState('');
  const [releases, setReleases] = useState([]);
  const [logs, setLogs] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [theme, setTheme] = useState('dark');
  const [isBuilding, setIsBuilding] = useState(false);
  
  // Form State
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    if (window.api) {
      window.api.onBuildLog((data) => {
        setLogs((prev) => prev + data);
        if (data.includes('Building') || data.includes('Compiling')) {
          setIsBuilding(true);
        }
        if (data.includes('Completed') || data.includes('Failed')) {
          setIsBuilding(false);
        }
      });
    }
    return () => {
      if (window.api) window.api.removeBuildLogListener();
    };
  }, []);

  const handleSelectFolder = async () => {
    console.log('Select folder clicked - debugging'); // Debug
    const path = await window.api.selectFolder();
    if (path) {
      setProjectPath(path);
      fetchReleases(path);
      setLogs(`📂 Project loaded: ${path}\n`);
    }
  };

  const fetchReleases = async (path) => {
    setIsLoading(true);
    const data = await window.api.getReleases(path);
    if (Array.isArray(data)) {
      setReleases(data);
    } else {
      setReleases([]);
    }
    setIsLoading(false);
  };

  const handleBuild = () => {
    if (!projectPath) return;
    setLogs('');
    setActiveTab('logs');
    setIsBuilding(true);
    window.api.triggerBuild(projectPath);
  };

  const handleCreateRelease = async () => {
    if (!version || !title || !projectPath) return alert("Please fill in version and title");
    if (!confirm(`Release ${version} to GitHub?`)) return;

    setLogs(prev => prev + `\n🚀 Initiating Release ${version}...\n`);
    const result = await window.api.createRelease({ path: projectPath, version, title, notes });

    if (result.success) {
      setLogs(prev => prev + `✅ Release Published!\n`);
      alert("Release Created Successfully!");
      fetchReleases(projectPath);
      setVersion('');
      setTitle('');
      setNotes('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
    } else {
      alert("Failed to create release");
      setLogs(prev => prev + `❌ Error: ${result.error}\n`);
    }
  };

  const handleDeleteRelease = async (tagName) => {
    setIsDeleting(true);
    setLogs(prev => prev + `\n🗑️ Deleting release and tag: ${tagName}...\n`);
    const result = await window.api.deleteRelease({ path: projectPath, tagName });
    setIsDeleting(false);
    setPendingDelete(null);

    if (result.success) {
      setLogs(prev => prev + `✅ Successfully deleted ${tagName}.\n`);
      fetchReleases(projectPath);
    } else {
      alert(`Failed to delete ${tagName}`);
      setLogs(prev => prev + `❌ Delete Error: ${result.error}\n`);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const formatProjectName = (path) => {
    if (!path) return '';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className={`app-container ${theme}-theme`}>
      {/* AMBIENT PARTICLES */}
      <div className="ambient-particles"></div>
      
      {/* GLOW EFFECTS BACKGROUND */}
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>
      <div className="glow-orb orb-3"></div>

      {/* DRAG REGION - CUSTOM TITLEBAR */}
      <div className="drag-region"></div>

      {/* CUSTOM HEADER με κεντρικό τίτλο */}
      <header className="app-header">
        <div className="header-content">
          {/* Αριστερή πλευρά - Brand και Theme Toggle ΔΙΠΛΑ */}
          <div className="brand-section">
            <div className="brand-logo">
              <FaGithub size={14} className="logo-icon" />
              <span className="brand-text">Release<span className="brand-highlight">Flow</span></span>
            </div>
            
            {/* Theme Toggle ΔΙΠΛΑ στο brand - πιο αριστερά */}
            <button 
              className="theme-toggle-with-icon" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{ zIndex: 10000, position: 'relative' }}
            >
              <FaPaintBrush size={12} className="theme-icon" />
              {theme === 'dark' ? <FaSun size={11} /> : <FaMoon size={11} />}
            </button>
          </div>

          {/* Κεντρικός τίτλος */}
          <div className="header-center">
            {activeTab === 'create' && 'Create New Release'}
            {activeTab === 'history' && 'Release History'}
            {activeTab === 'logs' && 'Build Console'}
          </div>

          {/* Δεξιά πλευρά - Κενή τώρα (ή μπορείς να βάλεις κάτι άλλο εδώ) */}
          <div className="header-actions">
            {/* Κενό ή βάλε εδώ κάποιο άλλο στοιχείο αν θες */}
          </div>
        </div>
      </header>

{/* DRAG REGION - ΑΦΟΥ το header (τώρα δεν καλύπτει τα κουμπιά) */}
<div className="drag-region" style={{ top: '0', left: '220px', right: '138px', height: '32px' }}></div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        {/* SIDEBAR */}
        <aside className="sidebar glass-panel">
          <div className="sidebar-content">
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
                {releases.length > 0 && (
                  <span className="nav-badge">{releases.length}</span>
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

            {/* MODERN PROJECT CARD */}
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
                  
                  <div className="project-stats">
                    <div className="stat-item">
                      <span className="stat-value">{releases.length}</span>
                      <span className="stat-label">Releases</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">Git</span>
                      <span className="stat-label">VCS</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        <FaCheckCircle size={10} color="#2ed573" />
                      </span>
                      <span className="stat-label">Ready</span>
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
                  <span className="build-subtitle">npm run build</span>
                </div>
              </div>
            </button>

            {/* SIDEBAR ACTIONS με Connection Status */}
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
              
              {/* Connection Status ΚΑΤΩ στο sidebar */}
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

        {/* MAIN CONTENT */}
        <main className="main-content">
          {/* CONTENT AREA */}
          <div className="content-area">
            {!projectPath ? (
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
            ) : (
              <>
                {/* CREATE TAB */}
                {activeTab === 'create' && (
                  <div className="tab-content fade-in">
                    <div className="tab-header">
                      <div className="tab-header-content">
                        <h1>Create New Release</h1>
                        <p className="tab-description">
                          Fill in the details below to publish a new release to GitHub
                        </p>
                      </div>
                    </div>
                    
                    <div className="form-container glass-panel">
                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">
                            <span>Version Tag</span>
                            <span className="hint">(e.g., v1.0.0)</span>
                          </label>
                          <div className="input-with-icon">
                            <input 
                              className="glass-input" 
                              value={version} 
                              onChange={e => setVersion(e.target.value)} 
                              placeholder="v1.2.0" 
                            />
                            <span className="input-icon">#</span>
                          </div>
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">
                            <span>Release Title</span>
                            <span className="hint">(Keep it descriptive)</span>
                          </label>
                          <div className="input-with-icon">
                            <input 
                              className="glass-input" 
                              value={title} 
                              onChange={e => setTitle(e.target.value)} 
                              placeholder="Major Update: New Features & Improvements" 
                            />
                            <span className="input-icon"><FaPen size={12} /></span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Release Notes</label>
                        <div className="editor-wrapper glass-panel-light">
                          <div className="editor-header">
                            <div className="editor-tabs">
                              <button 
                                className={`tab-btn ${!isPreview ? 'active' : ''}`} 
                                onClick={() => setIsPreview(false)}
                              >
                                Edit Markdown
                              </button>
                              <button 
                                className={`tab-btn ${isPreview ? 'active' : ''}`} 
                                onClick={() => setIsPreview(true)}
                              >
                                Preview
                              </button>
                            </div>
                            <div className="editor-actions">
                              <button 
                                className="action-btn" 
                                onClick={() => setNotes('')}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          
                          <div className="editor-body">
                            {isPreview ? (
                              <div className="markdown-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {notes}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <textarea 
                                className="markdown-editor" 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Write your release notes in Markdown..."
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-actions">
                        <button 
                          className="secondary-btn glass-panel" 
                          onClick={() => {
                            setVersion('');
                            setTitle('');
                            setNotes('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
                          }}
                        >
                          Reset Form
                        </button>
                        <button 
                          className="primary-btn glass-panel accent" 
                          onClick={handleCreateRelease}
                          disabled={!version || !title}
                        >
                          <FaRocket size={14} /> Publish Release
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                  <div className="tab-content fade-in">
                    <div className="tab-header">
                      <div className="tab-header-content">
                        <h1>Release History</h1>
                        <p className="tab-description">
                          {releases.length} release{releases.length !== 1 ? 's' : ''} published to GitHub
                        </p>
                      </div>
                      <button 
                        className="refresh-btn-primary glass-panel" 
                        onClick={() => fetchReleases(projectPath)}
                      >
                        <FaSync className={isLoading ? 'spin' : ''} size={14} /> 
                        {isLoading ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    
                    {isLoading ? (
                      <div className="loading-state glass-panel">
                        <FaSpinner className="spinner" size={36} />
                        <p>Fetching releases from GitHub...</p>
                      </div>
                    ) : releases.length === 0 ? (
                      <div className="empty-state glass-panel">
                        <FaCodeBranch size={48} />
                        <h3>No Releases Found</h3>
                        <p>Create your first release using the "Create Release" tab</p>
                      </div>
                    ) : (
                      <div className="release-grid">
                        {releases.map((rel, idx) => (
                          <div key={idx} className="release-card glass-panel">
                            <div className="card-header">
                              <div className="release-tag">
                                <span className="tag-badge">{rel.tagName}</span>
                                {rel.isDraft && (
                                  <span className="draft-badge">Draft</span>
                                )}
                              </div>
                              
                              <div className="release-time">
                                <span className="time-item">
                                  <FaRegCalendarAlt size={10} />
                                  {new Date(rel.publishedAt).toLocaleDateString()}
                                </span>
                                <span className="time-item">
                                  <FaRegClock size={10} />
                                  {new Date(rel.publishedAt).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                            </div>
                            
                            <div className="card-body">
                              <div className="release-content">
                                <h3 className="release-title">{rel.title}</h3>
                                <div className="release-links">
                                  <a 
                                    href={rel.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="action-link"
                                  >
                                    <FaExternalLinkAlt size={11} /> View on GitHub
                                  </a>
                                </div>
                              </div>
                              
                              <div className="release-actions">
                                <button 
                                  className="delete-btn"
                                  onClick={() => setPendingDelete(rel.tagName)}
                                  title="Delete release and tag"
                                  disabled={isDeleting}
                                >
                                  <FaTrash size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LOGS TAB */}
                {activeTab === 'logs' && (
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
                )}
              </>
            )}
          </div>

          {/* FOOTER */}
          <footer className="app-footer glass-panel">
            <div className="footer-stats">
              <div className="stat">
                <span className="stat-label">Project</span>
                <span className="stat-value">
                  {projectPath ? formatProjectName(projectPath) : 'None'}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Releases</span>
                <span className="stat-value">{releases.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Status</span>
                <span className="stat-value">
                  <span className={`status-indicator ${isBuilding ? 'building' : 'idle'}`}>
                    {isBuilding ? 'Building' : 'Ready'}
                  </span>
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="modal-backdrop">
          <div className="modal-card glass-panel">
            <div className="modal-header">
              <div className="modal-icon danger">!</div>
              <div>
                <h3>Delete release {pendingDelete}?</h3>
                <p>This will remove the GitHub release and delete the git tag (remote & local).</p>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn ghost" 
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn danger" 
                onClick={() => handleDeleteRelease(pendingDelete)}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;