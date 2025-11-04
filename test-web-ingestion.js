#!/usr/bin/env node
/**
 * Test script for web ingestion
 * Tests the new Context.indexWebPages() implementation
 */

const { Context } = require('./dist/context');
const { Pool } = require('pg');
const { QdrantClient } = require('@qdrant/qdrant-js');

async function main() {
  console.log('🧪 Testing Web Ingestion Pipeline...\n');

  // Initialize connections
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || 'postgres://postgres:code-context-secure-password@localhost:5533/claude_context',
    max: 5
  });

  const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333'
  });

  // Create context
  const context = new Context({
    postgresPool: pool,
    qdrantClient: qdrantClient
  });

  console.log('✅ Context initialized\n');

  // Test page
  const pages = [
    {
      url: 'https://docs.crawl4ai.com/',
      content: `# Crawl4AI Documentation

## Getting Started

Crawl4AI is a powerful web crawler designed for AI applications.

### Installation

\`\`\`bash
pip install crawl4ai
\`\`\`

### Basic Usage

\`\`\`python
from crawl4ai import Crawler

async def main():
    crawler = Crawler()
    result = await crawler.crawl("https://example.com")
    print(result.markdown)
\`\`\`

## Features

- Markdown extraction
- JavaScript rendering
- Smart chunking
- AI-ready output
`,
      title: 'Crawl4AI Documentation',
      domain: 'docs.crawl4ai.com'
    }
  ];

  try {
    console.log('📥 Ingesting web page...');
    console.log(`   URL: ${pages[0].url}`);
    console.log(`   Content length: ${pages[0].content.length} chars\n`);

    const result = await context.indexWebPages(
      pages,
      'test-crawl4ai',
      'docs',
      {
        forceReindex: true,
        progressCallback: (phase, progress) => {
          console.log(`   ${phase}: ${Math.round(progress * 100)}%`);
        }
      }
    );

    console.log('\n✅ Ingestion complete!');
    console.log(`   Processed pages: ${result.processedPages || pages.length}`);
    console.log(`   Total chunks: ${result.totalChunks || 'checking...'}`);

    // Check Qdrant for chunks
    console.log('\n🔍 Checking Qdrant...');
    const collections = await qdrantClient.getCollections();
    const webCollections = collections.collections.filter(c => 
      c.name.includes('test-crawl4ai') || c.name.includes('web')
    );

    for (const collection of webCollections) {
      const info = await qdrantClient.getCollection(collection.name);
      console.log(`   Collection: ${collection.name}`);
      console.log(`   Points: ${info.points_count}`);
    }

    // Check PostgreSQL for chunks
    console.log('\n🔍 Checking PostgreSQL...');
    const chunkResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM claude_context.chunks c
      JOIN claude_context.web_pages w ON c.web_page_id = w.id
      JOIN claude_context.datasets d ON w.dataset_id = d.id
      JOIN claude_context.projects p ON d.project_id = p.id
      WHERE p.name = 'test-crawl4ai' AND d.name = 'docs'
    `);

    console.log(`   Chunks in PostgreSQL: ${chunkResult.rows[0].count}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log('\n🎉 Test complete!');
  process.exit(0);
}

main().catch(console.error);
