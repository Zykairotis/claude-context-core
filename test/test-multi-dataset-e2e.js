#!/usr/bin/env node
/**
 * End-to-End Integration Tests for Multi-Dataset Search
 * Tests the complete multi-dataset search system including:
 * - Phase 1: Basic multi-dataset support (arrays, wildcards, globs)
 * - Phase 2: Semantic aliases (env:dev, src:code, etc.)
 * - Phase 3: MCP tool integration
 * 
 * This validates the entire system works together correctly.
 */

// Load compiled JavaScript modules
const { DatasetParser } = require('../dist/utils/dataset-parser.js');
const { PatternLibrary } = require('../dist/utils/pattern-library.js');

// Test configuration
const config = {
  postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:code-context-secure-password@localhost:5533/claude_context',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  project: 'test-e2e',
  verbose: process.argv.includes('--verbose')
};

// Test utilities
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test state
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  const startTime = Date.now();
  
  try {
    await fn();
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✓${colors.reset} (${duration}ms)`);
    testsPassed++;
    testResults.push({ name, passed: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`${colors.red}✗${colors.reset}`);
    log(`    Error: ${error.message}`, 'red');
    if (config.verbose && error.stack) {
      log(`    ${error.stack.split('\n').slice(1, 3).join('\n    ')}`, 'gray');
    }
    testsFailed++;
    testResults.push({ name, passed: false, duration, error: error.message });
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

// ========================================
// Test Group 1: Dataset Parser
// ========================================
async function testDatasetParser() {
  log('\n📋 Test Group 1: Dataset Parser (Phase 1)', 'blue');
  
  const testDatasets = [
    'local',
    'docs',
    'api-dev',
    'api-prod',
    'db-dev',
    'db-prod',
    'github-main',
    'github-dev',
    'github-feature-auth',
    'crawl-docs-site'
  ];

  await test('parses single dataset name', () => {
    const result = DatasetParser.parse('local', testDatasets);
    assert(result.length === 1, 'Should return 1 dataset');
    assert(result[0] === 'local', 'Should be local');
  });

  await test('parses array of dataset names', () => {
    const result = DatasetParser.parse(['local', 'docs', 'api-dev'], testDatasets);
    assert(result.length === 3, 'Should return 3 datasets');
    assert(result.includes('local'), 'Should include local');
    assert(result.includes('docs'), 'Should include docs');
  });

  await test('expands wildcard to all datasets', () => {
    const result = DatasetParser.parse('*', testDatasets);
    assert(result.length === testDatasets.length, 'Should match all datasets');
  });

  await test('matches glob pattern github-*', () => {
    const result = DatasetParser.parse('github-*', testDatasets);
    assert(result.length === 3, 'Should match 3 github datasets');
    assert(result.includes('github-main'), 'Should include github-main');
    assert(result.includes('github-dev'), 'Should include github-dev');
    assert(result.includes('github-feature-auth'), 'Should include github-feature-auth');
  });

  await test('matches glob pattern *-prod', () => {
    const result = DatasetParser.parse('*-prod', testDatasets);
    assert(result.length === 2, 'Should match 2 prod datasets');
    assert(result.includes('api-prod'), 'Should include api-prod');
    assert(result.includes('db-prod'), 'Should include db-prod');
  });

  await test('matches glob pattern api-?', () => {
    const result = DatasetParser.parse('api-???', testDatasets);
    assert(result.length === 2, 'Should match 2 api datasets');
  });

  await test('deduplicates results', () => {
    const result = DatasetParser.parse(['local', 'local', 'docs'], testDatasets);
    assert(result.length === 2, 'Should deduplicate');
    assert(result.includes('local'), 'Should include local once');
  });

  await test('returns empty for non-existent dataset', () => {
    const result = DatasetParser.parse('non-existent', testDatasets);
    assert(result.length === 0, 'Should return empty array');
  });

  await test('handles undefined as all datasets', () => {
    const result = DatasetParser.parse(undefined, testDatasets);
    assert(result.length === testDatasets.length, 'Should return all datasets');
  });

  await test('handles empty array as all datasets', () => {
    const result = DatasetParser.parse([], testDatasets);
    assert(result.length === testDatasets.length, 'Should return all datasets');
  });
}

// ========================================
// Test Group 2: Pattern Library
// ========================================
async function testPatternLibrary() {
  log('\n📋 Test Group 2: Pattern Library (Phase 2)', 'cyan');
  
  const testDatasets = [
    'local',
    'api-dev',
    'api-prod',
    'db-dev',
    'db-prod',
    'github-main',
    'github-dev',
    'crawl-docs-site',
    'app-v1',
    'app-v2',
    'app-v3',
    'lib-v1-beta',
    'repo-main',
    'repo-feature-x'
  ];

  await test('recognizes semantic alias env:dev', () => {
    assert(PatternLibrary.isAlias('env:dev'), 'Should recognize env:dev');
  });

  await test('recognizes semantic alias src:code', () => {
    assert(PatternLibrary.isAlias('src:code'), 'Should recognize src:code');
  });

  await test('recognizes semantic alias ver:latest', () => {
    assert(PatternLibrary.isAlias('ver:latest'), 'Should recognize ver:latest');
  });

  await test('expands env:dev to development datasets', () => {
    const result = DatasetParser.parse('env:dev', testDatasets);
    assert(result.includes('api-dev'), 'Should include api-dev');
    assert(result.includes('db-dev'), 'Should include db-dev');
    assert(result.includes('github-dev'), 'Should include github-dev');
  });

  await test('expands env:prod to production datasets', () => {
    const result = DatasetParser.parse('env:prod', testDatasets);
    assert(result.includes('api-prod'), 'Should include api-prod');
    assert(result.includes('db-prod'), 'Should include db-prod');
  });

  await test('expands src:code to code repositories', () => {
    const result = DatasetParser.parse('src:code', testDatasets);
    assert(result.includes('local'), 'Should include local');
    assert(result.includes('github-main'), 'Should include github-main');
    assert(result.includes('github-dev'), 'Should include github-dev');
  });

  await test('expands ver:stable filters out pre-release', () => {
    const result = DatasetParser.parse('ver:stable', testDatasets);
    assert(result.includes('app-v1'), 'Should include app-v1');
    assert(result.includes('app-v2'), 'Should include app-v2');
    assert(!result.includes('lib-v1-beta'), 'Should exclude lib-v1-beta');
  });

  await test('expands branch:main to main branches', () => {
    const result = DatasetParser.parse('branch:main', testDatasets);
    assert(result.includes('github-main'), 'Should include github-main');
    assert(result.includes('repo-main'), 'Should include repo-main');
  });

  await test('combines semantic alias with exact match', () => {
    const result = DatasetParser.parse(['env:dev', 'local'], testDatasets);
    assert(result.includes('local'), 'Should include local');
    assert(result.includes('api-dev'), 'Should include api-dev from env:dev');
  });

  await test('combines semantic alias with glob pattern', () => {
    const result = DatasetParser.parse(['env:prod', 'github-*'], testDatasets);
    assert(result.includes('api-prod'), 'Should include api-prod from env:prod');
    assert(result.includes('github-main'), 'Should include github-main from github-*');
  });

  await test('lists all available patterns', () => {
    const patterns = PatternLibrary.listAliases();
    assert(patterns.length > 0, 'Should have patterns');
    assert(patterns[0].pattern, 'Should have pattern property');
    assert(patterns[0].name, 'Should have name property');
    assert(patterns[0].description, 'Should have description property');
  });

  await test('suggests patterns for available datasets', () => {
    const suggestions = PatternLibrary.suggestPatterns(testDatasets);
    assert(suggestions.length > 0, 'Should have suggestions');
    assert(suggestions[0].matchCount > 0, 'Should have match count');
  });
}

// ========================================
// Test Group 3: MCP Tool Helpers
// ========================================
async function testMCPToolHelpers() {
  log('\n📋 Test Group 3: MCP Tool Helpers (Phase 3)', 'cyan');
  
  const {
    expandDatasetPattern,
    validateDatasetInput,
    formatDatasetExpansion,
    createPatternGuide
  } = require('../dist/api/mcp-tools.js');
  
  const testDatasets = ['local', 'api-dev', 'api-prod', 'github-main'];

  await test('expandDatasetPattern returns expansion info', () => {
    const result = expandDatasetPattern('*', testDatasets);
    assert(result.requested === '*', 'Should track requested pattern');
    assert(result.resolved.length === testDatasets.length, 'Should resolve all');
    assert(result.matchCount === testDatasets.length, 'Should have correct count');
  });

  await test('validateDatasetInput accepts valid dataset', () => {
    const result = validateDatasetInput('local', testDatasets);
    assert(result.valid === true, 'Should be valid');
  });

  await test('validateDatasetInput rejects invalid dataset', () => {
    const result = validateDatasetInput('non-existent', testDatasets);
    assert(result.valid === false, 'Should be invalid');
    assert(result.message, 'Should have error message');
  });

  await test('validateDatasetInput suggests corrections', () => {
    const result = validateDatasetInput('env:prodction', testDatasets);
    assert(result.valid === false, 'Should be invalid');
    assert(result.suggestions, 'Should have suggestions');
    assert(result.suggestions.length > 0, 'Should suggest alternatives');
  });

  await test('formatDatasetExpansion formats wildcard', () => {
    const expansion = expandDatasetPattern('*', testDatasets);
    const formatted = formatDatasetExpansion(expansion);
    assert(formatted.includes('Wildcard'), 'Should mention wildcard');
    assert(formatted.includes(testDatasets.length.toString()), 'Should show count');
  });

  await test('formatDatasetExpansion formats semantic alias', () => {
    const expansion = expandDatasetPattern('env:dev', testDatasets);
    const formatted = formatDatasetExpansion(expansion);
    assert(formatted.includes('Pattern'), 'Should mention pattern');
    assert(formatted.includes('env:dev'), 'Should show pattern name');
  });

  await test('createPatternGuide creates comprehensive guide', () => {
    const guide = createPatternGuide();
    assert(guide.includes('Dataset Pattern Guide'), 'Should have title');
    assert(guide.includes('env:dev'), 'Should include example patterns');
    assert(guide.includes('src:code'), 'Should include source patterns');
    assert(guide.includes('github-*'), 'Should include glob examples');
  });
}

// ========================================
// Test Group 4: Performance Benchmarks
// ========================================
async function testPerformance() {
  log('\n📋 Test Group 4: Performance Benchmarks', 'cyan');
  
  const largeDatasetList = Array.from({ length: 1000 }, (_, i) => `dataset-${i}`);

  await test('DatasetParser handles 1000 datasets quickly', () => {
    const start = Date.now();
    DatasetParser.parse('dataset-5*', largeDatasetList);
    const duration = Date.now() - start;
    assert(duration < 100, `Should parse in <100ms, took ${duration}ms`);
  });

  await test('Wildcard expansion is fast', () => {
    const start = Date.now();
    DatasetParser.parse('*', largeDatasetList);
    const duration = Date.now() - start;
    assert(duration < 10, `Should expand in <10ms, took ${duration}ms`);
  });

  await test('Pattern matching is efficient', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      DatasetParser.parse('dataset-5*', largeDatasetList);
    }
    const duration = Date.now() - start;
    assert(duration < 500, `Should handle 100 iterations in <500ms, took ${duration}ms`);
  });

  await test('Semantic alias expansion is fast', () => {
    const testDatasets = Array.from({ length: 100 }, (_, i) => 
      i % 3 === 0 ? `api-dev-${i}` : i % 3 === 1 ? `api-prod-${i}` : `local-${i}`
    );
    
    const start = Date.now();
    DatasetParser.parse('env:dev', testDatasets);
    const duration = Date.now() - start;
    assert(duration < 50, `Should expand semantic alias in <50ms, took ${duration}ms`);
  });

  await test('Complex pattern combinations are fast', () => {
    const testDatasets = Array.from({ length: 200 }, (_, i) => `dataset-${i}`);
    
    const start = Date.now();
    DatasetParser.parse(['dataset-1*', 'dataset-2*', 'dataset-3*'], testDatasets);
    const duration = Date.now() - start;
    assert(duration < 100, `Should handle complex patterns in <100ms, took ${duration}ms`);
  });
}

// ========================================
// Test Group 5: Integration Scenarios
// ========================================
async function testIntegrationScenarios() {
  log('\n📋 Test Group 5: Integration Scenarios', 'cyan');
  
  const realWorldDatasets = [
    'local',
    'github-frontend-main',
    'github-backend-main',
    'github-backend-dev',
    'github-backend-feature-auth',
    'docs-api',
    'docs-user-guide',
    'api-prod-config',
    'api-dev-config',
    'db-prod-migration',
    'db-dev-migration',
    'crawl-stackoverflow',
    'app-v1.0.0',
    'app-v1.1.0-beta',
    'app-v2.0.0'
  ];

  await test('Scenario: Search all production systems', () => {
    const result = DatasetParser.parse('env:prod', realWorldDatasets);
    assert(result.includes('api-prod-config'), 'Should include prod config');
    assert(result.includes('db-prod-migration'), 'Should include prod DB');
  });

  await test('Scenario: Search all code repositories', () => {
    const result = DatasetParser.parse('src:code', realWorldDatasets);
    assert(result.includes('local'), 'Should include local');
    assert(result.includes('github-frontend-main'), 'Should include github repos');
  });

  await test('Scenario: Search backend + API docs', () => {
    const result = DatasetParser.parse(['github-backend-*', 'docs-api'], realWorldDatasets);
    assert(result.includes('github-backend-main'), 'Should include backend-main');
    assert(result.includes('github-backend-dev'), 'Should include backend-dev');
    assert(result.includes('docs-api'), 'Should include API docs');
  });

  await test('Scenario: Search only stable versions', () => {
    const result = DatasetParser.parse('ver:stable', realWorldDatasets);
    assert(result.includes('app-v1.0.0'), 'Should include stable v1');
    assert(result.includes('app-v2.0.0'), 'Should include stable v2');
    assert(!result.includes('app-v1.1.0-beta'), 'Should exclude beta');
  });

  await test('Scenario: Search production + docs', () => {
    const result = DatasetParser.parse(['env:prod', 'src:docs'], realWorldDatasets);
    assert(result.includes('api-prod-config'), 'Should include prod');
    assert(result.includes('docs-api'), 'Should include docs');
  });

  await test('Scenario: Complex multi-pattern search', () => {
    const result = DatasetParser.parse(
      ['local', 'github-backend-*', 'env:prod', 'docs-*'],
      realWorldDatasets
    );
    assert(result.includes('local'), 'Should include local');
    assert(result.includes('github-backend-main'), 'Should include backend repos');
    assert(result.includes('api-prod-config'), 'Should include prod from env:prod');
    assert(result.includes('docs-api'), 'Should include docs');
  });

  await test('Scenario: Feature branch development', () => {
    const result = DatasetParser.parse('branch:feature', realWorldDatasets);
    assert(result.includes('github-backend-feature-auth'), 'Should include feature branch');
  });

  await test('Scenario: Main branch only', () => {
    const result = DatasetParser.parse('branch:main', realWorldDatasets);
    assert(result.includes('github-frontend-main'), 'Should include frontend main');
    assert(result.includes('github-backend-main'), 'Should include backend main');
  });
}

// ========================================
// Test Group 6: Edge Cases & Validation
// ========================================
async function testEdgeCases() {
  log('\n📋 Test Group 6: Edge Cases & Validation', 'cyan');

  await test('handles empty dataset list', () => {
    const result = DatasetParser.parse('*', []);
    assert(result.length === 0, 'Should return empty array');
  });

  await test('handles special characters in dataset names', () => {
    const specialDatasets = ['dataset-v1.2', 'dataset_v2', 'dataset+test'];
    const result = DatasetParser.parse('dataset-v1.2', specialDatasets);
    assert(result.length === 1, 'Should match exact special chars');
  });

  await test('handles very long dataset names', () => {
    const longName = 'a'.repeat(200);
    const result = DatasetParser.parse(longName, [longName, 'short']);
    assert(result.length === 1, 'Should handle long names');
  });

  await test('handles case sensitivity correctly', () => {
    const datasets = ['Local', 'local', 'LOCAL'];
    const result = DatasetParser.parse('local', datasets);
    assert(result.includes('local'), 'Should be case-sensitive');
    assert(!result.includes('Local'), 'Should not match different case');
  });

  await test('handles overlapping patterns', () => {
    const datasets = ['api-dev', 'api-prod', 'db-dev'];
    const result = DatasetParser.parse(['api-*', '*-dev'], datasets);
    // Should deduplicate api-dev (matches both patterns)
    assert(result.includes('api-dev'), 'Should include api-dev once');
    assert(result.includes('api-prod'), 'Should include api-prod');
    assert(result.includes('db-dev'), 'Should include db-dev');
    const apiDevCount = result.filter(d => d === 'api-dev').length;
    assert(apiDevCount === 1, 'Should not duplicate api-dev');
  });

  await test('validates patterns without side effects', () => {
    const datasets = ['test1', 'test2'];
    const original = [...datasets];
    DatasetParser.parse('*', datasets);
    assert(JSON.stringify(datasets) === JSON.stringify(original), 'Should not mutate input');
  });

  await test('handles regex special characters in patterns', () => {
    const datasets = ['dataset.test', 'dataset+test', 'dataset[test]'];
    // Should not treat . as regex wildcard
    const result = DatasetParser.parse('dataset.test', datasets);
    assert(result.length === 1, 'Should match literal dot');
    assert(result[0] === 'dataset.test', 'Should match exact name');
  });
}

// ========================================
// Test Summary & Report
// ========================================
async function generateTestReport() {
  log('\n' + '='.repeat(70), 'blue');
  log('📊 Multi-Dataset Search E2E Test Results', 'blue');
  log('='.repeat(70), 'blue');
  
  const total = testsPassed + testsFailed;
  const successRate = total > 0 ? ((testsPassed / total) * 100).toFixed(2) : '0.00';
  
  log(`\n✅ Passed: ${testsPassed}/${total}`, testsFailed === 0 ? 'green' : 'yellow');
  log(`❌ Failed: ${testsFailed}/${total}`, testsFailed === 0 ? 'gray' : 'red');
  log(`📈 Success Rate: ${successRate}%`, testsFailed === 0 ? 'green' : 'yellow');
  
  // Performance metrics
  if (testResults.length > 0) {
    const durations = testResults.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    log(`\n⏱️  Performance Metrics:`, 'cyan');
    log(`   Average: ${Math.round(avgDuration)}ms`);
    log(`   Min: ${minDuration}ms`);
    log(`   Max: ${maxDuration}ms`);
  }
  
  // Component coverage
  log(`\n📦 Component Coverage:`, 'cyan');
  log(`   ✅ Phase 1: Dataset Parser (basic patterns)`);
  log(`   ✅ Phase 2: Pattern Library (semantic aliases)`);
  log(`   ✅ Phase 3: MCP Tool Helpers`);
  log(`   ✅ Performance Benchmarks`);
  log(`   ✅ Integration Scenarios`);
  log(`   ✅ Edge Cases & Validation`);
  
  if (testsFailed === 0) {
    log('\n🎉 All E2E tests passed!', 'green');
    log('\n✨ System Validation Complete:', 'cyan');
    log('  • Dataset parser working correctly');
    log('  • Pattern library functional');
    log('  • Semantic aliases expanding properly');
    log('  • MCP tool helpers validated');
    log('  • Performance acceptable');
    log('  • Integration scenarios verified');
    log('  • Edge cases handled');
  } else {
    log('\n⚠️  Some E2E tests failed.', 'yellow');
    log('\nFailed Tests:', 'red');
    testResults.filter(r => !r.passed).forEach(r => {
      log(`  • ${r.name}: ${r.error}`, 'red');
    });
  }
  
  log('\n' + '='.repeat(70), 'blue');
  
  return {
    passed: testsPassed,
    failed: testsFailed,
    total,
    successRate: parseFloat(successRate),
    avgDuration: testResults.length > 0 
      ? Math.round(testResults.reduce((a, b) => a + b.duration, 0) / testResults.length)
      : 0,
    testResults
  };
}

// ========================================
// Main Test Runner
// ========================================
async function runAllTests() {
  log('🚀 Starting Multi-Dataset Search E2E Test Suite', 'blue');
  log('─'.repeat(70), 'gray');
  
  try {
    await testDatasetParser();
    await testPatternLibrary();
    await testMCPToolHelpers();
    await testPerformance();
    await testIntegrationScenarios();
    await testEdgeCases();
    
    const report = await generateTestReport();
    
    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n❌ Test suite encountered a fatal error: ${error.message}`, 'red');
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run tests
runAllTests();
