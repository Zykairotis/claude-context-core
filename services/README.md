# Docker Compose & Database Schema Backup

This folder contains a backup of the Docker Compose configuration and all related SQL schemas and database files.

## Contents

### docker-compose.yml
The PostgreSQL Docker Compose configuration with pgvector extension and performance optimizations.

**Note:** This version has been updated with corrected relative paths to work from the backup folder location.

### init-scripts/
SQL initialization scripts that run when PostgreSQL container starts:
- `01-init-pgvector.sql` - pgvector extension initialization

### database/
Complete database configuration and schema files:
- `postgresql-simple.conf` - PostgreSQL configuration file
- `postgresql-simple.root.conf` - Root PostgreSQL configuration
- `init-scripts/` - Additional initialization scripts:
  - `02-init-neo4j.cypher` - Neo4j initialization
  - `cognee/` - Cognee-specific schemas:
    - `01-init-cognee-schema.sql` - Base Cognee schema
    - `02-add-web-crawling.sql` - Web crawling tables
    - `03-update-for-crawl4ai.sql` - Crawl4AI integration
    - `04-add-projects-architecture.sql` - Projects architecture
    - `04-orchestration-logs.sql` - Orchestration logging
    - `05-add-cognee-job-tracking.sql` - Job tracking
    - `05-add-session-status-management.sql` - Session management
    - `06-add-chunk-type.sql` - Chunk type support
    - `06-configure-qdrant-768d.sql` - Qdrant configuration

## Usage

To run the backed-up Docker Compose configuration:

```bash
cd backup
docker-compose up -d
```

## Backup Date
Created: October 31, 2025

