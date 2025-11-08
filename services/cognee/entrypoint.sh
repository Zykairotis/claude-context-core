#!/bin/bash
set -e

echo "🚀 Starting Cognee with Qdrant adapter..."

# Register Qdrant adapter by importing it using python3 (system Python where adapter is installed)
# The import itself registers the adapter - no function call needed
python3 -c "
from cognee_community_vector_adapter_qdrant import register
print('✅ Qdrant adapter registered successfully!')
"

# Run the original Cognee entrypoint using the venv python
# The cognee/cognee:main image uses uvicorn to start the API
exec python -m uvicorn cognee.api.client:app --host 0.0.0.0 --port 8000
