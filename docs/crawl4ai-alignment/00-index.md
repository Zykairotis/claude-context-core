# Crawl4AI-GitHub Ingestion Alignment Plan

**Version:** 1.0  
**Created:** 2025-01-03  
**Status:** Planning Phase

---

## Executive Summary

This plan aligns the Crawl4AI ingestion pipeline with the proven GitHub ingestion architecture to achieve feature parity including hybrid search (SPLADE), cross-encoder reranking, symbol extraction, smart LLM query enhancement, and project-aware storage.

### Current Problem

Crawl4AI bypasses the `Context` class and directly manages:
- Custom Python chunking (not AST-aware)
- Direct GTE/CodeRank embedding calls
- Direct Postgres/Qdrant storage
- No reranking, no SPLADE, no symbol extraction
- Inconsistent with GitHub retrieval pipeline

### Target State

Crawl4AI becomes a lightweight web scraper that returns raw pages to `Context.indexWebPages()`, which applies the same full-featured pipeline as GitHub ingestion:
- ✅ AST-aware chunking
- ✅ SPLADE sparse vectors
- ✅ Cross-encoder reranking  
- ✅ Symbol extraction
- ✅ Smart LLM query enhancement
- ✅ Merkle tree sync
- ✅ Project-aware storage

---

## Plan Structure (12 Todos)

### **Phase 1: Core Architecture (Todos 1-4)**
- **[01-architecture-analysis](./01-architecture-analysis.md)** - Todo 1: Deep dive into GitHub architecture
- **[02-context-method](./02-context-method.md)** - Todo 2: Implement `Context.indexWebPages()`
- **[03-hybrid-search](./03-hybrid-search.md)** - Todo 3: Integrate SPLADE sparse vectors
- **[04-reranking](./04-reranking.md)** - Todo 4: Add cross-encoder reranking

### **Phase 2: Advanced Features (Todos 5-7)**
- **[05-symbol-extraction](./05-symbol-extraction.md)** - Todo 5: Enable symbol metadata extraction
- **[06-smart-query](./06-smart-query.md)** - Todo 6: Integrate LLM query enhancement
- **[07-provenance](./07-provenance.md)** - Todo 7: Web-specific provenance tracking

### **Phase 3: Service Layer (Todos 8-9)**
- **[08-crawl4ai-refactor](./08-crawl4ai-refactor.md)** - Todo 8: Simplify Crawl4AI to crawler-only
- **[09-mcp-integration](./09-mcp-integration.md)** - Todo 9: Update MCP server integration

### **Phase 4: Quality & Deployment (Todos 10-12)**
- **[10-testing-strategy](./10-testing-strategy.md)** - Todo 10: Comprehensive test suite
- **[11-migration-guide](./11-migration-guide.md)** - Todo 11: Migration & backward compatibility
- **[12-deployment](./12-deployment.md)** - Todo 12: Production deployment updates

---

## Success Metrics

### Performance
- **Latency**: Web page indexing within 2-5 seconds per page
- **Throughput**: 50+ chunks/sec processing rate
- **Quality**: +20-40% MRR@10 improvement with hybrid + reranking

### Feature Parity
| Feature | GitHub | Crawl4AI (Current) | Crawl4AI (Target) |
|---------|--------|-------------------|-------------------|
| AST Chunking | ✅ | ❌ | ✅ |
| SPLADE Sparse | ✅ | ❌ | ✅ |
| Reranking | ✅ | ❌ | ✅ |
| Symbol Extract | ✅ | ❌ | ✅ |
| Smart Query | ✅ | ❌ | ✅ |
| Merkle Sync | ✅ | ❌ | ✅ |
| Project Isolation | ✅ | ⚠️ Partial | ✅ |

### Code Quality
- Zero regressions in existing GitHub ingestion
- Test coverage >80% for new web ingestion paths
- All 12 todos completed with passing tests

---

## Dependencies & Prerequisites

### Infrastructure
- PostgreSQL 15+ with pgvector extension
- Qdrant 1.8+ (optional but recommended)
- SPLADE service running on port 30004
- Reranker service (TEI) running on port 30003

### Environment Variables
```bash
# Required
POSTGRES_CONNECTION_STRING=postgresql://...
OPENAI_API_KEY=sk-...
LLM_API_KEY=...

# Feature Flags
ENABLE_HYBRID_SEARCH=true
ENABLE_RERANKING=true
ENABLE_SYMBOL_EXTRACTION=true

# Service Endpoints
SPLADE_URL=http://localhost:30004
RERANKER_URL=http://localhost:30003
CRAWL4AI_URL=http://localhost:7070
```

### Development Tools
- Node.js 18+
- TypeScript 5+
- Python 3.10+ (Crawl4AI service)
- Docker Compose (for services)

---

## Implementation Timeline

### Week 1: Core Architecture
- Day 1-2: Todo 1 (Architecture analysis)
- Day 3-4: Todo 2 (Context.indexWebPages())
- Day 5-7: Todo 3-4 (SPLADE + Reranking)

### Week 2: Advanced Features
- Day 8-9: Todo 5-6 (Symbol extraction + Smart query)
- Day 10-11: Todo 7 (Provenance tracking)
- Day 12-14: Integration testing

### Week 3: Service & Deployment
- Day 15-16: Todo 8-9 (Crawl4AI refactor + MCP)
- Day 17-18: Todo 10 (Testing strategy)
- Day 19-20: Todo 11 (Migration guide)
- Day 21: Todo 12 (Deployment)

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Breaking existing GitHub flow | High | Low | Comprehensive test suite, feature flags |
| SPLADE service downtime | Medium | Medium | Graceful fallback to dense-only |
| Performance regression | Medium | Low | Benchmark before/after, incremental rollout |
| Migration complexity | Medium | High | Clear docs, automated migration scripts |

### Team Coordination
- Daily standups for blockers
- Code reviews within 24 hours
- Pair programming for critical paths
- Weekly progress demos

---

## Getting Started

1. **Read the architecture analysis**: [01-architecture-analysis.md](./01-architecture-analysis.md)
2. **Set up development environment**:
   ```bash
   cd /home/mewtwo/Zykairotis/claude-context-core
   npm install
   docker-compose -f services/docker-compose.yml up -d
   npm run build
   ```
3. **Run existing tests** to establish baseline:
   ```bash
   npm run test
   ```
4. **Follow todos sequentially** - each builds on the previous

---

## Document Conventions

### Code Examples
- TypeScript uses strict typing
- Python follows PEP 8
- All examples are runnable

### File References
- Absolute paths from project root
- Line number citations where relevant
- Links to actual implementation

### Status Indicators
- ✅ Completed
- 🚧 In Progress  
- ⏳ Blocked
- ❌ Not Started
- ⚠️ Needs Review

---

## Questions & Support

- **Architecture questions**: See [01-architecture-analysis.md](./01-architecture-analysis.md)
- **Implementation help**: Refer to specific todo documents
- **Bug reports**: Include reproduction steps and environment details

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-03 | Initial plan creation |

---

**Next:** Start with [01-architecture-analysis.md](./01-architecture-analysis.md) to understand the GitHub ingestion flow in detail.
