# Harvee Designs — Assessment Project

A dual-module monorepo featuring a **Student Course Allocation (SCA)** system and an **AI SQL Assistant (ASA)** for sales analytics. Built with Express + TypeScript backend and React + Vite frontend.

## Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
 - [Prerequisites](#prerequisites)
 - [Installation](#installation)
 - [Environment Variables](#environment-variables)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

## Features

### Module 1: SCA — Student Course Allocation
- **Student Management** — CRUD operations with search and pagination
- **Course Management** — CRUD operations with category-wise reserved seats and cutoff marks
- **Merit-Based Allocation** — Deterministic allocation by marks, application date, preference order, cutoffs, open merit, and reservation availability
- **Persistent Allocation Results** — Completed run snapshots, per-student allocation history, remaining-seat totals, and automatic restoration of the latest results after page refresh
- **SCA AI Assistant** — Natural language queries over student/course/allocation data via Gemini AI

### Module 2: ASA — AI SQL Assistant (Sales Analytics)
- **Dataset Upload** — Upload `ecommerce_sales_data.xlsx` with automatic schema inference
- **Schema Detection** — Inspect and preview column types before table creation
- **Dynamic Tables** — In-memory SQLite tables created on the fly from uploaded files
- **Natural Language to SQL** — AI-powered query generation and execution
- **Dashboard** — Auto-generated metrics, charts (revenue, category, payment, orders), and AI insights
- **Export** — Query results as Excel, dashboard summaries as PDF

## Tech Stack

### Backend
- **Runtime:** Node.js with TypeScript 6
- **Framework:** Express 4
- **Databases:** MongoDB (Mongoose 7) + In-memory SQLite (sql.js)
- **AI:** Google Gemini API (gemini-2.5-flash-lite)
- **File Processing:** Multer, PapaParse, xlsx, jsPDF
- **Logging:** Winston

### Frontend
- **Framework:** React 19 with TypeScript 5
- **Build Tool:** Vite 7
- **Routing:** TanStack Router (file-based)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Charts:** Recharts
- **Icons:** Lucide React
- **Linting/Formatting:** ESLint + Prettier

## Getting Started

### Prerequisites
- **Node.js** >= 18
- **npm** >= 9
- **MongoDB** (Atlas or local) — optional for ASA module
- **Gemini API Key** — required for AI features

### Installation

1. **Clone the repository:**
 ```bash
 git clone <repository-url>
 cd harvee_designs
 ```

2. **Backend setup:**
 ```bash
 cd backend
 npm install
 cp .env.example .env # (if available) or manually create .env
 ```

3. **Frontend setup:**
 ```bash
 cd frontend
 npm install
 ```

### Environment Variables

#### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `PORT` | Server port (default: `4001`) |
| `DB_HOST` | MongoDB host for SCA database |
| `DB_NAME` | SCA database name (`sca-db`) |
| `DB_USER` | MongoDB user |
| `DB_PASSWORD` | MongoDB password |
| `ASA_DB_NAME` | ASA database name (`asa-db`) |
| `SCA_API_PATH` | SCA route base path (default: `/api/sca`) |
| `ASA_API_PATH` | ASA route base path (default: `/api/asa`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name |
| `JWT_SECRET` | JWT signing secret |
| `API_KEY` | Fallback API key for Gemini |

#### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend origin (default: `http://localhost:4001`) |
| `VITE_SCA_API_URL` | SCA base path appended to the origin (default: `/api/sca`) |
| `VITE_ASA_API_URL` | ASA base path appended to the origin (default: `/api/asa`) |

> **Note:** If MongoDB is unavailable, the ASA module still works with in-memory SQLite + in-memory AI history fallback.

## Usage

### Start Backend (Port 4001)
```bash
cd backend
npm run dev
```

### Start Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://localhost:4001`.

### Validation
```bash
# Backend
cd backend && npm run typecheck

# Frontend
cd frontend && npm run typecheck && npm run build
```

---

## Database Schema

### SCA Database (`sca-db` — MongoDB)

| Collection | Key Fields |
|---|---|
| `student` | student_id, student_name, marks, category, preferences[3], allocation_status, seat_allocation[] |
| `course` | course_name, total_seats, reserved_seats { general, obc, sc, st }, cutoffs { general, obc, sc, st } |
| `seat_allocation` | run_code, status, rules, allocations[], remaining_seats_by_course[] |
| `sca_ai_historie` | exchange_id, role, content, intent, run_code, sequence |

### ASA Database (`asa-db` — SQLite in-memory + optional MongoDB persistence)

| Storage | Details |
|---|---|
| **SQLite (runtime)** | Tables created dynamically from uploaded CSV/XLSX. Only SELECT queries allowed. |
| **MongoDB (optional)** | Collection `asa_datasets` stores table metadata; row data in per-table collections. AI history in `asa_ai_histories`. |

Column types are auto-inferred: INT, BIGINT, DECIMAL, VARCHAR, TEXT, BOOLEAN, DATE, DATETIME.

> See [`backend/README.md`](backend/README.md#database-schema) for the full field-level schema.

### Sample SCA Data

The `sample_datasets/` directory currently contains:

- `students_dataset.json` — 100 students (`STU_1001` through `STU_1100`), each with three unique course preferences.
- `cources_data_set.json` — 13 active courses with category seat totals and cutoff marks. Every course is represented in student preferences.

After the sample data is imported into MongoDB, `POST /api/sca/allocations/run` computes and stores a completed allocation. `GET /api/sca/allocations/latest` returns the most recent stored result used by the Allocation Results page.

## Project Structure

```text
├── backend/ # Express + TypeScript API server
│ ├── src/
│ │ ├── index.ts # Express app bootstrap
│ │ ├── config/env.ts # Environment loader
│ │ ├── db/
│ │ │ ├── client.ts # MongoDB connection (SCA + ASA)
│ │ │ └── asa-db.ts # sql.js in-memory SQLite engine
│ │ ├── schemas/ # MongoDB collection schemas (Mongoose)
│ │ │ ├── sca/ # SCA database — 4 collections
│ │ │ └── asa/ # ASA database — 2 collections
│ │ ├── routes/ # Express routers
│ │ ├── controllers/ # Route handlers
│ │ ├── ai/ # Gemini AI integrations
│ │ ├── middlewares/ # Request logger, error handler
│ │ ├── helpers/ # Response formatter, validator
│ │ └── utils/logger.ts # Winston logger
│ ├── index.ts # Entry point
│ ├── package.json
│ └── tsconfig.json
│
├── frontend/ # React + Vite SPA
│ ├── src/
│ │ ├── main.tsx # App entry (TanStack Router)
│ │ ├── routes/ # File-based router pages
│ │ │ ├── __root.tsx # Root layout
│ │ │ ├── __maniLayout/ # Main layout + module selection
│ │ │ ├── sca/ # SCA pages (home, students, courses, allocation, AI)
│ │ │ └── asa/ # ASA pages (home, upload, tables, schema, SQL assistant)
│ │ ├── layout/ # Shell, header, sidebar layouts
│ │ ├── components/
│ │ │ ├── ui/ # shadcn/ui primitives
│ │ │ ├── ai/ # AI assistant UI components
│ │ │ ├── dashboard/ # MetricCard, ChartCard
│ │ │ └── module/ # Module selection template
│ │ ├── config/ # App settings, sidebar navigation
│ │ ├── hooks/ # Custom React hooks
│ │ └── lib/ # API client, services, utilities
│ ├── vite.config.ts
│ ├── tailwind.config.ts
│ └── package.json
│
├── Harvees_Task/ # Task specification documents
└── README.md # This file
```

## Contributing

Internal assessment project. Not open for external contributions.

## License

All rights reserved. This project is part of an assessment exercise.
