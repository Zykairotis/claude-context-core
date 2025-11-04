import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (two levels up from api-server/src)
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

const rawCrawl4aiUrl = (process.env.CRAWL4AI_URL || 'http://localhost:7070').replace(/\/+$/, '');
const crawl4aiBaseUrl = rawCrawl4aiUrl.endsWith('/api') ? rawCrawl4aiUrl.slice(0, -4) : rawCrawl4aiUrl;

export const config = {
  port: parseInt(process.env.PORT || '3030', 10),
  postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:code-context-secure-password@localhost:5533/claude_context',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  crawl4aiUrl: rawCrawl4aiUrl,
  crawl4aiBaseUrl,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Polling intervals (ms)
  postgresPollingInterval: 1000, // Poll every 1 second for faster updates
  crawlPollingInterval: 1000,
  qdrantPollingInterval: 5000,
  errorPollingInterval: 3000,
} as const;

