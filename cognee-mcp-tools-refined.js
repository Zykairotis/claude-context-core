// =============================
// Cognee: MCP tools (5 tools) - Refined with schema improvements
// Env: COGNEE_URL (default https://api.cognee.ai), COGNEE_TOKEN (Bearer)
// =============================
const fs = require('fs');
const pathMod = require('path');

// Helper functions
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

// Get current project context (from MCP defaults or environment)
function getCurrentProject() {
  // This would load from ~/.context/claude-mcp.json or environment
  return process.env.COGNEE_PROJECT || 'default';
}

// Export function to register all Cognee tools with an MCP server
function registerCogneeToolsRefined(mcpServer, z) {
  
  // 1) cognee.add - Enhanced with better validation and project context
  mcpServer.registerTool('cognee.add', {
    title: 'Cognee: Add Data',
    description: 'Add files or URLs to a dataset. Requires either datasetId or datasetName. Validates non-empty inputs.',
    inputSchema: {
      datasetId: z.string().uuid().optional().describe('UUID of existing dataset'),
      datasetName: z.string().min(1).optional().describe('Name of dataset (creates if not exists)'),
      files: z.array(z.string().min(1)).optional().describe('Absolute file paths to upload'),
      urls: z.array(z.string().url()).optional().describe('HTTP/HTTPS or GitHub URLs'),
      project: z.string().optional().describe('Project scope (default: current project)')
    }
  }, async ({ datasetId, datasetName, files = [], urls = [], project }) => {
    // Validation: require either ID or name
    if (!datasetId && !datasetName) {
      return { 
        content: [{ type: 'text', text: '❌ Error: Either datasetId or datasetName is required' }], 
        isError: true 
      };
    }
    
    // Validation: require at least one input
    if (files.length === 0 && urls.length === 0) {
      return { 
        content: [{ type: 'text', text: '❌ Error: At least one file or URL is required' }], 
        isError: true 
      };
    }
    
    // Validation: check files exist
    for (const file of files) {
      if (!fs.existsSync(file)) {
        return {
          content: [{ type: 'text', text: `❌ Error: File not found: ${file}` }],
          isError: true
        };
      }
    }
    
    const projectScope = project || getCurrentProject();
    const startTime = Date.now();
    
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
    form.append('project', projectScope);

    try {
      const out = await fetchForm('/api/v1/add', form);
      const duration = Date.now() - startTime;
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Added ${files.length + urls.length} item(s) to dataset ${datasetName || datasetId} (${duration}ms)` 
        }],
        structuredContent: {
          ...out,
          itemsAdded: files.length + urls.length,
          datasetId: out.datasetId || datasetId,
          datasetName: out.datasetName || datasetName,
          project: projectScope,
          duration
        }
      };
    } catch (e) {
      return { 
        content: [{ type: 'text', text: `❌ Error: ${String(e)}` }], 
        isError: true 
      };
    }
  });

  // 2) cognee.cognify - Enhanced with smart defaults
  mcpServer.registerTool('cognee.cognify', {
    title: 'Cognee: Cognify (Build Knowledge Graph)',
    description: 'Transform datasets into knowledge graphs. Use blocking for small sets (<100 items), background for large.',
    inputSchema: {
      datasetIds: z.array(z.string().uuid()).optional().describe('Dataset UUIDs (cross-project access)'),
      datasets: z.array(z.string()).optional().describe('Dataset names (current project)'),
      runInBackground: z.boolean().optional().describe('Async processing (auto-selected based on size)'),
      project: z.string().optional().describe('Project scope (default: current)'),
      graphModel: z.string().optional().describe('Graph extraction model')
    }
  }, async ({ datasetIds, datasets, runInBackground, project, graphModel }) => {
    if (!datasetIds?.length && !datasets?.length) {
      return {
        content: [{ type: 'text', text: '❌ Error: Provide datasetIds or datasets' }],
        isError: true
      };
    }
    
    const projectScope = project || getCurrentProject();
    const startTime = Date.now();
    
    try {
      // Auto-determine background mode if not specified
      let useBackground = runInBackground;
      if (useBackground === undefined) {
        // Query dataset sizes to determine mode
        const datasetCount = (datasetIds?.length || 0) + (datasets?.length || 0);
        useBackground = datasetCount > 1; // Multiple datasets = background
      }
      
      const out = await fetchJson('POST', '/api/v1/cognify', {
        datasets, 
        datasetIds, 
        runInBackground: useBackground,
        project: projectScope,
        graphModel
      });
      
      const duration = Date.now() - startTime;
      
      if (useBackground) {
        return {
          content: [{ 
            type: 'text', 
            text: `🚀 Cognify pipeline started in background (ID: ${out.pipeline_run_id})` 
          }],
          structuredContent: {
            ...out,
            mode: 'background',
            project: projectScope,
            datasets: datasets || [],
            datasetIds: datasetIds || [],
            duration
          }
        };
      } else {
        return {
          content: [{ 
            type: 'text', 
            text: `✅ Cognify complete: ${out.stats?.entities_extracted || 0} entities, ${out.stats?.relationships_found || 0} relationships (${duration}ms)` 
          }],
          structuredContent: {
            ...out,
            mode: 'blocking',
            project: projectScope,
            datasets: datasets || [],
            datasetIds: datasetIds || [],
            duration
          }
        };
      }
    } catch (e) {
      return { 
        content: [{ type: 'text', text: `❌ Error: ${String(e)}` }], 
        isError: true 
      };
    }
  });

  // 3) cognee.search - Enhanced with include parameter for shared datasets
  const SearchType = z.enum([
    'SUMMARIES','INSIGHTS','CHUNKS','CHUNKS_LEXICAL',
    'RAG_COMPLETION','GRAPH_COMPLETION','GRAPH_SUMMARY_COMPLETION',
    'CODE','CYPHER','NATURAL_LANGUAGE',
    'GRAPH_COMPLETION_COT','GRAPH_COMPLETION_CONTEXT_EXTENSION',
    'FEELING_LUCKY'
  ]);

  mcpServer.registerTool('cognee.search', {
    title: 'Cognee: Search',
    description: 'Search across datasets using various strategies. Default: current project/dataset only.',
    inputSchema: {
      searchType: SearchType.describe('Search strategy to use'),
      query: z.string().describe('Natural language query'),
      datasetIds: z.array(z.string().uuid()).optional().describe('Dataset UUIDs'),
      datasets: z.array(z.string()).optional().describe('Dataset names'),
      topK: z.number().int().min(1).max(100).optional().describe('Max results (default: 10)'),
      include: z.array(z.string()).optional().describe('Include shared datasets: ["shared/foo", "global/docs"]'),
      project: z.string().optional().describe('Project scope')
    }
  }, async ({ searchType, query, datasetIds, datasets, topK = 10, include, project }) => {
    const projectScope = project || getCurrentProject();
    const startTime = Date.now();
    
    try {
      // Handle shared dataset includes
      let allDatasets = datasets || [];
      let allDatasetIds = datasetIds || [];
      
      if (include?.length) {
        // Parse includes and add to search scope
        for (const inc of include) {
          if (inc.startsWith('shared/')) {
            // Fan-out query to shared dataset
            allDatasets.push(inc);
          } else if (inc.startsWith('global/')) {
            // Add global corpus
            allDatasets.push(inc);
          }
        }
      }
      
      const out = await fetchJson('POST', '/api/v1/search', {
        searchType, 
        query, 
        datasets: allDatasets, 
        datasetIds: allDatasetIds, 
        topK,
        project: projectScope
      });
      
      const duration = Date.now() - startTime;
      const resultCount = Array.isArray(out) ? out.length : (out.results?.length || 0);
      
      return {
        content: [{ 
          type: 'text', 
          text: `🔍 Found ${resultCount} result(s) for "${query}" using ${searchType} (${duration}ms)` 
        }],
        structuredContent: {
          results: Array.isArray(out) ? out : (out.results || []),
          query,
          searchType,
          datasets: allDatasets,
          datasetIds: allDatasetIds,
          project: projectScope,
          topK,
          resultCount,
          duration
        }
      };
    } catch (e) {
      return { 
        content: [{ type: 'text', text: `❌ Error: ${String(e)}` }], 
        isError: true 
      };
    }
  });

  // 4) cognee.datasets - Enhanced with share/unshare actions
  mcpServer.registerTool('cognee.datasets', {
    title: 'Cognee: Dataset Management',
    description: 'List, create, delete, share, or unshare datasets. Supports cross-project sharing.',
    inputSchema: {
      action: z.enum(['list','create','delete','deleteData','share','unshare']),
      name: z.string().optional().describe('Dataset name (for create)'),
      datasetId: z.string().uuid().optional().describe('Dataset UUID'),
      datasetName: z.string().optional().describe('Dataset name (alternative to ID)'),
      dataId: z.string().uuid().optional().describe('Data item UUID (for deleteData)'),
      granteeProject: z.string().optional().describe('Project to share with (for share)'),
      permission: z.enum(['read','write','owner']).optional().describe('Permission level (for share)'),
      project: z.string().optional().describe('Project scope'),
      scope: z.enum(['project','global','linked']).optional().describe('Dataset scope (for create)')
    }
  }, async ({ action, name, datasetId, datasetName, dataId, granteeProject, permission, project, scope }) => {
    const projectScope = project || getCurrentProject();
    const startTime = Date.now();
    
    try {
      // Handle actions
      switch (action) {
        case 'list': {
          const out = await fetchJson('GET', `/api/v1/datasets?project=${projectScope}`);
          const duration = Date.now() - startTime;
          
          return { 
            content: [{ 
              type: 'text', 
              text: `📚 Found ${out.length} dataset(s) in project ${projectScope}` 
            }], 
            structuredContent: {
              datasets: out,
              project: projectScope,
              count: out.length,
              duration
            }
          };
        }
        
        case 'create': {
          if (!name) throw new Error('name is required for create');
          
          const out = await fetchJson('POST', '/api/v1/datasets', { 
            name, 
            project: projectScope,
            scope: scope || 'project'
          });
          const duration = Date.now() - startTime;
          
          return { 
            content: [{ 
              type: 'text', 
              text: `✅ Created dataset "${out.name}" (ID: ${out.id}) in project ${projectScope}` 
            }], 
            structuredContent: {
              ...out,
              project: projectScope,
              scope: scope || 'project',
              duration
            }
          };
        }
        
        case 'delete': {
          const id = datasetId || await resolveDatasetName(datasetName, projectScope);
          if (!id) throw new Error('datasetId or datasetName required for delete');
          
          const out = await fetchJson('DELETE', `/api/v1/datasets/${id}`);
          const duration = Date.now() - startTime;
          
          return { 
            content: [{ 
              type: 'text', 
              text: `🗑️ Deleted dataset ${datasetName || id}` 
            }], 
            structuredContent: {
              deleted: true,
              datasetId: id,
              project: projectScope,
              duration
            }
          };
        }
        
        case 'deleteData': {
          const id = datasetId || await resolveDatasetName(datasetName, projectScope);
          if (!id || !dataId) throw new Error('datasetId/datasetName and dataId required');
          
          const out = await fetchJson('DELETE', `/api/v1/datasets/${id}/data/${dataId}`);
          const duration = Date.now() - startTime;
          
          return { 
            content: [{ 
              type: 'text', 
              text: `🧹 Deleted data item ${dataId} from dataset ${datasetName || id}` 
            }], 
            structuredContent: {
              deleted: true,
              datasetId: id,
              dataId,
              project: projectScope,
              duration
            }
          };
        }
        
        case 'share': {
          const id = datasetId || await resolveDatasetName(datasetName, projectScope);
          if (!id || !granteeProject || !permission) {
            throw new Error('datasetId/datasetName, granteeProject, and permission required for share');
          }
          
          // Create share record in dataset_shares table
          const out = await fetchJson('POST', `/api/v1/datasets/${id}/shares`, {
            granteeProject,
            permission
          });
          const duration = Date.now() - startTime;
          
          return {
            content: [{ 
              type: 'text', 
              text: `🔗 Shared dataset ${datasetName || id} with project ${granteeProject} (${permission} access)` 
            }],
            structuredContent: {
              shareId: out.id,
              datasetId: id,
              granteeProject,
              permission,
              project: projectScope,
              duration
            }
          };
        }
        
        case 'unshare': {
          const id = datasetId || await resolveDatasetName(datasetName, projectScope);
          if (!id || !granteeProject) {
            throw new Error('datasetId/datasetName and granteeProject required for unshare');
          }
          
          const out = await fetchJson('DELETE', `/api/v1/datasets/${id}/shares/${granteeProject}`);
          const duration = Date.now() - startTime;
          
          return {
            content: [{ 
              type: 'text', 
              text: `🔓 Removed ${granteeProject}'s access to dataset ${datasetName || id}` 
            }],
            structuredContent: {
              unshared: true,
              datasetId: id,
              granteeProject,
              project: projectScope,
              duration
            }
          };
        }
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (e) {
      return { 
        content: [{ type: 'text', text: `❌ Error: ${String(e)}` }], 
        isError: true 
      };
    }
  });

  // 5) cognee.codePipeline - Enhanced with project context
  mcpServer.registerTool('cognee.codePipeline', {
    title: 'Cognee: Code Pipeline',
    description: 'Index repositories or retrieve code context. Use Claude-Context for hybrid code search.',
    inputSchema: {
      action: z.enum(['index','retrieve']),
      repoPath: z.string().optional().describe('Repository path (for index)'),
      includeDocs: z.boolean().optional().describe('Include documentation (default: false)'),
      query: z.string().optional().describe('Search query (for retrieve)'),
      fullInput: z.string().optional().describe('Full question context (for retrieve)'),
      datasetName: z.string().optional().describe('Dataset to index into'),
      project: z.string().optional().describe('Project scope')
    }
  }, async ({ action, repoPath, includeDocs, query, fullInput, datasetName, project }) => {
    const projectScope = project || getCurrentProject();
    const startTime = Date.now();
    
    try {
      if (action === 'index') {
        if (!repoPath) throw new Error('repoPath is required for index');
        
        const out = await fetchJson('POST', '/api/v1/code-pipeline/index', { 
          repoPath, 
          includeDocs,
          datasetName: datasetName || `code-${pathMod.basename(repoPath)}`,
          project: projectScope
        });
        const duration = Date.now() - startTime;
        
        return { 
          content: [{ 
            type: 'text', 
            text: `🧭 Code indexing started for ${repoPath} → dataset "${datasetName}" (${duration}ms)` 
          }], 
          structuredContent: {
            ...out,
            repoPath,
            datasetName: datasetName || `code-${pathMod.basename(repoPath)}`,
            project: projectScope,
            includeDocs,
            duration
          }
        };
      }
      
      if (action === 'retrieve') {
        if (!query || !fullInput) throw new Error('query and fullInput required for retrieve');
        
        const out = await fetchJson('POST', '/api/v1/code-pipeline/retrieve', { 
          query, 
          fullInput,
          project: projectScope 
        });
        const duration = Date.now() - startTime;
        const resultCount = Array.isArray(out) ? out.length : (out.items?.length || 0);
        
        return { 
          content: [{ 
            type: 'text', 
            text: `🔎 Retrieved ${resultCount} code context item(s) (${duration}ms)` 
          }], 
          structuredContent: {
            items: Array.isArray(out) ? out : (out.items || []),
            query,
            fullInput,
            project: projectScope,
            resultCount,
            duration
          }
        };
      }
      
      throw new Error('Unknown action');
    } catch (e) {
      return { 
        content: [{ type: 'text', text: `❌ Error: ${String(e)}` }], 
        isError: true 
      };
    }
  });
  
  console.log('✅ Registered 5 refined Cognee MCP tools with project/dataset first-class support');
}

// Helper: Resolve dataset name to ID
async function resolveDatasetName(name, project) {
  if (!name) return null;
  
  try {
    const datasets = await fetchJson('GET', `/api/v1/datasets?project=${project}&name=${name}`);
    return datasets[0]?.id || null;
  } catch {
    return null;
  }
}

// Export for use in mcp-server.js
module.exports = { 
  registerCogneeToolsRefined,
  getCogneeBase,
  authHeaders,
  getCurrentProject
};
