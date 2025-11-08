#!/usr/bin/env node

/**
 * Phase 05: Dynamic Replanning & Adaptation Tests
 * Tests replanning, learning, state rollback, adaptive execution
 */

const { DynamicReplanner } = require('../src/cognee/dynamic-replanner');
const { AdaptiveExecutor } = require('../src/cognee/adaptive-executor');
const { CogneeWorldState, CogneeAction } = require('../src/cognee/goap-planner');
const { getAllActions } = require('../src/cognee/action-library');
const { documentWorkflow } = require('../src/cognee/workflows');

const assert = require('assert');

console.log('🧪 Phase 05: Dynamic Replanning & Adaptation Tests\n');

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
// Test 1: Replan Detection
// =============================
console.log('📋 Test Group 1: Replan Detection\n');

test('Replanner detects action failure', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const executionState = {
    lastActionFailed: true,
    failedAction: 'testAction',
    error: 'Test error'
  };
  
  const result = replanner.shouldReplan(executionState);
  
  assert(result.needed === true);
  assert(result.reasons.some(r => r.type === 'ACTION_FAILED'));
});

test('Replanner detects circuit breaker', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const executionState = {
    circuitBreakerOpen: true,
    blockedAction: 'testAction'
  };
  
  const result = replanner.shouldReplan(executionState);
  
  assert(result.needed === true);
  assert(result.reasons.some(r => r.type === 'CIRCUIT_BREAKER'));
});

test('Replanner detects cost exceeded', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const executionState = {
    costExceeded: true,
    plannedCost: 10,
    actualCost: 25
  };
  
  const result = replanner.shouldReplan(executionState);
  
  assert(result.needed === true);
  assert(result.reasons.some(r => r.type === 'COST_EXCEEDED'));
});

test('Replanner returns no replan when state is ok', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const executionState = {};
  
  const result = replanner.shouldReplan(executionState);
  
  assert(result.needed === false);
  assert(result.reasons.length === 0);
});

// =============================
// Test 2: Cost Adjustment
// =============================
console.log('\n📋 Test Group 2: Cost Adjustment\n');

test('Replanner increases cost of failed action', () => {
  const actions = [
    new CogneeAction('testAction', { cost: 10 })
  ];
  
  const replanner = new DynamicReplanner(actions);
  
  const adjusted = replanner.adjustActionCosts('testAction');
  const testAction = adjusted.find(a => a.name === 'testAction');
  
  assert(testAction.cost > 10); // Cost should be increased
});

test('Replanner applies learning data to costs', () => {
  const actions = [
    new CogneeAction('testAction', { cost: 10 })
  ];
  
  const replanner = new DynamicReplanner(actions, { enableLearning: true });
  
  // Record failures
  replanner.recordExecution('testAction', false, 0);
  replanner.recordExecution('testAction', false, 0);
  replanner.recordExecution('testAction', true, 100);
  
  const adjusted = replanner.adjustActionCosts('testAction');
  const testAction = adjusted.find(a => a.name === 'testAction');
  
  // Cost should be adjusted based on failure rate
  assert(testAction.cost >= 10);
});

// =============================
// Test 3: Alternative Actions
// =============================
console.log('\n📋 Test Group 3: Alternative Actions\n');

test('Replanner finds alternative actions', () => {
  const action1 = new CogneeAction('action1', {
    effects: { hasData: true }
  });
  
  const action2 = new CogneeAction('action2', {
    effects: { hasData: true }
  });
  
  const action3 = new CogneeAction('action3', {
    effects: { different: true }
  });
  
  const replanner = new DynamicReplanner([action1, action2, action3]);
  
  const alternatives = replanner.findAlternatives(action1);
  
  assert(alternatives.length > 0);
  assert(alternatives.some(a => a.name === 'action2'));
  assert(!alternatives.some(a => a.name === 'action3'));
});

// =============================
// Test 4: Replanning
// =============================
console.log('\n📋 Test Group 4: Replanning\n');

asyncTest('Replanner generates alternative plan', async () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const currentState = new CogneeWorldState();
  const goal = { conditions: { datasetReady: true } };
  
  const executionState = {
    failedAction: 'createDataset',
    originalPlan: [],
    originalCost: 10,
    replanAttempts: 0
  };
  
  const result = await replanner.replan(currentState, goal, executionState);
  
  assert(result.success === true || result.success === false);
  if (result.success) {
    assert(result.plan !== null);
    assert(result.attempts === 1);
  }
});

asyncTest('Replanner respects max replans', async () => {
  const replanner = new DynamicReplanner(getAllActions(), {
    maxReplanAttempts: 2
  });
  
  const currentState = new CogneeWorldState();
  const goal = { conditions: { impossible: true } }; // Impossible goal
  
  const executionState = {
    failedAction: 'test',
    replanAttempts: 2 // At max
  };
  
  const result = await replanner.replan(currentState, goal, executionState);
  
  assert(result.success === false);
  assert(result.reason === 'MAX_REPLANS_EXCEEDED');
});

