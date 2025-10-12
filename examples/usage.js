/**
 * NetworkNeuron Example Usage
 * 
 * This file demonstrates how to use the NetworkNeuron protocol
 * for both node operators and client applications.
 */

import { NetworkNeuron, NetworkNeuronCLI } from './src/index.js';
import { NetworkNeuronClient, NetworkNeuronClientCLI } from './src/client/client.js';
import { IncentiveSystem, RewardScheduler } from './src/incentives/incentives.js';

/**
 * Example 1: Running a NetworkNeuron Node
 */
async function runNodeExample() {
  console.log('=== NetworkNeuron Node Example ===');
  
  // Initialize CLI
  const cli = new NetworkNeuronCLI();
  
  // Initialize node with configuration
  const node = await cli.init({
    nodeId: 'example-node-001',
    port: 3000,
    host: '0.0.0.0',
    region: 'us-east',
    stake: 5000,
    bootstrapNodes: [
      '/ip4/127.0.0.1/tcp/3001/ws/p2p/12D3KooWExampleBootstrapNode',
      '/ip4/127.0.0.1/tcp/3002/ws/p2p/12D3KooWAnotherBootstrapNode'
    ]
  });
  
  // Set up event handlers
  node.on('started', () => {
    console.log('✅ Node started successfully');
  });
  
  node.on('peer:connected', (peerId) => {
    console.log(`🔗 Peer connected: ${peerId.toString()}`);
  });
  
  node.on('session:created', (session) => {
    console.log(`📱 Client session created: ${session.id}`);
  });
  
  node.on('packet:sent', (packet) => {
    console.log(`📦 Packet sent: ${packet.id}`);
  });
  
  // Start the node
  await cli.start();
  
  // Keep the node running
  console.log('Node is running. Press Ctrl+C to stop.');
}

/**
 * Example 2: Using NetworkNeuron Client
 */
async function runClientExample() {
  console.log('=== NetworkNeuron Client Example ===');
  
  // Initialize client CLI
  const clientCLI = new NetworkNeuronClientCLI();
  
  // Initialize client
  const client = clientCLI.init({
    serverUrl: 'ws://localhost:3000',
    clientId: 'example-client-001',
    autoReconnect: true,
    maxRetries: 5
  });
  
  // Set up event handlers
  client.on('connected', () => {
    console.log('✅ Connected to NetworkNeuron network');
  });
  
  client.on('route:established', (route) => {
    console.log(`🛣️ Route established: ${route.id}`);
    console.log(`   Nodes: ${route.nodes.join(' -> ')}`);
    console.log(`   Latency: ${route.latency}ms`);
    console.log(`   Bandwidth: ${route.bandwidth}Mbps`);
  });
  
  client.on('tunnel:started', (route) => {
    console.log('🚇 Tunnel started successfully');
  });
  
  client.on('tunnel:data', (data) => {
    console.log(`📡 Received tunnel data: ${data.length} bytes`);
  });
  
  // Connect to network
  await clientCLI.connect();
  
  // Start tunnel to a destination
  await clientCLI.startTunnel('example-destination.com', {
    minBandwidth: 10,
    maxLatency: 500,
    encryption: true
  });
  
  // Start HTTP proxy
  await clientCLI.startProxy({
    proxyPort: 8080,
    targetHost: 'example.com',
    targetPort: 80
  });
  
  console.log('Client is running. HTTP proxy available on port 8080');
}

/**
 * Example 3: Incentive System
 */
async function runIncentiveExample() {
  console.log('=== NetworkNeuron Incentive System Example ===');
  
  // Initialize incentive system
  const incentiveSystem = new IncentiveSystem({
    tokenName: 'NNR',
    initialSupply: 1000000000,
    rewardRate: 0.1,
    minStake: 1000,
    maxRewardPerDay: 1000
  });
  
  // Initialize reward scheduler
  const scheduler = new RewardScheduler(incentiveSystem, {
    distributionInterval: 86400000, // 24 hours
    autoDistribution: true
  });
  
  // Set up event handlers
  incentiveSystem.on('stake:created', (data) => {
    console.log(`💰 Stake created: ${data.nodeId} staked ${data.amount} tokens`);
  });
  
  incentiveSystem.on('reward:distributed', (reward) => {
    console.log(`🎁 Reward distributed: ${reward.nodeId} earned ${reward.amount} tokens`);
  });
  
  incentiveSystem.on('rewards:distributed', (data) => {
    console.log(`📊 Daily rewards distributed: ${data.totalDistributed} tokens to ${data.rewards.length} nodes`);
  });
  
  // Example node operations
  const nodeId = 'example-node-001';
  
  // Stake tokens to become a node operator
  await incentiveSystem.stakeTokens(nodeId, 5000);
  
  // Update node performance metrics
  incentiveSystem.updateNodePerformance(nodeId, {
    uptime: 99.5,
    averageLatency: 45,
    reputation: 95
  });
  
  // Record bandwidth provided
  incentiveSystem.recordBandwidthProvided(nodeId, 1024 * 1024 * 100); // 100MB
  
  // Record sessions served
  incentiveSystem.recordSessionServed(nodeId, {
    clientId: 'client-001',
    duration: 3600,
    bytesTransferred: 1024 * 1024 * 50
  });
  
  // Start automatic reward distribution
  scheduler.start();
  
  // Calculate rewards for the node
  const rewards = incentiveSystem.calculateRewards(nodeId, 'daily');
  console.log('Calculated rewards:', rewards);
  
  // Get network statistics
  const stats = incentiveSystem.getNetworkStats();
  console.log('Network stats:', stats);
  
  // Get leaderboard
  const leaderboard = incentiveSystem.getLeaderboard('rewards', 10);
  console.log('Top performers:', leaderboard);
}

