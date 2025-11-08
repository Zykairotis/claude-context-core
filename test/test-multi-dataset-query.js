#!/usr/bin/env node
/**
 * Test script for multi-dataset query functionality
 * Tests querying across multiple datasets in different projects
 */

const axios = require('axios');
const { Context } = require('../dist/context');
const { queryMultipleDatasets } = require('../dist/api/query-multi-dataset');

const API_BASE = process.env.API_URL || 'http://localhost:3030';

// Test configuration
const TEST_DATASETS = [
  { project: 'frontend', dataset: 'components' },
  { project: 'backend', dataset: 'api' },
  { project: 'docs', dataset: 'guides' }
];

const TEST_QUERY = 'authentication user login';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test multi-dataset query via REST API
 */
async function testRestApiMultiQuery() {
  log('\n🧪 Testing Multi-Dataset Query via REST API...', 'blue');
  
  try {
    const response = await axios.post(`${API_BASE}/api/query/multi`, {
      datasets: TEST_DATASETS,
      query: TEST_QUERY,
      topK: 10,
      threshold: 0.4,
      rerank: true,
      hybridSearch: true
    });

    log('✅ Multi-dataset query successful', 'green');
    log(`📊 Results: ${response.data.results.length} matches found`, 'yellow');
    log(`📈 Datasets queried: ${response.data.metadata.datasetsQueried}`, 'yellow');
    
    // Display top results
    if (response.data.results.length > 0) {
      log('\nTop 3 Results:', 'blue');
      response.data.results.slice(0, 3).forEach((result, idx) => {
        log(`\n${idx + 1}. Score: ${result.score.toFixed(3)}`, 'yellow');
        if (result.dataset) {
          log(`   Dataset: ${result.dataset.project}/${result.dataset.dataset}`, 'gray');
        }
        log(`   Content: ${result.document.content.substring(0, 150)}...`, 'gray');
      });
    }

    return response.data;
  } catch (error) {
    log(`❌ REST API test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
    throw error;
  }
}

/**
 * Test pattern-based dataset query
 */
async function testPatternQuery() {
  log('\n🧪 Testing Pattern-Based Dataset Query...', 'blue');
  
  try {
    const response = await axios.post(`${API_BASE}/api/query/pattern`, {
      datasetPattern: '%doc%',  // Match datasets containing 'doc'
      projectPattern: '%end%',  // Match projects containing 'end'
      query: TEST_QUERY,
      topK: 5
    });

    log('✅ Pattern query successful', 'green');
    log(`📊 Results: ${response.data.results.length} matches found`, 'yellow');
    
    return response.data;
  } catch (error) {
    log(`❌ Pattern query test failed: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Test dataset statistics endpoint
 */
async function testDatasetStats() {
  log('\n🧪 Testing Dataset Statistics...', 'blue');
  
  try {
    const response = await axios.post(`${API_BASE}/api/query/stats`, {
      datasets: TEST_DATASETS
    });

    log('✅ Statistics query successful', 'green');
    log(`📊 Total chunks: ${response.data.totalChunks}`, 'yellow');
    log(`📄 Total pages: ${response.data.totalPages}`, 'yellow');
    log(`🗂️ Datasets found: ${response.data.datasetsFound}`, 'yellow');
    
    if (response.data.stats.length > 0) {
      log('\nDataset Details:', 'blue');
      response.data.stats.forEach(stat => {
        log(`\n  ${stat.projectName}/${stat.datasetName}:`, 'yellow');
        log(`    Chunks: ${stat.chunkCount}`, 'gray');
        log(`    Pages: ${stat.pageCount}`, 'gray');
        if (stat.lastIndexed) {
          log(`    Last indexed: ${stat.lastIndexed}`, 'gray');
        }
      });
    }

    return response.data;
  } catch (error) {
    log(`❌ Statistics test failed: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Test listing all available datasets
 */
async function testListDatasets() {
  log('\n🧪 Testing List All Datasets...', 'blue');
  
  try {
    const response = await axios.get(`${API_BASE}/api/query/datasets`, {
      params: {
        includeEmpty: false
      }
    });

    log('✅ Dataset listing successful', 'green');
    log(`📊 Total datasets: ${response.data.total}`, 'yellow');
    log(`🗂️ Projects: ${response.data.projects.join(', ')}`, 'yellow');
    
    // Group by project
    const byProject = {};
    response.data.datasets.forEach(ds => {
      if (!byProject[ds.project]) {
        byProject[ds.project] = [];
      }
      byProject[ds.project].push(ds);
    });

    log('\nDatasets by Project:', 'blue');
    Object.entries(byProject).forEach(([project, datasets]) => {
      log(`\n  ${project}:`, 'yellow');
      datasets.forEach(ds => {
        log(`    - ${ds.dataset} (${ds.chunkCount} chunks, ${ds.pageCount} pages)`, 'gray');
      });
    });

    return response.data;
  } catch (error) {
    log(`❌ Dataset listing failed: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Test direct SDK usage (if running locally)
 */
async function testDirectSdkQuery() {
  log('\n🧪 Testing Direct SDK Multi-Dataset Query...', 'blue');
  
  try {
    // Initialize context
    const context = new Context({
      postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:code-context-secure-password@localhost:5533/claude_context',
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      enableReranking: true,
      enableHybridSearch: true
    });

    await context.init({
      project: 'test-project',
      dataset: 'test-dataset'
    });

    // Perform multi-dataset query
    const result = await queryMultipleDatasets(
      context,
      {
        datasets: TEST_DATASETS,
        query: TEST_QUERY,
        topK: 5,
        threshold: 0.5,
        rerank: true
      },
      (phase, progress, message) => {
        log(`  [${phase}] ${progress}% - ${message}`, 'gray');
      }
    );

    log('✅ SDK query successful', 'green');
    log(`📊 Results: ${result.results.length} matches found`, 'yellow');
    
    await context.close();
    return result;
  } catch (error) {
    log(`❌ SDK test failed: ${error.message}`, 'red');
    // SDK test is optional, don't throw
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🚀 Multi-Dataset Query Test Suite', 'blue');
  log('='.repeat(60), 'blue');

  const results = {
    restApiQuery: false,
    patternQuery: false,
    datasetStats: false,
    listDatasets: false,
    sdkQuery: false
  };

  try {
    // Test 1: Multi-dataset query
    try {
      await testRestApiMultiQuery();
      results.restApiQuery = true;
    } catch (e) {
      // Continue with other tests
    }

    // Test 2: Pattern-based query
    try {
      await testPatternQuery();
      results.patternQuery = true;
    } catch (e) {
      // Continue with other tests
    }

    // Test 3: Dataset statistics
    try {
      await testDatasetStats();
      results.datasetStats = true;
    } catch (e) {
      // Continue with other tests
    }

    // Test 4: List datasets
    try {
      await testListDatasets();
      results.listDatasets = true;
    } catch (e) {
      // Continue with other tests
    }

    // Test 5: Direct SDK (optional)
    try {
      await testDirectSdkQuery();
      results.sdkQuery = true;
    } catch (e) {
      // SDK test is optional
    }

  } catch (error) {
    log(`\n❌ Test suite encountered an error: ${error.message}`, 'red');
  }

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 Test Results Summary', 'blue');
  log('='.repeat(60), 'blue');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`, color);
  });

  log(`\n📈 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed < total - 1) {  // -1 for optional SDK test
    log('\n⚠️ Some required tests failed. Please check the API server is running.', 'yellow');
    log('Start the API server with: docker-compose up api-server', 'gray');
  } else {
    log('\n🎉 All required tests passed successfully!', 'green');
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  testRestApiMultiQuery,
  testPatternQuery,
  testDatasetStats,
  testListDatasets,
  testDirectSdkQuery,
  runTests
};
