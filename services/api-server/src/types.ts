export type ScopeLevel = 'global' | 'project' | 'local';

export interface MetricPulse {
  label: string;
  value: string | number;
  caption?: string;
}

export interface PipelinePhase {
  name: string;
  description: string;
  status: 'idle' | 'running' | 'warning' | 'critical';
  completion: number;
  throughput: string;
  latency: string;
  nextDeliveryMs: number;
  badges?: string[];
}

export interface ScopeResource {
  id: string;
  type: 'dataset' | 'web_page' | 'document';
  name: string;
  updatedAt: string;
  highlights: string[];
}

export interface IngestionJob {
  id: string;
  source: 'github' | 'crawl';
  project: string;
  dataset: string;
  scope: ScopeLevel;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  duration: string;
  summary: string;
  error?: string; // Error message when status is 'failed'
}

export interface QueryResult {
  chunk: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  vectorScore: number;
  sparseScore: number;
  rerankScore: number;
  dataset: string;
  scope: ScopeLevel;
  why: string;
}

export interface RetrievalSession {
  id: string;
  query: string;
  scope: ScopeLevel;
  results: QueryResult[];
  startedAt: string;
  latencyMs: number;
  toolsUsed: string[];
}

export interface OperationsEvent {
  title: string;
  detail: string;
  timestamp: string;
  scope: ScopeLevel;
  impact: 'success' | 'warning' | 'incident';
}

export interface WebSocketMessage {
  type: 'postgres:stats' | 'crawl:progress' | 'qdrant:stats' | 'query:progress' | 'github:progress' | 'error' | 'connected';
  project?: string;
  sessionId?: string;      // For crawl session isolation
  progressId?: string;     // Alias for sessionId (backward compat)
  timestamp: string;
  data: any;
}

export interface CrawlProgress {
  sessionId: string;
  project?: string;
  dataset?: string;
  phase: string;
  percentage: number;
  current: number;
  total: number;
  status: string;
  // Real-time progress tracking fields
  currentPhase?: string;
  phaseDetail?: string;
  chunksTotal?: number;
  chunksProcessed?: number;
  summariesGenerated?: number;
  embeddingsGenerated?: number;
}

export interface PostgresStats {
  projects: Array<{
    name: string;
    datasets: number;
    chunks: number;
    webPages: number;
  }>;
  recentCrawls: Array<{
    sessionId: string;
    project: string;
    dataset: string;
    status: string;
    pagesCrawled: number;
    pagesFailed: number;
    durationMs: number;
  }>;
}

export interface QdrantStats {
  collection: string;
  pointsCount: number;
  vectorsCount?: number;
  indexedVectorsCount?: number;
}

export interface ErrorEvent {
  source: 'postgres' | 'crawl4ai' | 'qdrant' | 'api';
  message: string;
  details?: string;
  timestamp: string;
  project?: string;
}

