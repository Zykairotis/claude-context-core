# Part 6: Cognee MCP Integration - Testing & Validation
## GOAP Planning Phase 6: Comprehensive Quality Assurance

### Executive Summary
This document provides complete testing strategies, validation frameworks,
and quality assurance processes for the Cognee MCP integration. We cover
unit testing, integration testing, end-to-end workflows, and performance benchmarks.

---

## 1. Testing Framework

### 1.1 Test Infrastructure Setup

```javascript
/**
 * Complete test infrastructure for Cognee MCP tools
 */
const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const { McpServer } = require('@modelcontextprotocol/sdk');

class CogneeTestEnvironment {
  constructor() {
    this.mcpServer = null;
    this.mockResponses = new Map();
    this.testDatasets = [];
    this.metrics = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      duration: 0
    };
  }
  
  async setup() {
    // Initialize MCP server with test configuration
    this.mcpServer = new McpServer({
      name: 'cognee-test',
      version: '1.0.0'
    });
    
    // Register all Cognee tools
    this.registerCogneeTools();
    
    // Setup mock HTTP server
    await this.setupMockServer();
    
    // Initialize test database
    await this.initializeTestDatabase();
    
    return this;
  }
  
  async teardown() {
    // Cleanup test datasets
    for (const datasetId of this.testDatasets) {
      try {
        await this.cleanupDataset(datasetId);
      } catch (error) {
        console.warn(`Failed to cleanup dataset ${datasetId}:`, error);
      }
    }
    
    // Close connections
    await this.mcpServer.close();
    await this.closeMockServer();
    await this.closeTestDatabase();
  }
  
  registerCogneeTools() {
    // Import tool implementations
    const tools = require('./cognee-tools');
    
    for (const [name, config] of Object.entries(tools)) {
      this.mcpServer.registerTool(name, config.schema, config.handler);
    }
  }
  
  async setupMockServer() {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    // Mock endpoints
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', version: '1.0.0' });
    });
    
    app.get('/api/v1/datasets', (req, res) => {
      const response = this.mockResponses.get('GET:/api/v1/datasets') || [];
      res.json(response);
    });
    
    app.post('/api/v1/datasets', (req, res) => {
      const dataset = {
        id: this.generateUUID(),
        name: req.body.name,
        createdAt: new Date().toISOString()
      };
      this.testDatasets.push(dataset.id);
      res.json(dataset);
    });
    
    app.post('/api/v1/add', (req, res) => {
      res.json({
        message: 'Data added successfully',
        items: req.body.files?.length || req.body.urls?.length || 0
      });
    });
    
    app.post('/api/v1/cognify', (req, res) => {
      const runInBackground = req.body.runInBackground;
      
      if (runInBackground) {
        res.json({
          pipeline_run_id: this.generateUUID(),
          status: 'started'
        });
      } else {
        res.json({
          status: 'completed',
          stats: {
            entities_extracted: 42,
            relationships_found: 18,
            chunks_processed: 10
          }
        });
      }
    });
    
    app.post('/api/v1/search', (req, res) => {
      const mockResults = [
        {
          content: 'Test result 1',
          score: 0.95,
          metadata: { source: 'test.txt' }
        },
        {
          content: 'Test result 2',
          score: 0.87,
          metadata: { source: 'test2.txt' }
        }
      ];
      res.json(mockResults);
    });
    
    this.mockServer = app.listen(8340);
    process.env.COGNEE_URL = 'http://localhost:8340';
  }
  
  async closeMockServer() {
    return new Promise((resolve) => {
      if (this.mockServer) {
        this.mockServer.close(resolve);
      } else {
        resolve();
      }
    });
  }
  
  async initializeTestDatabase() {
    // Setup in-memory database for testing
    const { Pool } = require('pg');
    this.testPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL ||
        'postgresql://test:test@localhost:5432/cognee_test'
    });
    
    // Create test schema
    await this.testPool.query(`
      CREATE SCHEMA IF NOT EXISTS test_cognee;
      SET search_path TO test_cognee;
    `);
  }
  
  async closeTestDatabase() {
    if (this.testPool) {
      await this.testPool.end();
    }
  }
  
  async cleanupDataset(datasetId) {
    // Cleanup test dataset
    await fetch(`${process.env.COGNEE_URL}/api/v1/datasets/${datasetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  setMockResponse(endpoint, response) {
    this.mockResponses.set(endpoint, response);
  }
  
  clearMockResponses() {
    this.mockResponses.clear();
  }
  
  recordTestResult(name, passed, duration) {
    this.metrics.totalTests++;
    if (passed) {
      this.metrics.passed++;
    } else {
      this.metrics.failed++;
    }
    this.metrics.duration += duration;
  }
  
  getTestReport() {
    return {
      ...this.metrics,
      successRate: (this.metrics.passed / this.metrics.totalTests * 100).toFixed(2) + '%',
      avgDuration: (this.metrics.duration / this.metrics.totalTests).toFixed(2) + 'ms'
    };
  }
}
```

### 1.2 Test Utilities

```javascript
/**
 * Utility functions for testing
 */
