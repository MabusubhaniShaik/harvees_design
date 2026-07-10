# API Documentation

Base paths are configurable via `SCA_API_PATH` (default `/api/sca`) and `ASA_API_PATH` (default `/api/asa`) in `.env`.

## Standard Response Format

All SCA endpoints wrap responses using `formatSuccessResponse` / `formatFailResponse`.

### Success
```json
{
  "status": "success",
  "data": [],
  "message": "",
  "pagination": {
    "count": 10,
    "current_page": 1,
    "total_page_count": 5,
    "total_record_count": 50
  }
}
```

### Error
```json
{
  "status": "fail",
  "data": [],
  "message": "",
  "error_message": []
}
```

### Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success (fetch, update, delete) |
| 201 | Created |
| 400 | Validation error / bad request |
| 404 | Not found |
| 409 | Duplicate key |
| 500 | Internal server error |

---

## SCA Module — Student Course Allocation

### Students

#### `GET /students`
List students with search and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `page_count` | number | 10 | Items per page (alias: `limit`) |
| `q` | string | — | Free-text search across student_id, student_name, category, preferences |
| `is_active` | boolean | true | Filter active/inactive |
| `<field>` | any | — | Exact-match filter on any field |

**Response:** Array of student objects with pagination.

#### `POST /students`
Create a new student.

**Request Body:**
```json
{
  "student_id": "STU001",
  "student_name": "John Doe",
  "marks": 92,
  "category": "General",
  "application_date": "2025-01-15",
  "preferences": [
    "Computer Science and Engineering",
    "Cyber Security",
    "Data Analytics"
  ],
  "is_active": true
}
```

**Response:** `201 Created` — created student object.

#### `GET /students/:student_id`
Get a single student by ID.

#### `PUT /students/:student_id`
Full update of a student.

#### `PATCH /students/:student_id`
Partial update. Accepts any subset of student fields.

#### `DELETE /students/:student_id`
Soft-delete (sets `is_active = false`).

---

### Courses

#### `GET /courses`
List courses with search and pagination.

**Query Parameters:** Same pattern as students (`page`, `page_count`, `q`, `is_active`, field filters). Search targets `course_name`.

#### `POST /courses`
Create a new course.

**Request Body:**
```json
{
  "course_name": "Cyber Security",
  "total_seats": 60,
  "reserved_seats": {
    "general": 30,
    "obc": 15,
    "sc": 10,
    "st": 5
  },
  "cutoffs": {
    "general": 82,
    "obc": 77,
    "sc": 67,
    "st": 62
  },
  "is_active": true
}
```

**Validation:** Reserved seats must sum to `total_seats`. Every cutoff is required and must be between 0 and 100.

**Response:** `201 Created`.

#### `GET /courses/:course_name`
Get a course by name.

#### `PUT /courses/:course_name`
Full update.

#### `PATCH /courses/:course_name`
Partial update.

#### `DELETE /courses/:course_name`
Soft-delete.

---

### Allocations

#### `GET /allocations`
List allocation runs with search and pagination. Search targets `run_code`, `allocations.student_id`, `allocations.student_name`.

#### `POST /allocations`
Create an allocation run manually.

#### `POST /allocations/run`
Execute the allocation algorithm and persist the completed result. Send an empty JSON object (`{}`) or no meaningful request fields.

**Response:** `201 Created` for a new run, or `200 OK` when the latest stored snapshot is already current. The response contains:
- `run_code` — auto-generated unique code
- `status` — `"completed"`
- `allocations[]` — per-student allocation results
- `remaining_seats_by_course[]` — remaining capacity per course
- Summary counts: `total_students`, `allocated_students`, `unallocated_students`, `first_preference_allocations`

**Algorithm:** Active students are sorted by marks DESC, application date ASC, then student ID ASC. The engine checks each student's three preferences in order. A student meeting the General cutoff takes an available General seat through open merit; otherwise a non-General student meeting their category cutoff may take an available seat in that reserved category.

**Persistence:** A completed snapshot is stored in MongoDB collection `seat_allocation`. Current allocation fields are updated on every active student, and an audit entry is appended to `student.seat_allocation[]`. If the computed allocation and remaining-seat snapshot match the latest active run, the API returns that stored run without creating a duplicate.

#### `GET /allocations/latest`
Return the latest active allocation run whose status is `completed`. This endpoint is used by the Allocation Results page so results remain visible after navigation or browser refresh.

If no completed run exists, the request still returns `200 OK` with an empty `data` array.

**Example response:**
```json
{
  "status": "success",
  "data": [
    {
      "run_code": "ALLOC-20250710120000-AB12C",
      "status": "completed",
      "generated_at": "2025-07-10T12:00:00.000Z",
      "total_students": 100,
      "allocated_students": 92,
      "unallocated_students": 8,
      "first_preference_allocations": 76,
      "allocations": [],
      "remaining_seats_by_course": []
    }
  ],
  "message": "Latest allocation result fetched successfully"
}
```

#### `GET /allocations/:run_code`
Get a specific allocation run by code.

#### `PATCH /allocations/:run_code`
Update allocation run (e.g. change status to `"completed"` or `"cancelled"`).

#### `DELETE /allocations/:run_code`
Soft-delete.

> **Route alias:** The same allocation endpoints are available under `/allocation-runs/*`, including `POST /allocation-runs/run` and `GET /allocation-runs/latest`.

