import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('❌ Redis disconnected');
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Redis service initialized');
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Token management
  public async setToken(userId: string, token: string, ttlSeconds: number): Promise<void> {
    const key = `token:${userId}`;
    await this.client.setEx(key, ttlSeconds, token);
  }

  public async getToken(userId: string): Promise<string | null> {
    const key = `token:${userId}`;
    return await this.client.get(key);
  }

  public async removeToken(userId: string): Promise<void> {
    const key = `token:${userId}`;
    await this.client.del(key);
  }

  public async tokenExists(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.getToken(userId);
    return storedToken === token;
  }

  // Session management
  public async setSession(sessionId: string, sessionData: any, ttlSeconds: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.client.setEx(key, ttlSeconds, JSON.stringify(sessionData));
  }

  public async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async removeSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.client.del(key);
  }

  // Cache management
  public async setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
  }

  public async getCache(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async removeCache(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async clearCache(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  // Rate limiting
  public async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }

    const ttl = await this.client.ttl(key);
    const resetTime = Date.now() + (ttl * 1000);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime,
    };
  }

  // Node status caching
  public async setNodeStatus(nodeId: string, status: any, ttlSeconds: number = 300): Promise<void> {
    const key = `node:status:${nodeId}`;
    await this.client.setEx(key, ttlSeconds, JSON.stringify(status));
  }

  public async getNodeStatus(nodeId: string): Promise<any | null> {
    const key = `node:status:${nodeId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async removeNodeStatus(nodeId: string): Promise<void> {
    const key = `node:status:${nodeId}`;
    await this.client.del(key);
  }

  // Network stats caching
  public async setNetworkStats(stats: any, ttlSeconds: number = 30): Promise<void> {
    const key = 'network:stats';
    await this.client.setEx(key, ttlSeconds, JSON.stringify(stats));
  }

  public async getNetworkStats(): Promise<any | null> {
    const key = 'network:stats';
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Real-time data
  public async publishEvent(channel: string, data: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(data));
  }

  public async subscribeToEvents(channels: string[], callback: (channel: string, data: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();

    for (const channel of channels) {
      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(channel, data);
        } catch (error) {
          console.error('Error parsing Redis message:', error);
        }
      });
    }
  }

  // Queue management
  public async addToQueue(queueName: string, data: any): Promise<void> {
    await this.client.lPush(queueName, JSON.stringify(data));
  }

  public async processQueue(queueName: string, processor: (data: any) => Promise<void>): Promise<void> {
    while (true) {
      try {
        const item = await this.client.brPop(queueName, 1);
        if (item) {
          const data = JSON.parse(item.element);
          await processor(data);
        }
      } catch (error) {
        console.error('Queue processing error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }

  // Analytics data
  public async incrementCounter(key: string, increment: number = 1): Promise<number> {
    return await this.client.incrBy(key, increment);
  }

  public async getCounter(key: string): Promise<number> {
    const value = await this.client.get(key);
    return value ? parseInt(value) : 0;
  }

  public async setCounter(key: string, value: number, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value.toString());
    } else {
      await this.client.set(key, value.toString());
    }
  }

  // Health check
  public async healthCheck(): Promise<{ status: string; connected: boolean; memory: any }> {
    try {
      const info = await this.client.info('memory');
      return {
        status: 'healthy',
        connected: this.isConnected,
        memory: this.parseRedisInfo(info),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        memory: null,
      };
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memory[key] = value;
      }
    }
    
    return memory;
  }

  // Utility methods
  public async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  public async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  public async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  public async flushAll(): Promise<void> {
    await this.client.flushAll();
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }
}
