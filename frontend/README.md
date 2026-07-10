# Frontend — Harvee Designs UI

React 19 + TypeScript + Vite SPA featuring the **SCA** (Student Course Allocation) and **ASA** (AI SQL Assistant) modules with TanStack Router and shadcn/ui.

## Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)

## Features

### Module 1: SCA — Student Course Allocation
- **Dashboard** — Overview metrics and statistics
- **Student Management** — CRUD table with search and pagination
- **Course Management** — CRUD table with category seats and cutoff marks
- **Allocation Processing** — Run allocations and restore the latest database-backed results after navigation or refresh
- **AI Assistant** — Floating chat panel for natural language queries

### Module 2: ASA — AI SQL Assistant
- **Dashboard** — Sales metrics, revenue charts, category breakdown, AI insights
- **Dataset Upload** — File upload with schema preview before commit
- **Schema Detection** — Inspect inferred column types
- **Dynamic Tables** — View and manage uploaded datasets
- **SQL Assistant** — Chat interface for natural language → SQL queries with result tables and charts
- **Export** — Download query results as Excel, dashboard as PDF

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 5** | Type safety |
| **Vite 7** | Build tool & dev server |
| **TanStack Router** | File-based routing |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn/ui** | Accessible UI primitives (Radix-based) |
| **Recharts** | Charting library |
| **Lucide React** | Icon library |
| **PapaParse** | Client-side CSV parsing |
| **Vaul** | Drawer component |
| **ESLint + Prettier** | Linting & formatting |

## Directory Structure

```text
src/
├── main.tsx # App entry — RouterProvider
├── routeTree.gen.ts # Auto-generated route tree
├── index.css # Tailwind CSS v4 + theme variables
├── routes/
│ ├── __root.tsx # Root layout (ThemeProvider, TooltipProvider)
│ ├── __maniLayout.tsx # Main layout wrapper
│ ├── __maniLayout/
│ │ ├── index.tsx # Redirect / → /module
│ │ ├── module.tsx # Module selection (SCA or ASA)
│ │ ├── sca.tsx # SCA layout shell
│ │ ├── sca/ # SCA pages
│ │ │ ├── home.tsx # SCA Dashboard
│ │ │ ├── student-management.tsx
│ │ │ ├── course-management.tsx
│ │ │ ├── allocation-processing.tsx
│ │ │ └── ai-assistant.tsx
│ │ ├── asa.tsx # ASA layout shell
│ │ └── asa/ # ASA pages
│ │ ├── home.tsx # ASA Dashboard
│ │ ├── dataset-upload.tsx
│ │ ├── dynamic-table-creation.tsx
│ │ ├── schema-detection.tsx
│ │ └── sql-assistant.tsx
├── layout/
│ ├── AppShellLayout.tsx # Sidebar + Header + Content shell
│ ├── HeaderLayout.tsx # Top navigation bar
│ └── Menulayout.tsx # Sidebar navigation
├── components/
│ ├── ui/ # shadcn/ui components (18 primitives)
│ ├── ai/ # AI assistant UI
│ │ ├── floating-dock.tsx
│ │ ├── message-scroller.tsx
│ │ ├── message.tsx
│ │ ├── sca-assistant-panel.tsx
│ │ └── sca-floating-assistant.tsx
│ ├── dashboard/
│ │ └── dashboard-card.tsx # MetricCard, ChartCard
│ ├── module/
│ │ └── module-page-template.tsx # Module selection template
│ └── theme-provider.tsx
├── config/
│ ├── app-settings.ts # App-wide configuration
│ └── sidebar-navigation.ts # Navigation menu definitions
├── hooks/
│ └── use-mobile.ts # Mobile detection
└── lib/
 ├── utils.ts # cn() utility
 ├── api-client.ts # Generic REST API client
 ├── asa-api.ts # ASA-specific API functions
 ├── export-utils.ts # Blob download helpers
 └── services/ # SCA service modules
 ├── students.ts
 ├── courses.ts
 ├── allocations.ts
 └── sca-ai.ts
```

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- Backend server running (see [backend README](../backend/README.md))

