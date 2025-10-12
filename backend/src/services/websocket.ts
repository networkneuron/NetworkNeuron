import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { DatabaseService } from './database';
import { RedisService } from './redis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer;
  private databaseService: DatabaseService;
  private redisService: RedisService;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(io: SocketIOServer) {
    this.io = io;
    this.databaseService = DatabaseService.getInstance();
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(io?: SocketIOServer): WebSocketService {
    if (!WebSocketService.instance && io) {
      WebSocketService.instance = new WebSocketService(io);
    }
    return WebSocketService.instance;
  }

  public async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Authenticate socket connection
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      
      // Get user from database
      const user = await this.databaseService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        socket.emit('error', { message: 'Invalid user' });
        socket.disconnect();
        return;
      }

      // Store user info in socket
      socket.userId = user.id;
      socket.user = user;
      
      // Track connected user
      this.connectedUsers.set(user.id, socket.id);

      console.log(`🔌 User ${user.username} connected via WebSocket`);

      // Join user to their personal room
      socket.join(`user:${user.id}`);

      // Send initial data
      await this.sendInitialData(socket);

      // Set up event handlers
      this.setupEventHandlers(socket);

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  private async sendInitialData(socket: AuthenticatedSocket): Promise<void> {
    try {
      const userId = socket.userId!;

      // Send network stats
      const networkStats = await this.databaseService.getNetworkStats();
      socket.emit('network:stats', networkStats);

      // Send user's nodes if they're an operator
      if (socket.user?.role === 'operator' || socket.user?.role === 'admin') {
        const userNodes = await this.databaseService.getNodes({
          filters: { operatorId: userId },
          limit: 100,
        });
        socket.emit('nodes:list', userNodes);
      }

      // Send recent sessions
      const recentSessions = await this.databaseService.getRecentSessions(20);
      socket.emit('sessions:recent', recentSessions);

      // Send notifications
      const notifications = await this.getUserNotifications(userId);
      socket.emit('notifications', notifications);

    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  private setupEventHandlers(socket: AuthenticatedSocket): void {
    // Node management events
    socket.on('node:start', async (data) => {
      try {
        const { nodeId } = data;
        await this.handleNodeStart(socket, nodeId);
      } catch (error) {
        socket.emit('error', { message: 'Failed to start node', error: error.message });
      }
    });

    socket.on('node:stop', async (data) => {
      try {
        const { nodeId } = data;
        await this.handleNodeStop(socket, nodeId);
      } catch (error) {
        socket.emit('error', { message: 'Failed to stop node', error: error.message });
      }
    });

    socket.on('node:update-bandwidth', async (data) => {
      try {
        const { nodeId, bandwidth } = data;
        await this.handleNodeBandwidthUpdate(socket, nodeId, bandwidth);
      } catch (error) {
        socket.emit('error', { message: 'Failed to update bandwidth', error: error.message });
      }
    });

    // Session events
    socket.on('session:create', async (data) => {
      try {
        const { clientId, requirements } = data;
        await this.handleSessionCreate(socket, clientId, requirements);
      } catch (error) {
        socket.emit('error', { message: 'Failed to create session', error: error.message });
      }
    });

    socket.on('session:close', async (data) => {
      try {
        const { sessionId } = data;
        await this.handleSessionClose(socket, sessionId);
      } catch (error) {
        socket.emit('error', { message: 'Failed to close session', error: error.message });
      }
    });

    // Reward events
    socket.on('reward:claim', async (data) => {
      try {
        const { rewardId } = data;
        await this.handleRewardClaim(socket, rewardId);
      } catch (error) {
        socket.emit('error', { message: 'Failed to claim reward', error: error.message });
      }
    });

    // Real-time data requests
    socket.on('data:request', async (data) => {
      try {
        const { type, filters } = data;
        await this.handleDataRequest(socket, type, filters);
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch data', error: error.message });
      }
    });
  }

  private async handleNodeStart(socket: AuthenticatedSocket, nodeId: string): Promise<void> {
    const node = await this.databaseService.getNodeById(nodeId);
    
    if (!node || node.operatorId !== socket.userId) {
      socket.emit('error', { message: 'Node not found or unauthorized' });
      return;
    }

    // Update node status
    await this.databaseService.updateNode(nodeId, { status: 'online', lastSeen: new Date() });

    // Broadcast to all connected clients
    this.io.emit('node:status-changed', {
      nodeId,
      status: 'online',
      timestamp: new Date(),
    });

    socket.emit('node:started', { nodeId });
  }

  private async handleNodeStop(socket: AuthenticatedSocket, nodeId: string): Promise<void> {
    const node = await this.databaseService.getNodeById(nodeId);
    
    if (!node || node.operatorId !== socket.userId) {
      socket.emit('error', { message: 'Node not found or unauthorized' });
      return;
    }

    // Update node status
    await this.databaseService.updateNode(nodeId, { status: 'offline' });

    // Close active sessions for this node
    await this.databaseService.updateSession(nodeId, { isActive: false, endTime: new Date() });

    // Broadcast to all connected clients
    this.io.emit('node:status-changed', {
      nodeId,
      status: 'offline',
      timestamp: new Date(),
    });

    socket.emit('node:stopped', { nodeId });
  }

  private async handleNodeBandwidthUpdate(socket: AuthenticatedSocket, nodeId: string, bandwidth: any): Promise<void> {
    const node = await this.databaseService.getNodeById(nodeId);
    
    if (!node || node.operatorId !== socket.userId) {
      socket.emit('error', { message: 'Node not found or unauthorized' });
      return;
    }

    // Update bandwidth info
    await this.databaseService.updateNodeBandwidth(nodeId, bandwidth);

    // Broadcast bandwidth update
    this.io.emit('node:bandwidth-updated', {
      nodeId,
      bandwidth,
      timestamp: new Date(),
    });

    socket.emit('node:bandwidth-updated', { nodeId, bandwidth });
  }

  private async handleSessionCreate(socket: AuthenticatedSocket, clientId: string, requirements: any): Promise<void> {
    // Find available node
    const nodes = await this.databaseService.getNodes({
      filters: { status: 'online' },
      limit: 1,
    });

    if (nodes.data.length === 0) {
      socket.emit('error', { message: 'No available nodes' });
      return;
    }

    const node = nodes.data[0];
    
    // Create session
    const sessionData = {
      clientId,
      nodeId: node.id,
      startTime: new Date(),
      isActive: true,
      route: {
        id: `route-${Date.now()}`,
        nodes: [node.id],
        latency: node.bandwidth?.latency || 100,
        bandwidth: node.bandwidth?.download || 10,
        cost: 1,
        encrypted: true,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes
      },
    };

    const session = await this.databaseService.createSession(sessionData);

    // Broadcast new session
    this.io.emit('session:created', session);

    socket.emit('session:created', session);
  }

  private async handleSessionClose(socket: AuthenticatedSocket, sessionId: string): Promise<void> {
    const session = await this.databaseService.getSessionById(sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    // Update session
    await this.databaseService.updateSession(sessionId, {
      isActive: false,
      endTime: new Date(),
    });

    // Broadcast session closure
    this.io.emit('session:closed', {
      sessionId,
      timestamp: new Date(),
    });

    socket.emit('session:closed', { sessionId });
  }

  private async handleRewardClaim(socket: AuthenticatedSocket, rewardId: string): Promise<void> {
    const reward = await this.databaseService.getRewardById(rewardId);
    
    if (!reward) {
      socket.emit('error', { message: 'Reward not found' });
      return;
    }

    // Check if user owns the node
    const node = await this.databaseService.getNodeById(reward.nodeId);
    if (!node || node.operatorId !== socket.userId) {
      socket.emit('error', { message: 'Unauthorized to claim this reward' });
      return;
    }

    if (reward.claimed) {
      socket.emit('error', { message: 'Reward already claimed' });
      return;
    }

    // Mark reward as claimed
    await this.databaseService.updateReward(rewardId, {
      claimed: true,
      claimedAt: new Date(),
    });

    // Broadcast reward claim
    this.io.emit('reward:claimed', {
      rewardId,
      nodeId: reward.nodeId,
      amount: reward.amount,
      timestamp: new Date(),
    });

    socket.emit('reward:claimed', { rewardId, amount: reward.amount });
  }

  private async handleDataRequest(socket: AuthenticatedSocket, type: string, filters: any): Promise<void> {
    try {
      let data;

      switch (type) {
        case 'network-stats':
          data = await this.databaseService.getNetworkStats();
          break;
        case 'nodes':
          data = await this.databaseService.getNodes({ filters, limit: 50 });
          break;
        case 'sessions':
          data = await this.databaseService.getSessions({ filters, limit: 50 });
          break;
        case 'rewards':
          data = await this.databaseService.getRewards({ filters, limit: 50 });
          break;
        default:
          socket.emit('error', { message: 'Unknown data type' });
          return;
      }

      socket.emit('data:response', { type, data });
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch data', error: error.message });
    }
  }

  private async getUserNotifications(userId: string): Promise<any[]> {
    // This would typically fetch from a notifications table
    // For now, return empty array
    return [];
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
      console.log(`🔌 User ${socket.user?.username} disconnected from WebSocket`);
    }
  }

  // Public methods for broadcasting events
  public broadcastNetworkStats(stats: any): void {
    this.io.emit('network:stats', stats);
  }

  public broadcastNodeStatusChange(nodeId: string, status: string): void {
    this.io.emit('node:status-changed', {
      nodeId,
      status,
      timestamp: new Date(),
    });
  }

  public broadcastSessionUpdate(session: any): void {
    this.io.emit('session:updated', session);
  }

  public broadcastRewardDistribution(rewards: any[]): void {
    this.io.emit('rewards:distributed', {
      rewards,
      timestamp: new Date(),
    });
  }

  public sendToUser(userId: string, event: string, data: any): void {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
