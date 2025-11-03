export type ScopeLevel = 'global' | 'project' | 'local';

export interface ScopeResource {
  name: string;
  type: 'dataset' | 'web' | 'document';
  id: string;
  updatedAt: string;
  highlights: string[];
}

export interface MetricPulse {
  label: string;
  value: string;
  trend: 'up' | 'steady' | 'down';
  caption: string;
}

export interface PipelinePhase {
  name: string;
  subPhase?: string;
  description: string;
  throughput: string;
  latency: string;
  status: 'nominal' | 'warning' | 'critical';
  nextDeliveryMs: number;
  completion: number;
  badges?: string[];
}

export interface IngestionJob {
  id: string;
  source: 'github' | 'crawl';
  project: string;
  dataset: string;
  scope: ScopeLevel;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  duration: string;
  summary: string;
  error?: string; // Error message when status is 'failed'
  progress?: number;
  currentPhase?: string;
  currentFile?: string;
}

export interface SmartAnswer {
  type: 'conversational' | 'structured';
  content: string;
  chunkReferences: string[];
  confidence?: number;
}

export interface RetrievalMetadata {
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
}

export interface SmartQueryMetadata {
  strategies: string[];
  strategiesUsed?: string[];
  queryVariations: string[];
  totalRetrievals?: number;
  timingMs?: {
    enhancement: number;
    retrieval: number;
    synthesis: number;
    total: number;
  };
  tokensUsed?: number;
  enhancedQuery?: {
    originalQuery: string;
    refinedQuery?: string;
    variations: string[];
    conceptTerms: string[];
  };
  queryRuns?: Array<{
    query: string;
    strategy: string;
    resultCount: number;
    requestId: string;
    metadata?: RetrievalMetadata;
  }>;
}

export interface QueryResult {
  chunk: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  vectorScore: number;
  sparseScore: number;
  rerankScore: number;
  dataset: string;
  scope: ScopeLevel;
  why: string;
  chunkTitle?: string;
  repo?: string;
  lang?: string;
  projectId?: string;
  projectName?: string;
  symbolName?: string;
  symbolKind?: string;
  smartStrategies?: string[];
}

export interface RetrievalSession {
  id: string;
  query: string;
  scope: ScopeLevel;
  results: QueryResult[];
  startedAt: string;
  latencyMs: number;
  toolsUsed: string[];
  metadata?: RetrievalMetadata;
  smartAnswer?: SmartAnswer;
  smartMetadata?: SmartQueryMetadata;
}

export interface OperationsEvent {
  timestamp: string;
  title: string;
  detail: string;
  scope: ScopeLevel;
  impact: 'info' | 'success' | 'warning' | 'incident';
}

export const mockMetricPulses: MetricPulse[] = [
  {
    label: 'Projects Online',
    value: '12',
    trend: 'up',
    caption: '+3 new enterprise spaces'
  },
  {
    label: 'Chunks Indexed',
    value: '92,480',
    trend: 'up',
    caption: 'Hybrid vectors + summaries'
  },
  {
    label: 'Search Latency',
    value: '1.8s',
    trend: 'steady',
    caption: 'p95 hybrid + rerank'
  },
  {
    label: 'Crawl Success',
    value: '98.2%',
    trend: 'up',
    caption: 'Last 24h sessions'
  }
];

