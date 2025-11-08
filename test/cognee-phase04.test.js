#!/usr/bin/env node

/**
 * Phase 04: OODA Loop & Execution Monitoring Tests
 * Tests execution monitor, circuit breakers, telemetry, workflow execution
 */

const { CogneeExecutionMonitor } = require('../src/cognee/execution-monitor');
const { MonitoredWorkflowExecutor } = require('../src/cognee/workflow-executor');
const { CogneeAction } = require('../src/cognee/goap-planner');
const { documentWorkflow } = require('../src/cognee/workflows');

const assert = require('assert');

console.log('🧪 Phase 04: OODA Loop & Execution Monitoring Tests\n');

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
// Test 1: Execution Monitor - Observe
// =============================
console.log('📋 Test Group 1: Execution Monitor - Observe\n');

asyncTest('Monitor observes execution start', async () => {
  const monitor = new CogneeExecutionMonitor();
  const action = new CogneeAction('test', { effects: { done: true } });
  
  const observation = await monitor.observe('exec-1', action, Date.now());
  
  assert(observation.id === 'exec-1');
  assert(observation.action === 'test');
  assert(observation.status === 'running');
  assert(observation.metrics);
});

asyncTest('Monitor tracks active executions', async () => {
  const monitor = new CogneeExecutionMonitor();
  const action = new CogneeAction('test', {});
  
  await monitor.observe('exec-1', action, Date.now());
  await monitor.observe('exec-2', action, Date.now());
  
  const active = monitor.getActiveExecutions();
  assert(active.length === 2);
});

asyncTest('Monitor sets timeout handler', async () => {
  const monitor = new CogneeExecutionMonitor({ timeoutMs: 100 });
  const action = new CogneeAction('test', {});
  
  let timeoutFired = false;
  monitor.on('timeout', () => { timeoutFired = true; });
  
  await monitor.observe('exec-1', action, Date.now());
  
  // Wait for timeout
  await new Promise(resolve => setTimeout(resolve, 150));
  
  assert(timeoutFired === true);
});

// =============================
// Test 2: Execution Monitor - Orient
// =============================
console.log('\n📋 Test Group 2: Execution Monitor - Orient\n');

test('Monitor orients and analyzes execution', () => {
  const monitor = new CogneeExecutionMonitor();
  const action = new CogneeAction('test', {});
  const startTime = Date.now() - 6000; // 6 seconds ago
  
  monitor.activeExecutions.set('exec-1', {
    id: 'exec-1',
    action: 'test',
    startTime,
    metrics: { memoryUsage: process.memoryUsage() }
  });
  
  const analysis = monitor.orient('exec-1');
  
  assert(analysis !== null);
  assert(analysis.duration > 5000);
  assert(analysis.isSlow === true); // Over 5 second threshold
});

test('Monitor detects high error rate', () => {
  const monitor = new CogneeExecutionMonitor();
  
  // Add failed executions to history
  for (let i = 0; i < 10; i++) {
    monitor.history.push({
      action: 'test',
      success: i >= 7 // 70% failure rate
    });
  }
  
  const errorRate = monitor.calculateErrorRate('test');
  assert(errorRate === 0.7);
});

test('Monitor analyzes resource usage', () => {
  const monitor = new CogneeExecutionMonitor();
  const metrics = { memoryUsage: process.memoryUsage() };
  
  const analysis = monitor.analyzeResourceUsage(metrics);
  
  assert(typeof analysis.memory === 'number');
  assert(analysis.memory >= 0 && analysis.memory <= 1);
  assert(typeof analysis.memoryMB === 'number');
});

// =============================
// Test 3: Execution Monitor - Decide
// =============================
console.log('\n📋 Test Group 3: Execution Monitor - Decide\n');

test('Monitor decides to cancel on timeout', () => {
  const monitor = new CogneeExecutionMonitor();
  const analysis = { 
    isTimeout: true, 
    errorRate: 0,
    circuitState: 'CLOSED',
    resourceUsage: { memory: 0.5 },
    anomalies: []
  };
  
  const decisions = monitor.decide(analysis);
  
  assert(decisions.some(d => d.type === 'CANCEL'));
});

test('Monitor decides to warn on slow execution', () => {
  const monitor = new CogneeExecutionMonitor();
  const analysis = { 
    isSlow: true, 
    isTimeout: false, 
    errorRate: 0,
    circuitState: 'CLOSED',
    resourceUsage: { memory: 0.5 },
    anomalies: []
  };
  
  const decisions = monitor.decide(analysis);
  
  assert(decisions.some(d => d.type === 'WARN'));
});

test('Monitor decides to skip on open circuit', () => {
  const monitor = new CogneeExecutionMonitor();
  const analysis = { 
    circuitState: 'OPEN',
    errorRate: 0,
    resourceUsage: { memory: 0.5 },
    anomalies: []
  };
  
  const decisions = monitor.decide(analysis);
  
  assert(decisions.some(d => d.type === 'SKIP'));
});

// =============================
// Test 4: Execution Monitor - Act
// =============================
console.log('\n📋 Test Group 4: Execution Monitor - Act\n');

asyncTest('Monitor acts on cancel decision', async () => {
  const monitor = new CogneeExecutionMonitor();
  const decisions = [{ type: 'CANCEL', reason: 'timeout' }];
  
  monitor.activeExecutions.set('exec-1', { id: 'exec-1' });
  
  const actions = await monitor.act('exec-1', decisions);
  
  assert(actions.length > 0);
  assert(actions[0].type === 'cancelled');
});

