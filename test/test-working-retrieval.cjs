// Working test using local EmbeddingMonster services
const fs = require('fs');
const path = require('path');

async function testWorkingRetrieval() {
    console.log('🔍 Testing retrieval with local EmbeddingMonster...');

    try {
        // Import modules directly to avoid UI component issues
        const { Context, EmbeddingMonster, QdrantVectorDatabase } = require('./dist/index.js');

        // Initialize with local embedding services (which are running)
        console.log('🔧 Initializing with EmbeddingMonster (GTE model)...');
        const embedding = new EmbeddingMonster({
            model: 'gte',
            gtePort: 30001,
            gteHost: 'localhost'
        });

        const vectorDB = new QdrantVectorDatabase({
            url: 'http://localhost:6333'
        });

        const context = new Context({
            embedding,
            vectorDatabase: vectorDB
        });

        console.log('✅ Context initialized successfully');

        // Test embedding generation
        console.log('🧪 Testing embedding generation...');
        const testEmbedding = await embedding.embed('test query');
        console.log(`✅ Generated embedding: ${testEmbedding.vector.length} dimensions`);

        // Test semantic search with the current directory
        const testQuery = 'function';
        const testPath = process.cwd();

        console.log(`🔍 Searching for: "${testQuery}" in ${testPath}`);

        const results = await context.semanticSearch(testPath, testQuery, 5, 0.1);

        console.log(`📊 Found ${results.length} results:`);
        if (results.length > 0) {
            results.forEach((result, index) => {
                console.log(`${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine} (score: ${result.score.toFixed(3)})`);
                console.log(`   Language: ${result.language}`);
                console.log(`   Content: ${result.content.substring(0, 150)}...`);
                console.log('');
            });
            console.log('✅ Retrieval is working correctly!');
            return true;
        } else {
            console.log('⚠️  No results found. Trying with different parameters...');

            // Try with a lower threshold and different query
            const results2 = await context.semanticSearch(testPath, 'def', 10, 0.0);
            console.log(`📊 Found ${results2.length} results with lower threshold:`);

            if (results2.length > 0) {
                results2.slice(0, 3).forEach((result, index) => {
                    console.log(`${index + 1}. ${result.relativePath}:${result.startLine}-${result.endLine} (score: ${result.score.toFixed(3)})`);
                    console.log(`   Content: ${result.content.substring(0, 100)}...`);
                });
                console.log('✅ Retrieval works with broader search terms!');
                return true;
            } else {
                console.log('❌ Still no results. The collection might be from a different repository.');

                // List available collections to see what we have
                const collections = await vectorDB.listCollections();
                console.log(`📚 Available collections: ${collections.join(', ')}`);

                if (collections.length > 0) {
                    console.log('💡 Try searching with the original repository path that was indexed.');
                }
                return false;
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

async function showUsageInstructions() {
    console.log('\n📚 USAGE INSTRUCTIONS:');
    console.log('');
    console.log('Your retrieval system is working! Here\'s how to use it:');
    console.log('');
    console.log('1. BASIC SEARCH:');
    console.log('```javascript');
    console.log('const { Context, EmbeddingMonster, QdrantVectorDatabase } = require("./dist/index.js");');
    console.log('');
    console.log('const context = new Context({');
    console.log('  embedding: new EmbeddingMonster({ model: "gte" }),');
    console.log('  vectorDatabase: new QdrantVectorDatabase({ url: "http://localhost:6333" })');
    console.log('});');
    console.log('');
    console.log('const results = await context.semanticSearch(');
    console.log('  "/path/to/your/repository",');
    console.log('  "your search query",');
    console.log('  10,  // number of results');
    console.log('  0.3  // similarity threshold');
    console.log(');');
    console.log('```');
    console.log('');
    console.log('2. INDEX A NEW REPOSITORY:');
    console.log('```javascript');
    console.log('const result = await context.indexCodebase("/path/to/repository");');
    console.log('console.log(`Indexed ${result.indexedFiles} files, ${result.totalChunks} chunks`);');
    console.log('```');
    console.log('');
    console.log('3. AVAILABLE EMBEDDING MODELS:');
    console.log('   - "gte": General text embedding (port 30001)');
    console.log('   - "coderank": Code-specific embedding (port 30002)');
    console.log('');
    console.log('4. SEARCH TIPS:');
    console.log('   - Use relevant keywords from your codebase');
    console.log('   - Try lower thresholds (0.1-0.3) for more results');
    console.log('   - Use the same path that was used during indexing');
    console.log('   - Both repositories must be indexed with the same embedding model');
}

// Run the test
testWorkingRetrieval()
    .then(success => {
        if (success) {
            return showUsageInstructions();
        } else {
            console.log('\n💡 If the test failed, check:');
            console.log('   - EmbeddingMonster services are running on ports 30001/30002');
            console.log('   - Qdrant is running on port 6333');
            console.log('   - The repository was indexed with the same embedding model');
        }
    })
    .catch(console.error);