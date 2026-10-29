# CampusHub

A single platform for Fanshawe College students — marketplace, lost & found, campus events,
and messaging, gated behind Fanshawe email verification.

Team: Binary Minds · Course: INFO-5103 · Term: Fall 2026

See [`docs/CAMPUSHUB_PLAN.md`](docs/CAMPUSHUB_PLAN.md) for the full build plan (scope, backlog,
schedule, risks) and [`docs/adr/`](docs/adr) for architecture decisions.

## Repo layout

```
apps/
  web/          React + Vite + TypeScript (frontend)
  api/          Express + TypeScript + Prisma (backend)
packages/
  shared/       Shared TypeScript types (API contracts)
docs/
  CAMPUSHUB_PLAN.md
  adr/
```

## Prerequisites

Before you begin, make sure you have:

- **[Node.js](https://nodejs.org/)** v18 or higher installed (`node -v` to check)
- **[Git](https://git-scm.com/)** installed (`git --version` to check)
- A **[MongoDB Atlas](https://www.mongodb.com/atlas)** cluster (free tier works fine)

## Getting started (step by step)

### Step 1 — Clone the repository

```bash
git clone https://github.com/Youssefrajeh/Binaryminds.git
cd Binaryminds
```

### Step 2 — Install all dependencies

This installs packages for the root, the API, the web app, and the shared package:

```bash
npm install
```

### Step 3 — Create your local environment file

Copy the template to create your own `.env` file:

**macOS / Linux / Git Bash:**
```bash
cp apps/api/.env.example apps/api/.env
```

**Windows PowerShell:**
```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

### Step 4 — Fill in your environment variables

Open `apps/api/.env` in any text editor and fill in **at minimum** these two values:

```env
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campushub"
JWT_SECRET="any-random-secret-string-here"
```

> **Where to get the DATABASE_URL:** Log in to [MongoDB Atlas](https://cloud.mongodb.com/),
> click **Connect** on your cluster, choose **Drivers**, and copy the connection string.
> Replace `<password>` with your database user's password.

`BREVO_API_KEY` and `EMAIL_FROM_ADDRESS` in `.env` are for email sending via Brevo.
The app will still start without them, but email verification won't work until they're configured.

### Step 5 — Generate the Prisma client

This generates the TypeScript database client from the schema:

```bash
npm run prisma:generate -w @campushub/api
```

### Step 6 — Push the schema to your database

This creates all the collections and indexes in your MongoDB Atlas cluster:

```bash
npm run prisma:push -w @campushub/api
```

### Step 7 — Start the development servers

You need **two terminals** open:

**Terminal 1 — Backend API:**
```bash
npm run dev:api
```
The API will be running at **http://localhost:4000**

**Terminal 2 — Frontend Web:**
```bash
npm run dev:web
```
The web app will be running at **http://localhost:5173**

### Step 8 — Open in your browser

Go to **http://localhost:5173** — you should see the CampusHub app.

The frontend automatically proxies all `/api` requests to `http://localhost:4000`,
so you don't need to configure anything extra.

## Scripts (run from repo root)

| Command | What it does |
|---|---|
| `npm run dev:api` | Start the API server in dev mode (auto-restarts on changes) |
| `npm run dev:web` | Start the web app in dev mode (hot reload) |
| `npm run build` | Build all workspaces for production |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm test` | Run tests in all workspaces |
| `npm run prisma:generate -w @campushub/api` | Regenerate Prisma client after schema changes |
| `npm run prisma:push -w @campushub/api` | Push schema changes to the database |

## Lost & Found (Sprint 03, US-1 and US-2)

Verified students can open **Lost & Found → Report an item**, choose Lost or Found,
and enter a title, description, category, campus location, and date. A photo is
optional (JPG, PNG, or WebP, up to 2 MB). Photos are stored as data URLs in MongoDB,
using the same storage approach as marketplace photos; no extra storage account is
needed. The API checks the decoded size and file signature as well as the MIME type.
Dates use Toronto's calendar date and cannot be in the future.

The board supports keyword search, lost/found type, category, partial location
(case-insensitive), and inclusive From/To dates. Filters work independently or in
combination. Results are newest first, with 12 posts per page and a **Load more**
button. Failed loads can be retried, and changing filters resets pagination.
Students can view the poster's profile and message them about an open report.
The existing **Mark as Resolved** action now persists and is restricted to its owner.

API endpoints (all require an active account's Bearer token):

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/lost-found` | Create a report; ownership and initial Open status come from the server |
| `GET` | `/api/lost-found` | Filter by `search`, `kind`, `category`, `location`, `from`, `to`, `page`, and optional `limit` (1–50) |
| `PATCH` | `/api/lost-found/:id/resolve` | Mark your report as resolved |

**Database setup/update:** after setting `apps/api/.env` as above, run:

```bash
npm run prisma:generate -w @campushub/api
npm run prisma:push -w @campushub/api
```

The schema adds category and indexes for newest-first browsing, category browsing,
and occurrence-date filtering. Older reports without category remain visible as
**Other**; no destructive reset or data deletion is needed. Location and keyword
substring matching use MongoDB's case-insensitive filters; these substring queries
are not accelerated by the ordinary category/date indexes.

`npm test` includes route validation/authorization tests, React form/filter tests,
and integration tests against a disposable local MongoDB replica set. The database
test library downloads a MongoDB binary on its first test run, stops the test
database afterward, and never connects to your Atlas/development database.
The shared package is compiled automatically before dev, test, and production builds.
