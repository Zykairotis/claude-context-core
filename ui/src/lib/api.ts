/**
 * API Client & React Query Hooks
 * Phase 5: API Integration & Polish
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NodeMetadata, EdgeMetadata, LogEntry, NodeType } from '@types';
import { useRealtimeStore } from '@store';
import { toast } from './toast';

// ============================================================================
// API Client
// ============================================================================

const API_BASE_URL = (typeof window !== 'undefined' && (window as any).ENV?.VITE_API_URL) || 'http://localhost:3030';

// Development mode: Use local store if API server isn't running
const DEV_MODE = typeof window !== 'undefined' && window.location.hostname === 'localhost';

class APIClient {
  private baseUrl: string;
  private apiAvailable: boolean = true;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private markApiUnavailable() {
    if (this.apiAvailable && DEV_MODE) {
      this.apiAvailable = false;
      console.warn(
        '[API] ⚠️ API server not available. Running in offline mode.\n' +
        'Start the API server with: cd services/api-server && npm run dev\n' +
        'Or: docker-compose up api-server'
      );
    }
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // If response isn't JSON, use status text
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      // Network error or fetch failed
      if (error instanceof TypeError || (error instanceof Error && error.message.includes('Failed to fetch'))) {
        this.markApiUnavailable();
        const networkError = new Error(`Cannot connect to API server at ${this.baseUrl}. Is the server running?`);
        console.error('[API] Network error:', networkError.message);
        throw networkError;
      }
      
      console.error('[API] Request failed:', {
        url,
        method: options?.method || 'GET',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Mesh operations
  async getMesh(project: string): Promise<{ nodes: NodeMetadata[]; edges: EdgeMetadata[] }> {
    return this.request(`/api/mesh?project=${project}`);
  }

  // Node operations
  async createNode(project: string, node: Omit<NodeMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<NodeMetadata> {
    return this.request('/api/nodes', {
      method: 'POST',
      body: JSON.stringify({ project, ...node }),
    });
  }

  async updateNode(nodeId: string, updates: Partial<NodeMetadata>): Promise<NodeMetadata> {
    return this.request(`/api/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteNode(nodeId: string): Promise<void> {
    return this.request(`/api/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  }

  async runNode(nodeId: string): Promise<{ jobId: string }> {
    return this.request(`/api/nodes/${nodeId}/run`, {
      method: 'POST',
    });
  }

  async stopNode(nodeId: string): Promise<void> {
    return this.request(`/api/nodes/${nodeId}/stop`, {
      method: 'POST',
    });
  }

  // Edge operations
  async createEdge(edge: Omit<EdgeMetadata, 'id' | 'createdAt'>): Promise<EdgeMetadata> {
    return this.request('/api/edges', {
      method: 'POST',
      body: JSON.stringify(edge),
    });
  }

  async deleteEdge(edgeId: string): Promise<void> {
    return this.request(`/api/edges/${edgeId}`, {
      method: 'DELETE',
    });
  }

  // Logs
  async getNodeLogs(nodeId: string, limit = 100): Promise<LogEntry[]> {
    return this.request(`/api/nodes/${nodeId}/logs?limit=${limit}`);
  }
}

export const apiClient = new APIClient(API_BASE_URL);

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Fetch mesh data (nodes + edges) for a project
 */
export function useMesh(project: string) {
  return useQuery({
    queryKey: ['mesh', project],
    queryFn: () => apiClient.getMesh(project),
    staleTime: 30000, // 30 seconds
    enabled: !!project,
  });
}

/**
 * Create a new node with optimistic update
 */
export function useCreateNode(project: string) {
  const queryClient = useQueryClient();
  const addNode = useRealtimeStore((state) => state.addNode);

  return useMutation({
    mutationFn: (node: Omit<NodeMetadata, 'id' | 'createdAt' | 'updatedAt'>) =>
      apiClient.createNode(project, node),
    
    onMutate: async (newNode) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['mesh', project] });

      // Optimistically add to store
      const optimisticNode: NodeMetadata = {
        ...newNode,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addNode(optimisticNode);

      return { optimisticNode };
    },

    onSuccess: (createdNode, _, context) => {
      // Replace optimistic node with real node
      const deleteNode = useRealtimeStore.getState().deleteNode;
      
      if (context?.optimisticNode) {
        deleteNode(context.optimisticNode.id);
        addNode(createdNode);
      }

      queryClient.invalidateQueries({ queryKey: ['mesh', project] });
    },

    onError: (error, _, context) => {
      // Rollback on error
      if (context?.optimisticNode) {
        const deleteNode = useRealtimeStore.getState().deleteNode;
        deleteNode(context.optimisticNode.id);
      }
      
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('Cannot connect')) {
        toast.error('Cannot connect to server. Node will sync when server is available.');
      } else {
        toast.error(`Failed to create node: ${errorMsg}`);
      }
      console.error('[API] Failed to create node:', error);
    },
  });
}

/**
 * Update an existing node
 */
export function useUpdateNode() {
  const updateNodeInStore = useRealtimeStore((state) => state.updateNode);

  return useMutation({
    mutationFn: ({ nodeId, updates }: { nodeId: string; updates: Partial<NodeMetadata> }) =>
      apiClient.updateNode(nodeId, updates),

    onMutate: async ({ nodeId, updates }) => {
      // Optimistically update in store
      updateNodeInStore(nodeId, updates);
      return { nodeId, updates };
    },

    onError: (error) => {
      const errorMsg = (error as Error).message;
      if (!errorMsg.includes('Cannot connect')) {
        toast.error(`Failed to update node: ${errorMsg}`);
      }
      console.error('[API] Failed to update node:', error);
    },
  });
}

