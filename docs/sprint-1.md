# Sprint 1 — Accounts & Verification (Stories 1–5)

**Sprint dates:** Sep 28 – Oct 9  
**Points committed:** 16  
**Status:** Complete ✅ (final version — includes frontend redesign, dark mode, live email delivery, password strength enforcement, and deployment on Render)

---

## Stories Delivered

| # | As a | I want to | Points | Status |
|---|---|---|---|---|
| 1 | Guest | Register using my Fanshawe email address | 5 | ✅ Done |
| 2 | Guest | Confirm my account with a code sent to that email | 3 | ✅ Done |
| 3 | Student | Log in and log out securely | 3 | ✅ Done |
| 4 | Student | Reset a forgotten password | 2 | ✅ Done |
| 5 | Student | Create and edit a profile with my program, year, and interests | 3 | ✅ Done |

---

## What Was Built

### Backend (`apps/api`)

**New files:**
- `src/routes/auth.ts` — Auth endpoints: register, verify OTP, login, logout, forgot-password, reset-password
- `src/routes/profile.ts` — Profile endpoints: GET and PUT `/profile/me`
- `src/routes/health.ts` — Health check endpoint
- `src/lib/prisma.ts` — Singleton Prisma client
- `src/lib/jwt.ts` — JWT sign/verify helpers (7-day expiry)
- `src/lib/otp.ts` — OTP generation utility (6-digit numeric codes)
- `src/lib/email.ts` — Multi-provider email service with three transport tiers (Gmail API → Brevo → Gmail SMTP) and dev-mode console fallback
- `src/lib/email-templates.ts` — Professional HTML email templates for verification and password reset
- `src/middleware/auth.middleware.ts` — Bearer token extraction and verification

**Modified files:**
- `prisma/schema.prisma` — Added `otpHash`, `otpExpiresAt` fields to `User` model; added `PendingRegistration` model for pre-verification storage; full schema for Marketplace, Lost & Found, Events, Messaging, Reports, and Moderation
- `src/index.ts` — Registered auth, profile, and health routers

**Dependencies:** `bcryptjs`, `jsonwebtoken`, `zod`, `nodemailer`

**Key implementation details:**
- Passwords hashed with bcrypt (cost 12) — never stored or logged in plaintext
- OTP codes are also bcrypt-hashed before storage (15-minute expiry)
- Only `@fanshaweonline.ca` emails accepted (enforced on both client and server)
- Forgot-password endpoint returns a constant response to prevent email enumeration
- Registration uses a `PendingRegistration` model — the real `User` record is only created after OTP verification, preventing unverified accounts from polluting the database
- **Multi-provider email delivery** with automatic failover:
  1. **Gmail API (OAuth2 over HTTPS)** — primary provider; uses refresh token to send through the Gmail REST API without SMTP ports
  2. **Brevo (Sendinblue) API** — HTTPS fallback
  3. **Gmail SMTP (Nodemailer)** — traditional SMTP fallback
  4. **Console log** — dev-mode fallback when no credentials are configured
- Professional branded HTML email templates with:
  - CampusHub crimson gradient header with logo
  - Large, monospaced OTP code block (easy to read and copy)
  - Expiry countdown notice
  - Contextual tips (verification) and security warnings (password reset)
  - Full compatibility with Gmail, Outlook, and Apple Mail (inline CSS + table layout)

### Frontend (`apps/web`)

**New files:**
- `src/pages/RegisterPage.tsx` — Registration form with Fanshawe email validation, password strength checklist, and animated password-match indicator
- `src/pages/VerifyPage.tsx` — 6-digit OTP input with auto-advance and paste support
- `src/pages/LoginPage.tsx` — Login form with forgot-password link
- `src/pages/ForgotPasswordPage.tsx` — Email input to request a password reset code
- `src/pages/ResetPasswordPage.tsx` — OTP + new password form
- `src/pages/ProfilePage.tsx` — Profile editor with tag-style interests input
- `src/pages/LandingPage.tsx` — Wrapper for the existing landing page components
- `src/context/AuthContext.tsx` — React context for auth state (token + user in localStorage)
- `src/lib/api.ts` — Axios instance with JWT interceptor
- `src/components/AuthLayout.tsx` — Shared centered-card layout for auth pages
- `src/components/ProtectedRoute.tsx` — Route guard redirecting to /login
- `src/components/Logo.tsx` — CampusHub logo used in the nav, auth pages, and footer
- `src/components/ThemeToggle.tsx` — Light/dark toggle (sun/moon button)
- `src/components/PasswordInput.tsx` — Password field with show/hide toggle (eye icon)
- `src/components/PasswordChecklist.tsx` — Real-time password strength checklist (length, uppercase, number, symbol)

