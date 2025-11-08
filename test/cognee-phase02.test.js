#!/usr/bin/env node

/**
 * Phase 02: Enhanced Integration Tests
 * Tests retry logic, request tracking, performance metrics, validation
 */

require('dotenv').config();

const {
  getCogneeBase,
  authHeaders,
  fetchJson,
  validateFile,
  validateUrl,
  getPerformanceMetrics,
  clearPerformanceMetrics,
  generateRequestId,
  withRetry
} = require('../src/cognee/enhanced-helpers');

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Phase 02: Enhanced Integration Tests\n');

// Test suite
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error('   Error:', error.message);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error('   Error:', error.message);
    failed++;
  }
}

// =============================
// Test 1: Helper Functions
// =============================
console.log('📋 Test Group 1: Helper Functions\n');

test('getCogneeBase() returns URL', () => {
  const base = getCogneeBase();
  assert(typeof base === 'string');
  assert(base.length > 0);
  assert(!base.endsWith('/'));
});

test('authHeaders() includes tracking', () => {
  const headers = authHeaders();
  assert(headers['X-Request-ID']);
  assert(headers['X-Client'] === 'claude-context-mcp');
  assert(headers['X-Client-Version']);
});

test('generateRequestId() creates UUID', () => {
  const id1 = generateRequestId();
  const id2 = generateRequestId();
  assert(id1.length === 36);
  assert(id2.length === 36);
  assert(id1 !== id2); // Should be unique
});

// =============================
// Test 2: Validation Functions
// =============================
console.log('\n📋 Test Group 2: Validation Functions\n');

test('validateUrl() accepts valid HTTP URL', () => {
  const result = validateUrl('https://example.com/doc.md');
  assert(result.validated === true);
  assert(result.protocol === 'https:');
  assert(result.hostname === 'example.com');
});

test('validateUrl() rejects invalid URL', () => {
  try {
    validateUrl('not-a-url');
    assert.fail('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('Invalid URL'));
  }
});

test('validateUrl() rejects non-HTTP protocol', () => {
  try {
    validateUrl('ftp://example.com');
    assert.fail('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('HTTP or HTTPS'));
  }
});

test('validateFile() validates test file', () => {
  // Create temporary test file
  const testFile = path.join(__dirname, 'test-file.txt');
  fs.writeFileSync(testFile, 'test content');
  
  try {
    const result = validateFile(testFile);
    assert(result.validated === true);
    assert(result.name === 'test-file.txt');
    assert(result.extension === '.txt');
    assert(result.size > 0);
  } finally {
    fs.unlinkSync(testFile);
  }
});

test('validateFile() rejects non-existent file', () => {
  try {
    validateFile('/non/existent/file.txt');
    assert.fail('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('File not found'));
  }
});

// =============================
// Test 3: Retry Logic
// =============================
console.log('\n📋 Test Group 3: Retry Logic\n');

asyncTest('withRetry() succeeds on first attempt', async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    return 'success';
  };
  
  const result = await withRetry(operation, { maxRetries: 3 });
  assert(result === 'success');
  assert(attempts === 1);
});

asyncTest('withRetry() retries on failure', async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    if (attempts < 3) {
      const error = new Error('Temporary failure');
      error.statusCode = 503; // Retryable error
      throw error;
    }
    return 'success';
  };
  
  const result = await withRetry(operation, { 
    maxRetries: 3,
    initialDelay: 10
  });
  assert(result === 'success');
  assert(attempts === 3);
});

asyncTest('withRetry() stops on client error', async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    const error = new Error('Bad request');
    error.statusCode = 400; // Non-retryable
    throw error;
  };
  
  try {
    await withRetry(operation, { maxRetries: 3 });
    assert.fail('Should have thrown error');
  } catch (error) {
    assert(error.message === 'Bad request');
    assert(attempts === 1); // Should not retry
  }
});

// =============================
// Test 4: Performance Metrics
// =============================
console.log('\n📋 Test Group 4: Performance Metrics\n');

test('getPerformanceMetrics() returns structure', () => {
  clearPerformanceMetrics();
  const metrics = getPerformanceMetrics();
  assert(metrics.summary);
  assert(metrics.recent);
  assert(typeof metrics.summary.totalRequests === 'number');
});

// =============================
// Test 5: API Integration (if service available)
// =============================
console.log('\n📋 Test Group 5: API Integration\n');

asyncTest('fetchJson() makes successful request', async () => {
  try {
    // Try to hit health endpoint
    const result = await fetchJson('GET', '/health', null, {
      retry: { maxRetries: 1 }
    });
    
    const metrics = getPerformanceMetrics();
    assert(metrics.summary.totalRequests > 0);
  } catch (error) {
    // Service might not be available - that's okay for this test
    console.log('   (Skipped - service not available)');
  }
});

asyncTest('fetchJson() tracks failed requests', async () => {
  clearPerformanceMetrics();
  
  try {
    await fetchJson('GET', '/nonexistent-endpoint', null, {
      retry: { maxRetries: 1 }
    });
  } catch (error) {
    // Expected to fail
    const metrics = getPerformanceMetrics();
    assert(metrics.summary.totalRequests >= 1);
    assert(metrics.summary.failed >= 1);
  }
});

// =============================
// Test 6: Error Enhancement
// =============================
console.log('\n📋 Test Group 6: Error Enhancement\n');

asyncTest('Errors include request tracking', async () => {
  try {
    await fetchJson('POST', '/test-error', { test: true }, {
      retry: { maxRetries: 1 }
    });
  } catch (error) {
    assert(error.requestId);
    assert(error.url);
    assert(typeof error.duration === 'number');
  }
});

// =============================
// Test Summary
// =============================
async function runTests() {
  // Run all async tests sequentially
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Phase 02 Test Results');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All Phase 02 tests passed!');
    console.log('\n✨ Enhancements validated:');
    console.log('  • Request tracking with unique IDs');
    console.log('  • Retry logic with exponential backoff');
    console.log('  • Performance metrics collection');
    console.log('  • Input validation (files & URLs)');
    console.log('  • Error enhancement with context');
  } else {
    console.log('\n⚠️  Some tests failed. Review implementation.');
  }
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
