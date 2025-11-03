# Smart Query Fix & LLM Renaming - Implementation Summary

## Overview

This document summarizes the changes made to fix the "Unable to generate an answer from the retrieved context" error in smart query and rename all hardcoded model references from "MiniMax" to "LLM".

## Changes Made

### 1. Enhanced Error Handling in LLM Client

**File Created**: `src/utils/llm-client.ts` (renamed from `minimax-client.ts`)

**Key Improvements**:

- **Better error messages for authentication failures**: Now explicitly checks for 401 errors and API key issues
- **Empty response detection**: Throws specific error when LLM returns empty `answer_markdown`
- **Detailed logging**: Includes model name, query, chunk count, and raw responses in error logs
- **JSON parsing improvements**: Enhanced error handling when LLM returns malformed JSON
- **Timeout handling**: Clear error messages for timeout scenarios

**Error Types Now Handled**:

```typescript
// Authentication failures
"LLM API authentication failed. Please verify your LLM_API_KEY is correct."

// Empty responses
"LLM returned an empty answer. This may indicate the model couldn't generate a response from the provided context."

// Timeout errors
"LLM synthesis timed out. The model may be overloaded or the request is too complex."

// JSON parsing failures
"Failed to parse LLM response as JSON. The LLM may have returned an invalid format."
```

### 2. Renamed Client Class

**Changes**:
- `MinimaxClient` → `LLMClient`
- `MinimaxClientOptions` → `LLMClientOptions`
- File renamed: `minimax-client.ts` → `llm-client.ts`

**Legacy Support**: All legacy environment variables are still supported:
- `MINIMAX_API_KEY` → `LLM_API_KEY` (both work)
- `MINIMAX_API_BASE` → `LLM_API_BASE` (both work)
- `MINIMAX_MODEL` → `MODEL_NAME` (both work)
- `MINIMAX_MAX_TOKENS` → `LLM_MAX_TOKENS` (both work)
- `MINIMAX_TEMPERATURE` → `LLM_TEMPERATURE` (both work)

### 3. Model Name References Replaced

All hardcoded "MiniMax" references replaced with "LLM":

#### Files Updated:

**`src/api/smart-query.ts`**:
- Import changed from `MinimaxClient` to `LLMClient`
- Progress messages updated:
  - "Enhancing query with MiniMax M2" → "Enhancing query with LLM"
  - "Synthesizing smart answer with MiniMax M2" → "Synthesizing smart answer with LLM"
- Variable names: `minimaxClient` → `llmClient`

**`src/ui/app.tsx`**:
- Line 833: "MiniMax summarization" → "LLM summarization"
- Line 1131: "Smart MiniMax query" → "Smart LLM query"

**`src/ui/api/client.ts`**:
- Mock response text: "how MiniMax would synthesize" → "how LLM would synthesize"
- Tool name: `'MiniMax.M2'` → `'LLM'`

**`src/ui/data/mock-dashboard.ts`**:
- Badge: `'MiniMax-8k'` → `'LLM-8k'`
- Test data: All references to "minimax" replaced with "llm"

**`src/utils/index.ts`**:
- Export updated: `export * from './minimax-client'` → `export * from './llm-client'`

### 4. API Server Environment Configuration

**File Updated**: `services/api-server/src/config.ts`

**Change**: Explicitly loads `.env` from project root:
```typescript
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });
```

This ensures the API server always uses `/home/mewtwo/Zykairotis/claude-context-core/.env` regardless of the working directory.

## Testing the Smart Query Fix

### Prerequisites

Ensure your `.env` file contains valid LLM credentials:

```env
# Required for smart query
LLM_API_KEY=your-api-key-here
LLM_API_BASE=https://api.minimax.io/v1  # or your LLM provider URL
MODEL_NAME=your-model-name  # defaults to 'LLM' if not set

# Optional
LLM_MAX_TOKENS=16384  # Default: 16k tokens for comprehensive answers
LLM_TEMPERATURE=0.2
```

### Test Scenarios

#### 1. Test with Valid Credentials

Start the API server:
```bash
cd services/api-server
npm run dev
```

In another terminal, start the UI:
```bash
npm run ui:dev
```

**Expected Behavior**:
- Smart query should complete successfully
- Progress messages show "Enhancing query with LLM" and "Synthesizing smart answer with LLM"
- Answer is displayed in the frontend
- No "Unable to generate an answer" error

#### 2. Test with Missing API Key

Remove or comment out `LLM_API_KEY` in `.env`:

**Expected Behavior**:
- Server logs: `LLM_API_KEY (or legacy MINIMAX_API_KEY) is required to use LLMClient`
- Frontend displays error with clear message about missing API key

#### 3. Test with Invalid API Key

Set `LLM_API_KEY` to an invalid value:

**Expected Behavior**:
- Error message: "LLM API authentication failed. Please verify your LLM_API_KEY is correct"
- Frontend displays the authentication error instead of generic fallback

#### 4. Test Empty Context

Perform a query that returns no results:

**Expected Behavior**:
- Console warning: `[LLMClient] No context chunks provided for answer synthesis`
- Answer: "No supporting context was available to generate an answer."
- Confidence: 0

## Debugging

### Check Error Logs

The enhanced error handling now logs detailed information:

```typescript
console.error('[LLMClient] Failed to synthesize answer:', {
  error: errorMessage,
  model: this.model,
  query,
  chunksProvided: chunks.length,
  type
});
```

Look for these logs in:
- API server console output
- Browser DevTools console (for frontend client)

### Verify Environment Variables

In the API server, add temporary logging:
```typescript
console.log('LLM Config:', {
  apiKey: process.env.LLM_API_KEY ? '***' : 'missing',
  baseUrl: process.env.LLM_API_BASE,
  model: process.env.MODEL_NAME
});
```

## Build Verification

Both builds completed successfully:

```bash
# Main project
npm run build  ✓ Success

# API server
cd services/api-server && npm run build  ✓ Success
```

No TypeScript errors or linting issues detected.

## Migration Notes

### For Existing Installations

No breaking changes! Legacy environment variables still work:
- You can continue using `MINIMAX_API_KEY` if already set
- The UI text has been updated but functionality is identical
- All existing queries and data remain compatible

### Recommended Updates

1. **Update your `.env` file** (optional but recommended):
   ```bash
   # Old (still works)
   MINIMAX_API_KEY=sk-...
   MINIMAX_API_BASE=https://api.minimax.io/v1
   
   # New (recommended)
   LLM_API_KEY=sk-...
   LLM_API_BASE=https://api.minimax.io/v1
   MODEL_NAME=MiniMax-M2
   ```

2. **Update documentation** that references "MiniMax" to say "LLM"

3. **Review error logs** - they now provide much more actionable information

## Summary

✅ **Fixed**: "Unable to generate an answer from the retrieved context" error now shows specific cause
✅ **Improved**: Error messages are detailed and actionable
✅ **Renamed**: All "MiniMax" references replaced with "LLM"
✅ **Verified**: Builds compile successfully with no errors
✅ **Configured**: API server explicitly uses project root `.env` file
✅ **Backward Compatible**: Legacy environment variables still supported

The smart query feature should now provide clear error messages that help diagnose issues, rather than showing the generic fallback message.