/**
 * Delete a node
 */
export function useDeleteNode(project: string) {
  const queryClient = useQueryClient();
  const deleteNodeInStore = useRealtimeStore((state) => state.deleteNode);

  return useMutation({
    mutationFn: (nodeId: string) => apiClient.deleteNode(nodeId),

    onMutate: async (nodeId) => {
      await queryClient.cancelQueries({ queryKey: ['mesh', project] });
      deleteNodeInStore(nodeId);
      return { nodeId };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', project] });
    },

    onError: (error) => {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('Cannot connect')) {
        toast.warning('Server offline. Changes saved locally.');
      } else {
        toast.error(`Failed to delete node: ${errorMsg}`);
      }
      console.error('[API] Failed to delete node:', error);
    },
  });
}

/**
 * Run a node (trigger processing)
 */
export function useRunNode() {
  const updateNodeStatus = useRealtimeStore((state) => state.updateNodeStatus);

  return useMutation({
    mutationFn: (nodeId: string) => apiClient.runNode(nodeId),

    onMutate: (nodeId) => {
      // Optimistically set to queued
      updateNodeStatus(nodeId, 'queued');
    },

    onSuccess: (data, nodeId) => {
      console.log(`[API] Node ${nodeId} started, job: ${data.jobId}`);
    },

    onError: (error, nodeId) => {
      // Revert to idle on error
      updateNodeStatus(nodeId, 'idle', (error as Error).message);
      const errorMsg = (error as Error).message;
      if (!errorMsg.includes('Cannot connect')) {
        toast.error(`Failed to run node: ${errorMsg}`);
      }
      console.error('[API] Failed to run node:', error);
    },
  });
}

/**
 * Stop a running node
 */
export function useStopNode() {
  const updateNodeStatus = useRealtimeStore((state) => state.updateNodeStatus);

  return useMutation({
    mutationFn: (nodeId: string) => apiClient.stopNode(nodeId),

    onSuccess: (_, nodeId) => {
      updateNodeStatus(nodeId, 'idle', 'Stopped by user');
    },

    onError: (error) => {
      const errorMsg = (error as Error).message;
      if (!errorMsg.includes('Cannot connect')) {
        toast.error(`Failed to stop node: ${errorMsg}`);
      }
      console.error('[API] Failed to stop node:', error);
    },
  });
}

/**
 * Create an edge with optimistic update
 */
export function useCreateEdge(project: string) {
  const queryClient = useQueryClient();
  const addEdge = useRealtimeStore((state) => state.addEdge);

  return useMutation({
    mutationFn: (edge: Omit<EdgeMetadata, 'id'>) =>
      apiClient.createEdge(edge),

    onMutate: async (newEdge) => {
      await queryClient.cancelQueries({ queryKey: ['mesh', project] });

      // Optimistically add to store
      const optimisticEdge: EdgeMetadata = {
        ...newEdge,
        id: `edge-temp-${Date.now()}`,
      };
      addEdge(optimisticEdge);

      return { optimisticEdge };
    },

    onSuccess: (createdEdge, _, context) => {
      // Replace optimistic edge with real edge
      const deleteEdge = useRealtimeStore.getState().deleteEdge;
      
      if (context?.optimisticEdge) {
        deleteEdge(context.optimisticEdge.id);
        addEdge(createdEdge);
      }

      queryClient.invalidateQueries({ queryKey: ['mesh', project] });
    },

    onError: (error, _, context) => {
      // Rollback on error
      if (context?.optimisticEdge) {
        const deleteEdge = useRealtimeStore.getState().deleteEdge;
        deleteEdge(context.optimisticEdge.id);
      }
      const errorMsg = (error as Error).message;
      if (!errorMsg.includes('Cannot connect')) {
        toast.error(`Failed to create edge: ${errorMsg}`);
      }
      console.error('[API] Failed to create edge:', error);
    },
  });
}

/**
 * Delete an edge
 */
export function useDeleteEdge(project: string) {
  const queryClient = useQueryClient();
  const deleteEdgeInStore = useRealtimeStore((state) => state.deleteEdge);

  return useMutation({
    mutationFn: (edgeId: string) => apiClient.deleteEdge(edgeId),

    onMutate: async (edgeId) => {
      await queryClient.cancelQueries({ queryKey: ['mesh', project] });
      deleteEdgeInStore(edgeId);
      return { edgeId };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', project] });
    },

    onError: (error) => {
      const errorMsg = (error as Error).message;
      if (!errorMsg.includes('Cannot connect')) {
        toast.error(`Failed to delete edge: ${errorMsg}`);
      }
      console.error('[API] Failed to delete edge:', error);
    },
  });
}

/**
 * Fetch logs for a specific node
 */
export function useNodeLogs(nodeId: string | null, limit = 100) {
  return useQuery({
    queryKey: ['logs', nodeId, limit],
    queryFn: () => apiClient.getNodeLogs(nodeId!, limit),
    enabled: !!nodeId,
    refetchInterval: 2000, // Refresh every 2 seconds when active
  });
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Helper to create a new node with sensible defaults
 */
export function createNodePayload(
  type: NodeType,
  label: string,
  position: { x: number; y: number },
  data?: Record<string, unknown>
): Omit<NodeMetadata, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type,
    label,
    status: 'idle',
    position,
    data: data || {},
  };
}
