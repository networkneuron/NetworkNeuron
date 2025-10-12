import knex, { Knex } from 'knex';
import { config } from '../config/database';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Knex;

  private constructor() {
    this.db = knex(config);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Test database connection
      await this.db.raw('SELECT 1');
      console.log('✅ Database connected successfully');
      
      // Run migrations
      await this.runMigrations();
      
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      await this.db.migrate.latest();
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.db.destroy();
  }

  // User operations
  public async createUser(userData: any): Promise<any> {
    const [user] = await this.db('users').insert(userData).returning('*');
    return user;
  }

  public async getUserById(id: string): Promise<any> {
    return await this.db('users').where('id', id).first();
  }

  public async getUserByEmail(email: string): Promise<any> {
    return await this.db('users').where('email', email).first();
  }

  public async getUserByUsername(username: string): Promise<any> {
    return await this.db('users').where('username', username).first();
  }

  public async updateUser(id: string, updateData: any): Promise<any> {
    const [user] = await this.db('users')
      .where('id', id)
      .update({ ...updateData, updatedAt: new Date() })
      .returning('*');
    return user;
  }

  public async deleteUser(id: string): Promise<void> {
    await this.db('users').where('id', id).del();
  }

  public async getUsers(options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {}, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    let query = this.db('users').select('*');

    // Apply filters
    if (filters.role) {
      query = query.where('role', filters.role);
    }
    if (filters.isActive !== undefined) {
      query = query.where('isActive', filters.isActive);
    }
    if (filters.search) {
      query = query.where(function() {
        this.where('username', 'ilike', `%${filters.search}%`)
            .orWhere('email', 'ilike', `%${filters.search}%`)
            .orWhere('firstName', 'ilike', `%${filters.search}%`)
            .orWhere('lastName', 'ilike', `%${filters.search}%`);
      });
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    const users = await query.limit(limit).offset(offset);
    const total = await this.db('users').count('* as count').first();

    return {
      data: users,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  // Node operations
  public async createNode(nodeData: any): Promise<any> {
    const [node] = await this.db('nodes').insert(nodeData).returning('*');
    return node;
  }

  public async getNodeById(id: string): Promise<any> {
    return await this.db('nodes')
      .select('nodes.*', 'users.username as operatorUsername', 'users.email as operatorEmail')
      .leftJoin('users', 'nodes.operatorId', 'users.id')
      .where('nodes.id', id)
      .first();
  }

  public async updateNode(id: string, updateData: any): Promise<any> {
    const [node] = await this.db('nodes')
      .where('id', id)
      .update({ ...updateData, updatedAt: new Date() })
      .returning('*');
    return node;
  }

  public async deleteNode(id: string): Promise<void> {
    await this.db('nodes').where('id', id).del();
  }

  public async updateNodeBandwidth(nodeId: string, bandwidthInfo: any): Promise<void> {
    await this.db('nodes')
      .where('id', nodeId)
      .update({
        bandwidth: JSON.stringify(bandwidthInfo),
        updatedAt: new Date(),
      });
  }

  public async getNodes(options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {}, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    let query = this.db('nodes')
      .select('nodes.*', 'users.username as operatorUsername', 'users.email as operatorEmail')
      .leftJoin('users', 'nodes.operatorId', 'users.id');

    // Apply filters
    if (filters.status) {
      query = query.where('nodes.status', filters.status);
    }
    if (filters.region) {
      query = query.where('nodes.region', filters.region);
    }
    if (filters.search) {
      query = query.where(function() {
        this.where('nodes.name', 'ilike', `%${filters.search}%`)
            .orWhere('nodes.peerId', 'ilike', `%${filters.search}%`)
            .orWhere('users.username', 'ilike', `%${filters.search}%`);
      });
    }

    // Apply sorting
    query = query.orderBy(`nodes.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    const nodes = await query.limit(limit).offset(offset);
    const total = await this.db('nodes').count('* as count').first();

    return {
      data: nodes,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  // Session operations
  public async createSession(sessionData: any): Promise<any> {
    const [session] = await this.db('sessions').insert(sessionData).returning('*');
    return session;
  }

  public async getSessionById(id: string): Promise<any> {
    return await this.db('sessions')
      .select('sessions.*', 'nodes.name as nodeName', 'nodes.peerId as nodePeerId')
      .leftJoin('nodes', 'sessions.nodeId', 'nodes.id')
      .where('sessions.id', id)
      .first();
  }

  public async updateSession(id: string, updateData: any): Promise<any> {
    const [session] = await this.db('sessions')
      .where('id', id)
      .update({ ...updateData, updatedAt: new Date() })
      .returning('*');
    return session;
  }

  public async getSessions(options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {}, sortBy = 'startTime', sortOrder = 'desc' } = options;
    
    let query = this.db('sessions')
      .select('sessions.*', 'nodes.name as nodeName', 'nodes.peerId as nodePeerId')
      .leftJoin('nodes', 'sessions.nodeId', 'nodes.id');

    // Apply filters
    if (filters.status) {
      if (filters.status === 'active') {
        query = query.where('sessions.isActive', true);
      } else if (filters.status === 'completed') {
        query = query.where('sessions.isActive', false).whereNotNull('sessions.endTime');
      }
    }
    if (filters.nodeId) {
      query = query.where('sessions.nodeId', filters.nodeId);
    }
    if (filters.dateFrom) {
      query = query.where('sessions.startTime', '>=', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.where('sessions.startTime', '<=', filters.dateTo);
    }

    // Apply sorting
    query = query.orderBy(`sessions.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    const sessions = await query.limit(limit).offset(offset);
    const total = await this.db('sessions').count('* as count').first();

    return {
      data: sessions,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  public async getNodeSessions(nodeId: string, options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {} } = options;
    
    let query = this.db('sessions').where('nodeId', nodeId);

    // Apply filters
    if (filters.status) {
      if (filters.status === 'active') {
        query = query.where('isActive', true);
      } else if (filters.status === 'completed') {
        query = query.where('isActive', false).whereNotNull('endTime');
      }
    }

    // Apply sorting
    query = query.orderBy('startTime', 'desc');

    // Apply pagination
    const offset = (page - 1) * limit;
    const sessions = await query.limit(limit).offset(offset);
    const total = await this.db('sessions').where('nodeId', nodeId).count('* as count').first();

    return {
      data: sessions,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  // Reward operations
  public async createReward(rewardData: any): Promise<any> {
    const [reward] = await this.db('rewards').insert(rewardData).returning('*');
    return reward;
  }

  public async getRewardById(id: string): Promise<any> {
    return await this.db('rewards')
      .select('rewards.*', 'nodes.name as nodeName', 'nodes.peerId as nodePeerId')
      .leftJoin('nodes', 'rewards.nodeId', 'nodes.id')
      .where('rewards.id', id)
      .first();
  }

  public async updateReward(id: string, updateData: any): Promise<any> {
    const [reward] = await this.db('rewards')
      .where('id', id)
      .update({ ...updateData, updatedAt: new Date() })
      .returning('*');
    return reward;
  }

  public async getRewards(options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {}, sortBy = 'timestamp', sortOrder = 'desc' } = options;
    
    let query = this.db('rewards')
      .select('rewards.*', 'nodes.name as nodeName', 'nodes.peerId as nodePeerId')
      .leftJoin('nodes', 'rewards.nodeId', 'nodes.id');

    // Apply filters
    if (filters.nodeId) {
      query = query.where('rewards.nodeId', filters.nodeId);
    }
    if (filters.period) {
      query = query.where('rewards.period', filters.period);
    }
    if (filters.claimed !== undefined) {
      query = query.where('rewards.claimed', filters.claimed);
    }
    if (filters.dateFrom) {
      query = query.where('rewards.timestamp', '>=', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.where('rewards.timestamp', '<=', filters.dateTo);
    }

    // Apply sorting
    query = query.orderBy(`rewards.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    const rewards = await query.limit(limit).offset(offset);
    const total = await this.db('rewards').count('* as count').first();

    return {
      data: rewards,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  public async getNodeRewards(nodeId: string, options: any = {}): Promise<any> {
    const { page = 1, limit = 20, filters = {} } = options;
    
    let query = this.db('rewards').where('nodeId', nodeId);

    // Apply filters
    if (filters.period) {
      query = query.where('period', filters.period);
    }
    if (filters.claimed !== undefined) {
      query = query.where('claimed', filters.claimed);
    }

    // Apply sorting
    query = query.orderBy('timestamp', 'desc');

    // Apply pagination
    const offset = (page - 1) * limit;
    const rewards = await query.limit(limit).offset(offset);
    const total = await this.db('rewards').where('nodeId', nodeId).count('* as count').first();

    return {
      data: rewards,
      total: parseInt(total?.count as string),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total?.count as string) / limit),
    };
  }

  // Statistics operations
  public async getNetworkStats(): Promise<any> {
    const [
      totalNodes,
      activeNodes,
      totalSessions,
      activeSessions,
      totalRewards,
      totalStake,
    ] = await Promise.all([
      this.db('nodes').count('* as count').first(),
      this.db('nodes').where('status', 'online').count('* as count').first(),
      this.db('sessions').count('* as count').first(),
      this.db('sessions').where('isActive', true).count('* as count').first(),
      this.db('rewards').sum('amount as total').first(),
      this.db('nodes').sum('stake as total').first(),
    ]);

    // Calculate average latency
    const avgLatencyResult = await this.db('nodes')
      .where('status', 'online')
      .select(this.db.raw('AVG((bandwidth->>\'latency\')::int) as avg'))
      .first();

    // Calculate total bandwidth
    const totalBandwidthResult = await this.db('nodes')
      .where('status', 'online')
      .select(this.db.raw('SUM((bandwidth->>\'download\')::int) as total'))
      .first();

    return {
      totalNodes: parseInt(totalNodes?.count as string),
      activeNodes: parseInt(activeNodes?.count as string),
      totalSessions: parseInt(totalSessions?.count as string),
      activeSessions: parseInt(activeSessions?.count as string),
      totalRewards: parseFloat(totalRewards?.total as string) || 0,
      totalStake: parseFloat(totalStake?.total as string) || 0,
      averageLatency: parseFloat(avgLatencyResult?.avg as string) || 0,
      totalBandwidth: parseFloat(totalBandwidthResult?.total as string) || 0,
      networkHealth: activeNodes?.count ? (parseInt(activeNodes.count as string) / parseInt(totalNodes?.count as string)) * 100 : 0,
      lastUpdated: new Date(),
    };
  }

  public async getRecentSessions(limit: number = 10): Promise<any[]> {
    return await this.db('sessions')
      .select('sessions.*', 'nodes.name as nodeName')
      .leftJoin('nodes', 'sessions.nodeId', 'nodes.id')
      .orderBy('sessions.startTime', 'desc')
      .limit(limit);
  }

  public async getNodeStatuses(): Promise<any[]> {
    return await this.db('nodes')
      .select('id', 'name', 'status', 'region', 'lastSeen', 'bandwidth')
      .orderBy('lastSeen', 'desc');
  }
}
