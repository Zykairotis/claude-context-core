/**
 * Material Mesh Command Center - Type Definitions
 * Based on docs/ui-redesign/02-data-models.md
 */

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
  | 'github'
  | 'crawler'
  | 'vectordb'
  | 'reranker'
  | 'llm'
  | 'dashboard';

export type NodeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'ok'
  | 'failed'
  | 'warning';

export interface NodeMetadata {
  id: string;
  type: NodeType;
  label: string;
  status: NodeStatus;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Edge Types
// ============================================================================

export type EdgeType = 'data' | 'trigger' | 'control';

export interface EdgeMetadata {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  animated?: boolean;
}

// ============================================================================
// Mesh State (Canvas)
// ============================================================================

export interface MeshState {
  nodes: NodeMetadata[];
  edges: EdgeMetadata[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: { x: number; y: number; zoom: number };
}

// ============================================================================
// Metrics & Events
// ============================================================================

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface NodeMetrics {
  nodeId: string;
  throughput: MetricDataPoint[];
  latencyP95: MetricDataPoint[];
  errorRate: MetricDataPoint[];
}

export interface LogEntry {
  id: string;
  nodeId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Event {
  id: string;
  type: string;
  nodeId?: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

// ============================================================================
// WebSocket Protocol
// ============================================================================

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

export interface NodeStatusUpdate {
  nodeId: string;
  status: NodeStatus;
  message?: string;
}

export interface MetricsUpdate {
  nodeId: string;
  metrics: Partial<NodeMetrics>;
}

export interface LogUpdate {
  nodeId: string;
  logs: LogEntry[];
}

// ============================================================================
// Palette Items
// ============================================================================

export interface PaletteItem {
  id: string;
  type: NodeType;
  label: string;
  icon: string;
  description: string;
  category: 'sources' | 'processing' | 'outputs' | 'utilities';
}

// ============================================================================
// Inspector Tabs
// ============================================================================

export type InspectorTab = 'overview' | 'metrics' | 'logs' | 'artifacts' | 'actions';

// ============================================================================
// API Types
// ============================================================================

export interface CreateNodeRequest {
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface CreateNodeResponse {
  node: NodeMetadata;
}

export interface UpdateNodeRequest {
  label?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface CreateEdgeRequest {
  source: string;
  target: string;
  type: EdgeType;
}

export interface CreateEdgeResponse {
  edge: EdgeMetadata;
}

export interface GetMeshResponse {
  nodes: NodeMetadata[];
  edges: EdgeMetadata[];
}

export interface NodeActionRequest {
  action: 'start' | 'stop' | 'retry' | 'delete';
}

// ============================================================================
// Project & Dataset
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  type: 'code' | 'web' | 'mixed';
  itemCount: number;
  createdAt: string;
}
