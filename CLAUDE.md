# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlintStudio is an open-source, self-hosted AI film automation platform. Users paste a novel or script, select a visual style, and a multi-agent DAG pipeline automatically produces episode MP4 files. The UI is bilingual (Chinese/English).

## Commands

```bash
npm run dev          # Start dev server (Next.js + BullMQ worker concurrently)
npm run dev:next     # Next.js only (Turbopack, bound to 0.0.0.0)
npm run dev:worker   # BullMQ worker only
npm run build        # prisma generate + next build
npm run lint         # eslint .
npm run clean        # Delete .next/
```

There is no test suite configured.

Local dev prerequisites: Node >=18.18, npm >=9, MySQL 8, Redis. After `npm install`, run `npx prisma db push` to apply the schema.

## Architecture

### Tech Stack
- **Next.js 15** (App Router, `output: "standalone"`)
- **Prisma 6** + MySQL 8
- **BullMQ 5** + Redis for job queues
- **NextAuth.js 4** (JWT, Credentials provider; unauthenticated users silently get a `__default` user — no forced login)
- **next-intl 4** for i18n (zh default, en)
- **Tailwind CSS v4** (PostCSS plugin)
- **@xyflow/react** for the DAG node graph UI

### Routing
All pages live under `src/app/[locale]/`. The `next-intl` middleware (`src/middleware.ts`) handles locale prefix with `localePrefix: "as-needed"`.

Key routes:
- `/[locale]/workspace` — project listing
- `/[locale]/workspace/[projectId]` — project detail with DAG pipeline view
- `/[locale]/workspace/[projectId]/episode` — episode detail
- `/[locale]/settings` — API config, custom prompts

### Workflow Engine
The pipeline is a DAG with phases defined in `src/lib/workflow/types.ts`:
```
analyze_novel → story_to_script → script_to_storyboard → image_panels → voice → video
```
(`review_failed` is a pause state when quality check fails.)

**Four BullMQ queues** (`src/lib/task/queues.ts`): `flintstudio-text`, `flintstudio-image`, `flintstudio-voice`, `flintstudio-video`. All run from one worker entry point: `src/lib/workers/index.ts`.

Workers call `POST /api/workflows/advance` (protected by `INTERNAL_TASK_TOKEN` bearer auth) on task completion. This updates DB state and triggers the next phase.

Worker features: circuit breaker (threshold=5, 1min cooldown), exponential-backoff retry (3 attempts), per-type timeouts (text=15m, image=10m, voice=15m, video=60m).

### API Routes (`src/app/api/`)
- `POST /api/projects/create` — create project
- `POST /api/workflows/run` — start a workflow run
- `POST /api/workflows/advance` — internal worker callback (requires `INTERNAL_TASK_TOKEN`)
- `GET/PUT /api/settings/api-config` — per-user API key config
- `GET /api/media/...` — serve episode video/audio files

### Key Source Locations
| Path | Purpose |
|------|---------|
| `src/lib/env.ts` | Env var definitions and validation |
| `src/lib/auth.ts` | NextAuth config + default-user fallback |
| `src/lib/workflow/service.ts` | Run creation, phase advance logic |
| `src/lib/workflow/types.ts` | Workflow phases, run/step status enums |
| `src/lib/workflow/handlers/` | One handler file per agent/phase |
| `src/lib/generators/` | Thin clients for external image/TTS APIs |
| `src/lib/llm/` | LLM client + model registry |
| `src/lib/api-config.ts` | Per-user API config reading |
| `src/lib/workflow/visual-style.ts` | Visual style enum with LLM/image prompt suffixes |
| `prisma/schema.prisma` | Complete data model |
| `src/messages/zh/common.json` | Chinese translations |
| `src/messages/en/common.json` | English translations |

### Data Model Key Concepts
- `UserPreference` stores per-user API keys (LLM/image/TTS/video base URLs + keys), custom providers, and custom prompts
- `Project` → `NovelPromotionEpisode` → `NovelPromotionClip` → `NovelPromotionPanel`
- `GraphRun` + `GraphStep` track observable workflow state; `Task` tracks individual queue jobs
- All IDs are UUIDs; all tables use `@@map()` with snake_case names

### Important Conventions
- Path alias: `@/*` → `src/*`
- TypeScript strict mode enabled
- API keys are per-user and stored in `UserPreference`; local endpoints (localhost) skip key requirement
- Internal worker→API calls use `INTERNAL_TASK_TOKEN` bearer auth
- Desktop (Electron) build lives in `desktop/` and is excluded from root tsconfig

### Required Environment Variables
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (`mysql://...`) |
| `NEXTAUTH_SECRET` | JWT secret |
| `INTERNAL_TASK_TOKEN` | Bearer token for worker→API advance calls |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `DATA_DIR` | Filesystem path for voice/video output |
