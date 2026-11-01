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

## Administrators, organizers, and campus events

Every account created through registration starts as **Student**. An administrator
can open **Admin users** (`/admin/users`), search by name/email, filter by role, and
save a Student, Organizer, or Administrator role. Only active, verified
members can receive Organizer or Administrator access. Existing administrator accounts are protected from
changes on this page, and clients cannot grant themselves elevated roles through
registration or profile updates; role changes require a current administrator.

For the **first administrator only**, register and verify the intended account,
then run this trusted setup command from the repository root with your database
configured in `apps/api/.env`:

```bash
npm run admin:bootstrap -w @campushub/api -- your-verified-email@fanshaweonline.ca
```

This promotes the existing verified account; it does not create a password or
bypass verification. The command refuses to run if an administrator already
exists. Refresh the signed-in account or sign in again afterward. There is no
public administrator sign-up or automatic promotion of the first person to register.

Organizers and administrators see **Event Management** (`/events/manage`). They
can create published events and edit or cancel their own events. Cancelled events
remain in their management list, and disappear from student browsing. `/events`
shows only published events whose start time is in the future, sorted soonest
first, with date, time, location, and organizer. Both lists are paginated. The form
uses device-local time, sends ISO timestamps, and the cards display local time.

The **end date**, **end time**, and **event photo** are optional. An end time on
its own uses the start date; an end date on its own displays a date range without
inventing a finish time. Multi-day events may have an earlier clock time on the
last day, but any supplied finish timestamp must be after the start. Event photos
support JPG, PNG, and WebP up to 2 MB, with a preview and a remove action on edit.

Students can select **Message organizer** on an event card. The chat retains the
event's details and photo for both participants, including when reopened. Each
event has its own conversation between a student and organizer; repeated clicks
reuse it without replacing another event's context or an existing general DM.
The organizer receives the student's first message in **Messages → Requests**
and can reply or accept. Existing chats remain available if an event is cancelled.
No message or RSVP is sent automatically when the button is pressed.

Organizer permissions are checked against the current database role on every
privileged request, so a revoked organizer cannot continue managing events with
an older token. The UI refreshes account roles through Socket.IO, on window focus,
and periodically while signed in. Role changes do not delete existing events.

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/api/admin/users?search=...&role=...&page=1` | Administrators |
| `PATCH` | `/api/admin/users/:id/role` (`role`: `STUDENT`, `ORGANIZER`, or `ADMINISTRATOR`) | Administrators |
| `GET` | `/api/events?page=1` | Signed-in students |
| `GET` | `/api/events/mine?page=1` | Organizers/administrators; own events |
| `POST` | `/api/events` | Organizers/administrators |
| `PUT` | `/api/events/:id` | Current organizer role and event ownership |
| `PATCH` | `/api/events/:id/cancel` | Current organizer role and event ownership |

Apply the additive User/Event query indexes with
`npm run prisma:push -w @campushub/api` before rollout. Tests include a disposable MongoDB database for
role assignment/revocation, event queries, ownership, edits, and cancellation.

## Managing marketplace listings

Students and organizers can manage their own listings. **My listings** narrows
the board to the signed-in seller; the details page provides Edit, Mark as Sold,
and Delete. Sold listings stay readable with a Sold badge and no buyer messaging
button. Editing preserves seller ownership and sold status. Delete requires
confirmation and removes the listing from browsing/details. It soft-deletes the
database record so existing buyer/seller conversation references remain valid.

The API enforces ownership for `PUT /api/listings/:id`,
`PATCH /api/listings/:id/sold`, and `DELETE /api/listings/:id`; being an organizer or
administrator does not grant access to another seller's controls. Photo replacements
and listing edits are persisted atomically. Real MongoDB tests verify edits,
sold/deleted status, and preservation of linked conversations.

**Message seller** opens a chat for that specific ad, with its photo, title, price,
seller, and status at the top. General profile DMs, event chats, and conversations
about different ads remain separate. Repeated clicks on the same ad reopen its
existing chat. Older conversations are reused only when their original context
matches; history is preserved. A new chat appears in the recipient's **Requests**
after its first message, and moves to **Inbox** when they accept or reply. Reading
a request alone does not accept it. Ad references remain visible after a listing
is sold or removed, while the existing conversation stays usable.

## Data loading and reliability

Performance updates: notification badges use `/api/conversations/counts` instead
of downloading chat lists. Conversation lists return compact ad/event summaries;
opening a chat loads the full reference. Unread counts are grouped into bounded
queries. Message saves and their conversation/read-state updates are atomic.
The marketplace cache expires after 30 seconds and clears on moderation notices
or socket reconnection. Corrupt saved sessions are discarded safely. The root
build command builds the API, web app, and shared package without rebuilding the
frontend twice.

## Content reports and administrator review

Students can choose **Report** on another person's marketplace listing,
lost-and-found post, chat message, or stored chat attachment. The small dialog
requires a reason and accepts an optional note of up to 1,000 characters. The API
loads the actual content, uses the signed-in reporter, and saves an Open report
with its timestamp and a content snapshot in MongoDB. Repeated submissions reuse
that student's existing open report. Message/file reports require conversation
membership; reporting does not expose private messages to other students.

Administrators open **Reports** (`/admin/reports`) from the navigation or
**Admin users → Review reports**. Reports show the reporter's name/email, content
type, reason, note, date, status, and a saved preview. Open/Resolved/Dismissed and
content-type filters have bounded pagination. **View** reveals the reported
content snapshot; administrators do not gain access to the rest of a private
conversation. Decisions are **Remove content**, **Resolve report**, or
**Dismiss report**, with confirmation and an optional review note.

Removal, report resolution, and the moderation audit record save in one database
transaction. Listings are soft-removed; lost-and-found posts are hidden; removed
messages become a placeholder; file removal detaches only the matching attachment.
Conversation history and report snapshots remain available. Message/file changes
are pushed to connected chat clients. Public moderation notices remove loaded
listings/posts and invalidate the marketplace cache. Resolving/dismissing a report alone leaves
its content in place. Closed reports cannot be moderated again.

The existing chat composer still accepts text only. File reporting/display supports
attachments already stored on messages; this feature does not add a new upload
service or delete a file hosted on an external service.

| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/api/reports` (`targetType`, `targetId`, `reason`, optional `note`; files also use `attachmentIndex`) | Signed-in active accounts |
| `GET` | `/api/admin/reports?status=OPEN&type=LISTING&page=1` | Administrators |
| `POST` | `/api/admin/reports/:id/actions` (`action`: `REMOVE_CONTENT`, `RESOLVE`, or `DISMISS`; optional review `note`) | Administrators |

For another database/environment, regenerate Prisma and apply the additive report
indexes with `npm run prisma:generate -w @campushub/api` and
`npm run prisma:push -w @campushub/api`. Existing `ACTIONED` reports display as
Resolved; older reports without snapshots remain readable. No database reset is
required. Tests use disposable MongoDB replica sets and never remove real content.
