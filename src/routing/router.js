/**
 * NetworkNeuron Traffic Routing and Load Balancing Module
 * 
 * Handles intelligent routing of data packets, load balancing across nodes,
 * and optimization of network paths for the NetworkNeuron protocol.
 */

import { EventEmitter } from 'events';
import { Route, DataPacket, ClientSession, RouteRequirements, NetworkNeuronError, RouteNotFoundError, InsufficientBandwidthError } from '../core/types.js';
import { CryptoManager } from '../crypto/crypto.js';

/**
 * Traffic Router
 */
export class TrafficRouter extends EventEmitter {
  constructor(networkManager, config) {
    super();
    
    this.networkManager = networkManager;
    this.config = config;
    this.crypto = new CryptoManager();
    
    this.activeRoutes = new Map();
    this.clientSessions = new Map();
    this.routeCache = new Map();
    this.loadBalancer = new LoadBalancer();
    this.pathOptimizer = new PathOptimizer();
    
    this.routeTimeout = 300000; // 5 minutes
    this.maxCacheSize = 1000;
    
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    this.networkManager.on('peer:disconnected', (peerId) => {
      this.handlePeerDisconnection(peerId);
    });
    
    this.networkManager.on('bandwidth:report', (peerId, report) => {
      this.updateNodeBandwidth(peerId, report);
    });
  }

  /**
   * Find optimal route for data transmission
   */
  async findRoute(destination, requirements = {}) {
    try {
      const cacheKey = this.generateCacheKey(destination, requirements);
      
      // Check cache first
      if (this.routeCache.has(cacheKey)) {
        const cachedRoute = this.routeCache.get(cacheKey);
        if (cachedRoute.expiresAt > new Date()) {
          return cachedRoute;
        } else {
          this.routeCache.delete(cacheKey);
        }
      }

      // Get available nodes
      const availableNodes = this.getAvailableNodes(requirements);
      
      if (availableNodes.length === 0) {
        throw new RouteNotFoundError(destination);
      }

      // Find optimal path using path optimization algorithm
      const optimalPath = await this.pathOptimizer.findOptimalPath(
        destination,
        availableNodes,
        requirements
      );

      if (!optimalPath) {
        throw new RouteNotFoundError(destination);
      }

      // Create route object
      const route = {
        id: this.crypto.generateRandomString(16),
        nodes: optimalPath.nodes,
        latency: optimalPath.latency,
        bandwidth: optimalPath.bandwidth,
        cost: optimalPath.cost,
        encrypted: requirements.encryption !== false,
        expiresAt: new Date(Date.now() + this.routeTimeout)
      };

      // Cache the route
      this.cacheRoute(cacheKey, route);
      
      // Store active route
      this.activeRoutes.set(route.id, route);
      
      this.emit('route:created', route);
      
      return route;
      
    } catch (error) {
      throw new NetworkNeuronError(`Route finding failed: ${error.message}`, 'ROUTE_FINDING_ERROR');
    }
  }

  /**
   * Send data packet through the network
   */
  async sendPacket(packet) {
    try {
      // Validate packet
      this.validatePacket(packet);
      
      // Check if route is still valid
      const route = this.activeRoutes.get(packet.route.id);
      if (!route || route.expiresAt < new Date()) {
        throw new NetworkNeuronError('Route expired', 'ROUTE_EXPIRED');
      }

      // Encrypt packet if required
      if (packet.encrypted) {
        packet.payload = await this.encryptPacket(packet);
      }

      // Send packet through the route
      await this.forwardPacket(packet, route);
      
      this.emit('packet:sent', packet);
      
    } catch (error) {
      throw new NetworkNeuronError(`Packet sending failed: ${error.message}`, 'PACKET_SEND_ERROR');
    }
  }

