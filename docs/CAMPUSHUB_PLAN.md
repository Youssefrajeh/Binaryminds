# CampusHub — Build Plan

**Team:** Binary Minds (3 people) · **Course:** INFO-5103 · **Term:** Fall 2026
**Status:** planning · **Owner of this doc:** rotate with scrum master

---

## 0. The one decision that matters

The Vision doc lists **six** product features. Three people cannot ship six features in one
semester. Study Rooms alone (real-time presence + WebRTC or shared whiteboard) is a full
semester project by itself.

So: **the Vision document describes the product; the backlog describes Release 1.**
Those are allowed to differ, and showing that you know the difference is worth marks.

**Release 1 (what you actually build):**

| In | Out (stays in the backlog, below the line) |
|---|---|
| Accounts + Fanshawe email verification | Study Groups & Study Rooms |
| Student Profiles | Group chat / file & note sharing |
| Student Marketplace | Video or voice rooms |
| Direct messaging (buyer ↔ seller only) | Push notifications |
| Lost & Found | Native mobile app |
| Campus Events + RSVP | Recommendation / matching algorithms |
| Reporting + admin moderation | |

The differentiator you are selling is **"every member is a verified Fanshawe student."**
That is the cheapest feature on the list to build and the only one Facebook and Discord
cannot copy. Build it first and make it visible everywhere in the UI.

---

## 1. Fix the Vision document first (due before code)

These are the concrete edits. Do them this week.

### 1.1 Mechanical

- [ ] **Rename the file.** It is still `Binary_Minds_Vision_Recircuit_v1_0.docx`. Recircuit is
      the dropped RMA idea. → `Binary_Minds_Vision_CampusHub_v1_0.docx`
- [ ] Delete **every** blue `InfoBlue` guidance paragraph (sections 5, 6, 7, 8, 9 and the two
      at the top of the document). Graders deduct for leftover template text.
- [ ] Fill the **Revision History** table: `17/Sep/26 | 1.0 | Initial draft | Binary Minds`.
- [ ] Section 4.3 "Instagram" is hard-typed as `4.3` and styled `unnumbered`. Restyle it to the
      same heading level as 4.1 and 4.2 so auto-numbering and the TOC work.
- [ ] Set File → Properties (title, company/team), then Ctrl-A → F9 to refresh fields, and do
      the **headers and footers separately**. The TOC currently still says
      "4.1 \<a Competitor\>".

### 1.2 Content inconsistency a grader will catch

The Vision Statement promises three things (buy/sell, lost & found, events). The Product
Features section lists six. Align them. Suggested rewrite of section 1:

> CampusHub is a single platform built exclusively for Fanshawe College students, replacing
> the scattered mix of Facebook groups, Discord servers, and Instagram posts they currently
> use to get through the school year. In one place, students can buy and sell textbooks and
> supplies, report lost and found items, discover campus events and clubs, find study
> partners, and share notes with classmates. Because every member is a verified Fanshawe
> student and everything is organised around student life rather than around engagement,
> nothing important gets buried in a feed.

---

## 2. Section 6.2 — Functional Roles

These role names **must** be the exact strings used in the "As a ___" column of the backlog.
Keep it to four.

| Name | Description |
|---|---|
| **Guest** | An unauthenticated visitor. Can view the landing page and register, but cannot browse listings, post, or message. |
| **Student** | A registered user with a verified Fanshawe email address. The primary role — can post listings and lost & found items, message other students, RSVP to events, and maintain a profile. |
| **Organizer** | A Student who represents a club, program, or campus department and can publish and manage events. Inherits all Student permissions. |
| **Administrator** | A member of the project/moderation team. Reviews reports, removes content, and suspends accounts. Not a student-facing role. |

## 3. Section 6.1 — Project Team

Three people, so every person carries two hats. Fill in the names; the responsibilities
column is drafted:

| Name | Responsibilities |
|---|---|
| *(name)* | Scrum Master; sprint planning and stand-up facilitation; Accounts, email verification, profiles, and the admin/moderation module. |
| *(name)* | Database designer; schema, migrations, and seed data; Marketplace listings, categories, search and filtering. |
| *(name)* | UI/UX designer; component library and responsive layout; Messaging, Lost & Found, and Campus Events. |

