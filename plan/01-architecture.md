# Architecture

## High-level Dataflow

```mermaid
flowchart LR
  subgraph GH[GitHub]
    GH0[Webhook: push@sha]
  end

  subgraph C4AI[Crawl4AI]
    C0[seed URL(s)]
  end

  GH0 --> I[Ingest Orchestrator]
  C0 --> I

  I --> CK[Chunkers]
  CK --> SUM[Summarizer (micro + macro)]
  CK --> EMB[Embedder: dense + sparse + summary]
  SUM --> Q[Qdrant: named vectors + sparse]
  EMB --> Q
  CK --> O[(Object Store):::store]  %% macros, blobs
  SUM --> O

  I --> PG[(Postgres Orchestrator DB)]
  Q --> R[Retriever API]
  PG --> R

  R --> H[Hybrid Search (dense+sparse)]
  H --> RE[Cross-Encoder Rerank]
  RE --> CP[Context Pack + Evidence]
  CP --> OUT[(Answer + Snippets + Why)]

  classDef store fill:#f5f5f5,stroke:#999,color:#333
```

## Project Isolation & Sharing

Each **Project** is its own "knowledge island," with optional bridges for shared/global content.

```mermaid
graph TD
  P1[Project A] -->|owns| D1[Datasets A*]
  P2[Project B] -->|owns| D2[Datasets B*]
  G[Global]:::g -->|is_global| Dg[Global Datasets]
  P1 -. shares via project_shares .-> D2
  P2 -. shares via project_shares .-> D1
  P1 -->|query filter| Q[(Qdrant points with payload.project_id in {A} ∪ shared ∪ global)]
  classDef g fill:#eef8ff,stroke:#3b82f6,color:#1e3a8a
```

## Component Map

```mermaid
graph LR
  subgraph Ingestion
    W[Webhook Receiver]
    GIX[Git Indexer]
    CIX[Crawl4AI Worker]
    CH[Chunkers (AST/Docs)]
    SM[Summarizer]
    EM[Embedder]
  end

  subgraph Storage
    PG[(Postgres: projects, datasets, web_pages, chunks, vector_metadata, rerank_results)]
    QD[(Qdrant: code_context, web_context)]
    OS[(Object Store: macros, blobs)]
  end

  subgraph API
    QRY[/Query API/]
    ADM[/Admin API/]
  end

  W-->GIX-->CH-->SM-->EM-->QD
  CIX-->CH
  CH-->PG
  SM-->OS
  QRY-->PG
  QRY-->QD
  QRY-->OS
  ADM-->PG
```

## Why This Works

- **Dual-vector chunks + Qdrant metadata:** Already track `summary_vector_id`, store vector IDs and payload snapshots in **`vector_metadata`**, and log rerank scores in **`rerank_results`**
- **Crawl4AI integration:** `web_pages`, `crawl_sessions`, views for monitoring, and helper functions in place
- **Project isolation:** **`projects`**, `project_id` on datasets, **`is_global` flags**, **`project_shares`**, and **views** (`project_statistics`, updated `dataset_statistics`)
