"""
SPLADE Microservice for Sparse Vector Generation
Provides REST API for computing sparse representations using SPLADE models
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import logging

from .splade_client import SpladeClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SPLADE Sparse Vector Service",
    description="Generate sparse vectors for hybrid search using SPLADE models",
    version="1.0.0"
)

# Initialize SPLADE client (will be done on startup)
splade_client: Optional[SpladeClient] = None


class SparseRequest(BaseModel):
    """Request model for single text sparse computation"""
    text: str


class SparseBatchRequest(BaseModel):
    """Request model for batch sparse computation"""
    batch: List[str]


class SparseResponse(BaseModel):
    """Response model for sparse vector"""
    sparse: dict  # {indices: List[int], values: List[float]}


class SparseBatchResponse(BaseModel):
    """Response model for batch sparse vectors"""
    sparse_vectors: List[dict]  # List of {indices: List[int], values: List[float]}


@app.on_event("startup")
async def startup_event():
    """Initialize SPLADE model on startup"""
    global splade_client
    try:
        logger.info("Initializing SPLADE model...")
        splade_client = SpladeClient()
        logger.info("SPLADE model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load SPLADE model: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global splade_client
    if splade_client:
        splade_client.close()
    logger.info("SPLADE service shut down")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if splade_client is None:
        raise HTTPException(status_code=503, detail="SPLADE model not loaded")
    
    return JSONResponse(
        content={
            "status": "healthy",
            "model": splade_client.model_name,
            "device": str(splade_client.device)
        }
    )


@app.post("/sparse", response_model=SparseResponse)
async def compute_sparse(request: SparseRequest):
    """
    Compute sparse vector for a single text
    
    Args:
        request: SparseRequest with text field
    
    Returns:
        SparseResponse with indices and values
    """
    if splade_client is None:
        raise HTTPException(status_code=503, detail="SPLADE model not loaded")
    
    try:
        sparse_vector = splade_client.encode(request.text)
        return SparseResponse(sparse=sparse_vector)
    except Exception as e:
        logger.error(f"Sparse encoding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding failed: {str(e)}")


@app.post("/sparse/batch", response_model=SparseBatchResponse)
async def compute_sparse_batch(request: SparseBatchRequest):
    """
    Compute sparse vectors for multiple texts in batch
    
    Args:
        request: SparseBatchRequest with batch field (list of texts)
    
    Returns:
        SparseBatchResponse with list of sparse vectors
    """
    if splade_client is None:
        raise HTTPException(status_code=503, detail="SPLADE model not loaded")
    
    if not request.batch:
        return SparseBatchResponse(sparse_vectors=[])
    
    try:
        sparse_vectors = splade_client.encode_batch(request.batch)
        return SparseBatchResponse(sparse_vectors=sparse_vectors)
    except Exception as e:
        logger.error(f"Batch sparse encoding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch encoding failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "SPLADE Sparse Vector Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "single": "POST /sparse",
            "batch": "POST /sparse/batch"
        }
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

