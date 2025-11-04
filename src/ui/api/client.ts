import type {
  IngestionJob,
  MetricPulse,
  OperationsEvent,
  PipelinePhase,
  QueryResult,
  RetrievalSession,
  ScopeLevel,
  ScopeResource,
  SmartAnswer,
  SmartQueryMetadata
} from '../data/mock-dashboard';
import {
  mockIngestionJobs,
  mockMetricPulses,
  mockMcpTools,
  mockOperationsEvents,
  mockPipelinePhases,
  mockRetrievalSessions,
  mockScopes
} from '../data/mock-dashboard';

export interface GithubIngestForm {
  project: string;
  dataset?: string;
  repo: string;
  branch?: string;
  sha?: string;
  scope: ScopeLevel;
  includeGlobal?: boolean;
  force?: boolean;
}

export interface CrawlIngestForm {
  project: string;
  dataset: string;
  startUrl: string;
  crawlType: 'single' | 'batch' | 'recursive' | 'sitemap';
  maxPages: number;
  depth: number;
  scope: ScopeLevel;
  force?: boolean;
}

export type SmartStrategy = 'multi-query' | 'refinement' | 'concept-extraction';

export interface QueryRequest {
  project: string;
  scope: ScopeLevel;
  query: string;
  repo?: string;
  pathPrefix?: string;
  lang?: string;
  includeGlobal?: boolean;
  k?: number;
}

export interface SmartQueryRequest extends QueryRequest {
  strategies: SmartStrategy[];
  answerType: 'conversational' | 'structured';
  dataset?: string;
}

export interface ProjectSnapshot {
  project: string;
  metrics: MetricPulse[];
  pipeline: PipelinePhase[];
}

export interface ShareResourceRequest {
  fromProject: string;
  toProject: string;
  resourceType: 'dataset' | 'web_page' | 'document';
  resourceId: string;
  expiresAt?: string;
}

export interface WebIngestForm {
  project: string;
  pages: Array<{ url: string; content: string; title?: string; domain?: string }>;
  dataset?: string;
  forceReindex?: boolean;
}

export interface ContextClient {
  fetchSnapshot(project: string): Promise<ProjectSnapshot>;
  listScopeResources(project: string): Promise<Record<ScopeLevel, ScopeResource[]>>;
  fetchIngestionJobs(project: string): Promise<IngestionJob[]>;
  triggerGithubIngest(form: GithubIngestForm): Promise<IngestionJob>;
  triggerCrawlIngest(form: CrawlIngestForm): Promise<IngestionJob>;
  triggerWebIngest(form: WebIngestForm): Promise<IngestionJob>;
  deleteWebDataset(project: string, dataset: string): Promise<any>;
  runQuery(request: QueryRequest): Promise<RetrievalSession>;
  runSmartQuery(request: SmartQueryRequest): Promise<RetrievalSession>;
  runWebQuery(request: SmartQueryRequest): Promise<RetrievalSession>;
  listOperations(project: string): Promise<OperationsEvent[]>;
  shareResource(request: ShareResourceRequest): Promise<void>;
  listTools(): Promise<string[]>;
}

