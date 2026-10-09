# AI Business Intelligence

A full-stack web application that gives small teams a single place to work with business data and company documents. The product is presented in the UI as **AI Business Analyst**. Instead of exporting spreadsheets into separate tools or hunting through PDFs by hand, users sign in to a company workspace, upload structured files and knowledge documents, explore charts and metrics, and ask questions in everyday language.

The system is built around **company isolation**: every user belongs to one company, and datasets, document chunks, and AI answers never cross company boundaries.

---

## What problem it addresses

Teams often store sales or operations data in CSV or JSON exports while policies, SOPs, and contracts live in PDFs or Word files. This project ties those two worlds together—tabular analytics on one side, semantic search over documents on the other—with optional forecasting, outlier detection, and LLM-assisted explanations on top.

---

## How the system is split

Three main parts cooperate:

1. **Frontend** — React single-page app with routing, forms, charts, and the analytics workspace.
2. **Backend API** — Handles accounts, file uploads, database access, job scheduling for dataset processing, and proxies or orchestrates calls into the analytics service and OpenRouter for some AI endpoints.
3. **Analytics service** — Python FastAPI service that cleans and summarizes datasets, runs SQL for natural-language questions, trains simple ML models for forecast and anomalies, and produces text embeddings for RAG.

Persistent storage is **PostgreSQL**, including **pgvector** for document chunk similarity search. **Redis** backs a queue used when datasets are processed asynchronously after upload.

---

## Tech stack

### Frontend

- React 19 with TypeScript
- Vite for development and builds
- React Router for public routes (login, register) and protected app pages
- Recharts for line and bar visualizations on the analytics dashboard

### Backend

- Node.js with Express 5
- Prisma ORM against PostgreSQL
- bcrypt for password hashing
- JWT access tokens in the client plus HTTP-only refresh cookies stored server-side as hashed refresh sessions
- Multer for multipart uploads (datasets and documents)
- Text extraction from PDF (pdf-parse), DOCX (mammoth), and plain text
- BullMQ and ioredis for background dataset processing jobs
- CORS and security headers configured for a separate frontend origin

### Analytics and AI service

- FastAPI and uvicorn
- pandas and numpy for ingestion, cleaning, and summaries
- scikit-learn: Random Forest regressor for time-series forecasting, Isolation Forest for anomaly detection
- sentence-transformers (`all-MiniLM-L6-v2`, 384-dimensional vectors) for local embeddings—no paid embedding API
- OpenRouter chat completions (configurable model; default targets a free-tier Gemma model) for SQL generation, short answers from query results, RAG synthesis, and multi-source business analysis

### Data model (conceptual)

- **Company** owns users, datasets, and documents.
- **Dataset** stores metadata and schema; each row is stored as JSON linked to the dataset.
- **Document** stores extracted text; **DocumentChunk** rows hold chunk text and vector embeddings for search.
- **User** accounts are unique by email and scoped to one company.

---

## Feature flow (end to end)

### Authentication and session

A new user registers with their name, email, password, and company name. Registration creates the company and the first user in one step, then signs them in. Returning users log in with email and password.

Protected pages are unreachable without a valid session. On load, the app attempts to refresh the access token using the refresh cookie so users stay logged in across reloads. Signing out revokes the refresh session and clears the client token. The sidebar shows the user’s name, company name, and a sign-out control.

### Home dashboard

After login, the default landing page is a lightweight dashboard—not the heavy analytics screen. It greets the user and splits attention between two areas:

- **Datasets** — Short description of CSV/JSON uploads, a link to upload, and up to three recent datasets with file name, row count, and upload date.
- **Analytics** — Links into the analytics experience with shortcuts labeled for charts, revenue forecast, and anomaly detection, optionally deep-linking to a recent dataset.

If no datasets exist yet, the analytics side nudges the user to upload first.

### Datasets

The datasets page is where structured data enters the system. Users pick a CSV or JSON file and may set a friendly display name; otherwise the file name is used.

