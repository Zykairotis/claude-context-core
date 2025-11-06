import { Router } from 'express';
import { Pool } from 'pg';

interface NodeMetadata {
  id: string;
  type: string;
  label: string;
  status: 'idle' | 'queued' | 'running' | 'ok' | 'failed' | 'warning';
  position: { x: number; y: number };
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface EdgeMetadata {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export function createMeshRouter(pool: Pool) {
  const router = Router();

  // Get all nodes and edges for a project
  router.get('/:project', async (req, res) => {
    try {
      const { project } = req.params;

      const nodesResult = await pool.query(
        'SELECT * FROM claude_context.mesh_nodes WHERE project = $1 ORDER BY created_at',
        [project]
      );

      const edgesResult = await pool.query(
        'SELECT * FROM claude_context.mesh_edges WHERE project = $1 ORDER BY created_at',
        [project]
      );

      res.json({
        nodes: nodesResult.rows.map(row => ({
          id: row.id,
          type: row.type,
          label: row.label,
          status: row.status,
          position: row.position,
          data: row.data,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        edges: edgesResult.rows.map(row => ({
          id: row.id,
          source: row.source,
          target: row.target,
          type: row.edge_type,
          animated: row.animated,
          label: row.label,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    } catch (error: any) {
      console.error('[Mesh API] Failed to get mesh:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create node
  router.post('/nodes', async (req, res) => {
    try {
      const { project, type, label, position, data } = req.body;

      const result = await pool.query(
        `INSERT INTO claude_context.mesh_nodes (project, type, label, status, position, data, created_at, updated_at)
         VALUES ($1, $2, $3, 'idle', $4, $5, NOW(), NOW())
         RETURNING *`,
        [project, type, label, JSON.stringify(position), JSON.stringify(data || {})]
      );

      const node = result.rows[0];
      res.json({
        id: node.id,
        type: node.type,
        label: node.label,
        status: node.status,
        position: node.position,
        data: node.data,
        createdAt: node.created_at,
        updatedAt: node.updated_at
      });
    } catch (error: any) {
      console.error('[Mesh API] Failed to create node:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update node
  router.patch('/nodes/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const updates = req.body;

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.position) {
        setClauses.push(`position = $${paramCount}`);
        values.push(JSON.stringify(updates.position));
        paramCount++;
      }

      if (updates.label) {
        setClauses.push(`label = $${paramCount}`);
        values.push(updates.label);
        paramCount++;
      }

      if (updates.data) {
        setClauses.push(`data = $${paramCount}`);
        values.push(JSON.stringify(updates.data));
        paramCount++;
      }

      if (updates.status) {
        setClauses.push(`status = $${paramCount}`);
        values.push(updates.status);
        paramCount++;
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }

      setClauses.push('updated_at = NOW()');
      values.push(nodeId);

      const result = await pool.query(
        `UPDATE claude_context.mesh_nodes SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const node = result.rows[0];
      res.json({
        id: node.id,
        type: node.type,
        label: node.label,
        status: node.status,
        position: node.position,
        data: node.data,
        createdAt: node.created_at,
        updatedAt: node.updated_at
      });
    } catch (error: any) {
      console.error('[Mesh API] Failed to update node:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete node
  router.delete('/nodes/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;

      // Delete associated edges first
      await pool.query(
        'DELETE FROM claude_context.mesh_edges WHERE source = $1 OR target = $1',
        [nodeId]
      );

      // Delete node
      const result = await pool.query(
        'DELETE FROM claude_context.mesh_nodes WHERE id = $1 RETURNING id',
        [nodeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Node not found' });
      }

      res.json({ success: true, id: nodeId });
    } catch (error: any) {
      console.error('[Mesh API] Failed to delete node:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create edge
  router.post('/edges', async (req, res) => {
    try {
      const { project, source, target, type, animated, label } = req.body;

      const result = await pool.query(
        `INSERT INTO claude_context.mesh_edges (project, source, target, edge_type, animated, label, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [project, source, target, type || 'default', animated || false, label || null]
      );

      const edge = result.rows[0];
      res.json({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.edge_type,
        animated: edge.animated,
        label: edge.label,
        createdAt: edge.created_at,
        updatedAt: edge.updated_at
      });
    } catch (error: any) {
      console.error('[Mesh API] Failed to create edge:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete edge
  router.delete('/edges/:edgeId', async (req, res) => {
    try {
      const { edgeId } = req.params;

      const result = await pool.query(
        'DELETE FROM claude_context.mesh_edges WHERE id = $1 RETURNING id',
        [edgeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Edge not found' });
      }

      res.json({ success: true, id: edgeId });
    } catch (error: any) {
      console.error('[Mesh API] Failed to delete edge:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Run node
  router.post('/nodes/:nodeId/run', async (req, res) => {
    try {
      const { nodeId } = req.params;

      // Update status to running
      await pool.query(
        "UPDATE claude_context.mesh_nodes SET status = 'running', updated_at = NOW() WHERE id = $1",
        [nodeId]
      );

      // TODO: Trigger actual node execution based on type
      console.log(`[Mesh API] Running node ${nodeId}`);

      res.json({ success: true, nodeId, status: 'running' });
    } catch (error: any) {
      console.error('[Mesh API] Failed to run node:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop node
  router.post('/nodes/:nodeId/stop', async (req, res) => {
    try {
      const { nodeId } = req.params;

      // Update status to idle
      await pool.query(
        "UPDATE claude_context.mesh_nodes SET status = 'idle', updated_at = NOW() WHERE id = $1",
        [nodeId]
      );

      // TODO: Stop actual node execution
      console.log(`[Mesh API] Stopping node ${nodeId}`);

      res.json({ success: true, nodeId, status: 'idle' });
    } catch (error: any) {
      console.error('[Mesh API] Failed to stop node:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get node logs
  router.get('/nodes/:nodeId/logs', async (req, res) => {
    try {
      const { nodeId } = req.params;

      const result = await pool.query(
        'SELECT * FROM claude_context.mesh_logs WHERE node_id = $1 ORDER BY created_at DESC LIMIT 100',
        [nodeId]
      );

      res.json({
        logs: result.rows.map(row => ({
          id: row.id,
          nodeId: row.node_id,
          level: row.level,
          message: row.message,
          timestamp: row.created_at
        }))
      });
    } catch (error: any) {
      console.error('[Mesh API] Failed to get logs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
