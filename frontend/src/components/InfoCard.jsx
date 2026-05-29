import React from 'react';

const InfoCard = ({ node, connectedFloors, onFloorChange, onSetStart, onSetDest, onClose }) => {
  return (
    <div className="info-card">
      <button className="close-btn" onClick={onClose}>&times;</button>
      
      <h2>{node.name || 'Pathway / Stairs'}</h2>
      {node.subtitle && <h4>{node.subtitle}</h4>}
      {node.description && (
        <p style={{ color: '#9CA3AF', marginBottom: '16px', fontSize: '0.9rem' }}>
          {node.description}
        </p>
      )}
      
      <div className="info-actions">
        {connectedFloors.length > 0 ? (
          connectedFloors.map(floor => (
            <button
              key={floor}
              className="teleport-btn"
              onClick={() => onFloorChange(floor)}
            >
              🪜 Floor {floor}
            </button>
          ))
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={onSetStart}>
              📍 Set Start
            </button>
            <button className="btn btn-primary btn-sm" onClick={onSetDest}>
              🏁 Set Dest
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InfoCard;