/**
 * NetworkNeuron Main Protocol Implementation
 * 
 * This is the main entry point for the NetworkNeuron protocol,
 * integrating all components into a cohesive dVPN system.
 */

import { EventEmitter } from 'events';
import { P2PNetworkManager } from '../network/p2p.js';
import { TrafficRouter } from '../routing/router.js';
import { CryptoManager, KeyManager } from '../crypto/crypto.js';
import { 
  NetworkNeuronProtocol, 
  NetworkNode, 
  NetworkStats, 
  ClientSession, 
  RouteRequirements,
  ProtocolConfig,
  NetworkNeuronError 
} from '../core/types.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main NetworkNeuron Protocol Implementation
 */
export class NetworkNeuron extends EventEmitter implements NetworkNeuronProtocol {
  constructor(config = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    this.crypto = new CryptoManager();
    this.keyManager = new KeyManager();
    
    // Initialize components
    this.networkManager = new P2PNetworkManager(this.config);
    this.trafficRouter = new TrafficRouter(this.networkManager, this.config);
    
    // Initialize web server for management interface
    this.app = express();
    this.server = null;
    
    // Initialize logging
    this.logger = this.setupLogger();
    
    // State management
    this.isStarted = false;
    this.nodeInfo = null;
    this.stats = {
      totalNodes: 0,
      activeNodes: 0,
      totalBandwidth: 0,
      averageLatency: 0,
      networkHealth: 0,
      totalStake: 0
    };
    
    this.setupEventHandlers();
    this.setupWebServer();
  }

  /**
   * Merge configuration with defaults
   */
  mergeConfig(userConfig) {
    const defaults = {
      nodeId: process.env.NODE_ID || 'node-' + Math.random().toString(36).substr(2, 9),
      port: parseInt(process.env.NODE_PORT) || 3000,
      host: process.env.NODE_HOST || '0.0.0.0',
      bootstrapNodes: JSON.parse(process.env.BOOTSTRAP_NODES || '[]'),
      maxPeers: parseInt(process.env.MAX_PEERS) || 50,
      minPeers: parseInt(process.env.MIN_PEERS) || 5,
      logLevel: process.env.LOG_LEVEL || 'info',
      region: process.env.NODE_REGION || 'auto',
      stake: parseInt(process.env.STAKE) || 1000,
      managementPort: parseInt(process.env.MANAGEMENT_PORT) || 8080,
      ...userConfig
    };

    // Generate key pair if not provided
    if (!defaults.publicKey || !defaults.privateKey) {
      const keyPair = this.crypto.generateKeyPair();
      defaults.publicKey = keyPair.publicKey;
      defaults.privateKey = keyPair.privateKey;
    }

    return defaults;
  }

  /**
   * Set up logging
   */
  setupLogger() {
    return winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: process.env.LOG_FILE || 'networkneuron.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Network manager events
    this.networkManager.on('started', (peerId) => {
      this.logger.info(`P2P network started with peer ID: ${peerId}`);
      this.emit('network:started', peerId);
    });

    this.networkManager.on('peer:connected', (peerId) => {
      this.logger.info(`Peer connected: ${peerId.toString()}`);
      this.updateStats();
      this.emit('peer:connected', peerId);
    });

    this.networkManager.on('peer:disconnected', (peerId) => {
      this.logger.info(`Peer disconnected: ${peerId.toString()}`);
      this.updateStats();
      this.emit('peer:disconnected', peerId);
    });

    // Traffic router events
    this.trafficRouter.on('session:created', (session) => {
      this.logger.info(`Client session created: ${session.id}`);
      this.emit('session:created', session);
    });

    this.trafficRouter.on('packet:sent', (packet) => {
      this.emit('packet:sent', packet);
    });

    // Periodic stats update
    setInterval(() => {
      this.updateStats();
    }, 30000); // Every 30 seconds
  }