### Installation
```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env` file in the `frontend/` directory:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4001` | Backend origin without a trailing slash |
| `VITE_SCA_API_URL` | `/api/sca` | SCA path appended to the backend origin |
| `VITE_ASA_API_URL` | `/api/asa` | ASA path appended to the backend origin |
| `VITE_DEFAULT_PAGE_LIMIT` | `5` | Default table and allocation-result page size |

Example local configuration:

```env
VITE_API_BASE_URL=http://localhost:4001
VITE_SCA_API_URL=/api/sca
VITE_ASA_API_URL=/api/asa
VITE_DEFAULT_PAGE_LIMIT=5
```

The Vite development server also defines a `/api/*` proxy to `http://localhost:4001`. The API clients use the environment-based origin above, which allows the same frontend bundle configuration to target a local backend or the deployed Render service.

## Usage

```bash
# Development server (port 5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

### Pages

| Route | Page | Module |
|---|---|---|
| `/module` | Module Selection | — |
| `/sca/home` | SCA Dashboard | SCA |
| `/sca/student-management` | Student CRUD | SCA |
| `/sca/course-management` | Course CRUD | SCA |
| `/sca/allocation-processing` | Allocation Runs | SCA |
| `/sca/ai-assistant` | AI Chat | SCA |
| `/asa/home` | ASA Dashboard | ASA |
| `/asa/dataset-upload` | Upload Dataset | ASA |
| `/asa/dynamic-table-creation` | Manage Tables | ASA |
| `/asa/schema-detection` | Schema Preview | ASA |
| `/asa/sql-assistant` | SQL AI Chat | ASA |

### Allocation Results Data Flow

The Allocation Processing page calls `POST /api/sca/allocations/run` to execute an allocation. The backend stores the completed run in MongoDB and updates student allocation history. On initial page load and when **Refresh Results** is selected, the frontend calls `GET /api/sca/allocations/latest` and rebuilds the summary cards, student results, pagination, and remaining-seat display from the persisted response.

## Deployment

### Vercel Frontend

Create a Vercel project for this repository with the following settings:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

Set these Vercel environment variables for Production and, when needed, Preview:

```env
VITE_API_BASE_URL=https://<render-service>.onrender.com
VITE_SCA_API_URL=/api/sca
VITE_ASA_API_URL=/api/asa
VITE_DEFAULT_PAGE_LIMIT=5
```

Vite environment variables are embedded during the build. Redeploy the frontend after changing the Render URL or API paths.

### SPA Route Rewrites

TanStack Router uses browser history. Configure Vercel to rewrite application routes to `/index.html`; otherwise refreshing a nested URL such as `/sca/allocation-processing` can return a platform 404.

Equivalent `vercel.json` configuration, if added at the configured Vercel root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Render Backend Connection

The browser sends SCA and ASA requests directly from the Vercel domain to the Render HTTPS origin. The Render backend must be running and its CORS configuration must allow the Vercel production and preview origins. The current backend enables CORS globally; production deployments can restrict it to approved domains.

Deployment topology:

```text
Browser
  --> Vercel: React/Vite static application
  --> Render: /api/sca/* and /api/asa/*
        --> MongoDB Atlas
        --> Google Gemini API
        --> sql.js in-memory SQLite
```

Persistent SCA allocation results live in MongoDB behind Render, so Vercel rebuilds and frontend refreshes do not remove them.

## Project Structure

```text
frontend/
├── src/
│ ├── main.tsx # App entry
│ ├── routes/ # File-based router pages
│ ├── layout/ # Shell layouts
│ ├── components/ # Reusable components
│ │ ├── ui/ # shadcn/ui primitives
│ │ ├── ai/ # AI assistant components
│ │ └── dashboard/ # Dashboard widgets
│ ├── config/ # App configuration
│ ├── hooks/ # Custom hooks
│ └── lib/ # API clients & services
├── public/
├── vite.config.ts
├── components.json # shadcn/ui config
├── eslint.config.js
├── .prettierrc
└── package.json
```
