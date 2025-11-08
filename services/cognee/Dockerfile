# Custom Cognee build with Qdrant community adapter
FROM cognee/cognee:main

# Install curl for debugging/health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Qdrant adapter to system Python (where we have pip)
RUN pip3 install --break-system-packages cognee-community-vector-adapter-qdrant

# Patch Cognee's vector database __init__.py to register Qdrant on import
RUN echo '\n\
# Auto-register Qdrant community adapter\n\
try:\n\
    import sys\n\
    sys.path.insert(0, "/usr/local/lib/python3.12/site-packages")\n\
    from cognee_community_vector_adapter_qdrant.register import QDrantAdapter, use_vector_adapter\n\
    use_vector_adapter("qdrant", QDrantAdapter)\n\
except: pass\n\
' >> /app/cognee/infrastructure/databases/vector/__init__.py

# Set working directory
WORKDIR /app
