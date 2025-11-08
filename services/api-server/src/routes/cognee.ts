import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

const COGNEE_API_URL = process.env.COGNEE_API_URL || 'http://localhost:8340';
const COGNEE_API_KEY = process.env.COGNEE_API_KEY || 'local-development-only';

/**
 * Cognee API Proxy Router
 * 
 * Provides unified access to Cognee endpoints through Claude-Context API server.
 * All requests are proxied to the Cognee service with proper authentication.
 */
export function createCogneeRouter(): Router {
  const router = Router();

  // Helper function to proxy requests to Cognee
  async function proxyCogneeRequest(
    req: Request,
    res: Response,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ) {
    try {
      const config = {
        method,
        url: `${COGNEE_API_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${COGNEE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        data,
        timeout: 120000, // 2 minutes
      };

      const response = await axios(config);
      return res.status(response.status).json(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status || 500;
        const message = axiosError.response?.data || { error: axiosError.message };
        return res.status(status).json(message);
      }
      return res.status(500).json({ error: String(error) });
    }
  }

  // ==========================================
  // HEALTH & STATUS
  // ==========================================

  /**
   * GET /cognee/health
   * Check Cognee service health
   */
  router.get('/health', async (req, res) => {
    try {
      const response = await axios.get(`${COGNEE_API_URL}/health`, { timeout: 5000 });
      res.json({
        status: 'healthy',
        cognee: response.data,
        apiUrl: COGNEE_API_URL
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: String(error),
        apiUrl: COGNEE_API_URL
      });
    }
  });

  /**
   * GET /cognee/health/detailed
   * Get detailed health status
   */
  router.get('/health/detailed', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', '/health/detailed');
  });

  // ==========================================
  // DATASETS
  // ==========================================

  /**
   * GET /cognee/datasets
   * List all datasets
   */
  router.get('/datasets', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', '/api/v1/datasets');
  });

  /**
   * POST /cognee/datasets
   * Create a new dataset
   * Body: { name: string, description?: string }
   */
  router.post('/datasets', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/datasets', req.body);
  });

  /**
   * GET /cognee/datasets/:id
   * Get dataset details
   */
  router.get('/datasets/:id', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', `/api/v1/datasets/${req.params.id}`);
  });

  /**
   * DELETE /cognee/datasets/:id
   * Delete a dataset
   */
  router.delete('/datasets/:id', async (req, res) => {
    await proxyCogneeRequest(req, res, 'DELETE', `/api/v1/datasets/${req.params.id}`);
  });

  /**
   * GET /cognee/datasets/:id/graph
   * Get dataset knowledge graph
   */
  router.get('/datasets/:id/graph', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', `/api/v1/datasets/${req.params.id}/graph`);
  });

  // ==========================================
  // ADD (Data Ingestion)
  // ==========================================

  /**
   * POST /cognee/add
   * Add data to a dataset
   * 
   * Body (multipart/form-data):
   * - files: File[]
   * - datasetName?: string
   * - datasetId?: string
   * - nodeSet?: string[]
   * 
   * OR Body (JSON for URLs):
   * - data: string[] (URLs or text)
   * - datasetName?: string
   * - datasetId?: string
   */
  router.post('/add', async (req, res) => {
    // For file uploads, you'd need multer middleware
    // For now, we'll handle JSON data (URLs, text)
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/add', req.body);
  });

  // ==========================================
  // COGNIFY (Knowledge Graph Construction)
  // ==========================================

  /**
   * POST /cognee/cognify
   * Process datasets into knowledge graph
   * 
   * Body: {
   *   datasetIds: string[],
   *   runInBackground?: boolean,
   *   customPrompt?: string
   * }
   */
  router.post('/cognify', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/cognify', req.body);
  });

  // ==========================================
  // SEARCH (15 Search Types!)
  // ==========================================

  /**
   * POST /cognee/search
   * Search the knowledge graph
   * 
   * Body: {
   *   searchType: "CHUNKS" | "SUMMARIES" | "RAG_COMPLETION" | 
   *               "GRAPH_COMPLETION" | "GRAPH_SUMMARY_COMPLETION" |
   *               "GRAPH_COMPLETION_COT" | "GRAPH_COMPLETION_CONTEXT_EXTENSION" |
   *               "CODE" | "CYPHER" | "NATURAL_LANGUAGE" | "FEELING_LUCKY" |
   *               "CHUNKS_LEXICAL" | "TEMPORAL" | "CODING_RULES" | "FEEDBACK",
   *   query: string,
   *   datasetIds?: string[],
   *   datasets?: string[],
   *   systemPrompt?: string,
   *   nodeName?: string[],
   *   topK?: number,
   *   onlyContext?: boolean,
   *   useCombinedContext?: boolean
   * }
   */
  router.post('/search', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/search', req.body);
  });

  /**
   * GET /cognee/search
   * Get search history
   */
  router.get('/search', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', '/api/v1/search');
  });

  // ==========================================
  // DELETE
  // ==========================================

  /**
   * POST /cognee/delete
   * Delete data from datasets
   * 
   * Body: {
   *   datasetIds?: string[],
   *   datasets?: string[]
   * }
   */
  router.post('/delete', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/delete', req.body);
  });

  // ==========================================
  // UPDATE
  // ==========================================

  /**
   * POST /cognee/update
   * Update existing data
   * 
   * Body: {
   *   data: any[],
   *   datasetName?: string,
   *   datasetId?: string
   * }
   */
  router.post('/update', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/update', req.body);
  });

  // ==========================================
  // SETTINGS
  // ==========================================

  /**
   * GET /cognee/settings
   * Get Cognee settings
   */
  router.get('/settings', async (req, res) => {
    await proxyCogneeRequest(req, res, 'GET', '/api/v1/settings');
  });

  /**
   * PUT /cognee/settings
   * Update Cognee settings
   */
  router.put('/settings', async (req, res) => {
    await proxyCogneeRequest(req, res, 'PUT', '/api/v1/settings', req.body);
  });

  // ==========================================
  // SYNC
  // ==========================================

  /**
   * POST /cognee/sync
   * Sync data from external sources
   * 
   * Body: {
   *   datasetName?: string,
   *   datasetId?: string
   * }
   */
  router.post('/sync', async (req, res) => {
    await proxyCogneeRequest(req, res, 'POST', '/api/v1/sync', req.body);
  });

  // ==========================================
  // CONVENIENCE ENDPOINTS
  // ==========================================

  /**
   * POST /cognee/quick-search
   * Simplified search endpoint with smart defaults
   * 
   * Body: {
   *   query: string,
   *   datasetId?: string,
   *   type?: "code" | "architecture" | "explanation" | "question"
   * }
   */
  router.post('/quick-search', async (req, res) => {
    const { query, datasetId, type = 'question' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Smart search type selection
    const searchTypeMap = {
      code: 'CODE',
      architecture: 'GRAPH_COMPLETION',
      explanation: 'RAG_COMPLETION',
      question: 'NATURAL_LANGUAGE',
    };

    const searchPayload = {
      searchType: searchTypeMap[type as keyof typeof searchTypeMap] || 'NATURAL_LANGUAGE',
      query,
      datasetIds: datasetId ? [datasetId] : undefined,
      topK: 5,
      systemPrompt: 'You are a helpful coding assistant. Provide clear, concise answers.',
    };

    await proxyCogneeRequest(req, res, 'POST', '/api/v1/search', searchPayload);
  });

  /**
   * POST /cognee/explain-code
   * Get an explanation of code from the knowledge graph
   * 
   * Body: {
   *   query: string (e.g., "Explain the MemoryPool class"),
   *   datasetId?: string
   * }
   */
  router.post('/explain-code', async (req, res) => {
    const { query, datasetId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchPayload = {
      searchType: 'GRAPH_COMPLETION_COT',
      query,
      datasetIds: datasetId ? [datasetId] : undefined,
      topK: 10,
      systemPrompt: 'Explain the code architecture step-by-step with clear reasoning.',
    };

    await proxyCogneeRequest(req, res, 'POST', '/api/v1/search', searchPayload);
  });

  /**
   * POST /cognee/find-relationships
   * Find relationships between code components
   * 
   * Body: {
   *   component: string (e.g., "MemoryPool"),
   *   datasetId?: string
   * }
   */
  router.post('/find-relationships', async (req, res) => {
    const { component, datasetId } = req.body;

    if (!component) {
      return res.status(400).json({ error: 'Component name is required' });
    }

    const searchPayload = {
      searchType: 'GRAPH_COMPLETION',
      query: `What components are related to ${component}? Show all dependencies and relationships.`,
      datasetIds: datasetId ? [datasetId] : undefined,
      topK: 15,
      systemPrompt: 'List all relationships and explain how components interact.',
    };

    await proxyCogneeRequest(req, res, 'POST', '/api/v1/search', searchPayload);
  });

  return router;
}
