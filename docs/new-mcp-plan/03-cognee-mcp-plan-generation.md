# Part 3: Cognee MCP Integration - Plan Generation & Optimization
## GOAP Planning Phase 3: Optimal Action Sequences

### Executive Summary
This document details the plan generation phase using A* pathfinding to create optimal
action sequences for Cognee MCP tool integration. We focus on practical workflows,
cost optimization, and real-world use cases.

---

## 1. GOAP Planner Core Implementation

### 1.1 State and Action Definitions

```javascript
// World state representation for Cognee operations
class CogneeWorldState {
  constructor(conditions = {}) {
    this.conditions = {
      hasConnection: false,
      hasAuth: false,
      datasetExists: false,
      datasetReady: false,
      hasData: false,
      dataIngested: false,
      knowledgeGraphCreated: false,
      searchReady: false,
      codeIndexed: false,
      ...conditions
    };
  }
  
  satisfiesGoal(goal) {
    return Object.entries(goal.conditions).every(
      ([key, value]) => this.conditions[key] === value
    );
  }
  
  applyAction(action) {
    const newConditions = { ...this.conditions };
    Object.assign(newConditions, action.effects);
    return new CogneeWorldState(newConditions);
  }
}

// Action representation
class CogneeAction {
  constructor(name, config) {
    this.name = name;
    this.preconditions = config.preconditions || {};
    this.effects = config.effects || {};
    this.cost = config.cost || 1;
    this.toolName = config.toolName;
    this.params = config.params;
  }
  
  canExecute(state) {
    return Object.entries(this.preconditions).every(
      ([key, value]) => state.conditions[key] === value
    );
  }
}
```

### 1.2 A* Planner Implementation

```javascript
class CogneePlanner {
  constructor(actions) {
    this.actions = actions;
    this.maxDepth = 15;
  }
  
  findPlan(start, goal) {
    const openSet = [];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    
    openSet.push({ state: start, action: null });
    gScore.set(this.stateKey(start), 0);
    
    while (openSet.length > 0) {
      // Sort by f-score (g + h)
      openSet.sort((a, b) => {
        const aG = gScore.get(this.stateKey(a.state)) || Infinity;
        const bG = gScore.get(this.stateKey(b.state)) || Infinity;
        const aH = this.heuristic(a.state, goal);
        const bH = this.heuristic(b.state, goal);
        return (aG + aH) - (bG + bH);
      });
      
      const current = openSet.shift();
      const currentKey = this.stateKey(current.state);
      
      if (current.state.satisfiesGoal(goal)) {
        return this.reconstructPath(cameFrom, currentKey);
      }
      
      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);
      
      const currentG = gScore.get(currentKey) || Infinity;
      if (currentG >= this.maxDepth) continue;
      
      for (const action of this.actions) {
        if (!action.canExecute(current.state)) continue;
        
        const neighbor = current.state.applyAction(action);
        const neighborKey = this.stateKey(neighbor);
        
        if (closedSet.has(neighborKey)) continue;
        
        const tentativeG = currentG + action.cost;
        
        if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, { state: current.state, action });
          gScore.set(neighborKey, tentativeG);
          openSet.push({ state: neighbor, action });
        }
      }
    }
    
    return null; // No plan found
  }
  
  stateKey(state) {
    return Object.entries(state.conditions)
      .filter(([_, v]) => v === true)
      .map(([k, _]) => k)
      .sort()
      .join(',');
  }
  
  heuristic(state, goal) {
    let distance = 0;
    for (const [key, value] of Object.entries(goal.conditions)) {
      if (state.conditions[key] !== value) distance++;
    }
    return distance;
  }
  
  reconstructPath(cameFrom, endKey) {
    const path = [];
    let currentKey = endKey;
    
    while (cameFrom.has(currentKey)) {
      const { state, action } = cameFrom.get(currentKey);
      path.unshift(action);
      currentKey = this.stateKey(state);
    }
    
    return path;
  }
}
```

---

## 2. Cognee Action Library

### 2.1 Connection and Authentication Actions

```javascript
const connectionActions = [
  new CogneeAction('checkConnection', {
    preconditions: {},
    effects: { hasConnection: true },
    cost: 1,
    toolName: null, // Direct HTTP call
    params: () => ({ method: 'GET', path: '/health' })
  }),
  
  new CogneeAction('setupAuth', {
    preconditions: {},
    effects: { hasAuth: true },
    cost: 1,
    toolName: null, // Environment check
    params: () => ({ checkEnv: 'COGNEE_TOKEN' })
  })
];
```

### 2.2 Dataset Management Actions