Everyone writes tests for their own module and reviews at least one PR per sprint.

---

## 4. Section 7 — Product Backlog

Estimating basis: **1 story point = 4 person-hours.** Fibonacci 1–8. Anything that would be
13 has been split.

### Release 1 (Priority 1–19)

| # | As a | I want to | So that I can | Pts |
|---|---|---|---|---|
| 1 | Guest | register using my Fanshawe email address | join a community of verified students | 5 |
| 2 | Guest | confirm my account with a code sent to that email | prove I actually attend Fanshawe | 3 |
| 3 | Student | log in and log out securely | keep my account and messages private | 3 |
| 4 | Student | reset a forgotten password | regain access without contacting support | 2 |
| 5 | Student | create and edit a profile with my program, year, and interests | be found by peers in the same courses | 3 |
| 6 | Student | post an item for sale with photos, price, condition, and category | sell things I no longer need to other students | 5 |
| 7 | Student | browse listings filtered by category and price range | find what I need without scrolling everything | 3 |
| 8 | Student | search listings by keyword | find a specific textbook by title or ISBN | 2 |
| 9 | Student | message the seller of a listing | ask questions and arrange a campus meetup | 5 |
| 10 | Student | mark my listing as sold | stop receiving messages about it | 1 |
| 11 | Student | post a lost or found item with photo, location, and date | reconnect the item with its owner | 3 |
| 12 | Student | browse and filter lost & found posts | check whether my item has been turned in | 2 |
| 13 | Student | contact the person who posted a found item | arrange to claim it | 2 |
| 14 | Student | close my lost & found post once resolved | keep the board current and useful | 1 |
| 15 | Organizer | publish an event with date, time, location, and description | let students discover what my club is running | 3 |
| 16 | Student | browse upcoming events in a list or calendar view | plan which ones to attend | 3 |
| 17 | Student | RSVP to an event | let the organizer plan attendance | 2 |
| 18 | Student | report a listing, post, or user | get scams and inappropriate content removed | 2 |
| 19 | Administrator | review reports and remove content or suspend a user | keep the platform safe and trusted | 3 |

**Release 1 subtotal: 53 points**

### Backlog — not in Release 1 (Priority 20–22)

| # | As a | I want to | So that I can | Pts |
|---|---|---|---|---|
| 20 | Student | create or join a study group for a specific course | find people studying the same material | 5 |
| 21 | Student | chat with my study group in a shared thread | coordinate sessions without leaving the platform | 8 |
| 22 | Student | upload and share notes and files inside a group | exchange study material in one place | 5 |

**Full backlog total: 71 points**

---

## 5. Velocity and cost (sections 7 footer + 9)

**Capacity assumptions**

| Assumption | Value |
|---|---|
| 1 story point | 4 person-hours |
| Team size | 3 |
| Committed hours per person per week | 8 |
| Sprint length | 2 weeks |
| Team hours per sprint | 3 × 8 × 2 = 48 |
| **Velocity** | **48 ÷ 4 = 12 points per sprint** |
| Development sprints available | 5 |
| **Capacity** | **60 points** |

Release 1 is 53 points against 60 of capacity — about 12% slack. That is tight but honest,
and it is exactly why items 20–22 sit below the line.

**Cost estimate**

| Line | Calculation | Amount |
|---|---|---|
| Effort | 53 pts × 4 hrs | 212 person-hours |
| Labour | 212 hrs × $65.00 loaded rate | $13,780.00 |
| Contingency | 25% | $3,445.00 |
| **Total** | | **$17,225.00** |

Build this in Excel (the assignment asks for it), then paste it into section 9 as a picture
so the numbers can't drift.

**Cost assumptions to list in 9.1:**

- Loaded bill rate of $65.00/hr for a junior developer, uniform across all three team members.
- No licensing costs; the stack is open source and hosted on free or education tiers.
- Estimate covers development, code review, and testing only — no marketing, support, or
  post-launch maintenance.
- 25% contingency, at the top of the 20–25% range, because the team has not previously worked
  together on a shared codebase.
- Hardware and developer workstations are already owned and not charged to the project.

---

## 6. Section 5 — Risks

### 5.1 Business

