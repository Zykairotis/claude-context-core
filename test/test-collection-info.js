// Test to check collection details and try alternative embedding methods
const fs = require('fs');
const path = require('path');

async function checkCollectionDetails() {
    console.log('🔍 Checking collection details...');

    try {
        const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
        const collectionName = 'hybrid_code_chunks_4a4e79b1';

        console.log(`📚 Checking collection: ${collectionName}`);

        // Get collection info
        const response = await fetch(`${qdrantUrl}/collections/${collectionName}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Collection details:');
            console.log(`   Points count: ${data.result?.status?.points_count || 'Unknown'}`);
            console.log(`   Vector config: ${JSON.stringify(data.result?.config?.params?.vectors, null, 2)}`);

            // Try to get a sample point
            const sampleResponse = await fetch(`${qdrantUrl}/collections/${collectionName}/points/scroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    limit: 1,
                    with_payload: true,
                    with_vector: false
                })
            });

            if (sampleResponse.ok) {
                const sampleData = await sampleResponse.json();
                const points = sampleData.result?.points || [];

                if (points.length > 0) {
                    const point = points[0];
                    console.log('📄 Sample document:');
                    console.log(`   ID: ${point.id}`);
                    console.log(`   Path: ${point.payload?.relative_path || 'Unknown'}`);
                    console.log(`   Language: ${point.payload?.lang || 'Unknown'}`);
                    console.log(`   Content preview: ${(point.payload?.content || '').substring(0, 100)}...`);

                    return {
                        hasData: true,
                        collectionName,
                        pointsCount: data.result?.status?.points_count || 0,
                        vectorSize: data.result?.config?.params?.vectors?.vector?.size
                    };
                } else {
                    console.log('⚠️  Collection exists but appears to be empty');
                    return { hasData: false, collectionName, pointsCount: 0 };
                }
            } else {
                console.log('⚠️  Could not retrieve sample points');
                return { hasData: false, collectionName };
            }
        } else {
            console.log(`❌ Failed to get collection info: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error('❌ Error checking collection:', error.message);
        return null;
    }
}

async function testAlternativeEmbedding() {
    console.log('\n🔍 Testing alternative embedding methods...');

    // Check if we can use EmbeddingMonster (local embeddings)
    try {
        console.log('📋 Checking for local embedding services...');

        // Test GTE service (port 30001)
        const gteResponse = await fetch('http://localhost:30001/health', {
            timeout: 2000
        }).catch(() => ({ ok: false }));

        // Test CodeRank service (port 30002)
        const codeRankResponse = await fetch('http://localhost:30002/health', {
            timeout: 2000
        }).catch(() => ({ ok: false }));

        console.log(`   GTE service (port 30001): ${gteResponse.ok ? '✅ Running' : '❌ Not available'}`);
        console.log(`   CodeRank service (port 30002): ${codeRankResponse.ok ? '✅ Running' : '❌ Not available'}`);

        if (gteResponse.ok || codeRankResponse.ok) {
            console.log('💡 You can use local embeddings instead of OpenAI!');
            return true;
        }

        return false;
    } catch (error) {
        console.log('❌ Error checking local services:', error.message);
        return false;
    }
}

async function provideSolutions(collectionInfo) {
    console.log('\n💡 SOLUTIONS FOR YOUR RETRIEVAL ISSUE:');

    if (!collectionInfo) {
        console.log('❌ Could not access collection details');
        return;
    }

    if (!collectionInfo.hasData) {
        console.log('🔍 ISSUE: Collection exists but is empty');
        console.log('');
        console.log('SOLUTION 1: Index a repository');
        console.log('You need to add documents to your collection. Use one of these methods:');
        console.log('');
        console.log('Method A - Use the Context API (recommended):');
        console.log('```javascript');
        console.log('const { Context, EmbeddingMonster, QdrantVectorDatabase } = require("./dist/index.js");');
        console.log('');
        console.log('const context = new Context({');
        console.log('  embedding: new EmbeddingMonster({ model: "gte" }), // or "coderank"');
        console.log('  vectorDatabase: new QdrantVectorDatabase({');
        console.log('    url: "http://localhost:6333"');
        console.log('  })');
        console.log('});');
        console.log('');
        console.log('// Index your repository');
        console.log('context.indexCodebase("/path/to/your/repository")');
        console.log('  .then(result => console.log("Indexed:", result))');
        console.log('  .catch(console.error);');
        console.log('```');
        console.log('');

        console.log('Method B - Use environment variables:');
        console.log('```bash');
        console.log('# Set your embedding method');
        console.log('export EMBEDDING_PROVIDER="embedding-monster"  # or "openai"');
        console.log('export EMBEDDING_MONSTER_MODEL="gte"        # or "coderank"');
        console.log('export OPENAI_API_KEY="your-openai-key"     # if using OpenAI');
        console.log('');
        console.log('# Run indexing');
        console.log('node -e "');
        console.log('const { Context } = require(\'./dist/index.js\');');
        console.log('const context = new Context();');
        console.log('context.indexCodebase(\\"/path/to/repo\\").then(console.log);');
        console.log('"');
        console.log('```');
    } else {
        console.log('✅ Collection has data! The issue might be:');
        console.log('');
        console.log('1. EMBEDDING MISMATCH: The documents were indexed with a different embedding model');
        console.log(`   - Collection uses ${collectionInfo.vectorSize || 'unknown'} dimensions`);
        console.log('   - Make sure you use the same embedding model for search');
        console.log('');
        console.log('2. QUERY OR PATH ISSUES:');
        console.log('   - Check your search query matches the content');
        console.log('   - Verify the codebase path is correct');
        console.log('   - Try lowering the similarity threshold');
        console.log('');
        console.log('3. Try this test search:');
        console.log('```javascript');
        console.log('const testSearch = async () => {');
        console.log('  const { Context, EmbeddingMonster, QdrantVectorDatabase } = require("./dist/index.js");');
        console.log('  ');
        console.log('  const context = new Context({');
        console.log('    embedding: new EmbeddingMonster({ model: "gte" }),');
        console.log('    vectorDatabase: new QdrantVectorDatabase({ url: "http://localhost:6333" })');
        console.log('  });');
        console.log('  ');
        console.log('  // Use the actual path where the repository was indexed');
        console.log('  const results = await context.semanticSearch(');
        console.log('    "/path/to/original/repo",');
        console.log('    "function", // simple query');
        console.log('    5,        // topK');
        console.log('    0.1      // low threshold');
        console.log('  );');
        console.log('  ');
        console.log('  console.log("Results:", results);');
        console.log('};');
        console.log('testSearch();');
        console.log('```');
    }
}

async function main() {
    const collectionInfo = await checkCollectionDetails();
    const hasLocalEmbedding = await testAlternativeEmbedding();

    await provideSolutions(collectionInfo);

    if (!hasLocalEmbedding && !process.env.OPENAI_API_KEY) {
        console.log('');
        console.log('🚀 QUICK SETUP OPTIONS:');
        console.log('');
        console.log('Option 1: Use OpenAI (Easy)');
        console.log('```bash');
        console.log('export OPENAI_API_KEY="your-openai-api-key"');
        console.log('node -e "');
        console.log('const { Context, OpenAIEmbedding, QdrantVectorDatabase } = require(\'./dist/index.js\');');
        console.log('const context = new Context({');
        console.log('  embedding: new OpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),');
        console.log('  vectorDatabase: new QdrantVectorDatabase({ url: \'http://localhost:6333\' })');
        console.log('});');
        console.log('context.indexCodebase(\\"/path/to/your/repo\\").then(console.log);');
        console.log('"');
        console.log('```');
        console.log('');
        console.log('Option 2: Use local EmbeddingMonster (Free)');
        console.log('Start the services first, then use the code shown above.');
    }
}

main().catch(console.error);