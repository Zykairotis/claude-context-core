#!/usr/bin/env node
/**
 * Test crawl4ai ingestion and retrieval
 * Tests the unified schema where both GitHub and web content are searchable together
 */

const { Context } = require('./dist');
const { queryProject } = require('./dist/api/query');

async function main() {
  console.log('🧪 Testing Crawl4AI + GitHub Unified Ingestion\n');

  const context = new Context({
    postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING || 'postgresql://postgres:postgres@localhost:5433/claude_context',
    embeddingProvider: 'auto-embedding-monster',
    vectorDatabase: 'postgres-dual'
  });

  console.log('✅ Context initialized\n');

  // Test 1: Query a project that should have both GitHub and web content
  const testProject = process.env.TEST_PROJECT || 'claude-context';
  const testDataset = process.env.TEST_DATASET || 'core';
  const testQuery = process.env.TEST_QUERY || 'how to index code';

  console.log(`📊 Test Query Parameters:`);
  console.log(`   Project: ${testProject}`);
  console.log(`   Dataset: ${testDataset}`);
  console.log(`   Query: "${testQuery}"\n`);

  try {
    const result = await queryProject(
      context,
      {
        project: testProject,
        dataset: testDataset,
        query: testQuery,
        codebasePath: '/tmp/dummy',  // Not used for project-based queries
        topK: 10,
        includeGlobal: true
      },
      (phase, percentage, detail) => {
        console.log(`   [${percentage}%] ${phase}: ${detail}`);
      }
    );

    console.log(`\n📦 Results (${result.results.length} chunks):\n`);

    result.results.forEach((r, i) => {
      const source = r.file || r.chunk.substring(0, 50);
      const sourceType = r.file ? '📄 file' : '🌐 web';
      console.log(`${i + 1}. ${sourceType} ${source}`);
      console.log(`   Score: ${r.scores.final?.toFixed(4) || r.scores.vector.toFixed(4)}`);
      console.log(`   Project: ${r.projectName || r.projectId}`);
      console.log(`   Chunk: ${r.chunk.substring(0, 100)}...\n`);
    });

    console.log(`\n📈 Metadata:`);
    console.log(`   Retrieval: ${result.metadata.retrievalMethod}`);
    console.log(`   Hybrid: ${result.metadata.featuresUsed.hybridSearch}`);
    console.log(`   Reranking: ${result.metadata.featuresUsed.reranking}`);
    console.log(`   Timing: ${result.metadata.timingMs.total.toFixed(0)}ms`);

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

