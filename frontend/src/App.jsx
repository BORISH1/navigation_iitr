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
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const pinchDistRef = useRef(null);
  const pinchZoomRef = useRef(null);
  // NEW REFS for proper two-finger midpoint zooming
  const pinchMidpointRef = useRef({ x: 0, y: 0 });
  const pinchPanRef = useRef({ x: 0, y: 0 });

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

  // --- 1. FETCH DATA FROM BACKEND ---
  useEffect(() => {
    const loadMapData = async () => {
      setIsLoading(true);
      setApiError(null);
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        console.log('Fetching from:', `${apiUrl}/api/map`);
        
        const response = await fetch(`${apiUrl}/api/map`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
          console.log('Loaded from API:', data.nodes.length, 'nodes');
        } else {
          // Fallback to local JSON
          await loadFallbackData();
        }
      } catch (err) {
        console.error("API error:", err);
        setApiError('Could not connect to server. Using local data.');
        await loadFallbackData();
      } finally {
        setIsLoading(false);
      }
    };
    
    const loadFallbackData = async () => {
      try {
        const fallbackRes = await fetch('/groundfloor.json');
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setNodes(fallbackData.nodes || []);
          setEdges(fallbackData.edges || []);
          console.log('Loaded from fallback JSON');
        }
      } catch (fallbackErr) {
        console.error("Fallback error:", fallbackErr);
        setApiError('Failed to load any map data.');
      }
    };
    
    loadMapData();
  }, []);

  // --- 2. SAVE DATA TO BACKEND ---
  const saveMapToDatabase = async () => {
    if (!nodes || nodes.length === 0) {
      alert("No nodes to save!");
      return;
    }
    
    setIsSaving(true);
    setApiError(null);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log('Saving to:', `${apiUrl}/api/map`);
      console.log('Data:', { nodes: nodes.length, edges: edges.length });
      
      const response = await fetch(`${apiUrl}/api/map`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          nodes: nodes, 
          edges: edges 
        })
      });
      
      const result = await response.json();
      console.log('Save response:', result);
      
      if (response.ok) {
        alert("✅ Success! Map published to database.");
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("❌ Error saving map: " + err.message);
      setApiError('Failed to save. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export map data as JSON file
  const exportMapData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({nodes, edges}, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `campus_map_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      alert("✅ Map data exported successfully!");
    } catch (err) {
      alert("❌ Error exporting data.");
    }
  };

  // Import map data from JSON file
  const importMapData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          alert(`✅ Imported ${data.nodes.length} nodes and ${data.edges.length} edges.`);
        } else {
          alert("❌ Invalid file format.");
        }
      } catch (err) {
        alert("❌ Error parsing file.");
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  // Login handler
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
      setIsAdminLoggedIn(true);
      setShowLoginModal(false);
      setMode('admin');
      setAdminTool('select');
      setLoginForm({ username: '', password: '' });
      setLoginError('');
    } else {
      setLoginError('Invalid credentials. Use admin / admin123');
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setMode('user');
    setSelectedNodeId(null);
    setLastNodeId(null);
    setAdminTool('select');
  };

  // Route calculation
  const triggerRouting = (startId, destId) => {
    if (startId && destId) {
      const path = calculateAStar(startId, destId, nodes, edges);
      if (!path || path.length === 0) {
        alert("No route found! Make sure stairs/elevators are properly connected between floors.");
      }
      setShortestPath(path || []);
    } else {
      setShortestPath([]);
    }
  };

  // Search handlers
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
    setStartSearch(''); 
    setDestSearch(''); 
    setStartNodeId(null); 
    setDestNodeId(null); 
    setShortestPath([]);
  };

  // Admin node operations
  const handleApplyEdit = () => {
    if (!selectedNodeId) {
      alert("Please select a node first.");
      return;
    }
    
    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === selectedNodeId 
          ? { ...node, ...editForm }
          : node
      )
    );
    
    console.log('Applied edit to node:', selectedNodeId, editForm);
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) {
      alert("Please select a node first.");
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this node and all its connections?')) {
      return;
    }
    
    setNodes(prevNodes => prevNodes.filter(node => node.id !== selectedNodeId));
    setEdges(prevEdges => prevEdges.filter(edge => 
      edge.n1 !== selectedNodeId && edge.n2 !== selectedNodeId
    ));
    setSelectedNodeId(null);
    setLastNodeId(null);
    setEditForm({ name: '', subtitle: '', description: '' });
    
    console.log('Deleted node:', selectedNodeId);
  };

  // Add new node
  const handleAddNodeAtPosition = (pos) => {
    const newNode = {
      id: generateId(),
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      floor: currentFloor,
      name: '',
      subtitle: '',
      description: ''
    };
    
    setNodes(prevNodes => [...prevNodes, newNode]);
    
    // Auto-connect to last selected node
    if (lastNodeId) {
      const lastNode = nodes.find(n => n.id === lastNodeId);
      if (lastNode) {
        const newEdge = {
          n1: lastNodeId,
          n2: newNode.id,
          weight: Math.round(getDistance(lastNode, newNode))
        };
        setEdges(prevEdges => [...prevEdges, newEdge]);
        console.log('Auto-connected to last node:', lastNodeId);
      }
    }
    
    setSelectedNodeId(newNode.id);
    setLastNodeId(newNode.id);
    setEditForm({ name: '', subtitle: '', description: '' });
    
    console.log('Added new node:', newNode);
  };

  // Connect existing nodes
  const handleConnectNodes = (nodeId1, nodeId2) => {
    if (nodeId1 === nodeId2) {
      console.log('Cannot connect node to itself');
      return;
    }
    
    const existingEdge = getEdge(nodeId1, nodeId2, edges);
    if (existingEdge) {
      console.log('Edge already exists');
      return;
    }
    
    const n1 = nodes.find(n => n.id === nodeId1);
    const n2 = nodes.find(n => n.id === nodeId2);
    
    if (n1 && n2) {
      const newEdge = {
        n1: nodeId1,
        n2: nodeId2,
        weight: Math.round(getDistance(n1, n2))
      };
      setEdges(prevEdges => [...prevEdges, newEdge]);
      console.log('Connected nodes:', nodeId1, '->', nodeId2);
    }
  };

  // Generate directions for route
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
          steps.push({ 
            id: `stair-${i}`, 
            text: `🪜 Take stairs to Floor ${n2.floor || 0}`, 
            actionFloor: n2.floor || 0 
          });
        }
      }
      const destNode = nodes.find(n => n.id === shortestPath[shortestPath.length - 1]);
      steps.push({ id: 'end', text: `🏁 Arrive at ${destNode?.name || 'Destination'}` });
    }
    return steps;
  };

  const pathInstructions = generateDirections();

  // --- 3. CANVAS RENDERING ---
  const handleImageLoad = (e) => {
    const img = e.target;
    if (canvasRef.current && img) {
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

    // Draw Edges
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
      }
    });

    // Draw Shortest Path
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

      // Draw Path Arrows
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
          ctx.stroke();
        }
      }

      // Cross-Floor Markers
      for (let i = 0; i < shortestPath.length - 1; i++) {
        const n1 = nodes.find(n => n.id === shortestPath[i]);
        const n2 = nodes.find(n => n.id === shortestPath[i + 1]);
        if (!n1 || !n2) continue;

        if ((n1.floor || 0) !== (n2.floor || 0)) {
          const visibleNode = (n1.floor || 0) === currentFloor ? n1 : ((n2.floor || 0) === currentFloor ? n2 : null);
          const targetFloor = (n1.floor || 0) === currentFloor ? (n2.floor || 0) : ((n2.floor || 0) === currentFloor ? (n1.floor || 0) : null);

          if (visibleNode && targetFloor !== null) {
            ctx.beginPath();
            ctx.arc(visibleNode.x, visibleNode.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(visibleNode.x, visibleNode.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 4;
            ctx.stroke();

            const badgeText = targetFloor > currentFloor ? `⬆ To Floor ${targetFloor}` : `⬇ To Floor ${targetFloor}`;
            ctx.font = "bold 14px Inter, sans-serif";
            const textWidth = ctx.measureText(badgeText).width;
            
            ctx.fillStyle = "#111827";
            ctx.beginPath();
            ctx.roundRect(visibleNode.x + 20, visibleNode.y - 30, textWidth + 20, 26, 6);
            ctx.fill();
            
            ctx.fillStyle = "#F59E0B";
            ctx.fillText(badgeText, visibleNode.x + 30, visibleNode.y - 12);
          }
        }
      }
    }

    // Draw Nodes
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

  useEffect(() => { 
    drawMap(); 
  }, [nodes, edges, currentFloor, hoverNodeId, selectedNodeId, startNodeId, destNodeId, shortestPath, mode, adminTool, lastNodeId]);

  // --- 4. MAP INTERACTION (WITH IMPROVED TWO-FINGER MIDPOINT LOGIC) ---
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
    // TWO FINGERS: Start Pinch
    if (e.touches && e.touches.length === 2) {
      setIsPanning(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // Calculate distance
      pinchDistRef.current = Math.hypot(
        touch1.clientX - touch2.clientX, 
        touch1.clientY - touch2.clientY
      );
      
      // Calculate midpoint between fingers
      pinchMidpointRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      
      pinchZoomRef.current = zoom;
      pinchPanRef.current = { ...pan };
      return;
    }
    
    // ONE FINGER: Start Pan
    setIsPanning(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX - pan.x, y: clientY - pan.y };
  };

  const handlePointerMove = (e) => {
    // TWO FINGERS: Zooming and Panning simultaneously relative to midpoint
    if (e.touches && e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // 1. Calculate new zoom
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX, 
        touch1.clientY - touch2.clientY
      );
      const scale = dist / pinchDistRef.current;
      const newZoom = Math.max(0.1, Math.min(pinchZoomRef.current * scale, 10));
      
      // 2. Calculate new midpoint (allows dragging while zooming)
      const currentMidX = (touch1.clientX + touch2.clientX) / 2;
      const currentMidY = (touch1.clientY + touch2.clientY) / 2;
      
      // 3. Keep the zoom centered directly between the fingers
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const midXRel = pinchMidpointRef.current.x - wrapperRect.left;
      const midYRel = pinchMidpointRef.current.y - wrapperRect.top;
      
      const panX = currentMidX - wrapperRect.left - (midXRel - pinchPanRef.current.x) * (newZoom / pinchZoomRef.current);
      const panY = currentMidY - wrapperRect.top - (midYRel - pinchPanRef.current.y) * (newZoom / pinchZoomRef.current);
      
      setZoom(newZoom);
      setPan({ x: panX, y: panY });
      return;
    }
    
    // ONE FINGER: Panning
    if (isPanning) {
      e.preventDefault(); // Prevents browser scroll behavior
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPan({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
      return;
    }
    
    // Hover logic (For Desktop primarily)
    if (!e.touches) {
      const pos = getMousePos(e);
      let closest = null; 
      let minDist = SNAP_RADIUS / zoom;
      
      nodes.filter(n => (n.floor || 0) === currentFloor).forEach(node => {
        let dist = Math.hypot(pos.x - node.x, pos.y - node.y);
        if (dist < minDist) { 
          minDist = dist; 
          closest = node; 
        }
      });
      setHoverNodeId(closest ? closest.id : null);
    }
  };

  const handlePointerUp = (e) => {
    // Prevent the map from jumping if one finger is released from a pinch zoom
    if (e.touches && e.touches.length === 1) {
      setIsPanning(true);
      dragStart.current = { 
        x: e.touches[0].clientX - pan.x, 
        y: e.touches[0].clientY - pan.y 
      };
      return;
    }

    if (isPanning) { 
      setIsPanning(false); 
      return; 
    }
    if (e.touches && e.touches.length > 0) return; 
    
    const pos = getMousePos(e);
    
    if (mode === 'admin') {
      if (adminTool === 'add') {
        if (!hoverNodeId) {
          handleAddNodeAtPosition(pos);
        } else {
          if (lastNodeId && lastNodeId !== hoverNodeId) {
            handleConnectNodes(lastNodeId, hoverNodeId);
          }
          setSelectedNodeId(hoverNodeId); 
          setLastNodeId(hoverNodeId);
          
          const nodeData = nodes.find(n => n.id === hoverNodeId);
          if (nodeData) {
            setEditForm({ 
              name: nodeData.name || '', 
              subtitle: nodeData.subtitle || '', 
              description: nodeData.description || '' 
            });
          }
        }
      } else if (adminTool === 'select') {
        if (hoverNodeId) {
          setSelectedNodeId(hoverNodeId); 
          setLastNodeId(hoverNodeId);
          
          const nodeData = nodes.find(n => n.id === hoverNodeId);
          if (nodeData) {
            setEditForm({ 
              name: nodeData.name || '', 
              subtitle: nodeData.subtitle || '', 
              description: nodeData.description || '' 
            });
          }
        } else {
          setSelectedNodeId(null); 
          setLastNodeId(null);
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
              setCurrentFloor(nextNode.floor || 0); 
              setInfoNodeId(null); 
              return; 
            }
          }
        }
        setInfoNodeId(hoverNodeId);
      } else {
        setInfoNodeId(null);
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) newZoom *= zoomFactor; 
    else newZoom /= zoomFactor;
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

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (wrapper) wrapper.removeEventListener('wheel', handleWheel); };
  }, [zoom, pan]);

  const stopPropagation = (e) => e.stopPropagation();

  const namedNodes = nodes.filter(n => n.name);
  const infoNode = infoNodeId ? nodes.find(n => n.id === infoNodeId) : null;
  const connectedFloors = infoNodeId ? getConnectedFloors(infoNodeId, nodes, edges) : [];

  return (
    <div className="app-container">
      
      {/* Loading Screen */}
      {isLoading && (
        <div className="loading-screen">
          <div className="loader"></div>
          <p>Loading map data...</p>
        </div>
      )}

      {/* MAP WORKSPACE */}
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

      {/* TOP BAR */}
      <div className="top-bar" onWheel={stopPropagation} onTouchMove={stopPropagation}>
        <div className="brand">
          <h1>🗺️ Campus Navigator</h1>
        </div>
        <div>
          {isAdminLoggedIn ? (
            <button className="btn btn-danger btn-sm" onClick={handleLogout}>Exit Admin</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)}>Admin</button>
          )}
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="main-panel" onWheel={stopPropagation} onTouchMove={stopPropagation} onMouseDown={stopPropagation}>
        {apiError && (
          <div className="error-toast">
            <span>⚠️</span> {apiError}
            <button onClick={() => setApiError(null)}>✕</button>
          </div>
        )}

        {isAdminLoggedIn ? (
          <div className="admin-panel">
            <h3>🛠️ Admin Tools</h3>
            
            <div className="mode-toggle">
              <button className={mode === 'user' ? 'active' : ''} onClick={() => { setMode('user'); setSelectedNodeId(null); }}>👁️ View</button>
              <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>✏️ Edit</button>
            </div>
            
            {mode === 'admin' && (
              <>
                <div className="tool-toggle">
                  <button className={adminTool === 'select' ? 'active' : ''} onClick={() => setAdminTool('select')}>📍 Select</button>
                  <button className={adminTool === 'add' ? 'active' : ''} onClick={() => setAdminTool('add')}>➕ Add Node</button>
                </div>

                <div className="admin-info">
                  <small style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
                    {adminTool === 'select' 
                      ? 'Click a node to select and edit it.' 
                      : 'Click on empty space to add a node. Click existing node to connect.'}
                  </small>
                </div>

                <div className="form-group">
                  <label>Room Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter room name..." 
                    value={editForm.name} 
                    onChange={e => setEditForm({...editForm, name: e.target.value})} 
                    disabled={!selectedNodeId} 
                  />
                </div>
                
                <div className="form-group">
                  <label>Subtitle (Professor/Lab)</label>
                  <input 
                    type="text" 
                    placeholder="Enter subtitle..." 
                    value={editForm.subtitle} 
                    onChange={e => setEditForm({...editForm, subtitle: e.target.value})} 
                    disabled={!selectedNodeId} 
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    placeholder="Enter description..." 
                    value={editForm.description} 
                    onChange={e => setEditForm({...editForm, description: e.target.value})} 
                    disabled={!selectedNodeId}
                    rows={2}
                  />
                </div>
                
                <div className="btn-row">
                  <button className="btn btn-primary btn-sm" disabled={!selectedNodeId} onClick={handleApplyEdit}>
                    ✓ Apply Edit
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={!selectedNodeId} onClick={handleDeleteNode}>
                    🗑️ Delete
                  </button>
                </div>
                
                <div className="btn-row">
                  <button className="btn btn-success btn-sm" onClick={saveMapToDatabase} disabled={isSaving}>
                    {isSaving ? '⏳ Saving...' : '💾 Publish'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={exportMapData}>
                    📥 Export
                  </button>
                </div>
                
                <label className="btn btn-sm" style={{ 
                  background: '#374151', 
                  color: 'white', 
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'block'
                }}>
                  📤 Import JSON
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={importMapData} 
                    style={{ display: 'none' }} 
                  />
                </label>
                
                <div style={{ 
                  background: '#1F2937', 
                  padding: '8px', 
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#9CA3AF'
                }}>
                  <strong>Stats:</strong> {nodes.length} nodes, {edges.length} edges | 
                  Floor {currentFloor}: {nodes.filter(n => (n.floor || 0) === currentFloor).length} nodes
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="search-panel">
              <div className="search-input-group">
                <label>📍 Starting Point</label>
                <input type="text" list="nodes-list" placeholder="Search start location..." value={startSearch} onChange={handleStartChange} autoComplete="off" />
              </div>
              <div className="search-input-group">
                <label>🏁 Destination</label>
                <input type="text" list="nodes-list" placeholder="Search destination..." value={destSearch} onChange={handleDestChange} autoComplete="off" />
              </div>
              {(startSearch || destSearch) && (
                <button className="clear-btn" onClick={clearRoute}>✕ Clear Route</button>
              )}
            </div>

            {pathInstructions.length > 0 && (
              <div className="directions-panel">
                <h4>📍 Route Directions</h4>
                <div className="directions-list">
                  {pathInstructions.map((step) => (
                    <div 
                      key={step.id} 
                      className={`direction-step ${step.actionFloor !== undefined ? 'floor-change' : step.id === 'start' ? 'start' : step.id === 'end' ? 'end' : 'waypoint'}`}
                      onClick={() => step.actionFloor !== undefined && setCurrentFloor(step.actionFloor)}
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

      {/* BOTTOM CONTROLS */}
      <div className="bottom-controls" onWheel={stopPropagation} onTouchMove={stopPropagation}>
        <select className="floor-select" value={currentFloor} onChange={(e) => setCurrentFloor(parseInt(e.target.value, 10))}>
          <option value={2}>🏢 Second Floor</option>
          <option value={1}>🏢 First Floor</option>
          <option value={0}>🏢 Ground Floor</option>
        </select>

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => {
            setZoom(z => Math.min(10, z * 1.25));
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) setPan(p => ({ x: p.x - (rect.width/2 - p.x)*0.25, y: p.y - (rect.height/2 - p.y)*0.25 }));
          }}>+</button>
          <button className="zoom-btn" onClick={() => {
            setZoom(z => Math.max(0.1, z / 1.25));
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) setPan(p => ({ x: p.x + (rect.width/2 - p.x)*0.2, y: p.y + (rect.height/2 - p.y)*0.2 }));
          }}>−</button>
        </div>
      </div>

      {/* INFO CARD */}
      {mode === 'user' && infoNode && (
        <div className="info-card" onWheel={stopPropagation} onTouchMove={stopPropagation} onMouseDown={stopPropagation}>
          <button className="close-btn" onClick={() => setInfoNodeId(null)}>×</button>
          <h2>{infoNode.name || "Pathway / Stairs"}</h2>
          {infoNode.subtitle && <h4>{infoNode.subtitle}</h4>}
          {infoNode.description && <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginBottom: '12px' }}>{infoNode.description}</p>}
          
          <div className="info-actions">
            {connectedFloors.length > 0 ? (
              connectedFloors.map(f => (
                <button key={f} className="teleport-btn" onClick={() => { setCurrentFloor(f); setInfoNodeId(null); }}>
                  🪜 Floor {f}
                </button>
              ))
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setStartSearch(getSearchLabel(infoNode)); 
                  setStartNodeId(infoNode.id);
                  triggerRouting(infoNode.id, destNodeId); 
                  setInfoNodeId(null);
                }}>📍 Set Start</button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setDestSearch(getSearchLabel(infoNode)); 
                  setDestNodeId(infoNode.id);
                  triggerRouting(startNodeId, infoNode.id); 
                  setInfoNodeId(null);
                }}>🏁 Set Dest</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="modal-overlay" onWheel={stopPropagation} onTouchMove={stopPropagation}>
          <form className="modal-form" onSubmit={handleLoginSubmit} onClick={e => e.stopPropagation()}>
            <h2>🔐 Admin Login</h2>
            {loginError && <span className="error-text">{loginError}</span>}
            <input type="text" placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required autoFocus />
            <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary">Login</button>
              <button type="button" className="btn" onClick={() => { setShowLoginModal(false); setLoginError(''); }} style={{ background: '#374151', color: 'white' }}>Cancel</button>
            </div>
            <small style={{ color: '#6B7280', textAlign: 'center' }}>Default: admin / admin123</small>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;