export const mockScopes: Record<ScopeLevel, ScopeResource[]> = {
  global: [
    {
      name: 'Open Source Playbooks',
      type: 'dataset',
      id: 'ds_global_playbooks',
      updatedAt: '2h ago',
      highlights: ['is_global', 'hybrid-ready']
    },
    {
      name: 'Runtime Guides',
      type: 'document',
      id: 'doc_runtime_guides',
      updatedAt: '4h ago',
      highlights: ['macro + micro', 'tree-sitter curated']
    }
  ],
  project: [
    {
      name: 'Atlas Core',
      type: 'dataset',
      id: 'ds_atlas_core',
      updatedAt: '18m ago',
      highlights: ['dual-vector', 'scope=project']
    },
    {
      name: 'Atlas RFCs',
      type: 'document',
      id: 'doc_atlas_rfcs',
      updatedAt: '31m ago',
      highlights: ['macro summary', 'shared to Ops']
    },
    {
      name: 'Crawl: status.zkairotis.com',
      type: 'web',
      id: 'web_status_panel',
      updatedAt: '47m ago',
      highlights: ['Crawl4AI', 'delta ingest']
    }
  ],
  local: [
    {
      name: 'CLI Sessions',
      type: 'document',
      id: 'doc_cli_sessions',
      updatedAt: '3m ago',
      highlights: ['workspace overrides']
    },
    {
      name: 'Analysis Scratchpad',
      type: 'dataset',
      id: 'ds_local_scratch',
      updatedAt: '11m ago',
      highlights: ['temporary', 'auto-expire']
    }
  ]
};

export const mockPipelinePhases: PipelinePhase[] = [
  {
    name: 'Crawl',
    subPhase: '',
    description: 'Web crawling and page extraction',
    throughput: '0/0',
    latency: '<100ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['Crawl4AI']
  },
  {
    name: 'Chunk',
    subPhase: '',
    description: 'AST + semantic chunker with scoped overlap + code detector',
    throughput: '0/0',
    latency: '<8ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['tree-sitter', 'overlap=32']
  },
  {
    name: 'Summarize',
    subPhase: '',
    description: 'Micro + macro synthesis per chunk with automatic rerank context',
    throughput: '0/0',
    latency: '315ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['LLM-8k']
  },
  {
    name: 'Embed',
    subPhase: 'Content',
    description: 'Dense text embeddings via GTE-large',
    throughput: '0/0',
    latency: '92ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['GTE-large']
  },
  {
    name: 'Embed',
    subPhase: 'Code',
    description: 'Code embeddings via CodeRank',
    throughput: '0/0',
    latency: '92ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['CodeRank']
  },
  {
    name: 'Store',
    subPhase: 'Postgres',
    description: 'Write chunks to Postgres with pgvector',
    throughput: '0/0',
    latency: '210ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['pgvector']
  },
  {
    name: 'Store',
    subPhase: 'Qdrant',
    description: 'Write vectors to Qdrant',
    throughput: '0/0',
    latency: '210ms avg',
    status: 'nominal',
    nextDeliveryMs: 0,
    completion: 0,
    badges: ['Qdrant']
  }
];

export const mockIngestionJobs: IngestionJob[] = [
  {
    id: 'job_github_276',
    source: 'github',
    project: 'Atlas',
    dataset: 'atlas-core',
    scope: 'project',
    status: 'running',
    startedAt: '07:24',
    duration: '4m 12s',
    summary: 'Diff ingest for feature/llm-summaries (24 files)'
  },
  {
    id: 'job_crawl_811',
    source: 'crawl',
    project: 'Atlas',
    dataset: 'atlas-web',
    scope: 'project',
    status: 'completed',
    startedAt: '06:55',
    duration: '3m 44s',
    summary: 'Crawl4AI pull for docs.zkairotis.com (42 pages)'
  },
  {
    id: 'job_github_271',
    source: 'github',
    project: 'Global',
    dataset: 'framework-recipes',
    scope: 'global',
    status: 'completed',
    startedAt: '05:12',
    duration: '7m 08s',
    summary: 'Monorepo ingest with 3k chunk delta'
  }
];

