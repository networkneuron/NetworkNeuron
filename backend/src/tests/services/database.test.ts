import { DatabaseService } from '../services/database';
import { testUtils } from './setup';

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeAll(() => {
    db = DatabaseService.getInstance();
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
      };

      const user = await db.createUser(userData);
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
    });

    it('should get user by ID', async () => {
      const user = await testUtils.createTestUser();
      const foundUser = await db.getUserById(user.id);
      
      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(user.id);
      expect(foundUser.email).toBe(user.email);
    });

    it('should get user by email', async () => {
      const user = await testUtils.createTestUser({ email: 'emailtest@example.com' });
      const foundUser = await db.getUserByEmail('emailtest@example.com');
      
      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(user.id);
    });

    it('should update user', async () => {
      const user = await testUtils.createTestUser();
      const updateData = { firstName: 'Updated' };
      
      const updatedUser = await db.updateUser(user.id, updateData);
      expect(updatedUser.firstName).toBe('Updated');
    });

    it('should get users with pagination', async () => {
      // Create multiple users
      await testUtils.createTestUser({ email: 'user1@example.com', username: 'user1' });
      await testUtils.createTestUser({ email: 'user2@example.com', username: 'user2' });
      await testUtils.createTestUser({ email: 'user3@example.com', username: 'user3' });

      const result = await db.getUsers({ page: 1, limit: 2 });
      
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('Node Operations', () => {
    it('should create a node', async () => {
      const user = await testUtils.createTestUser();
      const nodeData = {
        name: 'Test Node',
        peerId: '12D3KooWTestNode123',
        publicKey: 'test-public-key',
        multiaddr: '/ip4/127.0.0.1/tcp/3000/ws',
        region: 'test',
        status: 'online',
        reputation: 100,
        stake: 1000,
        isActive: true,
        operatorId: user.id,
      };

      const node = await db.createNode(nodeData);
      expect(node).toBeDefined();
      expect(node.name).toBe(nodeData.name);
      expect(node.peerId).toBe(nodeData.peerId);
    });

    it('should get node by ID', async () => {
      const node = await testUtils.createTestNode();
      const foundNode = await db.getNodeById(node.id);
      
      expect(foundNode).toBeDefined();
      expect(foundNode.id).toBe(node.id);
      expect(foundNode.name).toBe(node.name);
    });

    it('should update node', async () => {
      const node = await testUtils.createTestNode();
      const updateData = { status: 'offline' };
      
      const updatedNode = await db.updateNode(node.id, updateData);
      expect(updatedNode.status).toBe('offline');
    });

    it('should update node bandwidth', async () => {
      const node = await testUtils.createTestNode();
      const bandwidthInfo = {
        upload: 100,
        download: 100,
        latency: 50,
        uptime: 99.5,
        capacity: 1000,
      };
      
      await db.updateNodeBandwidth(node.id, bandwidthInfo);
      
      const updatedNode = await db.getNodeById(node.id);
      expect(updatedNode.bandwidth).toBeDefined();
    });

    it('should get nodes with filters', async () => {
      const user = await testUtils.createTestUser();
      await testUtils.createTestNode({ 
        name: 'Node 1', 
        region: 'us-east', 
        status: 'online',
        operatorId: user.id 
      });
      await testUtils.createTestNode({ 
        name: 'Node 2', 
        region: 'us-west', 
        status: 'offline',
        operatorId: user.id 
      });

      const onlineNodes = await db.getNodes({ 
        filters: { status: 'online' },
        limit: 10 
      });
      
      expect(onlineNodes.data).toHaveLength(1);
      expect(onlineNodes.data[0].status).toBe('online');
    });
  });

  describe('Session Operations', () => {
    it('should create a session', async () => {
      const session = await testUtils.createTestSession();
      expect(session).toBeDefined();
      expect(session.clientId).toBeDefined();
      expect(session.nodeId).toBeDefined();
      expect(session.isActive).toBe(true);
    });

    it('should get session by ID', async () => {
      const session = await testUtils.createTestSession();
      const foundSession = await db.getSessionById(session.id);
      
      expect(foundSession).toBeDefined();
      expect(foundSession.id).toBe(session.id);
    });

    it('should update session', async () => {
      const session = await testUtils.createTestSession();
      const updateData = { 
        isActive: false, 
        endTime: new Date(),
        bytesTransferred: 1024000 
      };
      
      const updatedSession = await db.updateSession(session.id, updateData);
      expect(updatedSession.isActive).toBe(false);
      expect(updatedSession.endTime).toBeDefined();
      expect(updatedSession.bytesTransferred).toBe(1024000);
    });

    it('should get sessions with pagination', async () => {
      await testUtils.createTestSession({ clientId: 'client1' });
      await testUtils.createTestSession({ clientId: 'client2' });
      await testUtils.createTestSession({ clientId: 'client3' });

      const result = await db.getSessions({ page: 1, limit: 2 });
      
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('Reward Operations', () => {
    it('should create a reward', async () => {
      const reward = await testUtils.createTestReward();
      expect(reward).toBeDefined();
      expect(reward.amount).toBeDefined();
      expect(reward.period).toBeDefined();
      expect(reward.claimed).toBe(false);
    });

    it('should get reward by ID', async () => {
      const reward = await testUtils.createTestReward();
      const foundReward = await db.getRewardById(reward.id);
      
      expect(foundReward).toBeDefined();
      expect(foundReward.id).toBe(reward.id);
    });

    it('should update reward', async () => {
      const reward = await testUtils.createTestReward();
      const updateData = { 
        claimed: true, 
        claimedAt: new Date() 
      };
      
      const updatedReward = await db.updateReward(reward.id, updateData);
      expect(updatedReward.claimed).toBe(true);
      expect(updatedReward.claimedAt).toBeDefined();
    });

    it('should get rewards with filters', async () => {
      await testUtils.createTestReward({ period: 'daily', claimed: false });
      await testUtils.createTestReward({ period: 'weekly', claimed: true });
      await testUtils.createTestReward({ period: 'daily', claimed: false });

      const dailyRewards = await db.getRewards({ 
        filters: { period: 'daily' },
        limit: 10 
      });
      
      expect(dailyRewards.data).toHaveLength(2);
      expect(dailyRewards.data.every(r => r.period === 'daily')).toBe(true);
    });
  });

  describe('Network Statistics', () => {
    it('should get network stats', async () => {
      // Create test data
      await testUtils.createTestNode({ status: 'online' });
      await testUtils.createTestNode({ status: 'offline' });
      await testUtils.createTestSession();
      await testUtils.createTestReward({ amount: 100 });

      const stats = await db.getNetworkStats();
      
      expect(stats.totalNodes).toBe(2);
      expect(stats.activeNodes).toBe(1);
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalRewards).toBe(100);
      expect(stats.networkHealth).toBe(50); // 1 active out of 2 total = 50%
    });

    it('should get recent sessions', async () => {
      await testUtils.createTestSession({ clientId: 'client1' });
      await testUtils.createTestSession({ clientId: 'client2' });
      await testUtils.createTestSession({ clientId: 'client3' });

      const recentSessions = await db.getRecentSessions(2);
      
      expect(recentSessions).toHaveLength(2);
      expect(recentSessions[0].clientId).toBe('client3'); // Most recent first
    });

    it('should get node statuses', async () => {
      await testUtils.createTestNode({ 
        name: 'Node 1', 
        status: 'online',
        region: 'us-east' 
      });
      await testUtils.createTestNode({ 
        name: 'Node 2', 
        status: 'offline',
        region: 'us-west' 
      });

      const statuses = await db.getNodeStatuses();
      
      expect(statuses).toHaveLength(2);
      expect(statuses.some(s => s.status === 'online')).toBe(true);
      expect(statuses.some(s => s.status === 'offline')).toBe(true);
    });
  });
});
