import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { 
  generateId, 
  getDistance, 
  getConnectedFloors, 
  calculateAStar, 
  getEdge 
} from './utils';

// Import components
import MapView from './components/MapView';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import LoginModal from './components/LoginModal';
import BottomControls from './components/BottomControls';
import InfoCard from './components/InfoCard';
import DirectionsPanel from './components/DirectionsPanel';

const MAP_IMAGES = {
  0: '/map.svg',
  1: '/floor1.svg',
  2: '/floor2.svg'
};

const SNAP_RADIUS = 20;

const getSearchLabel = (node) => {
  if (!node.name) return null;
  return node.subtitle ? `${node.name} (${node.subtitle})` : node.name;
};

function App() {
  // Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // App State
  const [mode, setMode] = useState('user');
  const [adminTool, setAdminTool] = useState('select');
  const [currentFloor, setCurrentFloor] = useState(0);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map Interaction State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  // Node State
  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [lastNodeId, setLastNodeId] = useState(null);
  const [infoNodeId, setInfoNodeId] = useState(null);
  
  // Search & Route State
  const [startSearch, setStartSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [startNodeId, setStartNodeId] = useState(null);
  const [destNodeId, setDestNodeId] = useState(null);
  const [shortestPath, setShortestPath] = useState([]);
  
  // Admin Form State
  const [editForm, setEditForm] = useState({ 
    name: '', 
    subtitle: '', 
    description: '' 
  });

  // Mobile panel state
  const [panelState, setPanelState] = useState('collapsed'); // 'collapsed', 'expanded', 'maximized'
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);

  // Refs
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef(null);
  const pinchZoomRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const panelStartY = useRef(0);
  const panelStartHeight = useRef(0);
  const isMobile = useRef(window.innerWidth <= 768);

  // Fetch map data
  useEffect(() => {
    const loadMapData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/map`);
        
        if (!response.ok) throw new Error('Failed to fetch map data');
        
        const data = await response.json();
        
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
        } else {
          // Fallback to local JSON
          const fallbackRes = await fetch('/groundfloor.json');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setNodes(fallbackData.nodes || []);
            setEdges(fallbackData.edges || []);
          }
        }
      } catch (err) {
        console.error("Error loading map data:", err);
        setError("Failed to load map data. Using offline mode.");
        
        // Try local fallback
        try {
          const fallbackRes = await fetch('/groundfloor.json');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setNodes(fallbackData.nodes || []);
            setEdges(fallbackData.edges || []);
          }
        } catch (fallbackErr) {
          console.error("Fallback also failed:", fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadMapData();
  }, []);

  // Check if mobile on resize
  useEffect(() => {
    const handleResize = () => {
      isMobile.current = window.innerWidth <= 768;
      if (!isMobile.current) {
        setPanelState('expanded');
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Panel drag handlers
  const handlePanelDragStart = useCallback((e) => {
    if (!isMobile.current) return;
    
    setIsDraggingPanel(true);
    const touch = e.touches ? e.touches[0] : e;
    panelStartY.current = touch.clientY;
    
    const panel = document.querySelector('.main-panel');
    if (panel) {
      panelStartHeight.current = panel.getBoundingClientRect().height;
    }
  }, []);

  const handlePanelDragMove = useCallback((e) => {
    if (!isDraggingPanel || !isMobile.current) return;
    
    const touch = e.touches ? e.touches[0] : e;
    const deltaY = panelStartY.current - touch.clientY;
    const newHeight = panelStartHeight.current + deltaY;
    
    const minHeight = 80;
    const maxHeight = window.innerHeight - 80;
    
    if (newHeight < minHeight) {
      setPanelState('collapsed');
    } else if (newHeight > maxHeight * 0.8) {
      setPanelState('maximized');
    } else {
      setPanelState('expanded');
    }
  }, [isDraggingPanel]);

  const handlePanelDragEnd = useCallback(() => {
    setIsDraggingPanel(false);
  }, []);

  const togglePanel = useCallback(() => {
    if (!isMobile.current) return;
    
    setPanelState(prev => {
      if (prev === 'collapsed') return 'expanded';
      if (prev === 'expanded') return 'maximized';
      return 'collapsed';
    });
  }, []);

  // Auto-collapse panel when route is found
  useEffect(() => {
    if (isMobile.current && shortestPath.length > 0) {
      setPanelState('collapsed');
    }
  }, [shortestPath]);

  // Save map to database
  const saveMapToDatabase = useCallback(async () => {
    setIsSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      
      if (!response.ok) throw new Error('Save failed');
      
      alert("Map data saved successfully!");
    } catch (err) {
      alert("Error saving map. Please try again.");
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges]);

  // Export map data
  const exportMapData = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + 
      encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "campus_map_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [nodes, edges]);

  // Login handler
  const handleLogin = useCallback((username, password) => {
    if (username === 'admin' && password === 'admin123') {
      setIsAdminLoggedIn(true);
      setShowLoginModal(false);
      setMode('admin');
      return true;
    }
    return false;
  }, []);

  // Logout handler
  const handleLogout = useCallback(() => {
    setIsAdminLoggedIn(false);
    setMode('user');
    setSelectedNodeId(null);
    setAdminTool('select');
  }, []);

  // Route calculation
  const triggerRouting = useCallback((startId, destId) => {
    if (startId && destId) {
      const path = calculateAStar(startId, destId, nodes, edges);
      setShortestPath(path || []);
      
      if (!path) {
        alert("No route found! Make sure stairs/elevators are properly connected.");
      }
    } else {
      setShortestPath([]);
    }
  }, [nodes, edges]);

  // Search handlers
  const handleStartChange = useCallback((value) => {
    setStartSearch(value);
    const matchedNode = nodes.find(
      n => getSearchLabel(n) === value || n.name === value
    );
    
    if (matchedNode) {
      setStartNodeId(matchedNode.id);
      triggerRouting(matchedNode.id, destNodeId);
      setCurrentFloor(matchedNode.floor || 0);
    } else {
      setStartNodeId(null);
      setShortestPath([]);
    }
  }, [nodes, destNodeId, triggerRouting]);

  const handleDestChange = useCallback((value) => {
    setDestSearch(value);
    const matchedNode = nodes.find(
      n => getSearchLabel(n) === value || n.name === value
    );
    
    if (matchedNode) {
      setDestNodeId(matchedNode.id);
      triggerRouting(startNodeId, matchedNode.id);
    } else {
      setDestNodeId(null);
      setShortestPath([]);
    }
  }, [nodes, startNodeId, triggerRouting]);

  const clearRoute = useCallback(() => {
    setStartSearch('');
    setDestSearch('');
    setStartNodeId(null);
    setDestNodeId(null);
    setShortestPath([]);
  }, []);

  // Admin node operations
  const handleNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setLastNodeId(nodeId);
    
    if (nodeId) {
      const nodeData = nodes.find(n => n.id === nodeId);
      if (nodeData) {
        setEditForm({
          name: nodeData.name || '',
          subtitle: nodeData.subtitle || '',
          description: nodeData.description || ''
        });
      }
    }
  }, [nodes]);

  const handleAddNode = useCallback((position) => {
    const newNode = {
      id: generateId(),
      x: position.x,
      y: position.y,
      floor: currentFloor,
      name: '',
      subtitle: '',
      description: ''
    };
    
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    
    if (lastNodeId) {
      const lastNode = nodes.find(n => n.id === lastNodeId);
      if (lastNode) {
        const newEdge = {
          n1: lastNodeId,
          n2: newNode.id,
          weight: getDistance(lastNode, newNode)
        };
        setEdges([...edges, newEdge]);
      }
    }
    
    setSelectedNodeId(newNode.id);
    setLastNodeId(newNode.id);
    setEditForm({ name: '', subtitle: '', description: '' });
    
    return newNode;
  }, [nodes, edges, lastNodeId, currentFloor]);

  const handleAddEdge = useCallback((nodeId1, nodeId2) => {
    const existingEdge = getEdge(nodeId1, nodeId2, edges);
    if (!existingEdge) {
      const n1 = nodes.find(n => n.id === nodeId1);
      const n2 = nodes.find(n => n.id === nodeId2);
      if (n1 && n2) {
        const newEdge = {
          n1: nodeId1,
          n2: nodeId2,
          weight: getDistance(n1, n2)
        };
        setEdges([...edges, newEdge]);
      }
    }
  }, [nodes, edges]);

  const handleApplyEdit = useCallback(() => {
    if (!selectedNodeId) return;
    
    setNodes(nodes.map(node => 
      node.id === selectedNodeId 
        ? { ...node, ...editForm }
        : node
    ));
  }, [selectedNodeId, editForm, nodes]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    
    setNodes(nodes.filter(node => node.id !== selectedNodeId));
    setEdges(edges.filter(edge => 
      edge.n1 !== selectedNodeId && edge.n2 !== selectedNodeId
    ));
    setSelectedNodeId(null);
    setLastNodeId(null);
  }, [selectedNodeId, nodes, edges]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = Math.min(10, prevZoom * 1.25);
      const wrapper = mapWrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        setPan(prevPan => ({
          x: prevPan.x - (rect.width / 2 - prevPan.x) * 0.25,
          y: prevPan.y - (rect.height / 2 - prevPan.y) * 0.25
        }));
      }
      return newZoom;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = Math.max(0.1, prevZoom / 1.25);
      const wrapper = mapWrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        setPan(prevPan => ({
          x: prevPan.x + (rect.width / 2 - prevPan.x) * 0.2,
          y: prevPan.y + (rect.height / 2 - prevPan.y) * 0.2
        }));
      }
      return newZoom;
    });
  }, []);

  // Directions generator
  const generateDirections = useCallback(() => {
    if (shortestPath.length < 2) return [];
    
    const steps = [];
    const startNode = nodes.find(n => n.id === shortestPath[0]);
    steps.push({
      id: 'start',
      text: `📍 Start at ${startNode?.name || 'Current Location'}`,
      type: 'start'
    });

    for (let i = 0; i < shortestPath.length - 1; i++) {
      const n1 = nodes.find(n => n.id === shortestPath[i]);
      const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
      
      if (!n1 || !n2) continue;

      // Check for floor change
      if ((n1.floor || 0) !== (n2.floor || 0)) {
        steps.push({
          id: `stair-${i}`,
          text: `🪜 Take stairs/elevator to Floor ${n2.floor || 0}`,
          actionFloor: n2.floor || 0,
          type: 'floor-change'
        });
      }
      
      // Add waypoint if named
      if (n2.name && i < shortestPath.length - 2) {
        steps.push({
          id: `waypoint-${i}`,
          text: `➡️ Pass ${n2.name}`,
          type: 'waypoint'
        });
      }
    }

    const destNode = nodes.find(n => n.id === shortestPath[shortestPath.length - 1]);
    steps.push({
      id: 'end',
      text: `🏁 Arrive at ${destNode?.name || 'Destination'}`,
      type: 'end'
    });

    return steps;
  }, [shortestPath, nodes]);

  // Floor change handler
  const handleFloorChange = useCallback((floor) => {
    setCurrentFloor(floor);
    setInfoNodeId(null);
  }, []);

  // Handle node info click
  const handleNodeInfoClick = useCallback((nodeId) => {
    setInfoNodeId(nodeId);
  }, []);

  // Computed values
  const pathDirections = generateDirections();
  const namedNodes = nodes.filter(n => n.name);
  const infoNode = infoNodeId ? nodes.find(n => n.id === infoNodeId) : null;
  const connectedFloors = infoNodeId 
    ? getConnectedFloors(infoNodeId, nodes, edges) 
    : [];

  // Map event handlers
  const mapHandlers = {
    onHover: setHoverNodeId,
    onNodeClick: (nodeId, isAdmin) => {
      if (isAdmin) {
        if (adminTool === 'select') {
          handleNodeSelect(nodeId);
        } else if (adminTool === 'add' && nodeId) {
          if (lastNodeId && lastNodeId !== nodeId) {
            handleAddEdge(lastNodeId, nodeId);
          }
          handleNodeSelect(nodeId);
        }
      } else {
        // Check for auto floor change
        const connectedFloors = getConnectedFloors(nodeId, nodes, edges);
        if (connectedFloors.length > 0 && shortestPath.length > 0) {
          const pathIdx = shortestPath.indexOf(nodeId);
          if (pathIdx !== -1 && pathIdx + 1 < shortestPath.length) {
            const nextNode = nodes.find(n => n.id === shortestPath[pathIdx + 1]);
            if (nextNode && nextNode.floor !== currentFloor) {
              setCurrentFloor(nextNode.floor || 0);
              setInfoNodeId(null);
              return;
            }
          }
        }
        handleNodeInfoClick(nodeId);
      }
    },
    onMapClick: (position, isAdmin) => {
      if (isAdmin && adminTool === 'add') {
        handleAddNode(position);
      } else if (!isAdmin) {
        setInfoNodeId(null);
      }
    },
    onZoomChange: setZoom,
    onPanChange: setPan,
    onPanningChange: setIsPanning
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading map data...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Map View */}
      <MapView
        ref={mapWrapperRef}
        nodes={nodes}
        edges={edges}
        currentFloor={currentFloor}
        zoom={zoom}
        pan={pan}
        hoverNodeId={hoverNodeId}
        selectedNodeId={selectedNodeId}
        startNodeId={startNodeId}
        destNodeId={destNodeId}
        shortestPath={shortestPath}
        mode={mode}
        adminTool={adminTool}
        mapImages={MAP_IMAGES}
        snapRadius={SNAP_RADIUS}
        handlers={mapHandlers}
        lastNodeId={lastNodeId}
      />

      {/* Top Bar */}
      <div className="top-bar">
        <div className="brand">
          <span className="brand-logo">🗺️</span>
          <h1>Campus Navigator</h1>
        </div>
        <div className="top-actions">
          {isAdminLoggedIn ? (
            <button onClick={handleLogout} className="btn btn-danger btn-sm">
              Exit
            </button>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="btn btn-ghost btn-sm"
            >
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Main Panel with Mobile Bottom Sheet */}
      <div 
        className={`main-panel ${panelState}`}
        style={isDraggingPanel ? { transition: 'none' } : {}}
      >
        {/* Pull Handle for Mobile */}
        <div 
          className="panel-handle"
          onTouchStart={handlePanelDragStart}
          onTouchMove={handlePanelDragMove}
          onTouchEnd={handlePanelDragEnd}
          onClick={togglePanel}
        />

        <div className="panel-content" style={{ overflow: 'auto', flex: 1 }}>
          {isAdminLoggedIn ? (
            <AdminPanel
              mode={mode}
              setMode={setMode}
              adminTool={adminTool}
              setAdminTool={setAdminTool}
              selectedNodeId={selectedNodeId}
              editForm={editForm}
              setEditForm={setEditForm}
              onApplyEdit={handleApplyEdit}
              onDeleteNode={handleDeleteNode}
              onSave={saveMapToDatabase}
              onExport={exportMapData}
              isSaving={isSaving}
            />
          ) : (
            <>
              <UserPanel
                startSearch={startSearch}
                destSearch={destSearch}
                onStartChange={handleStartChange}
                onDestChange={handleDestChange}
                onClearRoute={clearRoute}
                namedNodes={namedNodes}
                getSearchLabel={getSearchLabel}
              />

              {/* Directions Panel */}
              {pathDirections.length > 0 && (
                <DirectionsPanel
                  directions={pathDirections}
                  onFloorChange={handleFloorChange}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <BottomControls
        currentFloor={currentFloor}
        onFloorChange={handleFloorChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Mobile FABs */}
      {isMobile.current && (
        <div className="fab-container">
          <button className="fab fab-locate" onClick={() => {
            // Reset zoom and pan to default
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }} title="Reset View">
            ⌂
          </button>
          <button className="fab" onClick={togglePanel} title="Toggle Panel">
            {panelState === 'collapsed' ? '▲' : '▼'}
          </button>
        </div>
      )}

      {/* Info Card */}
      {infoNode && mode === 'user' && (
        <InfoCard
          node={infoNode}
          connectedFloors={connectedFloors}
          onFloorChange={handleFloorChange}
          onSetStart={() => {
            setStartSearch(getSearchLabel(infoNode));
            setStartNodeId(infoNode.id);
            triggerRouting(infoNode.id, destNodeId);
            setInfoNodeId(null);
          }}
          onSetDest={() => {
            setDestSearch(getSearchLabel(infoNode));
            setDestNodeId(infoNode.id);
            triggerRouting(startNodeId, infoNode.id);
            setInfoNodeId(null);
          }}
          onClose={() => setInfoNodeId(null)}
        />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Error Toast */}
      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Datalist for search */}
      <datalist id="nodes-list">
        {namedNodes.map(n => (
          <option key={n.id} value={getSearchLabel(n)} />
        ))}
      </datalist>
    </div>
  );
}

export default App;