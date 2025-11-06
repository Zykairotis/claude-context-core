/**
 * MeshCanvas - React Flow canvas with drag-and-drop support
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Typography, Stack, Paper, alpha } from '@mui/material';
import { useRealtimeStore } from '@store';
import { ContextMenu } from './ContextMenu';
import { KnowledgeNode } from './nodes/KnowledgeNode';
import { DataEdge } from './edges/DataEdge';
import { useCreateNode, useCreateEdge, useUpdateNode, createNodePayload } from '@lib/api';
import type { NodeType } from '@types';

// Register custom node and edge types
const nodeTypes = {
  knowledge: KnowledgeNode,
};

const edgeTypes = {
  data: DataEdge,
  trigger: DataEdge,
  control: DataEdge,
};

export function MeshCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: { top: number; left: number };
    type: 'node' | 'canvas' | 'edge';
    nodeId?: string;
    canvasPosition?: { x: number; y: number };
  }>({ open: false, position: { top: 0, left: 0 }, type: 'canvas' });
  
  const nodes = useRealtimeStore((state: any) => state.nodes);
  const edges = useRealtimeStore((state: any) => state.edges);
  const deleteNode = useRealtimeStore((state: any) => state.deleteNode);
  const setSelectedNodeId = useRealtimeStore((state: any) => state.setSelectedNodeId);

  // API hooks
  const projectName = 'default'; // TODO: Get from context
  const createNodeMutation = useCreateNode(projectName);
  const createEdgeMutation = useCreateEdge(projectName);
  const updateNodeMutation = useUpdateNode();

  // Convert our nodes to React Flow format
  const flowNodes: Node[] = nodes.map((node: any) => ({
    id: node.id,
    type: 'knowledge',
    position: node.position,
    data: node, // Pass entire node as data for KnowledgeNode component
  }));

  const flowEdges: Edge[] = edges.map((edge: any) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'data',
    animated: edge.animated,
    data: { type: edge.type, label: edge.label, animated: edge.animated },
  }));

  // Debounce position updates
  const positionUpdateTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!updateNodeMutation) return;
      
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          // Clear existing timeout for this node
          const existingTimeout = positionUpdateTimeouts.current.get(change.id);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }

          // Debounce position update (300ms)
          const timeout = setTimeout(() => {
            updateNodeMutation.mutate({
              nodeId: change.id,
              updates: { position: change.position! },
            });
            positionUpdateTimeouts.current.delete(change.id);
          }, 300);

          positionUpdateTimeouts.current.set(change.id, timeout);
        }
      });
    },
    [updateNodeMutation]
  );

  const onEdgesChange: OnEdgesChange = useCallback(() => {
    // Handle edge changes
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!createEdgeMutation) return;
      
      createEdgeMutation.mutate({
        source: connection.source!,
        target: connection.target!,
        type: 'data',
      });
    },
    [createEdgeMutation]
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  // Handle drop from palette
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!canvasRef.current || !createNodeMutation) return;

      const payload = e.dataTransfer.getData('application/reactflow');
      if (!payload) return;

      try {
        const { type, label } = JSON.parse(payload);
        if (e.target === e.currentTarget) {
          // Convert screen coordinates to canvas coordinates
          const position = screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
          });

          // Create node using API
          const nodePayload = createNodePayload(type as NodeType, label, position);
          createNodeMutation.mutate(nodePayload);
        }
      } catch (err) {
        console.error('Failed to parse drop data:', err);
      }
    },
    [screenToFlowPosition, createNodeMutation]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Context menu handlers
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({
      open: true,
      position: { top: e.clientY, left: e.clientX },
      type: 'node',
      nodeId: node.id,
    });
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    // Store the canvas position for node creation
    const canvasPos = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });
      
    setContextMenu({
      open: true,
      position: { top: e.clientY, left: e.clientX },
      type: 'canvas',
      canvasPosition: canvasPos,
    });
  }, [screenToFlowPosition]);

  const handleContextMenuAction = useCallback((action: string) => {
    // Handle node creation
    if (action.startsWith('add:') && contextMenu.canvasPosition) {
      if (!createNodeMutation) return;
      
      const nodeType = action.replace('add:', '') as NodeType;
      const labels: Record<string, string> = {
        github: 'GitHub Repo',
        crawler: 'Web Crawler',
        vectordb: 'Vector DB',
        reranker: 'Reranker',
        llm: 'LLM',
        dashboard: 'Dashboard',
      };
      
      const nodePayload = createNodePayload(
        nodeType,
        labels[nodeType] || nodeType,
        contextMenu.canvasPosition
      );
      
      createNodeMutation.mutate(nodePayload);
      return;
    }
    
    switch (action) {
      case 'delete':
        if (contextMenu.nodeId) {
          deleteNode(contextMenu.nodeId);
        }
        break;
      case 'copy':
        // TODO: Implement copy functionality
        console.log('Copy node:', contextMenu.nodeId);
        break;
      case 'duplicate':
        // TODO: Implement duplicate functionality
        console.log('Duplicate node:', contextMenu.nodeId);
        break;
      case 'fitView':
        fitView({ padding: 0.2, duration: 400 });
        break;
      case 'selectAll':
        // TODO: Implement select all
        console.log('Select all nodes');
        break;
      default:
        console.log('Action not implemented:', action);
    }
  }, [contextMenu.nodeId, contextMenu.canvasPosition, fitView, deleteNode, createNodeMutation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected nodes
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
        const selectedNodes = nodes.filter((n: any) => n.selected);
        selectedNodes.forEach((node: any) => deleteNode(node.id));
      }
      
      // Copy (TODO: Implement)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        console.log('Copy selected nodes');
      }
      
      // Paste (TODO: Implement)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        console.log('Paste nodes');
      }
      
      // Select all (TODO: Implement)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        console.log('Select all nodes');
      }
      
      // Fit view
      if (e.key === 'f' || e.key === 'F') {
        fitView({ padding: 0.2, duration: 400 });
      }
      
      // Zoom
      if (e.key === '+' || e.key === '=') {
        zoomIn();
      }
      if (e.key === '-' || e.key === '_') {
        zoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView, zoomIn, zoomOut, nodes, deleteNode]);

  return (
    <Box ref={canvasRef} sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
      <ReactFlow
        ref={canvasRef}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'data',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Empty State */}
        {flowNodes.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <Paper
              sx={{
                p: 4,
                backgroundColor: alpha('#000', 0.85),
                backdropFilter: 'blur(20px)',
                borderRadius: 2,
                border: `1px solid ${alpha('#fff', 0.1)}`,
                textAlign: 'center',
                maxWidth: 400,
              }}
            >
              <Typography variant="h5" sx={{ mb: 2, color: '#fff', fontWeight: 600 }}>
                Welcome to Claude Context
              </Typography>
              <Stack spacing={1.5} sx={{ color: alpha('#fff', 0.7) }}>
                <Typography variant="body2">
                  🎯 <strong>Right-click</strong> on canvas to add nodes
                </Typography>
                <Typography variant="body2">
                  🔗 <strong>Drag</strong> between nodes to connect them
                </Typography>
                <Typography variant="body2">
                  ⌨️ <strong>Delete/Backspace</strong> to remove selected nodes
                </Typography>
                <Typography variant="body2">
                  🖱️ <strong>Mouse wheel</strong> to zoom in/out
                </Typography>
              </Stack>
            </Paper>
          </Box>
        )}
        <Background color="#cd853f" gap={20} size={1} style={{ opacity: 0.05 }} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const status = node.data?.status as string || 'idle';
            const colors: Record<string, string> = {
              idle: '#8b7355',
              running: '#daa520',
              ok: '#cd853f',
              failed: '#d2691e'
            };
            return colors[status] || '#cd853f';
          }}
          style={{ 
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(205, 133, 63, 0.4)',
            borderRadius: '8px',
          }}
          maskColor="rgba(205, 133, 63, 0.1)"
        />
      </ReactFlow>

      {/* Context Menu */}
      <ContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        type={contextMenu.type}
        onClose={() => setContextMenu({ ...contextMenu, open: false })}
        onAction={handleContextMenuAction}
      />
    </Box>
  );
}
