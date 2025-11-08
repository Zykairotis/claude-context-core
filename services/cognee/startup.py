#!/usr/bin/env python3
"""
Cognee startup wrapper with Qdrant adapter registration.
"""

import sys
import os

# Add system site-packages to Python path BEFORE any other imports
sys.path.insert(0, '/usr/local/lib/python3.12/site-packages')

print("🚀 Registering Qdrant adapter...", flush=True)

# Register the Qdrant adapter
try:
    from cognee_community_vector_adapter_qdrant import register
    register()
    print("✅ Qdrant adapter registered successfully!", flush=True)
except ImportError as e:
    print(f"⚠️  Could not import Qdrant adapter: {e}", flush=True)
except Exception as e:
    print(f"⚠️  Error registering Qdrant adapter: {e}", flush=True)

# Now exec the original Cognee command
# This replaces the current process with the original startup
os.execvp("python", ["python", "-m", "cognee"])
