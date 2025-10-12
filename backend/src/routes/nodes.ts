import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { DatabaseService } from '../services/database';
import { NetworkService } from '../services/network';
import { Node, BandwidthInfo } from '../types';

const router = Router();
const databaseService = DatabaseService.getInstance();
const networkService = NetworkService.getInstance();

// Get all nodes with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['online', 'offline', 'maintenance']),
  query('region').optional().isString(),
  query('search').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      region,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      status: status as string,
      region: region as string,
      search: search as string,
    };

    const result = await databaseService.getNodes({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get nodes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get node by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const node = await databaseService.getNodeById(id);
    
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    // Get additional node statistics
    const stats = await networkService.getNodeStats(id);
    const sessions = await databaseService.getNodeSessions(id, { limit: 10 });

    res.json({
      success: true,
      data: {
        node,
        stats,
        recentSessions: sessions,
      },
    });
  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Create new node
router.post('/', [
  body('name').isLength({ min: 1, max: 100 }),
  body('region').isString(),
  body('stake').isInt({ min: 1000 }),
  body('publicKey').isString(),
  body('multiaddr').isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const userId = (req as any).userId;
    const nodeData = {
      ...req.body,
      operatorId: userId,
      status: 'offline',
      reputation: 100,
      isActive: true,
    };

    const node = await databaseService.createNode(nodeData);

    res.status(201).json({
      success: true,
      message: 'Node created successfully',
      data: { node },
    });
  } catch (error) {
    console.error('Create node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update node
router.put('/:id', [
  body('name').optional().isLength({ min: 1, max: 100 }),
  body('region').optional().isString(),
  body('status').optional().isIn(['online', 'offline', 'maintenance']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = (req as any).userId;
    const updateData = req.body;

    // Check if user owns the node
    const node = await databaseService.getNodeById(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    if (node.operatorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this node',
      });
    }

    const updatedNode = await databaseService.updateNode(id, updateData);

    res.json({
      success: true,
      message: 'Node updated successfully',
      data: { node: updatedNode },
    });
  } catch (error) {
    console.error('Update node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Delete node
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if user owns the node
    const node = await databaseService.getNodeById(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    if (node.operatorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this node',
      });
    }

    await databaseService.deleteNode(id);

    res.json({
      success: true,
      message: 'Node deleted successfully',
    });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Start node
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if user owns the node
    const node = await databaseService.getNodeById(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    if (node.operatorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to control this node',
      });
    }

    // Start the node
    await networkService.startNode(id);

    res.json({
      success: true,
      message: 'Node started successfully',
    });
  } catch (error) {
    console.error('Start node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Stop node
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if user owns the node
    const node = await databaseService.getNodeById(id);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    if (node.operatorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to control this node',
      });
    }

    // Stop the node
    await networkService.stopNode(id);

    res.json({
      success: true,
      message: 'Node stopped successfully',
    });
  } catch (error) {
    console.error('Stop node error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update node bandwidth info
router.put('/:id/bandwidth', [
  body('upload').isInt({ min: 0 }),
  body('download').isInt({ min: 0 }),
  body('latency').isInt({ min: 0 }),
  body('uptime').isFloat({ min: 0, max: 100 }),
  body('capacity').isInt({ min: 0 }),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const bandwidthInfo: BandwidthInfo = req.body;

    // Update bandwidth info
    await databaseService.updateNodeBandwidth(id, bandwidthInfo);

    res.json({
      success: true,
      message: 'Bandwidth info updated successfully',
    });
  } catch (error) {
    console.error('Update bandwidth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get node statistics
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stats = await networkService.getNodeStats(id);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('Get node stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get node sessions
router.get('/:id/sessions', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'completed', 'failed']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
    } = req.query;

    const filters = {
      status: status as string,
    };

    const sessions = await databaseService.getNodeSessions(id, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters,
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Get node sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get node rewards
router.get('/:id/rewards', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('period').optional().isIn(['hourly', 'daily', 'weekly', 'monthly']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      period,
    } = req.query;

    const filters = {
      period: period as string,
    };

    const rewards = await databaseService.getNodeRewards(id, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      filters,
    });

    res.json({
      success: true,
      data: rewards,
    });
  } catch (error) {
    console.error('Get node rewards error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
