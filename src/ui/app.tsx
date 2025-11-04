import * as React from 'react';
import {
  ArrowRight,
  Copy,
  GitBranch,
  Layers3,
  RefreshCw,
  Search,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  TriangleAlert
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Progress } from './components/ui/progress';
import { ScrollArea } from './components/ui/scroll-area';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Select } from './components/ui/select';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import { cn } from './lib/utils';
import { ShadcnGlassStyles } from './styles/glass-styles';
import {
  ContextApiClient,
  MockContextApiClient,
  type ContextClient,
  type CrawlIngestForm,
  type GithubIngestForm,
  type QueryRequest,
  type ShareResourceRequest
} from './api/client';
import type {
  IngestionJob,
  MetricPulse,
  OperationsEvent,
  PipelinePhase,
  RetrievalSession,
  ScopeLevel,
  ScopeResource
} from './data/mock-dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { ConnectionStatus } from './components/connection-status';
import { ErrorDisplay } from './components/error-display';
import type { ErrorMessage } from './types';

type DockSectionId = 'overview' | 'ingest' | 'retrieval' | 'scopes' | 'telemetry' | 'operations';

interface DockSection {
  id: DockSectionId;
  label: string;
  icon: LucideIcon;
}

const DOCK_SECTIONS: DockSection[] = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'ingest', label: 'Ingest', icon: GitBranch },
  { id: 'retrieval', label: 'Retrieval', icon: Search },
  { id: 'scopes', label: 'Scopes', icon: Layers3 },
  { id: 'telemetry', label: 'Telemetry', icon: Server },
  { id: 'operations', label: 'Operations', icon: TriangleAlert }
];

type QueryMode = 'standard' | 'smart';
type SmartStrategy = 'multi-query' | 'refinement' | 'concept-extraction';

const SMART_STRATEGIES: Array<{ id: SmartStrategy; label: string; description: string }> = [
  {
    id: 'multi-query',
    label: 'Multi-Query',
    description: 'Generate additional phrasings to widen recall'
  },
  {
    id: 'refinement',
    label: 'Query Refinement',
    description: 'Expand the query with clarifying details'
  },
  {
    id: 'concept-extraction',
    label: 'Concept Extraction',
    description: 'Surface key terms, symbols, and API names'
  }
];

function scopeLabel(scope: ScopeLevel): string {
  switch (scope) {
    case 'global':
      return 'Global';
    case 'project':
      return 'Project';
    case 'local':
      return 'Local';
    default:
      return scope;
  }
}

function impactChipClass(impact: OperationsEvent['impact']): string {
  switch (impact) {
    case 'success':
      return 'lozenge';
    case 'warning':
      return 'lozenge lozenge-warning';
    case 'incident':
      return 'lozenge lozenge-danger';
    default:
      return 'lozenge';
  }
}

