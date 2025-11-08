"""
Python site customization to register Qdrant adapter for Cognee.
This file is automatically imported by Python on startup.
"""

try:
    from cognee_community_vector_adapter_qdrant.register import QDrantAdapter, use_vector_adapter
    use_vector_adapter("qdrant", QDrantAdapter)
    print("✅ Qdrant community adapter registered", flush=True)
except ImportError:
    pass  # Silently skip if not available
except Exception as e:
    print(f"⚠️  Qdrant adapter registration error: {e}", flush=True)
