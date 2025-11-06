// Test incremental sync through MCP
const http = require('http');

function testSync() {
  console.log('Testing incremental sync via API...');
  
  const data = JSON.stringify({ path: '/home/mewtwo/testx' });
  
  const options = {
    hostname: 'localhost',
    port: 3030,
    path: '/projects/test-mcp/ingest/local/sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      const result = JSON.parse(responseData);
      console.log('\nSync Results:');
      console.log(`✅ Status: ${result.status}`);
      console.log(`📁 Files scanned: ${result.stats.filesScanned}`);
      console.log(`➕ Created: ${result.stats.filesCreated}`);
      console.log(`✏️  Modified: ${result.stats.filesModified}`);
      console.log(`🗑️  Deleted: ${result.stats.filesDeleted}`);
      console.log(`⚡ Unchanged: ${result.stats.filesUnchanged}`);
      console.log(`⏱️  Duration: ${result.stats.durationMs}ms`);
      
      if (result.stats.filesUnchanged === result.stats.filesScanned) {
        console.log('\n✨ Perfect! No changes detected - sync is super fast!');
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Error:', error.message);
  });
  
  req.write(data);
  req.end();
}

testSync();
