# Repository Guidelines

## Project Structure & Module Organization
The package publishes compiled artifacts under `dist/`, mirroring the TypeScript layout used during development (`context`, `embedding`, `vectordb`, `sync`, `summarizer`, `utils`). Author changes in `src/` following the same folder structure, then regenerate `dist/`; never hand-edit the compiled JavaScript. Keep feature-specific tests alongside implementation inside `__tests__` folders. Use `mcp-server.js` to exercise the core through a local Model Context Protocol server. Long-form architecture notes and experiments live in `plan/`, while database and Docker assets live under `services/`; update those directories when you change the surrounding workflows.

## Build, Test, and Development Commands
`npm run build` runs a clean TypeScript build (`rimraf dist && tsc --build --force`). `npm run dev` starts the watch build for rapid iteration, and `npm run clean` removes compiled output. Validate types with `npm run typecheck`. Lint the codebase with `npm run lint` (ensure `eslint` is installed in the workspace) or auto-fix safe issues via `npm run lint:fix`. Use `npm run mcp:dev` to launch the local MCP server for end-to-end indexing and search checks.

## Coding Style & Naming Conventions
Write modern TypeScript targeting Node 18+. Keep modules focused and group them by capability. Use kebab-case file names (`auto-embedding-monster.ts`), `camelCase` for variables and functions, and `PascalCase` for classes. Favor two-space indentation, trailing semicolons, and explicit return types on exported symbols. Surface new entry points through the nearest `index.ts` so the curated exports in `dist/index.js` stay accurate. Add concise JSDoc for non-trivial logic so the generated `.d.ts` files remain helpful to consumers.

## Testing Guidelines
Unit tests rely on Jest with `ts-jest`. Place specs in `__tests__` directories co-located with the code under test, naming files `*.spec.ts`. Stub external services (OpenAI, Milvus/Postgres, filesystem) to keep runs deterministic. Execute `npx jest --runInBand` locally until the dedicated test script returns. Aim to cover new branches or failure paths you introduce, and document any gaps in the PR if full coverage is impractical.

## Commit & Pull Request Guidelines
Follow conventional commits (`feat:`, `fix:`, `chore:`) as used in the release history (`1.1.16`). Rebase before filing a PR, describe the change, note migrations or service prerequisites, and link issues or discussion threads. Include CLI transcripts or sample queries for behavioral updates, plus screenshots when touching dashboards or tooling outputs. Call out impacts on `plan/` or `services/` so reviewers can verify operational drift before merging.
