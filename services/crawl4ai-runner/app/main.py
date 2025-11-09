from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI, HTTPException

# Configure logging to show INFO level messages
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from .crawler import crawler_manager
from .schemas import (
    CrawlMode,
    CrawlProgress,
    CrawlRequest,
    CrawlResponse,
    CrawlStartResponse,
    CrawledPagePayload,
)
from .services.crawling_service import CrawlRequestContext, crawling_service


app = FastAPI(
    title="Crawl4AI Runner",
    description="Browser-aware crawler service with discovery and code extraction",
    version="0.2.0",
)


@app.on_event("startup")
async def startup() -> None:
    await crawler_manager.initialize()


@app.on_event("shutdown")
async def shutdown() -> None:
    await crawler_manager.cleanup()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/crawl", response_model=CrawlStartResponse)
async def crawl(request: CrawlRequest) -> CrawlStartResponse:
    if not request.urls:
        raise HTTPException(status_code=400, detail="At least one URL is required")

    context = CrawlRequestContext(
        urls=[str(url) for url in request.urls],
        auto_discovery=request.auto_discovery,
        max_depth=request.max_depth or 1,
        max_pages=request.max_pages if request.max_pages is not None else 20,
        same_domain_only=request.same_domain_only,
        same_path_prefix=request.same_path_prefix,
        include_links=request.include_links,
        extract_code_examples=request.extract_code_examples,
        knowledge_type=request.knowledge_type,
        tags=request.tags,
        provider=request.provider,
        mode=request.mode,
        project=request.project,
        dataset=request.dataset,
        scope=request.scope.value if request.scope else None,
        max_concurrent=request.max_concurrent,
    )

    progress_id = await crawling_service.orchestrate_crawl(context)
    return CrawlStartResponse(progress_id=progress_id, status="running")


@app.get("/progress/{progress_id}", response_model=CrawlProgress)
async def get_progress(progress_id: str) -> CrawlProgress:
    state = crawling_service.get_progress(progress_id)
    if not state:
        raise HTTPException(status_code=404, detail="Unknown progress id")
    return CrawlProgress(
        progress_id=progress_id,
        status=state.status,
        progress=state.progress,
        log=state.log,
        current_url=state.current_url,
        total_pages=state.total_pages,
        processed_pages=state.processed_pages,
        chunks_stored=state.chunks_stored,
        code_examples_found=state.code_examples_found,
        # Real-time progress fields
        current_phase=state.current_phase,
        phase_detail=state.phase_detail,
        chunks_total=state.chunks_total,
        chunks_processed=state.chunks_processed,
        summaries_generated=state.summaries_generated,
        embeddings_generated=state.embeddings_generated,
    )


@app.get("/result/{progress_id}", response_model=CrawlResponse)
async def get_result(progress_id: str) -> CrawlResponse:
    state = crawling_service.get_progress(progress_id)
    if not state:
        raise HTTPException(status_code=404, detail="Unknown progress id")
    if state.status != "completed":
        raise HTTPException(status_code=409, detail="Crawl not completed")

    pages = [
        CrawledPagePayload(
            url=page.url,
            source_url=page.source_url,
            title=page.title,
            markdown_content=page.markdown_content,
            html_content=page.html_content,
            word_count=page.word_count,
            char_count=page.char_count,
            discovered_links=page.discovered_links,
        )
        for page in state.documents
    ]

    return CrawlResponse(
        project=state.project,
        dataset=state.dataset,
        mode=state.requested_mode or CrawlMode.SINGLE,
        total_pages=len(pages),
        pages=pages,
    )


