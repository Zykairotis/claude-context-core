/**
 * Material Mesh Command Center - Zustand Store
 * Real-time state management via WebSocket
 * Based on docs/ui-redesign/03-realtime-system.md
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  NodeMetadata,
  EdgeMetadata,
  NodeMetrics,
  LogEntry,
  Event,
  NodeStatus,
} from '@types';

// ============================================================================
// Store State Interface
// ============================================================================

interface RealtimeState {
  // Connection
  connected: boolean;
  reconnecting: boolean;
  
  // Mesh
  nodes: NodeMetadata[];
  edges: EdgeMetadata[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: { x: number; y: number; zoom: number };
  
  // Settings Panel
  settingsPanel: {
    isOpen: boolean;
    node: NodeMetadata | null;
  };
  
  // Metrics
  metrics: Map<string, NodeMetrics>;
  
  // Logs
  logs: Map<string, LogEntry[]>;
  
  // Events
  events: Event[];
  
  // Actions
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  
  // Mesh actions
  setNodes: (nodes: NodeMetadata[]) => void;
  setEdges: (edges: EdgeMetadata[]) => void;
  addNode: (node: NodeMetadata) => void;
  updateNode: (id: string, updates: Partial<NodeMetadata>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: EdgeMetadata) => void;
  deleteEdge: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  
  // Node status updates
  updateNodeStatus: (nodeId: string, status: NodeStatus, message?: string) => void;
  
  // Metrics actions
  updateMetrics: (nodeId: string, metrics: Partial<NodeMetrics>) => void;
  
  // Logs actions
  appendLogs: (nodeId: string, logs: LogEntry[]) => void;
  clearLogs: (nodeId: string) => void;
  
  // Events actions
  addEvent: (event: Event) => void;
  clearEvents: () => void;
  
  // Settings Panel actions
  openSettings: (node: NodeMetadata) => void;
  closeSettings: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  connected: false,
  reconnecting: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  settingsPanel: {
    isOpen: false,
    node: null,
  },
  metrics: new Map(),
  logs: new Map(),
  events: [],
};

// ============================================================================
// Store
// ============================================================================

export const useRealtimeStore = create<RealtimeState>()(
  devtools(
    (set) => ({
      ...initialState,

      // Connection
      setConnected: (connected) => set({ connected }),
      setReconnecting: (reconnecting) => set({ reconnecting }),

      // Mesh actions
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      
      addNode: (node) =>
        set((state) => ({
          nodes: [...state.nodes, node],
        })),
      
      updateNode: (id, updates) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, ...updates, updatedAt: new Date().toISOString() } : node
          ),
        })),
      
      deleteNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== id),
          edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        })),
      
      addEdge: (edge) =>
        set((state) => ({
          edges: [...state.edges, edge],
        })),
      
      deleteEdge: (id) =>
        set((state) => ({
          edges: state.edges.filter((edge) => edge.id !== id),
          selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
        })),
      
      setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
      setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
      setViewport: (viewport) => set({ viewport }),

      // Node status updates
      updateNodeStatus: (nodeId, status, message) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  status,
                  data: message ? { ...node.data, statusMessage: message } : node.data,
                  updatedAt: new Date().toISOString(),
                }
              : node
          ),
        })),

      // Metrics actions
      updateMetrics: (nodeId, metrics) =>
        set((state) => {
          const newMetrics = new Map(state.metrics);
          const existing = newMetrics.get(nodeId);
          newMetrics.set(nodeId, {
            nodeId,
            throughput: metrics.throughput || existing?.throughput || [],
            latencyP95: metrics.latencyP95 || existing?.latencyP95 || [],
            errorRate: metrics.errorRate || existing?.errorRate || [],
          });
          return { metrics: newMetrics };
        }),

      // Logs actions
      appendLogs: (nodeId, logs) =>
        set((state) => {
          const newLogs = new Map(state.logs);
          const existing = newLogs.get(nodeId) || [];
          newLogs.set(nodeId, [...existing, ...logs].slice(-500)); // Keep last 500 logs
          return { logs: newLogs };
        }),
      
      clearLogs: (nodeId) =>
        set((state) => {
          const newLogs = new Map(state.logs);
          newLogs.delete(nodeId);
          return { logs: newLogs };
        }),

      // Events actions
      addEvent: (event) =>
        set((state) => ({
          events: [event, ...state.events].slice(0, 100), // Keep last 100 events
        })),
      
      clearEvents: () => set({ events: [] }),

      // Settings Panel actions
      openSettings: (node) =>
        set({ settingsPanel: { isOpen: true, node } }),
      
      closeSettings: () =>
        set((state) => ({
          settingsPanel: { ...state.settingsPanel, isOpen: false },
        })),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'realtime-store',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectSelectedNode = (state: RealtimeState) =>
  state.nodes.find((n) => n.id === state.selectedNodeId);

export const selectSelectedEdge = (state: RealtimeState) =>
  state.edges.find((e) => e.id === state.selectedEdgeId);

export const selectNodeMetrics = (state: RealtimeState, nodeId: string) =>
  state.metrics.get(nodeId);

export const selectNodeLogs = (state: RealtimeState, nodeId: string) =>
  state.logs.get(nodeId) || [];

export const selectNodesByStatus = (state: RealtimeState, status: NodeStatus) =>
  state.nodes.filter((n) => n.status === status);
