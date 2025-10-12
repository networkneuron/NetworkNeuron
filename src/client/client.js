/**
 * NetworkNeuron Client Application
 * 
 * Provides a user-friendly interface for connecting to the NetworkNeuron
 * decentralized VPN network.
 */

import { EventEmitter } from 'events';
import { CryptoManager } from '../crypto/crypto.js';
import { NetworkNeuronError, DataPacket, RouteRequirements } from '../core/types.js';
import WebSocket from 'ws';

/**
 * NetworkNeuron Client
 */
export class NetworkNeuronClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3000',
      clientId: config.clientId || this.generateClientId(),
      autoReconnect: config.autoReconnect !== false,
      maxRetries: config.maxRetries || 5,
      reconnectDelay: config.reconnectDelay || 5000,
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.crypto = new CryptoManager();
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.retryCount = 0;
    this.session = null;
    this.route = null;
    this.tunnelActive = false;
    
    this.setupEventHandlers();
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return 'client-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Handle connection events
    this.on('connected', () => {
      this.isConnected = true;
      this.retryCount = 0;
      console.log('Connected to NetworkNeuron network');
    });

    this.on('disconnected', () => {
      this.isConnected = false;
      this.session = null;
      this.route = null;
      this.tunnelActive = false;
      console.log('Disconnected from NetworkNeuron network');
      
      // Auto-reconnect if enabled
      if (this.config.autoReconnect && this.retryCount < this.config.maxRetries) {
        setTimeout(() => {
          this.connect();
        }, this.config.reconnectDelay);
      }
    });

    this.on('error', (error) => {
      console.error('Client error:', error.message);
    });
  }

  /**
   * Connect to the NetworkNeuron network
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      this.retryCount++;
      
      console.log(`Connecting to NetworkNeuron network... (attempt ${this.retryCount})`);
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.config.serverUrl, {
        timeout: this.config.timeout
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();
      
    } catch (error) {
      this.isConnecting = false;
      throw new NetworkNeuronError(`Connection failed: ${error.message}`, 'CONNECTION_ERROR');
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.ws.on('open', () => {
      this.isConnecting = false;
      this.emit('connected');
      
      // Send handshake message
      this.sendHandshake();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.isConnecting = false;
      this.emit('disconnected', { code, reason: reason.toString() });
    });

    this.ws.on('error', (error) => {
      this.isConnecting = false;
      this.emit('error', error);
    });
  }

  /**
   * Send handshake message to server
   */
  sendHandshake() {
    const handshake = {
      type: 'handshake',
      clientId: this.config.clientId,
      timestamp: new Date(),
      capabilities: ['tunneling', 'encryption'],
      version: '1.0.0'
    };

    this.sendMessage(handshake);
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'handshake_response':
        this.handleHandshakeResponse(message);
        break;
      case 'route_response':
        this.handleRouteResponse(message);
        break;
      case 'tunnel_data':
        this.handleTunnelData(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle handshake response
   */
  handleHandshakeResponse(message) {
    console.log('Handshake completed successfully');
    this.emit('handshake:completed', message);
  }

  /**
   * Handle route response
   */
  handleRouteResponse(message) {
    this.route = message.route;
    console.log('Route established:', this.route);
    this.emit('route:established', this.route);
  }

  /**
   * Handle tunnel data
   */
  handleTunnelData(message) {
    // Decrypt and process tunnel data
    try {
      const decryptedData = this.decryptTunnelData(message.data);
      this.emit('tunnel:data', decryptedData);
    } catch (error) {
      console.error('Failed to decrypt tunnel data:', error.message);
    }
  }

  /**
   * Handle error messages
   */
  handleError(message) {
    console.error('Server error:', message.error);
    this.emit('error', new NetworkNeuronError(message.error, message.code));
  }

  /**
   * Send message to server
   */
  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new NetworkNeuronError('Not connected to server', 'NOT_CONNECTED');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Request a route to a destination
   */
  async requestRoute(destination, requirements = {}) {
    const routeRequest = {
      type: 'route_request',
      destination,
      requirements: {
        minBandwidth: requirements.minBandwidth || 1,
        maxLatency: requirements.maxLatency || 1000,
        encryption: requirements.encryption !== false,
        ...requirements
      },
      timestamp: new Date()
    };

    this.sendMessage(routeRequest);
    this.emit('route:requested', destination, requirements);
  }

  /**
   * Start tunneling through the network
   */
  async startTunnel(destination, requirements = {}) {
    try {
      // Request route first
      await this.requestRoute(destination, requirements);
      
      // Wait for route to be established
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new NetworkNeuronError('Route request timeout', 'ROUTE_TIMEOUT'));
        }, this.config.timeout);

        this.once('route:established', (route) => {
          clearTimeout(timeout);
          this.tunnelActive = true;
          this.emit('tunnel:started', route);
          resolve(route);
        });

        this.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
    } catch (error) {
      throw new NetworkNeuronError(`Tunnel start failed: ${error.message}`, 'TUNNEL_START_ERROR');
    }
  }

  /**
   * Stop tunneling
   */
  stopTunnel() {
    if (this.tunnelActive) {
      this.tunnelActive = false;
      this.route = null;
      this.emit('tunnel:stopped');
      console.log('Tunnel stopped');
    }
  }

  /**
   * Send data through the tunnel
   */
  async sendTunnelData(data, destination) {
    if (!this.tunnelActive || !this.route) {
      throw new NetworkNeuronError('Tunnel not active', 'TUNNEL_NOT_ACTIVE');
    }

    try {
      // Encrypt data
      const encryptedData = this.encryptTunnelData(data);
      
      // Create data packet
      const packet = {
        type: 'tunnel_data',
        data: encryptedData,
        destination,
        timestamp: new Date()
      };

      this.sendMessage(packet);
      
    } catch (error) {
      throw new NetworkNeuronError(`Failed to send tunnel data: ${error.message}`, 'TUNNEL_SEND_ERROR');
    }
  }

  /**
   * Encrypt tunnel data
   */
  encryptTunnelData(data) {
    try {
      const key = this.crypto.generateSymmetricKey();
      const encrypted = this.crypto.encrypt(Buffer.from(data), key);
      
      return {
        encrypted: encrypted.encrypted.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        key: key.toString('base64')
      };
    } catch (error) {
      throw new NetworkNeuronError(`Encryption failed: ${error.message}`, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Decrypt tunnel data
   */
  decryptTunnelData(encryptedData) {
    try {
      const decrypted = this.crypto.decrypt(
        Buffer.from(encryptedData.encrypted, 'base64'),
        Buffer.from(encryptedData.key, 'base64'),
        Buffer.from(encryptedData.iv, 'base64'),
        Buffer.from(encryptedData.tag, 'base64')
      );
      
      return decrypted.toString();
    } catch (error) {
      throw new NetworkNeuronError(`Decryption failed: ${error.message}`, 'DECRYPTION_ERROR');
    }
  }

  /**
   * Disconnect from the network
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.tunnelActive = false;
    this.session = null;
    this.route = null;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      tunnelActive: this.tunnelActive,
      route: this.route,
      session: this.session,
      retryCount: this.retryCount
    };
  }

  /**
   * Get client information
   */
  getClientInfo() {
    return {
      clientId: this.config.clientId,
      version: '1.0.0',
      capabilities: ['tunneling', 'encryption'],
      status: this.getStatus()
    };
  }
}

/**
 * Simple HTTP Proxy for easy integration
 */
export class NetworkNeuronProxy {
  constructor(client, config = {}) {
    this.client = client;
    this.config = {
      proxyPort: config.proxyPort || 8080,
      targetHost: config.targetHost || 'localhost',
      targetPort: config.targetPort || 80,
      ...config
    };
    
    this.isRunning = false;
    this.server = null;
  }

  /**
   * Start the HTTP proxy
   */
  async start() {
    try {
      // Ensure client is connected
      if (!this.client.isConnected) {
        await this.client.connect();
      }

      // Start tunnel
      await this.client.startTunnel(this.config.targetHost, {
        minBandwidth: 1,
        maxLatency: 1000
      });

      console.log(`HTTP proxy started on port ${this.config.proxyPort}`);
      this.isRunning = true;
      
    } catch (error) {
      throw new NetworkNeuronError(`Proxy start failed: ${error.message}`, 'PROXY_START_ERROR');
    }
  }

  /**
   * Stop the HTTP proxy
   */
  stop() {
    if (this.isRunning) {
      this.client.stopTunnel();
      this.isRunning = false;
      console.log('HTTP proxy stopped');
    }
  }

  /**
   * Get proxy status
   */
  getStatus() {
    return {
      running: this.isRunning,
      clientStatus: this.client.getStatus(),
      config: this.config
    };
  }
}

/**
 * CLI Interface for NetworkNeuron Client
 */
export class NetworkNeuronClientCLI {
  constructor() {
    this.client = null;
    this.proxy = null;
  }

  /**
   * Initialize client
   */
  init(options = {}) {
    this.client = new NetworkNeuronClient(options);
    return this.client;
  }

  /**
   * Connect to network
   */
  async connect() {
    if (!this.client) {
      throw new Error('Client not initialized. Run init() first.');
    }

    await this.client.connect();
  }

  /**
   * Start tunnel
   */
  async startTunnel(destination, requirements = {}) {
    if (!this.client) {
      throw new Error('Client not initialized.');
    }

    await this.client.startTunnel(destination, requirements);
  }

  /**
   * Start HTTP proxy
   */
  async startProxy(config = {}) {
    if (!this.client) {
      throw new Error('Client not initialized.');
    }

    this.proxy = new NetworkNeuronProxy(this.client, config);
    await this.proxy.start();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      client: this.client ? this.client.getStatus() : null,
      proxy: this.proxy ? this.proxy.getStatus() : null
    };
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.proxy) {
      this.proxy.stop();
    }
    
    if (this.client) {
      this.client.disconnect();
    }
  }
}

// Export classes
export { NetworkNeuronClient, NetworkNeuronProxy, NetworkNeuronClientCLI };
export default NetworkNeuronClient;
