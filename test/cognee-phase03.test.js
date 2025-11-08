#!/usr/bin/env node

/**
 * Phase 03: GOAP Planner & Workflow Tests
 * Tests plan generation, action library, and workflow execution
 */

const {
  CogneeWorldState,
  CogneeAction,
  CogneePlanner
} = require('../src/cognee/goap-planner');

const {
  getAllActions,
  getActionsByCategory,
  findAction
} = require('../src/cognee/action-library');

const {
  documentWorkflow,
  codeWorkflow,
  optimizeWorkflow,
  compareStrategies
} = require('../src/cognee/workflows');

const assert = require('assert');

console.log('🧪 Phase 03: GOAP Planner & Workflow Tests\n');

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

// =============================
// Test 1: World State
// =============================
console.log('📋 Test Group 1: World State\n');

test('CogneeWorldState initializes with defaults', () => {
  const state = new CogneeWorldState();
  assert(state.conditions.hasConnection === false);
  assert(state.conditions.hasAuth === false);
  assert(state.conditions.datasetExists === false);
});

test('CogneeWorldState accepts custom conditions', () => {
  const state = new CogneeWorldState({ hasConnection: true });
  assert(state.conditions.hasConnection === true);
  assert(state.conditions.hasAuth === false);
});

test('CogneeWorldState.satisfiesGoal checks conditions', () => {
  const state = new CogneeWorldState({ hasConnection: true, hasAuth: true });
  const goal = { conditions: { hasConnection: true, hasAuth: true } };
  assert(state.satisfiesGoal(goal) === true);
  
  const goal2 = { conditions: { datasetExists: true } };
  assert(state.satisfiesGoal(goal2) === false);
});

test('CogneeWorldState.applyAction creates new state', () => {
  const state = new CogneeWorldState();
  const action = new CogneeAction('test', {
    effects: { hasConnection: true }
  });
  
  const newState = state.applyAction(action);
  assert(state.conditions.hasConnection === false); // Original unchanged
  assert(newState.conditions.hasConnection === true); // New state changed
});

// =============================
// Test 2: Actions
// =============================
console.log('\n📋 Test Group 2: Actions\n');

test('CogneeAction stores configuration', () => {
  const action = new CogneeAction('testAction', {
    preconditions: { hasConnection: true },
    effects: { datasetExists: true },
    cost: 5,
    toolName: 'cognee.datasets'
  });
  
  assert(action.name === 'testAction');
  assert(action.cost === 5);
  assert(action.toolName === 'cognee.datasets');
});

test('CogneeAction.canExecute checks preconditions', () => {
  const action = new CogneeAction('test', {
    preconditions: { hasConnection: true, hasAuth: true }
  });
  
  const state1 = new CogneeWorldState({ hasConnection: true, hasAuth: true });
  assert(action.canExecute(state1) === true);
  
  const state2 = new CogneeWorldState({ hasConnection: true });
  assert(action.canExecute(state2) === false);
});

test('CogneeAction.getParams returns parameters', () => {
  const action = new CogneeAction('test', {
    params: (ctx) => ({ name: ctx.datasetName })
  });
  
  const params = action.getParams({ datasetName: 'test-dataset' });
  assert(params.name === 'test-dataset');
});

// =============================
// Test 3: GOAP Planner
// =============================
console.log('\n📋 Test Group 3: GOAP Planner\n');

