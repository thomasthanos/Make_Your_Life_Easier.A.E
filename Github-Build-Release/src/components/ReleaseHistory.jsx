import React from 'react';
import { 
  FaSync, FaSpinner, FaRocket, FaTag, FaTrash,
  FaRegCalendarAlt, FaRegClock, FaCodeBranch, FaExternalLinkAlt
} from 'react-icons/fa';

function ReleaseHistory({
  releases,
  isLoading,
  activeHistorySubTab,
  setActiveHistorySubTab,
  fetchReleases,
  projectPath,
  setPendingDelete,
  isDeleting
}) {
  // Φίλτρα για releases και tags
  const releasesOnly = releases.filter(r => r.type === 'release');
  const tagsOnly = releases.filter(r => r.type === 'tag-only');

  return (
    <div className="tab-content fade-in">
      <div className="tab-header">
        <div className="tab-header-content">
          <h1>Release History</h1>
          <p className="tab-description">
            Manage GitHub releases and Git tags
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
      
      {/* SUBTABS */}
      <div className="subtab-nav">
        <button 
          className={`subtab-btn ${activeHistorySubTab === 'releases' ? 'active releases' : ''}`}
          onClick={() => setActiveHistorySubTab('releases')}
        >
          <FaRocket size={12} />
          Releases
          <span className="subtab-count">{releasesOnly.length}</span>
        </button>
        
        <button 
          className={`subtab-btn ${activeHistorySubTab === 'tags' ? 'active tags' : ''}`}
          onClick={() => setActiveHistorySubTab('tags')}
        >
          <FaTag size={12} />
          Tags Only
          <span className="subtab-count">{tagsOnly.length}</span>
        </button>
      </div>
      
      {isLoading ? (
        <div className="loading-state glass-panel">
          <FaSpinner className="spinner" size={36} />
          <p>Fetching releases & tags from GitHub...</p>
        </div>
      ) : (
        <>
          {/* RELEASES SUBTAB */}
          {activeHistorySubTab === 'releases' && (
            releasesOnly.length === 0 ? (
              <div className="empty-state glass-panel" style={{ maxWidth: '500px', margin: '40px auto' }}>
                <FaRocket size={48} />
                <h3>No Releases Found</h3>
                <p>Create your first release using the "Create Release" tab</p>
              </div>
            ) : (
              <div className="release-grid">
                {releasesOnly.map((rel, idx) => (
                  <ReleaseCard 
                    key={idx} 
                    release={rel} 
                    type="release"
                    setPendingDelete={setPendingDelete}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>
            )
          )}
          
          {/* TAGS SUBTAB */}
          {activeHistorySubTab === 'tags' && (
            tagsOnly.length === 0 ? (
              <div className="empty-state glass-panel" style={{ maxWidth: '500px', margin: '40px auto' }}>
                <FaTag size={48} />
                <h3>No Tags Without Releases</h3>
                <p>All Git tags have associated GitHub releases</p>
              </div>
            ) : (
              <div className="release-grid">
                {tagsOnly.map((tag, idx) => (
                  <ReleaseCard 
                    key={idx} 
                    release={tag} 
                    type="tag-only"
                    setPendingDelete={setPendingDelete}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// Sub-component for release/tag cards
function ReleaseCard({ release, type, setPendingDelete, isDeleting }) {
  const isTagOnly = type === 'tag-only';
  
  return (
    <div className={`release-card glass-panel ${isTagOnly ? 'tag-only-card' : ''}`}>
      <div className="card-header">
        <div className="release-tag">
          <span className={`tag-badge ${isTagOnly ? 'tag-badge-gray' : ''}`}>
            {release.tagName}
          </span>
          {release.isDraft && (
            <span className="draft-badge">Draft</span>
          )}
          {isTagOnly && (
            <span className="tag-only-badge">
              <FaTag size={8} /> Tag Only
            </span>
          )}
        </div>
        
        <div className="release-time">
          {release.publishedAt ? (
            <>
              <span className="time-item">
                <FaRegCalendarAlt size={10} />
                {new Date(release.publishedAt).toLocaleDateString()}
              </span>
              <span className="time-item">
                <FaRegClock size={10} />
                {new Date(release.publishedAt).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </>
          ) : (
            <span className="time-item tag-only-time">
              <FaCodeBranch size={10} />
              No GitHub Release
            </span>
          )}
        </div>
      </div>
      
      <div className="card-body">
        <div className="release-content">
          <h3 className={`release-title ${isTagOnly ? 'tag-only-title' : ''}`}>
            {release.title}
          </h3>
          <div className="release-links">
            {isTagOnly ? (
              <span className="action-link disabled">
                <FaTag size={11} /> Git tag only (no release page)
              </span>
            ) : (
              <a 
                href={release.url} 
                target="_blank" 
                rel="noreferrer" 
                className="action-link"
              >
                <FaExternalLinkAlt size={11} /> View on GitHub
              </a>
            )}
          </div>
        </div>
        
        <div className="release-actions">
          <button 
            className="delete-btn"
            onClick={() => setPendingDelete({
              tagName: release.tagName,
              type: type
            })}
            title={`Delete ${isTagOnly ? 'tag' : 'release and tag'}`}
            disabled={isDeleting}
          >
            <FaTrash size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReleaseHistory;
