// Core types for the NetworkNeuron application

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'admin' | 'operator' | 'user';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  nodeId?: string;
}

export interface Node {
  id: string;
  name: string;
  peerId: string;
  publicKey: string;
  multiaddr: string;
  region: string;
  status: 'online' | 'offline' | 'maintenance';
  bandwidth: BandwidthInfo;
  reputation: number;
  stake: number;
  isActive: boolean;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
  operatorId: string;
  operator?: User;
}

export interface BandwidthInfo {
  upload: number;    // Mbps
  download: number;  // Mbps
  latency: number;   // ms
  uptime: number;    // percentage
  capacity: number;  // total capacity in Mbps
}

export interface Session {
  id: string;
  clientId: string;
  nodeId: string;
  node?: Node;
  startTime: string;
  endTime?: string;
  bytesTransferred: number;
  isActive: boolean;
  route: Route;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  nodes: string[];
  latency: number;
  bandwidth: number;
  cost: number;
  encrypted: boolean;
  expiresAt: string;
}

export interface Reward {
  id: string;
  nodeId: string;
  node?: Node;
  amount: number;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  bandwidthProvided: number;
  sessionsServed: number;
  timestamp: string;
  claimed: boolean;
  claimedAt?: string;
}

export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalBandwidth: number;
  averageLatency: number;
  networkHealth: number;
  totalStake: number;
  totalSessions: number;
  activeSessions: number;
  totalRewards: number;
  lastUpdated: string;
}

export interface NodeStats {
  nodeId: string;
  uptime: number;
  bandwidthUsed: number;
  sessionsServed: number;
  rewardsEarned: number;
  reputation: number;
  lastActivity: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalBytesTransferred: number;
  averageSessionDuration: number;
  topNodes: Array<{
    nodeId: string;
    sessions: number;
    bytesTransferred: number;
  }>;
}

export interface RewardStats {
  totalRewards: number;
  claimedRewards: number;
  pendingRewards: number;
  topEarners: Array<{
    nodeId: string;
    amount: number;
    period: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  nodeStatus: boolean;
  sessionAlerts: boolean;
  rewardNotifications: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  dashboard: {
    widgets: string[];
    layout: string;
  };
}
