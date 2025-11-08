# Part 7: Cognee MCP Integration - Deployment & Configuration
## GOAP Planning Phase 7: Production Readiness

### Executive Summary
This document covers deployment strategies, configuration management,
security considerations, and production optimization for the Cognee MCP
integration. We provide Docker configurations, environment setups, and
monitoring dashboards.

---

## 1. Deployment Architecture

### 1.1 Container Configuration

```dockerfile
# Dockerfile for Cognee MCP Integration
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    curl \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \
    else npm ci; fi

# Copy application code
COPY . .

# Build if necessary
RUN if [ -f tsconfig.json ]; then npm run build; fi

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy from build stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/mcp-server.js ./
COPY --from=base /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 3000

CMD ["node", "mcp-server.js"]
```

### 1.2 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Cognee MCP Server
  cognee-mcp:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cognee-mcp-server
    environment:
      - NODE_ENV=production
      - COGNEE_URL=${COGNEE_URL:-http://cognee:8340}
      - COGNEE_TOKEN=${COGNEE_TOKEN}
      - POSTGRES_CONNECTION_STRING=${POSTGRES_CONNECTION_STRING}
      - VECTOR_DATABASE_PROVIDER=${VECTOR_DATABASE_PROVIDER:-postgres}
      - EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER:-auto}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    ports:
      - "3000:3000"
    networks:
      - cognee-network
    depends_on:
      - postgres
      - cognee
    restart: unless-stopped
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mcp.rule=Host(`mcp.example.com`)"
      - "traefik.http.services.mcp.loadbalancer.server.port=3000"

  # Cognee Service
  cognee:
    image: cognee/cognee:latest
    container_name: cognee-service
    environment:
      - COGNEE_ENV=production
      - DATABASE_URL=postgresql://cognee:password@postgres:5432/cognee
      - REDIS_URL=redis://redis:6379
      - NEO4J_URI=bolt://neo4j:7687
      - VECTOR_DB_PROVIDER=qdrant
      - QDRANT_URL=http://qdrant:6333
    ports:
      - "8340:8340"
    networks:
      - cognee-network
    depends_on:
      - postgres
      - redis
      - neo4j
      - qdrant
    restart: unless-stopped
    volumes:
      - cognee-data:/app/data

  # PostgreSQL with pgvector
  postgres:
    image: ankane/pgvector:latest
    container_name: cognee-postgres
    environment:
      - POSTGRES_USER=cognee
      - POSTGRES_PASSWORD=secure-password-here
      - POSTGRES_DB=cognee
      - POSTGRES_MAX_CONNECTIONS=200
    ports:
      - "5432:5432"
    networks:
      - cognee-network
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cognee"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for caching
  redis:
    image: redis:7-alpine
    container_name: cognee-redis
    ports:
      - "6379:6379"
    networks:
      - cognee-network
    volumes:
      - redis-data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  # Neo4j for graph database
  neo4j:
    image: neo4j:5-community
    container_name: cognee-neo4j
    environment:
      - NEO4J_AUTH=neo4j/secure-password-here
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_memory_heap_initial__size=512m
      - NEO4J_dbms_memory_heap_max__size=2G
    ports:
      - "7474:7474"
      - "7687:7687"
    networks:
      - cognee-network
    volumes:
      - neo4j-data:/data
    restart: unless-stopped

  # Qdrant vector database
  qdrant:
    image: qdrant/qdrant
    container_name: cognee-qdrant
    ports:
      - "6333:6333"
    networks:
      - cognee-network
    volumes:
      - qdrant-data:/qdrant/storage
    restart: unless-stopped

  # Monitoring with Prometheus
  prometheus:
    image: prom/prometheus
    container_name: cognee-prometheus
    ports:
      - "9090:9090"
    networks:
      - cognee-network
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    restart: unless-stopped

  # Grafana for dashboards
  grafana:
    image: grafana/grafana
    container_name: cognee-grafana
    ports:
      - "3001:3000"
    networks:
      - cognee-network
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    restart: unless-stopped

networks:
  cognee-network:
    driver: bridge

volumes:
  cognee-data:
  postgres-data:
  redis-data:
  neo4j-data:
  qdrant-data:
  prometheus-data:
  grafana-data:
