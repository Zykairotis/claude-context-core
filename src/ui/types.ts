export interface WebSocketMessage {
  type: 'postgres:stats' | 'crawl:progress' | 'qdrant:stats' | 'query:progress' | 'github:progress' | 'error' | 'connected';
  project?: string;
  timestamp: string;
  data: any;
}

export interface ErrorMessage {
  id: string;
  source: 'postgres' | 'crawl4ai' | 'qdrant' | 'api';
  message: string;
  details?: string;
  timestamp: string;
  project?: string;
}

