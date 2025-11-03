import {
  VectorDatabase,
  VectorDocument,
  SearchOptions,
  VectorSearchResult,
  HybridSearchRequest,
  HybridSearchOptions,
  HybridSearchResult,
  CollectionStats,
  RerankStrategy
} from './types';
import * as crypto from 'crypto';

export interface QdrantVectorDatabaseConfig {
  url: string;
  apiKey?: string;
  collectionDistance?: 'Cosine' | 'Euclid' | 'Dot';
}

interface RankedPoint {
  id: string;
  score: number;
  payload: Record<string, any> | undefined;
}

type QdrantPointStruct = {
  id: string | number;
  vectors: Record<string, number[]>;
  payload: Record<string, any>;
};

type QdrantFilter = {
  must?: Array<{ key: string; match?: { value?: any; any?: any[] } }>
};

interface QdrantResponse<T> {
  result: T;
  status: string;
  time: number;
}

interface QdrantCollectionInfo {
  status?: {
    points_count?: number;
  };
  config?: {
    params?: {
      vectors?: any;
    };
  };
}

interface QdrantSearchPoint {
  id?: string | number;
  score?: number;
  payload?: Record<string, any>;
}

class QdrantHttpClient {
  constructor(private readonly baseUrl: string, private readonly apiKey?: string) {}

