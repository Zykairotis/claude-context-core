import { Pool, PoolClient, QueryResult } from 'pg';
import {
  VectorDatabase,
  VectorDocument,
  SearchOptions,
  VectorSearchResult,
  HybridSearchRequest,
  HybridSearchOptions,
  HybridSearchResult,
  CollectionStats
} from './types';

export interface PostgresDualVectorDatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  batchSize?: number;
}

/**
 * PostgreSQL-based vector database with pgvector extension support
 * Implements project-aware storage with dual vector capabilities
 */
export class PostgresDualVectorDatabase implements VectorDatabase {
  private pool: Pool;
  private batchSize: number;
  private readonly schema = 'claude_context';

  constructor(config: PostgresDualVectorDatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.batchSize = config.batchSize || 100;

    console.log('[PostgresDualVectorDB] ✅ Initialized with pgvector support');
    console.log(`[PostgresDualVectorDB]   Max connections: ${config.maxConnections || 10}`);
    console.log(`[PostgresDualVectorDB]   Batch size: ${this.batchSize}`);
  }

  /**
   * Create a new collection (table) for storing vectors
   */
  async createCollection(collectionName: string, dimension: number, description?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      
      console.log(`[PostgresDualVectorDB] 📦 Creating collection: ${collectionName} (${dimension}d)`);

      // Create the vectors table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          vector vector(${dimension}),
          content TEXT,
          relative_path TEXT,
          start_line INTEGER,
          end_line INTEGER,
          file_extension TEXT,
          project_id UUID,
          dataset_id UUID,
          source_type TEXT,
          repo TEXT,
          branch TEXT,
          sha TEXT,
          lang TEXT,
          symbol JSONB,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'vector_idx')}
        ON ${tableName} USING ivfflat (vector vector_cosine_ops)
        WITH (lists = 100)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'project_idx')}
        ON ${tableName}(project_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'dataset_idx')}
        ON ${tableName}(dataset_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'source_type_idx')}
        ON ${tableName}(source_type)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'metadata_idx')}
        ON ${tableName} USING GIN (metadata)
      `);

      // Update collections_metadata
      await client.query(`
        INSERT INTO ${this.schema}.collections_metadata 
        (collection_name, dimension, has_dual_vectors, entity_count)
        VALUES ($1, $2, false, 0)
        ON CONFLICT (collection_name) 
        DO UPDATE SET 
          dimension = EXCLUDED.dimension,
          updated_at = CURRENT_TIMESTAMP
      `, [collectionName, dimension]);

      console.log(`[PostgresDualVectorDB] ✅ Created collection: ${collectionName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Create collection with hybrid search support (dual vectors)
   */
  async createHybridCollection(collectionName: string, dimension: number, description?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      
      console.log(`[PostgresDualVectorDB] 📦 Creating hybrid collection: ${collectionName} (${dimension}d)`);

      // Create the vectors table with dual vector support
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          vector vector(${dimension}),
          summary_vector vector(${dimension}),
          content TEXT,
          summary TEXT,
          relative_path TEXT,
          start_line INTEGER,
          end_line INTEGER,
          file_extension TEXT,
          project_id UUID,
          dataset_id UUID,
          source_type TEXT,
          repo TEXT,
          branch TEXT,
          sha TEXT,
          lang TEXT,
          symbol JSONB,
          sparse_vector JSONB,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'vector_idx')}
        ON ${tableName} USING ivfflat (vector vector_cosine_ops)
        WITH (lists = 100)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'summary_vector_idx')}
        ON ${tableName} USING ivfflat (summary_vector vector_cosine_ops)
        WITH (lists = 100)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'project_idx')}
        ON ${tableName}(project_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'dataset_idx')}
        ON ${tableName}(dataset_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS ${this.sanitizeIndexName(collectionName, 'source_type_idx')}
        ON ${tableName}(source_type)
      `);

      // Update collections_metadata
      await client.query(`
        INSERT INTO ${this.schema}.collections_metadata 
        (collection_name, dimension, has_dual_vectors, entity_count)
        VALUES ($1, $2, true, 0)
        ON CONFLICT (collection_name) 
        DO UPDATE SET 
          dimension = EXCLUDED.dimension,
          has_dual_vectors = true,
          updated_at = CURRENT_TIMESTAMP
      `, [collectionName, dimension]);

      console.log(`[PostgresDualVectorDB] ✅ Created hybrid collection: ${collectionName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Drop a collection
   */
  async dropCollection(collectionName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      
      console.log(`[PostgresDualVectorDB] 🗑️  Dropping collection: ${collectionName}`);

      await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      await client.query(`
        DELETE FROM ${this.schema}.collections_metadata 
        WHERE collection_name = $1
      `, [collectionName]);

      console.log(`[PostgresDualVectorDB] ✅ Dropped collection: ${collectionName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Check if a collection exists
   */
  async hasCollection(collectionName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = $2
        )
      `, [this.schema, tableName.split('.')[1]]);

      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT collection_name 
        FROM ${this.schema}.collections_metadata 
        ORDER BY created_at DESC
      `);

      return result.rows.map(row => row.collection_name);
    } finally {
      client.release();
    }
  }

  /**
   * Insert vector documents
   */
  async insert(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const tableName = this.getTableName(collectionName);
      
      console.log(`[PostgresDualVectorDB] 📥 Inserting ${documents.length} documents into ${collectionName}`);

      // Batch insert for performance
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const doc of batch) {
          const vectorStr = `[${doc.vector.join(',')}]`;
          placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          
          values.push(
            doc.id,
            vectorStr,
            doc.content,
            doc.relativePath,
            doc.startLine,
            doc.endLine,
            doc.fileExtension,
            doc.projectId || null,
            doc.datasetId || null,
            doc.sourceType || null,
            doc.repo || null,
            doc.branch || null,
            doc.sha || null,
            doc.lang || null,
            doc.symbol ? JSON.stringify(doc.symbol) : null,
            JSON.stringify(doc.metadata)
          );
        }

        await client.query(`
          INSERT INTO ${tableName} 
          (id, vector, content, relative_path, start_line, end_line, file_extension,
           project_id, dataset_id, source_type, repo, branch, sha, lang, symbol, metadata)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            vector = EXCLUDED.vector,
            content = EXCLUDED.content,
            relative_path = EXCLUDED.relative_path,
            start_line = EXCLUDED.start_line,
            end_line = EXCLUDED.end_line,
            file_extension = EXCLUDED.file_extension,
            project_id = EXCLUDED.project_id,
            dataset_id = EXCLUDED.dataset_id,
            source_type = EXCLUDED.source_type,
            repo = EXCLUDED.repo,
            branch = EXCLUDED.branch,
            sha = EXCLUDED.sha,
            lang = EXCLUDED.lang,
            symbol = EXCLUDED.symbol,
            metadata = EXCLUDED.metadata
        `, values);

        // Log to vector_metadata table
        for (const doc of batch) {
          await this.logVectorMetadata(client, doc.id, collectionName, doc.vector.length);
        }
      }

      // Update entity count
      await client.query(`
        UPDATE ${this.schema}.collections_metadata 
        SET entity_count = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_name = $1
      `, [collectionName]);

      await client.query('COMMIT');
      
      console.log(`[PostgresDualVectorDB] ✅ Inserted ${documents.length} documents`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert hybrid vector documents (with summary vectors)
   */
  async insertHybrid(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const tableName = this.getTableName(collectionName);
      
      console.log(`[PostgresDualVectorDB] 📥 Inserting ${documents.length} hybrid documents into ${collectionName}`);

      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const doc of batch) {
          const vectorStr = `[${doc.vector.join(',')}]`;
          const summaryVectorStr = doc.summaryVector ? `[${doc.summaryVector.join(',')}]` : null;
          
          placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          
          values.push(
            doc.id,
            vectorStr,
            summaryVectorStr,
            doc.content,
            doc.metadata.summary || null,
            doc.relativePath,
            doc.startLine,
            doc.endLine,
            doc.fileExtension,
            doc.projectId || null,
            doc.datasetId || null,
            doc.sourceType || null,
            doc.repo || null,
            doc.branch || null,
            doc.sha || null,
            doc.lang || null,
            doc.symbol ? JSON.stringify(doc.symbol) : null,
            JSON.stringify(doc.metadata)
          );
        }

        await client.query(`
          INSERT INTO ${tableName} 
          (id, vector, summary_vector, content, summary, relative_path, start_line, end_line, file_extension,
           project_id, dataset_id, source_type, repo, branch, sha, lang, symbol, metadata)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            vector = EXCLUDED.vector,
            summary_vector = EXCLUDED.summary_vector,
            content = EXCLUDED.content,
            summary = EXCLUDED.summary,
            relative_path = EXCLUDED.relative_path,
            start_line = EXCLUDED.start_line,
            end_line = EXCLUDED.end_line,
            file_extension = EXCLUDED.file_extension,
            project_id = EXCLUDED.project_id,
            dataset_id = EXCLUDED.dataset_id,
            source_type = EXCLUDED.source_type,
            repo = EXCLUDED.repo,
            branch = EXCLUDED.branch,
            sha = EXCLUDED.sha,
            lang = EXCLUDED.lang,
            symbol = EXCLUDED.symbol,
            metadata = EXCLUDED.metadata
        `, values);
      }

      // Update entity count
      await client.query(`
        UPDATE ${this.schema}.collections_metadata 
        SET entity_count = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_name = $1
      `, [collectionName]);

      await client.query('COMMIT');
      
      console.log(`[PostgresDualVectorDB] ✅ Inserted ${documents.length} hybrid documents`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar vectors
   */
  async search(collectionName: string, queryVector: number[], options?: SearchOptions): Promise<VectorSearchResult[]> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      const limit = options?.topK || 10;
      const threshold = options?.threshold || 0.0;

      const vectorStr = `[${queryVector.join(',')}]`;
      
      // Build WHERE clause for filters
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (options?.filter) {
        const filterClauses: string[] = [];
        
        if (options.filter.projectId) {
          filterClauses.push(`project_id = $${paramIndex++}`);
          params.push(options.filter.projectId);
        }
        
        if (options.filter.datasetIds && Array.isArray(options.filter.datasetIds)) {
          filterClauses.push(`dataset_id = ANY($${paramIndex++}::uuid[])`);
          params.push(options.filter.datasetIds);
        }
        
        if (options.filter.sourceType) {
          filterClauses.push(`source_type = $${paramIndex++}`);
          params.push(options.filter.sourceType);
        }
        
        if (options.filter.repo) {
          filterClauses.push(`repo = $${paramIndex++}`);
          params.push(options.filter.repo);
        }
        
        if (options.filter.pathPrefix) {
          filterClauses.push(`relative_path LIKE $${paramIndex++}`);
          params.push(`${options.filter.pathPrefix}%`);
        }
        
        if (options.filter.lang) {
          filterClauses.push(`lang = $${paramIndex++}`);
          params.push(options.filter.lang);
        }

        if (filterClauses.length > 0) {
          whereClause = filterClauses.join(' AND ');
        }
      }

      const query = `
        SELECT 
          id, vector, content, relative_path, start_line, end_line, file_extension,
          project_id, dataset_id, source_type, repo, branch, sha, lang, symbol, metadata,
          1 - (vector <=> $${paramIndex}::vector) as score
        FROM ${tableName}
        WHERE ${whereClause}
          AND 1 - (vector <=> $${paramIndex}::vector) >= $${paramIndex + 1}
        ORDER BY vector <=> $${paramIndex}::vector
        LIMIT $${paramIndex + 2}
      `;

      params.push(vectorStr, threshold, limit);

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        document: {
          id: row.id,
          vector: this.parseVector(row.vector),
          content: row.content,
          relativePath: row.relative_path,
          startLine: row.start_line,
          endLine: row.end_line,
          fileExtension: row.file_extension,
          projectId: row.project_id,
          datasetId: row.dataset_id,
          sourceType: row.source_type,
          repo: row.repo,
          branch: row.branch,
          sha: row.sha,
          lang: row.lang,
          symbol: row.symbol,
          metadata: row.metadata || {}
        },
        score: parseFloat(row.score)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Hybrid search (stub for Phase B)
   */
  async hybridSearch(
    collectionName: string,
    searchRequests: HybridSearchRequest[],
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    // Phase B: Implement hybrid search with RRF fusion
    throw new Error('Hybrid search not yet implemented. Use search() for dense-only queries.');
  }

  /**
   * Delete documents by IDs
   */
  async delete(collectionName: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      
      await client.query(`
        DELETE FROM ${tableName}
        WHERE id = ANY($1::text[])
      `, [ids]);

      // Update entity count
      await client.query(`
        UPDATE ${this.schema}.collections_metadata 
        SET entity_count = (SELECT COUNT(*) FROM ${tableName}),
            updated_at = CURRENT_TIMESTAMP
        WHERE collection_name = $1
      `, [collectionName]);

      console.log(`[PostgresDualVectorDB] 🗑️  Deleted ${ids.length} documents from ${collectionName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Delete documents for a given dataset identifier across a collection
   */
  async deleteByDataset(collectionName: string, datasetId: string): Promise<number> {
    const client = await this.pool.connect();
    const tableName = this.getTableName(collectionName);

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM ${tableName}
         WHERE dataset_id = $1
         RETURNING id`,
        [datasetId]
      );
      const deletedCount = result.rowCount ?? 0;

      if (deletedCount > 0) {
        await client.query(
          `UPDATE ${this.schema}.collections_metadata 
           SET entity_count = (SELECT COUNT(*) FROM ${tableName}),
               updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = $1`,
          [collectionName]
        );
      }

      await client.query('COMMIT');

      if (deletedCount > 0) {
        console.log(`[PostgresDualVectorDB] 🗑️  Deleted ${deletedCount} documents for dataset ${datasetId} from ${collectionName}`);
      }

      return deletedCount;
    } catch (error: any) {
      await client.query('ROLLBACK');

      // Ignore missing relation errors (collection not materialized yet)
      if (error?.code === '42P01') {
        console.warn(`[PostgresDualVectorDB] ⚠️  Collection ${collectionName} missing while deleting dataset ${datasetId}`);
        return 0;
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete documents by file path with optional project/dataset filters
   */
  async deleteByFilePath(
    collectionName: string,
    relativePath: string,
    projectId?: string,
    datasetId?: string
  ): Promise<number> {
    const client = await this.pool.connect();
    const tableName = this.getTableName(collectionName);

    try {
      await client.query('BEGIN');

      // Build WHERE clause with filters
      const conditions: string[] = ['relative_path = $1'];
      const params: any[] = [relativePath];
      let paramIndex = 2;

      if (projectId) {
        conditions.push(`project_id = $${paramIndex}`);
        params.push(projectId);
        paramIndex++;
      }

      if (datasetId) {
        conditions.push(`dataset_id = $${paramIndex}`);
        params.push(datasetId);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const result = await client.query(
        `DELETE FROM ${tableName}
         WHERE ${whereClause}
         RETURNING id`,
        params
      );
      const deletedCount = result.rowCount ?? 0;

      if (deletedCount > 0) {
        await client.query(
          `UPDATE ${this.schema}.collections_metadata 
           SET entity_count = (SELECT COUNT(*) FROM ${tableName}),
               updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = $1`,
          [collectionName]
        );
      }

      await client.query('COMMIT');

      if (deletedCount > 0) {
        console.log(`[PostgresDualVectorDB] 🗑️  Deleted ${deletedCount} chunks for file ${relativePath} in ${collectionName}`);
      }

      return deletedCount;
    } catch (error: any) {
      await client.query('ROLLBACK');

      // Ignore missing relation errors (collection not materialized yet)
      if (error?.code === '42P01') {
        console.warn(`[PostgresDualVectorDB] ⚠️  Collection ${collectionName} not found while deleting ${relativePath}`);
        return 0;
      }

      console.error(`[PostgresDualVectorDB] ❌ Failed to delete file chunks for ${relativePath}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Query documents with filter
   */
  async query(
    collectionName: string,
    filter: string,
    outputFields: string[],
    limit?: number
  ): Promise<Record<string, any>[]> {
    const client = await this.pool.connect();
    try {
      const tableName = this.getTableName(collectionName);
      const fields = outputFields.length > 0 ? outputFields.join(', ') : '*';
      const limitClause = limit ? `LIMIT ${limit}` : '';

      const result = await client.query(`
        SELECT ${fields}
        FROM ${tableName}
        WHERE ${filter}
        ${limitClause}
      `);

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Check collection limit (always returns true for PostgreSQL)
   */
  async checkCollectionLimit(): Promise<boolean> {
    return true;
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<CollectionStats | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT entity_count, dimension
        FROM ${this.schema}.collections_metadata
        WHERE collection_name = $1
      `, [collectionName]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        entityCount: result.rows[0].entity_count || 0,
        dimension: result.rows[0].dimension
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('[PostgresDualVectorDB] 👋 Connection pool closed');
  }

  // Private helper methods

  private getTableName(collectionName: string): string {
    const sanitized = collectionName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    return `${this.schema}.${sanitized}_vectors`;
  }

  private sanitizeIndexName(collectionName: string, suffix: string): string {
    const sanitized = collectionName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    return `${sanitized}_${suffix}`;
  }

  private async logVectorMetadata(
    client: PoolClient,
    vectorId: string,
    collectionName: string,
    dimension: number
  ): Promise<void> {
    // Check if vector_metadata table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = 'vector_metadata'
      )
    `, [this.schema]);

    if (!tableExists.rows[0].exists) {
      return; // Skip if table doesn't exist yet
    }

    try {
      await client.query(`
        INSERT INTO ${this.schema}.vector_metadata 
        (vector_id, vector_type, collection_name, embedding_dimension, qdrant_payload)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (vector_id) DO UPDATE SET
          collection_name = EXCLUDED.collection_name,
          embedding_dimension = EXCLUDED.embedding_dimension
      `, [vectorId, 'content', collectionName, dimension, JSON.stringify({})]);
    } catch (error) {
      // Silently fail if vector_metadata logging fails
      console.warn(`[PostgresDualVectorDB] ⚠️  Failed to log vector metadata: ${error}`);
    }
  }

  private parseVector(vectorStr: string): number[] {
    // Parse PostgreSQL vector format: [1,2,3] or (1,2,3)
    const cleaned = vectorStr.replace(/[\[\]\(\)]/g, '');
    return cleaned.split(',').map(v => parseFloat(v.trim()));
  }
}
