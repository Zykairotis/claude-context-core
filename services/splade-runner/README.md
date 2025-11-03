# SPLADE Sparse Vector Service

Microservice for generating sparse vectors using SPLADE models for hybrid search.

## Features

- Single text sparse encoding
- Batch sparse encoding
- SPLADE model (naver/splade-cocondenser-ensembledistil)
- REST API with FastAPI
- GPU support when available

## API Endpoints

### Health Check
```bash
GET /health
```

### Single Text Encoding
```bash
POST /sparse
Content-Type: application/json

{
  "text": "your text here"
}

Response:
{
  "sparse": {
    "indices": [100, 523, 1042, ...],
    "values": [0.5, 0.8, 0.3, ...]
  }
}
```

### Batch Encoding
```bash
POST /sparse/batch
Content-Type: application/json

{
  "batch": ["text 1", "text 2", "text 3"]
}

Response:
{
  "sparse_vectors": [
    {"indices": [...], "values": [...]},
    {"indices": [...], "values": [...]},
    {"indices": [...], "values": [...]}
  ]
}
```

## Environment Variables

- `MODEL_NAME`: HuggingFace model name (default: `naver/splade-cocondenser-ensembledistil`)
- `PORT`: Service port (default: 8000)
- `SPLADE_INTERNAL_BATCH_SIZE`: Internal batch size for processing large batches (default: 8)
  - Controls how many texts are processed at once in GPU memory
  - Reduce if you get CUDA OOM errors (try 4 or 6)
  - Increase if you have more GPU memory (try 12 or 16)

## GPU Memory Management

The SPLADE service implements automatic memory management to prevent CUDA out-of-memory (OOM) errors:

### How It Works

1. **Internal Batching**: Large batches are automatically split into smaller chunks of size `SPLADE_INTERNAL_BATCH_SIZE`
2. **Memory Clearing**: GPU cache is cleared after each sub-batch using `torch.cuda.empty_cache()`
3. **Sequential Processing**: Sub-batches are processed sequentially to avoid memory overload

### Tuning for Your GPU

If you're experiencing CUDA OOM errors, adjust the following:

#### 1. Reduce Internal Batch Size (SPLADE Service)
```bash
# In docker-compose.yml or .env
SPLADE_INTERNAL_BATCH_SIZE=4  # Reduce from default 8
```

#### 2. Reduce Chunk Batch Size (API Server)
```bash
# In docker-compose.yml or .env  
CHUNK_BATCH_SIZE=8  # Reduce from default 16
```

#### 3. Reduce Concurrent Batches (API Server)
```bash
# In docker-compose.yml or .env
MAX_CONCURRENT_BATCHES=1  # Default is already 1
```

### Memory Usage Examples

Based on GPU memory:

**2-4GB GPU (e.g., GTX 1650, RTX 3050)**:
```bash
SPLADE_INTERNAL_BATCH_SIZE=4
CHUNK_BATCH_SIZE=8
MAX_CONCURRENT_BATCHES=1
```

**4-8GB GPU (e.g., GTX 1660 Ti, RTX 3060)**:
```bash
SPLADE_INTERNAL_BATCH_SIZE=8
CHUNK_BATCH_SIZE=16
MAX_CONCURRENT_BATCHES=1
```

**8GB+ GPU (e.g., RTX 3070, RTX 4070)**:
```bash
SPLADE_INTERNAL_BATCH_SIZE=12
CHUNK_BATCH_SIZE=24
MAX_CONCURRENT_BATCHES=2
```

**12GB+ GPU (e.g., RTX 3090, RTX 4090)**:
```bash
SPLADE_INTERNAL_BATCH_SIZE=16
CHUNK_BATCH_SIZE=32
MAX_CONCURRENT_BATCHES=3
```

### Monitoring GPU Memory

Check GPU memory usage:
```bash
# Real-time monitoring
watch nvidia-smi

# Or single check
nvidia-smi
```

## Running Locally

```bash
cd services/splade-runner
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Docker

The Dockerfile is optimized for slow internet connections:
- Extended timeouts (1000s) and retry logic (5 attempts)
- GPU/CUDA support enabled (PyTorch with CUDA ~2GB download)

```bash
docker build -t splade-runner .
docker run -p 30004:8000 --gpus all splade-runner
```

**Note:** 
- For slow connections, the build may take 15-30 minutes due to large PyTorch CUDA downloads (~2GB)
- The timeout and retry settings help handle connection interruptions
- To use GPU, ensure Docker has GPU support configured (nvidia-docker2 or Docker with GPU runtime)
- For CPU-only, the service will automatically fallback to CPU inference

## Integration

The service is integrated into the main docker-compose.yml:

```yaml
splade-runner:
  build: ./splade-runner
  ports:
    - "30004:8000"
  environment:
    - MODEL_NAME=naver/splade-cocondenser-ensembledistil
```

## Usage

```bash
# Single text
curl -X POST http://localhost:30004/sparse \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning model for search"}'

# Batch
curl -X POST http://localhost:30004/sparse/batch \
  -H "Content-Type: application/json" \
  -d '{"batch": ["text 1", "text 2"]}'
```

