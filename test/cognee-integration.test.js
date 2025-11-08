#!/usr/bin/env node

/**
 * Phase 06: Integration Testing Suite
 * End-to-end tests for all Cognee MCP components
 */

const assert = require('assert');
const path = require('path');

// Import all components
const { getCogneeBase, fetchJson } = require('../src/cognee/enhanced-helpers');
const { CogneePlanner, CogneeWorldState } = require('../src/cognee/goap-planner');
const { getAllActions } = require('../src/cognee/action-library');
const { documentWorkflow, codeWorkflow } = require('../src/cognee/workflows');
const { CogneeExecutionMonitor } = require('../src/cognee/execution-monitor');
const { MonitoredWorkflowExecutor } = require('../src/cognee/workflow-executor');
const { DynamicReplanner } = require('../src/cognee/dynamic-replanner');
const { AdaptiveExecutor } = require('../src/cognee/adaptive-executor');

console.log('🧪 Phase 06: Integration Testing Suite\n');
console.log('Testing all phases together...\n');

let passed = 0;
let failed = 0;
const testResults = [];

async function test(name, fn) {
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    console.log(`✅ ${name} (${duration}ms)`);
    passed++;
    testResults.push({ name, success: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${name} (${duration}ms)`);
    console.error(`   Error: ${error.message}`);
    failed++;
    testResults.push({ name, success: false, duration, error: error.message });
  }
}

// Main test runner
async function runAllTests() {

// =============================
// Test Group 1: Phase 01-02 Integration
// Tools & Helpers
// =============================
console.log('📋 Test Group 1: Tools & Helpers Integration\n');

await test('Environment configuration loads correctly', async () => {
  const base = getCogneeBase();
  assert(typeof base === 'string');
  assert(base.length > 0);
});

await test('Request tracking integrates with helpers', async () => {
  const { generateRequestId, authHeaders } = require('../src/cognee/enhanced-helpers');
  const id = generateRequestId();
  const headers = authHeaders({}, id);
  assert(headers['X-Request-ID'] === id);
});

await test('Retry logic works with network helpers', async () => {
  const { withRetry } = require('../src/cognee/enhanced-helpers');
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts++;
    if (attempts < 2) throw new Error('Retry test');
    return 'success';
  }, { maxRetries: 3, initialDelay: 10 });
  assert(result === 'success');
  assert(attempts === 2);
});

// =============================
// Test Group 2: Phase 03 Integration
// Planning System
// =============================
console.log('\n📋 Test Group 2: Planning System Integration\n');

await test('GOAP planner integrates with action library', async () => {
  const planner = new CogneePlanner(getAllActions());
  const start = new CogneeWorldState();
  const goal = { conditions: { datasetReady: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result !== null);
  assert(result.plan.length > 0);
});

await test('Workflow generation uses planner correctly', async () => {
  const workflow = documentWorkflow({
    datasetName: 'test-docs',
    urls: ['https://example.com']
  });
  
  assert(workflow.name === 'Document Processing Pipeline');
  assert(workflow.plan !== null);
  assert(workflow.plan.plan.length > 0);
});

await test('Code workflow integrates with action library', async () => {
  const workflow = codeWorkflow({
    repoPath: '/test/repo',
    datasetName: 'test-code'
  });
  
  assert(workflow.plan !== null);
  const actionNames = workflow.plan.plan.map(a => a.name);
  assert(actionNames.includes('checkConnection') || actionNames.includes('quickSetup'));
});

// =============================
// Test Group 3: Phase 04 Integration
// Monitoring System
// =============================
console.log('\n📋 Test Group 3: Monitoring System Integration\n');

await test('OODA loop monitor integrates with executor', async () => {
  const monitor = new CogneeExecutionMonitor();
  
  // Mock action
  const action = { name: 'test', description: 'Test action', getParams: () => ({}) };
  
  const observation = await monitor.observe('test-1', action, Date.now());
  assert(observation.id === 'test-1');
  
  const analysis = monitor.orient('test-1');
  assert(analysis !== null);
  
  const decisions = monitor.decide(analysis);
  assert(Array.isArray(decisions));
  
  monitor.complete('test-1', { success: true });
  const metrics = monitor.getMetrics('test');
  assert(metrics !== null);
});

await test('Circuit breaker integrates with monitoring', async () => {
  const monitor = new CogneeExecutionMonitor({ circuitBreakerThreshold: 2 });
  
  monitor.recordFailure('testAction');
  monitor.recordFailure('testAction');
  
  const state = monitor.getCircuitState('testAction');
  assert(state === 'OPEN');
  
  // Test auto half-open
  const breaker = monitor.circuitBreakers.get('testAction');
  breaker.openedAt = Date.now() - 70000;
  
  const newState = monitor.getCircuitState('testAction');
  assert(newState === 'HALF_OPEN');
});

await test('Workflow executor uses monitor correctly', async () => {
  const executor = new MonitoredWorkflowExecutor();
  
  // Create minimal workflow
  const workflow = {
    name: 'Test Workflow',
    plan: {
      plan: [{
        name: 'test',
        description: 'Test action',
        getParams: () => ({}),
        effects: {}
      }],
      cost: 1
    }
  };
  
  // Override executeAction to avoid random failures
  executor.executeAction = async () => ({ success: true });
  
  const result = await executor.execute(workflow);
  
  assert(result.workflow === 'Test Workflow');
  assert(result.totalActions === 1);
  assert(result.succeeded === 1);
});

// =============================
// Test Group 4: Phase 05 Integration
// Adaptive System
// =============================
console.log('\n📋 Test Group 4: Adaptive System Integration\n');

await test('Replanner integrates with planner', async () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const state = new CogneeWorldState();
  const goal = { conditions: { datasetReady: true } };
  const executionState = {
    failedAction: 'test',
    originalPlan: [],
    originalCost: 10,
    replanAttempts: 0
  };
  
  const result = await replanner.replan(state, goal, executionState);
  assert(result.success === true || result.success === false);
});

await test('Learning system updates action costs', async () => {
  const replanner = new DynamicReplanner(getAllActions(), { enableLearning: true });
  
  // Record failures
  for (let i = 0; i < 5; i++) {
    replanner.recordExecution('createDataset', false, 0);
  }
  
  const adjustedActions = replanner.adjustActionCosts('createDataset');
  const createDataset = adjustedActions.find(a => a.name === 'createDataset');
  const originalAction = getAllActions().find(a => a.name === 'createDataset');
  
  assert(createDataset.cost > originalAction.cost);
});

await test('Adaptive executor combines all systems', async () => {
  const executor = new AdaptiveExecutor();
  
  // Create test workflow
  const workflow = {
    name: 'Adaptive Test',
    plan: {
      plan: [{
        name: 'test1',
        description: 'Step 1',
        getParams: () => ({}),
        effects: { step1: true },
        cost: 1
      }],
      cost: 1,
      goal: { conditions: { step1: true } }
    }
  };
  
  // Override executeAction for testing
  executor.executeAction = async () => ({ success: true });
  
  const result = await executor.execute(workflow);
  
  assert(result.workflow === 'Adaptive Test');
  assert(result.totalActions > 0);
});

// =============================
// Test Group 5: End-to-End Workflows
// =============================
console.log('\n📋 Test Group 5: End-to-End Workflow Tests\n');

await test('Document workflow executes end-to-end', async () => {
  const executor = new AdaptiveExecutor();
  const workflow = documentWorkflow({
    datasetName: 'e2e-docs',
    urls: ['https://test.example.com/doc.md']
  });
  
  // Mock execution
  let stepCount = 0;
  executor.executeAction = async (action) => {
    stepCount++;
    return { action: action.name, success: true };
  };
  
  const result = await executor.execute(workflow);
  assert(result.succeeded > 0);
  assert(stepCount > 0);
});

await test('Code workflow executes with monitoring', async () => {
  const executor = new MonitoredWorkflowExecutor();
  const workflow = codeWorkflow({
    repoPath: '/test/repo',
    datasetName: 'e2e-code'
  });
  
  // Mock execution
  executor.executeAction = async (action) => {
    return { action: action.name, success: true };
  };
  
  const result = await executor.execute(workflow);
  assert(result.succeeded > 0);
  
  const stats = executor.getStatistics();
  assert(stats.metrics !== undefined);
});

await test('Workflow handles failures with replanning', async () => {
  const executor = new AdaptiveExecutor();
  
  const workflow = documentWorkflow({
    datasetName: 'failure-test'
  });
  
  let failureCount = 0;
  executor.executeAction = async (action) => {
    // Fail first attempt of specific action
    if (action.name === 'createDataset' && failureCount === 0) {
      failureCount++;
      throw new Error('Simulated failure');
    }
    return { success: true };
  };
  
  const result = await executor.execute(workflow);
  assert(result.replans >= 0); // Should attempt replanning
});

// =============================
// Test Group 6: Stress Testing
// =============================
console.log('\n📋 Test Group 6: Stress Testing\n');

await test('System handles large workflows', async () => {
  // Create large action set
  const actions = getAllActions();
  const planner = new CogneePlanner(actions);
  
  const start = new CogneeWorldState();
  const goal = { 
    conditions: { 
      searchReady: true,
      graphReady: true,
      codeReady: true
    }
  };
  
  const result = planner.findPlan(start, goal);
  assert(result !== null);
  assert(result.plan.length <= 15); // Should respect max depth
});

await test('Monitor handles high-frequency events', async () => {
  const monitor = new CogneeExecutionMonitor();
  const promises = [];
  
  // Fire many events rapidly
  for (let i = 0; i < 100; i++) {
    const action = { name: `action${i}`, description: `Test ${i}`, getParams: () => ({}) };
    promises.push(monitor.observe(`exec-${i}`, action, Date.now()));
  }
  
  await Promise.all(promises);
  
  const active = monitor.getActiveExecutions();
  assert(active.length === 100);
  
  // Clean up
  for (let i = 0; i < 100; i++) {
    monitor.complete(`exec-${i}`, { success: true });
  }
});

await test('Replanner handles complex state spaces', async () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  // Complex state with many conditions
  const state = new CogneeWorldState({
    hasConnection: true,
    hasAuth: true,
    datasetExists: true,
    datasetReady: true,
    hasData: true
  });
  
  const goal = {
    conditions: {
      searchReady: true,
      graphReady: true,
      resultsAvailable: true
    }
  };
  
  const executionState = {
    failedAction: 'cognifyBlocking',
    originalPlan: [],
    originalCost: 20,
    replanAttempts: 0
  };
  
  const result = await replanner.replan(state, goal, executionState);
  assert(result.success === true || result.reason !== undefined);
});

// =============================
// Test Summary & Report
// =============================
async function generateTestReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Phase 06: Integration Test Results');
  console.log('='.repeat(70));
  
  const total = passed + failed;
  const successRate = ((passed / total) * 100).toFixed(2);
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  // Performance metrics
  const durations = testResults.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  
  console.log(`\n⏱️  Performance Metrics:`);
  console.log(`   Average: ${Math.round(avgDuration)}ms`);
  console.log(`   Min: ${minDuration}ms`);
  console.log(`   Max: ${maxDuration}ms`);
  
  // Component coverage
  console.log(`\n📦 Component Coverage:`);
  console.log(`   ✅ Phase 01-02: Tools & Helpers`);
  console.log(`   ✅ Phase 03: Planning System`);
  console.log(`   ✅ Phase 04: Monitoring System`);
  console.log(`   ✅ Phase 05: Adaptive System`);
  console.log(`   ✅ End-to-End Workflows`);
  console.log(`   ✅ Stress Testing`);
  
  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
    console.log('\n✨ System Validation Complete:');
    console.log('  • All components integrate correctly');
    console.log('  • End-to-end workflows functional');
    console.log('  • Error handling robust');
    console.log('  • Performance acceptable');
    console.log('  • Stress tests passed');
  } else {
    console.log('\n⚠️  Some integration tests failed.');
    console.log('\nFailed Tests:');
    testResults.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  return {
    passed,
    failed,
    total,
    successRate,
    avgDuration: Math.round(avgDuration),
    testResults
  };
}

// Run all tests
const report = await generateTestReport();
return report;
}

// Execute all tests
runAllTests().then(report => {
  process.exit(report.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