  /**
   * Forward packet through route nodes
   */
  async forwardPacket(packet, route) {
    try {
      const nextNodeId = route.nodes[0];
      const remainingNodes = route.nodes.slice(1);
      
      // Create forwarding packet
      const forwardPacket = {
        ...packet,
        route: {
          ...route,
          nodes: remainingNodes
        }
      };

      // Send to next node
      await this.networkManager.sendMessage(nextNodeId, {
        type: 'DATA_PACKET',
        id: this.crypto.generateRandomString(16),
        timestamp: new Date(),
        source: packet.source,
        destination: packet.destination,
        payload: forwardPacket,
        signature: ''
      });

      // Update route statistics
      this.updateRouteStats(route.id, packet.payload.length);
      
    } catch (error) {
      throw new NetworkNeuronError(`Packet forwarding failed: ${error.message}`, 'PACKET_FORWARD_ERROR');
    }
  }

  /**
   * Create client session
   */
  async createSession(clientId, requirements = {}) {
    try {
      // Find route for client
      const route = await this.findRoute(clientId, requirements);
      
      // Create session
      const session = {
        id: this.crypto.generateRandomString(16),
        clientId,
        nodeId: route.nodes[0],
        startTime: new Date(),
        bytesTransferred: 0,
        isActive: true,
        route
      };

      // Store session
      this.clientSessions.set(session.id, session);
      
      this.emit('session:created', session);
      
      return session;
      
    } catch (error) {
      throw new NetworkNeuronError(`Session creation failed: ${error.message}`, 'SESSION_CREATION_ERROR');
    }
  }

  /**
   * Close client session
   */
  closeSession(sessionId) {
    const session = this.clientSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.clientSessions.delete(sessionId);
      
      // Clean up route if no longer needed
      this.cleanupRoute(session.route.id);
      
      this.emit('session:closed', session);
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    return Array.from(this.clientSessions.values()).filter(session => session.isActive);
  }

  /**
   * Handle peer disconnection
   */
  handlePeerDisconnection(peerId) {
    // Remove routes that include the disconnected peer
    const routesToRemove = [];
    
    for (const [routeId, route] of this.activeRoutes) {
      if (route.nodes.includes(peerId.toString())) {
        routesToRemove.push(routeId);
      }
    }

    // Remove affected routes
    routesToRemove.forEach(routeId => {
      this.activeRoutes.delete(routeId);
      this.emit('route:removed', routeId, 'peer_disconnected');
    });

    // Close sessions using disconnected peer
    for (const [sessionId, session] of this.clientSessions) {
      if (session.route.nodes.includes(peerId.toString())) {
        this.closeSession(sessionId);
      }
    }
  }

  /**
   * Update node bandwidth information
   */
  updateNodeBandwidth(peerId, report) {
    // Update load balancer with new bandwidth information
    this.loadBalancer.updateNodeBandwidth(peerId.toString(), report.bandwidth);
    
    // Invalidate affected route cache
    this.invalidateRouteCache(peerId.toString());
  }

