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

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in DATABASE_URL, JWT_SECRET
npx prisma generate --schema=apps/api/prisma/schema.prisma

npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173 (proxies /api to the api server)
```

`DATABASE_URL` points at a MongoDB Atlas cluster (free tier). Once it's set, push the schema:

```bash
npm run prisma:push -w apps/api
```

## Scripts (run from repo root)

| Command | Does |
|---|---|
| `npm run build` | Build every workspace |
| `npm run typecheck` | Typecheck every workspace |
| `npm run lint` | Lint every workspace |
| `npm test` | Test every workspace |