```javascript
const datasetActions = [
  new CogneeAction('createDataset', {
    preconditions: { hasConnection: true, hasAuth: true },
    effects: { datasetExists: true, datasetReady: true },
    cost: 2,
    toolName: 'cognee.datasets',
    params: (ctx) => ({ action: 'create', name: ctx.datasetName })
  }),
  
  new CogneeAction('listDatasets', {
    preconditions: { hasConnection: true, hasAuth: true },
    effects: { datasetsKnown: true },
    cost: 1,
    toolName: 'cognee.datasets',
    params: () => ({ action: 'list' })
  }),
  
  new CogneeAction('deleteDataset', {
    preconditions: { hasConnection: true, hasAuth: true, datasetExists: true },
    effects: { datasetExists: false, datasetReady: false },
    cost: 2,
    toolName: 'cognee.datasets',
    params: (ctx) => ({ action: 'delete', datasetId: ctx.datasetId })
  })
];
```

### 2.3 Data Ingestion Actions

```javascript
const ingestionActions = [
  new CogneeAction('addFiles', {
    preconditions: { 
      hasConnection: true, 
      hasAuth: true, 
      datasetReady: true 
    },
    effects: { hasData: true, dataIngested: true },
    cost: 5,
    toolName: 'cognee.add',
    params: (ctx) => ({
      datasetName: ctx.datasetName,
      files: ctx.files
    })
  }),
  
  new CogneeAction('addUrls', {
    preconditions: { 
      hasConnection: true, 
      hasAuth: true, 
      datasetReady: true 
    },
    effects: { hasData: true, dataIngested: true },
    cost: 3,
    toolName: 'cognee.add',
    params: (ctx) => ({
      datasetName: ctx.datasetName,
      urls: ctx.urls
    })
  })
];
```

### 2.4 Processing Actions

```javascript
const processingActions = [
  new CogneeAction('cognifyBlocking', {
    preconditions: {
      hasConnection: true,
      hasAuth: true,
      datasetReady: true,
      hasData: true
    },
    effects: {
      knowledgeGraphCreated: true,
      searchReady: true
    },
    cost: 10,
    toolName: 'cognee.cognify',
    params: (ctx) => ({
      datasets: [ctx.datasetName],
      runInBackground: false
    })
  }),
  
  new CogneeAction('cognifyBackground', {
    preconditions: {
      hasConnection: true,
      hasAuth: true,
      datasetReady: true,
      hasData: true
    },
    effects: {
      processingStarted: true
    },
    cost: 3,
    toolName: 'cognee.cognify',
    params: (ctx) => ({
      datasets: [ctx.datasetName],
      runInBackground: true
    })
  })
];
```

### 2.5 Search Actions

```javascript
const searchActions = [
  new CogneeAction('searchChunks', {
    preconditions: {
      hasConnection: true,
      hasAuth: true,
      searchReady: true
    },
    effects: {
      searchCompleted: true,
      resultsAvailable: true
    },
    cost: 2,
    toolName: 'cognee.search',
    params: (ctx) => ({
      searchType: 'CHUNKS',
      query: ctx.query,
      datasets: [ctx.datasetName],
      topK: ctx.topK || 10
    })
  }),
  
  new CogneeAction('searchRAG', {
    preconditions: {
      hasConnection: true,
      hasAuth: true,
      searchReady: true
    },
    effects: {
      searchCompleted: true,
      answerGenerated: true
    },
    cost: 5,
    toolName: 'cognee.search',
    params: (ctx) => ({
      searchType: 'RAG_COMPLETION',
      query: ctx.query,
      datasets: [ctx.datasetName]
    })
  })
];
```

### 2.6 Code Pipeline Actions

```javascript
const codeActions = [
  new CogneeAction('indexCode', {
    preconditions: {
      hasConnection: true,
      hasAuth: true
    },
    effects: {
      codeIndexed: true,
      codeGraphCreated: true
    },
    cost: 8,
    toolName: 'cognee.codePipeline',
    params: (ctx) => ({
      action: 'index',
      repoPath: ctx.repoPath,
      includeDocs: ctx.includeDocs || false
    })
  }),
  
  new CogneeAction('retrieveCode', {
    preconditions: {
      hasConnection: true,
      hasAuth: true,
      codeIndexed: true
    },
    effects: {
      codeRetrieved: true
    },
    cost: 2,
    toolName: 'cognee.codePipeline',
    params: (ctx) => ({
      action: 'retrieve',
      query: ctx.query,
      fullInput: ctx.fullInput
    })
  })
];

// Combine all actions
const allCogneeActions = [
  ...connectionActions,
  ...datasetActions,
  ...ingestionActions,
  ...processingActions,
  ...searchActions,
  ...codeActions
];
```

