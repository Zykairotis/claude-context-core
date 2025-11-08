# Part 4: Cognee MCP Integration - Execution Monitoring & Observability
## GOAP Planning Phase 4: OODA Loop Implementation

### Executive Summary
This document implements the OODA (Observe-Orient-Decide-Act) loop for monitoring
and managing Cognee MCP tool execution. We provide comprehensive telemetry,
error recovery, and adaptive replanning strategies.

---

## 1. Execution Monitor Architecture

### 1.1 Core Monitor Implementation

```javascript
/**
 * OODA Loop Execution Monitor for Cognee Operations
 * Observe: Monitor execution state and collect metrics
 * Orient: Analyze patterns and detect anomalies
 * Decide: Determine if intervention is needed
 * Act: Execute corrective actions or replanning
 */
class CogneeExecutionMonitor {
  constructor() {
    this.metrics = new Map();
    this.history = [];
    this.activeExecutions = new Map();
    this.thresholds = {
      maxRetries: 3,
      timeoutMs: 30000,
      slowThresholdMs: 5000,
      errorRateThreshold: 0.2
    };
  }
  
  /**
   * OBSERVE: Monitor execution and collect data
   */
  async observe(executionId, action, startTime) {
    const observation = {
      id: executionId,
      action: action.name,
      tool: action.toolName,
      startTime,
      status: 'running',
      metrics: {
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      }
    };
    
    this.activeExecutions.set(executionId, observation);
    
    // Set timeout monitor
    setTimeout(() => {
      if (this.activeExecutions.has(executionId)) {
        this.handleTimeout(executionId);
      }
    }, this.thresholds.timeoutMs);
    
    return observation;
  }
  
  /**
   * ORIENT: Analyze execution patterns
   */
  orient(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return null;
    
    const duration = Date.now() - execution.startTime;
    const analysis = {
      executionId,
      duration,
      isSlow: duration > this.thresholds.slowThresholdMs,
      isTimeout: duration > this.thresholds.timeoutMs,
      errorRate: this.calculateErrorRate(execution.action),
      resourceUsage: this.analyzeResourceUsage(execution.metrics)
    };
    
    // Pattern detection
    analysis.patterns = this.detectPatterns(execution.action);
    analysis.anomalies = this.detectAnomalies(execution);
    
    return analysis;
  }
  
  /**
   * DECIDE: Determine action based on analysis
   */
  decide(analysis) {
    const decisions = [];
    
    if (analysis.isTimeout) {
      decisions.push({ type: 'CANCEL', reason: 'timeout' });
    }
    
    if (analysis.isSlow && !analysis.isTimeout) {
      decisions.push({ type: 'WARN', reason: 'slow_execution' });
    }
    
    if (analysis.errorRate > this.thresholds.errorRateThreshold) {
      decisions.push({ type: 'CIRCUIT_BREAK', reason: 'high_error_rate' });
    }
    
    if (analysis.anomalies.length > 0) {
      decisions.push({ 
        type: 'INVESTIGATE', 
        reason: 'anomaly_detected',
        details: analysis.anomalies
      });
    }
    
    return decisions;
  }
  
  /**
   * ACT: Execute decisions
   */
  async act(decisions, executionContext) {
    const actions = [];
    
    for (const decision of decisions) {
      switch (decision.type) {
        case 'CANCEL':
          actions.push(this.cancelExecution(executionContext));
          break;
          
        case 'WARN':
          actions.push(this.logWarning(decision, executionContext));
          break;
          
        case 'CIRCUIT_BREAK':
          actions.push(this.activateCircuitBreaker(executionContext));
          break;
          
        case 'INVESTIGATE':
          actions.push(this.triggerInvestigation(decision.details));
          break;
      }
    }
    
    return await Promise.all(actions);
  }
  
  // Helper methods
  calculateErrorRate(actionName) {
    const recent = this.history.filter(
      h => h.action === actionName && 
      Date.now() - h.timestamp < 300000 // Last 5 minutes
    );
    
    if (recent.length === 0) return 0;
    
    const errors = recent.filter(h => h.status === 'error').length;
    return errors / recent.length;
  }
  
  analyzeResourceUsage(metrics) {
    return {
      cpu: metrics.cpuUsage.user + metrics.cpuUsage.system,
      memory: metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal,
      isHighCpu: (metrics.cpuUsage.user + metrics.cpuUsage.system) > 80,
      isHighMemory: metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.9
    };
  }
  
  detectPatterns(actionName) {
    const patterns = [];
    const actionHistory = this.history.filter(h => h.action === actionName);
    
    // Detect repeated failures
    const recentFailures = actionHistory
      .slice(-5)
      .filter(h => h.status === 'error');
    
    if (recentFailures.length >= 3) {
      patterns.push({
        type: 'REPEATED_FAILURE',
        count: recentFailures.length,
        timespan: Date.now() - recentFailures[0].timestamp
      });
    }
    
    // Detect performance degradation
    const durations = actionHistory.slice(-10).map(h => h.duration);
    if (durations.length >= 5) {
      const avgRecent = durations.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const avgPrevious = durations.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      
      if (avgRecent > avgPrevious * 1.5) {
        patterns.push({
          type: 'PERFORMANCE_DEGRADATION',
          recentAvg: avgRecent,
          previousAvg: avgPrevious,
          degradation: (avgRecent / avgPrevious - 1) * 100
        });
      }
    }
    
    return patterns;
  }
  
  detectAnomalies(execution) {
    const anomalies = [];
    const baseline = this.getBaseline(execution.action);
    
    if (baseline) {
      const duration = Date.now() - execution.startTime;
      
      // Duration anomaly
      if (duration > baseline.avgDuration * 2) {
        anomalies.push({
          type: 'DURATION_ANOMALY',
          expected: baseline.avgDuration,
          actual: duration
        });
      }
      
      // Resource anomaly
      if (execution.metrics.memoryUsage.heapUsed > baseline.avgMemory * 1.5) {
        anomalies.push({
          type: 'MEMORY_ANOMALY',
          expected: baseline.avgMemory,
          actual: execution.metrics.memoryUsage.heapUsed
        });
      }
    }
    
    return anomalies;
  }
  
  getBaseline(actionName) {
    const relevant = this.history.filter(
      h => h.action === actionName && h.status === 'success'
    );
    
    if (relevant.length < 5) return null;
    
    return {
      avgDuration: relevant.reduce((sum, h) => sum + h.duration, 0) / relevant.length,
      avgMemory: relevant.reduce((sum, h) => sum + h.memoryUsage, 0) / relevant.length
    };
  }
}
```

