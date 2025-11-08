// =============================
// Example: How to integrate refined Cognee tools into mcp-server.js
// This shows the key additions to make to your existing mcp-server.js
// =============================

// ... existing imports ...

// Add this import near the top of mcp-server.js
const { registerCogneeToolsRefined, getCurrentProject } = require('./cognee-mcp-tools-refined');

// ... existing code ...

// After mcpServer is created but BEFORE mcpServer.connect(transport):

// =============================
// Project Context Management
// =============================

// Load current project/dataset from MCP defaults
let currentProjectContext = {
  project: 'default',
  dataset: 'main'
};

// Load from ~/.context/claude-mcp.json if exists
try {
  const mcpDefaults = loadMcpDefaults();
  if (mcpDefaults.project) {
    currentProjectContext.project = mcpDefaults.project;
  }
  if (mcpDefaults.dataset) {
    currentProjectContext.dataset = mcpDefaults.dataset;
  }
} catch (e) {
  // Use defaults
}

// Override getCurrentProject to use MCP context
process.env.COGNEE_PROJECT = currentProjectContext.project;

// =============================
// Register Refined Cognee Tools
// =============================

// Register all 5 refined Cognee tools with proper schema
registerCogneeToolsRefined(mcpServer, z);

console.log('✅ Registered refined Cognee MCP tools with project/dataset support');

// =============================
// Add Project Context Tool
// =============================

