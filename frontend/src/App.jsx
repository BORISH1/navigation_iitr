import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { generateId, getDistance, getConnectedFloors, calculateAStar, getEdge } from './utils';

const MAP_IMAGES = {
  0: '/map.svg',        
  1: '/floor1.svg',     
  2: '/floor2.svg'      
};

const SNAP_RADIUS = 20;

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [mode, setMode] = useState('user'); 
  const [currentFloor, setCurrentFloor] = useState(0);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false); 

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [lastNodeId, setLastNodeId] = useState(null);
  const [infoNodeId, setInfoNodeId] = useState(null);
  
  const [startSearch, setStartSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [startNodeId, setStartNodeId] = useState(null);
  const [destNodeId, setDestNodeId] = useState(null);
  const [shortestPath, setShortestPath] = useState([]);

  const [editForm, setEditForm] = useState({ name: '', subtitle: '', description: '' });

  const canvasRef = useRef(null);
  const mapImageRef = useRef(null);
  const wrapperRef = useRef(null);

  // --- 1. FETCH DATA FROM EXPRESS API ON LOAD ---
  useEffect(() => {
    const loadMapData = async () => {
      try {
        const response = await fetch('/api/map');
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
        } else {
          // Fallback if DB is empty
          const fallbackRes = await fetch('/groundfloor.json');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setNodes(fallbackData.nodes || []);
            setEdges(fallbackData.edges || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch from API. Is the Express server running?", err);
      }
    };
    loadMapData();
  }, []);

  // --- 2. SAVE DATA TO EXPRESS API (ADMIN ONLY) ---
  const saveMapToDatabase = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      
      if (response.ok) {
        alert("Success! Map published to Neon PostgreSQL.");
      } else {
        alert("Failed to save. Check terminal logs in the backend.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving map.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportMapData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({nodes, edges}, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "campus_map_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
      setIsAdminLoggedIn(true);
      setShowLoginModal(false);
      setMode('admin');
      setLoginForm({ username: '', password: '' });
      setLoginError('');
    } else {
      setLoginError('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setMode('user');
    setSelectedNodeId(null);
  };

  const triggerRouting = (startId, destId) => {
    if (startId && destId) {
      const path = calculateAStar(startId, destId, nodes, edges);
      if (!path) alert("No route found! Stairs might be disconnected.");
      setShortestPath(path || []);
    } else {
      setShortestPath([]);
    }
  };

  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartSearch(val);
    const matchedNode = nodes.find(n => n.name === val);
    if (matchedNode) {
      setStartNodeId(matchedNode.id);
      triggerRouting(matchedNode.id, destNodeId);
      setCurrentFloor(matchedNode.floor || 0);
    } else {
      setStartNodeId(null);
      setShortestPath([]);
    }
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestSearch(val);
    const matchedNode = nodes.find(n => n.name === val);
    if (matchedNode) {
      setDestNodeId(matchedNode.id);
      triggerRouting(startNodeId, matchedNode.id);
    } else {
      setDestNodeId(null);
      setShortestPath([]);
    }
  };

  const clearRoute = () => {
    setStartSearch('');
    setDestSearch('');
    setStartNodeId(null);
    setDestNodeId(null);
    setShortestPath([]);
  };

  const handleImageLoad = () => {
    if (canvasRef.current && mapImageRef.current) {
      canvasRef.current.width = mapImageRef.current.naturalWidth;
      canvasRef.current.height = mapImageRef.current.naturalHeight;
      drawMap();
    }
  };

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    edges.forEach(e => {
      const n1 = nodes.find(n => n.id === e.n1);
      const n2 = nodes.find(n => n.id === e.n2);
      if (!n1 || !n2) return;

      const f1 = n1.floor || 0;
      const f2 = n2.floor || 0;

      if (f1 === currentFloor && f2 === currentFloor) {
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (f1 === currentFloor || f2 === currentFloor) {
        const visibleNode = f1 === currentFloor ? n1 : n2;
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.arc(visibleNode.x, visibleNode.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    if (shortestPath.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < shortestPath.length; i++) {
        const node = nodes.find(n => n.id === shortestPath[i]);
        if (!node) continue;
        if ((node.floor || 0) === currentFloor) {
          if (i === 0 || (nodes.find(n => n.id === shortestPath[i - 1])?.floor || 0) !== currentFloor) {
            ctx.moveTo(node.x, node.y);
          } else {
            ctx.lineTo(node.x, node.y);
          }
        }
      }
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      for (let i = 0; i < shortestPath.length - 1; i++) {
        const n1 = nodes.find(n => n.id === shortestPath[i]);
        const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
        if (!n1 || !n2) continue;

        if ((n1.floor || 0) === currentFloor && (n2.floor || 0) === currentFloor) {
          const headlen = 16; 
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const angle = Math.atan2(dy, dx);
          const midX = n1.x + dx / 2;
          const midY = n1.y + dy / 2;

          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX - headlen * Math.cos(angle - Math.PI / 6), midY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX - headlen * Math.cos(angle + Math.PI / 6), midY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.strokeStyle = '#FFFFFF'; 
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      }
    }

    const activeNodes = nodes.filter(n => (n.floor || 0) === currentFloor);
    activeNodes.forEach(n => {
      ctx.beginPath();
      let radius = n.name ? 10 : 8;
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);

      let fillStyle = '#3B82F6'; 
      if (n.name) fillStyle = '#10B981'; 
      if (mode === 'admin' && lastNodeId && lastNodeId !== n.id) fillStyle = '#8B5CF6'; 
      if (n.id === startNodeId || n.id === destNodeId) fillStyle = '#F59E0B'; 
      if (n.id === selectedNodeId) fillStyle = '#EF4444'; 

      ctx.fillStyle = fillStyle;
      ctx.fill();

      if (n.id === hoverNodeId) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (n.name) {
        ctx.font = "bold 14px Inter, sans-serif";
        const textWidth = ctx.measureText(n.name).width;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath();
        ctx.roundRect(n.x + 12, n.y - 24, textWidth + 12, 24, 6);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.fillText(n.name, n.x + 18, n.y - 7);
      }
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawMap(); }, [nodes, edges, currentFloor, hoverNodeId, selectedNodeId, shortestPath, mode]);

  const getMousePos = (e) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const handlePointerDown = (e) => {
    if (e.button === 2 || e.type === 'touchstart') {
      setIsPanning(true);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragStart.current = { x: clientX - pan.x, y: clientY - pan.y };
    }
  };

  const handlePointerMove = (e) => {
    if (isPanning) {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPan({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
      return;
    }
    const pos = getMousePos(e);
    let closest = null;
    let minDist = SNAP_RADIUS;
    
    nodes.filter(n => (n.floor || 0) === currentFloor).forEach(node => {
      let dist = Math.hypot(pos.x - node.x, pos.y - node.y);
      if (dist < minDist) { minDist = dist; closest = node; }
    });
    setHoverNodeId(closest ? closest.id : null);
  };

  const handlePointerUp = (e) => {
    if (isPanning) { setIsPanning(false); return; }
    
    const pos = getMousePos(e);
    
    if (mode === 'admin') {
      let clickedNodeId = hoverNodeId;
      let newNodes = [...nodes];
      let newEdges = [...edges];

      if (!clickedNodeId) {
        const newNode = { id: generateId(), x: pos.x, y: pos.y, floor: currentFloor, name: '', subtitle: '', description: '' };
        newNodes.push(newNode);
        clickedNodeId = newNode.id;
        setNodes(newNodes);
      }

      if (lastNodeId && lastNodeId !== clickedNodeId) {
        const existingEdge = getEdge(lastNodeId, clickedNodeId, newEdges);
        if (!existingEdge) {
          const n1 = newNodes.find(n => n.id === lastNodeId);
          const n2 = newNodes.find(n => n.id === clickedNodeId);
          newEdges.push({ n1: lastNodeId, n2: clickedNodeId, weight: getDistance(n1, n2) });
          setEdges(newEdges);
        }
      }

      setSelectedNodeId(clickedNodeId);
      setLastNodeId(clickedNodeId);

      const nodeData = newNodes.find(n => n.id === clickedNodeId);
      setEditForm({ name: nodeData.name || '', subtitle: nodeData.subtitle || '', description: nodeData.description || '' });
      
    } else if (mode === 'user') {
      if (hoverNodeId) {
        const clickedNode = nodes.find(n => n.id === hoverNodeId);
        setInfoNodeId(clickedNode.id);
      } else {
        setInfoNodeId(null);
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) newZoom *= zoomFactor; else newZoom /= zoomFactor;
    newZoom = Math.max(0.1, Math.min(10, newZoom));

    const rect = wrapperRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
    });
    setZoom(newZoom);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (wrapper) wrapper.removeEventListener('wheel', handleWheel); };
  }, [zoom, pan]);

  const namedNodes = nodes.filter(n => n.name);
  const infoNode = infoNodeId ? nodes.find(n => n.id === infoNodeId) : null;
  const connectedFloors = infoNodeId ? getConnectedFloors(infoNodeId, nodes, edges) : [];

  return (
    <div className="app-container flex-col">
      <header className="top-nav">
        <h2>Campus Map</h2>
        <div className="nav-controls">
          <select className="floor-select-mini" value={currentFloor} onChange={(e) => setCurrentFloor(parseInt(e.target.value, 10))}>
            <option value={0}>Ground Floor</option>
            <option value={1}>First Floor</option>
            <option value={2}>Second Floor</option>
          </select>
          {isAdminLoggedIn ? (
            <button className="danger btn-small" onClick={handleLogout}>Exit Admin</button>
          ) : (
            <button className="primary btn-small" onClick={() => setShowLoginModal(true)}>Admin</button>
          )}
        </div>
      </header>

      <div className="top-search-panel">
        {isAdminLoggedIn ? (
          <div className="admin-toolbar">
            <div className="mode-toggle">
              <button className={mode === 'user' ? 'active' : ''} onClick={() => { setMode('user'); setSelectedNodeId(null); }}>View Mode</button>
              <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Edit Mode</button>
            </div>
            {mode === 'admin' && (
              <div className="admin-edit-row">
                <input type="text" placeholder="Room Name..." value={editForm.name} 
                       onChange={e => setEditForm({...editForm, name: e.target.value})} disabled={!selectedNodeId} />
                <input type="text" placeholder="Professor/Lab..." value={editForm.subtitle} 
                       onChange={e => setEditForm({...editForm, subtitle: e.target.value})} disabled={!selectedNodeId} />
                
                <button className="primary btn-small" disabled={!selectedNodeId} onClick={() => {
                  setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, ...editForm } : n));
                }}>Apply Edit</button>
                <button className="danger btn-small" disabled={!selectedNodeId} onClick={() => {
                  setNodes(nodes.filter(n => n.id !== selectedNodeId));
                  setEdges(edges.filter(e => e.n1 !== selectedNodeId && e.n2 !== selectedNodeId));
                  setSelectedNodeId(null); setLastNodeId(null);
                }}>Delete</button>
                
                <button 
                  className="primary btn-small" 
                  onClick={saveMapToDatabase} 
                  disabled={isSaving}
                  style={{backgroundColor: '#10B981', minWidth: '150px'}}
                >
                  {isSaving ? "Saving..." : "Publish to DB"}
                </button>
                <button className="primary btn-small" onClick={exportMapData}>Export JSON</button>
              </div>
            )}
          </div>
        ) : (
          <div className="search-bar-container">
            <div className="search-inputs">
              <input type="text" list="nodes-list" placeholder="Start Location..." value={startSearch} onChange={handleStartChange} />
              <input type="text" list="nodes-list" placeholder="Destination..." value={destSearch} onChange={handleDestChange} />
            </div>
            <button className="clear-btn" onClick={clearRoute}>&times;</button>
          </div>
        )}
      </div>

      <datalist id="nodes-list">
        {namedNodes.map(n => <option key={n.id} value={n.name} />)}
      </datalist>

      {showLoginModal && (
        <div className="modal-overlay">
          <form className="modal-form" onSubmit={handleLoginSubmit}>
            <h2>Admin Login</h2>
            {loginError && <span className="error-text">{loginError}</span>}
            <input type="text" placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required />
            <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
            <div className="modal-actions">
              <button type="submit" className="primary">Login</button>
              <button type="button" onClick={() => setShowLoginModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {mode === 'user' && infoNode && (
        <div className="room-info-card">
          <button className="close-btn" onClick={() => setInfoNodeId(null)}>&times;</button>
          <h2>{infoNode.name || "Pathway / Stairs"}</h2>
          {infoNode.subtitle && <h4>{infoNode.subtitle}</h4>}
          
          <div className="info-actions">
            {connectedFloors.length > 0 && connectedFloors.map(f => (
                <button key={f} className="teleport-btn" onClick={() => { setCurrentFloor(f); setInfoNodeId(null); }}>
                  Go to Floor {f}
                </button>
            ))}
            
            {connectedFloors.length === 0 && (
              <>
                <button className="primary" onClick={() => {
                  setStartSearch(infoNode.name); setStartNodeId(infoNode.id);
                  triggerRouting(infoNode.id, destNodeId); setInfoNodeId(null);
                }}>Set Start</button>
                <button className="primary" onClick={() => {
                  setDestSearch(infoNode.name); setDestNodeId(infoNode.id);
                  triggerRouting(startNodeId, infoNode.id); setInfoNodeId(null);
                }}>Set Destination</button>
              </>
            )}
          </div>
        </div>
      )}

      <div 
        className="map-wrapper flex-1" 
        ref={wrapperRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="map-content" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <img ref={mapImageRef} id="map-image" src={MAP_IMAGES[currentFloor]} alt="Floor Plan" onLoad={handleImageLoad} />
          <canvas ref={canvasRef} id="map-canvas" />
        </div>
      </div>

      <div className="zoom-controls">
        <button onClick={() => setZoom(z => Math.min(10, z * 1.25))}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.25))}>-</button>
        <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} style={{fontSize: '1rem'}}>1:1</button>
      </div>
    </div>
  );
}

export default App;