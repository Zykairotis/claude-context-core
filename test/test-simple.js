// Simple test to check basic functionality without UI components
const fs = require('fs');
const path = require('path');

async function testBasicFunctionality() {
    console.log('🔍 Testing basic functionality...');

    // Check if we have any environment variables set
    console.log('📋 Environment variables:');
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`   QDRANT_URL: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
    console.log(`   HYBRID_MODE: ${process.env.HYBRID_MODE || 'true (default)'}`);
    console.log(`   ENABLE_HYBRID_SEARCH: ${process.env.ENABLE_HYBRID_SEARCH || 'false (default)'}`);
    console.log(`   ENABLE_RERANKING: ${process.env.ENABLE_RERANKING || 'false (default)'}`);

    // Check if dist files exist
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
        console.log('❌ Dist directory not found. Run npm run build first.');
        return false;
    }

    // List compiled files
    const distFiles = fs.readdirSync(distDir);
    console.log(`📦 Found dist files: ${distFiles.length} files`);
    distFiles.forEach(file => {
        console.log(`   - ${file}`);
    });

    // Check if we can import core modules without UI components
    try {
        // Try to import just the types and core vector db functionality
        const typesPath = path.join(__dirname, 'dist', 'vectordb', 'types.js');
        const qdrantPath = path.join(__dirname, 'dist', 'vectordb', 'qdrant-vectordb.js');
        const embeddingPath = path.join(__dirname, 'dist', 'embedding', 'openai-embedding.js');

        console.log('🔍 Checking core modules:');
        console.log(`   types.js exists: ${fs.existsSync(typesPath)}`);
        console.log(`   qdrant-vectordb.js exists: ${fs.existsSync(qdrantPath)}`);
        console.log(`   openai-embedding.js exists: ${fs.existsSync(embeddingPath)}`);

        return true;
    } catch (error) {
        console.error('❌ Error checking modules:', error.message);
        return false;
    }
}

async function checkVectorDatabaseConnection() {
    console.log('🔍 Testing vector database connection...');

    try {
        // Simple HTTP request to Qdrant
        const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
        const response = await fetch(`${qdrantUrl}/collections`);

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Connected to Qdrant successfully`);
            console.log(`📚 Found ${data.result?.collections?.length || 0} collections:`);
            data.result?.collections?.forEach(col => {
                console.log(`   - ${col.name}`);
            });
            return true;
        } else {
            console.log(`❌ Qdrant connection failed: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Cannot connect to Qdrant: ${error.message}`);
        console.log('💡 Make sure Qdrant is running on the expected URL');
        return false;
    }
}

async function checkOpenAIConnection() {
    console.log('🔍 Testing OpenAI connection...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'test-key') {
        console.log('⚠️  OpenAI API key not configured or using test key');
        console.log('💡 Set OPENAI_API_KEY environment variable to test embeddings');
        return false;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: 'test',
                model: 'text-embedding-3-small'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ OpenAI connection successful`);
            console.log(`📏 Embedding dimension: ${data.data[0].embedding.length}`);
            return true;
        } else {
            console.log(`❌ OpenAI connection failed: ${response.status} ${response.statusText}`);
            const errorData = await response.json().catch(() => ({}));
            console.log(`   Error: ${errorData.error?.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Cannot connect to OpenAI: ${error.message}`);
        return false;
    }
}

async function diagnoseRetrievalIssue() {
    console.log('🔍 Diagnosing retrieval issues...\n');

    const basicOk = await testBasicFunctionality();
    console.log('');

    const qdrantOk = await checkVectorDatabaseConnection();
    console.log('');

    const openaiOk = await checkOpenAIConnection();
    console.log('');

    console.log('📊 Diagnosis Summary:');
    console.log(`   Basic functionality: ${basicOk ? '✅ OK' : '❌ ISSUE'}`);
    console.log(`   Vector database: ${qdrantOk ? '✅ OK' : '❌ ISSUE'}`);
    console.log(`   OpenAI connection: ${openaiOk ? '✅ OK' : '❌ ISSUE'}`);

    if (!basicOk) {
        console.log('\n💡 Recommended fixes:');
        console.log('   1. Run npm run build to compile TypeScript');
        console.log('   2. Check for compilation errors in the build output');
    }

    if (!qdrantOk) {
        console.log('\n💡 Vector database fixes:');
        console.log('   1. Make sure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant');
        console.log('   2. Check QDRANT_URL environment variable');
        console.log('   3. Verify firewall settings');
    }

    if (!openaiOk) {
        console.log('\n💡 OpenAI fixes:');
        console.log('   1. Set OPENAI_API_KEY environment variable');
        console.log('   2. Check API key is valid and has credits');
        console.log('   3. Verify network connection to api.openai.com');
    }

    if (basicOk && qdrantOk && openaiOk) {
        console.log('\n✅ All components are working! The issue might be:');
        console.log('   1. No repository has been indexed yet');
        console.log('   2. Collection name mismatch');
        console.log('   3. Embedding dimension mismatch');
        console.log('   4. Search query doesn\'t match indexed content');
        console.log('\n💡 Try indexing a repository first:');
        console.log('   node -e "');
        console.log('   const { Context, OpenAIEmbedding, QdrantVectorDatabase } = require(\'./dist/index.js\');');
        console.log('   const context = new Context({');
        console.log('     embedding: new OpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),');
        console.log('     vectorDatabase: new QdrantVectorDatabase({ url: \\"http://localhost:6333\\" })');
        console.log('   });');
        console.log('   context.indexCodebase(\\"/path/to/repo\\").then(console.log);');
        console.log('   "');
    }
}

// Run the diagnosis
diagnoseRetrievalIssue().catch(console.error);