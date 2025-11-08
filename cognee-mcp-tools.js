// =============================
// Cognee: MCP tools (5 tools)
// Env: COGNEE_URL (default https://api.cognee.ai), COGNEE_TOKEN (Bearer)
// =============================
const fs = require('fs');
const pathMod = require('path');

function getCogneeBase() {
  return (process.env.COGNEE_URL || 'https://api.cognee.ai').replace(/\/+$/,'');
}

function authHeaders(h = {}) {
  const t = process.env.COGNEE_TOKEN;
  return t ? { ...h, Authorization: `Bearer ${t}` } : h;
}

async function fetchJson(method, pathname, body) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${getCogneeBase()}${pathname}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${res.statusText}: ${text}`);
  return json ?? {};
}

async function fetchForm(pathname, form) {
  const fetch = (await import('node-fetch')).default;
  const hdrs = (typeof form.getHeaders === 'function') ? form.getHeaders() : {};
  const res = await fetch(`${getCogneeBase()}${pathname}`, {
    method: 'POST',
    headers: authHeaders(hdrs),
    body: form
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`POST ${pathname} -> ${res.status} ${res.statusText}: ${text}`);
  return json ?? {};
}

// Export function to register all Cognee tools with an MCP server
function registerCogneeTools(mcpServer, z) {
  
  // 1) cognee.add
  mcpServer.registerTool('cognee.add', {
    title: 'Cognee: Add',
    description: 'Add files or URLs into a dataset (multipart/form-data). Either datasetName or datasetId is required.',
    inputSchema: {
      datasetName: z.string().optional(),
      datasetId: z.string().uuid().optional(),
      files: z.array(z.string()).optional().describe('Absolute file paths to upload'),
      urls: z.array(z.string().url()).optional().describe('HTTP/HTTPS or GitHub repo URLs (processed server-side)'),
    }
  }, async ({ datasetName, datasetId, files = [], urls = [] }) => {
    if (!datasetName && !datasetId) {
      return { content: [{ type: 'text', text: 'Error: Provide datasetName or datasetId' }], isError: true };
    }
    if (files.length === 0 && urls.length === 0) {
      return { content: [{ type: 'text', text: 'Error: Provide at least one file or url' }], isError: true };
    }
    
    let FormDataCtor = globalThis.FormData;
    if (!FormDataCtor) {
      FormDataCtor = (await import('form-data')).default;
    }
    const form = new FormDataCtor();

    for (const p of files) {
      const filename = pathMod.basename(p);
      form.append('data', fs.createReadStream(p), filename);
    }
    
    for (const u of urls) {
      form.append('data', u);
    }
    
    if (datasetName) form.append('datasetName', datasetName);
    if (datasetId) form.append('datasetId', datasetId);

    try {
      const out = await fetchForm('/api/v1/add', form);
      return {
        content: [{ type: 'text', text: `✅ Added ${files.length + urls.length} item(s) to dataset.` }],
        structuredContent: out
      };
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });

  // 2) cognee.cognify
  mcpServer.registerTool('cognee.cognify', {
    title: 'Cognee: Cognify',
    description: 'Transform datasets into a knowledge graph (blocking or background).',
    inputSchema: {
      datasets: z.array(z.string()).optional(),
      datasetIds: z.array(z.string().uuid()).optional(),
      runInBackground: z.boolean().optional().describe('Default: false')
    }
  }, async ({ datasets, datasetIds, runInBackground }) => {
    try {
      const out = await fetchJson('POST', '/api/v1/cognify', {
        datasets, datasetIds, runInBackground
      });
      return {
        content: [{ type: 'text', text: `🚀 Cognify started (${runInBackground ? 'background' : 'blocking'})` }],
        structuredContent: out
      };
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });

  // 3) cognee.search
  const SearchType = z.enum([
    'SUMMARIES','INSIGHTS','CHUNKS','RAG_COMPLETION','GRAPH_COMPLETION',
    'GRAPH_SUMMARY_COMPLETION','CODE','CYPHER','NATURAL_LANGUAGE',
    'GRAPH_COMPLETION_COT','GRAPH_COMPLETION_CONTEXT_EXTENSION','FEELING_LUCKY'
  ]);

  mcpServer.registerTool('cognee.search', {
    title: 'Cognee: Search',
    description: 'Semantic/graph search across datasets.',
    inputSchema: {
      searchType: SearchType,
      query: z.string(),
      datasets: z.array(z.string()).optional(),
      datasetIds: z.array(z.string().uuid()).optional(),
      topK: z.number().int().min(1).max(100).optional().describe('Default 10')
    }
  }, async ({ searchType, query, datasets, datasetIds, topK }) => {
    try {
      const out = await fetchJson('POST', '/api/v1/search', {
        searchType, datasets, datasetIds, query, topK
      });
      return {
        content: [{ type: 'text', text: `Found ${Array.isArray(out) ? out.length : 0} result(s) for "${query}"` }],
        structuredContent: out
      };
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });

  // 4) cognee.datasets (combined)
  mcpServer.registerTool('cognee.datasets', {
    title: 'Cognee: Datasets (combined)',
    description: 'List, create, delete a dataset, or delete a single data item.',
    inputSchema: {
      action: z.enum(['list','create','delete','deleteData']),
      name: z.string().optional().describe('Required for create'),
      datasetId: z.string().uuid().optional().describe('Required for delete/deleteData'),
      dataId: z.string().uuid().optional().describe('Required for deleteData')
    }
  }, async ({ action, name, datasetId, dataId }) => {
    try {
      if (action === 'list') {
        const out = await fetchJson('GET', '/api/v1/datasets');
        return { content: [{ type: 'text', text: `📚 ${out.length} dataset(s)` }], structuredContent: out };
      }
      if (action === 'create') {
        if (!name) throw new Error('name is required for create');
        const out = await fetchJson('POST', '/api/v1/datasets', { name });
        return { content: [{ type: 'text', text: `✅ Dataset ready: ${out.name} (${out.id})` }], structuredContent: out };
      }
      if (action === 'delete') {
        if (!datasetId) throw new Error('datasetId is required for delete');
        const out = await fetchJson('DELETE', `/api/v1/datasets/${datasetId}`);
        return { content: [{ type: 'text', text: `🗑️ Deleted dataset ${datasetId}` }], structuredContent: out };
      }
      if (action === 'deleteData') {
        if (!datasetId || !dataId) throw new Error('datasetId and dataId are required for deleteData');
        const out = await fetchJson('DELETE', `/api/v1/datasets/${datasetId}/data/${dataId}`);
        return { content: [{ type: 'text', text: `🧹 Deleted data ${dataId} from dataset ${datasetId}` }], structuredContent: out };
      }
      throw new Error('Unknown action');
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });

  // 5) cognee.codePipeline
  mcpServer.registerTool('cognee.codePipeline', {
    title: 'Cognee: Code Pipeline',
    description: 'Index a repo into a code KG, or retrieve code context.',
    inputSchema: {
      action: z.enum(['index','retrieve']),
      repoPath: z.string().optional().describe('Required for index'),
      includeDocs: z.boolean().optional().describe('Index docs too (default false)'),
      query: z.string().optional().describe('Required for retrieve'),
      fullInput: z.string().optional().describe('Required for retrieve')
    }
  }, async ({ action, repoPath, includeDocs, query, fullInput }) => {
    try {
      if (action === 'index') {
        if (!repoPath) throw new Error('repoPath is required for index');
        const out = await fetchJson('POST', '/api/v1/code-pipeline/index', { repoPath, includeDocs });
        return { content: [{ type: 'text', text: `🧭 Index started for ${repoPath}` }], structuredContent: out };
      }
      if (action === 'retrieve') {
        if (!query || !fullInput) throw new Error('query and fullInput are required for retrieve');
        const out = await fetchJson('POST', '/api/v1/code-pipeline/retrieve', { query, fullInput });
        return { content: [{ type: 'text', text: `🔎 Retrieved ${Array.isArray(out) ? out.length : 0} item(s)` }], structuredContent: out };
      }
      throw new Error('Unknown action');
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  });
  
  console.log('✅ Registered 5 Cognee MCP tools');
}

// Export for use in mcp-server.js
module.exports = { registerCogneeTools };
