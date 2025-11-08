#!/usr/bin/env python3
"""
Qdrant adapter registration for Cognee.
This script registers the community-maintained Qdrant adapter.

NOTE: The adapter is registered by importing the 'register' module.
The import itself handles registration - no function call needed!
"""

import sys

# Add parent directory to path to ensure cognee imports work
sys.path.insert(0, '/app')

try:
    # Import the register module - this automatically registers the adapter
    from cognee_community_vector_adapter_qdrant import register  # noqa: F401
    print("✅ Qdrant adapter registered successfully!")
    sys.exit(0)
except ImportError as e:
    print(f"❌ Failed to import Qdrant adapter: {e}", file=sys.stderr)
    print("   Make sure cognee-community-vector-adapter-qdrant is installed", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}", file=sys.stderr)
    sys.exit(1)
