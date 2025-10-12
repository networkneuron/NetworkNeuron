/**
 * NetworkNeuron Incentive Mechanism
 * 
 * Implements a token-based reward system for node operators who provide
 * bandwidth and services to the NetworkNeuron network.
 */

import { EventEmitter } from 'events';
import { CryptoManager } from '../crypto/crypto.js';
import { NetworkNeuronError } from '../core/types.js';
import Big from 'big.js';

/**
 * Token-based incentive system
 */
export class IncentiveSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      tokenName: config.tokenName || 'NNR', // NetworkNeuron Reward Token
      initialSupply: config.initialSupply || 1000000000, // 1 billion tokens
      rewardRate: config.rewardRate || 0.1, // 0.1 tokens per MB
      minStake: config.minStake || 1000, // Minimum stake to operate node
      maxRewardPerDay: config.maxRewardPerDay || 1000, // Maximum daily reward
      rewardPeriod: config.rewardPeriod || 86400, // 24 hours in seconds
      ...config
    };
    
    this.crypto = new CryptoManager();
    
    // Token balances
    this.balances = new Map();
    this.stakes = new Map();
    this.rewards = new Map();
    this.transactions = [];
    
    // Performance tracking
    this.nodePerformance = new Map();
    this.bandwidthProvided = new Map();
    this.sessionsServed = new Map();
    
    // Initialize with initial supply
    this.initializeTokenSystem();
  }

  /**
   * Initialize the token system
   */
  initializeTokenSystem() {
    // Distribute initial tokens to bootstrap nodes
    const bootstrapNodes = this.config.bootstrapNodes || [];
    const tokensPerBootstrap = this.config.initialSupply / (bootstrapNodes.length + 1);
    
    bootstrapNodes.forEach(nodeId => {
      this.balances.set(nodeId, tokensPerBootstrap);
    });
    
    // Reserve tokens for rewards
    this.balances.set('reward_pool', this.config.initialSupply * 0.5);
    
    console.log('Token system initialized');
  }

  /**
   * Stake tokens to become a node operator
   */
  async stakeTokens(nodeId, amount) {
    try {
      const currentBalance = this.getBalance(nodeId);
      const currentStake = this.getStake(nodeId);
      
      if (currentBalance < amount) {
        throw new NetworkNeuronError('Insufficient balance for staking', 'INSUFFICIENT_BALANCE');
      }
      
      if (amount < this.config.minStake) {
        throw new NetworkNeuronError(`Minimum stake required: ${this.config.minStake}`, 'MIN_STAKE_NOT_MET');
      }
      
      // Update balances
      this.balances.set(nodeId, currentBalance - amount);
      this.stakes.set(nodeId, (currentStake || 0) + amount);
      
      // Record transaction
      this.recordTransaction({
        type: 'stake',
        from: nodeId,
        to: 'stake_pool',
        amount,
        timestamp: new Date(),
        signature: this.crypto.sign(`${nodeId}:${amount}:stake`, this.config.privateKey)
      });
      
      this.emit('stake:created', { nodeId, amount, totalStake: this.getStake(nodeId) });
      
      return {
        nodeId,
        stakedAmount: amount,
        totalStake: this.getStake(nodeId),
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new NetworkNeuronError(`Staking failed: ${error.message}`, 'STAKING_ERROR');
    }
  }

  /**
   * Unstake tokens
   */
  async unstakeTokens(nodeId, amount) {
    try {
      const currentStake = this.getStake(nodeId);
      
      if (currentStake < amount) {
        throw new NetworkNeuronError('Insufficient stake to unstake', 'INSUFFICIENT_STAKE');
      }
      
      // Update balances
      this.balances.set(nodeId, this.getBalance(nodeId) + amount);
      this.stakes.set(nodeId, currentStake - amount);
      
      // Record transaction
      this.recordTransaction({
        type: 'unstake',
        from: 'stake_pool',
        to: nodeId,
        amount,
        timestamp: new Date(),
        signature: this.crypto.sign(`${nodeId}:${amount}:unstake`, this.config.privateKey)
      });
      
      this.emit('stake:removed', { nodeId, amount, totalStake: this.getStake(nodeId) });
      
      return {
        nodeId,
        unstakedAmount: amount,
        totalStake: this.getStake(nodeId),
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new NetworkNeuronError(`Unstaking failed: ${error.message}`, 'UNSTAKING_ERROR');
    }
  }

  /**
   * Calculate rewards for a node based on performance
   */
  calculateRewards(nodeId, period = 'daily') {
    try {
      const performance = this.nodePerformance.get(nodeId) || {};
      const bandwidthProvided = this.bandwidthProvided.get(nodeId) || 0;
      const sessionsServed = this.sessionsServed.get(nodeId) || 0;
      const stake = this.getStake(nodeId) || 0;
      
      if (stake < this.config.minStake) {
        return {
          nodeId,
          amount: 0,
          period,
          bandwidthProvided: 0,
          sessionsServed: 0,
          stake,
          timestamp: new Date(),
          reason: 'insufficient_stake'
        };
      }
      
      // Calculate base reward from bandwidth provided
      const bandwidthReward = new Big(bandwidthProvided).mul(this.config.rewardRate);
      
      // Calculate stake multiplier (higher stake = higher rewards)
      const stakeMultiplier = Math.min(1 + (stake / this.config.minStake) * 0.5, 2);
      
      // Calculate performance bonus
      const uptimeBonus = (performance.uptime || 0) / 100;
      const latencyBonus = Math.max(0, 1 - (performance.averageLatency || 0) / 1000);
      
      // Calculate total reward
      const totalReward = bandwidthReward
        .mul(stakeMultiplier)
        .mul(uptimeBonus)
        .mul(latencyBonus)
        .mul(sessionsServed || 1);
      
      // Apply daily maximum
      const cappedReward = Math.min(totalReward.toNumber(), this.config.maxRewardPerDay);
      
      return {
        nodeId,
        amount: cappedReward,
        period,
        bandwidthProvided,
        sessionsServed,
        stake,
        performance: {
          uptime: performance.uptime || 0,
          averageLatency: performance.averageLatency || 0,
          reputation: performance.reputation || 0
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new NetworkNeuronError(`Reward calculation failed: ${error.message}`, 'REWARD_CALCULATION_ERROR');
    }
  }

  /**
   * Distribute rewards to node operators
   */
  async distributeRewards(period = 'daily') {
    try {
      const rewards = [];
      const totalRewardPool = this.getBalance('reward_pool');
      
      if (totalRewardPool <= 0) {
        throw new NetworkNeuronError('Insufficient reward pool', 'INSUFFICIENT_REWARD_POOL');
      }
      
      // Calculate rewards for all staked nodes
      for (const [nodeId, stake] of this.stakes) {
        if (stake >= this.config.minStake) {
          const reward = this.calculateRewards(nodeId, period);
          rewards.push(reward);
        }
      }
      
      // Distribute rewards
      for (const reward of rewards) {
        if (reward.amount > 0) {
          await this.distributeReward(reward);
        }
      }
      
      this.emit('rewards:distributed', { period, rewards, totalDistributed: rewards.reduce((sum, r) => sum + r.amount, 0) });
      
      return {
        period,
        rewards,
        totalDistributed: rewards.reduce((sum, r) => sum + r.amount, 0),
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new NetworkNeuronError(`Reward distribution failed: ${error.message}`, 'REWARD_DISTRIBUTION_ERROR');
    }
  }

  /**
   * Distribute individual reward
   */
  async distributeReward(reward) {
    try {
      const rewardPoolBalance = this.getBalance('reward_pool');
      
      if (rewardPoolBalance < reward.amount) {
        console.warn(`Insufficient reward pool for node ${reward.nodeId}`);
        return;
      }
      
      // Transfer tokens from reward pool to node
      this.balances.set('reward_pool', rewardPoolBalance - reward.amount);
      this.balances.set(reward.nodeId, this.getBalance(reward.nodeId) + reward.amount);
      
      // Record transaction
      this.recordTransaction({
        type: 'reward',
        from: 'reward_pool',
        to: reward.nodeId,
        amount: reward.amount,
        timestamp: new Date(),
        metadata: {
          period: reward.period,
          bandwidthProvided: reward.bandwidthProvided,
          sessionsServed: reward.sessionsServed
        },
        signature: this.crypto.sign(`reward:${reward.nodeId}:${reward.amount}`, this.config.privateKey)
      });
      
      // Store reward record
      this.rewards.set(`${reward.nodeId}:${Date.now()}`, reward);
      
      this.emit('reward:distributed', reward);
      
    } catch (error) {
      throw new NetworkNeuronError(`Individual reward distribution failed: ${error.message}`, 'INDIVIDUAL_REWARD_ERROR');
    }
  }

  /**
   * Update node performance metrics
   */
  updateNodePerformance(nodeId, metrics) {
    const currentPerformance = this.nodePerformance.get(nodeId) || {};
    
    this.nodePerformance.set(nodeId, {
      ...currentPerformance,
      ...metrics,
      lastUpdated: new Date()
    });
    
    this.emit('performance:updated', { nodeId, metrics });
  }

  /**
   * Record bandwidth provided by node
   */
  recordBandwidthProvided(nodeId, bytes) {
    const currentBandwidth = this.bandwidthProvided.get(nodeId) || 0;
    this.bandwidthProvided.set(nodeId, currentBandwidth + bytes);
    
    this.emit('bandwidth:recorded', { nodeId, bytes, total: currentBandwidth + bytes });
  }

  /**
   * Record session served by node
   */
  recordSessionServed(nodeId, sessionInfo) {
    const currentSessions = this.sessionsServed.get(nodeId) || 0;
    this.sessionsServed.set(nodeId, currentSessions + 1);
    
    this.emit('session:served', { nodeId, sessionInfo, totalSessions: currentSessions + 1 });
  }

  /**
   * Get token balance for a node
   */
  getBalance(nodeId) {
    return this.balances.get(nodeId) || 0;
  }

  /**
   * Get stake amount for a node
   */
  getStake(nodeId) {
    return this.stakes.get(nodeId) || 0;
  }

  /**
   * Get total rewards earned by a node
   */
  getTotalRewards(nodeId) {
    let totalRewards = 0;
    
    for (const [key, reward] of this.rewards) {
      if (reward.nodeId === nodeId) {
        totalRewards += reward.amount;
      }
    }
    
    return totalRewards;
  }

  /**
   * Get node performance metrics
   */
  getNodePerformance(nodeId) {
    return this.nodePerformance.get(nodeId) || {};
  }

  /**
   * Record transaction
   */
  recordTransaction(transaction) {
    transaction.id = this.crypto.generateRandomString(16);
    this.transactions.push(transaction);
    
    // Keep only last 10000 transactions
    if (this.transactions.length > 10000) {
      this.transactions = this.transactions.slice(-10000);
    }
    
    this.emit('transaction:recorded', transaction);
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(nodeId = null, limit = 100) {
    let transactions = this.transactions;
    
    if (nodeId) {
      transactions = transactions.filter(tx => 
        tx.from === nodeId || tx.to === nodeId
      );
    }
    
    return transactions.slice(-limit);
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const totalStaked = Array.from(this.stakes.values()).reduce((sum, stake) => sum + stake, 0);
    const totalRewards = Array.from(this.rewards.values()).reduce((sum, reward) => sum + reward.amount, 0);
    const activeNodes = Array.from(this.stakes.keys()).filter(nodeId => this.getStake(nodeId) >= this.config.minStake);
    
    return {
      totalSupply: this.config.initialSupply,
      totalStaked,
      totalRewards,
      activeNodes: activeNodes.length,
      rewardPool: this.getBalance('reward_pool'),
      averageStake: activeNodes.length > 0 ? totalStaked / activeNodes.length : 0,
      totalBandwidthProvided: Array.from(this.bandwidthProvided.values()).reduce((sum, bw) => sum + bw, 0),
      totalSessionsServed: Array.from(this.sessionsServed.values()).reduce((sum, sessions) => sum + sessions, 0)
    };
  }

  /**
   * Validate transaction signature
   */
  validateTransaction(transaction) {
    try {
      const message = `${transaction.from}:${transaction.to}:${transaction.amount}:${transaction.type}`;
      return this.crypto.verify(message, transaction.signature, this.config.publicKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get leaderboard of top performing nodes
   */
  getLeaderboard(metric = 'rewards', limit = 10) {
    const nodes = Array.from(this.stakes.keys()).filter(nodeId => this.getStake(nodeId) >= this.config.minStake);
    
    let sortedNodes;
    
    switch (metric) {
      case 'rewards':
        sortedNodes = nodes.map(nodeId => ({
          nodeId,
          rewards: this.getTotalRewards(nodeId),
          stake: this.getStake(nodeId),
          performance: this.getNodePerformance(nodeId)
        })).sort((a, b) => b.rewards - a.rewards);
        break;
        
      case 'stake':
        sortedNodes = nodes.map(nodeId => ({
          nodeId,
          stake: this.getStake(nodeId),
          rewards: this.getTotalRewards(nodeId),
          performance: this.getNodePerformance(nodeId)
        })).sort((a, b) => b.stake - a.stake);
        break;
        
      case 'bandwidth':
        sortedNodes = nodes.map(nodeId => ({
          nodeId,
          bandwidthProvided: this.bandwidthProvided.get(nodeId) || 0,
          stake: this.getStake(nodeId),
          rewards: this.getTotalRewards(nodeId)
        })).sort((a, b) => b.bandwidthProvided - a.bandwidthProvided);
        break;
        
      default:
        throw new NetworkNeuronError(`Unknown leaderboard metric: ${metric}`, 'UNKNOWN_METRIC');
    }
    
    return sortedNodes.slice(0, limit);
  }
}

/**
 * Reward Scheduler for automatic reward distribution
 */
export class RewardScheduler {
  constructor(incentiveSystem, config = {}) {
    this.incentiveSystem = incentiveSystem;
    this.config = {
      distributionInterval: config.distributionInterval || 86400000, // 24 hours
      autoDistribution: config.autoDistribution !== false,
      ...config
    };
    
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start automatic reward distribution
   */
  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      try {
        await this.incentiveSystem.distributeRewards('daily');
        console.log('Daily rewards distributed successfully');
      } catch (error) {
        console.error('Failed to distribute rewards:', error.message);
      }
    }, this.config.distributionInterval);
    
    console.log('Reward scheduler started');
  }

  /**
   * Stop automatic reward distribution
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('Reward scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.isRunning,
      interval: this.config.distributionInterval,
      nextDistribution: this.isRunning ? 
        new Date(Date.now() + this.config.distributionInterval) : null
    };
  }
}

// Export classes
export { IncentiveSystem, RewardScheduler };
export default IncentiveSystem;
