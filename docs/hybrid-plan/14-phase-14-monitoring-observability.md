# Phase 14: Monitoring & Observability

## 🎯 Objective
Implement comprehensive monitoring, observability, and alerting systems to ensure the unified architecture operates reliably and efficiently.

## 🏗️ Observability Stack

### Unified Telemetry System
```typescript
import { Tracer } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

export class UnifiedObservability {
    private tracer: Tracer;
    private metricsExporter: PrometheusExporter;
    private tracingExporter: JaegerExporter;
    private healthChecks: Map<string, HealthCheck>;
    
    constructor() {
        this.setupOpenTelemetry();
        this.setupHealthChecks();
        this.setupCustomMetrics();
    }
    
    private setupOpenTelemetry(): void {
        // Tracing setup
        this.tracingExporter = new JaegerExporter({
            endpoint: 'http://jaeger:14268/api/traces',
            serviceName: 'unified-storage'
        });
        
        // Metrics setup
        this.metricsExporter = new PrometheusExporter({
            port: 9090,
            endpoint: '/metrics'
        });
        
        // Logging correlation
        this.setupLoggingCorrelation();
    }
    
    async traceOperation<T>(
        name: string,
        operation: () => Promise<T>,
        attributes?: Record<string, any>
    ): Promise<T> {
        
        const span = this.tracer.startSpan(name, {
            attributes: {
                'system.component': 'unified-storage',
                ...attributes
            }
        });
        
        try {
            // Add trace context to logs
            const traceId = span.spanContext().traceId;
            logger.setContext({ traceId });
            
            // Execute operation
            const result = await operation();
            
            // Record success
            span.setStatus({ code: SpanStatusCode.OK });
            
            return result;
            
        } catch (error) {
            // Record error
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message
            });
            
            span.recordException(error);
            throw error;
            
        } finally {
            span.end();
        }
    }
}
```

## 📊 Metrics Collection

### Comprehensive Metrics System
```python
from prometheus_client import Counter, Histogram, Gauge, Summary
from prometheus_client import CollectorRegistry, push_to_gateway
import time
from functools import wraps

class MetricsCollector:
    """Collect and expose metrics for all systems."""
    
    def __init__(self):
        self.registry = CollectorRegistry()
        
        # Query metrics
        self.query_counter = Counter(
            'unified_queries_total',
            'Total number of queries',
            ['system', 'query_type', 'status'],
            registry=self.registry
        )
        
        self.query_duration = Histogram(
            'unified_query_duration_seconds',
            'Query execution duration',
            ['system', 'query_type'],
            buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
            registry=self.registry
        )
        
        # Storage metrics
        self.storage_usage = Gauge(
            'unified_storage_bytes',
            'Storage usage in bytes',
            ['system', 'type'],
            registry=self.registry
        )
        
        self.chunk_count = Gauge(
            'unified_chunks_total',
            'Total number of chunks',
            ['system', 'source_type'],
            registry=self.registry
        )
        
        # Performance metrics
        self.cache_hits = Counter(
            'unified_cache_hits_total',
            'Cache hit count',
            ['cache_level'],
            registry=self.registry
        )
        
        self.embedding_latency = Summary(
            'unified_embedding_latency_seconds',
            'Embedding generation latency',
            ['model'],
            registry=self.registry
        )
        
        # System health
        self.system_health = Gauge(
            'unified_system_health',
            'System health score (0-100)',
            ['component'],
            registry=self.registry
        )
    
    def track_query(self, system: str, query_type: str):
        """Decorator to track query metrics."""
        
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                    self.query_counter.labels(
                        system=system,
                        query_type=query_type,
                        status='success'
                    ).inc()
                    
                    return result
                    
                except Exception as e:
                    self.query_counter.labels(
                        system=system,
                        query_type=query_type,
                        status='error'
                    ).inc()
                    raise e
                    
                finally:
                    duration = time.time() - start_time
                    self.query_duration.labels(
                        system=system,
                        query_type=query_type
                    ).observe(duration)
            
            return wrapper
        return decorator
    
    async def collect_system_metrics(self):
        """Collect system-wide metrics."""
        
        while True:
            # Collect storage metrics
            await self.collect_storage_metrics()
            
            # Collect performance metrics
            await self.collect_performance_metrics()
            
            # Calculate health scores
            await self.calculate_health_scores()
            
            # Push to Prometheus gateway
            push_to_gateway(
                'prometheus-pushgateway:9091',
                job='unified_storage',
                registry=self.registry
            )
            
            await asyncio.sleep(30)  # Collect every 30 seconds
```