---

### SCA AI

#### `GET /ai/config`
Get SCA AI configuration and status.

**Response:**
```json
{
  "enabled": true,
  "provider": "google-gemini",
  "model": "gemini-2.5-flash-lite",
  "temperature": 0.3,
  "maxOutputTokens": 1024,
  "suggestions": [
    "How many students were allocated to each course?",
    "Which students did not receive their first preference?"
  ]
}
```

#### `POST /ai/chat`
Ask a natural language question about allocations.

**Request Body:**
```json
{
  "message": "How many students got their first preference?"
}
```

**Response:**
```json
{
  "answer": "Out of 100 students, 78 received their first preference.",
  "runCode": "ALLOC-20250710-ABCD12",
  "generatedAt": "2025-07-10T12:00:00.000Z",
  "model": "gemini-2.5-flash-lite",
  "intent": "first_preference_summary",
  "sections": []
}
```

#### `GET /ai/history`
Get summarized query history.

#### `GET /ai/chat-history`
Get full chat history with all messages.

---

## ASA Module — AI SQL Assistant

### Dataset Upload & Schema

#### `POST /upload`
Upload `ecommerce_sales_data.xlsx` or CSV file. Creates an in-memory SQLite table and persists metadata to MongoDB.

**Request:** `multipart/form-data` with field `file`.

**Response:**
```json
{
  "tableName": "ecommerce_sales_data",
  "fileName": "ecommerce_sales_data.xlsx",
  "rowCount": 1000,
  "columnCount": 15,
  "columns": [
    { "name": "order_id", "type": "VARCHAR(20)", "category": "text" },
    { "name": "revenue", "type": "DECIMAL(12,2)", "category": "number" }
  ],
  "rows": [],
  "totalRows": 1000
}
```

#### `POST /detect`
Upload file for schema detection only (no persistence).

**Request:** `multipart/form-data` with field `file`.

**Response:** Same shape as upload without persistence.

---

### Tables

#### `GET /tables`
List all uploaded datasets with metadata (column count, row count, timestamps).

#### `GET /tables/:tableName`
Get schema and preview rows for a dataset.

#### `DELETE /tables/:tableName`
Remove a dataset from both SQLite and MongoDB.

---

### Query

#### `POST /query`
Execute a validated SELECT query.

**Request Body:**
```json
{
  "sql": "SELECT category, SUM(revenue) FROM ecommerce_sales_data GROUP BY category ORDER BY SUM(revenue) DESC"
}
```

**Response:**
```json
{
  "columns": ["category", "SUM(revenue)"],
  "rows": [
    ["Electronics", 125000],
    ["Clothing", 87000]
  ],
  "rowCount": 5
}
```

**Security:** Only `SELECT` statements are allowed. DDL/DML (`DROP`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, etc.) are rejected.

---

### Dashboard

#### `GET /dashboard/summary`
Get analytics dashboard data.

**Response:**
```json
{
  "useCase": "ecommerce",
  "metrics": [
    { "label": "Orders", "value": 1000, "helper": "Total orders" },
    { "label": "Revenue", "value": 450000, "helper": "Total revenue" }
  ],
  "insights": ["Revenue grew 15% this month..."],
  "charts": {
    "monthlyRevenue": [{ "label": "Jan", "value": 35000 }],
    "revenueByCategory": [{ "label": "Electronics", "value": 125000 }],
    "paymentMethodMix": [{ "label": "Credit Card", "value": 600 }],
    "orderStatusMix": [{ "label": "Delivered", "value": 800 }]
  },
  "queryHistory": [],
  "tables": []
}
```

---

### ASA AI

#### `GET /ai/config`
Get ASA AI configuration.

**Response:**
```json
{
  "enabled": true,
  "provider": "google-gemini",
  "model": "gemini-2.5-flash-lite",
  "temperature": 0.3,
  "maxOutputTokens": 1024,
  "dataset": "ecommerce_sales_data.xlsx",
  "suggestions": [
    "Show the top 10 customers by revenue.",
    "Which month generated the highest sales?"
  ]
}
```

#### `POST /ai/chat`
Ask a natural language question or send raw SQL.

**Request Body:**
```json
{
  "message": "Show top 5 products by revenue"
}
```

**Response:**
```json
{
  "answer": "The top 5 products by revenue are...",
  "sql": "SELECT product_name, SUM(revenue) FROM ecommerce_sales_data GROUP BY product_name ORDER BY SUM(revenue) DESC LIMIT 5",
  "columns": ["product_name", "SUM(revenue)"],
  "rows": [],
  "rowCount": 5,
  "model": "gemini-2.5-flash-lite",
  "tables": ["ecommerce_sales_data"]
}
```

If the message is raw SQL, it executes directly. Otherwise, Gemini converts it to SQL and executes.

#### `GET /ai/history`
Get summarized query history (question, answer, sql, rowCount).

#### `GET /ai/chat-history`
Get full chat history with all messages.

---

### Export

#### `POST /export/excel`
Export query results as Excel file.

**Request Body (optional):**
```json
{
  "sql": "SELECT * FROM ecommerce_sales_data"
}
```

**Response:** Binary `.xlsx` file download.

#### `POST /export/pdf`
Export dashboard summary as PDF.

**Response:** Binary `.pdf` file download.
