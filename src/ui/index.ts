export { App } from './app';
export {
  ContextApiClient,
  MockContextApiClient,
  type ContextClient,
  type GithubIngestForm,
  type CrawlIngestForm,
  type QueryRequest,
  type ShareResourceRequest
} from './api/client';
export {
  type ScopeLevel,
  type ScopeResource,
  type IngestionJob,
  type QueryResult,
  type RetrievalSession,
  type OperationsEvent,
  type PipelinePhase,
  type MetricPulse
} from './data/mock-dashboard';
export { ShadcnGlassStyles } from './styles/glass-styles';
export { useWebSocket } from './hooks/useWebSocket';
export { ConnectionStatus } from './components/connection-status';
export { ErrorDisplay } from './components/error-display';
export type { WebSocketMessage, ErrorMessage } from './types';
