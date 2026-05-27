export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getDistance = (n1, n2) => {
    const f1 = n1.floor !== undefined ? n1.floor : 0;
    const f2 = n2.floor !== undefined ? n2.floor : 0;
    const zPenalty = Math.abs(f1 - f2) * 200; 
    return Math.hypot(n1.x - n2.x, n1.y - n2.y, zPenalty);
};

export const getNeighbors = (nodeId, edges) => {
    const neighbors = [];
    for (let e of edges) {
        if (e.n1 === nodeId) neighbors.push(e.n2);
        if (e.n2 === nodeId) neighbors.push(e.n1);
    }
    return neighbors;
};

export const getEdge = (id1, id2, edges) => {
    return edges.find(e => (e.n1 === id1 && e.n2 === id2) || (e.n1 === id2 && e.n2 === id1));
};

export const getConnectedFloors = (nodeId, nodes, edges) => {
    const startNode = nodes.find(n => n.id === nodeId);
    if (!startNode) return [];
    
    let floors = new Set();
    for (let e of edges) {
        if (e.n1 === nodeId || e.n2 === nodeId) {
            const otherId = e.n1 === nodeId ? e.n2 : e.n1;
            const otherNode = nodes.find(n => n.id === otherId);
            if (otherNode && otherNode.floor !== startNode.floor) {
                floors.add(otherNode.floor);
            }
        }
    }
    return Array.from(floors);
};

export const calculateAStar = (startId, destId, nodes, edges) => {
    if (startId === destId) return [startId];

    const openSet = new Set([startId]);
    const cameFrom = new Map();
    
    const gScore = new Map();
    nodes.forEach(n => gScore.set(n.id, Infinity));
    gScore.set(startId, 0);
    
    const fScore = new Map();
    nodes.forEach(n => fScore.set(n.id, Infinity));
    
    const destNode = nodes.find(n => n.id === destId);
    if (!destNode) return null;

    fScore.set(startId, getDistance(nodes.find(n => n.id === startId), destNode));

    while (openSet.size > 0) {
        let currentId = null;
        let lowestF = Infinity;
        for (let id of openSet) {
            const f = fScore.get(id);
            if (f < lowestF) {
                lowestF = f;
                currentId = id;
            }
        }

        if (currentId === destId) {
            const path = [currentId];
            while (cameFrom.has(currentId)) {
                currentId = cameFrom.get(currentId);
                path.unshift(currentId);
            }
            return path;
        }

        openSet.delete(currentId);
        const neighbors = getNeighbors(currentId, edges);

        for (let neighborId of neighbors) {
            const edge = getEdge(currentId, neighborId, edges);
            const tentativeG = gScore.get(currentId) + edge.weight;

            if (tentativeG < gScore.get(neighborId)) {
                cameFrom.set(neighborId, currentId);
                gScore.set(neighborId, tentativeG);
                
                const neighborNode = nodes.find(n => n.id === neighborId);
                fScore.set(neighborId, tentativeG + getDistance(neighborNode, destNode));
                
                if (!openSet.has(neighborId)) openSet.add(neighborId);
            }
        }
    }
    return null;
};