/**
 * Example 4: Advanced Node Configuration
 */
async function runAdvancedNodeExample() {
  console.log('=== Advanced NetworkNeuron Node Example ===');
  
  // Create node with advanced configuration
  const node = new NetworkNeuron({
    nodeId: 'advanced-node-001',
    port: 3000,
    host: '0.0.0.0',
    region: 'eu-central',
    stake: 10000,
    maxPeers: 100,
    minPeers: 10,
    bootstrapNodes: [
      '/ip4/127.0.0.1/tcp/3001/ws/p2p/12D3KooWBootstrap1',
      '/ip4/127.0.0.1/tcp/3002/ws/p2p/12D3KooWBootstrap2'
    ],
    logLevel: 'debug'
  });
  
  // Set up comprehensive event handlers
  node.on('started', () => {
    console.log('🚀 Advanced node started');
    console.log(`   Node ID: ${node.getNodeInfo().id}`);
    console.log(`   Public Key: ${node.getNodeInfo().publicKey.substring(0, 50)}...`);
  });
  
  node.on('peer:connected', (peerId) => {
    console.log(`🔗 Peer connected: ${peerId.toString()}`);
    const stats = node.getNetworkStats();
    console.log(`   Network now has ${stats.activeNodes} active peers`);
  });
  
  node.on('session:created', (session) => {
    console.log(`📱 New client session: ${session.id}`);
    console.log(`   Client: ${session.clientId}`);
    console.log(`   Route: ${session.route.nodes.join(' -> ')}`);
  });
  
  node.on('stats:updated', (stats) => {
    console.log(`📊 Network stats updated:`);
    console.log(`   Total nodes: ${stats.totalNodes}`);
    console.log(`   Active nodes: ${stats.activeNodes}`);
    console.log(`   Total bandwidth: ${stats.totalBandwidth} Mbps`);
    console.log(`   Network health: ${stats.networkHealth.toFixed(1)}%`);
  });
  
  // Start the node
  await node.start();
  
  // Demonstrate finding routes
  try {
    const route = await node.findRoute('example-destination.com', {
      minBandwidth: 50,
      maxLatency: 200,
      encryption: true,
      regions: ['eu-central', 'us-east']
    });
    
    console.log(`🛣️ Route found: ${route.id}`);
    console.log(`   Path: ${route.nodes.join(' -> ')}`);
    console.log(`   Latency: ${route.latency}ms`);
    console.log(`   Bandwidth: ${route.bandwidth}Mbps`);
    console.log(`   Cost: ${route.cost} tokens`);
  } catch (error) {
    console.error('Failed to find route:', error.message);
  }
  
  // Demonstrate creating a client session
  try {
    const session = await node.createSession('example-client-001', {
      minBandwidth: 25,
      maxLatency: 300,
      encryption: true
    });
    
    console.log(`📱 Session created: ${session.id}`);
    console.log(`   Client: ${session.clientId}`);
    console.log(`   Node: ${session.nodeId}`);
    console.log(`   Route: ${session.route.nodes.join(' -> ')}`);
  } catch (error) {
    console.error('Failed to create session:', error.message);
  }
  
  // Keep running
  console.log('Advanced node is running. Check the web dashboard at http://localhost:8080');
}

/**
 * Example 5: Error Handling and Recovery
 */
async function runErrorHandlingExample() {
  console.log('=== NetworkNeuron Error Handling Example ===');
  
  const node = new NetworkNeuron({
    nodeId: 'error-handling-node',
    port: 3000,
    host: '0.0.0.0',
    stake: 1000
  });
  
  // Set up error handlers
  node.on('error', (error) => {
    console.error(`❌ Node error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Details:`, error.details);
  });
  
  node.on('peer:connection-error', (peerId, error) => {
    console.error(`🔗 Peer connection error: ${peerId.toString()}`);
    console.error(`   Error: ${error.message}`);
  });
  
  node.on('handshake:error', (peerId, error) => {
    console.error(`🤝 Handshake error with peer: ${peerId.toString()}`);
    console.error(`   Error: ${error.message}`);
  });
  
  try {
    await node.start();
    console.log('✅ Node started successfully');
  } catch (error) {
    console.error('❌ Failed to start node:', error.message);
    
    // Attempt recovery
    console.log('🔄 Attempting recovery...');
    try {
      await node.restart();
      console.log('✅ Node recovered successfully');
    } catch (recoveryError) {
      console.error('❌ Recovery failed:', recoveryError.message);
    }
  }
}

/**
 * Main function to run examples
 */
async function main() {
  const example = process.argv[2] || 'node';
  
  switch (example) {
    case 'node':
      await runNodeExample();
      break;
    case 'client':
      await runClientExample();
      break;
    case 'incentive':
      await runIncentiveExample();
      break;
    case 'advanced':
      await runAdvancedNodeExample();
      break;
    case 'error':
      await runErrorHandlingExample();
      break;
    default:
      console.log('Available examples:');
      console.log('  node      - Basic node operation');
      console.log('  client    - Client connection and tunneling');
      console.log('  incentive - Token rewards and staking');
      console.log('  advanced  - Advanced node configuration');
      console.log('  error     - Error handling and recovery');
      console.log('');
      console.log('Usage: node examples.js <example-name>');
  }
}

// Run the examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  runNodeExample,
  runClientExample,
  runIncentiveExample,
  runAdvancedNodeExample,
  runErrorHandlingExample
};
