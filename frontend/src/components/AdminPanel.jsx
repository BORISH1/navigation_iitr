import React from 'react';

const AdminPanel = ({
  mode,
  setMode,
  adminTool,
  setAdminTool,
  selectedNodeId,
  editForm,
  setEditForm,
  onApplyEdit,
  onDeleteNode,
  onSave,
  onExport,
  isSaving
}) => {
  return (
    <div className="admin-panel">
      <h3>🛠️ Admin Tools</h3>
      
      <div className="mode-toggle">
        <button
          className={mode === 'user' ? 'active' : ''}
          onClick={() => setMode('user')}
        >
          👁️ View
        </button>
        <button
          className={mode === 'admin' ? 'active' : ''}
          onClick={() => setMode('admin')}
        >
          ✏️ Edit
        </button>
      </div>
      
      {mode === 'admin' && (
        <>
          <div className="tool-toggle">
            <button
              className={adminTool === 'select' ? 'active' : ''}
              onClick={() => setAdminTool('select')}
            >
              📍 Select
            </button>
            <button
              className={adminTool === 'add' ? 'active' : ''}
              onClick={() => setAdminTool('add')}
            >
              ➕ Add
            </button>
          </div>
          
          <div className="form-group">
            <label>Room Name</label>
            <input
              type="text"
              placeholder="Enter room name..."
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              disabled={!selectedNodeId}
            />
          </div>
          
          <div className="form-group">
            <label>Subtitle (Professor/Lab)</label>
            <input
              type="text"
              placeholder="Enter subtitle..."
              value={editForm.subtitle}
              onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
              disabled={!selectedNodeId}
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Enter description..."
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              disabled={!selectedNodeId}
            />
          </div>
          
          <div className="btn-row">
            <button
              className="btn btn-primary btn-sm"
              disabled={!selectedNodeId}
              onClick={onApplyEdit}
            >
              ✓ Apply
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={!selectedNodeId}
              onClick={onDeleteNode}
            >
              🗑️ Delete
            </button>
          </div>
          
          <button
            className="btn btn-success btn-sm"
            onClick={onSave}
            disabled={isSaving}
            style={{ width: '100%', marginBottom: '8px' }}
          >
            {isSaving ? 'Saving...' : '💾 Publish to Database'}
          </button>
          
          <button
            className="btn btn-primary btn-sm"
            onClick={onExport}
            style={{ width: '100%' }}
          >
            📥 Export JSON Backup
          </button>
        </>
      )}
    </div>
  );
};

export default AdminPanel;