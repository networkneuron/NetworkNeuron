/**
 * NetworkNeuron P2P Networking Module
 * 
 * Handles peer-to-peer networking, node discovery, and communication
 * using libp2p for the NetworkNeuron protocol.
 */

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { tcp } from '@libp2p/tcp';
import { noise } from '@libp2p/noise';
import { mplex } from '@libp2p/mplex';
import { kadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import { EventEmitter } from 'events';
import { PeerId } from '@libp2p/interface-peer-id';
import { Multiaddr } from '@multiformats/multiaddr';
import { createFromJSON } from '@libp2p/peer-id-factory';
import { NetworkNode, ProtocolMessage, MessageType, NetworkNeuronError } from '../core/types.js';
import { CryptoManager } from '../crypto/crypto.js';

/**
 * P2P Network Manager
 */
export class P2PNetworkManager extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.crypto = new CryptoManager();
    this.libp2p = null;
    this.peerId = null;
    this.connectedPeers = new Map();
    this.nodeRegistry = new Map();
    this.messageHandlers = new Map();
    this.isStarted = false;
    
    this.setupMessageHandlers();
  }

  /**
   * Initialize and start the P2P network
   */
  async start() {
    try {
      // Create or load peer ID
      this.peerId = await this.createPeerId();
      
      // Create libp2p instance
      this.libp2p = await createLibp2p({
        peerId: this.peerId,
        addresses: {
          listen: [`/ip4/${this.config.host}/tcp/${this.config.port}/ws`]
        },
        transports: [
          webSockets(),
          tcp()
        ],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        dht: kadDHT({
          kBucketSize: 20,
          clientMode: false
        }),
        peerDiscovery: [
          bootstrap({
            list: this.config.bootstrapNodes || []
          })
        ]
      });

      // Set up event handlers
      this.setupLibp2pHandlers();
      
      // Start libp2p
      await this.libp2p.start();
      
      this.isStarted = true;
      this.emit('started', this.peerId.toString());
      
      console.log(`NetworkNeuron node started with ID: ${this.peerId.toString()}`);
      console.log(`Listening on: ${this.libp2p.getMultiaddrs().map(addr => addr.toString()).join(', ')}`);
      
    } catch (error) {
      throw new NetworkNeuronError(`Failed to start P2P network: ${error.message}`, 'NETWORK_START_ERROR');
    }
  }

  /**
   * Stop the P2P network
   */
  async stop() {
    try {
      if (this.libp2p) {
        await this.libp2p.stop();
      }
      
      this.isStarted = false;
      this.connectedPeers.clear();
      this.nodeRegistry.clear();
      
      this.emit('stopped');
      console.log('NetworkNeuron node stopped');
      
    } catch (error) {
      throw new NetworkNeuronError(`Failed to stop P2P network: ${error.message}`, 'NETWORK_STOP_ERROR');
    }
  }

  /**
   * Create or load peer ID
   */
  async createPeerId() {
    try {
      // In a real implementation, you would load from persistent storage
      // For now, we'll create a new one each time
      return await createFromJSON({
        id: this.crypto.generateRandomString(52),
        privKey: this.crypto.generateRandomString(32),
        pubKey: this.crypto.generateRandomString(32)
      });
    } catch (error) {
      throw new NetworkNeuronError(`Failed to create peer ID: ${error.message}`, 'PEER_ID_ERROR');
    }
  }

  /**
   * Set up libp2p event handlers
   */
  setupLibp2pHandlers() {
    this.libp2p.addEventListener('peer:connect', (event) => {
      const peerId = event.detail;
      console.log(`Connected to peer: ${peerId.toString()}`);
      this.handlePeerConnect(peerId);
    });

    this.libp2p.addEventListener('peer:disconnect', (event) => {
      const peerId = event.detail;
      console.log(`Disconnected from peer: ${peerId.toString()}`);
      this.handlePeerDisconnect(peerId);
    });

    this.libp2p.addEventListener('peer:discovery', (event) => {
      const peerId = event.detail;
      console.log(`Discovered peer: ${peerId.toString()}`);
      this.handlePeerDiscovery(peerId);
    });
  }

  /**
   * Set up message handlers for different protocol messages
   */
  setupMessageHandlers() {
    this.messageHandlers.set(MessageType.HANDSHAKE, this.handleHandshake.bind(this));
    this.messageHandlers.set(MessageType.NODE_DISCOVERY, this.handleNodeDiscovery.bind(this));
    this.messageHandlers.set(MessageType.ROUTE_REQUEST, this.handleRouteRequest.bind(this));
    this.messageHandlers.set(MessageType.ROUTE_RESPONSE, this.handleRouteResponse.bind(this));
    this.messageHandlers.set(MessageType.DATA_PACKET, this.handleDataPacket.bind(this));
    this.messageHandlers.set(MessageType.HEARTBEAT, this.handleHeartbeat.bind(this));
    this.messageHandlers.set(MessageType.BANDWIDTH_REPORT, this.handleBandwidthReport.bind(this));
    this.messageHandlers.set(MessageType.ERROR, this.handleError.bind(this));
  }

  /**
   * Handle peer connection
   */
  async handlePeerConnect(peerId) {
    try {
      // Perform handshake with new peer
      await this.performHandshake(peerId);
      
      // Add to connected peers
      this.connectedPeers.set(peerId.toString(), {
        peerId,
        connectedAt: new Date(),
        lastSeen: new Date(),
        bandwidth: null,
        reputation: 0
      });
      
      this.emit('peer:connected', peerId);
      
    } catch (error) {
      console.error(`Failed to handle peer connection: ${error.message}`);
      this.emit('peer:connection-error', peerId, error);
    }
  }

  /**
   * Handle peer disconnection
   */
  handlePeerDisconnect(peerId) {
    this.connectedPeers.delete(peerId.toString());
    this.emit('peer:disconnected', peerId);
  }

  /**
   * Handle peer discovery
   */
  async handlePeerDiscovery(peerId) {
    try {
      // Try to connect to discovered peer
      await this.libp2p.dial(peerId);
    } catch (error) {
      console.log(`Failed to connect to discovered peer ${peerId.toString()}: ${error.message}`);
    }
  }

  /**
   * Perform handshake with a peer
   */
  async performHandshake(peerId) {
    try {
      const handshakeMessage = {
        type: MessageType.HANDSHAKE,
        id: this.crypto.generateRandomString(16),
        timestamp: new Date(),
        source: this.peerId.toString(),
        payload: {
          nodeInfo: await this.getNodeInfo(),
          capabilities: ['routing', 'bandwidth-sharing', 'encryption'],
          version: '1.0.0'
        },
        signature: ''
      };

      // Sign the handshake message
      handshakeMessage.signature = this.crypto.sign(
        JSON.stringify(handshakeMessage.payload),
        this.config.privateKey
      );

      // Send handshake message
      await this.sendMessage(peerId, handshakeMessage);
      
    } catch (error) {
      throw new NetworkNeuronError(`Handshake failed: ${error.message}`, 'HANDSHAKE_ERROR');
    }
  }

  /**
   * Handle incoming handshake message
   */
  async handleHandshake(message, peerId) {
    try {
      // Verify signature
      const isValid = this.crypto.verify(
        JSON.stringify(message.payload),
        message.signature,
        message.payload.nodeInfo.publicKey
      );

      if (!isValid) {
        throw new AuthenticationError('Invalid handshake signature');
      }

      // Store node information
      this.nodeRegistry.set(peerId.toString(), {
        ...message.payload.nodeInfo,
        peerId,
        lastSeen: new Date(),
        isActive: true
      });

      this.emit('handshake:completed', peerId, message.payload.nodeInfo);
      
    } catch (error) {
      console.error(`Handshake handling failed: ${error.message}`);
      this.emit('handshake:error', peerId, error);
    }
  }

  /**
   * Handle node discovery message
   */
  async handleNodeDiscovery(message, peerId) {
    try {
      // Process discovered nodes
      const discoveredNodes = message.payload.nodes;
      
      for (const nodeInfo of discoveredNodes) {
        if (!this.nodeRegistry.has(nodeInfo.id)) {
          this.nodeRegistry.set(nodeInfo.id, {
            ...nodeInfo,
            lastSeen: new Date(),
            isActive: true
          });
          
          this.emit('node:discovered', nodeInfo);
        }
      }
      
    } catch (error) {
      console.error(`Node discovery handling failed: ${error.message}`);
    }
  }

  /**
   * Handle route request message
   */
  async handleRouteRequest(message, peerId) {
    try {
      // Process route request and find optimal route
      const route = await this.findRoute(message.payload.destination, message.payload.requirements);
      
      const responseMessage = {
        type: MessageType.ROUTE_RESPONSE,
        id: this.crypto.generateRandomString(16),
        timestamp: new Date(),
        source: this.peerId.toString(),
        destination: message.source,
        payload: {
          requestId: message.id,
          route: route,
          alternatives: [] // Could include alternative routes
        },
        signature: ''
      };

      responseMessage.signature = this.crypto.sign(
        JSON.stringify(responseMessage.payload),
        this.config.privateKey
      );

      await this.sendMessage(peerId, responseMessage);
      
    } catch (error) {
      console.error(`Route request handling failed: ${error.message}`);
      
      // Send error response
      await this.sendErrorMessage(peerId, message.id, error.message);
    }
  }

  /**
   * Handle route response message
   */
  async handleRouteResponse(message, peerId) {
    try {
      this.emit('route:response', message.payload);
    } catch (error) {
      console.error(`Route response handling failed: ${error.message}`);
    }
  }

  /**
   * Handle data packet message
   */
  async handleDataPacket(message, peerId) {
    try {
      // Process and forward data packet
      this.emit('data:packet', message.payload);
    } catch (error) {
      console.error(`Data packet handling failed: ${error.message}`);
    }
  }

  /**
   * Handle heartbeat message
   */
  async handleHeartbeat(message, peerId) {
    try {
      // Update peer's last seen timestamp
      const peer = this.connectedPeers.get(peerId.toString());
      if (peer) {
        peer.lastSeen = new Date();
        peer.bandwidth = message.payload.bandwidth;
      }
      
      this.emit('peer:heartbeat', peerId, message.payload);
    } catch (error) {
      console.error(`Heartbeat handling failed: ${error.message}`);
    }
  }

  /**
   * Handle bandwidth report message
   */
  async handleBandwidthReport(message, peerId) {
    try {
      // Update node's bandwidth information
      const node = this.nodeRegistry.get(peerId.toString());
      if (node) {
        node.bandwidth = message.payload.bandwidth;
        node.lastSeen = new Date();
      }
      
      this.emit('bandwidth:report', peerId, message.payload);
    } catch (error) {
      console.error(`Bandwidth report handling failed: ${error.message}`);
    }
  }

  /**
   * Handle error message
   */
  async handleError(message, peerId) {
    console.error(`Received error from peer ${peerId.toString()}: ${message.payload.error}`);
    this.emit('peer:error', peerId, message.payload);
  }

  /**
   * Send a message to a specific peer
   */
  async sendMessage(peerId, message) {
    try {
      if (!this.libp2p) {
        throw new NetworkNeuronError('P2P network not started', 'NETWORK_NOT_STARTED');
      }

      // Ensure connection to peer
      await this.libp2p.dial(peerId);
      
      // Create stream for message
      const stream = await this.libp2p.dialProtocol(peerId, '/networkneuron/1.0.0');
      
      // Send message
      const messageData = JSON.stringify(message);
      stream.write(new TextEncoder().encode(messageData));
      
      // Close stream
      stream.close();
      
    } catch (error) {
      throw new NetworkNeuronError(`Failed to send message: ${error.message}`, 'MESSAGE_SEND_ERROR');
    }
  }

  /**
   * Send error message to peer
   */
  async sendErrorMessage(peerId, requestId, errorMessage) {
    const errorMsg = {
      type: MessageType.ERROR,
      id: this.crypto.generateRandomString(16),
      timestamp: new Date(),
      source: this.peerId.toString(),
      destination: peerId.toString(),
      payload: {
        requestId,
        error: errorMessage,
        code: 'PROCESSING_ERROR'
      },
      signature: ''
    };

    errorMsg.signature = this.crypto.sign(
      JSON.stringify(errorMsg.payload),
      this.config.privateKey
    );

    await this.sendMessage(peerId, errorMsg);
  }

  /**
   * Broadcast message to all connected peers
   */
  async broadcastMessage(message) {
    const promises = Array.from(this.connectedPeers.keys()).map(peerIdStr => {
      const peerId = this.connectedPeers.get(peerIdStr).peerId;
      return this.sendMessage(peerId, message).catch(error => {
        console.error(`Failed to send broadcast to ${peerIdStr}: ${error.message}`);
      });
    });

    await Promise.allSettled(promises);
  }

  /**
   * Find route to destination
   */
  async findRoute(destination, requirements) {
    // This is a simplified implementation
    // In a real system, this would use sophisticated routing algorithms
    
    const availableNodes = Array.from(this.nodeRegistry.values())
      .filter(node => node.isActive && node.id !== this.peerId.toString());
    
    if (availableNodes.length === 0) {
      throw new NetworkNeuronError('No available nodes for routing', 'NO_ROUTE');
    }

    // Simple route selection based on bandwidth and latency
    const sortedNodes = availableNodes.sort((a, b) => {
      const scoreA = (a.bandwidth?.download || 0) - (a.bandwidth?.latency || 0);
      const scoreB = (b.bandwidth?.download || 0) - (b.bandwidth?.latency || 0);
      return scoreB - scoreA;
    });

    return {
      id: this.crypto.generateRandomString(16),
      nodes: [sortedNodes[0].id],
      latency: sortedNodes[0].bandwidth?.latency || 100,
      bandwidth: sortedNodes[0].bandwidth?.download || 10,
      cost: 1,
      encrypted: true,
      expiresAt: new Date(Date.now() + 300000) // 5 minutes
    };
  }

  /**
   * Get node information
   */
  async getNodeInfo() {
    return {
      id: this.peerId.toString(),
      publicKey: this.config.publicKey,
      bandwidth: {
        upload: 100,
        download: 100,
        latency: 50,
        uptime: 99.9,
        capacity: 1000
      },
      reputation: 100,
      region: this.config.region || 'auto',
      isActive: true,
      lastSeen: new Date(),
      stake: this.config.stake || 0
    };
  }

  /**
   * Get connected peers
   */
  getConnectedPeers() {
    return Array.from(this.connectedPeers.values());
  }

  /**
   * Get discovered nodes
   */
  getDiscoveredNodes() {
    return Array.from(this.nodeRegistry.values());
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const connectedCount = this.connectedPeers.size;
    const discoveredCount = this.nodeRegistry.size;
    
    const totalBandwidth = Array.from(this.nodeRegistry.values())
      .reduce((sum, node) => sum + (node.bandwidth?.download || 0), 0);
    
    const averageLatency = Array.from(this.nodeRegistry.values())
      .reduce((sum, node) => sum + (node.bandwidth?.latency || 0), 0) / discoveredCount || 0;

    return {
      totalNodes: discoveredCount,
      activeNodes: connectedCount,
      totalBandwidth,
      averageLatency,
      networkHealth: connectedCount > 0 ? (connectedCount / discoveredCount) * 100 : 0,
      totalStake: Array.from(this.nodeRegistry.values())
        .reduce((sum, node) => sum + (node.stake || 0), 0)
    };
  }
}
