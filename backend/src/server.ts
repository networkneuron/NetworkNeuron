import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './src/routes/auth';
import nodeRoutes from './src/routes/nodes';
import sessionRoutes from './src/routes/sessions';
import rewardRoutes from './src/routes/rewards';
import networkRoutes from './src/routes/network';
import userRoutes from './src/routes/users';

// Import middleware
import { errorHandler } from './src/middleware/errorHandler';
import { notFound } from './src/middleware/notFound';
import { authenticateToken } from './src/middleware/auth';

// Import services
import { DatabaseService } from './src/services/database';
import { RedisService } from './src/services/redis';
import { WebSocketService } from './src/services/websocket';
import { NetworkService } from './src/services/network';
import { RewardService } from './src/services/reward';

// Import types
import { Request, Response, NextFunction } from 'express';

class NetworkNeuronServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private port: number;
  private databaseService: DatabaseService;
  private redisService: RedisService;
  private webSocketService: WebSocketService;
  private networkService: NetworkService;
  private rewardService: RewardService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    this.port = parseInt(process.env.PORT || '5000');
    
    // Initialize services
    this.databaseService = new DatabaseService();
    this.redisService = new RedisService();
    this.webSocketService = new WebSocketService(this.io);
    this.networkService = new NetworkService();
    this.rewardService = new RewardService();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api/', limiter);

    // Logging
    this.app.use(morgan('combined'));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use('/uploads', express.static('uploads'));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/nodes', authenticateToken, nodeRoutes);
    this.app.use('/api/sessions', authenticateToken, sessionRoutes);
    this.app.use('/api/rewards', authenticateToken, rewardRoutes);
    this.app.use('/api/network', authenticateToken, networkRoutes);
    this.app.use('/api/users', authenticateToken, userRoutes);

    // WebSocket connection handling
    this.io.on('connection', (socket) => {
      this.webSocketService.handleConnection(socket);
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(errorHandler);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.shutdown();
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize services
      await this.databaseService.initialize();
      await this.redisService.initialize();
      await this.networkService.initialize();
      await this.rewardService.initialize();

      // Start server
      this.server.listen(this.port, () => {
        console.log(`🚀 NetworkNeuron API server running on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔌 WebSocket server: ws://localhost:${this.port}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Start background services
      this.startBackgroundServices();

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private startBackgroundServices(): void {
    // Network monitoring
    setInterval(async () => {
      try {
        const stats = await this.networkService.getNetworkStats();
        this.io.emit('network:stats', stats);
      } catch (error) {
        console.error('Error updating network stats:', error);
      }
    }, 30000); // Every 30 seconds

    // Reward distribution
    setInterval(async () => {
      try {
        await this.rewardService.distributeRewards();
      } catch (error) {
        console.error('Error distributing rewards:', error);
      }
    }, 3600000); // Every hour

    // Node health checks
    setInterval(async () => {
      try {
        await this.networkService.checkNodeHealth();
      } catch (error) {
        console.error('Error checking node health:', error);
      }
    }, 60000); // Every minute

    // Session cleanup
    setInterval(async () => {
      try {
        await this.networkService.cleanupExpiredSessions();
      } catch (error) {
        console.error('Error cleaning up sessions:', error);
      }
    }, 300000); // Every 5 minutes
  }

  private async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    
    try {
      // Close server
      this.server.close(() => {
        console.log('HTTP server closed');
      });

      // Close WebSocket connections
      this.io.close(() => {
        console.log('WebSocket server closed');
      });

      // Close database connections
      await this.databaseService.close();

      // Close Redis connections
      await this.redisService.close();

      console.log('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new NetworkNeuronServer();
server.start().catch((error) => {
  console.error('Failed to start NetworkNeuron server:', error);
  process.exit(1);
});

export default NetworkNeuronServer;