```

---

## 2. Environment Configuration

### 2.1 Configuration Management

```javascript
/**
 * Comprehensive configuration management for Cognee MCP
 */
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.validators = new Map();
    this.sources = ['env', 'file', 'remote'];
  }
  
  async load() {
    // Load from multiple sources
    for (const source of this.sources) {
      const sourceConfig = await this.loadFromSource(source);
      this.mergeConfig(sourceConfig);
    }
    
    // Validate configuration
    this.validate();
    
    // Apply defaults
    this.applyDefaults();
    
    return this.config;
  }
  
  async loadFromSource(source) {
    switch (source) {
      case 'env':
        return this.loadFromEnvironment();
        
      case 'file':
        return this.loadFromFile();
        
      case 'remote':
        return this.loadFromRemote();
        
      default:
        return {};
    }
  }
  
  loadFromEnvironment() {
    return {
      cognee: {
        url: process.env.COGNEE_URL || 'http://localhost:8340',
        token: process.env.COGNEE_TOKEN,
        timeout: parseInt(process.env.COGNEE_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.COGNEE_MAX_RETRIES || '3')
      },
      database: {
        provider: process.env.VECTOR_DATABASE_PROVIDER || 'postgres',
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
        maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'),
        ssl: process.env.DATABASE_SSL === 'true'
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER || 'auto',
        model: process.env.EMBEDDING_MODEL,
        apiKey: process.env.EMBEDDING_API_KEY,
        batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '50')
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
        tracingEnabled: process.env.TRACING_ENABLED === 'true'
      },
      security: {
        rateLimit: {
          enabled: process.env.RATE_LIMIT_ENABLED === 'true',
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
        },
        cors: {
          enabled: process.env.CORS_ENABLED === 'true',
          origins: process.env.CORS_ORIGINS?.split(',') || ['*']
        }
      }
    };
  }
  
  async loadFromFile() {
    const fs = require('fs').promises;
    const path = require('path');
    
    const configPath = path.join(process.cwd(), 'config', 
      `${process.env.NODE_ENV || 'development'}.json`);
    
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Config file not found: ${configPath}`);
      return {};
    }
  }
  
  async loadFromRemote() {
    // Load configuration from remote config service
    if (!process.env.CONFIG_SERVICE_URL) {
      return {};
    }
    
    try {
      const response = await fetch(process.env.CONFIG_SERVICE_URL, {
        headers: {
          'X-Service': 'cognee-mcp',
          'X-Environment': process.env.NODE_ENV || 'development'
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to load remote config:', error);
    }
    
    return {};
  }
  
  mergeConfig(source) {
    // Deep merge configuration
    this.config = this.deepMerge(this.config, source);
  }
  
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }
  
  validate() {
    const errors = [];
    
    // Required configurations
    if (!this.config.cognee?.url) {
      errors.push('COGNEE_URL is required');
    }
    
    if (!this.config.database?.connectionString) {
      errors.push('Database connection string is required');
    }
    
    // Validate with custom validators
    for (const [path, validator] of this.validators) {
      const value = this.getByPath(path);
      const result = validator(value);
      
      if (!result.valid) {
        errors.push(`${path}: ${result.error}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  applyDefaults() {
    // Apply default values
    const defaults = {
      cognee: {
        timeout: 30000,
        maxRetries: 3
      },
      database: {
        maxConnections: 10,
        ssl: false
      },
      embedding: {
        batchSize: 50
      },
      monitoring: {
        enabled: true,
        metricsPort: 9090
      },
      security: {
        rateLimit: {
          enabled: true,
          maxRequests: 100,
          windowMs: 60000
        }
      }
    };
    
    this.config = this.deepMerge(defaults, this.config);
  }
  
  getByPath(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }
  
  registerValidator(path, validator) {
    this.validators.set(path, validator);
  }
  
  get(path) {
    return this.getByPath(path);
  }
  
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.config);
    
    target[lastKey] = value;
  }
}
```

### 2.2 Environment Files

```bash
# .env.production
NODE_ENV=production

# Cognee Configuration
COGNEE_URL=https://api.cognee.ai
COGNEE_TOKEN=your-secure-token-here
COGNEE_TIMEOUT=30000
COGNEE_MAX_RETRIES=3

# Database Configuration
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/db?ssl=true
POSTGRES_MAX_CONNECTIONS=20
VECTOR_DATABASE_PROVIDER=postgres
DATABASE_SSL=true

# Embedding Configuration
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=your-api-key-here
EMBEDDING_BATCH_SIZE=100

# Monitoring
MONITORING_ENABLED=true
METRICS_PORT=9090
TRACING_ENABLED=true
JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
CORS_ENABLED=true
CORS_ORIGINS=https://app.example.com,https://admin.example.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=file
LOG_FILE_PATH=/app/logs/cognee-mcp.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
```

---

## 3. Security Configuration

### 3.1 Security Middleware

```javascript
/**
 * Security middleware for production deployment
 */
class SecurityMiddleware {
  constructor(config) {
    this.config = config;
  }
  
