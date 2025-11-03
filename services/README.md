# Docker Compose & Database Schema Backup

This folder contains a backup of the Docker Compose configuration and all related SQL schemas and database files.

## Contents

### docker-compose.yml
The PostgreSQL Docker Compose configuration with pgvector extension and performance optimizations.

**Note:** This version has been updated with corrected relative paths to work from the backup folder location.

### init-scripts/
SQL initialization scripts that run when PostgreSQL container starts:
- `01-init-pgvector.sql` - pgvector extension initialization
- `02-init-schema.sql` - core project/dataset/crawl schema (Postgres)

### database/
Complete database configuration and schema files:
- `postgresql-simple.conf` - PostgreSQL configuration file
- `postgresql-simple.root.conf` - Root PostgreSQL configuration
- `init-scripts/` - Additional initialization scripts:
  - `02-init-neo4j.cypher` - Neo4j initialization

## Usage

To run the backed-up Docker Compose configuration:

```bash
cd backup
docker-compose up -d
```

## Backup Date
Created: October 31, 2025