### 1.2 Telemetry Collection

```javascript
/**
 * Comprehensive telemetry for Cognee operations
 */
class CogneeTelemetry {
  constructor() {
    this.spans = new Map();
    this.metrics = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map()
    };
  }
  
  startSpan(name, attributes = {}) {
    const spanId = this.generateId();
    const span = {
      id: spanId,
      name,
      startTime: Date.now(),
      attributes,
      events: [],
      status: 'running'
    };
    
    this.spans.set(spanId, span);
    return spanId;
  }
  
  endSpan(spanId, status = 'success', error = null) {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    
    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }
    
    // Update metrics
    this.recordMetrics(span);
    
    return span;
  }
  
  recordEvent(spanId, name, attributes = {}) {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }
  
  recordMetrics(span) {
    // Counter: total operations
    this.incrementCounter(`cognee.${span.name}.total`);
    
    // Counter: by status
    this.incrementCounter(`cognee.${span.name}.${span.status}`);
    
    // Histogram: duration
    this.recordHistogram(`cognee.${span.name}.duration`, span.duration);
    
    // Gauge: active operations
    if (span.status === 'running') {
      this.setGauge(`cognee.${span.name}.active`, 
        this.metrics.gauges.get(`cognee.${span.name}.active`) || 0 + 1);
    } else {
      this.setGauge(`cognee.${span.name}.active`, 
        Math.max(0, (this.metrics.gauges.get(`cognee.${span.name}.active`) || 0) - 1));
    }
  }
  
  incrementCounter(name, value = 1) {
    const current = this.metrics.counters.get(name) || 0;
    this.metrics.counters.set(name, current + value);
  }
  
  setGauge(name, value) {
    this.metrics.gauges.set(name, value);
  }
  
  recordHistogram(name, value) {
    if (!this.metrics.histograms.has(name)) {
      this.metrics.histograms.set(name, []);
    }
    this.metrics.histograms.get(name).push(value);
  }
  
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getMetricsSummary() {
    const summary = {
      counters: Object.fromEntries(this.metrics.counters),
      gauges: Object.fromEntries(this.metrics.gauges),
      histograms: {}
    };
    
    // Calculate histogram statistics
    for (const [name, values] of this.metrics.histograms) {
      if (values.length === 0) continue;
      
      values.sort((a, b) => a - b);
      summary.histograms[name] = {
        count: values.length,
        min: values[0],
        max: values[values.length - 1],
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        p99: values[Math.floor(values.length * 0.99)]
      };
    }
    
    return summary;
  }
}
```

---

## 2. Execution Pipeline

### 2.1 Execution Orchestrator