// Tool to manage project/dataset context
mcpServer.registerTool('context.setProject', {
  title: 'Set Project Context',
  description: 'Set the current project and dataset context for both Claude-Context and Cognee',
  inputSchema: {
    project: z.string().describe('Project name'),
    dataset: z.string().optional().describe('Dataset name')
  }
}, async ({ project, dataset }) => {
  try {
    // Update context
    currentProjectContext.project = project;
    if (dataset) {
      currentProjectContext.dataset = dataset;
    }
    
    // Save to MCP defaults
    saveMcpDefaults({
      project: currentProjectContext.project,
      dataset: currentProjectContext.dataset
    });
    
    // Update environment for Cognee
    process.env.COGNEE_PROJECT = project;
    
    return {
      content: [{
        type: 'text',
        text: `✅ Context set to project: ${project}${dataset ? `, dataset: ${dataset}` : ''}`
      }],
      structuredContent: currentProjectContext
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error: ${error.message}` }],
      isError: true
    };
  }
});

// =============================
// Add Unified Search Tool
// =============================

// Unified search across both Claude-Context and Cognee
mcpServer.registerTool('unified.search', {
  title: 'Unified Search',
  description: 'Search across both code (Claude-Context) and documents (Cognee)',
  inputSchema: {
    query: z.string().describe('Search query'),
    includeCode: z.boolean().optional().describe('Include code search (default: true)'),
    includeDocs: z.boolean().optional().describe('Include document search (default: true)'),
    project: z.string().optional().describe('Project scope'),
    dataset: z.string().optional().describe('Dataset scope'),
    topK: z.number().optional().describe('Max results per source')
  }
}, async ({ query, includeCode = true, includeDocs = true, project, dataset, topK = 10 }) => {
  const projectScope = project || currentProjectContext.project;
  const datasetScope = dataset || currentProjectContext.dataset;
  
  const results = {
    code: null,
    documents: null
  };
  
  const promises = [];
  
  // Search code with Claude-Context
  if (includeCode) {
    promises.push(
      mcpServer.executeTool('claudeContext.search', {
        query,
        project: projectScope,
        dataset: datasetScope,
        topK
      }).then(r => { results.code = r; })
    );
  }
  
  // Search documents with Cognee
  if (includeDocs) {
    promises.push(
      mcpServer.executeTool('cognee.search', {
        searchType: 'CHUNKS',
        query,
        datasets: [datasetScope],
        project: projectScope,
        topK
      }).then(r => { results.documents = r; })
    );
  }
  
  await Promise.all(promises);
  
  // Combine results
  const combinedResults = [];
  let totalResults = 0;
  
  if (results.code && !results.code.isError) {
    const codeResults = results.code.structuredContent?.results || [];
    combinedResults.push(...codeResults.map(r => ({ ...r, source: 'code' })));
    totalResults += codeResults.length;
  }
  
  if (results.documents && !results.documents.isError) {
    const docResults = results.documents.structuredContent?.results || [];
    combinedResults.push(...docResults.map(r => ({ ...r, source: 'documents' })));
    totalResults += docResults.length;
  }
  
  // Sort by relevance score
  combinedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return {
    content: [{
      type: 'text',
      text: `🔍 Found ${totalResults} results (${results.code ? 'code' : ''}${results.code && results.documents ? ' + ' : ''}${results.documents ? 'docs' : ''})`
    }],
    structuredContent: {
      query,
      project: projectScope,
      dataset: datasetScope,
      results: combinedResults.slice(0, topK),
      totalResults,
      sources: {
        code: results.code ? !results.code.isError : false,
        documents: results.documents ? !results.documents.isError : false
      }
    }
  };
});

// =============================
// Add Smart Processing Tool
// =============================

// Intelligently route files to the right system
mcpServer.registerTool('smart.process', {
  title: 'Smart File Processing',
  description: 'Automatically route files to Claude-Context (code) or Cognee (docs)',
  inputSchema: {
    files: z.array(z.string()).describe('File paths to process'),
    project: z.string().optional(),
    codeDataset: z.string().optional().describe('Dataset for code files'),
    docDataset: z.string().optional().describe('Dataset for document files')
  }
}, async ({ files, project, codeDataset = 'code', docDataset = 'docs' }) => {
  const projectScope = project || currentProjectContext.project;
  
  // Categorize files
  const codeExtensions = /\.(js|jsx|ts|tsx|py|java|go|rs|cpp|c|h|hpp|cs|rb|php|swift|kt|scala)$/i;
  const docExtensions = /\.(md|txt|pdf|doc|docx|html|htm)$/i;
  
  const codeFiles = files.filter(f => codeExtensions.test(f));
  const docFiles = files.filter(f => docExtensions.test(f));
  const otherFiles = files.filter(f => !codeExtensions.test(f) && !docExtensions.test(f));
  
  const results = {
    code: null,
    docs: null,
    other: otherFiles
  };
  
  // Process code files with Claude-Context
  if (codeFiles.length > 0) {
    try {
      results.code = await mcpServer.executeTool('claudeContext.index', {
        files: codeFiles,
        project: projectScope,
        dataset: codeDataset
      });
    } catch (error) {
      results.code = { error: error.message };
    }
  }
  
  // Process document files with Cognee
  if (docFiles.length > 0) {
    try {
      // Add files
      const addResult = await mcpServer.executeTool('cognee.add', {
        datasetName: docDataset,
        files: docFiles,
        project: projectScope
      });
      
      // Cognify (auto-select background mode)
      const cognifyResult = await mcpServer.executeTool('cognee.cognify', {
        datasets: [docDataset],
        project: projectScope,
        runInBackground: docFiles.length > 10
      });
      
      results.docs = {
        added: addResult,
        cognified: cognifyResult
      };
    } catch (error) {
      results.docs = { error: error.message };
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: `✅ Processed: ${codeFiles.length} code files, ${docFiles.length} doc files${otherFiles.length > 0 ? `, ${otherFiles.length} skipped` : ''}`
    }],
    structuredContent: {
      project: projectScope,
      processed: {
        code: codeFiles,
        documents: docFiles,
        skipped: otherFiles
      },
      results
    }
  };
});

// =============================
// Add Pipeline Status Tool
// =============================

// Check status of background Cognee pipelines
mcpServer.registerTool('pipeline.status', {
  title: 'Check Pipeline Status',
  description: 'Check the status of Cognee background pipelines',
  inputSchema: {
    pipelineId: z.string().uuid().optional().describe('Specific pipeline ID'),
    dataset: z.string().optional().describe('Dataset name to check'),
    limit: z.number().optional().describe('Number of recent pipelines')
  }
}, async ({ pipelineId, dataset, limit = 5 }) => {
  try {
    // Query database for pipeline status
    const db = await getDbConnection();
    
    let query, params;
    if (pipelineId) {
      query = `
        SELECT pr.*, d.name as dataset_name
        FROM pipeline_runs pr
        JOIN datasets d ON pr.dataset_id = d.id
        WHERE pr.id = $1
      `;
      params = [pipelineId];
    } else if (dataset) {
      query = `
        SELECT pr.*, d.name as dataset_name
        FROM pipeline_runs pr
        JOIN datasets d ON pr.dataset_id = d.id
        WHERE d.name = $1
        ORDER BY pr.started_at DESC
        LIMIT $2
      `;
      params = [dataset, limit];
    } else {
      query = `
        SELECT pr.*, d.name as dataset_name
        FROM pipeline_runs pr
        JOIN datasets d ON pr.dataset_id = d.id
        ORDER BY pr.started_at DESC
        LIMIT $1
      `;
      params = [limit];
    }
    
    const result = await db.query(query, params);
    
    const pipelines = result.rows.map(row => ({
      id: row.id,
      dataset: row.dataset_name,
      kind: row.kind,
      status: row.status,
      stats: row.stats,
      duration: row.duration_ms,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error_message
    }));
    
    return {
      content: [{
        type: 'text',
        text: `📊 Found ${pipelines.length} pipeline(s): ${pipelines.map(p => `${p.status}`).join(', ')}`
      }],
      structuredContent: {
        pipelines,
        summary: {
          total: pipelines.length,
          running: pipelines.filter(p => p.status === 'running').length,
          completed: pipelines.filter(p => p.status === 'completed').length,
          failed: pipelines.filter(p => p.status === 'failed').length
        }
      }
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error: ${error.message}` }],
      isError: true
    };
  }
});

