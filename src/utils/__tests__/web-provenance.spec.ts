import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WebProvenanceTracker } from '../web-provenance';

describe('Web Provenance Tracking', () => {
  let tracker: WebProvenanceTracker;

  beforeEach(() => {
    // Create tracker without DB for in-memory testing
    tracker = new WebProvenanceTracker();
  });

  describe('Content Hash Generation', () => {
    it('should generate consistent hashes for same content', () => {
      const content = 'This is test content for hashing';
      const hash1 = WebProvenanceTracker.generateContentHash(content);
      const hash2 = WebProvenanceTracker.generateContentHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16); // First 16 chars of SHA-256
    });

    it('should generate different hashes for different content', () => {
      const content1 = 'Original content';
      const content2 = 'Modified content';

      const hash1 = WebProvenanceTracker.generateContentHash(content1);
      const hash2 = WebProvenanceTracker.generateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should trim whitespace before hashing', () => {
      const content1 = '  Content with spaces  ';
      const content2 = 'Content with spaces';

      const hash1 = WebProvenanceTracker.generateContentHash(content1);
      const hash2 = WebProvenanceTracker.generateContentHash(content2);

      expect(hash1).toBe(hash2);
    });

    it('should be case-sensitive', () => {
      const content1 = 'React Hooks';
      const content2 = 'react hooks';

      const hash1 = WebProvenanceTracker.generateContentHash(content1);
      const hash2 = WebProvenanceTracker.generateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('URL Canonicalization', () => {
    it('should remove UTM tracking parameters', () => {
      const url = 'https://example.com/page?utm_source=twitter&utm_campaign=promo';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toBe('https://example.com/page');
    });

    it('should remove multiple tracking parameters', () => {
      const url = 'https://example.com/page?fbclid=123&gclid=456&ref=social';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toBe('https://example.com/page');
    });

    it('should preserve legitimate query parameters', () => {
      const url = 'https://example.com/search?q=react&lang=en';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toContain('lang=en');
      expect(canonical).toContain('q=react');
    });

    it('should normalize trailing slashes', () => {
      const url1 = 'https://example.com/page/';
      const url2 = 'https://example.com/page';

      const canonical1 = WebProvenanceTracker.canonicalizeUrl(url1);
      const canonical2 = WebProvenanceTracker.canonicalizeUrl(url2);

      expect(canonical1).toBe(canonical2);
    });

    it('should keep root trailing slash', () => {
      const url = 'https://example.com/';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toBe('https://example.com/');
    });

    it('should prefer HTTPS over HTTP', () => {
      const url = 'http://example.com/page';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toBe('https://example.com/page');
    });

    it('should sort query parameters for consistency', () => {
      const url1 = 'https://example.com/page?b=2&a=1';
      const url2 = 'https://example.com/page?a=1&b=2';

      const canonical1 = WebProvenanceTracker.canonicalizeUrl(url1);
      const canonical2 = WebProvenanceTracker.canonicalizeUrl(url2);

      expect(canonical1).toBe(canonical2);
    });

    it('should preserve hash fragments', () => {
      const url = 'https://example.com/page#section';
      const canonical = WebProvenanceTracker.canonicalizeUrl(url);

      expect(canonical).toContain('#section');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const canonical = WebProvenanceTracker.canonicalizeUrl(invalidUrl);

      expect(canonical).toBe(invalidUrl); // Returns original
    });
  });

  describe('Domain Extraction', () => {
    it('should extract domain from URL', () => {
      const url = 'https://react.dev/docs/hooks';
      const domain = WebProvenanceTracker.extractDomain(url);

      expect(domain).toBe('react.dev');
    });

    it('should handle subdomains', () => {
      const url = 'https://docs.github.com/api';
      const domain = WebProvenanceTracker.extractDomain(url);

      expect(domain).toBe('docs.github.com');
    });

    it('should handle different ports', () => {
      const url = 'http://localhost:3000/page';
      const domain = WebProvenanceTracker.extractDomain(url);

      expect(domain).toBe('localhost');
    });

    it('should return "unknown" for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const domain = WebProvenanceTracker.extractDomain(invalidUrl);

      expect(domain).toBe('unknown');
    });
  });

  describe('Change Detection (In-Memory)', () => {
    it('should detect new content', async () => {
      const url = 'https://example.com/page';
      const content = 'Initial content';

      const result = await tracker.trackProvenance(url, content);

      expect(result.hasChanged).toBe(false);
      expect(result.changeReason).toBe('new_content');
      expect(result.currentHash).toBeDefined();
      expect(result.previousHash).toBeUndefined();
    });

    it('should detect content changes', async () => {
      const url = 'https://example.com/page';
      const content1 = 'Original content';
      const content2 = 'Modified content';

      // First crawl
      await tracker.trackProvenance(url, content1);

      // Second crawl with changed content
      const result = await tracker.trackProvenance(url, content2);

      expect(result.hasChanged).toBe(true);
      expect(result.changeReason).toBe('content_modified');
      expect(result.currentHash).not.toBe(result.previousHash);
    });

    it('should detect no change when content is same', async () => {
      const url = 'https://example.com/page';
      const content = 'Same content';

      // First crawl
      await tracker.trackProvenance(url, content);

      // Second crawl with same content
      const result = await tracker.trackProvenance(url, content);

      expect(result.hasChanged).toBe(false);
      expect(result.changeReason).toBe('no_change');
      expect(result.currentHash).toBe(result.previousHash);
    });

    it('should track first and last seen timestamps', async () => {
      const url = 'https://example.com/page';
      const content = 'Content';

      const result1 = await tracker.trackProvenance(url, content);
      expect(result1.firstSeen).toBeUndefined(); // New content has no history

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 10));

      const result2 = await tracker.trackProvenance(url, content);
      expect(result2.firstSeen).toBeDefined();
      expect(result2.lastSeen).toBeDefined();
      if (result2.firstSeen && result2.lastSeen) {
        expect(result2.lastSeen.getTime()).toBeGreaterThanOrEqual(result2.firstSeen.getTime());
      }
    });

    it('should use canonical URL for tracking', async () => {
      const url1 = 'https://example.com/page?utm_source=twitter';
      const url2 = 'https://example.com/page?utm_campaign=promo';
      const content = 'Same content';

      await tracker.trackProvenance(url1, content);
      const result = await tracker.trackProvenance(url2, content);

      // Should recognize as same page (same canonical URL)
      expect(result.hasChanged).toBe(false);
      expect(result.changeReason).toBe('no_change');
    });

    it('should track provenance with metadata', async () => {
      const url = 'https://example.com/page';
      const content = 'Content';
      const metadata = {
        title: 'Test Page',
        author: 'John Doe'
      };

      const result = await tracker.trackProvenance(url, content, metadata);

      expect(result).toBeDefined();
      expect(result.url).toBe(url);
    });
  });

  describe('Provenance Retrieval (In-Memory)', () => {
    it('should retrieve provenance for tracked URL', async () => {
      const url = 'https://example.com/page';
      const content = 'Content';

      await tracker.trackProvenance(url, content);
      const provenance = await tracker.getProvenance(url);

      expect(provenance).not.toBeNull();
      expect(provenance?.url).toBe(url);
      expect(provenance?.contentHash).toBeDefined();
    });

    it('should return null for untracked URL', async () => {
      const provenance = await tracker.getProvenance('https://never-seen.com/page');

      expect(provenance).toBeNull();
    });

    it('should include crawl count in provenance', async () => {
      const url = 'https://example.com/page';
      const content = 'Content';

      await tracker.trackProvenance(url, content);
      const provenance = await tracker.getProvenance(url);

      expect(provenance?.crawlCount).toBeGreaterThan(0);
    });
  });

  describe('SQL Schema', () => {
    it('should export SQL schema for provenance table', () => {
      const { WEB_PROVENANCE_SCHEMA } = require('../web-provenance');

      expect(WEB_PROVENANCE_SCHEMA).toContain('CREATE TABLE');
      expect(WEB_PROVENANCE_SCHEMA).toContain('web_provenance');
      expect(WEB_PROVENANCE_SCHEMA).toContain('canonical_url');
      expect(WEB_PROVENANCE_SCHEMA).toContain('content_hash');
      expect(WEB_PROVENANCE_SCHEMA).toContain('change_detected');
    });

    it('should include indexes for performance', () => {
      const { WEB_PROVENANCE_SCHEMA } = require('../web-provenance');

      expect(WEB_PROVENANCE_SCHEMA).toContain('CREATE INDEX');
      expect(WEB_PROVENANCE_SCHEMA).toContain('idx_web_provenance_canonical_url');
      expect(WEB_PROVENANCE_SCHEMA).toContain('idx_web_provenance_domain');
    });
  });
});