export const mockRetrievalSessions: RetrievalSession[] = [
  {
    id: 'session_429',
    query: 'How do we rerank code + web results for incident runbooks?',
    scope: 'project',
    results: [
      {
        chunk: 'incident-runbooks/trigger-llm.ts chunk#14',
        file: 'src/ops/incident-runbooks.ts',
        lineStart: 142,
        lineEnd: 198,
        vectorScore: 0.84,
        sparseScore: 0.42,
        rerankScore: 0.92,
        dataset: 'atlas-core',
        scope: 'project',
        why: 'Matches hybrid filter, reranked by cross-encoder with incident keyword overlap.',
        smartStrategies: ['multi-query', 'refinement']
      },
      {
        chunk: 'docs/status-playbook.md chunk#5',
        file: 'docs/status-playbook.md',
        lineStart: 62,
        lineEnd: 104,
        vectorScore: 0.77,
        sparseScore: 0.51,
        rerankScore: 0.88,
        dataset: 'atlas-web',
        scope: 'project',
        why: 'Shared dataset coverage with explicit incident summary context.',
        smartStrategies: ['multi-query']
      },
      {
        chunk: 'incident/escalation-matrix.md chunk#2',
        file: 'global/incident/escalation-matrix.md',
        lineStart: 18,
        lineEnd: 58,
        vectorScore: 0.73,
        sparseScore: 0.44,
        rerankScore: 0.83,
        dataset: 'global-playbooks',
        scope: 'global',
        why: 'Global dataset included via scope filter - high rerank relevance.',
        smartStrategies: ['concept-extraction']
      }
    ],
    startedAt: '07:42',
    latencyMs: 1648,
    toolsUsed: ['claudeContext.search', 'claudeContext.evidence'],
    smartAnswer: {
      type: 'conversational',
      content: `The incident runbook pipeline triggers reranking inside 
	src/ops/incident-runbooks.ts around lines 142-198, where we call the
	staged LLM reranker for "send-it" escalations [chunk:chunk-1].

A supporting status summary in docs/status-playbook.md tightens the
incident messaging for customer-facing updates [chunk:chunk-2].

Finally, escalation ownership hand-offs live inside the global
escalation matrix, clarifying who handles on-call escalations
[chunk:chunk-3].`,
      chunkReferences: ['chunk-1', 'chunk-2', 'chunk-3'],
      confidence: 0.71
    },
    smartMetadata: {
      strategies: ['multi-query', 'refinement', 'concept-extraction'],
      queryVariations: [
        'How do we rerank code + web results for incident runbooks?',
        'Where does reranking happen in incident runbooks pipeline?',
        'incident runbook rerank status summary'
      ],
      totalRetrievals: 18,
      timingMs: {
        enhancement: 210,
        retrieval: 780,
        synthesis: 420,
        total: 1410
      },
      tokensUsed: 2950
    }
  },
  {
    id: 'session_427',
    query: 'Summaries for LLM chunk pipeline',
    scope: 'global',
    results: [
      {
        chunk: 'pipeline/llm-summaries.ts chunk#3',
        file: 'src/pipeline/llm-summaries.ts',
        lineStart: 28,
        lineEnd: 96,
        vectorScore: 0.81,
        sparseScore: 0.34,
        rerankScore: 0.9,
        dataset: 'framework-recipes',
        scope: 'global',
        why: 'CodeRank dense vector + summary snippet alignment.'
      }
    ],
    startedAt: '07:18',
    latencyMs: 1220,
    toolsUsed: ['claudeContext.search']
  }
];

export const mockOperationsEvents: OperationsEvent[] = [
  {
    timestamp: '07:38',
    title: 'Hybrid search latency within target',
    detail: 'p95 1.8s with rerank @100, down 12% after payload pruning.',
    scope: 'project',
    impact: 'success'
  },
  {
    timestamp: '07:21',
    title: 'Storage sync tension',
    detail: 'Payload writes slowed by 18%. Investigate pgvector autovacuum.',
    scope: 'project',
    impact: 'warning'
  },
  {
    timestamp: '06:58',
    title: 'Global share: Atlas RFCs ➝ Ops',
    detail: 'Shared dataset ds_atlas_rfcs for 30 days. Pending review.',
    scope: 'global',
    impact: 'info'
  },
  {
    timestamp: '06:35',
    title: 'Incident: stale crawl session',
    detail: 'crawl_session 4f1f timed out (dataset atlas-web). Auto-retry queued.',
    scope: 'project',
    impact: 'incident'
  }
];

export const mockMcpTools = [
  'claudeContext.index',
  'claudeContext.search',
  'claudeContext.ingestCrawl',
  'claudeContext.defaults',
  'claudeContext.datasets',
  'claudeContext.scopes'
];
