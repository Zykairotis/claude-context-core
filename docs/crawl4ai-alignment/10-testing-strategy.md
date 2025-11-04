# Todo 10: Comprehensive Testing Strategy

**Status:** ⏳ Not Started  
**Complexity:** High  
**Estimated Time:** 10-14 hours  
**Dependencies:** Todo 2-9 (All implementation)

---

## Objective

Build comprehensive test suite covering unit, integration, and E2E tests for unified web ingestion.

---

## Test Coverage Goals

- **Unit Tests:** 70% coverage
- **Integration Tests:** 25% coverage  
- **E2E Tests:** 5% coverage
- **Overall Target:** >80% coverage

---

## Unit Tests

### Markdown Parsing

```typescript
describe('parseMarkdownSections', () => {
  it('should separate code from text', () => {
    const content = '# Title\n```ts\ncode\n```\ntext';
    const sections = parseMarkdownSections(content);
    expect(sections[0].type).toBe('text');
    expect(sections[1].type).toBe('code');
  });
});
```

### Symbol Extraction

```typescript
describe('extractSymbolsWithRegex', () => {
  it('should extract function names', () => {
    const metadata = extractSymbolsWithRegex(
      'function useState() {}',
      'typescript'
    );
    expect(metadata?.name).toBe('useState');
  });
});
```

---

## Integration Tests

### Full Ingestion Pipeline

```typescript
describe('Context.indexWebPages', () => {
  it('should index pages with all features', async () => {
    const pages = [{
      url: 'https://example.com',
      content: '# Title\n```ts\nfunction test() {}\n```',
      title: 'Test'
    }];
    
    const stats = await context.indexWebPages(
      pages, 'test-project', 'test-dataset'
    );
    
    expect(stats.processedPages).toBe(1);
    expect(stats.totalChunks).toBeGreaterThan(0);
  });
});
```

### SPLADE Integration

```typescript
describe('SpladeClient', () => {
  it('should generate sparse vectors', async () => {
    const vectors = await client.computeSparseBatch(['test']);
    expect(vectors[0].indices.length).toBeGreaterThan(0);
  });
});
```

---

## E2E Tests

### MCP Workflow

```typescript
describe('MCP Crawl E2E', () => {
  it('should crawl, index, and search', async () => {
    await mcpClient.callTool('claudeContext.crawl', {
      url: 'https://example.com',
      project: 'e2e-test'
    });
    
    const results = await mcpClient.callTool('claudeContext.search', {
      query: 'test',
      project: 'e2e-test'
    });
    
    expect(results.metadata.resultsCount).toBeGreaterThan(0);
  });
});
```

---

## Test Commands

```bash
# Unit tests
npm run test:unit

# Integration tests (requires services)
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

---

## Next Steps

Proceed to [11-migration-guide.md](./11-migration-guide.md).

---

**Completion Criteria:**
- ✅ >80% test coverage
- ✅ All tests pass
- ✅ CI/CD integration
- ✅ Performance benchmarks met