```javascript
/**
 * Main execution orchestrator for Cognee operations
 */
class CogneeExecutor {
  constructor(monitor, telemetry) {
    this.monitor = monitor;
    this.telemetry = telemetry;
    this.circuitBreakers = new Map();
  }
  
  async executePlan(plan, context) {
    const executionId = this.telemetry.generateId();
    const planSpan = this.telemetry.startSpan('plan.execution', {
      planLength: plan.length,
      context: context.datasetName
    });
    
    const results = [];
    
    try {
      for (let i = 0; i < plan.length; i++) {
        const action = plan[i];
        
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(action.toolName)) {
          throw new Error(`Circuit breaker open for ${action.toolName}`);
        }
        
        // Execute with monitoring
        const result = await this.executeAction(action, context, i, plan.length);
        results.push(result);
        
        // Update context with results
        this.updateContext(context, action, result);
        
        // Check if we should continue
        if (!result.success && action.critical) {
          throw new Error(`Critical action failed: ${action.name}`);
        }
      }
      
      this.telemetry.endSpan(planSpan, 'success');
      return { success: true, results };
      
    } catch (error) {
      this.telemetry.endSpan(planSpan, 'error', error);
      return { success: false, error, results };
    }
  }
  
  async executeAction(action, context, index, total) {
    const actionSpan = this.telemetry.startSpan(`action.${action.name}`, {
      tool: action.toolName,
      index,
      total
    });
    
    const executionId = this.telemetry.generateId();
    const startTime = Date.now();
    
    // Start monitoring
    const observation = await this.monitor.observe(executionId, action, startTime);
    
    try {
      // Get tool parameters
      const params = typeof action.params === 'function' 
        ? action.params(context) 
        : action.params;
      
      // Log execution start
      this.telemetry.recordEvent(actionSpan, 'execution.start', { params });
      
      // Execute tool
      let result;
      if (action.toolName) {
        result = await mcpServer.executeTool(action.toolName, params);
      } else {
        // Direct execution for non-MCP actions
        result = await this.executeDirectAction(action, params);
      }
      
      // Record success
      const duration = Date.now() - startTime;
      this.telemetry.recordEvent(actionSpan, 'execution.complete', { 
        duration,
        success: !result.isError 
      });
      
      // Complete monitoring
      this.monitor.activeExecutions.delete(executionId);
      this.monitor.history.push({
        action: action.name,
        status: result.isError ? 'error' : 'success',
        duration,
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage().heapUsed
      });
      
      // OODA loop analysis
      const analysis = this.monitor.orient(executionId);
      if (analysis) {
        const decisions = this.monitor.decide(analysis);
        if (decisions.length > 0) {
          await this.monitor.act(decisions, { action, context });
        }
      }
      
      this.telemetry.endSpan(actionSpan, result.isError ? 'error' : 'success');
      
      return {
        success: !result.isError,
        action: action.name,
        result,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error
      this.telemetry.recordEvent(actionSpan, 'execution.error', {
        error: error.message,
        duration
      });
      
      // Update circuit breaker
      this.recordCircuitBreakerFailure(action.toolName);
      
      // Complete monitoring
      this.monitor.activeExecutions.delete(executionId);
      this.monitor.history.push({
        action: action.name,
        status: 'error',
        duration,
        timestamp: Date.now(),
        error: error.message
      });
      
      this.telemetry.endSpan(actionSpan, 'error', error);
      
      return {
        success: false,
        action: action.name,
        error: error.message,
        duration
      };
    }
  }
  
  async executeDirectAction(action, params) {
    // Handle non-MCP actions like connection checks
    switch (action.name) {
      case 'checkConnection':
        return await this.checkCogneeConnection();
        
      case 'setupAuth':
        return this.checkAuthentication();
        
      default:
        throw new Error(`Unknown direct action: ${action.name}`);
    }
  }
  
  async checkCogneeConnection() {
    try {
      const response = await fetch(`${getCogneeBase()}/health`, {
        headers: authHeaders()
      });
      
      return {
        isError: !response.ok,
        content: [{
          type: 'text',
          text: response.ok ? 'Connection successful' : 'Connection failed'
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: error.message }]
      };
    }
  }
  
  checkAuthentication() {
    const hasToken = !!process.env.COGNEE_TOKEN;
    const isCloudAPI = getCogneeBase().includes('api.cognee.ai');
    
    if (isCloudAPI && !hasToken) {
      return {
        isError: true,
        content: [{ 
          type: 'text', 
          text: 'Authentication required for cloud API. Set COGNEE_TOKEN.' 
        }]
      };
    }
    
    return {
      isError: false,
      content: [{ type: 'text', text: 'Authentication configured' }]
    };
  }
  
  updateContext(context, action, result) {
    // Update context based on action results
    if (result.success && result.result?.structuredContent) {
      const content = result.result.structuredContent;
      
      switch (action.name) {
        case 'createDataset':
          context.datasetId = content.id;
          context.datasetName = content.name;
          break;
          
        case 'cognifyBlocking':
          context.pipelineComplete = true;
          context.stats = content.stats;
          break;
          
        case 'searchChunks':
        case 'searchRAG':
          context.searchResults = content;
          break;
      }
    }
  }
  
  // Circuit breaker implementation
  isCircuitBreakerOpen(toolName) {
    const breaker = this.circuitBreakers.get(toolName);
    if (!breaker) return false;
    
    if (breaker.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  recordCircuitBreakerFailure(toolName) {
    if (!this.circuitBreakers.has(toolName)) {
      this.circuitBreakers.set(toolName, {
        failures: 0,
        state: 'closed',
        lastFailure: 0,
        timeout: 60000 // 1 minute
      });
    }
    
    const breaker = this.circuitBreakers.get(toolName);
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      console.error(`Circuit breaker opened for ${toolName}`);
    }
  }
}
```