On upload, the API parses the file, records column information and row counts, and persists rows for that company. Processing can run in the background with visible status (pending, processing, completed, or failed). Users see a list of all company datasets, open a tabular preview of sample rows to sanity-check columns, and delete datasets they no longer need. Deletes are permanent for that dataset and its rows.

Only authenticated users from the same company can list or mutate these records; the API enforces company scope on every operation.

### Documents

The documents page is the knowledge base for unstructured content. Supported uploads include PDF, DOCX, TXT, and Markdown. Each upload has a title (manual or derived from the file name).

The backend extracts readable text, splits it into chunks, requests an embedding per chunk from the analytics service, and stores chunks with vectors in PostgreSQL. The UI shows processing state until embeddings are ready. Users can delete documents; related chunks are removed with them.

Document content is used later when asking policy-style questions in the analytics insights panel or when the business analyst mode pulls relevant excerpts alongside numeric data.

### Analytics dashboard

Analytics is the main data exploration surface. The user selects one of their company’s datasets from a dropdown. Selecting a dataset triggers processing on the analytics service: cleaning, type detection, and a summary returned to the browser.

**Summary** — Cards show total rows, cleaned row count, column count, and how many columns were detected as numeric.

**Date filter** — When a date-like column exists, optional start and end dates filter KPIs and charts. Leaving dates empty uses all rows.

**Business KPIs** — The user picks a numeric column; the UI shows aggregate metrics (totals, averages, extremes) computed from the current row set, respecting the date filter when active.

**Charts** — Another numeric column and a chart type (bar or line) drive a Recharts visualization over the same filtered or full data.

**Revenue forecast** — For suitable time-series data, the service prepares features, trains a Random Forest model, and returns roughly thirty days of forward predictions, plotted against historical values.

**Anomaly detection** — The service runs Isolation Forest on the detected date/value series and highlights unusual points on a chart and in supporting detail.

If no dataset is selected or analytics fails (for example when the Python service is down), the page explains what is missing instead of showing empty widgets.

### Insights and AI (sidebar on analytics)

While the main column shows classic BI, a side panel offers three modes:

**Business analysis** — For open-ended questions (“What drove revenue last quarter and were there spikes?”). The pipeline runs a text-to-SQL step on the selected dataset, executes the query safely (SELECT-only against a controlled snapshot), optionally attaches document excerpts from vector search, and—when the question wording suggests it—adds anomaly or forecast summaries. A final LLM pass writes a short multi-paragraph analysis. The UI can expand “how this was calculated” to show SQL, result rows, source documents with similarity scores, and any forecast or anomaly payload used. A separate action can generate a structured multi-section business report for the dataset without retyping a question.

**Quick numbers** — A lighter path for factual questions on the dataset only: generate SQL, run it, return a brief plain-language answer. Suited for totals, averages, and simple aggregates.

**Company docs** — Questions are answered from uploaded documents only. The query is embedded, similar chunks are retrieved from pgvector scoped to the company, and the LLM composes an answer with cited excerpts. This mode works even when the user is focused on documents rather than a specific metric.

### Navigation and layout

Inside the app, a persistent sidebar (and a compact mobile header) links Dashboard, Datasets, Documents, and Analytics. All routes except login and register require authentication.

---

## AI design choices (short)

- **Structured data** — Natural language is converted to SQL by an LLM, then validated and executed in Python; answers are grounded in actual query results.
- **Documents** — Retrieval-augmented generation with local embeddings keeps search private to your infrastructure aside from the optional chat model for the final answer text.
- **Forecast and anomalies** — Classical ML on the time series avoids hallucinated numbers for those features; the LLM interprets and narrates when used in business analysis mode.

---

## Repository layout

- `frontend/` — React UI
- `backend/` — Express API, Prisma schema, workers/queues
- `analytics-service/` — FastAPI analytics, ML, embeddings, and LLM helpers

Environment variables for database URLs, OpenRouter keys, service URLs, and CORS origins are expected in each service’s `.env` (see `.env.example` files where present).

---

## Author

© Aditya Pawar