## 🔍 Distributed Tracing

### Request Tracing
```typescript
export class DistributedTracer {
    private tracer: Tracer;
    
    async traceRequest(
        requestId: string,
        operation: string
    ): Promise<TraceContext> {
        
        const rootSpan = this.tracer.startSpan('request', {
            attributes: {
                'request.id': requestId,
                'operation': operation,
                'timestamp': Date.now()
            }
        });
        
        return {
            span: rootSpan,
            traceId: rootSpan.spanContext().traceId,
            
            // Trace through Claude-Context
            traceClaude: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('claude-context', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            // Trace through Cognee
            traceCognee: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('cognee', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            // Trace through Neo4j
            traceNeo4j: async (operation: () => Promise<any>) => {
                const span = this.tracer.startSpan('neo4j', {
                    parent: rootSpan
                });
                
                try {
                    return await operation();
                } finally {
                    span.end();
                }
            },
            
            end: () => rootSpan.end()
        };
    }
}
```

## 🚨 Alerting System

### Intelligent Alert Manager
```python
from typing import Dict, List
import asyncio
from datetime import datetime, timedelta

class AlertManager:
    """Intelligent alerting with deduplication and escalation."""
    
    def __init__(self):
        self.alert_rules = []
        self.active_alerts = {}
        self.alert_history = []
        self.notification_channels = []
        
        self.setup_alert_rules()
        self.setup_notification_channels()
    
    def setup_alert_rules(self):
        """Define alert rules."""
        
        self.alert_rules = [
            # Performance alerts
            AlertRule(
                name="high_latency",
                condition=lambda m: m['p95_latency'] > 500,  # 500ms
                severity="warning",
                message="Query latency p95 > 500ms"
            ),
            
            AlertRule(
                name="critical_latency",
                condition=lambda m: m['p95_latency'] > 1000,  # 1s
                severity="critical",
                message="Query latency p95 > 1s",
                escalation_time=timedelta(minutes=5)
            ),
            
            # Resource alerts
            AlertRule(
                name="high_memory",
                condition=lambda m: m['memory_usage'] > 85,
                severity="warning",
                message="Memory usage > 85%"
            ),
            
            AlertRule(
                name="storage_full",
                condition=lambda m: m['storage_usage'] > 90,
                severity="critical",
                message="Storage usage > 90%",
                auto_remediate=True
            ),
            
            # Error rate alerts
            AlertRule(
                name="high_error_rate",
                condition=lambda m: m['error_rate'] > 1,  # 1%
                severity="warning",
                message="Error rate > 1%"
            ),
            
            # System health
            AlertRule(
                name="unhealthy_component",
                condition=lambda m: any(h < 50 for h in m['health_scores'].values()),
                severity="critical",
                message="Component health score < 50"
            )
        ]
    
    async def check_alerts(self, metrics: Dict):
        """Check metrics against alert rules."""
        
        for rule in self.alert_rules:
            if rule.condition(metrics):
                await self.trigger_alert(rule, metrics)
            else:
                await self.resolve_alert(rule)
    
    async def trigger_alert(self, rule: AlertRule, metrics: Dict):
        """Trigger an alert."""
        
        alert_id = f"{rule.name}_{datetime.now().timestamp()}"
        
        # Check for deduplication
        if rule.name in self.active_alerts:
            existing = self.active_alerts[rule.name]
            
            # Update existing alert
            existing['count'] += 1
            existing['last_seen'] = datetime.now()
            
            # Check for escalation
            if rule.escalation_time and \
               datetime.now() - existing['first_seen'] > rule.escalation_time:
                await self.escalate_alert(existing, rule)
            
        else:
            # New alert
            alert = {
                'id': alert_id,
                'rule': rule,
                'metrics': metrics,
                'first_seen': datetime.now(),
                'last_seen': datetime.now(),
                'count': 1
            }
            
            self.active_alerts[rule.name] = alert
            
            # Send notifications
            await self.send_notifications(alert)
            
            # Auto-remediate if configured
            if rule.auto_remediate:
                await self.auto_remediate(rule, metrics)
```

