/**
 * NetworkNeuron Core Protocol Implementation
 * 
 * This module defines the core interfaces and types for the NetworkNeuron
 * decentralized VPN protocol.
 */

import { EventEmitter } from 'events';
import { PeerId } from '@libp2p/interface-peer-id';
import { Multiaddr } from '@multiformats/multiaddr';

/**
 * Core protocol message types
 */
export const MessageType = {
  HANDSHAKE: 'handshake',
  ROUTE_REQUEST: 'route_request',
  ROUTE_RESPONSE: 'route_response',
  DATA_PACKET: 'data_packet',
  HEARTBEAT: 'heartbeat',
  NODE_DISCOVERY: 'node_discovery',
  BANDWIDTH_REPORT: 'bandwidth_report',
  REWARD_CLAIM: 'reward_claim',
  ERROR: 'error'
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

/**
 * Network node information
 */
export interface NetworkNode {
  id: string;
  peerId: PeerId;
  multiaddr: Multiaddr;
  publicKey: string;
  bandwidth: BandwidthInfo;
  reputation: number;
  region: string;
  isActive: boolean;
  lastSeen: Date;
  stake: number;
}

/**
 * Bandwidth information for a node
 */
export interface BandwidthInfo {
  upload: number;    // Mbps
  download: number;  // Mbps
  latency: number;   // ms
  uptime: number;    // percentage
  capacity: number;  // total capacity in Mbps
}

/**
 * Route information for data packets
 */
export interface Route {
  id: string;
  nodes: string[];  // Array of node IDs forming the route
  latency: number;
  bandwidth: number;
  cost: number;     // Cost in tokens
  encrypted: boolean;
  expiresAt: Date;
}

/**
 * Data packet structure
 */
export interface DataPacket {
  id: string;
  source: string;
  destination: string;
  route: Route;
  payload: Uint8Array;
  timestamp: Date;
  signature: string;
  encrypted: boolean;
}

/**
 * Protocol message structure
 */
export interface ProtocolMessage {
  type: MessageType;
  id: string;
  timestamp: Date;
  source: string;
  destination?: string;
  payload: any;
  signature: string;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalBandwidth: number;
  averageLatency: number;
  networkHealth: number;
  totalStake: number;
}

/**
 * Client session information
 */
export interface ClientSession {
  id: string;
  clientId: string;
  nodeId: string;
  startTime: Date;
  bytesTransferred: number;
  isActive: boolean;
  route: Route;
}

/**
 * Reward information for node operators
 */
export interface RewardInfo {
  nodeId: string;
  amount: number;
  period: string;
  bandwidthProvided: number;
  sessionsServed: number;
  timestamp: Date;
}

/**
 * Core protocol interface
 */
export interface NetworkNeuronProtocol extends EventEmitter {
  // Node management
  start(): Promise<void>;
  stop(): Promise<void>;
  getNodeInfo(): NetworkNode;
  getNetworkStats(): NetworkStats;
  
  // Peer management
  addPeer(peerId: PeerId, multiaddr: Multiaddr): Promise<void>;
  removePeer(peerId: PeerId): void;
  getPeers(): NetworkNode[];
  
  // Routing
  findRoute(destination: string, requirements: RouteRequirements): Promise<Route>;
  sendPacket(packet: DataPacket): Promise<void>;
  
  // Client management
  createSession(clientId: string): Promise<ClientSession>;
  closeSession(sessionId: string): void;
  getActiveSessions(): ClientSession[];
  
  // Rewards
  calculateReward(nodeId: string, period: string): Promise<RewardInfo>;
  claimReward(nodeId: string): Promise<void>;
}

/**
 * Route requirements for finding optimal paths
 */
export interface RouteRequirements {
  minBandwidth?: number;
  maxLatency?: number;
  maxCost?: number;
  regions?: string[];
  encryption?: boolean;
  redundancy?: number;
}

/**
 * Protocol configuration
 */
export interface ProtocolConfig {
  nodeId: string;
  port: number;
  host: string;
  bootstrapNodes: string[];
  maxPeers: number;
  minPeers: number;
  encryptionKey: string;
  logLevel: string;
  region: string;
  stake: number;
}

/**
 * Error types
 */
export class NetworkNeuronError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'NetworkNeuronError';
  }
}

export class RouteNotFoundError extends NetworkNeuronError {
  constructor(destination: string) {
    super(`No route found to ${destination}`, 'ROUTE_NOT_FOUND', { destination });
  }
}

export class InsufficientBandwidthError extends NetworkNeuronError {
  constructor(required: number, available: number) {
    super(`Insufficient bandwidth: required ${required}Mbps, available ${available}Mbps`, 
          'INSUFFICIENT_BANDWIDTH', { required, available });
  }
}

export class AuthenticationError extends NetworkNeuronError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR');
  }
}

export class EncryptionError extends NetworkNeuronError {
  constructor(message: string = 'Encryption/decryption failed') {
    super(message, 'ENCRYPTION_ERROR');
  }
}
