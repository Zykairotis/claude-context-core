#!/usr/bin/env node

// Direct GitHub indexing bypassing the job queue
require('dotenv').config();

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function directGitHubIndex() {
    console.log("🚀 Direct GitHub indexing (bypassing job queue)...\n");
    
    try {
        // 1. Clone the repository
        console.log("📦 Cloning repository...");
        const repoPath = '/tmp/Perplexity-claude';
        await execAsync(`rm -rf ${repoPath} 2>/dev/null || true`);
        await execAsync(`git clone https://github.com/Zykairotis/Perplexity-claude.git ${repoPath}`);
        console.log("✅ Repository cloned\n");
        
        // 2. Run MCP server indexing in background
        console.log("📚 Indexing with MCP server...");
        console.log("   Project: AuMGFqLY-hypr-voice-ErNATJWC");
        console.log("   Dataset: github-Perplexity-claude");
        console.log("   Path: " + repoPath);
        
        // Create a simple Node script to call the MCP server
        const indexScript = `
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/node');
const { spawn } = require('child_process');

async function index() {
    const mcpProcess = spawn('node', ['mcp-server.js'], {
        cwd: '/home/mewtwo/Zykairotis/claude-context-core',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
    });
    
    const transport = new StdioServerTransport(mcpProcess.stdout, mcpProcess.stdin);
    const client = transport.connect();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send index request
    const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
            name: 'claudeContext_index',
            arguments: {
                path: '${repoPath}',
                project: 'AuMGFqLY-hypr-voice-ErNATJWC',
                dataset: 'github-Perplexity-claude',
                forceReindex: true
            }
        },
        id: 1
    };
    
    mcpProcess.stdin.write(JSON.stringify(request) + '\\n');
    
    // Wait for indexing
    await new Promise((resolve, reject) => {
        let buffer = '';
        mcpProcess.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line);
                        console.log('Response:', response);
                        if (response.id === 1) {
                            if (response.error) {
                                reject(new Error(response.error.message));
                            } else {
                                resolve(response.result);
                            }
                        }
                    } catch (e) {
                        // Not JSON, just log output
                        console.log(line);
                    }
                }
            }
        });
        
        mcpProcess.stderr.on('data', (data) => {
            console.error('Error:', data.toString());
        });
        
        // Timeout after 5 minutes
        setTimeout(() => {
            mcpProcess.kill();
            reject(new Error('Indexing timeout'));
        }, 300000);
    });
    
    mcpProcess.kill();
}

index().catch(console.error);
`;
        
        // Write and run the script
        const fs = require('fs');
        fs.writeFileSync('/tmp/index-github.js', indexScript);
        
        await execAsync('cd /home/mewtwo/Zykairotis/claude-context-core && node /tmp/index-github.js');
        
        console.log("✅ Indexing complete\n");
        
        // 3. Verify results
        console.log("📊 Verifying results...");
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: 'postgresql://postgres:code-context-secure-password@localhost:5533/claude_context'
        });
        
        const result = await pool.query(`
            SELECT 
                dc.collection_name,
                d.name as dataset_name,
                dc.point_count
            FROM claude_context.dataset_collections dc
            JOIN claude_context.datasets d ON dc.dataset_id = d.id
            WHERE d.name = 'github-Perplexity-claude'
        `);
        
        console.table(result.rows);
        await pool.end();
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

directGitHubIndex();