  /**
   * Set up web server for management interface
   */
  setupWebServer() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    // API routes
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: this.isStarted ? 'running' : 'stopped',
        nodeInfo: this.nodeInfo,
        stats: this.stats,
        uptime: this.isStarted ? Date.now() - this.startTime : 0
      });
    });

    this.app.get('/api/peers', (req, res) => {
      res.json({
        connected: this.networkManager.getConnectedPeers(),
        discovered: this.networkManager.getDiscoveredNodes()
      });
    });

    this.app.get('/api/sessions', (req, res) => {
      res.json({
        active: this.trafficRouter.getActiveSessions(),
        stats: this.trafficRouter.getRoutingStats()
      });
    });

    this.app.get('/api/routes', (req, res) => {
      res.json({
        active: Array.from(this.trafficRouter.activeRoutes.values()),
        cached: Array.from(this.trafficRouter.routeCache.values())
      });
    });

    this.app.post('/api/route', async (req, res) => {
      try {
        const { destination, requirements } = req.body;
        const route = await this.findRoute(destination, requirements);
        res.json({ route });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.post('/api/session', async (req, res) => {
      try {
        const { clientId, requirements } = req.body;
        const session = await this.createSession(clientId, requirements);
        res.json({ session });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.delete('/api/session/:id', (req, res) => {
      try {
        this.closeSession(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Serve static files for web interface
    this.app.use(express.static('public'));
  }

  /**
   * Start the NetworkNeuron node
   */
  async start() {
    try {
      this.logger.info('Starting NetworkNeuron node...');
      
      // Start P2P network
      await this.networkManager.start();
      
      // Initialize node info
      this.nodeInfo = await this.networkManager.getNodeInfo();
      
      // Start web server
      this.server = this.app.listen(this.config.managementPort, () => {
        this.logger.info(`Management interface available at http://localhost:${this.config.managementPort}`);
      });
      
      this.isStarted = true;
      this.startTime = Date.now();
      
      this.logger.info('NetworkNeuron node started successfully');
      this.emit('started');
      
    } catch (error) {
      this.logger.error(`Failed to start node: ${error.message}`);
      throw new NetworkNeuronError(`Node startup failed: ${error.message}`, 'STARTUP_ERROR');
    }
  }

  /**
   * Stop the NetworkNeuron node
   */
  async stop() {
    try {
      this.logger.info('Stopping NetworkNeuron node...');
      
      // Stop web server
      if (this.server) {
        this.server.close();
      }
      
      // Stop P2P network
      await this.networkManager.stop();
      
      this.isStarted = false;
      
      this.logger.info('NetworkNeuron node stopped');
      this.emit('stopped');
      
    } catch (error) {
      this.logger.error(`Failed to stop node: ${error.message}`);
      throw new NetworkNeuronError(`Node shutdown failed: ${error.message}`, 'SHUTDOWN_ERROR');
    }
  }

  /**
   * Get node information
   */
  getNodeInfo() {
    return this.nodeInfo;
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    return this.stats;
  }

  /**
   * Update network statistics
   */
  updateStats() {
    this.stats = this.networkManager.getNetworkStats();
    this.emit('stats:updated', this.stats);
  }

  /**
   * Add peer to the network
   */
  async addPeer(peerId, multiaddr) {
    await this.networkManager.libp2p.dial(peerId);
  }

  /**
   * Remove peer from the network
   */
  removePeer(peerId) {
    this.networkManager.libp2p.hangUp(peerId);
  }

  /**
   * Get connected peers
   */
  getPeers() {
    return this.networkManager.getDiscoveredNodes();
  }

  /**
   * Find route to destination
   */
  async findRoute(destination, requirements = {}) {
    return await this.trafficRouter.findRoute(destination, requirements);
  }

  /**
   * Send data packet
   */
  async sendPacket(packet) {
    return await this.trafficRouter.sendPacket(packet);
  }

  /**
   * Create client session
   */
  async createSession(clientId, requirements = {}) {
    return await this.trafficRouter.createSession(clientId, requirements);
  }

  /**
   * Close client session
   */
  closeSession(sessionId) {
    this.trafficRouter.closeSession(sessionId);
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    return this.trafficRouter.getActiveSessions();
  }

  /**
   * Calculate reward for node operator
   */
  async calculateReward(nodeId, period = 'daily') {
    // This is a simplified implementation
    // In a real system, this would integrate with a blockchain or token system
    
    const sessions = this.getActiveSessions();
    const nodeSessions = sessions.filter(session => session.nodeId === nodeId);
    
    const totalBytes = nodeSessions.reduce((sum, session) => sum + session.bytesTransferred, 0);
    const rewardRate = parseFloat(process.env.REWARD_RATE) || 0.1;
    
    return {
      nodeId,
      amount: totalBytes * rewardRate,
      period,
      bandwidthProvided: totalBytes,
      sessionsServed: nodeSessions.length,
      timestamp: new Date()
    };
  }

  /**
   * Claim reward for node operator
   */
  async claimReward(nodeId) {
    // This would integrate with a token system in a real implementation
    this.logger.info(`Reward claimed for node ${nodeId}`);
    this.emit('reward:claimed', nodeId);
  }

  /**
   * Get node health status
   */
  getHealthStatus() {
    const stats = this.getNetworkStats();
    const sessions = this.getActiveSessions();
    
    return {
      status: this.isStarted ? 'healthy' : 'stopped',
      uptime: this.isStarted ? Date.now() - this.startTime : 0,
      peers: {
        connected: stats.activeNodes,
        total: stats.totalNodes
      },
      sessions: {
        active: sessions.length,
        total: sessions.reduce((sum, s) => sum + s.bytesTransferred, 0)
      },
      bandwidth: {
        total: stats.totalBandwidth,
        average: stats.averageLatency
      },
      health: stats.networkHealth
    };
  }

  /**
   * Restart the node
   */
  async restart() {
    this.logger.info('Restarting NetworkNeuron node...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.start();
  }

  /**
   * Update node configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuration updated');
    this.emit('config:updated', this.config);
  }
}

/**
 * CLI Interface for NetworkNeuron
 */
export class NetworkNeuronCLI {
  constructor() {
    this.node = null;
  }

  /**
   * Initialize a new node
   */
  async init(options = {}) {
    console.log('Initializing NetworkNeuron node...');
    
    const config = {
      nodeId: options.nodeId || `node-${Date.now()}`,
      port: options.port || 3000,
      host: options.host || '0.0.0.0',
      region: options.region || 'auto',
      stake: options.stake || 1000,
      ...options
    };

    this.node = new NetworkNeuron(config);
    
    console.log(`Node initialized with ID: ${config.nodeId}`);
    console.log(`Configuration:`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Host: ${config.host}`);
    console.log(`  Region: ${config.region}`);
    console.log(`  Stake: ${config.stake}`);
    
    return this.node;
  }

  /**
   * Start the node
   */
  async start() {
    if (!this.node) {
      throw new Error('Node not initialized. Run init() first.');
    }

    console.log('Starting NetworkNeuron node...');
    await this.node.start();
    console.log('Node started successfully!');
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      await this.node.stop();
      process.exit(0);
    });
  }

  /**
   * Stop the node
   */
  async stop() {
    if (this.node) {
      await this.node.stop();
      console.log('Node stopped');
    }
  }

  /**
   * Get node status
   */
  getStatus() {
    if (!this.node) {
      return { status: 'not_initialized' };
    }

    return this.node.getHealthStatus();
  }
}

// Export main classes
export { NetworkNeuron, NetworkNeuronCLI };
export default NetworkNeuron;
