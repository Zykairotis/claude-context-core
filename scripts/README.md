# Database Management Scripts

Utility scripts for maintaining the Claude Context Core data stores (PostgreSQL + Qdrant).

All scripts live in the repository `scripts/` directory and are executable (`chmod +x`).

---

## Prerequisites

- Docker (containers `claude-context-postgres`, `claude-context-qdrant`)
- `curl`
- `jq` (recommended for Qdrant JSON parsing)
- Access to the project root directory

Environment variables (optional overrides):

```
POSTGRES_CONTAINER=claude-context-postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5533
POSTGRES_USER=postgres
POSTGRES_DB=claude_context
POSTGRES_PASSWORD=code-context-secure-password
QDRANT_URL=http://localhost:6333
```

---

## `db-inspect.sh`

Inspect the current state of both databases.

```
./scripts/db-inspect.sh [--full] [--no-color]
```

### Output
- PostgreSQL schemas, tables (with size/row estimates), installed extensions
- `collections_metadata` entries (dimension, entity counts)
- **GitHub Jobs summary** (job counts by status)
- **Recent GitHub Jobs** (last 10 jobs with repository, branch, status, progress)
- Optional detailed column definitions per table (`--full`)
- Qdrant collections with point counts

Use this before/after cleanup to verify structure.

---

## `db-clean.sh`

Remove **all data** from PostgreSQL (schema `claude_context`) and **delete all Qdrant collections** while keeping the schema, extensions, and containers intact.

```
./scripts/db-clean.sh [--force] [--no-color]
```

### Behavior
- Displays current database state (`db-inspect.sh` summary)
- Prompts for confirmation unless `--force` is supplied
- Truncates every table in `claude_context` (identity reset, cascade)
  - Includes `github_jobs`, `crawl_sessions`, `projects`, `datasets`, `documents`, `web_pages`, `chunks`
- Resets `collections_metadata` entity counts
- Deletes every Qdrant collection via HTTP API
- Shows a cleanup summary and post-clean inspection hint

**Warning:** All stored vectors, metadata, ingestion records, and job history are removed.

---

## `db-reinit.sh`

Drop and recreate the PostgreSQL schema and wipe Qdrant. Supports optional container recreation.
**Automatically restarts API server** to recreate pg-boss job queue tables.

```
./scripts/db-reinit.sh [--with-containers] [--force]
```

### Modes
- Default (`--db-only`): operate on databases, leave containers untouched
- `--with-containers`: stop `postgres` & `qdrant` via docker compose, drop volumes, recreate containers, wait for health checks

### Steps Performed
1. Confirmation prompt unless `--force`
2. (Optional) docker compose stop/down/up with volume removal
3. Drop schema `claude_context` (CASCADE)
4. Recreate schema and extensions (`vector`, `uuid-ossp`, `pg_trgm`, `pgcrypto`)
5. Execute init scripts:
   - `services/init-scripts/01-init-pgvector.sql` (pgvector setup)
   - `services/init-scripts/02-init-schema.sql` (core tables)
   - `services/init-scripts/03-github-jobs.sql` (GitHub ingestion job queue)
6. Delete all Qdrant collections
7. **Automatically restart API server** (if running) to recreate pg-boss tables (`job`, `schedule`, `subscription`)
8. Wait up to 60 seconds for pg-boss tables to be created
9. Print summary + reminder to run `db-inspect.sh --full`

**Note:** The API server restart ensures pg-boss job queue tables are automatically recreated after schema reset, preventing "relation does not exist" errors.

Use this to fully reset the environment before populating new data.

---

## Examples

```bash
# Quick overview
./scripts/db-inspect.sh --full

# Clean both databases (prompted)
./scripts/db-clean.sh

# Non-interactive cleanup (CI/CD)
./scripts/db-clean.sh --force

# Recreate databases without restarting containers
./scripts/db-reinit.sh --force

# Nuclear option: drop volumes and recreate containers
./scripts/db-reinit.sh --with-containers --force
```

---

## Troubleshooting

- **"PostgreSQL container not running"** — Start the stack: `cd services && docker compose up -d postgres qdrant`
- **Missing `jq`** — Install (`sudo apt install jq`) or note that Qdrant output will be raw JSON
- **`docker compose` not found** — Install Docker Compose plugin or legacy `docker-compose`
- **Permission denied** — Ensure scripts are executable: `chmod +x scripts/*.sh`
- **Custom container names** — Export `POSTGRES_CONTAINER` / `QDRANT_URL` before running scripts

---

## Safety Notes

- All destructive scripts require typing a confirmation keyword unless `--force`
- Back up important data before running cleanup/reset
- After reinitialization, rerun ingestion pipelines to repopulate data

Happy maintaining! 🚀

