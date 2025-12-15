import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card glass-panel">
        <div className="modal-header">
          <div className={`modal-icon ${iconClass}`}>{icon}</div>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>

        {children && (
          <div className="modal-body">
            {children}
          </div>
        )}

        <div className="modal-actions">
          <button 
            className="btn ghost" 
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${confirmClass}`} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Working...' : confirmText}
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
  if (!isOpen || !pendingDelete) return null;

  const isTagOnly = pendingDelete.type === 'tag-only';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${isTagOnly ? 'tag' : 'release'} ${pendingDelete.tagName}?`}
      description={
        isTagOnly 
          ? 'This will delete the Git tag (remote & local). There is no GitHub release to delete.'
          : 'This will remove the GitHub release and delete the git tag (remote & local).'
      }
      icon="!"
      iconClass="danger"
      confirmText={isDeleting ? 'Deleting...' : 'Delete'}
      confirmClass="danger"
      isLoading={isDeleting}
    />
  );
}

// Release confirmation modal
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
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Build and release ${version || '(no tag)'}?`}
      description="This will build your project, create a GitHub release, and upload artifacts."
      icon="🚀"
      iconClass="release"
      confirmText={isReleasing ? 'Working...' : 'Confirm & Release'}
      confirmClass="primary"
      isLoading={isReleasing}
    >
      <div className="modal-row">
        <span className="modal-label">Title</span>
        <span className="modal-value">{title || 'No title'}</span>
      </div>
      <div className="modal-row">
        <span className="modal-label">Project</span>
        <span className="modal-value">{projectName || 'None'}</span>
      </div>
      <div className="modal-row notes-row">
        <span className="modal-label">Notes (preview)</span>
        <div className="modal-notes glass-panel-light">
          <pre>
            {notes?.trim() ? notes.split('\n').slice(0, 8).join('\n') : 'No notes'}
            {notes && notes.split('\n').length > 8 ? '\n…' : ''}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

export default Modal;
