/**
 * API endpoints for multi-dataset querying
 */

import express from 'express';
import { Pool } from 'pg';
import { Context } from '../../../../dist/context';
import { 
  queryMultipleDatasets, 
  queryDatasetsByPattern,
  getMultiDatasetStats 
} from '../../../../dist/api/query-multi-dataset';

export function createMultiQueryRouter(pool: Pool, context: Context) {
  const router = express.Router();

  /**
   * Query multiple specific datasets
   * POST /api/query/multi
   */
  router.post('/multi', async (req, res) => {
    try {
      const {
        datasets,
        query,
        topK = 10,
        threshold = 0.4,
        includeMetadata = true,
        rerank = false,
        hybridSearch = false
      } = req.body;

      if (!datasets || !Array.isArray(datasets)) {
        return res.status(400).json({ 
          error: 'datasets array is required' 
        });
      }

      if (!query) {
        return res.status(400).json({ 
          error: 'query is required' 
        });
      }

      // Validate dataset specifications
      for (const spec of datasets) {
        if (!spec.project || !spec.dataset) {
          return res.status(400).json({
            error: 'Each dataset must have project and dataset properties'
          });
        }
      }

      const result = await queryMultipleDatasets(
        context,
        {
          datasets,
          query,
          topK,
          threshold,
          includeMetadata,
          rerank,
          hybridSearch
        },
        (phase: any, progress: any, message: any) => {
          // Could emit WebSocket events here for real-time progress
          console.log(`[Multi-Query] ${phase}: ${progress}% - ${message}`);
        }
      );

      res.json(result);
    } catch (error) {
      console.error('[Multi-Query] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  /**
   * Query datasets by pattern
   * POST /api/query/pattern
   */
  router.post('/pattern', async (req, res) => {
    try {
      const {
        datasetPattern,
        projectPattern,
        query,
        topK = 10,
        threshold = 0.4
      } = req.body;

      if (!query) {
        return res.status(400).json({ 
          error: 'query is required' 
        });
      }

      if (!datasetPattern && !projectPattern) {
        return res.status(400).json({
          error: 'At least one of datasetPattern or projectPattern is required'
        });
      }

      const result = await queryDatasetsByPattern(
        context,
        {
          datasetPattern,
          projectPattern,
          query,
          topK,
          threshold
        },
        (phase: any, progress: any, message: any) => {
          console.log(`[Pattern-Query] ${phase}: ${progress}% - ${message}`);
        }
      );

      res.json(result);
    } catch (error) {
      console.error('[Pattern-Query] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  /**
   * Get statistics for multiple datasets
   * POST /api/query/stats
   */
  router.post('/stats', async (req, res) => {
    try {
      const { datasets } = req.body;

      if (!datasets || !Array.isArray(datasets)) {
        return res.status(400).json({ 
          error: 'datasets array is required' 
        });
      }

      // Resolve dataset IDs
      const datasetIds: string[] = [];
      
      for (const spec of datasets) {
        let query: string;
        let params: any[];
        
        if (spec.project === 'global') {
          query = 'SELECT id FROM claude_context.datasets WHERE project_id IS NULL AND name = $1';
          params = [spec.dataset];
        } else {
          query = `
            SELECT d.id 
            FROM claude_context.datasets d 
            JOIN claude_context.projects p ON d.project_id = p.id 
            WHERE p.name = $1 AND d.name = $2
          `;
          params = [spec.project, spec.dataset];
        }
        
        const result = await pool.query(query, params);
        if (result.rows.length > 0) {
          datasetIds.push(result.rows[0].id);
        }
      }

      if (datasetIds.length === 0) {
        return res.json({ 
          stats: [],
          message: 'No matching datasets found'
        });
      }

      const stats = await getMultiDatasetStats(pool, datasetIds);
      
      res.json({
        stats,
        totalChunks: stats.reduce((sum: number, s: any) => sum + s.chunkCount, 0),
        totalPages: stats.reduce((sum: number, s: any) => sum + s.pageCount, 0),
        datasetsFound: stats.length
      });
    } catch (error) {
      console.error('[Dataset-Stats] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  /**
   * List all available datasets across projects
   * GET /api/query/datasets
   */
  router.get('/datasets', async (req, res) => {
    try {
      const { includeEmpty = false } = req.query;
      
      let query = `
        SELECT 
          d.id as dataset_id,
          d.name as dataset_name,
          d.type as dataset_type,
          COALESCE(p.name, 'global') as project_name,
          COUNT(DISTINCT wc.id) as chunk_count,
          COUNT(DISTINCT wp.id) as page_count,
          MAX(GREATEST(wc.created_at, wp.created_at)) as last_indexed
        FROM claude_context.datasets d
        LEFT JOIN claude_context.projects p ON d.project_id = p.id
        LEFT JOIN claude_context.web_chunks wc ON wc.dataset_id = d.id
        LEFT JOIN claude_context.web_pages wp ON wp.dataset_id = d.id
        GROUP BY d.id, d.name, d.type, p.name
      `;

      if (!includeEmpty) {
        query += ' HAVING COUNT(DISTINCT wc.id) > 0 OR COUNT(DISTINCT wp.id) > 0';
      }

      query += ' ORDER BY p.name, d.name';

      const result = await pool.query(query);

      const datasets = result.rows.map(row => ({
        project: row.project_name,
        dataset: row.dataset_name,
        datasetId: row.dataset_id,
        type: row.dataset_type,
        chunkCount: parseInt(row.chunk_count, 10),
        pageCount: parseInt(row.page_count, 10),
        lastIndexed: row.last_indexed ? new Date(row.last_indexed).toISOString() : null
      }));

      res.json({
        datasets,
        total: datasets.length,
        projects: [...new Set(datasets.map(d => d.project))].sort()
      });
    } catch (error) {
      console.error('[List-Datasets] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  /**
   * Search datasets by content sample
   * POST /api/query/datasets/search
   */
  router.post('/datasets/search', async (req, res) => {
    try {
      const { 
        contentSample, 
        minSimilarity = 0.7,
        limit = 5 
      } = req.body;

      if (!contentSample) {
        return res.status(400).json({ 
          error: 'contentSample is required' 
        });
      }

      // This would need vector search implementation
      // For now, return a placeholder response
      res.json({
        message: 'Dataset content search not yet implemented',
        suggestion: 'Use /api/query/multi with specific dataset selections'
      });

    } catch (error) {
      console.error('[Dataset-Search] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });

  return router;
}

// Export for use in server.ts
export default createMultiQueryRouter;