| Risk | Impact | Mitigation |
|---|---|---|
| **Cold start.** A marketplace with no listings and an events page with no events is worthless on day one. | High | Launch at the start of a semester; seed with real textbook listings from the team's own programs; approach the FSU to post their events. |
| **Incumbent inertia.** Facebook Marketplace and Discord are free, already installed, and already have Fanshawe students in them. | High | Compete on verification and organisation, not on features. Do not try to out-chat Discord. |
| **No institutional buy-in.** Fanshawe may not permit use of its name, logo, or email domain for verification. | Medium | Treat CampusHub as an unofficial student project; keep branding clearly independent; verification checks the email domain only, with no claim of endorsement. |
| **Safety and liability.** The product encourages in-person meetups with strangers and creates opportunities for scams. | Medium | Reporting and moderation in Release 1; suggested safe on-campus meetup points; no in-app payments. |
| **Privacy obligations.** Student names, programs, and messages are personal information under PIPEDA/FIPPA. | Medium | Collect the minimum; no third-party ad or analytics trackers; documented retention and deletion. |
| **No revenue model.** Nothing funds hosting past the free tiers. | Low (in term) | Out of scope for Release 1; note as a future consideration. |

### 5.2 Technical

| Risk | Impact | Mitigation |
|---|---|---|
| **New stack.** If any part of the stack is new to the team, the first sprint is spent learning rather than delivering. | High | Pick the stack the team already knows (see §7). Sprint 0 is explicitly a spike, not a delivery sprint. |
| **Email verification depends on an external domain.** Deliverability to `@fanshaweonline.ca` may be filtered or blocked. | High | Use a reputable transactional email provider; build a manual admin override so a demo never dies on an undelivered code. |
| **Real-time messaging.** Sockets, reconnection, and message ordering are a common source of late-semester failure. | Medium | Ship messaging as plain request/response with polling first; upgrade to sockets only if sprints 1–3 land on time. |
| **Image storage.** Uploads break free-tier limits and slow down page loads. | Medium | Offload to a managed image service; cap at 6 images × 5 MB per listing; resize on upload. |
| **Free-tier hosting.** Cold starts and connection limits make demos look broken. | Medium | Warm the service before the demo; rehearse on the real deployment, never on localhost. |
| **Team of three, no shared codebase history.** Merge conflicts and inconsistent conventions. | Medium | Trunk-based with short-lived branches, PR review required, linter and formatter enforced in CI from day one. |
| **Single point of failure.** One person owns a subsystem and drops the course or gets sick. | Medium | Each module has a named backup; no undocumented local setup steps. |

---

## 7. Section 8 — Non-Functional Requirements

Write these as measurable facts, not wishes.

1. Only addresses on the Fanshawe student email domain may complete registration; an account cannot post, message, or RSVP until the address is verified.
2. Passwords are stored as salted hashes (bcrypt, cost ≥ 12). Plaintext passwords are never logged or persisted.
3. All traffic is served over HTTPS; session tokens expire after 7 days of inactivity.
4. Listing and event pages load in under 2 seconds on campus Wi-Fi; keyword search returns in under 1 second against a catalogue of 10,000 listings.
5. The interface is responsive and usable from 360 px to 1920 px viewport width.
6. The system supports 500 concurrent authenticated users without degradation.
7. Colour contrast and keyboard navigation meet WCAG 2.1 Level AA.
8. Images are limited to 5 MB and 6 per listing, and are automatically resized on upload.
9. Listings and lost & found posts are auto-archived 90 days after creation.
10. Every moderation action records the administrator, the target, the reason, and the timestamp in an audit log.
11. The application supports the two most recent versions of Chrome, Edge, Safari, and Firefox.
12. A user can request deletion of their account and personal data, which removes their profile and listings within 30 days.

---

## 8. Technical plan

### 8.1 Stack