## 📈 Dashboard & Visualization

### Real-Time Dashboard
```typescript
export class MonitoringDashboard {
    private grafanaClient: GrafanaClient;
    private dashboards: Map<string, Dashboard>;
    
    constructor() {
        this.setupDashboards();
    }
    
    private setupDashboards(): void {
        // Main system dashboard
        this.dashboards.set('system', {
            uid: 'unified-system',
            title: 'Unified Storage System',
            panels: [
                // Query performance
                {
                    title: 'Query Latency',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'histogram_quantile(0.95, unified_query_duration_seconds)',
                            legend: 'p95 latency'
                        }
                    ]
                },
                
                // System health
                {
                    title: 'System Health',
                    type: 'stat',
                    targets: [
                        {
                            expr: 'unified_system_health',
                            legend: '{{component}}'
                        }
                    ]
                },
                
                // Resource usage
                {
                    title: 'Resource Usage',
                    type: 'gauge',
                    targets: [
                        {
                            expr: 'unified_storage_bytes / (1024*1024*1024)',
                            legend: 'Storage (GB)'
                        }
                    ]
                },
                
                // Error rates
                {
                    title: 'Error Rate',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_queries_total{status="error"}[5m])',
                            legend: 'Errors per second'
                        }
                    ]
                }
            ]
        });
        
        // Performance dashboard
        this.dashboards.set('performance', {
            uid: 'unified-performance',
            title: 'Performance Metrics',
            panels: [
                // Cache performance
                {
                    title: 'Cache Hit Rate',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_cache_hits_total[5m]) / rate(unified_queries_total[5m])',
                            legend: '{{cache_level}}'
                        }
                    ]
                },
                
                // Throughput
                {
                    title: 'Query Throughput',
                    type: 'graph',
                    targets: [
                        {
                            expr: 'rate(unified_queries_total[1m])',
                            legend: 'QPS'
                        }
                    ]
                }
            ]
        });
    }
}
```

## 🔧 Health Checks

### Comprehensive Health Monitoring
```python
class HealthMonitor:
    """Monitor health of all components."""
    
    async def check_all_health(self) -> HealthReport:
        """Check health of all systems."""
        
        checks = await asyncio.gather(
            self.check_postgres_health(),
            self.check_qdrant_health(),
            self.check_neo4j_health(),
            self.check_redis_health(),
            self.check_api_health(),
            return_exceptions=True
        )
        
        report = HealthReport()
        
        for check in checks:
            if isinstance(check, Exception):
                report.add_failure(str(check))
            else:
                report.add_check(check)
        
        # Calculate overall health score
        report.calculate_score()
        
        return report
    
    async def check_postgres_health(self) -> HealthCheck:
        """Check PostgreSQL health."""
        
        try:
            # Check connection
            conn = await asyncpg.connect(DATABASE_URL)
            
            # Check replication lag
            lag = await conn.fetchval(
                "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))"
            )
            
            # Check active connections
            connections = await conn.fetchval(
                "SELECT count(*) FROM pg_stat_activity"
            )
            
            await conn.close()
            
            return HealthCheck(
                component='postgres',
                status='healthy' if lag < 10 else 'degraded',
                metrics={
                    'replication_lag': lag,
                    'active_connections': connections
                }
            )
            
        except Exception as e:
            return HealthCheck(
                component='postgres',
                status='unhealthy',
                error=str(e)
            )
```

## 🎯 Success Metrics

- Alert response time: < 1 minute
- False positive rate: < 5%
- Dashboard load time: < 2 seconds
- Metric collection overhead: < 2% CPU
- Log correlation accuracy: > 95%
- Trace completion: > 99%

---

**Status**: ⏳ Pending  
**Estimated Duration**: 5-6 days  
**Dependencies**: Phases 1-13  
**Output**: Complete observability platform with monitoring and alerting
