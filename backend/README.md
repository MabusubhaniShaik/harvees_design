# Backend — Harvee Designs API Server

Express + TypeScript backend powering the **SCA** (Student Course Allocation) and **ASA** (AI SQL Assistant) modules.

## Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
 - [Prerequisites](#prerequisites)
 - [Installation](#installation)
 - [Environment Variables](#environment-variables)
- [API Reference](#-api-reference)
- [Usage](#-usage)
- [Project Structure](#-project-structure)

## Features

### Module 1: SCA — Student Course Allocation
- Full CRUD for Students, Courses, and Allocation Runs
- Deterministic merit and reservation allocation using category cutoffs, open-merit seats, ordered preferences, and category quotas
- Persistent completed allocation snapshots plus per-student allocation history
- Latest completed allocation API for restoring the Allocation Results page
- AI-powered natural language queries over allocation data

### Module 2: ASA — AI SQL Assistant
- File upload (CSV/XLSX) with automatic schema detection
- Dynamic in-memory SQLite table creation
- Natural language to SQL generation and execution (Gemini AI)
- Dashboard metrics, charts, and AI-generated insights
- Query history tracking
- Excel and PDF export

## Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js** | JavaScript runtime |
| **TypeScript 6** | Type safety |
| **Express 4** | HTTP framework |
| **Mongoose 7** | MongoDB ODM (SCA + ASA persistence) |
| **sql.js** | In-memory SQLite engine (ASA runtime) |
| **Google Gemini API** | AI chat, NL→SQL, dashboard insights |
| **Multer** | File upload handling |
| **PapaParse / xlsx** | CSV / Excel parsing |
| **jsPDF** | PDF export |
| **Winston** | Structured logging |

## Directory Structure

```text
src/
├── index.ts # Express app bootstrap (cors, routes, error handler)
├── config/
│ └── env.ts # Environment variable loader
├── db/
│ ├── client.ts # MongoDB connections (SCA + ASA)
│ └── asa-db.ts # In-memory SQLite engine (sql.js)
├── schemas/ # MongoDB collection schemas (Mongoose)
│ ├── index.ts # Schema registration entry
│ ├── sca/ # SCA database schemas (sca-db)
│ │ ├── index.ts # registerScaSchemas() — returns registered collections
│ │ ├── student.schema.ts # student collection
│ │ ├── course.schema.ts # course collection
│ │ ├── allocation-run.schema.ts # seat_allocation collection
│ │ └── sca-ai-history.schema.ts # sca_ai_historie collection
│ └── asa/ # ASA database schemas (asa-db)
│ ├── index.ts # registerAsaSchemas() — returns registered collections
│ ├── asa-ai-history.schema.ts # asa_ai_histories collection
│ └── asa-dataset.schema.ts # asa_datasets collection
├── routes/
│ ├── sca.routes.ts # SCA routes
│ └── asa.routes.ts # ASA routes
├── controllers/
│ ├── rest.controller.ts # Abstract REST CRUD controller
│ ├── sca.controller.ts # SCA handlers
│ ├── asa.controller.ts # ASA handlers
│ ├── sca-ai.controller.ts # SCA AI handlers
│ └── asa-ai.controller.ts # ASA AI handlers
├── ai/
│ ├── gemini-client.ts # Gemini API client with model fallback
│ ├── sca-ai.service.ts # SCA AI: NL → MongoDB queries
│ ├── asa-ai.service.ts # ASA AI: NL → SQL generation
│ └── asa-dashboard.service.ts # Dashboard metrics & insights
├── middlewares/
│ ├── requestLogger.ts # Request logging middleware
│ └── errorHandler.ts # Centralized error handler
├── helpers/
│ ├── response-formatter.ts # Standardized API response format
│ └── validator.ts # Email validator
└── utils/
 └── logger.ts # Winston logger instance
```

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- MongoDB (Atlas or local) — optional for ASA runtime
- Google Gemini API key — required for AI features

### Installation
```bash
cd backend
npm install
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4001` | Server port |
| `DB_HOST` | For SCA | — | MongoDB host |
| `DB_NAME` | No | `sca-db` | SCA database name |
| `DB_USER` | For SCA | — | MongoDB user |
| `DB_PASSWORD` | For SCA | — | MongoDB password |
| `DB_OPTIONS` | No | — | MongoDB connection options |
| `ASA_DB_NAME` | No | `asa-db` | ASA database name |
| `ASA_DB_APP_NAME` | No | `asa-db` | ASA app name |
| `GEMINI_API_KEY` | For AI | — | Google Gemini API key |
| `GEMINI_MODEL` | No | — | Gemini model identifier |
| `JWT_SECRET` | No | — | JWT signing secret |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | No | `3600` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | No | `86400` | Refresh token expiry |
| `SCA_API_PATH` | No | `/api/sca` | Base path for SCA routes |
| `ASA_API_PATH` | No | `/api/asa` | Base path for ASA routes |
| `API_KEY` | No | — | Fallback Gemini key |

> **Note:** The ASA module works fully with just in-memory SQLite. MongoDB is only needed for persistent storage and the SCA module. When MongoDB is unavailable, AI history falls back to in-memory storage.

On startup, all MongoDB collection schemas are auto-registered via `registerScaSchemas()` and `registerAsaSchemas()`, creating the collections (`student`, `course`, `seat_allocation`, `sca_ai_historie`, `asa_ai_histories`, `asa_datasets`) when documents are first inserted.

## Database Schema

### SCA Database (`sca-db` — MongoDB via Mongoose)

#### Collection: `student`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `student_id` | String | required, unique, uppercase | Unique student identifier |
| `student_name` | String | required | Name of the student |
| `marks` | Number | required, min: 0, max: 100 | Merit score |
| `category` | String | enum: General, OBC, SC, ST | Reservation category |
| `application_date` | Date | required | Date of application |
| `preferences` | [String] | required, length: 3 | Ordered course preference names |
| `preferred_courses` | [ObjectId] | ref: Course | Course foreign keys matching preferences |
| `allocation_status` | String | enum: pending, allocated, unallocated | Current allocation state |
| `allocated_course` | ObjectId | ref: Course, default: null | Allocated course reference |
| `allocated_course_name` | String | default: null | Allocated course name |
| `allocated_preference` | Number | enum: 1, 2, 3, null | Which preference was matched |
| `allocation_run` | ObjectId | ref: AllocationRun | Run that allocated this student |
| `allocation_reason` | String | default: null | Reason for allocation outcome |
| `allocated_at` | Date | default: null | When allocation happened |
| `is_active` | Boolean | default: true | Soft-delete flag |
| `seat_allocation` | [Subdocument] | — | Historical allocation records |
| `created_date` | Date | auto | Timestamp |
| `updated_date` | Date | auto | Timestamp |

**Indexes:** `{ student_name: "text", student_id: "text" }`, `{ marks: -1, application_date: 1 }`, `{ category: 1 }`, `{ preferred_courses: 1 }`, `{ allocation_status: 1, allocated_course: 1 }`

**Subdocument — `seat_allocation[]`:**

| Field | Type | Description |
|---|---|---|
| `allocation_run` | ObjectId (ref: AllocationRun) | Run reference |
| `run_code` | String | Run code |
| `allocated_course` | ObjectId (ref: Course) | Course reference |
| `allocated_course_name` | String | Course name |
| `allocated_preference` | Number (1/2/3/null) | Preference matched |
| `allocation_status` | String (allocated/unallocated) | Outcome |
| `allocation_reason` | String | Reason |
| `allocated_at` | Date | Timestamp |

---

#### Collection: `course`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `course_name` | String | required, unique, trim | Course identifier |
| `total_seats` | Number | required, min: 1 | Total capacity |
| `reserved_seats.general` | Number | min: 0 | Seats for General category |
| `reserved_seats.obc` | Number | min: 0 | Seats for OBC category |
| `reserved_seats.sc` | Number | min: 0 | Seats for SC category |
| `reserved_seats.st` | Number | min: 0 | Seats for ST category |
| `cutoffs.general` | Number | required, 0–100 | General/open-merit cutoff |
| `cutoffs.obc` | Number | required, 0–100 | OBC cutoff |
| `cutoffs.sc` | Number | required, 0–100 | SC cutoff |
| `cutoffs.st` | Number | required, 0–100 | ST cutoff |
| `is_active` | Boolean | default: true | Soft-delete flag |
| `created_date` | Date | auto | Timestamp |
| `updated_date` | Date | auto | Timestamp |

**Validation:** `reserved_seats.general + obc + sc + st === total_seats`

---

#### Collection: `seat_allocation` (AllocationRun)

| Field | Type | Constraints | Description |
|---|---|---|---|
| `run_code` | String | required, unique, uppercase | Allocation run identifier |
| `status` | String | enum: preview, completed, cancelled | Run state |
| `generated_at` | Date | default: now | When generated |
| `is_active` | Boolean | default: true | Soft-delete flag |
| `rules.sort_by` | String | marks_desc_application_date_asc | Sorting strategy |
| `rules.preference_order` | String | first_to_third | Preference evaluation order |
| `rules.category_seat_policy` | String | strict_reserved_category | Seat allocation policy |
| `total_students` | Number | min: 0 | Students considered |
| `allocated_students` | Number | min: 0 | Successfully allocated |
| `unallocated_students` | Number | min: 0 | Not allocated |
| `first_preference_allocations` | Number | min: 0 | Got their 1st preference |
| `allocations` | [Subdocument] | — | Per-student allocation snapshot |
| `remaining_seats_by_course` | [Subdocument] | — | Course-wise remaining seats |
| `created_date` | Date | auto | Timestamp |
| `updated_date` | Date | auto | Timestamp |

**Indexes:** `{ generated_at: -1 }`, `{ status: 1, generated_at: -1 }`

---

#### Collection: `sca_ai_historie`

| Field | Type | Constraints | Description |
|---|---|---|---|
| `exchange_id` | String | required, indexed | Session identifier |
| `role` | String | enum: user, assistant | Message origin |
| `content` | String | required | Message text |
| `intent` | String | default: null | Classified intent |
| `run_code` | String | default: null | Referenced allocation run |
| `allocation_generated_at` | Date | default: null | Related allocation timestamp |
| `sequence` | Number | required, min: 0 | Message order in session |
| `is_active` | Boolean | default: true | Soft-delete flag |
| `created_date` | Date | auto | Timestamp |
| `updated_date` | Date | auto | Timestamp |

**Indexes:** `{ created_date: -1 }`, `{ exchange_id: 1, sequence: 1 }`, `{ role: 1, created_date: -1 }`

---

### ASA Database (`asa-db`)

#### Runtime Engine: SQLite (via sql.js, in-memory)

Tables are created dynamically from uploaded CSV/XLSX files. Column types are auto-inferred:

| SQL Type | Detected From |
|---|---|
| `INT` | Whole numbers within 32-bit range |
| `BIGINT` | Whole numbers exceeding 32-bit |
| `DECIMAL(p,s)` | Numbers with decimal places |
| `VARCHAR(n)` | Short text / identifier columns |
| `TEXT` | Long text exceeding 255 characters |
| `BOOLEAN` | Values matching true/false/yes/no/0/1 |
| `DATE` | Date columns with parsed values |
| `DATETIME` | Date columns containing time components |

All queries are validated — only `SELECT` statements are allowed.

#### Persistence Collection: `asa_datasets` (MongoDB — optional fallback)

| Field | Type | Description |
|---|---|---|
| `tableName` | String | Unique table identifier |
| `fileName` | String | Original uploaded filename |
| `columns` | [{ name, type }] | Inferred column schema |
| `rowCount` | Number | Number of rows |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

Uploaded row data is stored in a separate MongoDB collection named after the table, and restored into SQLite on server restart.

---

#### Collection: `asa_ai_histories` (MongoDB — optional)

| Field | Type | Description |
|---|---|---|
| `exchange_id` | String | Session identifier (indexed) |
| `role` | String | user / assistant |
| `content` | String | Message content |
| `sql` | String | Generated SQL query |
| `dataset_tables` | [String] | Tables referenced in query |
| `row_count` | Number | Result row count |
| `is_active` | Boolean | Soft-delete flag |
| `created_date` | Date | Timestamp |
| `updated_date` | Date | Timestamp |

**Indexes:** `{ created_date: -1 }`, `{ exchange_id: 1, created_date: 1 }`

> When MongoDB is unavailable, AI history is stored in-memory for the current session.

> For detailed request/response shapes, query params, and examples, see [`API.md`](API.md).

## API Reference

### SCA Module — `/api/sca`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/students` | List students (search, pagination) |
| `POST` | `/students` | Create a student |
| `GET` | `/students/:student_id` | Get student by ID |
| `PUT` | `/students/:student_id` | Update student |
| `PATCH` | `/students/:student_id` | Partially update student |
| `DELETE` | `/students/:student_id` | Soft-delete student |
| `GET` | `/courses` | List courses |
| `POST` | `/courses` | Create a course |
| `GET` | `/courses/:course_name` | Get course by name |
| `PUT` | `/courses/:course_name` | Update course |
| `PATCH` | `/courses/:course_name` | Partially update course |
| `DELETE` | `/courses/:course_name` | Soft-delete course |
| `POST` | `/allocations/run` | Execute allocation algorithm |
| `GET` | `/allocations/latest` | Get latest active completed allocation result |
| `GET` | `/allocations` | List allocation runs |
| `POST` | `/allocations` | Create allocation run |
| `GET` | `/allocations/:run_code` | Get allocation run |
| `PUT` | `/allocations/:run_code` | Update allocation run |
| `PATCH` | `/allocations/:run_code` | Partially update allocation run |
| `DELETE` | `/allocations/:run_code` | Soft-delete allocation run |
| `GET` | `/ai/config` | AI configuration status |
| `POST` | `/ai/chat` | Chat with SCA AI assistant |
| `GET` | `/ai/history` | Get AI history |
| `GET` | `/ai/chat-history` | Get AI chat history |

The `/allocation-runs/*` route family is an alias of `/allocations/*`, including `/allocation-runs/run` and `/allocation-runs/latest`.

### Allocation persistence flow

1. Active students are sorted by marks descending, application date ascending, then student ID ascending.
2. Preferences are checked from first to third. A qualifying student uses an available General seat through open merit first; otherwise an eligible reserved-category student can use an available seat for that category.
3. The completed run, per-student outcomes, reasons, summary counts, and remaining seats are inserted into the `seat_allocation` collection.
4. Each student is updated with the current outcome and receives an entry in `student.seat_allocation[]`.
5. An unchanged rerun returns the latest stored snapshot instead of inserting a duplicate run.

### ASA Module — `/api/asa`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload dataset, create SQLite table, persist to MongoDB |
| `POST` | `/detect` | Upload and detect schema only |
| `GET` | `/tables` | List all uploaded datasets |
| `GET` | `/tables/:tableName` | Preview dataset rows and schema |
| `DELETE` | `/tables/:tableName` | Remove a dataset |
| `POST` | `/query` | Execute a validated SELECT query |
| `GET` | `/dashboard/summary` | Dashboard analytics, charts, insights |
| `POST` | `/ai/chat` | Natural language → SQL → execute |
| `GET` | `/ai/config` | AI configuration status |
| `GET` | `/ai/history` | Query history |
| `GET` | `/ai/chat-history` | Full chat history |
| `POST` | `/export/excel` | Export query results as XLSX |
| `POST` | `/export/pdf` | Export dashboard/table as PDF |

## Usage

```bash
# Development (hot-reload via nodemon)
npm run dev

# Compile TypeScript
npm run build

# Production start (after build)
npm run start

# Type-check only
npm run typecheck
```

The server starts on `http://localhost:4001` by default.

## Project Structure

```text
backend/
├── src/
│ ├── index.ts # App entry point
│ ├── config/env.ts # Environment configuration
│ ├── db/
│ │ ├── client.ts # MongoDB connections
│ │ └── asa-db.ts # SQLite runtime engine
│ ├── models/ # Mongoose schemas
│ ├── routes/ # Express routers
│ ├── controllers/ # Route handlers
│ ├── ai/ # Gemini AI integrations
│ ├── middlewares/ # Express middlewares
│ ├── helpers/ # Utility helpers
│ └── utils/logger.ts # Winston logger
├── app.ts # Process entry
├── package.json
├── tsconfig.json
└── .env # Environment variables
```