  setupSecurity(app) {
    // Helmet for security headers
    const helmet = require('helmet');
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));
    
    // Rate limiting
    if (this.config.security.rateLimit.enabled) {
      const rateLimit = require('express-rate-limit');
      const limiter = rateLimit({
        windowMs: this.config.security.rateLimit.windowMs,
        max: this.config.security.rateLimit.maxRequests,
        message: 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false
      });
      app.use('/api/', limiter);
    }
    
    // CORS
    if (this.config.security.cors.enabled) {
      const cors = require('cors');
      app.use(cors({
        origin: this.config.security.cors.origins,
        credentials: true,
        optionsSuccessStatus: 200
      }));
    }
    
    // API Key authentication
    app.use(this.apiKeyAuth.bind(this));
    
    // Request sanitization
    app.use(this.sanitizeInput.bind(this));
    
    // Audit logging
    app.use(this.auditLog.bind(this));
  }
  
  apiKeyAuth(req, res, next) {
    // Skip auth for health checks
    if (req.path === '/health') {
      return next();
    }
    
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate API key
    if (!this.validateApiKey(apiKey)) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
    
    next();
  }
  
  validateApiKey(apiKey) {
    // In production, check against database or cache
    const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
    return validKeys.includes(apiKey);
  }
  
  sanitizeInput(req, res, next) {
    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = this.sanitizeObject(req.query);
    }
    
    next();
  }
  
  sanitizeObject(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Remove potential XSS
      if (typeof value === 'string') {
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  auditLog(req, res, next) {
    const startTime = Date.now();
    
    // Log request
    const auditEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      apiKey: req.headers['x-api-key']?.substr(0, 8) + '...'
    };
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
      res.send = originalSend;
      
      auditEntry.statusCode = res.statusCode;
      auditEntry.duration = Date.now() - startTime;
      
      // Log to audit system
      console.log('AUDIT:', JSON.stringify(auditEntry));
      
      return res.send(data);
    };
    
    next();
  }
}
```

---

## 4. Monitoring & Observability

### 4.1 Metrics Collection

```javascript
/**
 * Prometheus metrics for monitoring
 */
const promClient = require('prom-client');

class MetricsCollector {
  constructor() {
    // Create custom metrics
    this.metrics = {
      // Counters
      requestsTotal: new promClient.Counter({
        name: 'cognee_mcp_requests_total',
        help: 'Total number of requests',
        labelNames: ['method', 'tool', 'status']
      }),
      
      // Histograms
      requestDuration: new promClient.Histogram({
        name: 'cognee_mcp_request_duration_seconds',
        help: 'Request duration in seconds',
        labelNames: ['method', 'tool'],
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      }),
      
      // Gauges
      activeConnections: new promClient.Gauge({
        name: 'cognee_mcp_active_connections',
        help: 'Number of active connections'
      }),
      
      datasetCount: new promClient.Gauge({
        name: 'cognee_datasets_total',
        help: 'Total number of datasets'
      }),
      
      memoryUsage: new promClient.Gauge({
        name: 'cognee_mcp_memory_usage_bytes',
        help: 'Memory usage in bytes',
        labelNames: ['type']
      })
    };
    
    // Register default metrics
    promClient.collectDefaultMetrics({ prefix: 'cognee_mcp_' });
    
    // Start collection
    this.startCollection();
  }
  
  startCollection() {
    // Update memory metrics every 10 seconds
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.set({ type: 'heap' }, memUsage.heapUsed);
      this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);
    }, 10000);
  }
  
  recordRequest(tool, method, status, duration) {
    this.metrics.requestsTotal.inc({ method, tool, status });
    this.metrics.requestDuration.observe({ method, tool }, duration / 1000);
  }
  
  getMetrics() {
    return promClient.register.metrics();
  }
  
  setupEndpoint(app) {
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      res.send(await this.getMetrics());
    });
  }
}
```

### 4.2 Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Cognee MCP Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(cognee_mcp_requests_total[5m])",
            "legendFormat": "{{method}} - {{tool}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(cognee_mcp_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{tool}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(cognee_mcp_requests_total{status!=\"success\"}[5m])",
            "legendFormat": "{{status}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "cognee_mcp_memory_usage_bytes",
            "legendFormat": "{{type}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "cognee_mcp_active_connections"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Dataset Count",
        "targets": [
          {
            "expr": "cognee_datasets_total"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

---

## Summary

This deployment and configuration phase provides:

1. **Complete Docker setup** with all required services
2. **Comprehensive configuration management** with multiple sources
3. **Security middleware** for production environments
4. **Monitoring infrastructure** with Prometheus and Grafana
5. **Environment-specific configurations** for different deployments

The system is ready for production deployment with full observability,
security, and scalability features.

---

*End of Part 7: Deployment & Configuration*
