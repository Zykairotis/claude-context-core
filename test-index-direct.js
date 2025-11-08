#!/usr/bin/env node

const { Context } = require('./dist/context');
const { AutoEmbedding } = require('./dist/embedding/auto-embedding');
const { QdrantVectorDatabase } = require('./dist/vectordb/qdrant-vectordb');
const { NebulaGraphWrapper } = require('./dist/summarizer/nebula-graph-wrapper');
const { Pool } = require('pg');

async function main() {
    console.log("🚀 Starting direct re-indexing with NEW scope-based naming...\n");

    // Initialize PostgreSQL
    const postgresPool = new Pool({
        connectionString: 'postgresql://postgres:code-context-secure-password@localhost:5533/claude_context'
    });

    // Initialize embedding
    const embedding = new AutoEmbedding({
        provider: process.env.CLAUDE_CONTEXT_EMBEDDING_PROVIDER || 'voyage',
        apiKey: process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY
    });
    await embedding.initialize();

    // Initialize vector database
    const vectorDatabase = new QdrantVectorDatabase({
        host: 'localhost',
        port: 6333
    });

    // Initialize summarizer
    const summarizer = new NebulaGraphWrapper({
        user: process.env.NEBULA_USER || 'root',
        password: process.env.NEBULA_PASSWORD || 'nebula',
        address: process.env.NEBULA_ADDRESS || 'localhost:9669'
    });

    // Create context
    const context = new Context(
        embedding,
        vectorDatabase,
        null,
        summarizer,
        {
            enableSpladeEmbedding: true,
            postgresPool: postgresPool,
            scopeLevel: 'local'  // Use local scope for dataset isolation
        }
    );

    try {
        // 1. Index GitHub repository with NEW code
        console.log("📦 Indexing GitHub repository: Zykairotis/Perplexity-claude");
        console.log("   Project: AuMGFqLY-hypr-voice-ErNATJWC");
        console.log("   Dataset: github-Perplexity-claude\n");

        const { ingestGithubRepository } = require('./dist/api/ingest');
        
        const githubResult = await ingestGithubRepository(context, {
            repo: 'Zykairotis/Perplexity-claude',
            project: 'AuMGFqLY-hypr-voice-ErNATJWC',
            dataset: 'github-Perplexity-claude',
            forceReindex: true,
            codebasePath: '/tmp/github-repos/Perplexity-claude'
        });

        console.log("✅ GitHub indexing result:", githubResult);
        console.log("");

        // 2. Check dataset_collections table
        console.log("📊 Checking dataset_collections table:");
        const result = await postgresPool.query(`
            SELECT 
                dc.collection_name,
                d.name as dataset_name,
                dc.point_count,
                dc.created_at
            FROM claude_context.dataset_collections dc
            JOIN claude_context.datasets d ON dc.dataset_id = d.id
            ORDER BY dc.created_at DESC
        `);

        console.table(result.rows);
        console.log("");

        // 3. Check Qdrant collections
        console.log("🔍 Checking Qdrant collections:");
        const collectionsResponse = await fetch('http://localhost:6333/collections');
        const collections = await collectionsResponse.json();
        
        for (const coll of collections.result.collections) {
            const detailsResponse = await fetch(`http://localhost:6333/collections/${coll.name}`);
            const details = await detailsResponse.json();
            console.log(`   - ${coll.name}: ${details.result.vectors_count || 0} vectors`);
        }
        console.log("");

        // 4. Test search in the GitHub dataset
        console.log("🔎 Testing search in github-Perplexity-claude dataset:");
        const { queryProject } = require('./dist/api/query');
        
        const searchResult = await queryProject(context, {
            project: 'AuMGFqLY-hypr-voice-ErNATJWC',
            dataset: 'github-Perplexity-claude',
            query: 'perplexity models API',
            topK: 3
        });

        if (searchResult.results && searchResult.results.length > 0) {
            console.log(`   Found ${searchResult.results.length} results`);
            console.log(`   First result from: ${searchResult.results[0].file || searchResult.results[0].url}`);
        } else {
            console.log("   ❌ No results found");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
    } finally {
        await postgresPool.end();
    }
}

main().catch(console.error);
