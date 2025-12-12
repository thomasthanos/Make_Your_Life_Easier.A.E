import React, { useState, useEffect } from 'react';
import { 
  Sidebar, 
  Header, 
  Footer, 
  EmptyState, 
  CreateRelease, 
  ReleaseHistory, 
  BuildLogs,
  DeleteModal,
  ReleaseModal
} from './components';
import './App.css';

function App() {
  // Project State
  const [projectPath, setProjectPath] = useState('');
  const [projectVersion, setProjectVersion] = useState('');
  const [releases, setReleases] = useState([]);
  const [logs, setLogs] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState('create');
  const [activeHistorySubTab, setActiveHistorySubTab] = useState('releases');
  const [theme, setTheme] = useState('dark');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildCommand, setBuildCommand] = useState('npm run build-all');
  
  // Form State
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  
  // GitHub CLI Status
  const [ghStatus, setGhStatus] = useState({ installed: null, loggedIn: null });

  // Computed values
  const releasesOnly = releases.filter(r => r.type === 'release');
  const tagsOnly = releases.filter(r => r.type === 'tag-only');

  // Suggested next version based on package.json
  const suggestedVersion = projectVersion ? `v${projectVersion}` : '';

  // ============ EFFECTS ============

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Check GitHub CLI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (window.api?.checkGhStatus) {
        const status = await window.api.checkGhStatus();
        setGhStatus(status);
      }
    };
    checkStatus();
  }, []);

  // Build log listener
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

  // ============ HANDLERS ============

  const handleSelectFolder = async () => {
    const path = await window.api.selectFolder();
    if (path) {
      setProjectPath(path);
      fetchReleases(path);
      setLogs(`📂 Project loaded: ${path}\n`);
      loadProjectInfo(path);
    }
  };

  const loadProjectInfo = async (path) => {
    if (!path) return;
    const info = await window.api.getProjectInfo(path);
    if (info?.version) {
      setProjectVersion(info.version);
    } else {
      setProjectVersion('');
    }

    if (info?.suggestedBuildCommand) {
      setBuildCommand(info.suggestedBuildCommand);
    } else {
      setBuildCommand(prev => prev || 'npm run build-all');
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
    if (!buildCommand?.trim()) return alert('Please set a build command');
    setLogs('');
    setActiveTab('logs');
    setIsBuilding(true);
    window.api.triggerBuild({ path: projectPath, command: buildCommand });
  };

  const handleCreateRelease = () => {
    if (!version || !title || !projectPath) return alert("Please fill in version and title");
    setShowReleaseConfirm(true);
  };

  const handleConfirmRelease = async () => {
    if (!version || !title || !projectPath) {
      setShowReleaseConfirm(false);
      return alert("Please fill in version and title");
    }

    setShowReleaseConfirm(false);
    setIsReleasing(true);
    setLogs(prev => prev + `\n🚀 Starting Release Process for ${version}...\n`);
    setActiveTab('logs');
    
    const result = await window.api.createRelease({ 
      path: projectPath, 
      version, 
      title, 
      notes, 
      buildCommand 
    });
    setIsReleasing(false);

    if (result.success || result.partialSuccess) {
      setLogs(prev => prev + `\n✅ Release Process Completed!\n`);
      if (result.partialSuccess) {
        alert("Release created with some warnings. Check logs for details.");
      } else {
        alert("Release created and artifacts uploaded successfully!");
      }
      fetchReleases(projectPath);
      resetForm();
    } else {
      alert("Failed to create release. Check logs for details.");
      setLogs(prev => prev + `\n❌ Error: ${result.error}\n`);
    }
  };

  const handleDeleteRelease = async () => {
    if (!pendingDelete || !pendingDelete.tagName) return;
    
    setIsDeleting(true);
    setLogs(prev => prev + `\n🗑️ Deleting ${pendingDelete.type === 'tag-only' ? 'tag' : 'release'}: ${pendingDelete.tagName}...\n`);
    
    const result = await window.api.deleteRelease({ 
      path: projectPath, 
      tagName: pendingDelete.tagName
    });
    
    setIsDeleting(false);
    setPendingDelete(null);

    if (result.success) {
      setLogs(prev => prev + `✅ Successfully deleted ${pendingDelete.tagName}.\n`);
      fetchReleases(projectPath);
    } else {
      alert(`Failed to delete ${pendingDelete.tagName}`);
      setLogs(prev => prev + `❌ Delete Error: ${result.error}\n`);
    }
  };

  const resetForm = () => {
    setVersion('');
    setTitle('');
    setNotes('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
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

  // ============ RENDER ============

  return (
    <div className={`app-container ${theme}-theme`}>
      {/* AMBIENT EFFECTS */}
      <div className="ambient-particles"></div>
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>
      <div className="glow-orb orb-3"></div>

      {/* DRAG REGION */}
      <div className="drag-region"></div>

      {/* HEADER */}
      <Header 
        activeTab={activeTab}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* SECONDARY DRAG REGION */}
      <div className="drag-region" style={{ top: '0', left: '220px', right: '138px', height: '36px' }}></div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        {/* SIDEBAR */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          theme={theme}
          toggleTheme={toggleTheme}
          projectPath={projectPath}
          projectVersion={projectVersion}
          buildCommand={buildCommand}
          setBuildCommand={setBuildCommand}
          handleSelectFolder={handleSelectFolder}
          handleBuild={handleBuild}
          isBuilding={isBuilding}
          releasesCount={releasesOnly.length}
          tagsCount={tagsOnly.length}
          handleCopyToClipboard={handleCopyToClipboard}
        />

        {/* MAIN CONTENT */}
        <main className="main-content">
          <div className="content-area">
            {!projectPath ? (
              <EmptyState 
                handleSelectFolder={handleSelectFolder}
                ghStatus={ghStatus}
              />
            ) : (
              <>
                {activeTab === 'create' && (
                  <CreateRelease
                    version={version}
                    setVersion={setVersion}
                    title={title}
                    setTitle={setTitle}
                    notes={notes}
                    setNotes={setNotes}
                    isPreview={isPreview}
                    setIsPreview={setIsPreview}
                    isReleasing={isReleasing}
                    handleCreateRelease={handleCreateRelease}
                    suggestedVersion={suggestedVersion}
                  />
                )}

                {activeTab === 'history' && (
                  <ReleaseHistory
                    releases={releases}
                    isLoading={isLoading}
                    activeHistorySubTab={activeHistorySubTab}
                    setActiveHistorySubTab={setActiveHistorySubTab}
                    fetchReleases={fetchReleases}
                    projectPath={projectPath}
                    setPendingDelete={setPendingDelete}
                    isDeleting={isDeleting}
                  />
                )}

                {activeTab === 'logs' && (
                  <BuildLogs
                    logs={logs}
                    setLogs={setLogs}
                    isBuilding={isBuilding}
                    handleBuild={handleBuild}
                  />
                )}
              </>
            )}
          </div>

          {/* FOOTER */}
          <Footer
            projectPath={projectPath}
            releasesCount={releasesOnly.length}
            tagsCount={tagsOnly.length}
            isBuilding={isBuilding}
          />
        </main>
      </div>

      {/* MODALS */}
      <DeleteModal
        isOpen={!!pendingDelete}
        pendingDelete={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteRelease}
        isDeleting={isDeleting}
      />

      <ReleaseModal
        isOpen={showReleaseConfirm}
        onClose={() => setShowReleaseConfirm(false)}
        onConfirm={handleConfirmRelease}
        version={version}
        title={title}
        notes={notes}
        projectName={formatProjectName(projectPath)}
        isReleasing={isReleasing}
      />
    </div>
  );
}

export default App;