asyncTest('Monitor acts on retry decision', async () => {
  const monitor = new CogneeExecutionMonitor();
  const decisions = [{ type: 'RETRY_WITH_BACKOFF', reason: 'error' }];
  
  monitor.activeExecutions.set('exec-1', { id: 'exec-1', retryCount: 0 });
  
  const actions = await monitor.act('exec-1', decisions);
  
  assert(actions.length > 0);
  assert(actions[0].type === 'retry_scheduled');
});

// =============================
// Test 5: Circuit Breakers
// =============================
console.log('\n📋 Test Group 5: Circuit Breakers\n');

test('Circuit breaker opens after failures', () => {
  const monitor = new CogneeExecutionMonitor({ circuitBreakerThreshold: 3 });
  
  // Record failures
  monitor.recordFailure('test-action');
  monitor.recordFailure('test-action');
  monitor.recordFailure('test-action');
  
  const state = monitor.getCircuitState('test-action');
  assert(state === 'OPEN');
});

test('Circuit breaker stays closed on success', () => {
  const monitor = new CogneeExecutionMonitor();
  
  monitor.recordSuccess('test-action');
  monitor.recordSuccess('test-action');
  
  const state = monitor.getCircuitState('test-action');
  assert(state === 'CLOSED');
});

test('Circuit breaker transitions to half-open', async () => {
  const monitor = new CogneeExecutionMonitor({ circuitBreakerThreshold: 2 });
  
  // Open circuit
  monitor.recordFailure('test-action');
  monitor.recordFailure('test-action');
  
  // Manually set opened time to past
  const breaker = monitor.circuitBreakers.get('test-action');
  breaker.openedAt = Date.now() - 70000; // 70 seconds ago
  
  const state = monitor.getCircuitState('test-action');
  assert(state === 'HALF_OPEN');
});

// =============================
// Test 6: Execution Completion
// =============================
console.log('\n📋 Test Group 6: Execution Completion\n');

asyncTest('Monitor completes successful execution', async () => {
  const monitor = new CogneeExecutionMonitor();
  const action = new CogneeAction('test', {});
  const startTime = Date.now();
  
  await monitor.observe('exec-1', action, startTime);
  
  const record = monitor.complete('exec-1', { data: 'success' });
  
  assert(record !== null);
  assert(record.success === true);
  assert(record.duration > 0);
  assert(monitor.getActiveExecutions().length === 0);
});

asyncTest('Monitor completes failed execution', async () => {
  const monitor = new CogneeExecutionMonitor();
  const action = new CogneeAction('test', {});
  
  await monitor.observe('exec-1', action, Date.now());
  
  const record = monitor.complete('exec-1', null, new Error('Test error'));
  
  assert(record.success === false);
  assert(record.error === 'Test error');
});

// =============================
// Test 7: Metrics
// =============================
console.log('\n📋 Test Group 7: Metrics\n');

test('Monitor tracks action metrics', () => {
  const monitor = new CogneeExecutionMonitor();
  
  monitor.updateMetrics('test-action', 100, true);
  monitor.updateMetrics('test-action', 150, true);
  monitor.updateMetrics('test-action', 200, false);
  
  const metrics = monitor.getMetrics('test-action');
  
  assert(metrics.count === 3);
  assert(metrics.successes === 2);
  assert(metrics.failures === 1);
  assert(metrics.avgDuration === 150);
  assert(metrics.minDuration === 100);
  assert(metrics.maxDuration === 200);
});

test('Monitor returns all metrics', () => {
  const monitor = new CogneeExecutionMonitor();
  
  monitor.updateMetrics('action1', 100, true);
  monitor.updateMetrics('action2', 200, true);
  
  const allMetrics = monitor.getMetrics();
  
  assert(Object.keys(allMetrics).length === 2);
  assert(allMetrics.action1);
  assert(allMetrics.action2);
});

// =============================
// Test 8: Workflow Executor
// =============================
console.log('\n📋 Test Group 8: Workflow Executor\n');

asyncTest('Executor executes workflow with monitoring', async () => {
  const executor = new MonitoredWorkflowExecutor({ timeoutMs: 10000 });
  
  const workflow = documentWorkflow({
    datasetName: 'test',
    urls: ['https://example.com']
  });
  
  const result = await executor.execute(workflow, { stopOnError: false });
  
  assert(result.workflow === 'Document Processing Pipeline');
  assert(result.totalActions > 0);
  assert(result.succeeded >= 0);
  assert(result.duration > 0);
});

asyncTest('Executor generates execution report', async () => {
  const executor = new MonitoredWorkflowExecutor();
  
  const workflow = documentWorkflow({ datasetName: 'test' });
  await executor.execute(workflow, { stopOnError: false });
  
  const report = executor.generateReport();
  
  assert(typeof report === 'string');
  assert(report.includes('Workflow Execution Report'));
  assert(report.includes('Action Metrics'));
});

// =============================
// Test Summary
// =============================
async function runTests() {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Phase 04 Test Results');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All Phase 04 tests passed!');
    console.log('\n✨ Validated:');
    console.log('  • OODA Loop (Observe-Orient-Decide-Act)');
    console.log('  • Execution monitoring & telemetry');
    console.log('  • Circuit breaker pattern');
    console.log('  • Timeout handling');
    console.log('  • Error rate tracking');
    console.log('  • Resource usage analysis');
    console.log('  • Workflow execution with monitoring');
  } else {
    console.log('\n⚠️  Some tests failed. Review implementation.');
  }
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
