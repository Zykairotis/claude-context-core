#!/bin/bash

echo "================================================"
echo "FIXING DATASET ISOLATION"
echo "================================================"
echo ""
echo "This script will:"
echo "1. Delete old mixed collections from Qdrant"
echo "2. Clear dataset_collections mappings"
echo "3. Guide you to re-index each dataset separately"
echo ""

read -p "⚠️  This will delete all Qdrant data. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Deleting old Qdrant collections..."
echo "-------------------------------------------"

# Delete the mixed collections
curl -X DELETE "http://localhost:6333/collections/project_hypr_voice" 2>/dev/null
echo "✅ Deleted project_hypr_voice"

curl -X DELETE "http://localhost:6333/collections/hybrid_code_chunks_bc391168" 2>/dev/null
echo "✅ Deleted hybrid_code_chunks_bc391168"

curl -X DELETE "http://localhost:6333/collections/hybrid_code_chunks_ea870718" 2>/dev/null
echo "✅ Deleted hybrid_code_chunks_ea870718"

echo ""
echo "Step 2: Clearing dataset_collections table..."
echo "-------------------------------------------"

psql postgresql://postgres:code-context-secure-password@localhost:5533/claude_context -c \
  "TRUNCATE claude_context.dataset_collections;" 2>/dev/null

echo "✅ Cleared dataset_collections table"

echo ""
echo "Step 3: Clearing chunks table (optional but recommended)..."
echo "-------------------------------------------"

psql postgresql://postgres:code-context-secure-password@localhost:5533/claude_context -c \
  "DELETE FROM claude_context.chunks WHERE dataset_id IN (
    SELECT id FROM claude_context.datasets 
    WHERE project_id = (SELECT id FROM claude_context.projects WHERE name = 'Hypr-Voice')
  );" 2>/dev/null

echo "✅ Cleared chunks for Hypr-Voice project"

echo ""
echo "================================================"
echo "✅ CLEANUP COMPLETE"
echo "================================================"
echo ""
echo "Now re-index each dataset separately:"
echo ""
echo "1. For local Hypr-Voice code (main dataset):"
echo "   claudeContext.index({"
echo "     project: 'Hypr-Voice',"
echo "     dataset: 'main',"
echo "     path: '/path/to/hypr-voice'"
echo "   })"
echo ""
echo "2. For Pydantic AI docs:"
echo "   claudeContext.crawl({"
echo "     project: 'Hypr-Voice',"
echo "     dataset: 'pydantic-ai-docs-v2',"
echo "     url: 'https://ai.pydantic.dev/sitemap.xml'"
echo "   })"
echo ""
echo "3. For Perplexity-Claude GitHub repo:"
echo "   claudeContext.indexGitHub({"
echo "     project: 'Hypr-Voice',"
echo "     dataset: 'perplexity-claude',"
echo "     repo: 'Zykairotis/Perplexity-claude'"
echo "   })"
echo ""
echo "4. For Claude-Context-Core GitHub repo:"
echo "   claudeContext.indexGitHub({"
echo "     project: 'Hypr-Voice',"
echo "     dataset: 'claude-context-core',"
echo "     repo: 'Zykairotis/claude-context-core'"
echo "   })"
echo ""
echo "After re-indexing, each dataset will have:"
echo "  • Its own Qdrant collection"
echo "  • Proper mapping in dataset_collections table"
echo "  • Metadata with datasetId and projectId"
echo "  • Complete isolation from other datasets"
echo ""
echo "Then searches will work correctly:"
echo "  claudeContext.search({"
echo "    project: 'Hypr-Voice',"
echo "    dataset: 'pydantic-ai-docs-v2',"
echo "    query: 'your search'"
echo "  })"
echo ""
echo "✅ Will return ONLY results from pydantic-ai-docs-v2!"
echo "================================================"