// =============================
// Enhanced Monitoring
// =============================

// Track all tool executions for analytics
const toolMetrics = new Map();

// Wrap tool execution with metrics
const originalExecuteTool = mcpServer.executeTool;
mcpServer.executeTool = async function(toolName, params) {
  const startTime = Date.now();
  
  try {
    const result = await originalExecuteTool.call(this, toolName, params);
    const duration = Date.now() - startTime;
    
    // Record metrics
    if (!toolMetrics.has(toolName)) {
      toolMetrics.set(toolName, {
        count: 0,
        totalDuration: 0,
        errors: 0
      });
    }
    
    const metrics = toolMetrics.get(toolName);
    metrics.count++;
    metrics.totalDuration += duration;
    if (result.isError) metrics.errors++;
    
    // Log to database if available
    try {
      const db = await getDbConnection();
      await db.query(`
        INSERT INTO search_logs (project_id, search_type, query, latency_ms, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        currentProjectContext.project,
        toolName,
        params.query || params.action || toolName,
        duration,
        JSON.stringify(params)
      ]);
    } catch (e) {
      // Ignore logging errors
    }
    
    return result;
  } catch (error) {
    const metrics = toolMetrics.get(toolName);
    if (metrics) metrics.errors++;
    throw error;
  }
};

// Tool to get metrics
mcpServer.registerTool('system.metrics', {
  title: 'Get System Metrics',
  description: 'Get performance metrics for all tools',
  inputSchema: {}
}, async () => {
  const metrics = [];
  
  for (const [tool, data] of toolMetrics) {
    metrics.push({
      tool,
      count: data.count,
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      totalDuration: data.totalDuration,
      errorRate: data.count > 0 ? (data.errors / data.count * 100).toFixed(2) + '%' : '0%'
    });
  }
  
  // Sort by usage
  metrics.sort((a, b) => b.count - a.count);
  
  return {
    content: [{
      type: 'text',
      text: `📈 System metrics: ${metrics.length} tools tracked`
    }],
    structuredContent: {
      metrics,
      summary: {
        totalTools: metrics.length,
        totalCalls: metrics.reduce((sum, m) => sum + m.count, 0),
        totalDuration: metrics.reduce((sum, m) => sum + m.totalDuration, 0)
      }
    }
  };
});

// ... rest of existing mcp-server.js code ...

// The mcpServer.connect(transport) remains at the end as before

console.log('✅ MCP Server with refined Cognee + Claude-Context integration ready');