  async request<T>(path: string, init?: RequestInit): Promise<QdrantResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined)
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant request failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  createCollection(name: string, body: Record<string, any>) {
    return this.request(`/collections/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  deleteCollection(name: string) {
    return this.request(`/collections/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
  }

  getCollection(name: string) {
    return this.request<QdrantCollectionInfo>(`/collections/${encodeURIComponent(name)}`);
  }

  listCollections() {
    return this.request<{ collections: { name: string }[] }>(`/collections`);
  }

  upsert(name: string, points: any) {
    return this.request(`/collections/${encodeURIComponent(name)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify(points)
    });
  }

  search(name: string, body: Record<string, any>) {
    return this.request<QdrantSearchPoint[]>(`/collections/${encodeURIComponent(name)}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        with_payload: true,
        with_vector: false,
        ...body
      })
    });
  }

  scroll(name: string, body: Record<string, any>) {
    return this.request<{ points: QdrantSearchPoint[] }>(`/collections/${encodeURIComponent(name)}/points/scroll`, {
      method: 'POST',
      body: JSON.stringify({
        with_payload: true,
        with_vector: false,
        offset: null,
        ...body
      })
    });
  }

  deletePoints(name: string, body: Record<string, any>) {
    return this.request(`/collections/${encodeURIComponent(name)}/points/delete`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export class QdrantVectorDatabase implements VectorDatabase {
  private client: QdrantHttpClient;
  private distance: 'Cosine' | 'Euclid' | 'Dot';

  constructor(config: QdrantVectorDatabaseConfig) {
    this.client = new QdrantHttpClient(config.url, config.apiKey);
    this.distance = config.collectionDistance ?? 'Cosine';
    console.log(`[QdrantVectorDB] 🔌 Connected to ${config.url}`);
  }

  async createCollection(collectionName: string, dimension: number): Promise<void> {
    const enableHybrid = process.env.ENABLE_HYBRID_SEARCH === 'true';
    
    const collectionConfig: any = {
      vectors: {
        vector: {
          size: dimension,
          distance: this.distance
        }
      },
      optimizers_config: {
        default_segment_number: 1
      },
      on_disk_payload: true
    };

    // Add sparse vector configuration if hybrid search is enabled
    if (enableHybrid) {
      collectionConfig.sparse_vectors = {
        sparse: {
          modifier: 'idf'
        }
      };
    }

    await this.ensureCollection(collectionName, collectionConfig);
  }

  async createHybridCollection(collectionName: string, dimension: number): Promise<void> {
    const collectionConfig: any = {
      vectors: {
        vector: {
          size: dimension,
          distance: this.distance
        },
        summary_vector: {
          size: dimension,
          distance: this.distance
        }
      },
      optimizers_config: {
        default_segment_number: 1
      },
      on_disk_payload: true
    };

    // Always add sparse vector support for hybrid collections
    collectionConfig.sparse_vectors = {
      sparse: {
        modifier: 'idf'
      }
    };

    await this.ensureCollection(collectionName, collectionConfig);
  }

  private async ensureCollection(collectionName: string, body: Record<string, any>): Promise<void> {
    const exists = await this.hasCollection(collectionName);
    if (exists) {
      console.log(`[QdrantVectorDB] 📦 Collection ${collectionName} already exists`);
      return;
    }

    await this.client.createCollection(collectionName, body);
    console.log(`[QdrantVectorDB] ✅ Created collection ${collectionName}`);
  }

  async dropCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection(collectionName);
      console.log(`[QdrantVectorDB] 🗑️  Dropped collection ${collectionName}`);
    } catch (error) {
      console.warn(`[QdrantVectorDB] ⚠️  Failed to drop collection ${collectionName}:`, error);
    }
  }

  async hasCollection(collectionName: string): Promise<boolean> {
    try {
      await this.client.getCollection(collectionName);
      return true;
    } catch {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.result?.collections?.map(col => col.name) ?? [];
  }

  async insert(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;
    await this.client.upsert(collectionName, {
      points: documents.map(doc => this.toPoint(doc, false))
    });
  }

  async insertHybrid(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;
    await this.client.upsert(collectionName, {
      points: documents.map(doc => this.toPoint(doc, true))
    });
  }

  async search(collectionName: string, queryVector: number[], options?: SearchOptions): Promise<VectorSearchResult[]> {
    const limit = options?.topK ?? 10;

    const response = await this.client.search(collectionName, {
      vector: {
        name: 'vector',
        vector: queryVector
      },
      limit,
      filter: this.buildFilter(options?.filter)
    });

    const results = Array.isArray(response.result) ? response.result : [];
    return results.map(result => ({
      document: this.fromPayload(result.payload, result.id?.toString()),
      score: result.score ?? 0
    }));
  }

  async hybridSearch(
    collectionName: string,
    searchRequests: HybridSearchRequest[],
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    if (!searchRequests.length) {
      return [];
    }

    const limit = options?.limit ?? 10;
    const filter = this.buildFilter(options?.filter);

    const resultsPerRequest: RankedPoint[][] = [];
    for (const request of searchRequests) {
      if (!Array.isArray(request.data)) {
        throw new Error('Qdrant hybrid search currently supports dense vectors only.');
      }

      const response = await this.client.search(collectionName, {
        vector: request.data,
        vector_name: request.anns_field ?? 'vector',
        limit: request.limit ?? limit,
        filter
      });

      const resultPoints = Array.isArray(response.result) ? response.result : [];
      resultsPerRequest.push(resultPoints.map(item => ({
        id: item.id?.toString() ?? '',
        score: item.score ?? 0,
        payload: item.payload
      })));
    }

    const reranked = this.rerank(resultsPerRequest, options?.rerank);
    return reranked.slice(0, limit).map(item => ({
      document: this.fromPayload(item.payload, item.id),
      score: item.score
    }));
  }

  /**
   * Hybrid query combining dense and sparse vectors using Qdrant query API
   * @param collectionName Collection name
   * @param denseVector Dense embedding vector
   * @param sparseVector Sparse vector (SPLADE format)
   * @param options Search options
   */
  async hybridQuery(
    collectionName: string,
    denseVector: number[],
    sparseVector: { indices: number[]; values: number[] },
    options?: SearchOptions
  ): Promise<VectorSearchResult[]> {
    const limit = options?.topK ?? 10;
    const denseWeight = parseFloat(process.env.HYBRID_DENSE_WEIGHT || '0.6');
    const sparseWeight = parseFloat(process.env.HYBRID_SPARSE_WEIGHT || '0.4');

    try {
      // Use Qdrant's query API with prefetch for fusion
      const response = await this.client.request<QdrantSearchPoint[]>('/collections/' + encodeURIComponent(collectionName) + '/points/query', {
        method: 'POST',
        body: JSON.stringify({
          prefetch: [
            {
              query: denseVector,
              using: 'vector',
              limit: limit * 3, // Fetch more for better fusion
              filter: this.buildFilter(options?.filter)
            },
            {
              query: {
                indices: sparseVector.indices,
                values: sparseVector.values
              },
              using: 'sparse',
              limit: limit * 3,
              filter: this.buildFilter(options?.filter)
            }
          ],
          query: {
            fusion: 'rrf' // Reciprocal Rank Fusion
          },
          limit: limit,
          with_payload: true,
          with_vector: false
        })
      });

      const results = Array.isArray(response.result) ? response.result : [];
      return results.map(result => ({
        document: this.fromPayload(result.payload, result.id?.toString()),
        score: result.score ?? 0
      }));
    } catch (error) {
      // Fallback to weighted combination if RRF not available
      console.warn('[QdrantVectorDB] RRF fusion failed, falling back to weighted search:', error);
      return await this.hybridSearchFallback(collectionName, denseVector, sparseVector, options);
    }
  }

  /**
   * Fallback hybrid search using weighted combination
   */
  private async hybridSearchFallback(
    collectionName: string,
    denseVector: number[],
    sparseVector: { indices: number[]; values: number[] },
    options?: SearchOptions
  ): Promise<VectorSearchResult[]> {
    const limit = options?.topK ?? 10;
    const denseWeight = parseFloat(process.env.HYBRID_DENSE_WEIGHT || '0.6');
    const sparseWeight = parseFloat(process.env.HYBRID_SPARSE_WEIGHT || '0.4');

    // Fetch results from both vectors separately
    const [denseResults, sparseResults] = await Promise.all([
      this.search(collectionName, denseVector, { ...options, topK: limit * 2 }),
      this.searchSparse(collectionName, sparseVector, { ...options, topK: limit * 2 })
    ]);

    // Combine using RRF
    const scoreMap = new Map<string, { document: VectorDocument; denseScore: number; sparseScore: number }>();

    denseResults.forEach((result, idx) => {
      const existing = scoreMap.get(result.document.id);
      if (existing) {
        existing.denseScore = result.score;
      } else {
        scoreMap.set(result.document.id, {
          document: result.document,
          denseScore: result.score,
          sparseScore: 0
        });
      }
    });

    sparseResults.forEach((result, idx) => {
      const existing = scoreMap.get(result.document.id);
      if (existing) {
        existing.sparseScore = result.score;
      } else {
        scoreMap.set(result.document.id, {
          document: result.document,
          denseScore: 0,
          sparseScore: result.score
        });
      }
    });

    // Compute weighted scores
    const combined = Array.from(scoreMap.values()).map(item => ({
      document: item.document,
      score: (item.denseScore * denseWeight) + (item.sparseScore * sparseWeight)
    }));

    // Sort by score and return top-k
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, limit);
  }

  /**
   * Search using sparse vector only
   */
  private async searchSparse(
    collectionName: string,
    sparseVector: { indices: number[]; values: number[] },
    options?: SearchOptions
  ): Promise<VectorSearchResult[]> {
    const limit = options?.topK ?? 10;

    try {
      const response = await this.client.search(collectionName, {
        vector: {
          name: 'sparse',
          vector: {
            indices: sparseVector.indices,
            values: sparseVector.values
          }
        },
        limit,
        filter: this.buildFilter(options?.filter)
      });

      const results = Array.isArray(response.result) ? response.result : [];
      return results.map(result => ({
        document: this.fromPayload(result.payload, result.id?.toString()),
        score: result.score ?? 0
      }));
    } catch (error) {
      console.warn('[QdrantVectorDB] Sparse search failed:', error);
      return [];
    }
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.client.deletePoints(collectionName, {
      points: ids
    });
  }

  async deleteByDataset(collectionName: string, datasetId: string): Promise<number | undefined> {
    try {
      const response = await this.client.deletePoints(collectionName, {
        filter: {
          must: [
            {
              key: 'dataset_id',
              match: { value: datasetId }
            }
          ]
        }
      });

      if (response?.status === 'ok') {
        console.log(`[QdrantVectorDB] 🗑️  Requested deletion for dataset ${datasetId} in ${collectionName}`);
      }

      // Qdrant does not report affected point count for filtered deletions
      return undefined;
    } catch (error: any) {
      if (error?.message?.includes('404')) {
        console.warn(`[QdrantVectorDB] ⚠️  Collection ${collectionName} missing while deleting dataset ${datasetId}`);
        return 0;
      }

      throw error;
    }
  }

  async query(
    collectionName: string,
    filter: string,
    outputFields: string[],
    limit: number = 10
  ): Promise<Record<string, any>[]> {
    // Support simple equality filters: relativePath == "foo"
    const parsedFilter = this.parseSimpleFilter(filter);
    if (!parsedFilter) {
      console.warn(`[QdrantVectorDB] ⚠️  Unsupported filter expression: ${filter}`);
      return [];
    }

    const response = await this.client.scroll(collectionName, {
      filter: {
        must: [
          {
            key: parsedFilter.key,
            match: { value: parsedFilter.value }
          }
        ]
      },
      limit
    });

    const points = response.result?.points ?? [];
    return points.map(point => {
      const payload = point.payload ?? {};
      const record: Record<string, any> = {};
      outputFields.forEach(field => {
        record[field] = payload[field];
      });
      if (outputFields.includes('id')) {
        record.id = point.id?.toString();
      }
      return record;
    }) ?? [];
  }

  async checkCollectionLimit(): Promise<boolean> {
    return true;
  }

  async getCollectionStats(collectionName: string): Promise<CollectionStats | null> {
    try {
      const info = await this.client.getCollection(collectionName);
      const vectors = info.result?.config?.params?.vectors;
      let dimension: number | undefined;

      if (vectors && typeof vectors === 'object') {
        const vectorParams = (vectors as Record<string, { size?: number }>);
        dimension = vectorParams.vector?.size;
      }

      return {
        entityCount: info.result?.status?.points_count ?? 0,
        dimension
      };
    } catch (error) {
      console.warn(`[QdrantVectorDB] ⚠️  Failed to get stats for ${collectionName}:`, error);
      return null;
    }
  }

  async close(): Promise<void> {
    // No persistent connections to close in REST client
  }

  private toPoint(doc: VectorDocument, includeSummary: boolean): QdrantPointStruct {
    const payload: Record<string, any> = {
      content: doc.content,
      relative_path: doc.relativePath,
      start_line: doc.startLine,
      end_line: doc.endLine,
      file_extension: doc.fileExtension,
      project_id: doc.projectId,
      dataset_id: doc.datasetId,
      source_type: doc.sourceType,
      repo: doc.repo,
      branch: doc.branch,
      sha: doc.sha,
      lang: doc.lang,
      symbol: doc.symbol,
      metadata: doc.metadata
    };

    const vectors: Record<string, number[]> = {
      vector: doc.vector
    };

    if (includeSummary) {
      vectors.summary_vector = doc.summaryVector ?? doc.vector;
    }

    // Convert string ID to UUID for Qdrant compatibility
    // Qdrant requires IDs to be either UUIDs or unsigned integers
    const qdrantId = this.stringToUUID(doc.id);

    const point: any = {
      id: qdrantId,
      vectors,
      payload
    };

    // Add sparse vectors if present
    if (doc.sparse?.indices?.length) {
      point.sparse_vectors = {
        sparse: {
          indices: doc.sparse.indices,
          values: doc.sparse.values
        }
      };
    }

    return point;
  }

  private stringToUUID(str: string): string {
    // Use a namespace UUID (arbitrary but consistent)
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // ISO OID namespace
    
    // Create a deterministic UUID v5 from the string
    const hash = crypto.createHash('sha1').update(namespace + str).digest();
    
    // Format as UUID v5
    const uuid = [
      hash.subarray(0, 4).toString('hex'),
      hash.subarray(4, 6).toString('hex'),
      // Version 5 and variant bits
      ((hash[6] & 0x0f) | 0x50).toString(16).padStart(2, '0') + hash[7].toString(16).padStart(2, '0'),
      ((hash[8] & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash[9].toString(16).padStart(2, '0'),
      hash.subarray(10, 16).toString('hex')
    ].join('-');
    
    return uuid;
  }

  private fromPayload(payload: Record<string, any> | undefined, id?: string): VectorDocument {
    const meta = payload?.metadata ?? {};
    return {
      id: id ?? payload?.id ?? '',
      vector: [],
      content: payload?.content ?? '',
      relativePath: payload?.relative_path ?? payload?.relativePath ?? '',
      startLine: payload?.start_line ?? payload?.startLine ?? 0,
      endLine: payload?.end_line ?? payload?.endLine ?? 0,
      fileExtension: payload?.file_extension ?? payload?.fileExtension ?? '',
      projectId: payload?.project_id ?? payload?.projectId,
      datasetId: payload?.dataset_id ?? payload?.datasetId,
      sourceType: payload?.source_type ?? payload?.sourceType,
      repo: payload?.repo,
      branch: payload?.branch,
      sha: payload?.sha,
      lang: payload?.lang,
      symbol: payload?.symbol,
      metadata: typeof meta === 'object' ? meta : {}
    };
  }

  private buildFilter(filter?: Record<string, any>): QdrantFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const must: Array<{ key: string; match: { value?: any; any?: any[] } }> = [];

    if (filter.projectId) {
      must.push({
        key: 'project_id',
        match: { value: filter.projectId }
      });
    }

    if (filter.datasetIds && Array.isArray(filter.datasetIds) && filter.datasetIds.length > 0) {
      must.push({
        key: 'dataset_id',
        match: { any: filter.datasetIds }
      });
    }

    if (filter.sourceType) {
      must.push({
        key: 'source_type',
        match: { value: filter.sourceType }
      });
    }

    if (filter.repo) {
      must.push({
        key: 'repo',
        match: { value: filter.repo }
      });
    }

    if (filter.lang) {
      must.push({
        key: 'lang',
        match: { value: filter.lang }
      });
    }

    if (!must.length) {
      return undefined;
    }

    return { must };
  }

  private parseSimpleFilter(filter: string): { key: string; value: string } | null {
    const match = filter.match(/^\s*([a-zA-Z0-9_]+)\s*==\s*\"(.+)\"\s*$/);
    if (!match) {
      return null;
    }

    let key = match[1];
    const value = match[2];

    if (key === 'relativePath') {
      key = 'relative_path';
    }

    return { key, value };
  }

  private rerank(resultSets: RankedPoint[][], strategy?: RerankStrategy): RankedPoint[] {
    const rrfK = (strategy?.params?.k as number | undefined) ?? 60;

    const scores = new Map<string, { score: number; point: RankedPoint }>();

    resultSets.forEach(resultSet => {
      resultSet.forEach((point, index) => {
        const contribution = 1 / (rrfK + index + 1);
        const existing = scores.get(point.id);
        if (existing) {
          existing.score += contribution;
        } else {
          scores.set(point.id, { score: contribution, point });
        }
      });
    });

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.point,
        score: item.score
      }));
  }
}
