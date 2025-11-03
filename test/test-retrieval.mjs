import fs from 'fs';
import path from 'path';
import { Context, OpenAIEmbedding, QdrantVectorDatabase } from './dist/index.js';

async function testRetrieval() {
    console.log('🔍 Testing repository retrieval...');

    try {
        // Check if dist files exist
        const distIndex = path.join(process.cwd(), 'dist', 'index.js');
        if (!fs.existsSync(distIndex)) {
            console.log('❌ Dist files not found. Run npm run build first.');
            return;
        }

        // Initialize Context with basic configuration
        const embedding = new OpenAIEmbedding({
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            model: 'text-embedding-3-small'
        });

        const vectorDB = new QdrantVectorDatabase({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY
        });

        const context = new Context({
            embedding,
            vectorDatabase: vectorDB
        });

        console.log('✅ Context initialized successfully');

        // Test if we have any indexed collections
        const collections = await vectorDB.listCollections();
        console.log(`📚 Found ${collections.length} collections:`, collections);

        if (collections.length === 0) {
            console.log('⚠️  No collections found. You need to index a repository first.');
            console.log('💡 To index a repository, use:');
            console.log('   const result = await context.indexCodebase("/path/to/your/repo");');
            return;
        }

        // Test semantic search
        const testQuery = "function main";
        const testPath = process.cwd(); // Use current directory as test path

        console.log(`🔍 Testing search for: "${testQuery}"`);
        console.log(`📁 Using path: ${testPath}`);

        const results = await context.semanticSearch(testPath, testQuery, 5, 0.1);

        console.log(`📊 Found ${results.length} results:`);
        results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine} (score: ${result.score.toFixed(3)})`);
            console.log(`   Content: ${result.content.substring(0, 100)}...`);
        });

        if (results.length === 0) {
            console.log('⚠️  No results found. This could indicate:');
            console.log('   - The collection exists but is empty');
            console.log('   - The search query doesn\'t match indexed content');
            console.log('   - There might be embedding dimension mismatch');
            console.log('   - The vector database connection issues');

            // Try to get collection stats
            if (collections.length > 0) {
                const firstCollection = collections[0];
                try {
                    const stats = await vectorDB.getCollectionStats(firstCollection);
                    console.log(`📈 Collection stats for ${firstCollection}:`, stats);
                } catch (error) {
                    console.log(`❌ Failed to get stats for ${firstCollection}:`, error.message);
                }
            }
        } else {
            console.log('✅ Retrieval is working correctly!');
        }

    } catch (error) {
        console.error('❌ Retrieval test failed:', error);
        console.error('Stack trace:', error.stack);

        // Provide helpful troubleshooting info
        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 Connection refused. Check if:');
            console.log('   - Vector database server is running');
            console.log('   - Connection URL is correct');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.log('💡 Authentication failed. Check:');
            console.log('   - API keys are correct');
            console.log('   - API keys have necessary permissions');
        } else if (error.message.includes('Collection not found')) {
            console.log('💡 Collection not found. Check:');
            console.log('   - Repository has been indexed');
            console.log('   - Collection name is correct');
        }
    }
}

// Run the test
testRetrieval().catch(console.error);