  /**
   * Get available nodes based on requirements
   */
  getAvailableNodes(requirements) {
    const nodes = this.networkManager.getDiscoveredNodes();
    
    return nodes.filter(node => {
      // Check if node is active
      if (!node.isActive) return false;
      
      // Check bandwidth requirements
      if (requirements.minBandwidth && 
          node.bandwidth.download < requirements.minBandwidth) {
        return false;
      }
      
      // Check latency requirements
      if (requirements.maxLatency && 
          node.bandwidth.latency > requirements.maxLatency) {
        return false;
      }
      
      // Check region requirements
      if (requirements.regions && 
          !requirements.regions.includes(node.region)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Validate data packet
   */
  validatePacket(packet) {
    if (!packet.id || !packet.source || !packet.destination) {
      throw new NetworkNeuronError('Invalid packet: missing required fields', 'INVALID_PACKET');
    }
    
    if (!packet.route || !packet.route.nodes || packet.route.nodes.length === 0) {
      throw new NetworkNeuronError('Invalid packet: no route specified', 'INVALID_PACKET');
    }
    
    if (!packet.payload || packet.payload.length === 0) {
      throw new NetworkNeuronError('Invalid packet: no payload', 'INVALID_PACKET');
    }
  }

  /**
   * Encrypt packet payload
   */
  async encryptPacket(packet) {
    try {
      const key = this.crypto.generateSymmetricKey();
      const encrypted = this.crypto.encrypt(packet.payload, key);
      
      return {
        encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        key: key // In production, this would be encrypted with recipient's public key
      };
    } catch (error) {
      throw new NetworkNeuronError(`Packet encryption failed: ${error.message}`, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Generate cache key for route
   */
  generateCacheKey(destination, requirements) {
    const reqStr = JSON.stringify(requirements);
    return `${destination}:${this.crypto.hash(reqStr)}`;
  }

  /**
   * Cache route
   */
  cacheRoute(key, route) {
    // Implement LRU cache
    if (this.routeCache.size >= this.maxCacheSize) {
      const firstKey = this.routeCache.keys().next().value;
      this.routeCache.delete(firstKey);
    }
    
    this.routeCache.set(key, route);
  }

  /**
   * Invalidate route cache for a node
   */
  invalidateRouteCache(nodeId) {
    const keysToDelete = [];
    
    for (const [key, route] of this.routeCache) {
      if (route.nodes.includes(nodeId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.routeCache.delete(key));
  }

  /**
   * Update route statistics
   */
  updateRouteStats(routeId, bytesTransferred) {
    const route = this.activeRoutes.get(routeId);
    if (route) {
      // Update bandwidth usage
      route.bandwidthUsed = (route.bandwidthUsed || 0) + bytesTransferred;
      
      // Check if route needs to be refreshed
      if (route.bandwidthUsed > route.bandwidth * 0.8) {
        this.emit('route:bandwidth_warning', route);
      }
    }
  }

  /**
   * Clean up expired route
   */
  cleanupRoute(routeId) {
    const route = this.activeRoutes.get(routeId);
    if (route && route.expiresAt < new Date()) {
      this.activeRoutes.delete(routeId);
      this.emit('route:expired', routeId);
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return {
      activeRoutes: this.activeRoutes.size,
      activeSessions: this.getActiveSessions().length,
      cachedRoutes: this.routeCache.size,
      totalBytesTransferred: Array.from(this.clientSessions.values())
        .reduce((sum, session) => sum + session.bytesTransferred, 0)
    };
  }
}

/**
 * Load Balancer
 */
export class LoadBalancer {
  constructor() {
    this.nodeLoads = new Map();
    this.nodeCapacities = new Map();
  }

  /**
   * Select best node based on load and capacity
   */
  selectNode(requirements = {}) {
    const availableNodes = Array.from(this.nodeCapacities.keys());
    
    if (availableNodes.length === 0) {
      return null;
    }

    // Calculate load scores for each node
    const nodeScores = availableNodes.map(nodeId => {
      const load = this.nodeLoads.get(nodeId) || 0;
      const capacity = this.nodeCapacities.get(nodeId) || 1;
      const loadRatio = load / capacity;
      
      return {
        nodeId,
        score: 1 - loadRatio, // Lower load = higher score
        capacity,
        load
      };
    });

    // Sort by score (highest first)
    nodeScores.sort((a, b) => b.score - a.score);
    
    // Apply requirements filter
    const filteredScores = nodeScores.filter(node => {
      if (requirements.minCapacity && node.capacity < requirements.minCapacity) {
        return false;
      }
      return true;
    });

    return filteredScores.length > 0 ? filteredScores[0].nodeId : null;
  }

  /**
   * Update node bandwidth information
   */
  updateNodeBandwidth(nodeId, bandwidth) {
    this.nodeCapacities.set(nodeId, bandwidth.download);
  }

  /**
   * Update node load
   */
  updateNodeLoad(nodeId, load) {
    this.nodeLoads.set(nodeId, load);
  }

  /**
   * Get node load information
   */
  getNodeLoad(nodeId) {
    return {
      load: this.nodeLoads.get(nodeId) || 0,
      capacity: this.nodeCapacities.get(nodeId) || 0,
      utilization: (this.nodeLoads.get(nodeId) || 0) / (this.nodeCapacities.get(nodeId) || 1)
    };
  }
}

/**
 * Path Optimizer
 */
export class PathOptimizer {
  constructor() {
    this.optimizationAlgorithms = {
      shortestPath: this.findShortestPath.bind(this),
      lowestLatency: this.findLowestLatency.bind(this),
      highestBandwidth: this.findHighestBandwidth.bind(this),
      balanced: this.findBalancedPath.bind(this)
    };
  }

  /**
   * Find optimal path based on requirements
   */
  async findOptimalPath(destination, availableNodes, requirements) {
    const algorithm = requirements.algorithm || 'balanced';
    const optimizer = this.optimizationAlgorithms[algorithm];
    
    if (!optimizer) {
      throw new NetworkNeuronError(`Unknown optimization algorithm: ${algorithm}`, 'UNKNOWN_ALGORITHM');
    }

    return await optimizer(destination, availableNodes, requirements);
  }

  /**
   * Find shortest path (minimum hops)
   */
  async findShortestPath(destination, availableNodes, requirements) {
    // Simple implementation - select node with best direct connection
    const bestNode = availableNodes.reduce((best, current) => {
      const bestScore = (best.bandwidth?.download || 0) - (best.bandwidth?.latency || 0);
      const currentScore = (current.bandwidth?.download || 0) - (current.bandwidth?.latency || 0);
      return currentScore > bestScore ? current : best;
    });

    return {
      nodes: [bestNode.id],
      latency: bestNode.bandwidth?.latency || 100,
      bandwidth: bestNode.bandwidth?.download || 10,
      cost: 1
    };
  }

  /**
   * Find lowest latency path
   */
  async findLowestLatency(destination, availableNodes, requirements) {
    const sortedNodes = availableNodes.sort((a, b) => 
      (a.bandwidth?.latency || 0) - (b.bandwidth?.latency || 0)
    );

    return {
      nodes: [sortedNodes[0].id],
      latency: sortedNodes[0].bandwidth?.latency || 100,
      bandwidth: sortedNodes[0].bandwidth?.download || 10,
      cost: 1
    };
  }

  /**
   * Find highest bandwidth path
   */
  async findHighestBandwidth(destination, availableNodes, requirements) {
    const sortedNodes = availableNodes.sort((a, b) => 
      (b.bandwidth?.download || 0) - (a.bandwidth?.download || 0)
    );

    return {
      nodes: [sortedNodes[0].id],
      latency: sortedNodes[0].bandwidth?.latency || 100,
      bandwidth: sortedNodes[0].bandwidth?.download || 10,
      cost: 1
    };
  }

  /**
   * Find balanced path (considering multiple factors)
   */
  async findBalancedPath(destination, availableNodes, requirements) {
    const scoredNodes = availableNodes.map(node => {
      const bandwidthScore = (node.bandwidth?.download || 0) / 100;
      const latencyScore = 1 - ((node.bandwidth?.latency || 0) / 1000);
      const reputationScore = (node.reputation || 0) / 100;
      const uptimeScore = (node.bandwidth?.uptime || 0) / 100;
      
      const totalScore = (bandwidthScore * 0.4) + 
                       (latencyScore * 0.3) + 
                       (reputationScore * 0.2) + 
                       (uptimeScore * 0.1);
      
      return {
        node,
        score: totalScore
      };
    });

    scoredNodes.sort((a, b) => b.score - a.score);
    const bestNode = scoredNodes[0].node;

    return {
      nodes: [bestNode.id],
      latency: bestNode.bandwidth?.latency || 100,
      bandwidth: bestNode.bandwidth?.download || 10,
      cost: 1
    };
  }
}
