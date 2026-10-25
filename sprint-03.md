# CampusHub – Sprint 03 Plan

**Team:** Binary Minds
**Members:** Youssef Rajeh (Front-End Lead), Abdul Maarouf (Scrum Master / Back-End Lead), Urshit Patel (Database, Deployment & Testing)
**Tech Stack:** React, Node.js / Express, MongoDB, hosted on Render
**Sprint Status:** Planned

---

## Sprint Goal

Deliver the core Lost & Found and Campus Events features. Extend the Marketplace so students can manage their own listings, and add content reporting so inappropriate posts can be flagged.

---

## Sprint Backlog Summary

| # | User Story | Feature Area | Status |
|---|------------|--------------|--------|
| US-1 | As a Student, I want to post a lost or found item report with a description, photo, location, and date. | Lost & Found | Planned |
| US-2 | As a Student, I want to search and filter lost-and-found posts by category, location, and date. | Lost & Found | Planned |
| US-3 | As a Student, I want to mark my lost-and-found post as resolved. | Lost & Found | Planned |
| US-4 | As a Student, I want to browse upcoming campus events with their date, time, location, and organizer. | Campus Events | Planned |
| US-5 | As an Event Organizer, I want to create, edit, and cancel campus events. | Campus Events | Planned |
| US-6 | As a Student, I want to edit, mark as sold, or delete my own marketplace listings. | Marketplace | Planned |
| US-7 | As a Student, I want to report an inappropriate listing, post, message, or file. | Moderation | Planned |

---

## User Stories and Tasks

### US-1: Post a Lost / Found Item Report
> As a Student, I want to post a lost or found item report with a description, photo, location, and date.

| Task | Owner | Status |
|------|-------|--------|
| Build lost/found post form | Youssef | Planned |
| Create API for lost/found posts | Abdul | Planned |
| Set up/update LostFoundPost model | Urshit | Planned |
| Connect form to API | Youssef, Abdul | Planned |
| Test creating lost/found posts | Urshit | Planned |

**Acceptance Criteria**
- A logged-in student can submit a post with type (lost/found), description, photo, location, and date.
- Required fields are validated before the post is submitted.
- The new post is saved in MongoDB and appears in the lost & found list.

---

### US-2: Search and Filter Lost & Found Posts
> As a Student, I want to search and filter lost-and-found posts by category, location, and date.

| Task | Owner | Status |
|------|-------|--------|
| Build search and filter UI | Youssef | Planned |
| Create search/filter API logic | Abdul | Planned |
| Set up database queries/indexing | Urshit | Planned |
| Connect filters to backend | Youssef, Abdul | Planned |
| Test category, location, and date filters | Urshit | Planned |

**Acceptance Criteria**
- Students can filter posts by category, location, and date, alone or combined.
- Results update to show only matching posts.
- A clear message appears when no posts match.

---

### US-3: Mark Lost & Found Post as Resolved
> As a Student, I want to mark my lost-and-found post as resolved.

| Task | Owner | Status |
|------|-------|--------|
| Add "Mark as Resolved" button/status UI | Youssef | Planned |
| Create backend update logic | Abdul | Planned |
| Verify status is saved correctly in MongoDB | Urshit | Planned |
| Test resolved/open status changes | Urshit | Planned |

**Acceptance Criteria**
- Only the post owner sees the "Mark as Resolved" option.
- Resolved posts show a clear "Resolved" status.
- The status change is saved and remains after a page refresh.

---

### US-4: Browse Upcoming Campus Events
> As a Student, I want to browse upcoming campus events with their date, time, location, and organizer.

| Task | Owner | Status |
|------|-------|--------|
| Build events list/card page | Youssef | Planned |
| Create API to retrieve upcoming events | Abdul | Planned |
| Verify event data structure/querying | Urshit | Planned |
| Connect events page to API | Youssef, Abdul | Planned |
| Test event browsing and display | Urshit | Planned |

**Acceptance Criteria**
- The events page shows only upcoming events, sorted by date.
- Each event card shows the title, date, time, location, and organizer.
- Cancelled events are not shown as active.

---

### US-5: Create, Edit, and Cancel Campus Events
> As an Event Organizer, I want to create, edit, and cancel campus events.

| Task | Owner | Status |
|------|-------|--------|
| Build event create/edit form | Youssef | Planned |
| Create event management API | Abdul | Planned |
| Update/verify Event model | Urshit | Planned |
| Connect event form to backend | Youssef, Abdul | Planned |
| Test create, edit, and cancel | Urshit | Planned |

**Acceptance Criteria**
- An organizer can create an event with a title, description, date, time, and location.
- Only the event's organizer can edit or cancel it.
- Changes appear right away on the events page.

---

### US-6: Manage My Marketplace Listings
> As a Student, I want to edit, mark as sold, or delete my own marketplace listings.

| Task | Owner | Status |
|------|-------|--------|
| Add edit/sold/delete controls | Youssef | Planned |
| Create backend logic for update/delete/status changes | Abdul | Planned |
| Verify listing updates in MongoDB | Urshit | Planned |
| Test owner permissions and listing changes | Urshit | Planned |

**Acceptance Criteria**
- Only the listing owner sees the edit, mark as sold, and delete controls.
- Sold listings are clearly labelled as sold.
- The user must confirm before a listing is deleted, and it is then removed from the marketplace.

---

### US-7: Report Inappropriate Content
> As a Student, I want to report an inappropriate listing, post, message, or file.

| Task | Owner | Status |
|------|-------|--------|
| Add Report button/form | Youssef | Planned |
| Create report API | Abdul | Planned |
| Set up/verify Report data model | Urshit | Planned |
| Test submitting and saving reports | Urshit | Planned |

**Acceptance Criteria**
- A Report option is available on listings, posts, messages, and files.
- The student picks a reason and can add an optional comment.
- The report is saved with the reporter, the reported item, and a timestamp.

---

## Work Distribution

| Member | Role | Sprint 03 Responsibilities |
|--------|------|-----------------------------|
| Youssef Rajeh | Front-End Lead | Forms, pages, and UI controls for all 7 stories; connects front-end screens to the API with Abdul |
| Abdul Maarouf | Scrum Master / Back-End Lead | APIs and backend logic for all 7 stories; runs sprint ceremonies |
| Urshit Patel | Database, Deployment & Testing | MongoDB models, queries, and indexing; testing for every story; deployment to Render |

---

## Definition of Done

- Code is merged into the main branch on GitHub.
- The feature works end to end (React → Express API → MongoDB).
- All tests for the story pass.
- The feature is deployed and working on Render.
- The ClickUp task is moved to **complete**.

---

## Risks and Notes

- **Photo uploads (US-1):** image storage needs to be decided early, because it affects the form, the API, and the model.
- **Permissions (US-3, US-5, US-6):** owner-only actions must be checked on the backend, not just hidden in the UI.
- **Scope:** this sprint has 7 stories, more than earlier sprints. If time runs short, US-7 (reporting) can move to Sprint 04.
- Sprint retrospective will be submitted in the Excel format used for Sprint 01, with a Miro whiteboard.