function parseMetricNumber(raw: string): number {
  const normalized = raw.replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPhaseColor(completion: number): { color: string; label: string; className: string } {
  if (completion >= 98) {
    return { color: '#22c55e', label: 'Done', className: 'bg-green-500/20 border-green-500/50' };
  }
  if (completion >= 70) {
    return { color: '#a855f7', label: 'Summarizing', className: 'bg-purple-500/20 border-purple-500/50' };
  }
  if (completion >= 20) {
    return { color: '#3b82f6', label: 'Crawling', className: 'bg-blue-500/20 border-blue-500/50' };
  }
  return { color: '#94a3b8', label: 'Discovery', className: 'bg-slate-500/20 border-slate-500/50' };
}

function computeTrend(previous: MetricPulse | undefined, nextValue: number): MetricPulse['trend'] {
  if (!previous) {
    return 'steady';
  }
  const prevValue = parseMetricNumber(previous.value);
  if (nextValue > prevValue) {
    return 'up';
  }
  if (nextValue < prevValue) {
    return 'down';
  }
  return previous.trend ?? 'steady';
}

function formatMetricValue(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : '0';
}

function upsertMetric(metrics: MetricPulse[], label: string, value: number, caption: string): MetricPulse[] {
  const nextMetric: MetricPulse = {
    label,
    value: formatMetricValue(value),
    trend: computeTrend(metrics.find((metric) => metric.label === label), value),
    caption
  };

  return metrics.some((metric) => metric.label === label)
    ? metrics.map((metric) => (metric.label === label ? nextMetric : metric))
    : [...metrics, nextMetric];
}

export function App(): JSX.Element {
  const [project, setProject] = React.useState('default');
  const [baseUrl, setBaseUrl] = React.useState('http://localhost:3030');
  const [snapshot, setSnapshot] = React.useState<{
    project: string;
    metrics: MetricPulse[];
    pipeline: PipelinePhase[];
  }>({ project, metrics: [], pipeline: [] });
  const [scopeResources, setScopeResources] = React.useState<Record<ScopeLevel, ScopeResource[]>>({ global: [], project: [], local: [] });
  const [activeScope, setActiveScope] = React.useState<ScopeLevel>('project');
  const [ingestionJobs, setIngestionJobs] = React.useState<IngestionJob[]>([]);
  const [retrievalHistory, setRetrievalHistory] = React.useState<RetrievalSession[]>([]);
  const [operations, setOperations] = React.useState<OperationsEvent[]>([]);
  const [tools, setTools] = React.useState<string[]>([]);
  const [githubSubmitting, setGithubSubmitting] = React.useState(false);
  const [crawlSubmitting, setCrawlSubmitting] = React.useState(false);
  const [querySubmitting, setQuerySubmitting] = React.useState(false);
  const [shareSubmitting, setShareSubmitting] = React.useState(false);
  const [shareMessage, setShareMessage] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<ErrorMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<string>('');
  const [activeSection, setActiveSection] = React.useState<DockSectionId>('overview');
  const [queryProgress, setQueryProgress] = React.useState<{ phase: string; percentage: number; detail: string } | null>(null);
  const [queryMode, setQueryMode] = React.useState<QueryMode>('standard');
  const [selectedStrategies, setSelectedStrategies] = React.useState<SmartStrategy[]>(['multi-query', 'refinement', 'concept-extraction']);
  const [answerType, setAnswerType] = React.useState<'conversational' | 'structured'>('conversational');

  const formatRetrievalMethod = React.useCallback((method?: string): string => {
    switch (method) {
      case 'hybrid+rerank':
        return 'Hybrid + Rerank';
      case 'hybrid':
        return 'Hybrid';
      case 'rerank':
        return 'Dense + Rerank';
      default:
        return 'Dense';
    }
  }, []);

  const getTrendDisplay = React.useCallback((trend: MetricPulse['trend']) => {
    switch (trend) {
      case 'up':
        return { symbol: '↑', color: '#16a34a', label: 'up' };
      case 'down':
        return { symbol: '↓', color: '#dc2626', label: 'down' };
      default:
        return { symbol: '→', color: '#94a3b8', label: 'steady' };
    }
  }, []);

  const handleCopyChunk = React.useCallback((content: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(content).catch((error) => {
        console.error('[Retrieval] Failed to copy chunk', error);
      });
    }
  }, []);

  const toggleStrategy = React.useCallback((strategy: SmartStrategy) => {
    setSelectedStrategies((prev) => {
      const hasStrategy = prev.includes(strategy);
      if (hasStrategy) {
        if (prev.length === 1) {
          return prev; // always keep at least one strategy selected
        }
        return prev.filter((item) => item !== strategy);
      }
      return [...prev, strategy];
    });
  }, []);

  const resetStrategies = React.useCallback(() => {
    setSelectedStrategies(['multi-query', 'refinement', 'concept-extraction']);
  }, []);

  const contentRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useMemo(
    () =>
      DOCK_SECTIONS.reduce<Record<DockSectionId, React.RefObject<HTMLDivElement>>>((acc, section) => {
        acc[section.id] = React.createRef<HTMLDivElement>();
        return acc;
      }, {} as Record<DockSectionId, React.RefObject<HTMLDivElement>>),
    []
  );

  const handleDockSelect = React.useCallback(
    (sectionId: DockSectionId) => {
      setActiveSection(sectionId);
      const node = sectionRefs[sectionId]?.current;
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [sectionRefs]
  );

  React.useEffect(() => {
    const container = contentRef.current;
    if (!container) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry) {
          const sectionId = (visibleEntry.target as HTMLElement).dataset.sectionId as DockSectionId | undefined;
          if (sectionId) {
            setActiveSection(sectionId);
          }
        }
      },
      {
        root: container,
        threshold: [0.35, 0.6]
      }
    );

    DOCK_SECTIONS.forEach(({ id }) => {
      const node = sectionRefs[id]?.current;
      if (node) {
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, [sectionRefs, contentRef]);

  // Debouncing refs for high-frequency updates
  const lastProgressUpdateRef = React.useRef<number>(0);
  const lastStatsUpdateRef = React.useRef<number>(0);
  const DEBOUNCE_INTERVAL_MS = 250; // Reduced from 500ms for more responsive real-time updates

  const client = React.useMemo<ContextClient>(() => {
    return new ContextApiClient({ baseUrl });
  }, [baseUrl]);

  // WebSocket connection for real-time updates
  const wsUrl = React.useMemo(() => {
    const url = new URL(baseUrl);
    const wsProtocol = url.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${url.host}/ws`;
  }, [baseUrl]);

  const { isConnected, connectionStatus, sendMessage } = useWebSocket({
    url: wsUrl,
    enabled: true,
    project,
    onMessage: (message) => {
      setLastUpdate(new Date(message.timestamp).toLocaleTimeString());

      switch (message.type) {
        case 'postgres:stats':
          // Debounce postgres stats updates
          const nowStats = Date.now();
          if (nowStats - lastStatsUpdateRef.current < DEBOUNCE_INTERVAL_MS) {
            break; // Skip this update, too soon since last one
          }
          lastStatsUpdateRef.current = nowStats;

          if (message.data?.projects) {
            // Handle "all" projects or specific project
            const isAllProjects = project.toLowerCase() === 'all';
            
            // Check if this message is for "all" projects
            if (isAllProjects && message.project === 'all' && message.data.projects) {
              const allData = message.data.projects.find((p: any) => p.name === 'all');
              if (allData) {
                setSnapshot(prev => {
                  const metricUpdates = [
                    { label: 'Datasets', value: Number(allData.datasets ?? 0), caption: 'all projects' },
                    { label: 'Chunks', value: Number(allData.chunks ?? 0), caption: 'all projects' },
                    { label: 'Web Pages', value: Number(allData.webPages ?? 0), caption: 'all projects' }
                  ];

                  const updatedMetrics = metricUpdates.reduce<MetricPulse[]>(
                    (acc, item) => upsertMetric(acc, item.label, item.value, item.caption),
                    [...prev.metrics]
                  );

                  return {
                    ...prev,
                    metrics: updatedMetrics
                  };
                });
              }
            } else if (!isAllProjects) {
              // Handle specific project
              const projectData = message.data.projects.find((p: any) => p.name === project);
              if (projectData) {
                setSnapshot(prev => {
                  const metricUpdates = [
                    { label: 'Datasets', value: Number(projectData.datasets ?? 0), caption: 'active' },
                    { label: 'Chunks', value: Number(projectData.chunks ?? 0), caption: 'indexed' },
                    { label: 'Web Pages', value: Number(projectData.webPages ?? 0), caption: 'crawled' }
                  ];

                  const updatedMetrics = metricUpdates.reduce<MetricPulse[]>(
                    (acc, item) => upsertMetric(acc, item.label, item.value, item.caption),
                    [...prev.metrics]
                  );

                  return {
                    ...prev,
                    metrics: updatedMetrics
                  };
                });
              }
            }
          }
          if (message.data?.recentCrawls) {
            const isAllProjects = project.toLowerCase() === 'all';
            const projectCrawls = isAllProjects
              ? message.data.recentCrawls // Show all crawls when "all" is selected
              : message.data.recentCrawls.filter((c: any) => c.project === project);
            if (projectCrawls.length > 0) {
              setIngestionJobs(prev => {
                const newJobs = projectCrawls.map((crawl: any) => ({
                  id: crawl.sessionId,
                  source: 'crawl' as const,
                  project: crawl.project,
                  dataset: crawl.dataset,
                  scope: 'project' as ScopeLevel,
                  status: crawl.status as any,
                  startedAt: new Date().toLocaleTimeString(),
                  duration: `${Math.round(crawl.durationMs / 1000)}s`,
                  summary: `${crawl.pagesCrawled} pages crawled`
                }));
                return [...newJobs, ...prev].slice(0, 20);
              });
            }
          }
          break;

        case 'crawl:progress':
          // Debounce crawl progress updates (high-frequency)
          const nowProgress = Date.now();
          if (nowProgress - lastProgressUpdateRef.current < DEBOUNCE_INTERVAL_MS) {
            break; // Skip this update, too soon since last one
          }
          lastProgressUpdateRef.current = nowProgress;

          if (message.data?.sessionId) {
            setSnapshot(prev => {
              const completion = Number(message.data.percentage ?? 0);
              const safeCompletion = Number.isFinite(completion) ? Math.max(0, Math.min(100, completion)) : 0;
              
              // Map currentPhase to pipeline indices
              const phaseMap: Record<string, number> = {
                'crawling': 0,
                'chunking': 1,
                'summarizing': 2,
                'embedding': message.data.phaseDetail?.includes('Content') ? 3 : 4,
                'storing': message.data.phaseDetail?.includes('Postgres') ? 5 : 6,
              };
              
              const currentPhase = message.data.currentPhase || 'crawling';
              const phaseIdx = phaseMap[currentPhase] ?? 0;
              
              const chunksProcessed = Number(message.data.chunksProcessed ?? message.data.current ?? 0);
              const chunksTotal = Number(message.data.chunksTotal ?? message.data.total ?? 0);

              return {
                ...prev,
                pipeline: prev.pipeline.map((phase, idx) => {
                  if (idx === phaseIdx) {
                    return {
                      ...phase,
                      completion: safeCompletion,
                      throughput: `${chunksProcessed}/${chunksTotal}`
                    };
                  }
                  return phase;
                })
              };
            });
          }
          break;

        case 'qdrant:stats':
          if (message.data && Array.isArray(message.data)) {
            const totalPoints = message.data.reduce((sum: number, stat: any) => sum + (stat.pointsCount || 0), 0);
            setSnapshot(prev => ({
              ...prev,
              metrics: upsertMetric(prev.metrics, 'Vectors', totalPoints, 'Qdrant points')
            }));
          }
          break;

        case 'query:progress':
          // Show query progress in operations or as a toast
          if (message.data) {
            setQueryProgress({
              phase: message.data.phase ?? 'Processing',
              percentage: message.data.percentage ?? 0,
              detail: message.data.detail ?? ''
            });
          }
          break;

        case 'github:progress':
          if (message.data?.jobId) {
            setIngestionJobs(prev => prev.map(job => {
              if (job.id !== message.data.jobId) {
                return job;
              }

              const statusMap: Record<string, IngestionJob['status']> = {
                pending: 'queued',
                queued: 'queued',
                running: 'running',
                in_progress: 'running',
                completed: 'completed',
                failed: 'failed'
              };

              const mappedStatus = statusMap[(message.data.status || '').toLowerCase()] ?? job.status;

              return {
                ...job,
                status: mappedStatus,
                progress: message.data.progress ?? job.progress,
                currentPhase: message.data.phase ?? job.currentPhase,
                currentFile: message.data.currentFile ?? job.currentFile,
                error: message.data.error ?? job.error
              };
            }));
          }
          break;

        case 'error':
          const errorData = message.data;
          setErrors(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            source: errorData.source || 'api',
            message: errorData.message || 'Unknown error',
            details: errorData.details,
            timestamp: new Date(message.timestamp).toLocaleTimeString(),
            project: errorData.project
          }]);
          break;
      }
    },
    onError: (error) => {
      console.error('[WebSocket] Error:', error);
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'WebSocket connection error',
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  });

  const dismissError = React.useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const refreshData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [snapshotData, scopeData, jobs, ops, toolList] = await Promise.all([
        client.fetchSnapshot(project),
        client.listScopeResources(project),
        client.fetchIngestionJobs(project),
        client.listOperations(project),
        client.listTools()
      ]);

      setSnapshot(snapshotData);
      setScopeResources(scopeData);
      setIngestionJobs(jobs);
      setOperations(ops);
      setTools(toolList);
    } catch (error: any) {
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'Failed to refresh data',
        details: error?.message ?? String(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [client, project]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [snapshotData, scopeData, jobs, ops, toolList] = await Promise.all([
          client.fetchSnapshot(project),
          client.listScopeResources(project),
          client.fetchIngestionJobs(project),
          client.listOperations(project),
          client.listTools()
        ]);
        if (cancelled) {
          return;
        }
        setSnapshot(snapshotData);
        setScopeResources(scopeData);
        setIngestionJobs(jobs);
        setOperations(ops);
        setTools(toolList);
      } catch (error: any) {
        if (!cancelled) {
          setErrors(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            source: 'api',
            message: 'Failed to load initial data',
            details: error?.message ?? String(error),
            timestamp: new Date().toLocaleTimeString()
          }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, project]);

  const lastSession = retrievalHistory[0] ?? null;
  const shareCandidates = scopeResources.project ?? [];

  const handleGithubSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGithubSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    const repo = (formData.get('repo') as string | null)?.trim();
    if (!repo) {
      setGithubSubmitting(false);
      return;
    }

    const payload: GithubIngestForm = {
      project,
      repo,
      dataset: (formData.get('dataset') as string | null)?.trim() || undefined,
      branch: (formData.get('branch') as string | null)?.trim() || undefined,
      sha: (formData.get('sha') as string | null)?.trim() || undefined,
      scope: (formData.get('scope') as ScopeLevel | null) ?? activeScope,
      includeGlobal: formData.get('includeGlobal') === 'on',
      force: formData.get('force') === 'on'
    };

    try {
      const job = await client.triggerGithubIngest(payload);
      setIngestionJobs((prev) => [job, ...prev].slice(0, 6));
      form.reset();
    } catch (error: any) {
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'Failed to trigger GitHub ingest',
        details: error?.message ?? String(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setGithubSubmitting(false);
    }
  };

  const handleCrawlSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCrawlSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const startUrl = (formData.get('startUrl') as string | null)?.trim();
    if (!startUrl) {
      setCrawlSubmitting(false);
      return;
    }

    const payload: CrawlIngestForm = {
      project,
      dataset: (formData.get('dataset') as string | null)?.trim() || 'web-pages',
      startUrl,
      crawlType: (formData.get('crawlType') as CrawlIngestForm['crawlType']) ?? 'recursive',
      maxPages: Number(formData.get('maxPages') ?? 25),
      depth: Number(formData.get('depth') ?? 2),
      scope: (formData.get('scope') as ScopeLevel | null) ?? activeScope,
      force: formData.get('force') === 'on'
    };

    try {
      const job = await client.triggerCrawlIngest(payload);
      setIngestionJobs((prev) => [job, ...prev].slice(0, 6));
      form.reset();
    } catch (error: any) {
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'Failed to trigger crawl',
        details: error?.message ?? String(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setCrawlSubmitting(false);
    }
  };

  const handleQuerySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuerySubmitting(true);
    setQueryProgress({
      phase: queryMode === 'smart' ? 'Submitting smart query' : 'Submitting query',
      percentage: 5,
      detail: queryMode === 'smart' ? 'Dispatching smart retrieval to API' : 'Dispatching request to API'
    });

    const form = event.currentTarget;
    const formData = new FormData(form);
    const query = (formData.get('query') as string | null)?.trim();
    if (!query) {
      setQuerySubmitting(false);
      return;
    }

    const payload: QueryRequest = {
      project,
      scope: activeScope,
      query,
      repo: (formData.get('repo') as string | null)?.trim() || undefined,
      pathPrefix: (formData.get('pathPrefix') as string | null)?.trim() || undefined,
      lang: (formData.get('lang') as string | null)?.trim() || undefined,
      includeGlobal: formData.get('includeGlobal') === 'on',
      k: Number(formData.get('topK') ?? 15)
    };

    try {
      const strategies: SmartStrategy[] = selectedStrategies.length > 0 ? selectedStrategies : (['multi-query'] as SmartStrategy[]);

      const session = queryMode === 'smart'
        ? await client.runSmartQuery({
            ...payload,
            strategies,
            answerType
          })
        : await client.runQuery(payload);

      setRetrievalHistory((prev) => [session, ...prev].slice(0, 5));
      form.reset();
      setQueryProgress(null);
    } catch (error: any) {
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'Failed to execute query',
        details: error?.message ?? String(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
      setQueryProgress(null);
    } finally {
      setQuerySubmitting(false);
    }
  };

  const handleShareSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShareSubmitting(true);
    setShareMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const resource = (formData.get('resource') as string | null) ?? '';
    const [resourceType, resourceId] = resource.split('|');
    const toProject = (formData.get('toProject') as string | null)?.trim();
    const expiresAt = (formData.get('expiresAt') as string | null)?.trim();

    if (!resourceType || !resourceId || !toProject) {
      setShareSubmitting(false);
      return;
    }

    const payload: ShareResourceRequest = {
      fromProject: project,
      toProject,
      resourceType: resourceType as ShareResourceRequest['resourceType'],
      resourceId,
      expiresAt: expiresAt || undefined
    };

    try {
      await client.shareResource(payload);
      setShareMessage(`Shared ${resourceId} → ${toProject}`);
      form.reset();
    } catch (error: any) {
      setErrors(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        source: 'api',
        message: 'Failed to share resource',
        details: error?.message ?? String(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setShareSubmitting(false);
    }
  };

  return (
    <div className="glass-ui">
      <ShadcnGlassStyles />
      <ErrorDisplay errors={errors} onDismiss={dismissError} />
      <div className="app-layout">
        <aside className="dock-nav">
          <div className="dock-surface">
            <div className="dock-brand">
              <span className="dock-brand-badge">
                <Sparkles size={18} />
              </span>
              <span className="dock-brand-text">Claude</span>
              <span className="dock-brand-sub">Context Core</span>
            </div>
            <div className="dock-items">
              {DOCK_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={cn('dock-item', isActive && 'dock-item-active')}
                    onClick={() => handleDockSelect(section.id)}
                    title={section.label}
                  >
                    <span className="dock-icon">
                      <Icon size={20} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="dock-footer">
              <span>Live telemetry</span>
              <span>{project}</span>
            </div>
          </div>
        </aside>

        <div className="app-shell" ref={contentRef}>
          <section ref={sectionRefs.overview} data-section-id="overview" className="section-stack">
            <div className="hero-banner">
              <div className="lozenge">
                <Sparkles size={14} /> Project-aware control plane
              </div>
              <h1 className="hero-title">Liquid glass operations console</h1>
              <p className="hero-subtitle">
                Coordinate chunking, summarization, hybrid retrieval, and scope sharing across projects.
                Powered by tree-sitter chunking, LLM summarization, and dual Postgres + Qdrant storage.
              </p>
              <div className="hero-actions">
                <Button variant="default" size="lg" onClick={refreshData} disabled={isLoading}>
                  <RefreshCw size={16} /> Sync Telemetry
                </Button>
                <Button variant="outline" size="lg" onClick={() => handleDockSelect('retrieval')}>
                  <Search size={16} /> Run Hybrid Query
                </Button>
                <Input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://context-api"
                />
                <Input
                  value={project}
                  onChange={(event) => setProject(event.target.value || 'default')}
                  placeholder="Project name"
                />
                <ConnectionStatus status={connectionStatus} onReconnect={refreshData} lastUpdate={lastUpdate} />
              </div>
            </div>

            <div className="metrics-panel">
              <div className="section-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <span className="section-kicker">Project pulse</span>
                    <div className="section-title">
                      <Layers3 size={18} /> Real-time telemetry
                    </div>
                  </div>
                  <Badge variant={connectionStatus === 'connected' ? 'default' : 'outline'}>
                    {connectionStatus === 'connected' && '🟢 Live'}
                    {connectionStatus === 'connecting' && '🟡 Connecting'}
                    {connectionStatus === 'disconnected' && '🔴 Offline'}
                    {connectionStatus === 'error' && '⚠️ Error'}
                  </Badge>
                </div>
              </div>
              <div className="metrics-grid">
                {snapshot.metrics.map((metric) => {
                  const trend = getTrendDisplay(metric.trend);
                  return (
                    <div className="metric-blip" key={metric.label}>
                      <span className="metric-label">{metric.label}</span>
                      <span className="metric-value">{metric.value}</span>
                      <span className="timeline-meta">{metric.caption}</span>
                      <span style={{ fontSize: '0.7rem', color: trend.color }}>
                        {trend.symbol} {trend.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="timeline-meta" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                Last update: {lastUpdate || 'Never'}
              </div>
            </div>
          </section>

          <section ref={sectionRefs.ingest} data-section-id="ingest" className="section-stack">
            <div className="section-header">
              <span className="section-kicker">Pipelines</span>
              <div className="section-title">
                <GitBranch size={18} /> Ingestion control
              </div>
              <p className="section-summary">
                Ingest from GitHub repositories or use Crawl4AI web crawler with scoped storage routing and real-time progress tracking.
              </p>
            </div>
            <div className="section-grid">
              <Card>
                <CardHeader>
                  <CardTitle>GitHub & Crawl4AI Launchpad</CardTitle>
                  <CardDescription>
                    Trigger repository snapshots or web crawls with Crawl4AI, then monitor queue status and latest job outputs.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="github">
                    <TabsList>
                      <TabsTrigger value="github">GitHub</TabsTrigger>
                      <TabsTrigger value="crawl">Crawl4AI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="github">
                      <form className="grid-gap" onSubmit={handleGithubSubmit}>
                        <div>
                          <Label htmlFor="repo">Repository</Label>
                          <Input id="repo" name="repo" placeholder="github.com/org/repo" required />
                        </div>
                        <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <div>
                            <Label htmlFor="dataset">Dataset</Label>
                            <Input id="dataset" name="dataset" placeholder="atlas-core" />
                          </div>
                          <div>
                            <Label htmlFor="branch">Branch</Label>
                            <Input id="branch" name="branch" placeholder="main" />
                          </div>
                          <div>
                            <Label htmlFor="sha">SHA</Label>
                            <Input id="sha" name="sha" placeholder="optional" />
                          </div>
                        </div>
                        <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <div>
                            <Label htmlFor="scope-github">Scope</Label>
                            <Select id="scope-github" name="scope" defaultValue={activeScope}>
                              <option value="project">Project</option>
                              <option value="global">Global</option>
                              <option value="local">Local</option>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="force-github">Force re-ingest</Label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Input id="force-github" name="force" type="checkbox" />
                              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Re-run even if data exists</span>
                            </div>
                          </div>
                        </div>
                        <Button type="submit" disabled={githubSubmitting || project.toLowerCase() === 'all'}>
                          <ArrowRight size={16} /> {githubSubmitting ? 'Scheduling…' : 'Launch GitHub ingest'}
                        </Button>
                        {project.toLowerCase() === 'all' && (
                          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                            Cannot ingest to "all" projects. Please select a specific project.
                          </p>
                        )}
                      </form>
                    </TabsContent>
                    <TabsContent value="crawl">
                      <form className="grid-gap" onSubmit={handleCrawlSubmit}>
                        <div>
                          <Label htmlFor="startUrl">Start URL</Label>
                          <Input id="startUrl" name="startUrl" placeholder="https://docs.example.com" required />
                        </div>
                        <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <div>
                            <Label htmlFor="crawl-dataset">Dataset</Label>
                            <Input id="crawl-dataset" name="dataset" placeholder="atlas-web" />
                          </div>
                          <div>
                            <Label htmlFor="crawl-type">Crawl type</Label>
                            <Select id="crawl-type" name="crawlType" defaultValue="recursive">
                              <option value="recursive">Recursive crawl</option>
                              <option value="batch">Batch crawl</option>
                              <option value="single">Single page</option>
                              <option value="sitemap">Sitemap crawl</option>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="maxPages">Max pages</Label>
                            <Input id="maxPages" name="maxPages" type="number" defaultValue={40} />
                          </div>
                          <div>
                            <Label htmlFor="depth">Depth</Label>
                            <Input id="depth" name="depth" type="number" defaultValue={2} />
                          </div>
                          <div>
                            <Label htmlFor="scope-crawl">Scope</Label>
                            <Select id="scope-crawl" name="scope" defaultValue={activeScope}>
                              <option value="project">Project</option>
                              <option value="global">Global</option>
                              <option value="local">Local</option>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="force-crawl">Force crawl</Label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Input id="force-crawl" name="force" type="checkbox" />
                              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Re-run even if recent crawl exists</span>
                            </div>
                          </div>
                        </div>
                        <Button type="submit" disabled={crawlSubmitting || project.toLowerCase() === 'all'}>
                          <Server size={16} /> {crawlSubmitting ? 'Scheduling…' : 'Launch Crawl session'}
                        </Button>
                        {project.toLowerCase() === 'all' && (
                          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                            Cannot ingest to "all" projects. Please select a specific project.
                          </p>
                        )}
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <Separator />
                <CardFooter>
                  <div style={{ width: '100%' }}>
                    <Label>Recent jobs</Label>
                    <ScrollArea style={{ maxHeight: '180px' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Scope</th>
                            <th>Dataset</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingestionJobs.map((job) => (
                            <tr key={job.id}>
                              <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{job.id.slice(0, 8)}...</td>
                              <td>{scopeLabel(job.scope)}</td>
                              <td>{job.dataset}</td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <Badge 
                                    variant={job.status === 'completed' ? 'default' : 'outline'}
                                    style={job.status === 'failed' ? {
                                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                      borderColor: 'rgba(239, 68, 68, 0.5)',
                                      color: '#ef4444'
                                    } : undefined}
                                  >
                                    {job.status}
                                  </Badge>
                                  {job.status === 'failed' && job.error && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: '#ef4444', 
                                      marginTop: '0.25rem',
                                      wordBreak: 'break-word',
                                      maxWidth: '400px',
                                      fontFamily: 'monospace',
                                      lineHeight: '1.4'
                                    }}>
                                      {job.error.length > 150 ? `${job.error.substring(0, 150)}...` : job.error}
                                    </span>
                                  )}
                                  {typeof job.progress === 'number' && job.status === 'running' && (
                                    <span className="timeline-meta" style={{ fontSize: '0.75rem' }}>
                                      {Math.round(job.progress)}% · {job.currentPhase ?? 'Processing'}
                                    </span>
                                  )}
                                  {job.currentFile && job.status === 'running' && (
                                    <span className="timeline-meta" style={{ fontSize: '0.7rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                                      {job.currentFile}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </section>

          <section ref={sectionRefs.retrieval} data-section-id="retrieval" className="section-stack">
            <div className="section-header">
              <span className="section-kicker">Search</span>
              <div className="section-title">
                <Search size={18} /> Hybrid retrieval
              </div>
              <p className="section-summary">
                Blend dense and sparse lookups, inspect rerank rationales, and promote favored scope combinations.
              </p>
            </div>
            <div className="section-grid">
              <Card>
                <CardHeader>
                  <CardTitle>Retrieval playground</CardTitle>
                  <CardDescription>
                    Issue hybrid queries, explore rerank scores, and stream the resulting chunks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid-gap" onSubmit={handleQuerySubmit}>
                    <div className="grid-gap">
                      <Label>Query mode</Label>
                      <div className="chip-row">
                        <Button
                          type="button"
                          variant={queryMode === 'standard' ? 'default' : 'outline'}
                          onClick={() => {
                            setQueryMode('standard');
                            setQueryProgress(null);
                          }}
                        >
                          Standard query
                        </Button>
                        <Button
                          type="button"
                          variant={queryMode === 'smart' ? 'default' : 'outline'}
                          onClick={() => {
                            setQueryMode('smart');
                            if (selectedStrategies.length === 0) {
                              resetStrategies();
                            }
                          }}
                        >
                          Smart LLM query
                        </Button>
                      </div>
                      {queryMode === 'smart' && (
                        <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                          <div>
                            <Label htmlFor="smart-answer-type">Answer type</Label>
                            <Select
                              id="smart-answer-type"
                              value={answerType}
                              onChange={(event) => setAnswerType((event.target.value as 'conversational' | 'structured') || 'conversational')}
                            >
                              <option value="conversational">Conversational answer + chunks</option>
                              <option value="structured">Structured summary</option>
                            </Select>
                          </div>
                          <div>
                            <Label>Strategies</Label>
                            <div className="smart-strategy-grid">
                              {SMART_STRATEGIES.map((strategy) => {
                                const checked = selectedStrategies.includes(strategy.id);
                                return (
                                  <label key={strategy.id} className="smart-strategy-option">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleStrategy(strategy.id)}
                                    />
                                    <div>
                                      <span className="strategy-label">{strategy.label}</span>
                                      <span className="strategy-hint">{strategy.description}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="query">Natural language query</Label>
                      <Textarea
                        id="query"
                        name="query"
                        placeholder="How do we chunk with overlap and rerank for incident runbooks?"
                        required
                      />
                    </div>
                    <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                      <div>
                        <Label htmlFor="query-repo">Repo</Label>
                        <Input id="query-repo" name="repo" placeholder="optional filter" />
                      </div>
                      <div>
                        <Label htmlFor="pathPrefix">Path prefix</Label>
                        <Input id="pathPrefix" name="pathPrefix" placeholder="src/ops" />
                      </div>
                      <div>
                        <Label htmlFor="lang">Language</Label>
                        <Input id="lang" name="lang" placeholder="ts" />
                      </div>
                      <div>
                        <Label htmlFor="includeGlobal">Include global</Label>
                        <Select id="includeGlobal" name="includeGlobal" defaultValue="on">
                          <option value="on">Yes</option>
                          <option value="off">No</option>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" disabled={querySubmitting}>
                      <ArrowRight size={16} /> {querySubmitting ? (queryMode === 'smart' ? 'Running smart query…' : 'Searching…') : queryMode === 'smart' ? 'Run smart query' : 'Run query'}
                    </Button>
                  </form>
                </CardContent>
                <Separator />
                <CardContent>
                  {queryProgress && (
                    <div className="card-description" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{queryProgress.phase}</span>
                        <span style={{ fontFamily: 'monospace' }}>{Math.round(Math.min(Math.max(queryProgress.percentage, 0), 100))}%</span>
                      </div>
                      <Progress value={Math.min(Math.max(queryProgress.percentage, 0), 100)} />
                      {queryProgress.detail && (
                        <span className="timeline-meta">{queryProgress.detail}</span>
                      )}
                    </div>
                  )}

                  {lastSession ? (
                    <div className={lastSession.smartAnswer ? 'smart-retrieval-layout' : 'grid-gap'}>
                      {(() => {
                        const smartMetadata = lastSession.smartMetadata;
                        const smartStrategies = smartMetadata?.strategies ?? smartMetadata?.strategiesUsed ?? [];

                        return (
                          <>
                            {lastSession.smartAnswer && (
                              <div className="smart-answer-panel">
                                <div className="chip-row">
                                  <Badge variant="accent">
                                    {lastSession.smartAnswer.type === 'structured' ? 'Structured summary' : 'Conversational answer'}
                                  </Badge>
                                  {typeof lastSession.smartAnswer.confidence === 'number' && (
                                    <Badge variant="outline">
                                      Confidence {(lastSession.smartAnswer.confidence * 100).toFixed(0)}%
                                    </Badge>
                                  )}
                                </div>
                                {smartMetadata && (
                                  <div className="chip-column">
                                    <div className="chip-row">
                                      <Badge variant="outline">Aggregated {smartMetadata.queryVariations?.length ?? 1} queries</Badge>
                                    </div>
                                    {smartStrategies.length > 0 && (
                                      <div className="chip-row">
                                        {smartStrategies.map((strategy) => (
                                          <Badge key={`smart-strategy-${strategy}`} variant="outline">#{strategy}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {smartMetadata.timingMs && (
                                      <div className="timeline-meta" style={{ fontSize: '0.75rem' }}>
                                        Enhancement {smartMetadata.timingMs.enhancement ?? 0} ms · Retrieval {smartMetadata.timingMs.retrieval ?? 0} ms · Synthesis {smartMetadata.timingMs.synthesis ?? 0} ms
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="smart-answer-content">
                                  <pre><code>{lastSession.smartAnswer.content}</code></pre>
                                </div>
                                {lastSession.smartAnswer.chunkReferences?.length ? (
                                  <div className="timeline-meta" style={{ fontSize: '0.75rem' }}>
                                    Referenced chunks: {lastSession.smartAnswer.chunkReferences.join(', ')}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            <div className={lastSession.smartAnswer ? 'smart-results-panel' : 'grid-gap'}>
                              <div className="grid-gap">
                                <div className="chip-row">
                                  <Badge variant="accent">{formatRetrievalMethod(lastSession.metadata?.retrievalMethod)}</Badge>
                                  <div className="chip">
                                    <Layers3 size={14} /> {lastSession.results.length} results
                                  </div>
                                  <div className="chip">
                                    <ShieldCheck size={14} /> {(lastSession.metadata?.timingMs?.total ?? lastSession.latencyMs).toString()} ms total
                                  </div>
                                  {lastSession.toolsUsed.map((tool) => (
                                    <div className="chip" key={tool}>
                                      <Sparkles size={14} /> {tool}
                                    </div>
                                  ))}
                                </div>

                                {lastSession.metadata && (
                                  <>
                                    <div className="chip-row">
                                      {lastSession.metadata.featuresUsed.hybridSearch && (
                                        <Badge variant="outline">
                                          Hybrid
                                          {lastSession.metadata.searchParams?.denseWeight !== undefined && lastSession.metadata.searchParams?.sparseWeight !== undefined && (
                                            <> (D:{Math.round((lastSession.metadata.searchParams.denseWeight ?? 0) * 100)}% · S:{Math.round((lastSession.metadata.searchParams.sparseWeight ?? 0) * 100)}%)</>
                                          )}
                                        </Badge>
                                      )}
                                      {lastSession.metadata.featuresUsed.reranking && (
                                        <Badge variant="outline">
                                          Reranked {lastSession.metadata.searchParams?.initialK ?? '?'}→{lastSession.metadata.searchParams?.finalK ?? '?'}
                                        </Badge>
                                      )}
                                      {lastSession.metadata.featuresUsed.symbolExtraction && (
                                        <Badge variant="outline">AST Symbols</Badge>
                                      )}
                                    </div>
                                    <div className="timeline-meta" style={{ fontSize: '0.8rem' }}>
                                      Timing · Embed {lastSession.metadata.timingMs?.embedding ?? 0} ms · Search {lastSession.metadata.timingMs?.search ?? 0} ms
                                      {lastSession.metadata.timingMs?.reranking !== undefined && ` · Rerank ${lastSession.metadata.timingMs?.reranking ?? 0} ms`}
                                    </div>
                                  </>
                                )}

                                {smartMetadata && (
                                  <div className="chip-row">
                                    <Badge variant="outline">Smart mode active</Badge>
                                    <Badge variant="outline">Aggregated from {smartMetadata.queryVariations?.length ?? lastSession.results.length} queries</Badge>
                                  </div>
                                )}
                              </div>

                              <ScrollArea style={{ maxHeight: '260px' }}>
                                <div className="timeline">
                                  {lastSession.results.map((result, index) => {
                                    const chunkKey = `${result.projectId ?? result.repo ?? 'chunk'}-${result.file ?? 'file'}-${result.lineStart ?? 0}-${result.lineEnd ?? 0}-${index}`;
                                    const scoreMax = Math.max(result.vectorScore ?? 0, result.sparseScore ?? 0, result.rerankScore ?? 0);
                                    return (
                                      <div className="timeline-item" key={chunkKey}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <strong>{result.file}</strong>
                                            {result.chunkTitle && (
                                              <div className="timeline-meta" style={{ fontStyle: 'italic' }}>
                                                {result.chunkTitle}
                                              </div>
                                            )}
                                            {result.symbolName && (
                                              <Badge variant="accent">⚡ {result.symbolName}</Badge>
                                            )}
                                            {result.smartStrategies?.length ? (
                                              <div className="chip-row">
                                                {result.smartStrategies.map((strategy, strategyIndex) => (
                                                  <Badge
                                                    key={`${chunkKey}-strategy-${strategy}-${strategyIndex}`}
                                                    variant="outline"
                                                  >
                                                    #{strategy}
                                                  </Badge>
                                                ))}
                                              </div>
                                            ) : null}
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCopyChunk(result.chunk)}
                                            title="Copy chunk to clipboard"
                                            style={{ padding: '0.25rem', height: 'auto' }}
                                          >
                                            <Copy size={14} />
                                          </Button>
                                        </div>

                                        <span className="timeline-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                          <span>lines {result.lineStart}-{result.lineEnd}</span>
                                          {result.lang && <span>lang {result.lang}</span>}
                                          {result.repo && <span>repo {result.repo}</span>}
                                          <span>dataset {result.dataset}</span>
                                          <span>{scopeLabel(result.scope)}</span>
                                        </span>

                                        <pre style={{
                                          background: 'var(--background-tertiary)',
                                          padding: '8px 12px',
                                          borderRadius: '4px',
                                          fontSize: '13px',
                                          lineHeight: '1.4',
                                          overflow: 'auto',
                                          margin: '8px 0'
                                        }}><code>{result.chunk}</code></pre>

                                        <p className="card-description">{result.why}</p>

                                        <div className="grid-gap" style={{ marginTop: '0.75rem' }}>
                                          <div className="chip-row">
                                            <Badge variant="outline">Vector {result.vectorScore.toFixed(3)}</Badge>
                                            {result.sparseScore > 0 && (
                                              <Badge variant="outline">Sparse {result.sparseScore.toFixed(3)}</Badge>
                                            )}
                                            {result.rerankScore > 0 && (
                                              <Badge variant="default">Rerank {result.rerankScore.toFixed(3)}</Badge>
                                            )}
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                                            <div>
                                              <span style={{ width: '70px', display: 'inline-block' }}>Vector</span>
                                              <span className="score-bar" style={{ width: `${scoreMax ? (result.vectorScore / scoreMax) * 100 : 0}%`, background: 'var(--accent)' }} />
                                            </div>
                                            {result.sparseScore > 0 && (
                                              <div>
                                                <span style={{ width: '70px', display: 'inline-block' }}>Sparse</span>
                                                <span className="score-bar" style={{ width: `${scoreMax ? (result.sparseScore / scoreMax) * 100 : 0}%`, background: 'var(--muted)' }} />
                                              </div>
                                            )}
                                            {result.rerankScore > 0 && (
                                              <div>
                                                <span style={{ width: '70px', display: 'inline-block' }}>Rerank</span>
                                                <span className="score-bar" style={{ width: `${scoreMax ? (result.rerankScore / scoreMax) * 100 : 0}%`, background: 'var(--primary)' }} />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <CardDescription>No sessions yet. Run a query to populate hybrid results.</CardDescription>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section ref={sectionRefs.scopes} data-section-id="scopes" className="section-stack">
            <div className="section-header">
              <span className="section-kicker">Scopes</span>
              <div className="section-title">
                <Share2 size={18} /> Shared resources
              </div>
              <p className="section-summary">
                Inspect active datasets, track highlights, and share knowledge islands across projects.
              </p>
            </div>
            <div className="section-grid">
              <Card>
                <CardHeader>
                  <CardTitle>Project + Global scopes</CardTitle>
                  <CardDescription>
                    Monitor datasets across scope levels, then share resources to downstream teams.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeScope} onValueChange={(value) => setActiveScope(value as ScopeLevel)}>
                    <TabsList>
                      <TabsTrigger value="global">Global</TabsTrigger>
                      <TabsTrigger value="project">Project</TabsTrigger>
                      <TabsTrigger value="local">Local</TabsTrigger>
                    </TabsList>
                    {(['global', 'project', 'local'] as ScopeLevel[]).map((scope) => (
                      <TabsContent value={scope} key={scope}>
                        <div className="timeline">
                          {(scopeResources[scope] ?? []).map((resource) => (
                            <div className="timeline-item" key={resource.id}>
                              <strong>{resource.name}</strong>
                              <span className="timeline-meta">
                                <span>{resource.type}</span>
                                <span>updated {resource.updatedAt}</span>
                                <span>id: {resource.id}</span>
                              </span>
                              <div className="chip-row">
                                {resource.highlights.map((highlight) => (
                                  <div className="chip" key={highlight}>
                                    {highlight}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
                <Separator />
                <CardContent>
                  <form className="grid-gap" onSubmit={handleShareSubmit}>
                    <div className="grid-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                      <div>
                        <Label htmlFor="resource">Resource</Label>
                        <Select
                          id="resource"
                          name="resource"
                          defaultValue={shareCandidates[0] ? `${shareCandidates[0].type}|${shareCandidates[0].id}` : ''}
                        >
                          {shareCandidates.map((resource) => (
                            <option key={resource.id} value={`${resource.type}|${resource.id}`}>
                              {resource.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="toProject">Share to project</Label>
                        <Input id="toProject" name="toProject" placeholder="ops" required />
                      </div>
                      <div>
                        <Label htmlFor="expiresAt">Expires (ISO)</Label>
                        <Input id="expiresAt" name="expiresAt" placeholder="2025-12-31" />
                      </div>
                    </div>
                    <Button type="submit" disabled={shareSubmitting}>
                      <Share2 size={16} /> {shareSubmitting ? 'Sharing…' : 'Share resource'}
                    </Button>
                    {shareMessage ? <CardDescription>{shareMessage}</CardDescription> : null}
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>

          <section ref={sectionRefs.telemetry} data-section-id="telemetry" className="section-stack">
            <div className="section-header">
              <span className="section-kicker">Telemetry</span>
              <div className="section-title">
                <Server size={18} /> Flow instrumentation
              </div>
              <p className="section-summary">
                Follow the end-to-end pipeline progress and surface available Model Context Protocol tools.
              </p>
            </div>
            <div className="section-grid">
              {/* WebSocket Connection Status */}
              <Card style={{ marginBottom: '1rem' }}>
                <CardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CardTitle>Real-time Connection</CardTitle>
                    <Badge 
                      variant="outline"
                      style={{
                        backgroundColor: isConnected ? '#22c55e20' : '#ef444420',
                        color: isConnected ? '#22c55e' : '#ef4444',
                        border: `1px solid ${isConnected ? '#22c55e40' : '#ef444440'}`
                      }}
                    >
                      {connectionStatus === 'connecting' ? 'Connecting...' : 
                       connectionStatus === 'connected' ? '● Connected' :
                       connectionStatus === 'error' ? '● Error' :
                       '○ Disconnected'}
                    </Badge>
                  </div>
                  <CardDescription>
                    WebSocket connection for live progress updates{lastUpdate ? ` • Last update: ${lastUpdate}` : ''}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pipeline telemetry</CardTitle>
                  <CardDescription>
                    End-to-end flow from chunking to storage sync with throughput and completion across phases.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="timeline">
                    {snapshot.pipeline.map((phase) => {
                      const phaseInfo = getPhaseColor(phase.completion);
                      return (
                        <div className="timeline-item" key={phase.name}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.25rem'
                            }}
                          >
                            <strong>{phase.name}</strong>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '0.25rem',
                                backgroundColor: phaseInfo.color + '20',
                                color: phaseInfo.color,
                                border: `1px solid ${phaseInfo.color}40`
                              }}
                            >
                              {phaseInfo.label} {phase.completion}%
                            </span>
                          </div>
                          <span className="timeline-meta">
                            <span>{phase.throughput}</span>
                            <span>{phase.latency}</span>
                            <span>next in {phase.nextDeliveryMs} ms</span>
                          </span>
                          <p className="card-description">{phase.description}</p>
                          <div style={{ position: 'relative' }}>
                            <Progress value={phase.completion} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${phase.completion}%`,
                                backgroundColor: phaseInfo.color,
                                opacity: 0.3,
                                pointerEvents: 'none',
                                borderRadius: '0.25rem'
                              }}
                            />
                          </div>
                          <div className="chip-row">
                            <div
                              className={`lozenge${
                                phase.status === 'warning'
                                  ? ' lozenge-warning'
                                  : phase.status === 'critical'
                                  ? ' lozenge-danger'
                                  : ''
                              }`}
                            >
                              {phase.status}
                            </div>
                            {(phase.badges ?? []).map((badge) => (
                              <div className="chip" key={badge}>
                                {badge}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>MCP tools</CardTitle>
                  <CardDescription>
                    Access the context engine through Model Context Protocol tools for ingest, search, and defaults.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="chip-row">
                    {tools.map((tool) => (
                      <div className="chip" key={tool}>
                        {tool}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section ref={sectionRefs.operations} data-section-id="operations" className="section-stack">
            <div className="section-header">
              <span className="section-kicker">Operations</span>
              <div className="section-title">
                <TriangleAlert size={18} /> Incidents &amp; events
              </div>
              <p className="section-summary">
                Track hybrid search SLOs, storage backpressure, and crawl reliability in one console.
              </p>
            </div>
            <div className="section-grid">
              <Card>
                <CardHeader>
                  <CardTitle>Operational stream</CardTitle>
                  <CardDescription>
                    Surface incidents, warnings, and successes across ingestion, retrieval, and storage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="timeline">
                    {operations.map((event) => (
                      <div className="timeline-item" key={`${event.timestamp}-${event.title}`}>
                        <strong>{event.title}</strong>
                        <span className="timeline-meta">
                          <span>{event.timestamp}</span>
                          <span>{scopeLabel(event.scope)}</span>
                        </span>
                        <p className="card-description">{event.detail}</p>
                        <div className="chip-row">
                          <div className={impactChipClass(event.impact)}>{event.impact}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
