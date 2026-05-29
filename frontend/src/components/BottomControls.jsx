import React from 'react';

const BottomControls = ({ currentFloor, onFloorChange, onZoomIn, onZoomOut }) => {
  return (
    <div className="bottom-controls">
      <select
        className="floor-select"
        value={currentFloor}
        onChange={(e) => onFloorChange(parseInt(e.target.value))}
      >
        <option value={2}>🏢 Second Floor</option>
        <option value={1}>🏢 First Floor</option>
        <option value={0}>🏢 Ground Floor</option>
      </select>
      
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={onZoomIn}>+</button>
        <button className="zoom-btn" onClick={onZoomOut}>−</button>
      </div>
    </div>
  );
};

export default BottomControls;