export interface ContextApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export class ContextApiClient implements ContextClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: ContextApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? window.fetch.bind(window);
    this.headers = options.headers ?? {};
  }

  async fetchSnapshot(project: string): Promise<ProjectSnapshot> {
    const stats = await this.request<{ metrics: any; pipeline?: PipelinePhase[]; pulses?: MetricPulse[] }>(
      `/projects/${project}/stats`,
      { method: 'GET' }
    );

    const metricSource = Array.isArray(stats.metrics)
      ? stats.metrics
      : Array.isArray(stats.pulses)
        ? stats.pulses
        : [];

    const metrics: MetricPulse[] = metricSource
      .filter((metric) => Boolean(metric?.label))
      .map((metric: any) => {
        const rawValue = metric?.value;

        return {
          ...metric,
          value:
            typeof rawValue === 'number'
              ? rawValue.toLocaleString()
              : typeof rawValue === 'string'
                ? rawValue
                : '0',
          trend: metric?.trend ?? 'steady',
          caption: metric?.caption ?? ''
        } as MetricPulse;
      });

    const pipeline: PipelinePhase[] = Array.isArray(stats.pipeline) ? stats.pipeline : [];

    return {
      project,
      metrics,
      pipeline
    };
  }

  async listScopeResources(project: string): Promise<Record<ScopeLevel, ScopeResource[]>> {
    const response = await this.request<Record<string, ScopeResource[]>>(
      `/projects/${project}/scopes`,
      { method: 'GET' },
      true
    );
    const safeScopes = {
      global: [] as ScopeResource[],
      project: [] as ScopeResource[],
      local: [] as ScopeResource[]
    };

    if (response && typeof response === 'object') {
      const entries = response as Record<string, ScopeResource[]>;
      safeScopes.global = Array.isArray(entries.global) ? entries.global : [];
      safeScopes.project = Array.isArray(entries.project) ? entries.project : [];
      safeScopes.local = Array.isArray(entries.local) ? entries.local : [];
    }

    return safeScopes;
  }

  async fetchIngestionJobs(project: string): Promise<IngestionJob[]> {
    const response = await this.request<IngestionJob[] | undefined>(
      `/projects/${project}/ingest/history`,
      { method: 'GET' },
      true
    );
    return Array.isArray(response) ? response : [];
  }

  async triggerGithubIngest(form: GithubIngestForm): Promise<IngestionJob> {
    const payload = {
      repo: form.repo,
      branch: form.branch,
      sha: form.sha,
      dataset: form.dataset,
      scope: form.scope,
      force: form.force === true
    };

    const response = await this.request<any>(`/projects/${form.project}/ingest/github`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const rawStatus = response.status ?? 'queued';
    const normalizedStatus = rawStatus === 'skipped' ? 'completed' : rawStatus;
    const summary = rawStatus === 'skipped'
      ? response.message ?? `GitHub ingest already up-to-date for ${form.repo}`
      : response.stats?.summary ?? `GitHub ingest for ${form.repo}`;

    return {
      id: response.jobId ?? `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'github',
      project: form.project,
      dataset: form.dataset ?? form.repo,
      scope: form.scope,
      status: normalizedStatus,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: '⏳ live',
      summary
    };
  }

  async deleteGithubDataset(project: string, params: { dataset?: string; repo?: string }): Promise<any> {
    const payload: Record<string, string> = {};
    if (params.dataset) {
      payload.dataset = params.dataset;
    }
    if (params.repo) {
      payload.repo = params.repo;
    }

    return this.request<any>(`/projects/${project}/ingest/github`, {
      method: 'DELETE',
      body: JSON.stringify(payload)
    });
  }

  async triggerCrawlIngest(form: CrawlIngestForm): Promise<IngestionJob> {
    const payload = {
      start_url: form.startUrl,
      crawl_type: form.crawlType,
      max_pages: form.maxPages,
      depth: form.depth,
      dataset: form.dataset,
      scope: form.scope,
      force: form.force === true
    };

    const response = await this.request<any>(`/projects/${form.project}/ingest/crawl`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const rawStatus = response.status ?? 'queued';
    const normalizedStatus = rawStatus === 'skipped' ? 'completed' : rawStatus;
    const summary = rawStatus === 'skipped'
      ? response.message ?? `Crawl already completed for ${form.startUrl}`
      : response.ingestedCount
        ? `Crawl ingest (${response.ingestedCount} pages)`
        : `Crawl ingest for ${form.startUrl}`;

    return {
      id: response.jobId ?? `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'crawl',
      project: form.project,
      dataset: form.dataset,
      scope: form.scope,
      status: normalizedStatus,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: '⏳ live',
      summary
    };
  }

  async triggerWebIngest(form: WebIngestForm): Promise<IngestionJob> {
    const payload = {
      pages: form.pages,
      dataset: form.dataset || 'web-content',
      forceReindex: form.forceReindex === true
    };

    const response = await this.request<any>(`/projects/${form.project}/ingest/web`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      id: response.jobId || `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'crawl',
      project: form.project,
      dataset: form.dataset || 'web-content',
      scope: 'project',
      status: response.status || 'completed',
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 'Done',
      summary: `${response.processedPages || form.pages.length} pages ingested, ${response.totalChunks || 0} chunks created`
    };
  }

  async deleteWebDataset(project: string, dataset: string): Promise<any> {
    return this.request<any>(`/projects/${project}/ingest/web?dataset=${encodeURIComponent(dataset)}`, {
      method: 'DELETE'
    });
  }

  async runWebQuery(request: SmartQueryRequest): Promise<RetrievalSession> {
    const payload = {
      query: request.query,
      dataset: request.dataset,
      strategies: request.strategies,
      answerType: request.answerType,
      topK: request.k
    };

    const response = await this.request<{
      request_id?: string;
      answer?: any;
      results?: any[];
      metadata?: any;
      latency_ms?: number;
    }>(`/projects/${request.project}/query/web`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const results: QueryResult[] = response.results?.map((item) => ({
      chunk: item.chunk,
      file: item.url || item.file,
      lineStart: item.lineSpan?.start || 0,
      lineEnd: item.lineSpan?.end || 0,
      vectorScore: item.scores?.vector || 0,
      sparseScore: item.scores?.sparse || 0,
      rerankScore: item.scores?.rerank || item.scores?.final || 0,
      dataset: item.datasetId || '',
      scope: 'project',
      why: 'Smart web query result',
      chunkTitle: item.title,
    })) || [];

    return {
      id: response.request_id || `session_${Math.random().toString(36).slice(2, 8)}`,
      query: request.query,
      scope: request.scope,
      results,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: response.latency_ms || 0,
      toolsUsed: ['smartWebQuery'],
      metadata: response.metadata,
      smartAnswer: response.answer
    };
  }

  async runQuery(request: QueryRequest): Promise<RetrievalSession> {
    const payload = {
      query: request.query,
      repo: request.repo,
      pathPrefix: request.pathPrefix,
      lang: request.lang,
      includeGlobal: request.includeGlobal,
      k: request.k
    };

    const response = await this.request<{
      results: Array<{
        chunk: string;
        file: string;
        lineSpan: { start: number; end: number };
        scores: { vector: number; sparse?: number; rerank?: number; final?: number };
        datasetId?: string;
        projectId?: string;
        projectName?: string;
        repo?: string;
        lang?: string;
        projectScope?: ScopeLevel;
        why?: string;
        chunkTitle?: string;
        symbolName?: string;
        symbolKind?: string;
      }>;
      metadata?: {
        retrievalMethod: string;
        featuresUsed: {
          hybridSearch: boolean;
          reranking: boolean;
          symbolExtraction: boolean;
        };
        timingMs?: {
          embedding?: number;
          search?: number;
          reranking?: number;
          total?: number;
        };
        searchParams?: {
          initialK: number;
          finalK: number;
          denseWeight?: number;
          sparseWeight?: number;
        };
      };
      evidence?: string;
      latency_ms?: number;
      tool_invocations?: string[];
    }>(`/projects/${request.project}/query`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const results: QueryResult[] = response.results?.map((item) => ({
      chunk: item.chunk,
      file: item.file,
      lineStart: item.lineSpan?.start ?? 0,
      lineEnd: item.lineSpan?.end ?? 0,
      vectorScore: item.scores?.vector ?? 0,
      sparseScore: item.scores?.sparse ?? 0,
      rerankScore: item.scores?.rerank ?? item.scores?.final ?? 0,
      dataset: item.datasetId ?? '',
      scope: item.projectScope ?? request.scope,
      why: item.why ?? response.evidence ?? 'Hybrid result with rerank evidence.',
      chunkTitle: item.chunkTitle,
      repo: item.repo,
      lang: item.lang,
      projectId: item.projectId,
      projectName: item.projectName,
      symbolName: item.symbolName,
      symbolKind: item.symbolKind
    })) ?? [];

    return {
      id: `session_${Math.random().toString(36).slice(2, 8)}`,
      query: request.query,
      scope: request.scope,
      results,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: response.latency_ms ?? response.metadata?.timingMs?.total ?? 0,
      toolsUsed: response.tool_invocations ?? [],
      metadata: response.metadata
    };
  }

  async runSmartQuery(request: SmartQueryRequest): Promise<RetrievalSession> {
    const payload = {
      query: request.query,
      repo: request.repo,
      pathPrefix: request.pathPrefix,
      lang: request.lang,
      includeGlobal: request.includeGlobal,
      strategies: request.strategies,
      answerType: request.answerType,
      topK: request.k
    };

    const response = await this.request<{
      answer: SmartAnswer;
      retrievals: Array<{
        id?: string;
        chunk: string;
        file: string;
        lineSpan: { start: number; end: number };
        scores: { vector: number; sparse?: number; rerank?: number; final?: number };
        datasetId?: string;
        projectId?: string;
        projectName?: string;
        repo?: string;
        lang?: string;
        projectScope?: ScopeLevel;
        why?: string;
        chunkTitle?: string;
        symbolName?: string;
        symbolKind?: string;
        smartStrategies?: string[];
      }>;
      metadata?: SmartQueryMetadata;
      latency_ms?: number;
      tool_invocations?: string[];
    }>(`/projects/${request.project}/smart-query`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const results: QueryResult[] = response.retrievals?.map((item) => ({
      chunk: item.chunk,
      file: item.file,
      lineStart: item.lineSpan?.start ?? 0,
      lineEnd: item.lineSpan?.end ?? 0,
      vectorScore: item.scores?.vector ?? 0,
      sparseScore: item.scores?.sparse ?? 0,
      rerankScore: item.scores?.rerank ?? item.scores?.final ?? 0,
      dataset: item.datasetId ?? '',
      scope: item.projectScope ?? request.scope,
      why: item.why ?? 'Aggregated smart retrieval result.',
      chunkTitle: item.chunkTitle,
      repo: item.repo,
      lang: item.lang,
      projectId: item.projectId,
      projectName: item.projectName,
      symbolName: item.symbolName,
      symbolKind: item.symbolKind,
      smartStrategies: item.smartStrategies
    })) ?? [];

    const baseMetadata = response.metadata?.queryRuns?.find((run) => run.metadata)?.metadata;

    return {
      id: `smart_${Math.random().toString(36).slice(2, 8)}`,
      query: request.query,
      scope: request.scope,
      results,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: response.latency_ms ?? response.metadata?.timingMs?.total ?? 0,
      toolsUsed: response.tool_invocations ?? ['claudeContext.smartQuery'],
      metadata: baseMetadata,
      smartAnswer: response.answer,
      smartMetadata: response.metadata
    };
  }

  async listOperations(project: string): Promise<OperationsEvent[]> {
    const response = await this.request<OperationsEvent[] | undefined>(
      `/projects/${project}/operations`,
      { method: 'GET' },
      true
    );
    return Array.isArray(response) ? response : [];
  }

  async shareResource(request: ShareResourceRequest): Promise<void> {
    await this.request(`/projects/${request.fromProject}/share`, {
      method: 'POST',
      body: JSON.stringify({
        to_project: request.toProject,
        resource_type: request.resourceType,
        resource_id: request.resourceId,
        expires_at: request.expiresAt
      })
    });
  }

  async listTools(): Promise<string[]> {
    const response = await this.request<string[] | undefined>('/tools', { method: 'GET' }, true);
    return Array.isArray(response) ? response.filter((tool) => typeof tool === 'string' && tool.length > 0) : [];
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    allow404 = false
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...this.headers,
        ...init.headers
      }
    });

    if (!response.ok) {
      if (allow404 && response.status === 404) {
        return undefined as T;
      }

      const text = await response.text();
      throw new Error(`Request failed (${response.status}): ${text}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  }
}

/**
 * In-memory mock client used for the glass UI showcase.
 */
export class MockContextApiClient implements ContextClient {
  private ingestionJobs: IngestionJob[];
  private retrievalSessions: RetrievalSession[];
  private operationsEvents: OperationsEvent[];

  constructor() {
    this.ingestionJobs = [...mockIngestionJobs];
    this.retrievalSessions = [...mockRetrievalSessions];
    this.operationsEvents = [...mockOperationsEvents];
  }

  async fetchSnapshot(project: string): Promise<ProjectSnapshot> {
    return {
      project,
      metrics: mockMetricPulses,
      pipeline: mockPipelinePhases
    };
  }

  async listScopeResources(): Promise<Record<ScopeLevel, ScopeResource[]>> {
    return mockScopes;
  }

  async fetchIngestionJobs(): Promise<IngestionJob[]> {
    return [...this.ingestionJobs];
  }

  async triggerGithubIngest(form: GithubIngestForm): Promise<IngestionJob> {
    const job: IngestionJob = {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'github',
      project: form.project,
      dataset: form.dataset ?? form.repo,
      scope: form.scope,
      status: 'queued',
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 'pending',
      summary: `GitHub ingest for ${form.repo}${form.branch ? ` (${form.branch})` : ''}`
    };

    this.ingestionJobs = [job, ...this.ingestionJobs].slice(0, 6);
    return job;
  }

  async triggerCrawlIngest(form: CrawlIngestForm): Promise<IngestionJob> {
    const job: IngestionJob = {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'crawl',
      project: form.project,
      dataset: form.dataset,
      scope: form.scope,
      status: 'queued',
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 'pending',
      summary: `Crawl ${form.startUrl} (${form.maxPages} pages max)`
    };

    this.ingestionJobs = [job, ...this.ingestionJobs].slice(0, 6);
    return job;
  }

  async runQuery(request: QueryRequest): Promise<RetrievalSession> {
    const session: RetrievalSession = {
      id: `session_${Math.random().toString(36).slice(2, 8)}`,
      query: request.query,
      scope: request.scope,
      results: mockRetrievalSessions[0]?.results ?? [],
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: 1480,
      toolsUsed: ['claudeContext.search', 'claudeContext.evidence']
    };

    this.retrievalSessions = [session, ...this.retrievalSessions].slice(0, 5);
    return session;
  }

  async runSmartQuery(request: SmartQueryRequest): Promise<RetrievalSession> {
    const baseResults = (mockRetrievalSessions[0]?.results ?? []).map((result, index) => ({
      ...result,
      smartStrategies: request.strategies,
      why: result.why ?? 'Strategy-enhanced smart retrieval hit.',
      lineStart: result.lineStart ?? 0,
      lineEnd: result.lineEnd ?? 0,
      chunkTitle: result.chunkTitle ?? undefined,
      dataset: result.dataset ?? '',
      scope: result.scope ?? request.scope,
      repo: result.repo,
      lang: result.lang,
      vectorScore: result.vectorScore ?? 0,
      sparseScore: result.sparseScore ?? 0,
      rerankScore: result.rerankScore ?? 0,
      symbolName: result.symbolName,
      symbolKind: result.symbolKind,
      projectId: result.projectId,
      projectName: result.projectName,
      smartReferenceId: `chunk-${index + 1}`
    }));

    const smartAnswer: SmartAnswer = {
      type: request.answerType,
      content: `Smart response for **${request.query}** leveraging strategies: ${request.strategies.join(', ')}.\n\nThis placeholder response showcases how LLM would synthesize insights with inline chunk references like [chunk:chunk-1].`,
      chunkReferences: baseResults.slice(0, 3).map((result) => (result as any).smartReferenceId ?? ''),
      confidence: 0.62
    };

    const smartMetadata: SmartQueryMetadata = {
      strategies: request.strategies,
      queryVariations: [request.query, `${request.query} refined`, `${request.query} key terms`],
      totalRetrievals: baseResults.length,
      timingMs: {
        enhancement: 180,
        retrieval: 620,
        synthesis: 340,
        total: 1140
      }
    };

    const session: RetrievalSession = {
      id: `smart_${Math.random().toString(36).slice(2, 8)}`,
      query: request.query,
      scope: request.scope,
      results: baseResults.map(({ smartReferenceId, ...rest }) => rest),
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: smartMetadata.timingMs?.total ?? 1200,
      toolsUsed: ['claudeContext.smartQuery', 'LLM'],
      smartAnswer,
      smartMetadata
    };

    this.retrievalSessions = [session, ...this.retrievalSessions].slice(0, 5);
    return session;
  }

  async triggerWebIngest(form: WebIngestForm): Promise<IngestionJob> {
    const job: IngestionJob = {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      source: 'crawl',
      project: form.project,
      dataset: form.dataset || 'web-content',
      scope: 'project',
      status: 'completed',
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 'Done',
      summary: `${form.pages.length} pages ingested to ${form.dataset || 'web-content'}`
    };

    this.ingestionJobs = [job, ...this.ingestionJobs].slice(0, 6);
    return job;
  }

  async deleteWebDataset(project: string, dataset: string): Promise<any> {
    // Mock implementation - filter out the dataset from ingestion jobs
    this.ingestionJobs = this.ingestionJobs.filter(
      job => !(job.project === project && job.dataset === dataset)
    );
    return { project, dataset, status: 'deleted' };
  }

  async runWebQuery(request: SmartQueryRequest): Promise<RetrievalSession> {
    // Reuse smart query logic with web-specific modifications
    const session = await this.runSmartQuery(request);
    session.toolsUsed = ['webQuery', 'smartWebQuery'];
    return session;
  }

  async listOperations(): Promise<OperationsEvent[]> {
    return [...this.operationsEvents];
  }

  async shareResource(): Promise<void> {
    // noop - pretend it succeeded
  }

  async listTools(): Promise<string[]> {
    return [...mockMcpTools];
  }
}
