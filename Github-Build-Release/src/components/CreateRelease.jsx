import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaRocket, FaPen, FaTag, FaFileAlt, FaEye, FaEdit, FaTrash, FaMagic } from 'react-icons/fa';

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

  const generateQuickNotes = () => {
    const templates = [
      '### 🚀 What\'s New\n\n- ✨ New feature added\n- 🐛 Bug fixes and improvements\n- ⚡ Performance enhancements\n\n### 📝 Notes\n\n- Please report any issues on GitHub',
      '### 📦 Release Highlights\n\n- 🎉 Major update with new features\n- 🔧 Various fixes and improvements\n- 📚 Updated documentation\n\n### ⚠️ Breaking Changes\n\n- None',
      '### ✨ Features\n\n- New functionality\n\n### 🐛 Bug Fixes\n\n- Fixed issue with...\n\n### 🔄 Changes\n\n- Updated dependencies'
    ];
    setNotes(templates[Math.floor(Math.random() * templates.length)]);
  };

  return (
    <div className="tab-content fade-in">
      <div className="tab-header">
        <div className="tab-header-content">
          <h1>
            <span className="header-icon"><FaRocket /></span>
            Create New Release
          </h1>
          <p className="tab-description">
            Configure and publish a new release to GitHub
          </p>
        </div>
      </div>

      <div className="release-form-container glass-panel">
        {/* Version & Title Row */}
        <div className="form-row">
          <div className="form-card glass-panel-light">
            <div className="form-card-header">
              <FaTag className="form-card-icon" />
              <span>Version Tag</span>
            </div>
            <div className="form-card-body">
              <input
                className="modern-input"
                value={version}
                onChange={e => setVersion(e.target.value)}
                onFocus={handleVersionFocus}
                placeholder={suggestedVersion || "v1.0.0"}
              />
              {suggestedVersion && !version && (
                <div className="input-suggestion" onClick={() => setVersion(suggestedVersion)}>
                  <FaMagic size={10} />
                  <span>Use {suggestedVersion}</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-card glass-panel-light flex-2">
            <div className="form-card-header">
              <FaPen className="form-card-icon" />
              <span>Release Title</span>
            </div>
            <div className="form-card-body">
              <input
                className="modern-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Major Update: New Features & Improvements"
              />
            </div>
          </div>
        </div>

        {/* Notes Editor */}
        <div className="form-card notes-card glass-panel-light">
          <div className="form-card-header">
            <div className="header-left">
              <FaFileAlt className="form-card-icon" />
              <span>Release Notes</span>
            </div>
            <div className="editor-mode-toggle">
              <button
                className={`mode-btn ${!isPreview ? 'active' : ''}`}
                onClick={() => setIsPreview(false)}
                title="Edit Mode"
              >
                <FaEdit size={12} />
                <span>Edit</span>
              </button>
              <button
                className={`mode-btn ${isPreview ? 'active' : ''}`}
                onClick={() => setIsPreview(true)}
                title="Preview Mode"
              >
                <FaEye size={12} />
                <span>Preview</span>
              </button>
            </div>
          </div>

          <div className="notes-editor-container">
            {isPreview ? (
              <div className="markdown-preview custom-scrollbar">
                {notes ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notes}
                  </ReactMarkdown>
                ) : (
                  <div className="empty-preview">
                    <FaFileAlt size={32} />
                    <p>No content to preview</p>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className="notes-textarea custom-scrollbar"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write your release notes in Markdown..."
              />
            )}
          </div>

          <div className="notes-footer">
            <div className="quick-actions">
              <button
                className="quick-btn"
                onClick={generateQuickNotes}
                title="Generate template"
              >
                <FaMagic size={11} />
                <span>Template</span>
              </button>
              <button
                className="quick-btn danger"
                onClick={() => setNotes('')}
                title="Clear notes"
              >
                <FaTrash size={11} />
                <span>Clear</span>
              </button>
            </div>
            <span className="char-count">{notes.length} characters</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="release-form-actions">
          <button
            className="reset-btn glass-panel"
            onClick={() => {
              setVersion('');
              setTitle('');
              setNotes('### What\'s New\n\n- Bug fixes\n- Performance improvements\n- New features');
            }}
          >
            Reset Form
          </button>
          <button
            className="publish-btn"
            onClick={handleCreateRelease}
            disabled={!version || !title || isReleasing}
          >
            <FaRocket size={14} />
            <span>{isReleasing ? 'Publishing...' : 'Publish Release'}</span>
            {isReleasing && <div className="btn-loader"></div>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRelease;
