## Goal

- Restore hybrid search on the frontend by ensuring SPLADE sparse vectors are generated during ingest and surfaced via the API, so UI queries return enriched results.

## Steps

1. Confirm SPLADE service health from api-server container and add curl in api image if missing.
2. Allow `SpladeClient` to retry and detect network errors; surface better logs for hybrid ingest.
3. Validate hybrid insert path in `QdrantVectorDb` for sparse vectors and update API payload if missing fields.
4. Exercise frontend query flow against sample project to verify hybrid results and adjust UI to display sparse hit metadata.
- (Optional) Document troubleshooting steps in `docs/RETRIEVAL_UPGRADES.md`.
