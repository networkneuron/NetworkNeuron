# NetworkNeuron - Complete Deployment Guide

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- PostgreSQL 15+ (for production)
- Redis 7+ (for production)
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/networkneuron.git
   cd networkneuron
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│   Port: 3000    │    │   Port: 5000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   WebSocket     │    │   Redis Cache   │
│   Reverse Proxy │    │   (Socket.IO)   │    │   Port: 6379    │
│   Port: 80/443  │    │   Real-time     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=networkneuron
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_SSL=false

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://localhost:3000

# NetworkNeuron Specific
NODE_PORT=3000
NODE_HOST=0.0.0.0
BOOTSTRAP_NODES=["/ip4/127.0.0.1/tcp/3001/ws/p2p/12D3KooWBootstrap"]
MAX_PEERS=50
MIN_PEERS=5
REWARD_RATE=0.1
MIN_STAKE=1000
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_ENVIRONMENT=development
```

## 🐳 Docker Deployment

### Single Server Deployment

1. **Clone and configure**
   ```bash
   git clone https://github.com/your-org/networkneuron.git
   cd networkneuron
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose exec backend npm run migrate
   ```

4. **Verify deployment**
   ```bash
   docker-compose ps
   curl http://localhost/health
   ```

### Production Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: networkneuron
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  backend:
    image: ghcr.io/your-org/networkneuron-backend:latest
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    image: ghcr.io/your-org/networkneuron-frontend:latest
    environment:
      REACT_APP_API_URL: https://api.yourdomain.com
      REACT_APP_WS_URL: wss://api.yourdomain.com
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (v1.20+)
- kubectl configured
- Helm (optional)

### 1. Create Namespace
```bash
kubectl create namespace networkneuron
```

### 2. Deploy PostgreSQL
```yaml
# postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: networkneuron
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: networkneuron
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: networkneuron
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: networkneuron
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### 3. Deploy Redis
```yaml
# redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: networkneuron
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server", "--requirepass", "redis123"]
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: networkneuron
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### 4. Deploy Backend
```yaml
# backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: networkneuron
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/your-org/networkneuron-backend:latest
        env:
        - name: NODE_ENV
          value: production
        - name: DB_HOST
          value: postgres
        - name: REDIS_URL
          value: redis://redis:6379
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        ports:
        - containerPort: 5000
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: networkneuron
spec:
  selector:
    app: backend
  ports:
  - port: 5000
    targetPort: 5000
  type: ClusterIP
```

### 5. Deploy Frontend
```yaml
# frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: networkneuron
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: ghcr.io/your-org/networkneuron-frontend:latest
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: networkneuron
spec:
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

### 6. Deploy Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: networkneuron-ingress
  namespace: networkneuron
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: networkneuron-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
```

### 7. Deploy Secrets
```bash
kubectl create secret generic postgres-secret \
  --from-literal=password=your-secure-password \
  -n networkneuron

kubectl create secret generic app-secrets \
  --from-literal=jwt-secret=your-super-secret-jwt-key \
  -n networkneuron
```

## 🔒 SSL/TLS Configuration

### Using Let's Encrypt with Certbot

1. **Install Certbot**
   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Obtain SSL certificate**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Auto-renewal setup**
   ```bash
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Using Cloudflare SSL

1. **Configure Cloudflare DNS**
   - Add A record pointing to your server IP
   - Enable "Proxied" (orange cloud)

2. **Update Nginx configuration**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /etc/ssl/certs/cloudflare.pem;
       ssl_certificate_key /etc/ssl/private/cloudflare.key;
       
       # Cloudflare IPs for real IP
       set_real_ip_from 173.245.48.0/20;
       set_real_ip_from 103.21.244.0/22;
       # ... add all Cloudflare IP ranges
       real_ip_header CF-Connecting-IP;
   }
   ```

## 📊 Monitoring and Logging

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'networkneuron-backend'
    static_configs:
      - targets: ['backend:5000']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboard

Import the provided dashboard JSON files:
- `monitoring/grafana/dashboards/networkneuron-overview.json`
- `monitoring/grafana/dashboards/networkneuron-nodes.json`
- `monitoring/grafana/dashboards/networkneuron-sessions.json`

### Log Management

#### Using ELK Stack

1. **Deploy Elasticsearch**
   ```yaml
   elasticsearch:
     image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
     environment:
       - discovery.type=single-node
       - xpack.security.enabled=false
     ports:
       - "9200:9200"
   ```

2. **Deploy Logstash**
   ```yaml
   logstash:
     image: docker.elastic.co/logstash/logstash:8.8.0
     volumes:
       - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
     ports:
       - "5044:5044"
   ```

3. **Deploy Kibana**
   ```yaml
   kibana:
     image: docker.elastic.co/kibana/kibana:8.8.0
     environment:
       - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
     ports:
       - "5601:5601"
   ```

## 🔄 Backup and Recovery

### Database Backup

1. **Automated backup script**
   ```bash
   #!/bin/bash
   # backup.sh
   
   BACKUP_DIR="/backups"
   DATE=$(date +%Y%m%d_%H%M%S)
   
   # Create backup
   docker-compose exec -T postgres pg_dump -U postgres networkneuron > \
     $BACKUP_DIR/networkneuron_$DATE.sql
   
   # Compress backup
   gzip $BACKUP_DIR/networkneuron_$DATE.sql
   
   # Keep only last 7 days
   find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
   ```

2. **Schedule with cron**
   ```bash
   # Add to crontab
   0 2 * * * /path/to/backup.sh
   ```

### Redis Backup

```bash
# Redis RDB backup
docker-compose exec redis redis-cli BGSAVE
docker cp networkneuron-redis:/data/dump.rdb ./backups/
```

### Application Data Backup

```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Backup configuration files
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env docker-compose.yml nginx/
```

## 🚨 Disaster Recovery

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   gunzip networkneuron_20231201_020000.sql.gz
   docker-compose exec -T postgres psql -U postgres networkneuron < \
     networkneuron_20231201_020000.sql
   ```

