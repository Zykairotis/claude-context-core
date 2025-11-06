# Recursive Crawl Bug Fix

## Problem
Recursive crawling was not working - it only crawled the single seed URL instead of following discovered links, even when `mode: "recursive"` was set in the request.

## Root Causes

### 1. Hybrid Mode Bypass (FIXED)
**File**: `services/crawl4ai-runner/app/services/crawling_service.py:158-160`

**Issue**: When `PROCESSING_MODE=hybrid` and a request had `project/dataset` set, the code always took the hybrid path, completely bypassing the recursive strategy logic.

**Fix**: Added condition `ctx.mode != CrawlMode.RECURSIVE` to prevent hybrid mode from being used with recursive requests:

```python
if PROCESSING_MODE == "hybrid" and (ctx.project or ctx.dataset) and ctx.mode != CrawlMode.RECURSIVE:
    # Hybrid mode
    await self._hybrid_crawl_and_process(progress_id, ctx, crawl_urls)
else:
    # Sequential mode (includes recursive)
    documents = await self._execute_crawl(progress_id, ctx, crawl_urls)
```

### 2. Single URL Forced Mode (FIXED) ⚠️ **PRIMARY BUG**
**File**: `services/crawl4ai-runner/app/services/crawling_service.py:445`

**Issue**: The condition `if mode == CrawlMode.SINGLE or len(urls) == 1:` forced SINGLE mode when there was only 1 seed URL, preventing recursive crawling from starting.

**Original code**:
```python
if mode == CrawlMode.SINGLE or len(urls) == 1:  # ❌ This breaks recursive with 1 seed
    page = await crawl_single_page(...)
    return processed  # Early return - never reaches recursive logic
```

**Fixed code**:
```python
# Handle SINGLE mode explicitly (don't force it based on URL count)
if mode == CrawlMode.SINGLE:  # ✅ Only use SINGLE when explicitly requested
    page = await crawl_single_page(...)
    return processed
```

### 3. Progress Callback Not Awaited (FIXED)
**File**: `services/crawl4ai-runner/app/strategies/recursive.py:62`

**Issue**: Progress callback was called without `await`, causing RuntimeWarning.

**Fix**: Added `await` to the callback:
```python
await progress_callback(total_processed, max_pages if max_pages > 0 else total_processed, page.url)
```

### 4. Config Change (APPLIED)
**File**: `.env.crawl4ai:43`

**Change**: Set `PROCESSING_MODE=sequential` to ensure recursive mode uses the sequential path until hybrid mode supports recursion properly.

## Test Results

**Before Fix**:
- 1 page crawled (only seed URL)
- 15-18 chunks generated
- No links followed

**After Fix**:
- 6 pages crawled (1 seed + 5 discovered)
- 67 chunks generated
- Properly follows links up to `max_depth=2`

**Example crawl result**:
```
Seed: https://mui.com/material-ui/
├─ https://mui.com/store/?utm_source=...
├─ https://mui.com/store/items/minimal-dashboard/?utm_source=...
├─ https://mui.com/store/?utm_source=... (different campaign)
├─ https://mui.com/store
└─ https://mui.com/legal/privacy
```

## Usage

Now works correctly with recursive mode:

```bash
curl -X POST http://localhost:7070/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "project": "mui",
    "dataset": "material-ui",
    "mode": "recursive",
    "urls": ["https://mui.com/material-ui/"],
    "max_depth": 2,
    "max_pages": 100,
    "same_domain_only": true,
    "include_links": true
  }'
```

## Files Modified
1. `/services/crawl4ai-runner/app/services/crawling_service.py` - Fixed hybrid mode check and single URL forced mode
2. `/services/crawl4ai-runner/app/strategies/recursive.py` - Fixed progress callback
3. `/.env.crawl4ai` - Changed PROCESSING_MODE to sequential

## Status
✅ **RESOLVED** - Recursive crawling now works correctly with single or multiple seed URLs
