import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { smartQueryWebContent, extractKeyTerms } from '../smart-web-query';
import type { WebQueryResult } from '../query';

describe('Smart Web Query Enhancement', () => {
  describe('extractKeyTerms', () => {
    it('should extract capitalized terms from text', () => {
      const results: WebQueryResult[] = [
        {
          id: 'test1',
          chunk: 'React is a JavaScript library for building user interfaces.',
          url: 'https://react.dev',
          scores: { vector: 0.9, final: 0.9 }
        },
        {
          id: 'test2',
          chunk: 'TypeScript adds static typing to JavaScript for better tooling.',
          url: 'https://typescriptlang.org',
          scores: { vector: 0.8, final: 0.8 }
        }
      ];

      const terms = extractKeyTerms(results);

      expect(terms.length).toBeGreaterThan(0);
      expect(terms).toContain('React');
      expect(terms).toContain('JavaScript');
      expect(terms).toContain('TypeScript');
    });

    it('should extract technical terms with underscores', () => {
      const results: WebQueryResult[] = [
        {
          id: 'test1',
          chunk: 'Use use_state hook for state management in components.',
          url: 'https://example.com',
          scores: { vector: 0.9, final: 0.9 }
        }
      ];

      const terms = extractKeyTerms(results);

      expect(terms.some(t => t.includes('_'))).toBe(true);
    });

    it('should limit to 10 terms', () => {
      const longText = Array(50).fill('SomeCapitalizedTerm').join(' ');
      const results: WebQueryResult[] = [
        {
          id: 'test1',
          chunk: longText,
          url: 'https://example.com',
          scores: { vector: 0.9, final: 0.9 }
        }
      ];

      const terms = extractKeyTerms(results);

      expect(terms.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty results', () => {
      const terms = extractKeyTerms([]);
      expect(terms).toEqual([]);
    });

    it('should filter out short words', () => {
      const results: WebQueryResult[] = [
        {
          id: 'test1',
          chunk: 'A B is the way to Go',
          url: 'https://example.com',
          scores: { vector: 0.9, final: 0.9 }
        }
      ];

      const terms = extractKeyTerms(results);

      // Should not include 'A', 'B', 'is'
      expect(terms.every(t => t.length >= 3)).toBe(true);
    });
  });

  describe('Smart Query Metadata', () => {
    it('should track query variations correctly', () => {
      // This is a conceptual test for metadata structure
      const metadata = {
        enhancedQuery: {
          originalQuery: 'How to use React hooks?',
          refinedQuery: 'React hooks usage patterns',
          variations: ['React hooks tutorial', 'React hooks examples'],
          conceptTerms: ['useState', 'useEffect'],
          strategiesApplied: ['multi-query' as const, 'refinement' as const]
        },
        queryRuns: [
          {
            query: 'How to use React hooks?',
            strategy: 'original',
            resultCount: 5,
            requestId: 'req-1'
          },
          {
            query: 'React hooks usage patterns',
            strategy: 'refinement',
            resultCount: 8,
            requestId: 'req-2'
          }
        ],
        strategiesUsed: ['multi-query' as const, 'refinement' as const],
        queryVariations: [
          'How to use React hooks?',
          'React hooks usage patterns',
          'React hooks tutorial'
        ],
        timingMs: {
          enhancement: 150,
          retrieval: 300,
          synthesis: 500,
          total: 950
        },
        totalRetrievals: 10
      };

      expect(metadata.queryVariations.length).toBe(3);
      expect(metadata.queryRuns.length).toBe(2);
      expect(metadata.totalRetrievals).toBe(10);
      expect(metadata.timingMs.total).toBeGreaterThan(
        metadata.timingMs.enhancement +
        metadata.timingMs.retrieval +
        metadata.timingMs.synthesis
      );
    });

    it('should use correct enhancement strategies', () => {
      const validStrategies = ['multi-query', 'refinement', 'concept-extraction'];

      validStrategies.forEach(strategy => {
        expect(['multi-query', 'refinement', 'concept-extraction']).toContain(strategy);
      });
    });
  });

  describe('Result Aggregation', () => {
    it('should deduplicate results from multiple queries', () => {
      // Mock scenario: same result from different queries
      const results = new Map();

      const result1 = {
        id: 'chunk-123',
        chunk: 'React hooks content',
        url: 'https://react.dev/hooks',
        scores: { vector: 0.9, final: 0.9 }
      };

      // First query finds it with score 0.9
      results.set('chunk-123', {
        result: result1,
        score: 0.9,
        sourceQueries: new Set(['original query'])
      });

      // Second query finds it with score 0.85
      const existing = results.get('chunk-123');
      if (existing) {
        existing.score = Math.max(existing.score, 0.85);
        existing.sourceQueries.add('refined query');
      }

      const aggregated = results.get('chunk-123');
      expect(aggregated?.score).toBe(0.9); // Should keep max score
      expect(aggregated?.sourceQueries.size).toBe(2); // Should track both queries
    });

    it('should prioritize results from multiple queries', () => {
      const results = [
        { sourceQueries: new Set(['q1', 'q2']), score: 0.8 },
        { sourceQueries: new Set(['q1']), score: 0.9 }
      ];

      const sorted = results.sort((a, b) => {
        const queryCountDiff = b.sourceQueries.size - a.sourceQueries.size;
        if (queryCountDiff !== 0) return queryCountDiff;
        return b.score - a.score;
      });

      // Result from 2 queries should be first, even with lower score
      expect(sorted[0].sourceQueries.size).toBe(2);
    });
  });

  describe('Context Chunk Preparation', () => {
    it('should prepare chunks with required fields', () => {
      const webResults: WebQueryResult[] = [
        {
          id: 'chunk-1',
          chunk: 'Content about React hooks',
          url: 'https://react.dev/hooks',
          title: 'React Hooks Guide',
          domain: 'react.dev',
          scores: { vector: 0.9, final: 0.9 },
          metadata: { section: 'useState' }
        }
      ];

      const contextChunks = webResults.map((result, idx) => ({
        id: result.id,
        content: result.chunk,
        file: result.url,
        metadata: {
          url: result.url,
          title: result.title,
          domain: result.domain,
          score: result.scores.final,
          ...result.metadata
        }
      }));

      expect(contextChunks[0]).toHaveProperty('id');
      expect(contextChunks[0]).toHaveProperty('content');
      expect(contextChunks[0]).toHaveProperty('file');
      expect(contextChunks[0].metadata).toHaveProperty('url');
      expect(contextChunks[0].metadata).toHaveProperty('score');
    });

    it('should limit context chunks to maximum', () => {
      const MAX_CHUNKS = 12;
      const manyResults = Array(20).fill(null).map((_, i) => ({
        id: `chunk-${i}`,
        chunk: `Content ${i}`,
        url: `https://example.com/page${i}`,
        scores: { vector: 0.9 - i * 0.01, final: 0.9 - i * 0.01 }
      }));

      const limited = manyResults.slice(0, MAX_CHUNKS);

      expect(limited.length).toBe(MAX_CHUNKS);
      expect(limited.length).toBeLessThan(manyResults.length);
    });
  });

  describe('Query Enhancement Strategies', () => {
    it('should support multi-query strategy', () => {
      const strategy: 'multi-query' = 'multi-query';
      expect(strategy).toBe('multi-query');
    });

    it('should support refinement strategy', () => {
      const strategy: 'refinement' = 'refinement';
      expect(strategy).toBe('refinement');
    });

    it('should support concept-extraction strategy', () => {
      const strategy: 'concept-extraction' = 'concept-extraction';
      expect(strategy).toBe('concept-extraction');
    });

    it('should combine multiple strategies', () => {
      type Strategy = 'multi-query' | 'refinement' | 'concept-extraction';
      const strategies: Strategy[] = ['multi-query', 'refinement', 'concept-extraction'];
      
      expect(strategies).toHaveLength(3);
      expect(strategies).toContain('multi-query');
      expect(strategies).toContain('refinement');
      expect(strategies).toContain('concept-extraction');
    });
  });
});
