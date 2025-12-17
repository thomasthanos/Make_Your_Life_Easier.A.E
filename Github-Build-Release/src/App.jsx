import React, { useState, useEffect } from 'react';
import {
  Sidebar,
  Header,
  EmptyState,
  CreateRelease,
  ReleaseHistory,
  BuildLogs,
  DeleteModal,
  ReleaseModal,
  ToastContainer,
  useToast
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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildCommand, setBuildCommand] = useState('npm run build-all');

  // Form State
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Modal State
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // GitHub CLI Status
  const [ghStatus, setGhStatus] = useState({ installed: null, loggedIn: null });

  // Toast notifications
  const toast = useToast();

  // Computed values
  const releasesOnly = releases.filter(r => r.type === 'release');
  const tagsOnly = releases.filter(r => r.type === 'tag-only');

  // Suggested next version based on package.json
  const suggestedVersion = projectVersion ? `v${projectVersion}` : '';

  // ============ EFFECTS ============

  // Theme initialization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Update titlebar colors based on theme
    if (window.api?.setTitleBarTheme) {
      window.api.setTitleBarTheme(theme);
    }
  }, [theme]);

  // Check GitHub CLI status on mount
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (window.api?.checkGhStatus) {
        const status = await window.api.checkGhStatus();
        if (isMounted) {
          setGhStatus(status);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 220));
      if (isMounted) {
        setIsAppReady(true);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // Build log listener
  useEffect(() => {
    if (window.api) {
      window.api.onBuildLog((data) => {
        setLogs((prev) => prev + data);
        // Detect build start
        if (data.includes('Building project') || data.includes('🔨 Step 1')) {
          setIsBuilding(true);
        }
        // Detect build completion (success or failure)
        if (data.includes('Build completed successfully') ||
          data.includes('Build failed') ||
          data.includes('❌ Build failed') ||
          data.includes('🎉 All artifacts uploaded') ||
          data.includes('Release Process Completed')) {
          setIsBuilding(false);
        }
      });

      // Listen for build complete event
      window.api.onBuildComplete?.(() => {
        setIsBuilding(false);
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
      toast.success(`Project loaded successfully!`, 'Project Ready');
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
    if (!buildCommand?.trim()) {
      toast.warning('Please set a build command first', 'Missing Command');
      return;
    }
    setLogs('');
    setActiveTab('logs');
    setIsBuilding(true);
    toast.info('Build process started...', 'Building');
    window.api.triggerBuild({ path: projectPath, command: buildCommand });
  };

  const handleCreateRelease = () => {
    if (!version || !title || !projectPath) {
      toast.warning('Please fill in both version and title', 'Missing Fields');
      return;
    }
    setShowReleaseConfirm(true);
  };

  const handleConfirmRelease = async () => {
    if (!version || !title || !projectPath) {
      setShowReleaseConfirm(false);
      toast.error('Please fill in version and title', 'Validation Error');
      return;
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
        toast.warning('Release created with some warnings. Check logs for details.', 'Partial Success');
      } else {
        toast.release(`${version} - ${title}`, 'Release Published! 🎉');
      }
      fetchReleases(projectPath);
      resetForm();
    } else {
      toast.error(result.error || 'Check logs for details', 'Release Failed');
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
    
    const deletedItem = pendingDelete.tagName;
    setPendingDelete(null);

    if (result.success) {
      setLogs(prev => prev + `✅ Successfully deleted ${deletedItem}.\n`);
      toast.success(`${deletedItem} has been deleted`, 'Deleted');
      fetchReleases(projectPath);
    } else {
      toast.error(`Failed to delete ${deletedItem}`, 'Delete Error');
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
    toast.info('Copied to clipboard!', 'Copied');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    // Update titlebar colors based on theme
    if (window.api?.setTitleBarTheme) {
      window.api.setTitleBarTheme(newTheme);
    }
  };

  const formatProjectName = (path) => {
    if (!path) return '';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  // ============ RENDER ============

  return (
    <div className={`app-container ${theme}-theme`}>
      {!isAppReady && (
        <div className="app-preloader" aria-live="polite">
          <div className="preloader-card glass-panel">
            <div className="preloader-spinner" aria-hidden="true"></div>
            <p>Loading your release cockpit…</p>
            <small>Connecting to GitHub and preparing build helpers.</small>
          </div>
        </div>
      )}
      {/* TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

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
        projectVersion={projectVersion}
      />

      {/* SECONDARY DRAG REGION */}
      <div className="drag-region" style={{ top: '0', left: '220px', right: '138px', height: '36px' }}></div>

      {/* MAIN LAYOUT */}
      <div className="main-layout">
        {/* SIDEBAR */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