class TestUtilities {
  static async withTimeout(promise, timeoutMs = 5000) {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  }
  
  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  static generateTestData(type, options = {}) {
    switch (type) {
      case 'files':
        return Array.from({ length: options.count || 3 }, (_, i) => ({
          path: `/tmp/test-file-${i}.txt`,
          content: `Test content ${i}`,
          size: 1024 * (i + 1)
        }));
        
      case 'urls':
        return Array.from({ length: options.count || 3 }, (_, i) => 
          `https://example.com/doc${i}.html`
        );
        
      case 'dataset':
        return {
          name: `test-dataset-${Date.now()}`,
          description: 'Test dataset for integration testing'
        };
        
      case 'query':
        return options.query || 'test search query';
        
      default:
        return null;
    }
  }
  
  static async createTestFile(path, content) {
    const fs = require('fs').promises;
    const dir = require('path').dirname(path);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path, content);
    
    return path;
  }
  
  static async cleanupTestFiles(paths) {
    const fs = require('fs').promises;
    
    for (const path of paths) {
      try {
        await fs.unlink(path);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  }
  
  static validateResponse(response, schema) {
    const errors = [];
    
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in response)) {
        errors.push(`Missing required field: ${key}`);
      } else if (typeof response[key] !== type) {
        errors.push(`Invalid type for ${key}: expected ${type}, got ${typeof response[key]}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static async measurePerformance(fn, iterations = 10) {
    const durations = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      durations.push(duration);
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      min: durations[0],
      max: durations[durations.length - 1],
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }
}
```

---

## 2. Unit Tests

### 2.1 Tool Registration Tests

```javascript
describe('Cognee Tool Registration', () => {
  let env;
  
  beforeAll(async () => {
    env = await new CogneeTestEnvironment().setup();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  test('All tools are registered correctly', () => {
    const expectedTools = [
      'cognee.add',
      'cognee.cognify',
      'cognee.search',
      'cognee.datasets',
      'cognee.codePipeline'
    ];
    
    for (const toolName of expectedTools) {
      const tool = env.mcpServer.getTool(toolName);
      expect(tool).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });
  
  test('Tool schemas are valid', () => {
    const tools = env.mcpServer.getAllTools();
    
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.inputSchema).toHaveProperty('type');
      expect(tool.inputSchema.type).toBe('object');
      
      if (tool.inputSchema.required) {
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      }
    }
  });
  
  test('Environment variables are configured', () => {
    expect(process.env.COGNEE_URL).toBeDefined();
    expect(getCogneeBase()).toBe('http://localhost:8340');
    
    if (process.env.COGNEE_TOKEN) {
      const headers = authHeaders();
      expect(headers.Authorization).toMatch(/^Bearer /);
    }
  });
});
```

### 2.2 Helper Function Tests

```javascript
describe('Helper Functions', () => {
  test('getCogneeBase removes trailing slashes', () => {
    process.env.COGNEE_URL = 'http://localhost:8340/';
    expect(getCogneeBase()).toBe('http://localhost:8340');
    
    process.env.COGNEE_URL = 'http://localhost:8340//';
    expect(getCogneeBase()).toBe('http://localhost:8340');
  });
  
  test('authHeaders adds Bearer token', () => {
    process.env.COGNEE_TOKEN = 'test-token';
    const headers = authHeaders({ 'Content-Type': 'application/json' });
    
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');
  });
  
  test('authHeaders works without token', () => {
    delete process.env.COGNEE_TOKEN;
    const headers = authHeaders({ 'Content-Type': 'application/json' });
    
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });
  
  test('fetchJson handles errors correctly', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Resource not found'
    });
    
    global.fetch = mockFetch;
    
    await expect(fetchJson('GET', '/test')).rejects.toThrow('404 Not Found');
  });
});
```

---

## 3. Integration Tests

### 3.1 Dataset Operations

```javascript
describe('Dataset Integration Tests', () => {
  let env;
  let testDatasetId;
  
  beforeAll(async () => {
    env = await new CogneeTestEnvironment().setup();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  test('Create dataset', async () => {
    const result = await env.mcpServer.executeTool('cognee.datasets', {
      action: 'create',
      name: 'integration-test-dataset'
    });
    
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toHaveProperty('id');
    expect(result.structuredContent.name).toBe('integration-test-dataset');
    
    testDatasetId = result.structuredContent.id;
  });
  
  test('List datasets', async () => {
    const result = await env.mcpServer.executeTool('cognee.datasets', {
      action: 'list'
    });
    
    expect(result.isError).toBe(false);
    expect(Array.isArray(result.structuredContent)).toBe(true);
  });
  
  test('Delete dataset', async () => {
    if (!testDatasetId) {
      const createResult = await env.mcpServer.executeTool('cognee.datasets', {
        action: 'create',
        name: 'temp-dataset'
      });
      testDatasetId = createResult.structuredContent.id;
    }
    
    const result = await env.mcpServer.executeTool('cognee.datasets', {
      action: 'delete',
      datasetId: testDatasetId
    });
    
    expect(result.isError).toBe(false);
  });
});
```

### 3.2 Data Ingestion Tests

```javascript
describe('Data Ingestion Integration', () => {
  let env;
  let testDataset;
  let testFiles;
  
  beforeAll(async () => {
    env = await new CogneeTestEnvironment().setup();
    
    // Create test dataset
    const createResult = await env.mcpServer.executeTool('cognee.datasets', {
      action: 'create',
      name: 'ingestion-test'
    });
    testDataset = createResult.structuredContent;
    
    // Create test files
    testFiles = [];
    for (let i = 0; i < 3; i++) {
      const path = await TestUtilities.createTestFile(
        `/tmp/test-${i}.txt`,
        `Test content ${i}`
      );
      testFiles.push(path);
    }
  });
  
  afterAll(async () => {
    await TestUtilities.cleanupTestFiles(testFiles);
    await env.teardown();
  });
  
  test('Add files to dataset', async () => {
    const result = await env.mcpServer.executeTool('cognee.add', {
      datasetName: testDataset.name,
      files: testFiles
    });
    
    expect(result.isError).toBe(false);
    expect(result.structuredContent.items).toBe(testFiles.length);
  });
  
  test('Add URLs to dataset', async () => {
    const urls = TestUtilities.generateTestData('urls', { count: 2 });
    
    const result = await env.mcpServer.executeTool('cognee.add', {
      datasetName: testDataset.name,
      urls
    });
    
    expect(result.isError).toBe(false);
    expect(result.structuredContent.items).toBe(urls.length);
  });
  
  test('Add with invalid dataset', async () => {
    const result = await env.mcpServer.executeTool('cognee.add', {
      datasetName: 'non-existent-dataset',
      files: testFiles
    });
    
    expect(result.isError).toBe(true);
  });
  
  test('Add without data', async () => {
    const result = await env.mcpServer.executeTool('cognee.add', {
      datasetName: testDataset.name,
      files: [],
      urls: []
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('at least one file or url');
  });
});
```

---

## 4. End-to-End Workflow Tests

### 4.1 Complete Workflow Test

```javascript
describe('End-to-End Workflow', () => {
  let env;
  let planner;
  let executor;
  
  beforeAll(async () => {
    env = await new CogneeTestEnvironment().setup();
    planner = new CogneePlanner(allCogneeActions);
    executor = new CogneeExecutor(
      new CogneeExecutionMonitor(),
      new CogneeTelemetry()
    );
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  test('Document processing workflow', async () => {
    // Generate test data
    const files = await Promise.all([
      TestUtilities.createTestFile('/tmp/doc1.txt', 'Document 1 content'),
      TestUtilities.createTestFile('/tmp/doc2.txt', 'Document 2 content')
    ]);
    
    const query = 'test query';
    
    // Plan generation
    const startState = new CogneeWorldState();
    const goalState = new CogneeWorldState({
      searchCompleted: true,
      resultsAvailable: true
    });
    
    const plan = planner.findPlan(startState, goalState);
    expect(plan).not.toBeNull();
    expect(plan.length).toBeGreaterThan(0);
    
    // Execute plan
    const context = {
      files,
      query,
      datasetName: `test-${Date.now()}`
    };
    
    const result = await executor.executePlan(plan, context);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(plan.length);
    
    // Verify search results
    const searchResult = result.results.find(r => r.action === 'searchChunks');
    expect(searchResult).toBeDefined();
    expect(searchResult.success).toBe(true);
    
    // Cleanup
    await TestUtilities.cleanupTestFiles(files);
  });
  
  test('Code analysis workflow', async () => {
    const repoPath = '/tmp/test-repo';
    const query = 'find main function';
    
    // Plan generation
    const startState = new CogneeWorldState();
    const goalState = new CogneeWorldState({
      codeRetrieved: true
    });
    
    const plan = planner.findPlan(startState, goalState);
    expect(plan).not.toBeNull();
    
    // Context
    const context = {
      repoPath,
      query,
      fullInput: query
    };
    
    // Execute with monitoring
    const replanner = new DynamicReplanner(planner, executor);
    const result = await replanner.executeWithReplanning(
      plan,
      startState,
      goalState,
      context
    );
    
    expect(result.success).toBe(true);
  });
});
```

### 4.2 Performance Benchmarks

```javascript
describe('Performance Benchmarks', () => {
  let env;
  
  beforeAll(async () => {
    env = await new CogneeTestEnvironment().setup();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  test('Dataset creation performance', async () => {
    const metrics = await TestUtilities.measurePerformance(async () => {
      const result = await env.mcpServer.executeTool('cognee.datasets', {
        action: 'create',
        name: `perf-test-${Date.now()}`
      });
      
      if (result.structuredContent?.id) {
        await env.cleanupDataset(result.structuredContent.id);
      }
    }, 10);
    
    expect(metrics.avg).toBeLessThan(1000); // < 1 second average
    expect(metrics.p95).toBeLessThan(2000); // < 2 seconds p95
  });
  
  test('Search performance', async () => {
    const metrics = await TestUtilities.measurePerformance(async () => {
      await env.mcpServer.executeTool('cognee.search', {
        searchType: 'CHUNKS',
        query: 'performance test',
        datasets: ['test-dataset']
      });
    }, 10);
    
    expect(metrics.avg).toBeLessThan(500); // < 500ms average
    expect(metrics.p95).toBeLessThan(1000); // < 1 second p95
  });
  
  test('Concurrent operations', async () => {
    const operations = Array.from({ length: 10 }, (_, i) => 
      env.mcpServer.executeTool('cognee.datasets', {
        action: 'list'
      })
    );
    
    const start = performance.now();
    const results = await Promise.all(operations);
    const duration = performance.now() - start;
    
    expect(results.every(r => !r.isError)).toBe(true);
    expect(duration).toBeLessThan(5000); // All complete within 5 seconds
  });
});
```

---

## Summary

This testing and validation phase provides:

1. **Complete test infrastructure** with mock servers and utilities
2. **Comprehensive unit tests** for all components
3. **Integration tests** for tool operations
4. **End-to-end workflow tests** with GOAP planning
5. **Performance benchmarks** with metrics collection

The testing framework ensures reliability, performance, and correctness
of the entire Cognee MCP integration.

---

*End of Part 6: Testing & Validation*
