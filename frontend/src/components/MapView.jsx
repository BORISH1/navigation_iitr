import React, { useRef, useEffect, useCallback } from 'react';

const MapView = React.forwardRef(({
  nodes,
  edges,
  currentFloor,
  zoom,
  pan,
  hoverNodeId,
  selectedNodeId,
  startNodeId,
  destNodeId,
  shortestPath,
  mode,
  adminTool,
  mapImages,
  snapRadius,
  handlers,
  lastNodeId
}, ref) => {
  const canvasRef = useRef(null);
  const mapImageRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef(null);
  const pinchZoomRef = useRef(null);
  const lastTapRef = useRef(0);

  const getMousePos = useCallback((e) => {
    const wrapper = ref?.current;
    if (!wrapper) return { x: 0, y: 0 };
    
    const rect = wrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  }, [ref, pan, zoom]);

  const findClosestNode = useCallback((pos) => {
    let closest = null;
    let minDist = snapRadius;
    
    nodes
      .filter(n => (n.floor || 0) === currentFloor)
      .forEach(node => {
        const dist = Math.hypot(pos.x - node.x, pos.y - node.y);
        if (dist < minDist) {
          minDist = dist;
          closest = node;
        }
      });
    
    return closest;
  }, [nodes, currentFloor, snapRadius]);

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw edges
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
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw shortest path
    if (shortestPath.length > 1) {
      drawPath(ctx, shortestPath, nodes, currentFloor);
    }
    
    // Draw nodes
    const activeNodes = nodes.filter(n => (n.floor || 0) === currentFloor);
    activeNodes.forEach(n => {
      drawNode(ctx, n, {
        hoverNodeId,
        selectedNodeId,
        startNodeId,
        destNodeId,
        lastNodeId,
        mode
      });
    });
  }, [nodes, edges, currentFloor, hoverNodeId, selectedNodeId, 
      startNodeId, destNodeId, shortestPath, mode, lastNodeId]);

  const drawPath = (ctx, path, nodes, currentFloor) => {
    // Draw path glow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let firstPoint = true;
    for (let i = 0; i < path.length; i++) {
      const node = nodes.find(n => n.id === path[i]);
      if (!node || (node.floor || 0) !== currentFloor) {
        firstPoint = true;
        continue;
      }
      
      if (firstPoint) {
        ctx.moveTo(node.x, node.y);
        firstPoint = false;
      } else {
        ctx.lineTo(node.x, node.y);
      }
    }
    ctx.stroke();
    
    // Draw path line
    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    firstPoint = true;
    for (let i = 0; i < path.length; i++) {
      const node = nodes.find(n => n.id === path[i]);
      if (!node || (node.floor || 0) !== currentFloor) {
        firstPoint = true;
        continue;
      }
      
      if (firstPoint) {
        ctx.moveTo(node.x, node.y);
        firstPoint = false;
      } else {
        ctx.lineTo(node.x, node.y);
      }
    }
    ctx.stroke();
    
    // Draw arrows
    for (let i = 0; i < path.length - 1; i++) {
      const n1 = nodes.find(n => n.id === path[i]);
      const n2 = nodes.find(n => n.id === path[i + 1]);
      
      if (!n1 || !n2) continue;
      if ((n1.floor || 0) !== currentFloor || (n2.floor || 0) !== currentFloor) continue;
      
      drawArrow(ctx, n1, n2);
    }
    
    // Draw floor change markers
    for (let i = 0; i < path.length - 1; i++) {
      const n1 = nodes.find(n => n.id === path[i]);
      const n2 = nodes.find(n => n.id === path[i + 1]);
      
      if (!n1 || !n2) continue;
      if ((n1.floor || 0) === (n2.floor || 0)) continue;
      
      const visibleNode = (n1.floor || 0) === currentFloor ? n1 : 
                         (n2.floor || 0) === currentFloor ? n2 : null;
      
      if (visibleNode) {
        const targetFloor = (n1.floor || 0) === currentFloor ? 
                           (n2.floor || 0) : (n1.floor || 0);
        drawFloorMarker(ctx, visibleNode, targetFloor);
      }
    }
  };

  const drawArrow = (ctx, from, to) => {
    const headlen = 12;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const midX = from.x + dx / 2;
    const midY = from.y + dy / 2;
    
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(
      midX - headlen * Math.cos(angle - Math.PI / 6),
      midY - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(midX, midY);
    ctx.lineTo(
      midX - headlen * Math.cos(angle + Math.PI / 6),
      midY - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  const drawFloorMarker = (ctx, node, targetFloor) => {
    // Glowing circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Badge
    const badgeText = `Floor ${targetFloor}`;
    ctx.font = 'bold 12px Inter, sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(node.x + 15, node.y - 25, textWidth + 16, 22, 6);
    ctx.fill();
    
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(badgeText, node.x + 23, node.y - 9);
  };

  const drawNode = (ctx, node, state) => {
    ctx.beginPath();
    const radius = node.name ? 12 : 8;
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    
    let fillColor = '#3B82F6';
    if (node.name) fillColor = '#10B981';
    if (node.id === state.startNodeId || node.id === state.destNodeId) fillColor = '#F59E0B';
    if (node.id === state.selectedNodeId) fillColor = '#EF4444';
    if (state.mode === 'admin' && state.lastNodeId && state.lastNodeId !== node.id) {
      fillColor = '#8B5CF6';
    }
    
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // Hover effect
    if (node.id === state.hoverNodeId) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Label
    if (node.name) {
      ctx.font = 'bold 13px Inter, sans-serif';
      const textWidth = ctx.measureText(node.name).width;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.roundRect(node.x + 14, node.y - 22, textWidth + 12, 22, 6);
      ctx.fill();
      
      // Text
      ctx.fillStyle = 'white';
      ctx.fillText(node.name, node.x + 20, node.y - 6);
    }
  };

  // Handle image load
  const handleImageLoad = useCallback(() => {
    const img = mapImageRef.current;
    if (canvasRef.current && img) {
      const width = img.naturalWidth || img.clientWidth || 1000;
      const height = img.naturalHeight || img.clientHeight || 1000;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      
      // Auto-fit map on first load for mobile
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const wrapper = ref?.current;
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect();
          const scaleX = rect.width / width;
          const scaleY = rect.height / height;
          const initialZoom = Math.min(scaleX, scaleY, 1.5);
          
          handlers.onZoomChange(initialZoom);
          handlers.onPanChange({
            x: (rect.width - width * initialZoom) / 2,
            y: (rect.height - height * initialZoom) / 2
          });
        }
      }
      
      drawMap();
    }
  }, [drawMap, ref, handlers]);

  // Redraw on state change
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // Event handlers
  const handlePointerDown = useCallback((e) => {
    // Prevent default to avoid pull-to-refresh on mobile
    if (e.touches) {
      e.preventDefault();
    }
    
    if (e.touches && e.touches.length === 2) {
      // Pinch zoom
      pinchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchZoomRef.current = zoom;
      return;
    }
    
    // Single touch - start panning
    isDragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = {
      x: clientX - pan.x,
      y: clientY - pan.y
    };
    handlers.onPanningChange(true);
  }, [zoom, pan, handlers]);

  const handlePointerMove = useCallback((e) => {
    // Handle pinch zoom
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / pinchDistRef.current;
      handlers.onZoomChange(Math.max(0.1, Math.min(pinchZoomRef.current * scale, 10)));
      return;
    }
    
    // Handle panning
    if (isDragging.current) {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      handlers.onPanChange({
        x: clientX - dragStart.current.x,
        y: clientY - dragStart.current.y
      });
      return;
    }
    
    // Handle hover
    const pos = getMousePos(e);
    const closest = findClosestNode(pos);
    handlers.onHover(closest ? closest.id : null);
  }, [getMousePos, findClosestNode, handlers]);

  const handlePointerUp = useCallback((e) => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    handlers.onPanningChange(false);
    
    // Check if it was a click (not a drag)
    const pos = getMousePos(e);
    const closest = findClosestNode(pos);
    const isAdmin = mode === 'admin';
    
    if (closest) {
      handlers.onNodeClick(closest.id, isAdmin);
    } else {
      handlers.onMapClick(pos, isAdmin);
    }
  }, [getMousePos, findClosestNode, mode, handlers]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const zoomFactor = 1.1;
    let newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    newZoom = Math.max(0.1, Math.min(10, newZoom));
    
    const wrapper = ref?.current;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      handlers.onPanChange({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
      });
    }
    
    handlers.onZoomChange(newZoom);
  }, [zoom, pan, ref, handlers]);

  // Add double-tap zoom for mobile
  const handleDoubleTap = useCallback((e) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    
    if (timeDiff < 300 && timeDiff > 0) {
      // Double tap detected
      const pos = getMousePos(e);
      const currentZoom = zoom;
      const newZoom = currentZoom < 2 ? currentZoom * 2 : 1;
      
      handlers.onZoomChange(newZoom);
      
      // Zoom towards tapped point
      if (ref?.current) {
        const rect = ref.current.getBoundingClientRect();
        handlers.onPanChange({
          x: pos.x - (pos.x - pan.x) * (newZoom / currentZoom),
          y: pos.y - (pos.y - pan.y) * (newZoom / currentZoom)
        });
      }
    }
    
    lastTapRef.current = now;
  }, [zoom, pan, getMousePos, ref, handlers]);
  useEffect(() => {
    const wrapper = ref?.current;
    if (wrapper) {
      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      return () => wrapper.removeEventListener('wheel', handleWheel);
    }
  }, [ref, handleWheel]);

  return (
    <div
      ref={ref}
      className="map-wrapper"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={(e) => {
        handlePointerDown(e);
        handleDoubleTap(e);
      }}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="map-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        <img
          ref={mapImageRef}
          src={mapImages[currentFloor]}
          alt={`Floor ${currentFloor}`}
          onLoad={handleImageLoad}
          draggable={false}
        />
        <canvas ref={canvasRef} className="map-canvas" />
      </div>
    </div>
  );
});

MapView.displayName = 'MapView';
export default MapView;