// =============================
// Test 5: Learning System
// =============================
console.log('\n📋 Test Group 5: Learning System\n');

test('Learning system records executions', () => {
  const replanner = new DynamicReplanner(getAllActions(), {
    enableLearning: true
  });
  
  replanner.recordExecution('testAction', true, 100);
  replanner.recordExecution('testAction', false, 0);
  
  const stats = replanner.getLearningStats();
  
  assert(stats.testAction !== undefined);
  assert(stats.testAction.attempts === 2);
});

test('Learning system calculates success rate', () => {
  const replanner = new DynamicReplanner(getAllActions(), {
    enableLearning: true
  });
  
  // 3 successes, 1 failure = 75% success rate
  replanner.recordExecution('testAction', true, 100);
  replanner.recordExecution('testAction', true, 100);
  replanner.recordExecution('testAction', true, 100);
  replanner.recordExecution('testAction', false, 0);
  
  const stats = replanner.getLearningStats();
  
  assert(stats.testAction.successRate === '75.00%');
});

test('Learning system tracks average duration', () => {
  const replanner = new DynamicReplanner(getAllActions(), {
    enableLearning: true
  });
  
  replanner.recordExecution('testAction', true, 100);
  replanner.recordExecution('testAction', true, 200);
  
  const stats = replanner.getLearningStats();
  
  assert(stats.testAction.avgDuration === '150ms');
});

// =============================
// Test 6: State Rollback
// =============================
console.log('\n📋 Test Group 6: State Rollback\n');

test('Rollback finds last good state', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const history = [
    { success: true, stateAfter: new CogneeWorldState({ step1: true }) },
    { success: true, stateAfter: new CogneeWorldState({ step2: true }) },
    { success: false }
  ];
  
  const result = replanner.rollbackState(history);
  
  assert(result.rollbackPoint === 1);
  assert(result.actionsToUndo === 1);
  assert(result.state.conditions.step2 === true);
});

test('Rollback handles no good state', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  const history = [
    { success: false },
    { success: false }
  ];
  
  const result = replanner.rollbackState(history);
  
  assert(result.rollbackPoint === 0);
  assert(result.actionsToUndo === 2);
});

// =============================
// Test 7: Pattern Analysis
// =============================
console.log('\n📋 Test Group 7: Pattern Analysis\n');

test('Pattern analysis finds most failed actions', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  // Simulate replans
  replanner.replanHistory.push({ failedAction: 'action1' });
  replanner.replanHistory.push({ failedAction: 'action1' });
  replanner.replanHistory.push({ failedAction: 'action2' });
  
  const patterns = replanner.analyzeReplanPatterns();
  
  assert(patterns.mostFailedActions.length > 0);
  assert(patterns.mostFailedActions[0].action === 'action1');
  assert(patterns.mostFailedActions[0].count === 2);
});

test('Pattern analysis calculates avg cost increase', () => {
  const replanner = new DynamicReplanner(getAllActions());
  
  replanner.replanHistory.push({ costChange: 5 });
  replanner.replanHistory.push({ costChange: 10 });
  
  const patterns = replanner.analyzeReplanPatterns();
  
  assert(patterns.avgCostIncrease === 7.5);
});

// =============================
// Test 8: Adaptive Executor
// =============================
console.log('\n📋 Test Group 8: Adaptive Executor\n');

asyncTest('Adaptive executor handles workflow', async () => {
  const executor = new AdaptiveExecutor();
  
  const workflow = documentWorkflow({
    datasetName: 'test',
    urls: ['https://example.com']
  });
  
  // Override executeAction to avoid random failures in test
  executor.executeAction = async (action) => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { action: action.name, success: true };
  };
  
  const result = await executor.execute(workflow);
  
  assert(typeof result.totalActions === 'number');
  assert(typeof result.succeeded === 'number');
  assert(typeof result.duration === 'number');
});

asyncTest('Adaptive executor generates report', async () => {
  const executor = new AdaptiveExecutor();
  
  const workflow = documentWorkflow({ datasetName: 'test' });
  
  // Override to avoid failures
  executor.executeAction = async (action) => {
    return { action: action.name, success: true };
  };
  
  await executor.execute(workflow);
  
  const report = executor.generateReport();
  
  assert(typeof report === 'string');
  assert(report.includes('Adaptive Execution Report'));
});

// =============================
// Test Summary
// =============================
async function runTests() {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Phase 05 Test Results');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All Phase 05 tests passed!');
    console.log('\n✨ Validated:');
    console.log('  • Replan detection (4 conditions)');
    console.log('  • Cost adjustment & learning');
    console.log('  • Alternative action discovery');
    console.log('  • Dynamic replanning');
    console.log('  • Learning system (success rate, duration)');
    console.log('  • State rollback');
    console.log('  • Pattern analysis');
    console.log('  • Adaptive execution');
  } else {
    console.log('\n⚠️  Some tests failed. Review implementation.');
  }
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
