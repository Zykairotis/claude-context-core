import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Pool } from 'pg';
import { config } from './config';
import { WebSocketManager } from './websocket';
import { PostgresMonitor } from './monitors/postgres-monitor';
import { CrawlMonitor } from './monitors/crawl-monitor';
import { QdrantMonitor } from './monitors/qdrant-monitor';
import { createProjectsRouter } from './routes/projects';
import { initializeContext } from './core/context-factory';
import { JobQueue } from './services/job-queue';
import { GitHubWorker } from './workers/github-worker';

async function main() {
  console.log('[Server] Starting API server...');
  console.log(`[Server] Postgres: ${config.postgresUrl.replace(/:[^:]*@/, ':***@')}`);
  console.log(`[Server] Qdrant: ${config.qdrantUrl}`);
  console.log(`[Server] Crawl4AI: ${config.crawl4aiUrl} (base: ${config.crawl4aiBaseUrl})`);

  // Initialize database connection
  const pool = new Pool({
    connectionString: config.postgresUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test database connection
  try {
    const client = await pool.connect();
    console.log('[Server] Database connection established');
    client.release();
  } catch (error: any) {
    console.error('[Server] Failed to connect to database:', error.message);
    process.exit(1);
  }

  // Create Express app
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: {
        postgres: 'connected',
        qdrant: config.qdrantUrl,
        crawl4ai: config.crawl4aiUrl
      }
    });
  });

  // Tools endpoint
  app.get('/tools', (req, res) => {
    res.json([
      'claudeContext.index',
      'claudeContext.search',
      'claudeContext.query',
      'claudeContext.share',
      'claudeContext.listProjects',
      'claudeContext.listDatasets'
    ]);
  });

  // Initialize core context and monitors
  const context = initializeContext(pool);
  const crawlMonitor = new CrawlMonitor(pool);
  const postgresMonitor = new PostgresMonitor(pool);
  const qdrantMonitor = new QdrantMonitor();

  // Initialize job queue
  const jobQueue = new JobQueue({ pool });
  await jobQueue.start();
  console.log('[Server] Job queue initialized');

  // Initialize GitHub worker
  const githubWorker = new GitHubWorker({
    pool,
    jobQueue
  });
  await githubWorker.start();
  console.log('[Server] GitHub worker started');

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket server
  const wsManager = new WebSocketManager(httpServer, postgresMonitor);

  // Start PostgreSQL LISTEN for job updates
  await wsManager.startPostgresListener(config.postgresUrl);

  // Mount project routes (with wsManager for query progress and jobQueue)
  app.use('/projects', createProjectsRouter(pool, crawlMonitor, wsManager, context, jobQueue));

  // Start monitoring and pipe updates to WebSocket
  await postgresMonitor.start((message) => {
    wsManager.broadcast(message);
  });

  crawlMonitor.start((message) => {
    wsManager.broadcast(message);
  });

  qdrantMonitor.start((message) => {
    wsManager.broadcast(message);
  });

  // Start HTTP server
  httpServer.listen(config.port, () => {
    console.log(`[Server] API server listening on http://localhost:${config.port}`);
    console.log(`[Server] WebSocket server listening on ws://localhost:${config.port}/ws`);
    console.log('[Server] Ready to accept connections');
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    
    await postgresMonitor.stop();
    crawlMonitor.stop();
    qdrantMonitor.stop();
    
    await githubWorker.stop();
    await jobQueue.stop();
    await wsManager.close();
    
    await pool.end();
    
    httpServer.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
