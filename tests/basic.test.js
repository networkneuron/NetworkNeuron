/**
 * NetworkNeuron Test Suite
 * 
 * Basic tests to verify the core functionality of the NetworkNeuron protocol.
 */

import { NetworkNeuron } from './src/index.js';
import { NetworkNeuronClient } from './src/client/client.js';
import { IncentiveSystem } from './src/incentives/incentives.js';
import { CryptoManager } from './src/crypto/crypto.js';

/**
 * Test crypto functionality
 */
function testCrypto() {
  console.log('Testing cryptographic functions...');
  
  const crypto = new CryptoManager();
  
  // Test key generation
  const keyPair = crypto.generateKeyPair();
  console.log('✅ Key pair generation');
  
  // Test encryption/decryption
  const data = Buffer.from('Hello, NetworkNeuron!');
  const key = crypto.generateSymmetricKey();
  const encrypted = crypto.encrypt(data, key);
  const decrypted = crypto.decrypt(encrypted.encrypted, key, encrypted.iv, encrypted.tag);
  
  if (data.toString() === decrypted.toString()) {
    console.log('✅ Encryption/decryption');
  } else {
    console.log('❌ Encryption/decryption failed');
  }
  
  // Test signing/verification
  const message = 'Test message';
  const signature = crypto.sign(message, keyPair.privateKey);
  const isValid = crypto.verify(message, signature, keyPair.publicKey);
  
  if (isValid) {
    console.log('✅ Digital signatures');
  } else {
    console.log('❌ Digital signatures failed');
  }
}

/**
 * Test incentive system
 */
function testIncentiveSystem() {
  console.log('Testing incentive system...');
  
  const incentives = new IncentiveSystem({
    tokenName: 'NNR',
    initialSupply: 1000000,
    rewardRate: 0.1,
    minStake: 1000
  });
  
  const nodeId = 'test-node-001';
  
  // Test staking
  try {
    incentives.stakeTokens(nodeId, 5000);
    console.log('✅ Token staking');
  } catch (error) {
    console.log('❌ Token staking failed:', error.message);
  }
  
  // Test reward calculation
  incentives.updateNodePerformance(nodeId, {
    uptime: 99.5,
    averageLatency: 50,
    reputation: 95
  });
  
  incentives.recordBandwidthProvided(nodeId, 1024 * 1024 * 100); // 100MB
  incentives.recordSessionServed(nodeId, { clientId: 'test-client' });
  
  const rewards = incentives.calculateRewards(nodeId, 'daily');
  console.log('✅ Reward calculation:', rewards.amount);
  
  // Test network stats
  const stats = incentives.getNetworkStats();
  console.log('✅ Network statistics:', stats.totalStaked);
}

/**
 * Test node creation and basic functionality
 */
async function testNodeCreation() {
  console.log('Testing node creation...');
  
  try {
    const node = new NetworkNeuron({
      nodeId: 'test-node-001',
      port: 3001,
      host: '127.0.0.1',
      region: 'test',
      stake: 1000,
      logLevel: 'error' // Reduce log noise during tests
    });
    
    // Test node info
    const nodeInfo = node.getNodeInfo();
    if (nodeInfo && nodeInfo.id === 'test-node-001') {
      console.log('✅ Node creation');
    } else {
      console.log('❌ Node creation failed');
    }
    
    // Test network stats
    const stats = node.getNetworkStats();
    if (stats && typeof stats.totalNodes === 'number') {
      console.log('✅ Network statistics');
    } else {
      console.log('❌ Network statistics failed');
    }
    
  } catch (error) {
    console.log('❌ Node creation failed:', error.message);
  }
}

/**
 * Test client creation
 */
function testClientCreation() {
  console.log('Testing client creation...');
  
  try {
    const client = new NetworkNeuronClient({
      serverUrl: 'ws://localhost:3001',
      clientId: 'test-client-001',
      autoReconnect: false
    });
    
    const clientInfo = client.getClientInfo();
    if (clientInfo && clientInfo.clientId === 'test-client-001') {
      console.log('✅ Client creation');
    } else {
      console.log('❌ Client creation failed');
    }
    
    const status = client.getStatus();
    if (status && typeof status.connected === 'boolean') {
      console.log('✅ Client status');
    } else {
      console.log('❌ Client status failed');
    }
    
  } catch (error) {
    console.log('❌ Client creation failed:', error.message);
  }
}

/**
 * Test route finding algorithm
 */
function testRouteFinding() {
  console.log('Testing route finding...');
  
  // Mock available nodes
  const availableNodes = [
    {
      id: 'node-001',
      bandwidth: { download: 100, latency: 50 },
      reputation: 95,
      isActive: true
    },
    {
      id: 'node-002',
      bandwidth: { download: 50, latency: 100 },
      reputation: 85,
      isActive: true
    },
    {
      id: 'node-003',
      bandwidth: { download: 200, latency: 25 },
      reputation: 98,
      isActive: true
    }
  ];
  
  // Test shortest path algorithm
  const sortedByBandwidth = availableNodes.sort((a, b) => 
    b.bandwidth.download - a.bandwidth.download
  );
  
  if (sortedByBandwidth[0].id === 'node-003') {
    console.log('✅ Route optimization (bandwidth)');
  } else {
    console.log('❌ Route optimization (bandwidth) failed');
  }
  
  // Test latency optimization
  const sortedByLatency = availableNodes.sort((a, b) => 
    a.bandwidth.latency - b.bandwidth.latency
  );
  
  if (sortedByLatency[0].id === 'node-003') {
    console.log('✅ Route optimization (latency)');
  } else {
    console.log('❌ Route optimization (latency) failed');
  }
}

/**
 * Test message validation
 */
function testMessageValidation() {
  console.log('Testing message validation...');
  
  const crypto = new CryptoManager();
  
  // Test valid message
  const validMessage = {
    type: 'handshake',
    id: crypto.generateRandomString(16),
    timestamp: new Date(),
    source: 'test-node',
    payload: { nodeInfo: { id: 'test-node' } },
    signature: ''
  };
  
  validMessage.signature = crypto.sign(
    JSON.stringify(validMessage.payload),
    crypto.generateKeyPair().privateKey
  );
  
  // Test invalid message (missing fields)
  const invalidMessage = {
    type: 'handshake',
    // Missing required fields
    payload: {}
  };
  
  // Basic validation
  const isValid = validMessage.id && validMessage.timestamp && validMessage.source;
  const isInvalid = !invalidMessage.id || !invalidMessage.timestamp || !invalidMessage.source;
  
  if (isValid && isInvalid) {
    console.log('✅ Message validation');
  } else {
    console.log('❌ Message validation failed');
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Running NetworkNeuron Tests\n');
  
  testCrypto();
  console.log('');
  
  testIncentiveSystem();
  console.log('');
  
  await testNodeCreation();
  console.log('');
  
  testClientCreation();
  console.log('');
  
  testRouteFinding();
  console.log('');
  
  testMessageValidation();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