---

## 3. Error Recovery Strategies

### 3.1 Retry Policies

```javascript
/**
 * Intelligent retry policies for Cognee operations
 */
class RetryPolicy {
  constructor() {
    this.policies = {
      exponential: this.exponentialBackoff.bind(this),
      linear: this.linearBackoff.bind(this),
      immediate: this.immediateRetry.bind(this),
      custom: this.customPolicy.bind(this)
    };
  }
  
  async execute(operation, policyName = 'exponential', options = {}) {
    const policy = this.policies[policyName];
    if (!policy) {
      throw new Error(`Unknown retry policy: ${policyName}`);
    }
    
    const config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      ...options
    };
    
    return await policy(operation, config);
  }
  
  async exponentialBackoff(operation, config) {
    let lastError;
    
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (this.isNonRetryable(error)) {
          throw error;
        }
        
        if (attempt < config.maxRetries - 1) {
          const delay = Math.min(
            config.initialDelay * Math.pow(2, attempt),
            config.maxDelay
          );
          
          console.log(`Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  async linearBackoff(operation, config) {
    let lastError;
    
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isNonRetryable(error)) {
          throw error;
        }
        
        if (attempt < config.maxRetries - 1) {
          const delay = config.initialDelay * (attempt + 1);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  async immediateRetry(operation, config) {
    let lastError;
    
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isNonRetryable(error)) {
          throw error;
        }
      }
    }
    
    throw lastError;
  }
  
  async customPolicy(operation, config) {
    // Custom retry logic based on error type
    let lastError;
    
    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const strategy = this.determineStrategy(error);
        
        if (strategy === 'abort') {
          throw error;
        }
        
        if (attempt < config.maxRetries - 1) {
          const delay = this.calculateDelay(error, attempt, config);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  isNonRetryable(error) {
    // 4xx errors are generally not retryable
    if (error.statusCode >= 400 && error.statusCode < 500) {
      // Except for 429 (rate limit) and 408 (timeout)
      return error.statusCode !== 429 && error.statusCode !== 408;
    }
    
    // Specific error messages that shouldn't be retried
    const nonRetryableMessages = [
      'Invalid credentials',
      'Insufficient permissions',
      'Resource not found',
      'Invalid request'
    ];
    
    return nonRetryableMessages.some(msg => 
      error.message?.toLowerCase().includes(msg.toLowerCase())
    );
  }
  
  determineStrategy(error) {
    if (error.statusCode === 429) return 'backoff';
    if (error.code === 'ETIMEDOUT') return 'retry';
    if (error.code === 'ECONNREFUSED') return 'wait';
    return 'abort';
  }
  
  calculateDelay(error, attempt, config) {
    if (error.statusCode === 429) {
      // Use rate limit headers if available
      const retryAfter = error.headers?.['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000;
      }
    }
    
    return Math.min(
      config.initialDelay * Math.pow(1.5, attempt),
      config.maxDelay
    );
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Summary

This execution monitoring phase provides:

1. **Complete OODA loop** implementation for adaptive monitoring
2. **Comprehensive telemetry** with spans, metrics, and events
3. **Execution orchestration** with circuit breakers
4. **Intelligent retry policies** for error recovery
5. **Real-time observability** for all Cognee operations

The system can detect anomalies, adapt to failures, and maintain
high availability through intelligent monitoring and recovery strategies.

---

*End of Part 4: Execution Monitoring & Observability*
