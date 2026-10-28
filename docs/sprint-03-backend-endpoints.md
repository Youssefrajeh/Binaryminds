# Sprint 03 – Backend Endpoints Needed by the Front End

The Sprint 03 screens (Lost & Found, Events, Marketplace owner controls, Reporting) call the
endpoints below. The front end keeps every URL in one service file per feature under
`apps/web/src/services/`, so a path change only needs updating there.

**Conventions (same as the existing `/listings` routes)**

- Every route uses `requireAuth`.
- Errors are returned as `{ "error": string }`.
- `400` for validation errors, `403` when the user is not allowed (for example, not the owner),
  `404` when the item does not exist.
- Paged lists return a plain array and set the `X-Has-More: true|false` header.
- The new routers must be mounted in `apps/api/src/app.ts` next to `listingsRouter`.

---

## Schema changes

| Model | Change | Why |
|-------|--------|-----|
| `LostFoundPost` | Add `category String` | Category filter (US-2) |
| `Report` | Add `details String?` | Optional comment on a report (US-7) |
| `ReportTargetType` | Add `FILE` | Files can be reported (US-7) |
| `Event` | Create events with `status: PUBLISHED` (default is `DRAFT`) | Drafts never show on the events page |

---

## Lost & Found

**Service file:** `apps/web/src/services/lostFoundService.ts`

### `POST /api/lost-found`

Creates a post for the logged-in user.

Request body:

| Field | Type | Rules |
|-------|------|-------|
| `kind` | `"LOST" \| "FOUND"` | Required |
| `title` | string | 1–100 characters |
| `description` | string | 1–2000 characters |
| `category` | `"ELECTRONICS" \| "ID_CARDS" \| "KEYS" \| "CLOTHING" \| "BAGS" \| "BOOKS" \| "OTHER"` | Required |
| `location` | string | 1–120 characters |
| `occurredOn` | string `YYYY-MM-DD` | Required, not in the future |
| `imageUrl` | string \| null | JPEG, PNG or WebP data URL, max 2 MB (same rule as listing photos) |

Response `201`: the created post, including
`author: { id, profile: { displayName, avatarUrl } }`.

### `GET /api/lost-found`

Query parameters (all optional, combinable):

| Param | Meaning |
|-------|---------|
| `search` | Case-insensitive match on title or description |
| `kind` | `LOST` or `FOUND` |
| `category` | One of the category values above |
| `location` | Case-insensitive "contains" match |
| `from`, `to` | `YYYY-MM-DD`, inclusive bounds on `occurredOn` |
| `page` | 1-based, 12 posts per page |

Response `200`: array of posts (open and resolved), newest first, each including `author`.
Set the `X-Has-More` header.

### `PATCH /api/lost-found/:id/resolve`

Owner only (`403` otherwise). Sets `status` to `RESOLVED`.

Response `200`: the updated post.

---

## Events

**Service file:** `apps/web/src/services/eventService.ts`

### `GET /api/events`

Response `200`: events with `status: PUBLISHED` and `endsAt` in the future, sorted by
`startsAt` ascending. Each event includes `organizer: { id, profile: { displayName } }`.

### `GET /api/events/:id`

Response `200`: one event in any status, including `organizer`.

### `POST /api/events`

Only users with role `ORGANIZER` or `ADMINISTRATOR` (`403` otherwise).
`organizerId` comes from the token. Save with `status: PUBLISHED`.

Request body:

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | 1–120 characters |
| `description` | string | 1–2000 characters |
| `startsAt` | ISO 8601 date-time | In the future |
| `endsAt` | ISO 8601 date-time | After `startsAt` |
| `location` | string | 1–120 characters |

Response `201`: the created event.

### `PUT /api/events/:id`

Organizer only (`403` otherwise). Same body and rules as `POST`.
Return `400` if the event is cancelled.

Response `200`: the updated event.

### `PATCH /api/events/:id/cancel`

Organizer only (`403` otherwise). Sets `status` to `CANCELLED`.

Response `200`: the updated event.

---

## Marketplace listings

**Service file:** `apps/web/src/services/listingService.ts`

### Changes to existing routes

| Route | Change |
|-------|--------|
| `GET /api/listings` | Return `SOLD` listings as well as `ACTIVE` (`status: { in: ["ACTIVE", "SOLD"] }`) so the "Sold" badge can show. Each item must include `status`. |
| `GET /api/listings/:id` | Return `SOLD` listings too. Only `REMOVED` or missing listings should return `404`. |

### `PUT /api/listings/:id`

Owner only (`403` otherwise). Same body and validation as `POST /api/listings`.
The `images` array replaces the listing's existing photos (it contains the photos the owner
kept plus any new ones, in display order).

Response `200`: the updated listing.

### `PATCH /api/listings/:id/sold`

Owner only (`403` otherwise). Sets `status` to `SOLD`.

Response `200`: the updated listing.

### `DELETE /api/listings/:id`

Owner only (`403` otherwise).

Response `204`. Suggested: set `status` to `REMOVED` instead of deleting the row, because
conversations reference `listingId`.

---

## Reports

**Service file:** `apps/web/src/services/reportService.ts`

### `POST /api/reports`

`reporterId` comes from the token; `createdAt` is the timestamp.

Request body:

| Field | Type | Rules |
|-------|------|-------|
| `targetType` | `"LISTING" \| "LOST_FOUND_POST" \| "MESSAGE" \| "FILE"` | Required |
| `targetId` | string | Required |
| `reason` | `"SPAM" \| "SCAM" \| "INAPPROPRIATE" \| "HARASSMENT" \| "PROHIBITED_ITEM" \| "OTHER"` | Required |
| `details` | string | Optional, max 500 characters (omitted when empty) |

Response `201`: `{ "id": string, "createdAt": string }`.

Optional: return `404` when the target does not exist, and `409` when the same user already
reported the same item.
