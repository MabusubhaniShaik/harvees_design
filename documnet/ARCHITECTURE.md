# Architecture Document

## Table of Contents
- [Architecture Design](#architecture-design)
- [Deployment Architecture](#deployment-architecture)
- [Database Design Decisions](#database-design-decisions)
- [AI Integration Approach](#ai-integration-approach)
- [Security Considerations](#security-considerations)
- [Challenges Faced and Solutions Implemented](#challenges-faced-and-solutions-implemented)

---

## Architecture Design

### High-Level Overview

The system follows a **two-module monorepo** architecture with a RESTful Express backend and a React SPA frontend:

```
Client (React + Vite)  -->  [Vite Proxy /api/*]  -->  Express API Server (Port 4001)
                                                           |
                                               +-----------+-----------+
                                               |                       |
                                        SCA Module              ASA Module
                                   (Student Course           (AI SQL Assistant
                                    Allocation)              - Sales Analytics)
                                               |                       |
                                        MongoDB (sca-db)    SQLite (in-memory)
                                                           MongoDB (asa-db, optional)
```

### Backend Architecture

The Express server follows a layered architecture:

```
src/index.ts  (bootstrap: env, middleware, routes, error handler)
    |
    +-- routes/        (route definitions, HTTP verb + path mapping)
    |       |
    |       +-- controllers/   (request handling, validation, response)
    |               |
    |               +-- services / db / ai  (business logic, data access)
    |
    +-- schemas/       (MongoDB collection schema definitions, auto-registered on startup)
    +-- middlewares/   (request logger, error handler)
    +-- helpers/       (response formatter, validators)
    +-- utils/         (logger with redaction)
```

**Startup sequence:**
1. Load environment variables via `dotenv`
2. Initialize Express with global middleware (CORS, JSON parser, request logger)
3. Mount route handlers (`/api/sca`, `/api/asa`)
4. Register error handler (last in chain)
5. Connect to MongoDB (both `sca-db` and `asa-db`)
6. Register Mongoose schemas for all collections
7. Initialize in-memory SQLite engine (`sql.js`)
8. Restore persisted datasets from MongoDB into SQLite
9. Start HTTP server

**Graceful degradation:** If MongoDB is unavailable, the server still starts — the ASA module works entirely in-memory, and AI history falls back to in-memory storage.

### Frontend Architecture

React 19 SPA with TanStack Router (file-based routing):

```
src/main.tsx  -->  RouterProvider
    |
    +-- routes/__root.tsx       (ThemeProvider, TooltipProvider)
    +-- routes/__maniLayout/    (AppShell with sidebar navigation)
    |       +-- module.tsx      (Module selection: SCA or ASA)
    |       +-- sca.tsx         (SCA layout + floating AI assistant)
    |       |   +-- home.tsx, student-management.tsx, course-management.tsx,
    |       |       allocation-processing.tsx, ai-assistant.tsx
    |       +-- asa.tsx         (ASA layout)
    |           +-- home.tsx, dataset-upload.tsx, dynamic-table-creation.tsx,
    |               schema-detection.tsx, sql-assistant.tsx
    |
    +-- lib/
        +-- api-client.ts       (generic REST client with pagination)
        +-- asa-api.ts          (ASA-specific API functions)
        +-- services/           (SCA CRUD services: students, courses, allocations, sca-ai)
```

### Persistent Allocation Results Flow

```text
Allocation Processing page
    |
    +-- POST /api/sca/allocations/run
    |       |
    |       +-- Read active students + courses from MongoDB
    |       +-- Sort by marks DESC, application date ASC, student ID ASC
    |       +-- Apply preference, cutoff, open-merit, and reserved-seat rules
    |       +-- Compare with latest active snapshot
    |       +-- Store completed run in seat_allocation when changed
    |       +-- Update student current fields + append seat_allocation[] history
    |
    +-- GET /api/sca/allocations/latest
            |
            +-- Restore the latest completed result on page load or refresh
```

The UI does not treat allocation output as a temporary preview. MongoDB is the source of truth, while React state is only the current presentation of the latest persisted run.

---

## Deployment Architecture

The production deployment separates the static frontend from the stateful API service:

```text
User Browser
    |
    | HTTPS
    v
Vercel — React/Vite frontend
    |
    | VITE_API_BASE_URL=https://<render-service>.onrender.com
    | /api/sca/* and /api/asa/*
    v
Render — Express/TypeScript backend
    |
    +-- MongoDB Atlas
    |     +-- sca-db: students, courses, allocation runs, SCA AI history
    |     +-- asa-db: dataset metadata, rows, ASA AI history
    |
    +-- sql.js in-memory SQLite
    |     +-- Restored from asa-db when the Render service starts
    |
    +-- Google Gemini API
```

### Frontend Deployment — Vercel

Vercel serves the compiled React single-page application from the `frontend` workspace.

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

Build-time environment variables:

| Variable | Production value |
|---|---|
| `VITE_API_BASE_URL` | Public HTTPS origin of the Render service, without a trailing slash |
| `VITE_SCA_API_URL` | `/api/sca` |
| `VITE_ASA_API_URL` | `/api/asa` |

TanStack Router handles client-side routes. Vercel must rewrite unknown application paths to `/index.html` so direct navigation and refreshes on routes such as `/sca/allocation-processing` do not return 404. Static asset requests continue to resolve from `frontend/dist/assets`.

### Backend Deployment — Render

Render hosts the long-running Express API from the `backend` workspace as a Web Service.

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Node.js |
| Install/build command | `npm install` |
| Start command for the current TypeScript source setup | `npm run dev` |
| Health/API origin | `https://<render-service>.onrender.com` |

Render supplies `PORT`; the Express server reads it from `process.env.PORT`. Production secrets and configuration are stored in Render environment variables, including `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_OPTIONS`, `ASA_DB_NAME`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SCA_API_PATH=/api/sca`, and `ASA_API_PATH=/api/asa`.

The current `backend/tsconfig.json` is type-check-only (`noEmit: true`), so `npm run build` does not create the `dist/index.js` expected by `npm start`. The documented Render command therefore runs the TypeScript entry point directly. Before switching Render to `npm start`, add a production emit configuration that generates `dist/` and validate the compiled entry path.

### Deployment Request Flow

1. Vercel builds the frontend with the Render origin embedded through `VITE_API_BASE_URL`.
2. The browser loads static assets from Vercel and calls Render directly over HTTPS.
3. Render routes SCA requests to MongoDB and ASA analytical queries to the in-memory SQLite engine.
4. Persistent allocation results are stored in MongoDB and returned by `GET /api/sca/allocations/latest`, so results survive frontend redeployments, navigation, and refreshes.
5. Render restarts recreate the ASA SQLite runtime; persisted ASA datasets are restored from MongoDB when available.

Because browser requests cross from the Vercel domain to the Render domain, CORS must allow the deployed Vercel origin. The current Express configuration enables CORS globally; production can narrow this to the exact Vercel domain and any approved custom domains.

---

## Database Design Decisions

### Dual Database Architecture

The system uses **three storage engines** for different concerns:

#### 1. MongoDB — `sca-db` (Primary SCA Data)

**Collections:**

| Collection | Purpose | Key Features |
|---|---|---|
| `student` | Student profiles, marks, category, preferences | Embedded `seat_allocation[]` history, soft-delete, text indexes |
| `course` | Course definitions with category-wise seats and cutoff marks | Reserved seats must sum to total seats; cutoffs range from 0 to 100 |
| `seat_allocation` | Allocation run snapshots | Complete result set per run, idempotent re-runs via diff comparison |
| `sca_ai_historie` | AI chat history | Exchange-based sessions with intent classification |

**Decision rationale:**
- **Schema flexibility** — Mongoose embedded sub-documents (e.g., `seat_allocation[]` within students) allow storing historical allocation records without joins.
- **Soft-delete** — `is_active` flag enables recovery and audit trails.
- **Compound indexes** — Optimized for the allocation algorithm's sort order (marks DESC, application_date ASC).

#### 2. MongoDB — `asa-db` (ASA Persistence)

| Collection | Purpose |
|---|---|
| `asa_datasets` | Uploaded dataset metadata (tableName, fileName, column schema, rowCount) |
| `asa_ai_histories` | ASA AI chat history with generated SQL |
| Per-table collections | Raw data rows (one collection per uploaded dataset) |

**Decision rationale:**
- Keeps SCA and ASA data concerns separated in different databases.
- Enables dataset restoration on restart: SQLite is rebuilt from MongoDB data.
- Optional dependency — if MongoDB is unavailable, the ASA AI still works with in-memory-only storage.

#### 3. SQLite (In-Memory via `sql.js`) — ASA Query Engine

**Decision rationale:**
- **Performance:** In-process SQL execution with zero network latency — critical for real-time AI-generated queries.
- **Safety:** The in-memory database is ephemeral; each server restart creates a fresh instance. No risk of corrupted persistent state.
- **Simplicity:** No external SQL database to provision, configure, or connect to.
- **Restoration:** On startup, `restoreMongoDatasets()` reads all dataset metadata and rows from MongoDB and recreates the SQLite tables with identical schemas, ensuring data survives restarts.

### Why Not a Single Database?

- **Separation of concerns:** SCA manages operational data (student records, course allocations). ASA manages analytical data (sales datasets). They have different access patterns, durability requirements, and schemas.
- **Independent scaling:** ASA can work entirely in-memory without any database configured, while SCA requires MongoDB for persistence.

---

## AI Integration Approach

### Provider: Google Gemini

Both modules use a custom HTTP client (`ai/gemini-client.ts`) that calls the Gemini API directly via `fetch` — no SDK dependency. This provides full control over request/response handling.

### Model Fallback Chain

```
Default: GEMINI_MODEL env var (default: gemini-2.5-flash-lite)
  --> Fallback: GEMINI_FALLBACK_MODELS env var (default: gemini-2.5-flash, gemini-2.0-flash)
```

The `modelChain()` function de-duplicates the list and iterates through each model. If a model returns a high-demand error (429, 503, or overloaded message), the next model is tried. Non-high-demand errors are thrown immediately. If all models fail, a 503 "under high demand" error is returned.

### SCA AI — Natural Language to Analytics

```
User question --> Intent Resolution (keyword matching)
                    --> Data Fetching (MongoDB: students, courses, allocation run)
                    --> Section Building (computed metrics per course/category)
                    --> Prompt Construction (role + facts + question)
                    --> Gemini API --> Structured answer + sections
                    --> Persist to SCA AI History
```

- **Intent resolution** classifies questions into 6 types: `overview`, `allocations_by_course`, `category_summary`, `first_preference_misses`, `highest_rejection_rate`, `available_seats`.
- **Grounding constraint:** The prompt explicitly instructs the AI to answer only from supplied facts — no hallucinated data.
- **Sections:** Structured data (`AiInsightSection[]`) is computed server-side and included in the prompt, ensuring the AI has accurate numbers to reference.

### ASA AI — Natural Language to SQL

```
User question
  |
  +-- Raw SELECT? --> Execute directly (model: "manual-sql")
  |
  +-- Gemini enabled? --> Fetch schema --> Build prompt --> Gemini --> Extract SQL
  |                          |
  |                          +-- validateQuery() --> Execute --> Return results
  |
  +-- Gemini fails/disabled? --> Local heuristic pattern matching
                                --> Build safe deterministic SQL
                                --> Execute --> Return results
```

- **Two-tier generation:** Gemini is the primary path. If unavailable, local heuristics generate safe SQL for common question types (duplicates, missing values, top N, monthly trends, overview).
- **Schema-aware prompts:** The prompt includes all available table schemas (columns and types), enabling the AI to generate accurate column references.
- **SQL extraction:** Output is parsed via regex to extract clean SQL from markdown code fences or raw text.
- **Validation:** Every generated SQL passes through `validateQuery()` before execution.

### ASA Dashboard AI

The dashboard service computes deterministic metrics and charts via SQL queries against SQLite, then optionally enhances with AI-generated insights (3 short JSON insights, max 18 words each). Falls back to deterministic fallback insights if AI is unavailable.

---

## Security Considerations

### SQL Injection Prevention

The `validateQuery()` function enforces strict controls:

1. **SELECT-only enforcement** — Regex check ensures only SELECT statements are accepted.
2. **Single statement enforcement** — Multiple semicolons are rejected (prevents chained queries).
3. **DDL/DML blacklist** — `DROP`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, and other destructive operations are blocked.
4. **Identifier escaping** — All table/column names are double-quoted with internal quote escaping (`"` -> `""`).
5. **Parameterized insertion** — CSV/Excel uploads use `sql.js` prepared statements (`?` placeholders), preventing injection during data ingestion.

### Input Validation & Sanitization

- **Student/course payload normalization** — Trims strings, enforces uppercase IDs, validates preference arrays (exactly 3, non-empty, unique).
- **Course seat validation** — Server-side validation ensures `general + obc + sc + st === total_seats`.
- **Preferred course resolution** — Validates that all preference course names exist in the database before saving.

### Error Handling

- **Centralized error handler** — Catches all unhandled errors, returns JSON error responses, never leaks stack traces to clients.
- **HTTP status codes** — Appropriate codes for validation (400), not found (404), duplicate key (409), and server errors (500).
- **Request tracing** — Every request gets a `x-request-id` UUID header for traceability across logs.

### Logging & Data Redaction

- **Winston-based structured logging** with custom levels (`info`, `success`, `warn`, `error`).
- **Automatic redaction** of sensitive keys matching `password`, `token`, `secret`, `authorization`, `cookie`, `api_key` patterns — values are replaced with `[REDACTED]`.
- **Truncation limits** — Strings at 500 chars, arrays at 20 items, objects at 25 keys, depth at 3 levels — preventing log flooding.

---

## Challenges Faced and Solutions Implemented

### Challenge 1: AI Hallucination in Allocation Answers

**Problem:** The SCA AI assistant sometimes fabricated student counts or course names when answering natural language questions about allocations.

**Solution:** Implemented a **grounded prompt architecture**:
- Server-side data fetching retrieves actual student, course, and allocation records.
- Computed metrics (per-course rejection rates, category summaries) are pre-calculated and included in the prompt as structured JSON sections.
- The system prompt explicitly instructs: "Answer only from the supplied facts. Do not invent data."
- This constrains Gemini to summarize existing data rather than generating fictitious numbers.

### Challenge 2: Gemini High-Demand Errors

**Problem:** During peak usage, the Gemini API frequently returned 429 (rate limit) and 503 (overloaded) errors, causing AI features to fail.

**Solution:** Implemented a **model fallback chain**:
- Configured fallback models (`gemini-2.5-flash`, `gemini-2.0-flash`) that are tried in sequence when the primary model is overloaded.
- Only high-demand errors trigger fallback — genuine API errors are not retried.
- For ASA specifically, a **local heuristic SQL generator** handles common question patterns (duplicates, missing values, top N, monthly trends) without any API call, providing uninterrupted service when Gemini is unavailable.

### Challenge 3: Persistent and Idempotent Allocation Results

**Problem:** Results held only in frontend state disappear after refresh, while repeated allocation requests can create duplicate snapshots when the underlying inputs have not changed.

**Solution:** Implemented **database-backed allocation processing**:
- Every run deterministically recomputes all active students from the current student and course data.
- A snapshot comparison checks allocation outcomes and remaining seats against the latest active run; an identical result returns the existing run with `200 OK`.
- A changed result is saved as a completed document in `seat_allocation`, and current plus historical allocation fields are written to each student.
- `GET /allocations/latest` restores the latest completed snapshot when the Allocation Results page loads or refreshes.

### Challenge 4: Dual Database Resilience

**Problem:** MongoDB Atlas may be unavailable during development or due to network issues, but the ASA module should still function.

**Solution:** Implemented **graceful degradation with fallback storage**:
- `initDB()` catches connection errors and logs a warning — the server continues to start.
- ASA module works **entirely in-memory** via `sql.js` when MongoDB is down.
- AI history is stored in-memory (a simple array) when MongoDB persistence is unavailable.
- Dataset restoration (`restoreMongoDatasets`) is skipped when MongoDB is disconnected, preventing crashes during development.

### Challenge 5: Dynamic SQL Type Inference from CSV/Excel

**Problem:** Uploaded sales data has mixed column types (dates as serial numbers, numbers with commas, boolean-like text), making accurate SQL schema detection difficult.

**Solution:** Developed a **multi-strategy type inference system** (`detectSqlType` in `asa-db.ts`):
- **Heuristic column naming** — Columns matching patterns like `id`, `date`, `email` are classified as identifiers or dates.
- **Excel serial date detection** — Numeric values between 10000-500000 are converted from Excel serial date format to ISO datetime.
- **Content sampling** — At least 50% of non-empty values must match a type for classification:
  - Boolean detection: `true/false/yes/no/0/1` patterns.
  - Numeric detection: integers vs decimals, with precision/scale calculation for `DECIMAL(p,s)`.
  - Text detection: length-based `VARCHAR(n)` vs `TEXT` for long strings.
- **Category mapping** — SQL types are mapped to semantic categories (`number`, `boolean`, `date`, `text`) for the frontend to display appropriate UI controls.

### Challenge 6: Dataset Restoration Across Restarts

**Problem:** The in-memory SQLite database is ephemeral — data is lost on server restart unless explicitly restored.

**Solution:** Implemented **automatic restoration from MongoDB**:
- Each uploaded dataset's metadata is stored in the `asa_datasets` MongoDB collection.
- Raw data rows are stored in a separate collection named after the table.
- On startup, `restoreMongoDatasets()` queries all metadata, fetches all rows, and recreates every table in SQLite with identical schemas.
- The restoration uses the same `createSqlTable()` function as the upload flow, ensuring consistency.