@app.post("/cancel/{progress_id}")
async def cancel(progress_id: str) -> dict[str, str]:
    cancelled = await crawling_service.cancel(progress_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Unknown progress id")
    return {"status": "cancelled"}


# Retrieval endpoints
from pydantic import BaseModel as PydanticBaseModel
from typing import List, Optional


class SearchChunksRequest(PydanticBaseModel):
    query: str
    project: Optional[str] = None
    dataset: Optional[str] = None
    scope: Optional[str] = None
    filter_code: Optional[bool] = None
    filter_text: Optional[bool] = None
    limit: int = 10


class ChunkResult(PydanticBaseModel):
    id: str
    chunk_text: str
    summary: str
    is_code: bool
    language: str
    relative_path: str
    chunk_index: int
    similarity_score: float
    model_used: str
    project_id: str
    dataset_id: str
    scope: str


class SearchChunksResponse(PydanticBaseModel):
    query: str
    results: List[ChunkResult]
    total: int


@app.post("/search", response_model=SearchChunksResponse)
async def search_chunks(request: SearchChunksRequest) -> SearchChunksResponse:
    """Search for chunks with scope filtering and similarity ranking."""
    from .storage import (
        EmbeddingMonsterClient,
        PostgresVectorStore,
        ScopeManager,
    )
    
    try:
        # Initialize clients
        embedding_client = EmbeddingMonsterClient()
        postgres_store = PostgresVectorStore()
        scope_manager = ScopeManager()
        
        # Resolve scope
        scope_level = scope_manager.resolve_scope(
            request.project, request.dataset, request.scope
        )
        collection_name = scope_manager.get_collection_name(
            request.project, request.dataset, scope_level
        )
        
        # Generate query embedding (assume text, use GTE)
        query_embeddings = await embedding_client.embed_batch([request.query], model="gte")
        query_embedding = query_embeddings[0]
        
        # Initialize Postgres
        await postgres_store.initialize()
        
        # Build SQL query
        table_name = f"{postgres_store.schema}.chunks_{collection_name}"
        filters = []
        params = [query_embedding, request.limit]
        param_idx = 3
        
        if request.filter_code is not None:
            filters.append(f"is_code = ${param_idx}")
            params.append(request.filter_code)
            param_idx += 1
        
        if request.filter_text is not None:
            filters.append(f"is_code = ${param_idx}")
            params.append(not request.filter_text)
            param_idx += 1
        
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        
        query_sql = f"""
            SELECT 
                id, chunk_text, summary, is_code, language, relative_path,
                chunk_index, model_used, project_id, dataset_id, scope,
                1 - (vector <=> $1::vector) AS similarity_score
            FROM {table_name}
            {where_clause}
            ORDER BY vector <=> $1::vector
            LIMIT $2
        """
        
        # Execute query
        async with postgres_store.pool.acquire() as conn:
            rows = await conn.fetch(query_sql, *params)
        
        # Format results
        results = [
            ChunkResult(
                id=row["id"],
                chunk_text=row["chunk_text"],
                summary=row["summary"],
                is_code=row["is_code"],
                language=row["language"],
                relative_path=row["relative_path"],
                chunk_index=row["chunk_index"],
                similarity_score=float(row["similarity_score"]),
                model_used=row["model_used"],
                project_id=row["project_id"],
                dataset_id=row["dataset_id"],
                scope=row["scope"],
            )
            for row in rows
        ]
        
        await postgres_store.close()
        
        return SearchChunksResponse(
            query=request.query,
            results=results,
            total=len(results),
        )
    
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/chunk/{chunk_id}", response_model=ChunkResult)
async def get_chunk(chunk_id: str, include_context: bool = False) -> ChunkResult:
    """Retrieve a specific chunk by ID."""
    from .storage import PostgresVectorStore
    
    try:
        postgres_store = PostgresVectorStore()
        await postgres_store.initialize()
        
        # Search across all chunk tables (simplified - assumes single collection for now)
        # In production, would need to know which collection to search
        async with postgres_store.pool.acquire() as conn:
            # Get list of tables
            tables_result = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name LIKE 'chunks_%'
            """, postgres_store.schema)
            
            for table_row in tables_result:
                table_name = f"{postgres_store.schema}.{table_row['table_name']}"
                
                row = await conn.fetchrow(f"""
                    SELECT 
                        id, chunk_text, summary, is_code, language, relative_path,
                        chunk_index, model_used, project_id, dataset_id, scope,
                        0.0 as similarity_score
                    FROM {table_name}
                    WHERE id = $1
                """, chunk_id)
                
                if row:
                    await postgres_store.close()
                    return ChunkResult(
                        id=row["id"],
                        chunk_text=row["chunk_text"],
                        summary=row["summary"],
                        is_code=row["is_code"],
                        language=row["language"],
                        relative_path=row["relative_path"],
                        chunk_index=row["chunk_index"],
                        similarity_score=0.0,
                        model_used=row["model_used"],
                        project_id=row["project_id"],
                        dataset_id=row["dataset_id"],
                        scope=row["scope"],
                    )
        
        await postgres_store.close()
        raise HTTPException(status_code=404, detail="Chunk not found")
    
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class ScopeInfo(PydanticBaseModel):
    scope: str
    collection_name: str
    chunk_count: int
    code_chunks: int
    text_chunks: int


@app.get("/scopes", response_model=List[ScopeInfo])
async def list_scopes(project: Optional[str] = None) -> List[ScopeInfo]:
    """List available scopes and their statistics."""
    from .storage import PostgresVectorStore
    
    try:
        postgres_store = PostgresVectorStore()
        await postgres_store.initialize()
        
        scopes = []
        
        async with postgres_store.pool.acquire() as conn:
            # Get list of chunk tables
            tables_result = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name LIKE 'chunks_%'
            """, postgres_store.schema)
            
            for table_row in tables_result:
                table_name = table_row['table_name']
                full_table_name = f"{postgres_store.schema}.{table_name}"
                collection_name = table_name.replace('chunks_', '')
                
                # Get stats
                stats = await conn.fetchrow(f"""
                    SELECT 
                        COUNT(*) as total_chunks,
                        SUM(CASE WHEN is_code THEN 1 ELSE 0 END) as code_chunks,
                        SUM(CASE WHEN NOT is_code THEN 1 ELSE 0 END) as text_chunks,
                        scope
                    FROM {full_table_name}
                    GROUP BY scope
                """)
                
                if stats:
                    scopes.append(ScopeInfo(
                        scope=stats["scope"],
                        collection_name=collection_name,
                        chunk_count=stats["total_chunks"],
                        code_chunks=stats["code_chunks"] or 0,
                        text_chunks=stats["text_chunks"] or 0,
                    ))
        
        await postgres_store.close()
        return scopes
    
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
