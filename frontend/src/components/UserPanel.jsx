import React from 'react';

const UserPanel = ({
  startSearch,
  destSearch,
  onStartChange,
  onDestChange,
  onClearRoute,
  namedNodes,
  getSearchLabel
}) => {
  return (
    <div className="search-panel">
      <div className="search-input-group">
        <label>📍 Starting Point</label>
        <input
          type="text"
          list="nodes-list"
          placeholder="Search start location..."
          value={startSearch}
          onChange={(e) => onStartChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      
      <div className="search-input-group">
        <label>🏁 Destination</label>
        <input
          type="text"
          list="nodes-list"
          placeholder="Search destination..."
          value={destSearch}
          onChange={(e) => onDestChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      
      {(startSearch || destSearch) && (
        <button onClick={onClearRoute} className="clear-btn">
          ✕ Clear Route
        </button>
      )}
    </div>
  );
};

export default UserPanel;