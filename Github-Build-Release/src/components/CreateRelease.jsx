import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaRocket, FaPen } from 'react-icons/fa';

function CreateRelease({
  version,
  setVersion,
  title,
  setTitle,
  notes,
  setNotes,
  isPreview,
  setIsPreview,
  isReleasing,
  handleCreateRelease,
  suggestedVersion
}) {
  const handleVersionFocus = () => {
    // Auto-fill version if empty and we have a suggestion
    if (!version && suggestedVersion) {
      setVersion(suggestedVersion);
    }
  };

  return (
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
                onFocus={handleVersionFocus}
                placeholder={suggestedVersion || "v1.2.0"}
              />
              <span className="input-icon">#</span>
            </div>
            {suggestedVersion && !version && (
              <p className="input-hint">
                💡 Click to auto-fill: <strong>{suggestedVersion}</strong>
              </p>
            )}
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
            disabled={!version || !title || isReleasing}
          >
            <FaRocket size={14} /> {isReleasing ? 'Working...' : 'Publish Release'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRelease;
