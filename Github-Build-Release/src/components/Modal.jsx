import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaTimes, FaRocket, FaTrash, FaExclamationTriangle, FaTag, FaCode, FaFileAlt, FaFolder, FaCheck, FaSpinner } from 'react-icons/fa';

function Modal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  icon, 
  iconClass = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmClass = 'primary',
  isLoading = false,
  children 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div 
      className={`modal-backdrop ${isAnimating ? 'modal-visible' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={`modal-card glass-panel ${isAnimating ? 'modal-card-visible' : ''}`}>
        {/* Close button */}
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          disabled={isLoading}
        >
          <FaTimes size={14} />
        </button>

        {/* Header */}
        <div className="modal-header">
          <div className={`modal-icon ${iconClass}`}>
            {typeof icon === 'string' ? icon : icon}
          </div>
          <div className="modal-header-text">
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>

        {/* Body */}
        {children && (
          <div className="modal-body">
            {children}
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button 
            className="modal-btn modal-btn-cancel" 
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            className={`modal-btn modal-btn-${confirmClass}`} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className="btn-spinner" size={12} />
                <span>Working...</span>
              </>
            ) : (
              <>
                {confirmClass === 'danger' && <FaTrash size={11} />}
                {confirmClass === 'primary' && <FaCheck size={11} />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete confirmation modal
export function DeleteModal({ 
  isOpen, 
  pendingDelete, 
  onClose, 
  onConfirm, 
  isDeleting 
}) {
  if (!pendingDelete) return null;

  const isTagOnly = pendingDelete.type === 'tag-only';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${isTagOnly ? 'Tag' : 'Release'}`}
      icon={<FaExclamationTriangle size={18} />}
      iconClass="danger"
      confirmText={isDeleting ? 'Deleting...' : `Delete ${pendingDelete.tagName}`}
      confirmClass="danger"
      isLoading={isDeleting}
    >
      <div className="delete-modal-content">
        <div className="delete-target">
          <FaTag className="delete-target-icon" />
          <span className="delete-target-name">{pendingDelete.tagName}</span>
        </div>
        
        <div className="delete-warning">
          {isTagOnly ? (
            <p>This will <strong>permanently delete</strong> the Git tag from both remote and local repositories.</p>
          ) : (
            <p>This will <strong>permanently delete</strong> the GitHub release and the Git tag from both remote and local repositories.</p>
          )}
        </div>

        <div className="delete-note">
          <FaExclamationTriangle size={12} />
          <span>This action cannot be undone!</span>
        </div>
      </div>
    </Modal>
  );
}

// Release confirmation modal - Enhanced UI
export function ReleaseModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  version, 
  title, 
  notes, 
  projectName,
  isReleasing 
}) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirm Release"
      icon={<FaRocket size={18} />}
      iconClass="release"
      confirmText={isReleasing ? 'Releasing...' : 'Confirm & Release'}
      confirmClass="primary"
      isLoading={isReleasing}
    >
      <div className="release-modal-content">
        {/* Version Badge */}
        <div className="release-version-badge">
          <FaTag size={12} />
          <span>{version || 'No version'}</span>
        </div>

        {/* Info Grid */}
        <div className="release-info-grid">
          <div className="release-info-item">
            <div className="release-info-label">
              <FaFileAlt size={11} />
              <span>Title</span>
            </div>
            <div className="release-info-value">{title || 'Untitled'}</div>
          </div>

          <div className="release-info-item">
            <div className="release-info-label">
              <FaFolder size={11} />
              <span>Project</span>
            </div>
            <div className="release-info-value">{projectName || 'Unknown'}</div>
          </div>
        </div>

        {/* Tabs for Notes */}
        <div className="release-notes-section">
          <div className="release-notes-tabs">
            <button 
              className={`release-notes-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`release-notes-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
          </div>

          <div className="release-notes-content glass-panel-light">
            {activeTab === 'overview' ? (
              <pre className="release-notes-raw">
                {notes?.trim() ? notes.split('\n').slice(0, 10).join('\n') : 'No release notes'}
                {notes && notes.split('\n').length > 10 ? '\n\n...(truncated)' : ''}
              </pre>
            ) : (
              <div className="release-notes-preview">
                {notes ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notes.split('\n').slice(0, 10).join('\n')}
                  </ReactMarkdown>
                ) : (
                  <p className="no-notes">No release notes provided</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Steps Preview */}
        <div className="release-steps">
          <div className="release-step">
            <div className="release-step-number">1</div>
            <div className="release-step-text">Build project</div>
          </div>
          <div className="release-step-divider" />
          <div className="release-step">
            <div className="release-step-number">2</div>
            <div className="release-step-text">Create GitHub release</div>
          </div>
          <div className="release-step-divider" />
          <div className="release-step">
            <div className="release-step-number">3</div>
            <div className="release-step-text">Upload artifacts</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Modal;
