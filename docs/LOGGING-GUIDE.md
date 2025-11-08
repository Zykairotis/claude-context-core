# MCP Server Logging Guide

## Overview

The MCP server now automatically logs all output to files with timestamps, making it easy to debug and monitor operations.

## Log Files

### Main Log File
**Location**: `/home/mewtwo/Zykairotis/claude-context-core/logs/mcp-server.log`
- Contains **all** log messages (INFO, WARN, ERROR)
- Timestamped entries
- Good for general monitoring

### Debug Log File
**Location**: `/home/mewtwo/Zykairotis/claude-context-core/logs/mcp-debug.log`
- Contains only **ERROR** and **DEBUG** messages
- Useful for troubleshooting
- Smaller file size

## Quick Commands

### Using the Helper Script

```bash
# Tail main logs (live updates)
./view-logs.sh

# Tail debug logs only
./view-logs.sh debug

# Show only errors (last 50)
./view-logs.sh errors

# Search for specific text
./view-logs.sh search "Island Architecture"
./view-logs.sh search "dataset_collections"
./view-logs.sh search "getOrCreateCollectionRecord"

# Show full log file
./view-logs.sh full

# Clean old logs (fresh start)
./view-logs.sh clean
```

### Direct tail Commands

```bash
# Main log
tail -f logs/mcp-server.log

# Debug log
tail -f logs/mcp-debug.log

# Last 100 lines
tail -100 logs/mcp-server.log

# Watch for errors
tail -f logs/mcp-server.log | grep ERROR

# Watch for specific keywords
tail -f logs/mcp-server.log | grep -E "(Auto-detected|Island Architecture|getOrCreateCollectionRecord)"
```

### Grep Commands

```bash
# Find all errors
grep "\[ERROR\]" logs/mcp-server.log

# Find indexing operations
grep "Index" logs/mcp-server.log

# Find dataset operations
grep "dataset" logs/mcp-server.log

# Find specific function calls
grep "getOrCreateCollectionRecord" logs/mcp-server.log

# Find with context (3 lines before/after)
grep -C 3 "CRITICAL" logs/mcp-server.log
```

## Log Format

Each log entry includes:
- **Timestamp**: ISO 8601 format `[2025-11-08T19:49:49.546Z]`
- **Level**: `[INFO]`, `[WARN]`, or `[ERROR]`
- **Message**: The actual log content

Example:
```
[2025-11-08T19:49:49.552Z] [INFO] [Context] ✅ Collection record created/updated: a1b2c3d4-...
```

## Monitoring Indexing Operations

### Watch for Auto-Detection
```bash
tail -f logs/mcp-server.log | grep "Auto-detected"
```

Expected output:
```
[2025-11-08T19:50:00.000Z] [INFO] [Index] Auto-detected project from path: AuMGFqLY-hypr-voice-ErNATJWC
[2025-11-08T19:50:00.001Z] [INFO] [Index] 🏝️ Island Architecture: project="AuMGFqLY-hypr-voice-ErNATJWC", dataset="local"
```

### Watch for Dataset Collections Creation
```bash
tail -f logs/mcp-server.log | grep -E "(getOrCreateCollectionRecord|updateCollectionMetadata)"
```

Expected output:
```
[2025-11-08T19:50:05.000Z] [INFO] [getOrCreateCollectionRecord] ✅ Created collection record for dataset 8504d6ea... → project_AuMGFqLY_hypr_voice_ErNATJWC_dataset_local
[2025-11-08T19:50:05.001Z] [INFO] [Context] ✅ Collection record created/updated: a1b2c3d4-...
[2025-11-08T19:52:30.000Z] [INFO] [updateCollectionMetadata] ✅ Updated collection project_AuMGFqLY_hypr_voice_ErNATJWC_dataset_local with 7860 points
```

### Watch for Errors
```bash
tail -f logs/mcp-debug.log
```

This shows only errors and debug messages.

## Troubleshooting

### No Log Files?

Check if MCP server is running:
```bash
ps aux | grep "node.*mcp-server.js" | grep -v grep
```

If not running:
```bash
node mcp-server.js
```

### Log Files Too Large?

Clean old logs:
```bash
./view-logs.sh clean
# or
rm -f logs/*.log
```

Logs will be recreated when the server starts.

### Find Specific Operation

If you indexed at a specific time and want to see what happened:
```bash
grep "2025-11-08T14:50" logs/mcp-server.log
```

## Common Search Patterns

### Indexing Issues
```bash
grep -i "index" logs/mcp-server.log | grep -i "error"
```

### Database Issues
```bash
grep -i "postgres\|dataset_collections\|Critical" logs/mcp-server.log
```

### Collection Creation
```bash
grep "Collection record\|Using collection" logs/mcp-server.log
```

### Auto-Scoping
```bash
grep "Auto-detected\|Island Architecture" logs/mcp-server.log
```

## Log Rotation

The log files will grow over time. To rotate logs manually:

```bash
# Archive current logs
mv logs/mcp-server.log logs/mcp-server.log.$(date +%Y%m%d)
mv logs/mcp-debug.log logs/mcp-debug.log.$(date +%Y%m%d)

# Restart MCP server (new logs will be created)
pkill -9 -f "node.*mcp-server.js"
node mcp-server.js &
```

## Integration with Other Tools

### Visual Studio Code

Install "Log File Highlighter" extension and open log files for syntax highlighting.

### less/bat

```bash
# View with less
less logs/mcp-server.log

# View with bat (if installed)
bat logs/mcp-server.log
```

### Watch with color

```bash
tail -f logs/mcp-server.log | grep --color=always -E "ERROR|WARN|✅|❌|⚠️|$"
```

## Summary

**Quick Start**:
```bash
./view-logs.sh        # Start watching logs
./view-logs.sh errors # Check for errors
./view-logs.sh search "your search term"
```

**Log Locations**:
- Main: `logs/mcp-server.log`
- Debug: `logs/mcp-debug.log`

**All logs are timestamped and automatically written - no manual intervention needed!**

---

**Last Updated**: 2025-11-08
**MCP Server**: File logging enabled
**Helper Script**: `view-logs.sh`
