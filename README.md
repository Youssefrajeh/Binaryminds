# CampusHub

A single platform for Fanshawe College students — marketplace, lost & found, campus events,
and messaging, gated behind Fanshawe email verification.

Team: Binary Minds · Course: INFO-5103 · Term: Fall 2026

See [`docs/CAMPUSHUB_PLAN.md`](docs/CAMPUSHUB_PLAN.md) for the full build plan (scope, backlog,
schedule, risks) and [`docs/adr/`](docs/adr) for architecture decisions.

## Repo layout

```
apps/
  web/          React + Vite + TypeScript + Tailwind
  api/          Express + TypeScript + Prisma
packages/
  shared/       Shared TypeScript types (API contracts)
docs/
  CAMPUSHUB_PLAN.md
  adr/
```

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)

## Getting started

```bash
# 1. Clone the repo
git clone https://github.com/Youssefrajeh/Binaryminds.git
cd Binaryminds

# 2. Install all dependencies (root + all workspaces)
npm install

# 3. Create your local env file from the template
#    On macOS / Linux / Git Bash:
cp apps/api/.env.example apps/api/.env
#    On Windows PowerShell:
#    Copy-Item apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in at minimum:
- `DATABASE_URL` — your MongoDB Atlas connection string
- `JWT_SECRET` — any secure random string

```bash
# 4. Generate the Prisma client
npm run prisma:generate -w @campushub/api

# 5. Push the schema to your database
npm run prisma:push -w @campushub/api

# 6. Start the servers (use two terminals)
npm run dev:api     # → http://localhost:4000
npm run dev:web     # → http://localhost:5173 (proxies /api → localhost:4000)
```

## Scripts (run from repo root)

| Command | Does |
|---|---|
| `npm run dev:api` | Start the API dev server |
| `npm run dev:web` | Start the web dev server |
| `npm run build` | Build every workspace |
| `npm run typecheck` | Typecheck every workspace |
| `npm run lint` | Lint every workspace |
| `npm test` | Test every workspace |
| `npm run prisma:generate -w @campushub/api` | Regenerate Prisma client after schema changes |
| `npm run prisma:push -w @campushub/api` | Push schema changes to the database |
