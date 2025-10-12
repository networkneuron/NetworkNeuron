# NetworkNeuron - Decentralized VPN Protocol

## Overview

NetworkNeuron is a decentralized VPN (dVPN) protocol that provides secure, censorship-resistant internet access through a community-operated network of nodes. Unlike traditional VPNs that rely on centralized servers, NetworkNeuron uses a peer-to-peer architecture where community members operate nodes and earn rewards for providing bandwidth and services.

## Key Features

- **Decentralized Architecture**: No single point of failure or control
- **Community-Powered**: Nodes operated by community members worldwide
- **Censorship Resistance**: Bypass internet restrictions and surveillance
- **Privacy-First**: End-to-end encryption with no data logging
- **Incentive System**: Token-based rewards for node operators
- **Cross-Platform**: Works on desktop, mobile, and embedded devices
- **Load Balancing**: Intelligent traffic routing and optimization

## Architecture

### Core Components

1. **P2P Network Manager** (`src/network/p2p.js`)
   - Handles peer-to-peer networking using libp2p
   - Manages node discovery and connection
   - Implements handshake and authentication protocols

2. **Traffic Router** (`src/routing/router.js`)
   - Intelligent routing of data packets
   - Load balancing across available nodes
   - Path optimization algorithms

3. **Cryptographic Module** (`src/crypto/crypto.js`)
   - End-to-end encryption using ChaCha20-Poly1305
   - Digital signatures and key management
   - Secure tunnel key generation

4. **Incentive System** (`src/incentives/incentives.js`)
   - Token-based reward mechanism
   - Staking system for node operators
   - Performance-based reward distribution

5. **Client Application** (`src/client/client.js`)
   - User-friendly interface for connecting to the network
   - HTTP proxy functionality
   - Automatic reconnection and error handling

### Protocol Flow

```
Client Request → Route Discovery → Node Selection → Encrypted Tunnel → Data Transmission → Reward Distribution
```

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Quick Start

```bash
# Clone the repository
git clone https://github.com/networkneuron/networkneuron.git
cd networkneuron

# Install dependencies
npm install

# Start a node
npm start

# Or run in development mode
npm run dev
```

### Global Installation

```bash
# Install globally
npm install -g networkneuron

# Initialize a node
networkneuron init

# Start the node
networkneuron start

# Check status
networkneuron status
```

## Usage

### Running a Node

```javascript
import { NetworkNeuron } from 'networkneuron';

const node = new NetworkNeuron({
  nodeId: 'my-node-001',
  port: 3000,
  host: '0.0.0.0',
  region: 'us-east',
  stake: 5000,
  bootstrapNodes: [
    '/ip4/127.0.0.1/tcp/3001/ws/p2p/12D3KooWBootstrapNode'
  ]
});

// Set up event handlers
node.on('started', () => {
  console.log('Node started successfully');
});

node.on('peer:connected', (peerId) => {
  console.log(`Peer connected: ${peerId.toString()}`);
});

// Start the node
await node.start();
```

### Using as a Client

```javascript
import { NetworkNeuronClient } from 'networkneuron';

const client = new NetworkNeuronClient({
  serverUrl: 'ws://localhost:3000',
  clientId: 'my-client-001',
  autoReconnect: true
});

// Connect to network
await client.connect();

// Start tunnel
await client.startTunnel('example.com', {
  minBandwidth: 10,
  maxLatency: 500,
  encryption: true
});

// Send data through tunnel
await client.sendTunnelData('Hello, NetworkNeuron!', 'example.com');
```

### HTTP Proxy Mode

```javascript
import { NetworkNeuronProxy } from 'networkneuron';

const proxy = new NetworkNeuronProxy(client, {
  proxyPort: 8080,
  targetHost: 'example.com',
  targetPort: 80
});

// Start proxy
await proxy.start();

// Now you can use localhost:8080 as a proxy
// curl --proxy localhost:8080 http://example.com
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Node Configuration
NODE_PORT=3000
NODE_HOST=0.0.0.0
NODE_NAME=NetworkNeuron-Node
NODE_REGION=auto

# Network Configuration
BOOTSTRAP_NODES=["/ip4/127.0.0.1/tcp/3001/ws/p2p/12D3KooWBootstrap"]
MAX_PEERS=50
MIN_PEERS=5
CONNECTION_TIMEOUT=30000

# Security Configuration
ENCRYPTION_ALGORITHM=chacha20-poly1305
KEY_SIZE=256
HANDSHAKE_TIMEOUT=10000

# Incentive Configuration
REWARD_TOKEN=NNR
MIN_STAKE=1000
REWARD_RATE=0.1

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=networkneuron.log
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodeId` | string | auto-generated | Unique identifier for the node |
| `port` | number | 3000 | Port to listen on |
| `host` | string | '0.0.0.0' | Host address to bind to |
| `region` | string | 'auto' | Geographic region |
| `stake` | number | 1000 | Initial stake amount |
| `maxPeers` | number | 50 | Maximum number of peers |
| `minPeers` | number | 5 | Minimum number of peers |
| `logLevel` | string | 'info' | Logging level |