**First check whether INFO-5103 mandates a stack.** If it does, that decision is made and the
rest of this section is reference only. If it doesn't, pick what you have already shipped —
you have built an e-commerce platform and a real-time chat app, and CampusHub is those two
things wearing a Fanshawe lanyard.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, Tailwind | Fast, familiar, one build tool |
| Backend | Node + Express + TypeScript | Shares language and types with the frontend |
| ORM | Prisma | Migrations are reviewable in PRs |
| Database | PostgreSQL (Neon or Supabase free tier) | Relational data, real full-text search |
| Auth | Own JWT + email OTP | Verification logic must be yours; it's the differentiator |
| Email | Resend or SendGrid | Free tier covers a class project |
| Images | Cloudinary free tier | Resize and CDN for free |
| Hosting | Vercel (web) + Render (API) | Both already in your toolchain |
| CI | GitHub Actions: lint, typecheck, test on every PR | Cheap insurance against merge chaos |

Realtime is deliberately absent. Add Socket.IO in sprint 4 **only if** sprints 1–3 closed on
schedule.

### 8.2 Data model (first cut)

```
User            id, email, emailVerifiedAt, passwordHash, role, status, createdAt
Profile         userId → User, displayName, program, yearOfStudy, bio, avatarUrl, interests[]
Category        id, name, slug
Listing         id, sellerId → User, categoryId, title, description, priceCents,
                condition, status(active|sold|removed), createdAt, archivedAt
ListingImage    id, listingId, url, sortOrder
Conversation    id, listingId (nullable), createdAt
Participant     conversationId, userId            -- composite PK
Message         id, conversationId, senderId, body, sentAt, readAt
LostFoundPost   id, authorId, kind(lost|found), title, description, location,
                occurredOn, imageUrl, status(open|resolved), createdAt
Event           id, organizerId, title, description, startsAt, endsAt, location,
                imageUrl, status
Rsvp            eventId, userId, respondedAt      -- composite PK
Report          id, reporterId, targetType, targetId, reason, createdAt, status
ModerationAction id, adminId, reportId, action, note, createdAt
```

Notes:
- Store money as integer cents. Never floats.
- `targetType` + `targetId` keeps one reports table across listings, posts, events, and users.
- Add a full-text index on `Listing.title` + `Listing.description` in the migration, not later.

### 8.3 Repo layout

```
campushub/
├─ apps/
│  ├─ web/          React + Vite
│  └─ api/          Express + Prisma
├─ packages/
│  └─ shared/       shared TypeScript types (API contracts)
├─ docs/
│  ├─ CAMPUSHUB_PLAN.md    ← this file
│  ├─ vision.md            ← plain-text mirror of the Word doc
│  └─ adr/                 ← one short file per notable decision
├─ .github/workflows/ci.yml
└─ README.md
```

---

## 9. Schedule

| Sprint | Dates | Goal | Points |
|---|---|---|---|
| **0** | Sep 18 – Sep 27 | Vision doc finalised and submitted. Repo, CI, Prisma schema, deploy a "hello world" to Vercel + Render so the pipeline is proven before there is anything to break. Spike email delivery to a real Fanshawe address. | — |
| **1** | Sep 28 – Oct 9 | Accounts and verification. Stories 1–5. End state: you can register with a Fanshawe email, verify, log in, and edit a profile. | 16 |
| **2** | Oct 12 – Oct 23 | Marketplace. Stories 6–8, 10. End state: post a listing with images, browse, filter, search, mark sold. | 11 |
| **3** | Oct 26 – Nov 6 | Messaging and Lost & Found. Stories 9, 11–14. | 13 |
| **4** | Nov 9 – Nov 20 | Events and safety. Stories 15–19. | 13 |
| **5** | Nov 23 – Dec 4 | No new features. Accessibility pass, responsive pass, seed data, bug burn-down, demo script, presentation rehearsal on the deployed URL. | — |

Sprint 2 is deliberately light. Sprint 2 is where every student project discovers that
sprint 1 wasn't actually done.

**Definition of done** (agree on this in sprint 0, it ends most arguments):
merged to main · reviewed by one other person · deployed to the shared environment ·
works on a 360 px viewport · no console errors · the acceptance criteria in the story are
demonstrably true on the deployed URL, not on localhost.

---

## 10. This week

1. Rename the docx and strip the template text. — **not done** (docx not in this repo; needs
   whoever holds the Word file).
2. Paste sections 5, 6, 7, 8, 9 from this file into the Word document and reformat into the
   existing tables. — **not done**, same reason.
