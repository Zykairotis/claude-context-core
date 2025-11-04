import crypto from 'crypto';
import { Pool } from 'pg';

/**
 * Web provenance metadata for tracking content changes
 */
export interface WebProvenance {
  url: string;
  canonicalUrl: string;
  domain: string;
  contentHash: string;
  firstCrawledAt: Date;
  lastCrawledAt: Date;
  crawlCount: number;
  changeDetected: boolean;
  previousHash?: string;
  title?: string;
  metadata?: Record<string, any>;
}

/**
 * Change detection result
 */
export interface ProvenanceChangeDetection {
  url: string;
  hasChanged: boolean;
  currentHash: string;
  previousHash?: string;
  firstSeen?: Date;
  lastSeen?: Date;
  changeReason?: 'new_content' | 'content_modified' | 'no_change';
}

/**
 * Web Provenance Tracker for managing content attribution and change detection
 */
export class WebProvenanceTracker {
  constructor(private postgresPool?: Pool) {}

  /**
   * Generate content hash for change detection
   */
  static generateContentHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content.trim())
      .digest('hex')
      .slice(0, 16); // Use first 16 chars for efficiency
  }

  /**
   * Canonicalize URL for deduplication
   * Removes tracking parameters, normalizes protocol, etc.
   */
  static canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove common tracking parameters
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'fbclid',
        'gclid',
        'ref',
        'source'
      ];

      for (const param of trackingParams) {
        parsed.searchParams.delete(param);
      }

      // Normalize trailing slash
      let pathname = parsed.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }

      // Always use https if available
      const protocol = parsed.protocol === 'http:' ? 'https:' : parsed.protocol;

      // Sort query parameters for consistency
      const sortedParams = Array.from(parsed.searchParams.entries())
        .sort(([a], [b]) => a.localeCompare(b));
      
      const queryString = sortedParams.length > 0
        ? '?' + sortedParams.map(([k, v]) => `${k}=${v}`).join('&')
        : '';

      return `${protocol}//${parsed.host}${pathname}${queryString}${parsed.hash}`;
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Track web page provenance with change detection
   */
  async trackProvenance(
    url: string,
    content: string,
    metadata?: {
      title?: string;
      [key: string]: any;
    }
  ): Promise<ProvenanceChangeDetection> {
    if (!this.postgresPool) {
      // In-memory fallback for non-DB mode
      return this.trackProvenanceInMemory(url, content);
    }

    const canonicalUrl = WebProvenanceTracker.canonicalizeUrl(url);
    const domain = WebProvenanceTracker.extractDomain(url);
    const currentHash = WebProvenanceTracker.generateContentHash(content);

    const client = await this.postgresPool.connect();
    try {
      // Check for existing provenance
      const existing = await client.query(
        `SELECT content_hash, first_crawled_at, last_crawled_at, crawl_count
         FROM claude_context.web_provenance
         WHERE canonical_url = $1`,
        [canonicalUrl]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const previousHash = row.content_hash;
        const hasChanged = previousHash !== currentHash;

        // Update provenance
        await client.query(
          `UPDATE claude_context.web_provenance
           SET content_hash = $1,
               last_crawled_at = NOW(),
               crawl_count = crawl_count + 1,
               change_detected = $2,
               previous_hash = $3,
               title = COALESCE($4, title),
               metadata = COALESCE($5, metadata)
           WHERE canonical_url = $6`,
          [
            currentHash,
            hasChanged,
            previousHash,
            metadata?.title,
            metadata ? JSON.stringify(metadata) : null,
            canonicalUrl
          ]
        );

        return {
          url,
          hasChanged,
          currentHash,
          previousHash,
          firstSeen: row.first_crawled_at,
          lastSeen: row.last_crawled_at,
          changeReason: hasChanged ? 'content_modified' : 'no_change'
        };
      } else {
        // Insert new provenance record
        await client.query(
          `INSERT INTO claude_context.web_provenance (
             url, canonical_url, domain, content_hash,
             first_crawled_at, last_crawled_at, crawl_count,
             change_detected, title, metadata
           ) VALUES ($1, $2, $3, $4, NOW(), NOW(), 1, false, $5, $6)`,
          [
            url,
            canonicalUrl,
            domain,
            currentHash,
            metadata?.title,
            metadata ? JSON.stringify(metadata) : null
          ]
        );

        return {
          url,
          hasChanged: false,
          currentHash,
          changeReason: 'new_content'
        };
      }
    } finally {
      client.release();
    }
  }

  /**
   * In-memory provenance tracking (fallback when no DB)
   */
  private provenanceCache = new Map<string, {
    hash: string;
    firstSeen: Date;
    lastSeen: Date;
  }>();

  private trackProvenanceInMemory(
    url: string,
    content: string
  ): ProvenanceChangeDetection {
    const canonicalUrl = WebProvenanceTracker.canonicalizeUrl(url);
    const currentHash = WebProvenanceTracker.generateContentHash(content);

    const existing = this.provenanceCache.get(canonicalUrl);

    if (existing) {
      const hasChanged = existing.hash !== currentHash;
      const previousHash = existing.hash;

      this.provenanceCache.set(canonicalUrl, {
        hash: currentHash,
        firstSeen: existing.firstSeen,
        lastSeen: new Date()
      });

      return {
        url,
        hasChanged,
        currentHash,
        previousHash,
        firstSeen: existing.firstSeen,
        lastSeen: existing.lastSeen,
        changeReason: hasChanged ? 'content_modified' : 'no_change'
      };
    } else {
      const now = new Date();
      this.provenanceCache.set(canonicalUrl, {
        hash: currentHash,
        firstSeen: now,
        lastSeen: now
      });

      return {
        url,
        hasChanged: false,
        currentHash,
        changeReason: 'new_content'
      };
    }
  }

  /**
   * Get provenance history for a URL
   */
  async getProvenance(url: string): Promise<WebProvenance | null> {
    if (!this.postgresPool) {
      return this.getProvenanceInMemory(url);
    }

    const canonicalUrl = WebProvenanceTracker.canonicalizeUrl(url);
    const client = await this.postgresPool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM claude_context.web_provenance WHERE canonical_url = $1`,
        [canonicalUrl]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        url: row.url,
        canonicalUrl: row.canonical_url,
        domain: row.domain,
        contentHash: row.content_hash,
        firstCrawledAt: row.first_crawled_at,
        lastCrawledAt: row.last_crawled_at,
        crawlCount: row.crawl_count,
        changeDetected: row.change_detected,
        previousHash: row.previous_hash,
        title: row.title,
        metadata: row.metadata
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get in-memory provenance (fallback)
   */
  private getProvenanceInMemory(url: string): WebProvenance | null {
    const canonicalUrl = WebProvenanceTracker.canonicalizeUrl(url);
    const cached = this.provenanceCache.get(canonicalUrl);

    if (!cached) {
      return null;
    }

    return {
      url,
      canonicalUrl,
      domain: WebProvenanceTracker.extractDomain(url),
      contentHash: cached.hash,
      firstCrawledAt: cached.firstSeen,
      lastCrawledAt: cached.lastSeen,
      crawlCount: 1,
      changeDetected: false
    };
  }

  /**
   * Get all changed pages since a given date
   */
  async getChangedPagesSince(since: Date): Promise<WebProvenance[]> {
    if (!this.postgresPool) {
      return [];
    }

    const client = await this.postgresPool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM claude_context.web_provenance
         WHERE last_crawled_at > $1 AND change_detected = true
         ORDER BY last_crawled_at DESC`,
        [since]
      );

      return result.rows.map(row => ({
        url: row.url,
        canonicalUrl: row.canonical_url,
        domain: row.domain,
        contentHash: row.content_hash,
        firstCrawledAt: row.first_crawled_at,
        lastCrawledAt: row.last_crawled_at,
        crawlCount: row.crawl_count,
        changeDetected: row.change_detected,
        previousHash: row.previous_hash,
        title: row.title,
        metadata: row.metadata
      }));
    } finally {
      client.release();
    }
  }
}

/**
 * SQL migration for web_provenance table
 * Run this in your PostgreSQL database to enable provenance tracking
 */
export const WEB_PROVENANCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS claude_context.web_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  content_hash VARCHAR(16) NOT NULL,
  first_crawled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_crawled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  crawl_count INTEGER NOT NULL DEFAULT 1,
  change_detected BOOLEAN NOT NULL DEFAULT false,
  previous_hash VARCHAR(16),
  title TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_provenance_canonical_url 
  ON claude_context.web_provenance(canonical_url);

CREATE INDEX IF NOT EXISTS idx_web_provenance_domain 
  ON claude_context.web_provenance(domain);

CREATE INDEX IF NOT EXISTS idx_web_provenance_last_crawled 
  ON claude_context.web_provenance(last_crawled_at);

CREATE INDEX IF NOT EXISTS idx_web_provenance_change_detected 
  ON claude_context.web_provenance(change_detected) 
  WHERE change_detected = true;
`;
