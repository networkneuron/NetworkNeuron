import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DB_NAME = 'networkneuron_test';
  process.env.REDIS_DB = '1';
  
  // Initialize test database
  const db = DatabaseService.getInstance();
  await db.initialize();
  
  // Initialize test Redis
  const redis = RedisService.getInstance();
  await redis.initialize();
});

afterAll(async () => {
  // Clean up test database
  const db = DatabaseService.getInstance();
  await db.close();
  
  // Clean up test Redis
  const redis = RedisService.getInstance();
  await redis.close();
});

beforeEach(async () => {
  // Clean up data before each test
  const db = DatabaseService.getInstance();
  const redis = RedisService.getInstance();
  
  // Clear Redis cache
  await redis.flushAll();
  
  // Clean up database tables (in reverse order due to foreign keys)
  await db.db('rewards').del();
  await db.db('sessions').del();
  await db.db('nodes').del();
  await db.db('users').del();
});

// Global test utilities
export const testUtils = {
  createTestUser: async (userData: any = {}) => {
    const db = DatabaseService.getInstance();
    const defaultUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      ...userData,
    };
    return await db.createUser(defaultUser);
  },

  createTestNode: async (nodeData: any = {}) => {
    const db = DatabaseService.getInstance();
    const user = await testUtils.createTestUser();
    const defaultNode = {
      name: 'Test Node',
      peerId: '12D3KooWTestNode123456789',
      publicKey: 'test-public-key',
      multiaddr: '/ip4/127.0.0.1/tcp/3000/ws',
      region: 'test',
      status: 'online',
      reputation: 100,
      stake: 1000,
      isActive: true,
      operatorId: user.id,
      ...nodeData,
    };
    return await db.createNode(defaultNode);
  },

  createTestSession: async (sessionData: any = {}) => {
    const db = DatabaseService.getInstance();
    const node = await testUtils.createTestNode();
    const defaultSession = {
      clientId: 'test-client-123',
      nodeId: node.id,
      startTime: new Date(),
      isActive: true,
      bytesTransferred: 0,
      route: {
        id: 'test-route-123',
        nodes: [node.id],
        latency: 100,
        bandwidth: 10,
        cost: 1,
        encrypted: true,
        expiresAt: new Date(Date.now() + 300000),
      },
      ...sessionData,
    };
    return await db.createSession(defaultSession);
  },

  createTestReward: async (rewardData: any = {}) => {
    const db = DatabaseService.getInstance();
    const node = await testUtils.createTestNode();
    const defaultReward = {
      nodeId: node.id,
      amount: 100.50,
      period: 'daily',
      bandwidthProvided: 1024000,
      sessionsServed: 5,
      timestamp: new Date(),
      claimed: false,
      ...rewardData,
    };
    return await db.createReward(defaultReward);
  },

  generateJWT: (userId: string, role: string = 'user') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, email: 'test@example.com', role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
};
