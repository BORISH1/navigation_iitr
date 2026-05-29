import React from 'react';

const DirectionsPanel = ({ directions, onFloorChange }) => {
  if (!directions.length) return null;

  return (
    <div className="directions-panel">
      <h4>📍 Route Directions</h4>
      <div className="directions-list">
        {directions.map((step) => (
          <div
            key={step.id}
            className={`direction-step ${step.type}`}
            onClick={() => {
              if (step.type === 'floor-change' && step.actionFloor !== undefined) {
                onFloorChange(step.actionFloor);
              }
            }}
          >
            {step.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DirectionsPanel;