test('CogneePlanner finds simple plan', () => {
  const action1 = new CogneeAction('connect', {
    preconditions: {},
    effects: { hasConnection: true },
    cost: 1
  });
  
  const action2 = new CogneeAction('auth', {
    preconditions: { hasConnection: true },
    effects: { hasAuth: true },
    cost: 1
  });
  
  const planner = new CogneePlanner([action1, action2]);
  const start = new CogneeWorldState();
  const goal = { conditions: { hasAuth: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result !== null);
  assert(result.plan.length === 2);
  assert(result.plan[0].name === 'connect');
  assert(result.plan[1].name === 'auth');
});

test('CogneePlanner calculates cost correctly', () => {
  const action1 = new CogneeAction('cheap', {
    preconditions: {},
    effects: { hasConnection: true },
    cost: 1
  });
  
  const action2 = new CogneeAction('expensive', {
    preconditions: {},
    effects: { hasConnection: true },
    cost: 10
  });
  
  const planner = new CogneePlanner([action1, action2]);
  const start = new CogneeWorldState();
  const goal = { conditions: { hasConnection: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result.plan[0].name === 'cheap'); // Should choose cheaper action
  assert(result.cost === 1);
});

test('CogneePlanner finds optimal path', () => {
  // Create a scenario where there are multiple paths
  const directAction = new CogneeAction('direct', {
    preconditions: {},
    effects: { goalReached: true },
    cost: 5
  });
  
  const step1 = new CogneeAction('step1', {
    preconditions: {},
    effects: { intermediate: true },
    cost: 2
  });
  
  const step2 = new CogneeAction('step2', {
    preconditions: { intermediate: true },
    effects: { goalReached: true },
    cost: 2
  });
  
  const planner = new CogneePlanner([directAction, step1, step2]);
  const start = new CogneeWorldState();
  const goal = { conditions: { goalReached: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result.cost === 4); // Should choose 2+2=4 over 5
  assert(result.plan.length === 2);
});

test('CogneePlanner returns null for impossible goal', () => {
  const action = new CogneeAction('test', {
    preconditions: { impossible: true }, // Can never execute
    effects: { goal: true },
    cost: 1
  });
  
  const planner = new CogneePlanner([action]);
  const start = new CogneeWorldState();
  const goal = { conditions: { goal: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result === null);
});

// =============================
// Test 4: Action Library
// =============================
console.log('\n📋 Test Group 4: Action Library\n');

test('getAllActions returns all actions', () => {
  const actions = getAllActions();
  assert(Array.isArray(actions));
  assert(actions.length > 0);
  assert(actions.every(a => a instanceof CogneeAction));
});

test('getActionsByCategory returns filtered actions', () => {
  const datasetActions = getActionsByCategory('dataset');
  assert(Array.isArray(datasetActions));
  assert(datasetActions.every(a => a.name.toLowerCase().includes('dataset') || 
                                    a.description.toLowerCase().includes('dataset')));
});

test('findAction locates action by name', () => {
  const action = findAction('createDataset');
  assert(action !== undefined);
  assert(action.name === 'createDataset');
  assert(action.toolName === 'cognee.datasets');
});

// =============================
// Test 5: Workflows
// =============================
console.log('\n📋 Test Group 5: Workflows\n');

test('documentWorkflow generates valid plan', () => {
  const context = {
    datasetName: 'test-docs',
    urls: ['https://example.com/doc.md']
  };
  
  const workflow = documentWorkflow(context);
  assert(workflow.name === 'Document Processing Pipeline');
  assert(workflow.plan !== null);
  assert(workflow.plan.plan.length > 0);
});

test('codeWorkflow generates valid plan', () => {
  const context = {
    repoPath: '/path/to/repo',
    datasetName: 'test-code'
  };
  
  const workflow = codeWorkflow(context);
  assert(workflow.name === 'Code Repository Analysis');
  assert(workflow.plan !== null);
});

test('optimizeWorkflow finds parallel opportunities', () => {
  const context = { datasetName: 'test' };
  const workflow = documentWorkflow(context);
  const optimized = optimizeWorkflow(workflow);
  
  assert(optimized.optimized !== undefined);
  assert(optimized.optimized.batches.length <= optimized.optimized.sequential);
});

test('compareStrategies compares different goals', () => {
  const context = { datasetName: 'test' };
  const goals = [
    { name: 'Quick Search', conditions: { resultsAvailable: true } },
    { name: 'Full Pipeline', conditions: { graphReady: true, searchReady: true } }
  ];
  
  const comparisons = compareStrategies(context, goals);
  assert(Array.isArray(comparisons));
  assert(comparisons.length === 2);
  assert(comparisons[0].cost <= comparisons[1].cost); // Sorted by cost
});

// =============================
// Test 6: Integration
// =============================
console.log('\n📋 Test Group 6: Integration\n');

test('Full workflow: start to search', () => {
  const planner = new CogneePlanner(getAllActions());
  const start = new CogneeWorldState();
  const goal = { conditions: { resultsAvailable: true } };
  
  const result = planner.findPlan(start, goal);
  assert(result !== null);
  assert(result.plan.length > 0);
  
  // Verify plan makes sense
  const actionNames = result.plan.map(a => a.name);
  assert(actionNames.includes('createDataset') || actionNames.includes('quickSetup'));
  assert(actionNames.some(name => name.includes('add') || name.includes('ingest')));
});

// =============================
// Test Summary
// =============================
console.log('\n' + '='.repeat(60));
console.log('📊 Phase 03 Test Results');
console.log('='.repeat(60));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All Phase 03 tests passed!');
  console.log('\n✨ Validated:');
  console.log('  • World state management');
  console.log('  • Action preconditions & effects');
  console.log('  • A* pathfinding algorithm');
  console.log('  • Cost optimization');
  console.log('  • Action library completeness');
  console.log('  • Workflow generation');
  console.log('  • Parallel execution optimization');
} else {
  console.log('\n⚠️  Some tests failed. Review implementation.');
}

console.log('\n' + '='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
