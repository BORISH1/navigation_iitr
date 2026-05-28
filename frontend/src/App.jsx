import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { generateId, getDistance, getConnectedFloors, calculateAStar, getEdge } from './utils';

const MAP_IMAGES = {
  0: '/map.svg',        
  1: '/floor1.svg',     
  2: '/floor2.svg'      
};

const SNAP_RADIUS = 20;

// HELPER: Format names for the smart search dropdown
const getSearchLabel = (node) => {
  if (!node.name) return null;
  return node.subtitle ? `${node.name} (${node.subtitle})` : node.name;
};

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [mode, setMode] = useState('user'); 
  const [adminTool, setAdminTool] = useState('select'); 
  const [currentFloor, setCurrentFloor] = useState(0);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false); 

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const pinchDistRef = useRef(null);
  const pinchZoomRef = useRef(null);

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

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const loadMapData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/map`);
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
        } else {
          const fallbackRes = await fetch('/groundfloor.json');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setNodes(fallbackData.nodes || []);
            setEdges(fallbackData.edges || []);
          }
        }
      } catch (err) {
        console.error("API error", err);
      }
    };
    loadMapData();
  }, []);

  // --- 2. SAVE DATA ---
  const saveMapToDatabase = async () => {
    setIsSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (response.ok) alert("Success! Map published.");
      else alert("Failed to save.");
    } catch (err) {
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
      if (!path) alert("No route found! Ensure stairs are connected.");
      setShortestPath(path || []);
    } else {
      setShortestPath([]);
    }
  };

  // SMART SEARCH 
  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartSearch(val);
    const matchedNode = nodes.find(n => getSearchLabel(n) === val || n.name === val);
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
    const matchedNode = nodes.find(n => getSearchLabel(n) === val || n.name === val);
    if (matchedNode) {
      setDestNodeId(matchedNode.id);
      triggerRouting(startNodeId, matchedNode.id);
    } else {
      setDestNodeId(null);
      setShortestPath([]);
    }
  };

  const clearRoute = () => {
    setStartSearch(''); setDestSearch(''); setStartNodeId(null); setDestNodeId(null); setShortestPath([]);
  };

  const generateDirections = () => {
    const steps = [];
    if (shortestPath.length > 1) {
      const startNode = nodes.find(n => n.id === shortestPath[0]);
      steps.push({ id: 'start', text: `📍 Start at ${startNode?.name || 'Location'}` });

      for (let i = 0; i < shortestPath.length - 1; i++) {
        const n1 = nodes.find(n => n.id === shortestPath[i]);
        const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
        if (!n1 || !n2) continue;

        if ((n1.floor || 0) !== (n2.floor || 0)) {
          steps.push({ id: `stair-${i}`, text: `🪜 Take stairs to Floor ${n2.floor || 0}`, actionFloor: n2.floor || 0 });
        }
      }
      const destNode = nodes.find(n => n.id === shortestPath[shortestPath.length - 1]);
      steps.push({ id: 'end', text: `🏁 Arrive at ${destNode?.name || 'Destination'}` });
    }
    return steps;
  };

  const pathInstructions = generateDirections();

  // --- 3. OPTIMIZED SVG & CANVAS RENDERING ---
  const handleImageLoad = (e) => {
    const img = e.target;
    if (canvasRef.current && img) {
      // SVGs sometimes lack natural width. We fall back to client bounds if needed.
      const width = img.naturalWidth || img.clientWidth || 1000;
      const height = img.naturalHeight || img.clientHeight || 1000;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      drawMap();
    }
  };

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Edges
    edges.forEach(e => {
      const n1 = nodes.find(n => n.id === e.n1);
      const n2 = nodes.find(n => n.id === e.n2);
      if (!n1 || !n2) return;

      const f1 = n1.floor || 0;
      const f2 = n2.floor || 0;

      if (f1 === currentFloor && f2 === currentFloor) {
        ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; ctx.lineWidth = 3; ctx.stroke();
      }
    });

    // 2. Draw Shortest Path
    if (shortestPath.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < shortestPath.length; i++) {
        const node = nodes.find(n => n.id === shortestPath[i]);
        if (!node) continue;
        if ((node.floor || 0) === currentFloor) {
          if (i === 0 || (nodes.find(n => n.id === shortestPath[i - 1])?.floor || 0) !== currentFloor) {
            ctx.moveTo(node.x, node.y);
          } else { ctx.lineTo(node.x, node.y); }
        }
      }
      ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

      // Draw Path Direction Arrows
      for (let i = 0; i < shortestPath.length - 1; i++) {
        const n1 = nodes.find(n => n.id === shortestPath[i]);
        const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
        if (!n1 || !n2) continue;

        if ((n1.floor || 0) === currentFloor && (n2.floor || 0) === currentFloor) {
          const headlen = 16; 
          const dx = n2.x - n1.x; const dy = n2.y - n1.y;
          const angle = Math.atan2(dy, dx);
          const midX = n1.x + dx / 2; const midY = n1.y + dy / 2;

          ctx.beginPath();
          ctx.moveTo(midX, midY); ctx.lineTo(midX - headlen * Math.cos(angle - Math.PI / 6), midY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(midX, midY); ctx.lineTo(midX - headlen * Math.cos(angle + Math.PI / 6), midY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke();
        }
      }

      // NEW: Visual Cross-Floor "Stairs" Markers on the Canvas
      for (let i = 0; i < shortestPath.length - 1; i++) {
        const n1 = nodes.find(n => n.id === shortestPath[i]);
        const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
        if (!n1 || !n2) continue;

        if ((n1.floor || 0) !== (n2.floor || 0)) {
          // Find which node is on the floor the user is currently looking at
          const visibleNode = (n1.floor || 0) === currentFloor ? n1 : ((n2.floor || 0) === currentFloor ? n2 : null);
          const targetFloor = (n1.floor || 0) === currentFloor ? (n2.floor || 0) : ((n2.floor || 0) === currentFloor ? (n1.floor || 0) : null);

          if (visibleNode && targetFloor !== null) {
            // Draw Glowing Ring
            ctx.beginPath();
            ctx.arc(visibleNode.x, visibleNode.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(visibleNode.x, visibleNode.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Draw Text Badge
            const badgeText = targetFloor > currentFloor ? `⬆ To Floor ${targetFloor}` : `⬇ To Floor ${targetFloor}`;
            ctx.font = "bold 14px Inter, sans-serif";
            const textWidth = ctx.measureText(badgeText).width;
            
            ctx.fillStyle = "#111827"; // Dark Background
            ctx.beginPath();
            ctx.roundRect(visibleNode.x + 20, visibleNode.y - 30, textWidth + 20, 26, 6);
            ctx.fill();
            
            ctx.fillStyle = "#F59E0B"; // Orange Text
            ctx.fillText(badgeText, visibleNode.x + 30, visibleNode.y - 12);
          }
        }
      }
    }

    // 3. Draw Nodes
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

      ctx.fillStyle = fillStyle; ctx.fill();

      if (n.id === hoverNodeId) {
        ctx.beginPath(); ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
      }

      if (n.name) {
        ctx.font = "bold 14px Inter, sans-serif";
        const textWidth = ctx.measureText(n.name).width;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath(); ctx.roundRect(n.x + 12, n.y - 24, textWidth + 12, 24, 6); ctx.fill();
        ctx.fillStyle = "white"; ctx.fillText(n.name, n.x + 18, n.y - 7);
      }
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawMap(); }, [nodes, edges, currentFloor, hoverNodeId, selectedNodeId, shortestPath, mode, adminTool]);

  const getMousePos = (e) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  };

  // --- 4. MAP INTERACTION LOGIC ---
  const handlePointerDown = (e) => {
    if (e.touches && e.touches.length === 2) {
      pinchDistRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchZoomRef.current = zoom;
      return;
    }
    if (e.button === 1 || e.button === 2 || e.type === 'touchstart' || mode === 'user' || (mode === 'admin' && adminTool === 'select')) {
      setIsPanning(true);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragStart.current = { x: clientX - pan.x, y: clientY - pan.y };
    }
  };

  const handlePointerMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = dist / pinchDistRef.current;
      setZoom(Math.max(0.1, Math.min(pinchZoomRef.current * scale, 10)));
      return;
    }
    if (isPanning) {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPan({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
      return;
    }
    const pos = getMousePos(e);
    let closest = null; let minDist = SNAP_RADIUS;
    nodes.filter(n => (n.floor || 0) === currentFloor).forEach(node => {
      let dist = Math.hypot(pos.x - node.x, pos.y - node.y);
      if (dist < minDist) { minDist = dist; closest = node; }
    });
    setHoverNodeId(closest ? closest.id : null);
  };

  const handlePointerUp = (e) => {
    if (isPanning) { setIsPanning(false); return; }
    if (e.touches && e.touches.length > 0) return; 
    
    const pos = getMousePos(e);
    if (mode === 'admin') {
      if (adminTool === 'add') {
        if (!hoverNodeId) {
          const newNode = { id: generateId(), x: pos.x, y: pos.y, floor: currentFloor, name: '', subtitle: '', description: '' };
          setNodes([...nodes, newNode]);
          if (lastNodeId) setEdges([...edges, { n1: lastNodeId, n2: newNode.id, weight: getDistance(nodes.find(n => n.id === lastNodeId) || newNode, newNode) }]);
          setSelectedNodeId(newNode.id); setLastNodeId(newNode.id);
          setEditForm({ name: '', subtitle: '', description: '' });
        } else {
          if (lastNodeId && lastNodeId !== hoverNodeId) {
            const existingEdge = getEdge(lastNodeId, hoverNodeId, edges);
            if (!existingEdge) {
              const n1 = nodes.find(n => n.id === lastNodeId); const n2 = nodes.find(n => n.id === hoverNodeId);
              setEdges([...edges, { n1: lastNodeId, n2: hoverNodeId, weight: getDistance(n1, n2) }]);
            }
          }
          setSelectedNodeId(hoverNodeId); setLastNodeId(hoverNodeId);
        }
      } else if (adminTool === 'select') {
        if (hoverNodeId) {
          setSelectedNodeId(hoverNodeId); setLastNodeId(hoverNodeId);
          const nodeData = nodes.find(n => n.id === hoverNodeId);
          setEditForm({ name: nodeData.name || '', subtitle: nodeData.subtitle || '', description: nodeData.description || '' });
        } else {
          setSelectedNodeId(null); setLastNodeId(null);
        }
      }
    } else if (mode === 'user') {
      if (hoverNodeId) {
        const connectedFloors = getConnectedFloors(hoverNodeId, nodes, edges);
        if (connectedFloors.length > 0 && shortestPath.length > 0) {
          const pathIdx = shortestPath.indexOf(hoverNodeId);
          if (pathIdx !== -1 && pathIdx + 1 < shortestPath.length) {
            const nextNode = nodes.find(n => n.id === shortestPath[pathIdx + 1]);
            if (nextNode && nextNode.floor !== currentFloor) {
               setCurrentFloor(nextNode.floor || 0); setInfoNodeId(null); return; 
            }
          }
        }
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

  // Stops events from the UI from interacting with the map behind it
  const stopPropagation = (e) => e.stopPropagation();

  const namedNodes = nodes.filter(n => n.name);
  const infoNode = infoNodeId ? nodes.find(n => n.id === infoNodeId) : null;
  const connectedFloors = infoNodeId ? getConnectedFloors(infoNodeId, nodes, edges) : [];

  return (
    <div className="app-container relative-layout">
      
      {/* 1. MAP WORKSPACE */}
      <div 
        className="map-wrapper" 
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

      {/* 2. OVERLAY UI */}
      <div className="overlay-branding" onWheel={stopPropagation} onTouchMove={stopPropagation}>
        <h2>Campus Navigator</h2>
        {isAdminLoggedIn ? (
          <button className="danger btn-small" onClick={handleLogout}>Exit Admin</button>
        ) : (
          <button className="primary btn-small" onClick={() => setShowLoginModal(true)}>Admin</button>
        )}
      </div>

      <div className="overlay-tools" onWheel={stopPropagation} onTouchMove={stopPropagation} onMouseDown={stopPropagation}>
        {isAdminLoggedIn ? (
          <div className="admin-panel">
            <h3>Admin Tools</h3>
            <div className="mode-toggle">
              <button className={mode === 'user' ? 'active' : ''} onClick={() => { setMode('user'); setSelectedNodeId(null); }}>View Mode</button>
              <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Edit Mode</button>
            </div>
            
            {mode === 'admin' && (
              <>
                <div className="mode-toggle" style={{marginTop: '10px', backgroundColor: '#374151'}}>
                  <button className={adminTool === 'select' ? 'active' : ''} onClick={() => setAdminTool('select')}>📍 Select Node</button>
                  <button className={adminTool === 'add' ? 'active' : ''} onClick={() => setAdminTool('add')}>➕ Add Node</button>
                </div>

                <div className="admin-form" style={{marginTop: '10px'}}>
                  <input type="text" placeholder="Room Name..." value={editForm.name} 
                         onChange={e => setEditForm({...editForm, name: e.target.value})} disabled={!selectedNodeId} />
                  <input type="text" placeholder="Professor/Lab..." value={editForm.subtitle} 
                         onChange={e => setEditForm({...editForm, subtitle: e.target.value})} disabled={!selectedNodeId} />
                  
                  <div className="btn-row">
                    <button className="primary btn-small" disabled={!selectedNodeId} onClick={() => {
                      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, ...editForm } : n));
                    }}>Apply Edit</button>
                    <button className="danger btn-small" disabled={!selectedNodeId} onClick={() => {
                      setNodes(nodes.filter(n => n.id !== selectedNodeId));
                      setEdges(edges.filter(e => e.n1 !== selectedNodeId && e.n2 !== selectedNodeId));
                      setSelectedNodeId(null); setLastNodeId(null);
                    }}>Delete</button>
                  </div>
                  
                  <button className="primary btn-small" onClick={saveMapToDatabase} disabled={isSaving} style={{backgroundColor: '#10B981', marginTop: '5px'}}>
                    {isSaving ? "Saving..." : "Publish to DB"}
                  </button>
                  <button className="primary btn-small" onClick={exportMapData}>Export JSON Backup</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="search-panel">
              <div className="search-inputs">
                <input type="text" list="nodes-list" placeholder="Start Location..." value={startSearch} onChange={handleStartChange} />
                <input type="text" list="nodes-list" placeholder="Destination..." value={destSearch} onChange={handleDestChange} />
              </div>
              {(startSearch || destSearch) && <button className="clear-btn" onClick={clearRoute}>Clear Route</button>}
            </div>

            {/* TEXT DIRECTIONS PANEL */}
            {pathInstructions.length > 0 && (
              <div className="directions-panel" style={{ 
                background: 'var(--bg-panel)', padding: '15px', borderRadius: '12px', 
                marginTop: '10px', border: '1px solid var(--border)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                maxHeight: '250px', display: 'flex', flexDirection: 'column'
              }}>
                <h4 style={{ color: 'white', marginBottom: '10px', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '5px' }}>Route Directions</h4>
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                  {pathInstructions.map((step) => (
                    <div 
                      key={step.id} 
                      onClick={() => step.actionFloor !== undefined && setCurrentFloor(step.actionFloor)}
                      style={{ 
                        color: step.actionFloor !== undefined ? 'var(--path-color)' : 'white', 
                        fontSize: '0.9rem', padding: '8px 12px', 
                        background: step.actionFloor !== undefined ? 'rgba(245, 158, 11, 0.15)' : '#374151', 
                        borderRadius: '8px', 
                        borderLeft: `3px solid ${step.actionFloor !== undefined ? 'var(--path-color)' : 'var(--primary)'}`,
                        cursor: step.actionFloor !== undefined ? 'pointer' : 'default',
                        fontWeight: step.actionFloor !== undefined ? '600' : 'normal',
                        transition: 'all 0.2s'
                      }}
                    >
                      {step.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <datalist id="nodes-list">
        {namedNodes.map(n => <option key={n.id} value={getSearchLabel(n)} />)}
      </datalist>

      {/* Floating Bottom Right Controls */}
      <div className="overlay-bottom-right" onWheel={stopPropagation} onTouchMove={stopPropagation}>
        <select className="floor-select" value={currentFloor} onChange={(e) => setCurrentFloor(parseInt(e.target.value, 10))}>
          <option value={2}>Second Floor</option>
          <option value={1}>First Floor</option>
          <option value={0}>Ground Floor</option>
        </select>

        <div className="zoom-btns">
          <button onClick={() => {
            setZoom(z => Math.min(10, z * 1.25));
            const rect = wrapperRef.current.getBoundingClientRect();
            setPan(p => ({ x: p.x - (rect.width/2 - p.x)*0.25, y: p.y - (rect.height/2 - p.y)*0.25 }));
          }}>+</button>
          <button onClick={() => {
             setZoom(z => Math.max(0.1, z / 1.25));
             const rect = wrapperRef.current.getBoundingClientRect();
             setPan(p => ({ x: p.x + (rect.width/2 - p.x)*0.2, y: p.y + (rect.height/2 - p.y)*0.2 }));
          }}>-</button>
        </div>
      </div>

      {/* Popups & Modals */}
      {showLoginModal && (
        <div className="modal-overlay" onWheel={stopPropagation} onTouchMove={stopPropagation}>
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
        <div className="room-info-card" onWheel={stopPropagation} onTouchMove={stopPropagation} onMouseDown={stopPropagation}>
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
                  setStartSearch(getSearchLabel(infoNode)); setStartNodeId(infoNode.id);
                  triggerRouting(infoNode.id, destNodeId); setInfoNodeId(null);
                }}>Set Start</button>
                <button className="primary" onClick={() => {
                  setDestSearch(getSearchLabel(infoNode)); setDestNodeId(infoNode.id);
                  triggerRouting(startNodeId, infoNode.id); setInfoNodeId(null);
                }}>Set Destination</button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;