**Modified files:**
- `src/App.tsx` — Added BrowserRouter with all routes
- `src/components/Nav.tsx` — Auth-aware: shows Log in/Sign up for guests, profile/logout for users, plus the theme toggle
- `src/components/Hero.tsx` — Rebuilt hero with a marketplace preview; CTA navigates to /register (guests) or /profile (logged in)
- `src/components/Sections.tsx` — Feature cards for Marketplace, Lost & Found, and Events
- `src/components/Footer.tsx` — Footer with the independent-project disclaimer
- `src/index.css` — Design tokens, shared component classes (`field-input`, `btn-primary`, `btn-secondary`, `alert-error`, `alert-success`, `link`), and password-match keyframe animations
- `index.html` / `public/favicon.svg` — Inter font, pre-paint theme script, CampusHub favicon

**Dependencies:** `react-router`, `axios`

### Shared Types (`packages/shared`)

**New package** — `@campushub/shared` with TypeScript DTOs:
- `RegisterInput`, `LoginInput`, `VerifyOtpInput`, `ForgotPasswordInput`, `ResetPasswordInput`
- `AuthResponse`, `MessageResponse`, `UserDto`, `ProfileDto`, `UpdateProfileInput`
- `ApiErrorResponse`
- `isStrongPassword()` — shared password-strength validator
- `PASSWORD_RULES` — array of rules with `id`, `label`, and `test()` for the frontend checklist

### Database Schema (`prisma/schema.prisma`)

The full Prisma schema includes models for all planned features:

| Model | Purpose | Sprint |
|---|---|---|
| `User` | Student accounts with roles and status | Sprint 1 |
| `PendingRegistration` | Pre-verification OTP storage | Sprint 1 |
| `Profile` | Display name, program, year, bio, interests | Sprint 1 |
| `Category` | Marketplace listing categories | Sprint 2 |
| `Listing` / `ListingImage` | Marketplace listings with photos | Sprint 2 |
| `Conversation` / `Participant` / `Message` | In-app messaging | Sprint 3 |
| `LostFoundPost` | Lost & Found posts | Sprint 3 |
| `Event` / `Rsvp` | Campus events with RSVP | Sprint 4 |
| `Report` / `ModerationAction` | Content moderation | Sprint 4 |

---

## Design

The UI was redesigned after the first pass to look like a conventional product rather than a themed mock-up:
- Neutral surfaces with a single crimson accent; Inter is the only typeface
- Rounded cards, soft shadows, and shared form/button/alert classes so every page matches
- **Dark mode with a toggle:** the palette is driven by a `data-theme` attribute. It follows the OS setting until the user picks a theme, then remembers the choice in `localStorage`. An inline script applies it before first paint to avoid a flash
- Responsive from 360px to 1920px

### UX Enhancements
- **Password strength checklist** — real-time feedback with ✓/○ indicators for each requirement (length, uppercase, number, symbol)
- **Show/hide password toggle** — eye icon on all password fields for easy review
- **Animated password-match indicator** — when the confirm password matches, a green SVG checkmark draws itself in with a shimmer text effect; mismatched passwords show a red border with a gentle hint
- **Browser autofill disabled** on signup — `autoComplete="off"` on email, `autoComplete="new-password"` on password fields to prevent stale data

### Screenshots

| Light | Dark |
|---|---|
| ![Landing, light](images/landing-light.png) | ![Landing, dark](images/landing-dark.png) |
| ![Login, light](images/login-light.png) | ![Login, dark](images/login-dark.png) |

See [walkthrough-sprint-1.md](walkthrough-sprint-1.md) for the full page-by-page walkthrough.

---

## Deployment

- **API + Frontend:** Hosted on [Render](https://render.com) as a single monorepo service
- **Live URL:** `https://campus-hub-229x.onrender.com`
- **Email provider:** Gmail API (OAuth2 over HTTPS) — works on Render's free tier which blocks SMTP ports
- **Database:** MongoDB Atlas (free tier)

---

## Verification

Re-run against the final code:

| Check | Result |
|---|---|
| `tsc --noEmit` (API) | ✅ Pass |
| `tsc` build (API) | ✅ Pass |
| `tsc -b --noEmit` (Web) | ✅ Pass |
| `vite build` (Web) | ✅ Pass |
| Prisma schema pushed to MongoDB Atlas | ✅ Synced |
| Landing page renders (light and dark) | ✅ |
| Nav shows guest/auth state | ✅ |
| Theme toggle switches and persists the theme | ✅ |
| Registration page renders | ✅ |
| Password strength checklist updates in real-time | ✅ |
| Password match animation plays when passwords match | ✅ |
| Non-Fanshawe email rejected (API returns error) | ✅ |
| Login page renders (light and dark) | ✅ |
| Wrong credentials return a generic error | ✅ |
| Forgot password page renders | ✅ |
| `/profile` redirects unauthenticated → `/login` | ✅ |
| `GET /profile/me` without a token returns 401 | ✅ |
| Registration succeeds and issues a verification code | ✅ |
| Verification email delivered to student inbox (Gmail API) | ✅ |
| Password reset email delivered with branded template | ✅ |
| App deployed and accessible on Render | ✅ |

### Known limitations
- No automated test suite exists yet; verification is by typecheck, build, and manual checks.

---

## Next Sprint

**Sprint 2 — Marketplace (Stories 6–8, 10):**
- Post a listing with photos, price, condition, and category
- Browse listings filtered by category and price range
- Search listings by keyword
- Mark a listing as sold