2. **Full System Recovery**
   ```bash
   # 1. Restore infrastructure
   docker-compose up -d postgres redis
   
   # 2. Restore database
   # (see database recovery above)
   
   # 3. Restore application
   docker-compose up -d backend frontend nginx
   
   # 4. Verify services
   curl http://localhost/health
   ```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U postgres

# Check logs
docker-compose logs postgres

# Reset database
docker-compose down
docker volume rm networkneuron_postgres_data
docker-compose up -d postgres
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check logs
docker-compose logs redis

# Reset Redis
docker-compose exec redis redis-cli FLUSHALL
```

#### 3. Application Issues
```bash
# Check application logs
docker-compose logs backend
docker-compose logs frontend

# Restart services
docker-compose restart backend frontend

# Check resource usage
docker stats
```

#### 4. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/yourdomain.com.pem -text -noout

# Renew certificate
sudo certbot renew --dry-run
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_sessions_start_time ON sessions(start_time);
CREATE INDEX CONCURRENTLY idx_nodes_status ON nodes(status);
CREATE INDEX CONCURRENTLY idx_rewards_timestamp ON rewards(timestamp);
```

#### 2. Redis Optimization
```bash
# Configure Redis for production
echo "maxmemory 2gb" >> redis.conf
echo "maxmemory-policy allkeys-lru" >> redis.conf
echo "save 900 1" >> redis.conf
echo "save 300 10" >> redis.conf
echo "save 60 10000" >> redis.conf
```

#### 3. Nginx Optimization
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 📈 Scaling

### Horizontal Scaling

1. **Load Balancer Configuration**
   ```nginx
   upstream backend {
       server backend1:5000;
       server backend2:5000;
       server backend3:5000;
   }
   ```

2. **Database Scaling**
   - Read replicas for PostgreSQL
   - Redis Cluster for high availability

3. **Application Scaling**
   ```bash
   # Scale backend services
   docker-compose up -d --scale backend=3
   
   # Scale frontend services
   docker-compose up -d --scale frontend=2
   ```

### Vertical Scaling

1. **Resource Limits**
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 2G
             cpus: '1.0'
           reservations:
             memory: 1G
             cpus: '0.5'
   ```

2. **Database Tuning**
   ```sql
   -- PostgreSQL configuration
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   maintenance_work_mem = 64MB
   ```

## 🔐 Security Best Practices

### 1. Network Security
- Use firewall rules to restrict access
- Enable fail2ban for brute force protection
- Use VPN for administrative access

### 2. Application Security
- Regular security updates
- Use strong passwords and JWT secrets
- Enable HTTPS everywhere
- Implement rate limiting

### 3. Database Security
- Use strong database passwords
- Enable SSL connections
- Regular security audits
- Backup encryption

### 4. Container Security
- Use non-root users in containers
- Scan images for vulnerabilities
- Keep base images updated
- Use secrets management

## 📞 Support

### Getting Help

1. **Documentation**: Check this guide and inline code comments
2. **Issues**: Create GitHub issues for bugs and feature requests
3. **Community**: Join our Discord server for community support
4. **Enterprise**: Contact enterprise support for production deployments

### Monitoring and Alerts

Set up monitoring for:
- Service availability
- Database performance
- Resource usage
- Error rates
- Security events

### Maintenance Schedule

- **Daily**: Check service health and logs
- **Weekly**: Review performance metrics and security updates
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Full security audit and disaster recovery test

---

**NetworkNeuron** - Decentralizing the Internet, One Node at a Time 🌐