## API Reference

### NetworkNeuron Class

#### Methods

- `start()`: Start the node
- `stop()`: Stop the node
- `getNodeInfo()`: Get node information
- `getNetworkStats()`: Get network statistics
- `findRoute(destination, requirements)`: Find route to destination
- `createSession(clientId, requirements)`: Create client session
- `sendPacket(packet)`: Send data packet

#### Events

- `started`: Node started successfully
- `stopped`: Node stopped
- `peer:connected`: Peer connected
- `peer:disconnected`: Peer disconnected
- `session:created`: Client session created
- `packet:sent`: Data packet sent

### NetworkNeuronClient Class

#### Methods

- `connect()`: Connect to network
- `disconnect()`: Disconnect from network
- `startTunnel(destination, requirements)`: Start tunnel
- `stopTunnel()`: Stop tunnel
- `sendTunnelData(data, destination)`: Send data through tunnel

#### Events

- `connected`: Connected to network
- `disconnected`: Disconnected from network
- `route:established`: Route established
- `tunnel:started`: Tunnel started
- `tunnel:data`: Data received through tunnel

## Incentive System

### Staking

Node operators must stake tokens to participate in the network:

```javascript
import { IncentiveSystem } from 'networkneuron';

const incentives = new IncentiveSystem({
  tokenName: 'NNR',
  initialSupply: 1000000000,
  rewardRate: 0.1,
  minStake: 1000
});

// Stake tokens
await incentives.stakeTokens('node-001', 5000);

// Unstake tokens
await incentives.unstakeTokens('node-001', 1000);
```

### Rewards

Rewards are calculated based on:
- Bandwidth provided
- Sessions served
- Node uptime
- Stake amount
- Performance metrics

```javascript
// Calculate rewards
const rewards = incentives.calculateRewards('node-001', 'daily');

// Distribute rewards
await incentives.distributeRewards('daily');
```

## Security

### Encryption

- **Algorithm**: ChaCha20-Poly1305
- **Key Size**: 256 bits
- **Key Exchange**: X25519 ECDH
- **Authentication**: RSA-SHA256 signatures

### Privacy

- No data logging or storage
- End-to-end encryption
- Anonymous peer connections
- No central authority

## Development

### Project Structure

```
networkneuron/
├── src/
│   ├── core/           # Core protocol types and interfaces
│   ├── network/        # P2P networking implementation
│   ├── routing/        # Traffic routing and load balancing
│   ├── crypto/         # Cryptographic functions
│   ├── incentives/     # Token economics and rewards
│   ├── client/         # Client application
│   └── index.js        # Main protocol implementation
├── examples/           # Usage examples
├── tests/              # Test suites
├── docs/               # Documentation
└── public/             # Web interface
```

### Building

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "P2P Network"

# Run with coverage
npm run test:coverage
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 8080

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  networkneuron:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_PORT=3000
      - MANAGEMENT_PORT=8080
    volumes:
      - ./data:/app/data
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: networkneuron
spec:
  replicas: 3
  selector:
    matchLabels:
      app: networkneuron
  template:
    metadata:
      labels:
        app: networkneuron
    spec:
      containers:
      - name: networkneuron
        image: networkneuron:latest
        ports:
        - containerPort: 3000
        - containerPort: 8080
        env:
        - name: NODE_PORT
          value: "3000"
        - name: MANAGEMENT_PORT
          value: "8080"
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/networkneuron.git
cd networkneuron

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# Add tests for new functionality
# Ensure all tests pass
npm test

# Commit your changes
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Create a Pull Request
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.networkneuron.org](https://docs.networkneuron.org)
- **Community**: [Discord](https://discord.gg/networkneuron)
- **Issues**: [GitHub Issues](https://github.com/networkneuron/networkneuron/issues)
- **Security**: security@networkneuron.org

## Roadmap

### Phase 1: Core Protocol (Current)
- ✅ P2P networking implementation
- ✅ Traffic routing and load balancing
- ✅ Encryption and security layer
- ✅ Basic incentive system

### Phase 2: Enhanced Features
- 🔄 Advanced routing algorithms
- 🔄 Mobile client applications
- 🔄 Blockchain integration
- 🔄 Governance system

### Phase 3: Ecosystem
- 📋 Third-party integrations
- 📋 Enterprise features
- 📋 Advanced analytics
- 📋 Global deployment tools

## Changelog

### v1.0.0 (Current)
- Initial release
- Core P2P networking
- Basic routing and encryption
- Token-based incentive system
- Web management interface
- Client applications

---

**NetworkNeuron** - Decentralizing the Internet, One Node at a Time 🌐