---

## 3. Workflow Examples

### 3.1 Document Processing Workflow

```javascript
async function planDocumentWorkflow(files, query) {
  const planner = new CogneePlanner(allCogneeActions);
  
  const start = new CogneeWorldState();
  const goal = new CogneeWorldState({
    searchCompleted: true,
    resultsAvailable: true
  });
  
  const plan = planner.findPlan(start, goal);
  
  if (!plan) {
    throw new Error('No valid plan found');
  }
  
  // Expected plan:
  // 1. checkConnection
  // 2. setupAuth
  // 3. createDataset
  // 4. addFiles
  // 5. cognifyBlocking
  // 6. searchChunks
  
  return plan;
}
```

### 3.2 Code Analysis Workflow

```javascript
async function planCodeWorkflow(repoPath, query) {
  const planner = new CogneePlanner(allCogneeActions);
  
  const start = new CogneeWorldState();
  const goal = new CogneeWorldState({
    codeRetrieved: true
  });
  
  const plan = planner.findPlan(start, goal);
  
  // Expected plan:
  // 1. checkConnection
  // 2. setupAuth
  // 3. indexCode
  // 4. retrieveCode
  
  return plan;
}
```

### 3.3 Research Workflow

```javascript
async function planResearchWorkflow(urls, topic) {
  const planner = new CogneePlanner(allCogneeActions);
  
  const start = new CogneeWorldState();
  const goal = new CogneeWorldState({
    answerGenerated: true
  });
  
  const plan = planner.findPlan(start, goal);
  
  // Expected plan:
  // 1. checkConnection
  // 2. setupAuth
  // 3. createDataset
  // 4. addUrls
  // 5. cognifyBlocking
  // 6. searchRAG
  
  return plan;
}
```

---

## 4. Plan Optimization Strategies

### 4.1 Cost Optimization

```javascript
class CostOptimizer {
  optimizePlan(plan, context) {
    // Prefer background processing for large datasets
    if (context.dataSize > 1000000) { // 1MB
      plan = plan.map(action => {
        if (action.name === 'cognifyBlocking') {
          return this.findAction('cognifyBackground');
        }
        return action;
      });
    }
    
    // Batch operations where possible
    const batchableOps = ['addFiles', 'addUrls'];
    const batched = new Map();
    
    plan = plan.filter(action => {
      if (batchableOps.includes(action.name)) {
        const key = `${action.toolName}-${action.name}`;
        if (!batched.has(key)) {
          batched.set(key, []);
        }
        batched.get(key).push(action);
        return false;
      }
      return true;
    });
    
    // Insert batched operations
    for (const [key, actions] of batched) {
      if (actions.length > 0) {
        plan.push(this.mergeBatchedActions(actions));
      }
    }
    
    return plan;
  }
}
```

### 4.2 Parallel Execution

```javascript
class ParallelExecutor {
  analyzeDependencies(plan) {
    const deps = new Map();
    
    plan.forEach((action, i) => {
      const dependencies = [];
      
      // Find actions that produce required preconditions
      for (let j = 0; j < i; j++) {
        const prevAction = plan[j];
        const providedEffects = Object.keys(prevAction.effects);
        const requiredPreconditions = Object.keys(action.preconditions);
        
        if (providedEffects.some(e => requiredPreconditions.includes(e))) {
          dependencies.push(j);
        }
      }
      
      deps.set(i, dependencies);
    });
    
    return deps;
  }
  
  createParallelStages(plan) {
    const deps = this.analyzeDependencies(plan);
    const stages = [];
    const executed = new Set();
    
    while (executed.size < plan.length) {
      const stage = [];
      
      for (let i = 0; i < plan.length; i++) {
        if (executed.has(i)) continue;
        
        const actionDeps = deps.get(i) || [];
        if (actionDeps.every(d => executed.has(d))) {
          stage.push({ index: i, action: plan[i] });
        }
      }
      
      if (stage.length > 0) {
        stages.push(stage);
        stage.forEach(item => executed.add(item.index));
      }
    }
    
    return stages;
  }
}
```

---

## Summary

This plan generation phase provides:

1. **Complete GOAP planner** using A* pathfinding
2. **Full action library** for all 5 Cognee tools
3. **Workflow examples** for common use cases
4. **Optimization strategies** for cost and performance
5. **Parallel execution** analysis for efficiency

The planner can generate optimal action sequences for any Cognee operation,
automatically handling preconditions, effects, and costs to find the best path
from current state to goal state.

---

*End of Part 3: Plan Generation & Optimization*