3. Build the cost estimate in Excel, paste into section 9 as a picture. — **not done**.
4. Refresh fields and the TOC, check the headers and footers separately. — **not done**.
5. Agree the stack in a 30-minute meeting. Write it down as `docs/adr/0001-stack.md`. Do not
   reopen it in week 6. — **drafted**: `docs/adr/0001-stack.md` exists with the §8.1 table as
   `status: proposed`. Team still needs to actually hold the meeting and flip it to `accepted`
   (or amend it) — a doc can't ratify itself.
6. Create the repo, invite all three, protect `main`, add the CI workflow. — **partly done**:
   local repo initialised, monorepo scaffolded, CI workflow added at
   `.github/workflows/ci.yml`. Still needed: push to
   [github.com/Youssefrajeh/Binary-Minds](https://github.com/Youssefrajeh/Binary-Minds),
   invite the other two teammates, and turn on branch protection for `main` in repo settings —
   none of that is possible from a local checkout.
7. Write the Prisma schema from §8.2 and run the first migration. — **schema done**
   (`apps/api/prisma/schema.prisma`, `prisma generate` passes). Migration itself is **not
   run** — needs a real `DATABASE_URL` from a Neon/Supabase project, which is a team decision
   (whose account, which region) not a coding task.
8. Prove one email lands in a real `@fanshaweonline.ca` inbox. — **not done**. The send path
   is scaffolded (`apps/api/src/lib/email.ts`, `otp.ts`, dev-mode console fallback when no API
   key is set) but sending a real email needs a Resend/SendGrid account and a real inbox to
   check, both outside what a coding session can do alone.

See §11 for exactly what was built and what to do next.

---

## 11. Progress log

**2026-09-17 — Sprint 0 scaffolding pass.** What actually shipped, code-side, so far:

- Repo initialised (git) and laid out per §8.3: `apps/web`, `apps/api`, `packages/shared`,
  `docs/`, `.github/workflows/`. This plan moved to `docs/CAMPUSHUB_PLAN.md`.
- `apps/api`: Express + TypeScript, `/health` route, Prisma schema matching §8.2 exactly
  (all 12 models, enums for role/status/listing status/lost-found kind/event status/report
  target type), `.env.example` with every var NFR 1–3 implies. `prisma generate` passes;
  `npm run build`/`typecheck` pass. OTP + email-send helpers scaffolded
  (`src/lib/otp.ts`, `src/lib/email.ts`) with a console-log dev-mode fallback so the API runs
  with zero external accounts configured.
- `apps/web`: Vite + React 19 + TypeScript scaffold via `npm create vite`, Tailwind v4 wired
  through `@tailwindcss/vite` (not a config file — v4 style), dev proxy `/api` → `:4000`.
  Landing page replaced with a CampusHub placeholder that calls `/api/health` and shows live
  status. `npm run build`/`typecheck` pass.
- `packages/shared`: TypeScript-only package with DTOs for every entity in §8.2
  (`UserDto`, `ListingDto`, `LostFoundPostDto`, `EventDto`, `ReportDto`, etc.) so web and api
  share one set of API contract types, per §8.3's stated purpose for this package.
- Root `npm` workspaces wired up; `npm install`, `npm run build`, `npm run typecheck`,
  `npm run lint`, `npm test` all run cleanly across every workspace from the repo root.
- Smoke-tested end to end locally: built API served `/health` with a 200 and a real JSON
  body — the "hello world" pipeline sprint 0 asks for, minus the actual Vercel/Render
  deployment (see below).
- `.github/workflows/ci.yml` added: checkout → setup-node → `npm ci` → prisma generate →
  typecheck → lint → build → test, on every push/PR to `main`.
- `docs/adr/0001-stack.md` drafted from §8.1, status `proposed`.

**What's deliberately not done, and why it needs a human/team, not more code:**

- Pushed to `github.com/Youssefrajeh/Binary-Minds` (`main`). Still needed: add the other two
  teammates as collaborators, turn on branch protection for `main` (required PR review,
  required CI check) in the repo's Settings → Branches.
- No live Postgres — `DATABASE_URL` in `.env.example` is a placeholder. Someone needs to spin
  up a Neon or Supabase free-tier project, and the team needs to agree who owns that account.
  Once it exists: `npm run prisma:migrate -w apps/api -- --name init` runs the first migration
  for real.
- No real email sent — `EMAIL_API_KEY` is a placeholder; the API logs the OTP to the console
  instead of sending. Someone needs a Resend (or SendGrid) account and a real
  `@fanshaweonline.ca` inbox to test against. This is explicitly called out in §5.2 as a High
  risk — do it before sprint 1 starts relying on it.
- No deploy to Vercel/Render — needs accounts and project linking, which is an account-owner
  action, not something scriptable from this checkout.
- The Word vision doc (§1) lives outside this repo and wasn't touched — items 1–4 above are
  still open.
- Full-text index on `Listing.title`/`description` (mentioned in §8.2's notes) isn't in the
  Prisma schema yet — Prisma's schema DSL doesn't express Postgres full-text indexes directly;
  it needs a follow-up raw-SQL migration once the DB exists.

**2026-09-17 — Landing page design pass.** Replaced the placeholder health-check page with a
real front end, built one screen at a time per the team's direction (frontend first, features
added incrementally; senior-level visual design, no icon libraries, no seeded/fake data).

- Design direction: leans into the product's own vernacular — campus classifieds, registrar
  paperwork, a rubber ink stamp for "verified student" as the one signature element — rather
  than a generic SaaS template. Paper/ink color system defined as CSS custom properties with a
  `prefers-color-scheme: dark` variant, mapped into Tailwind v4 via `@theme` in
  `apps/web/src/index.css`. Type system: Newsreader (display/serif, italic for the mission
  statement), Source Sans 3 (body), Space Mono (tags, the wordmark, the stamp) — loaded via
  Google Fonts in `apps/web/index.html`.
- New components under `apps/web/src/components/`: `Nav`, `Hero`, `VerifiedStamp`, `Sections`,
  `Footer`. `App.tsx` now composes these instead of the Vite starter template. Removed the
  leftover Vite/React starter assets (`react.svg`, `vite.svg`, `hero.png`) and the dev-only
  "API status" text that was on the old placeholder page — not something a real user should
  see.
- Copy is real, not placeholder: describes the three Release 1 surfaces (Marketplace, Lost &
  Found, Campus Events) in plain, specific language, and the footer states outright that
  CampusHub is unaffiliated with Fanshawe College — directly reflecting the institutional
  branding risk in §5.1.
- Verified in the browser at both the default (desktop) width and a stacked mobile width;
  fixed one real bug along the way (`mix-blend-mode: multiply` on the verification stamp read
  fine on the light background but made the stamp nearly invisible in dark mode — removed the
  blend mode in favor of a plain solid border/text that works in both themes).
- Typechecks clean (`npm run typecheck -w apps/web`). Not yet wired to any backend call —
  the "Join with your Fanshawe email" button doesn't do anything yet.

**Next screen:** the registration form (Story 1 — Fanshawe email + password), same
one-screen-at-a-time approach. Wiring it to a real API call still needs the local dev database
decision below to be made first (registration can't actually create a `User` row without one).

**Still blocking real (non-UI) functionality — needs a decision, not more code:**

- **Local dev database.** No Docker or local Postgres on this machine, and `DATABASE_URL` is
  still a placeholder, so nothing can actually be persisted yet. Two options were raised and
  not yet decided: (a) a free Neon/Supabase Postgres project — matches the stack in §8.1/ADR
  0001 exactly, needs someone to create the account and hand over a connection string; or
  (b) a temporary local SQLite database for dev/demo only, which would need `Profile.interests`
  reworked from a Postgres array to a join table (SQLite/Prisma doesn't support array columns),
  to be re-adapted before the real Postgres deploy. Pick one before building registration's
  backend half.
- No real email sent, no Vercel/Render deploy, no Word vision doc edits, no full-text index —
  all still open from the sprint 0 pass above, unchanged.

**Next session should pick up at:** deciding the local dev database (above), then building the
registration screen's backend (Story 1: `POST /auth/register`, Fanshawe-domain check via
`isAllowedDomain`, password hashing, `User` row) and wiring the front end to it, followed by
Story 2 (OTP email verification) using the already-scaffolded `otp.ts`/`email.ts` helpers.
