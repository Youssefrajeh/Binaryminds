# Sprint 1: Accounts & Verification (Stories 1–5)

Build the registration → email verification → login → profile flow end-to-end. This is the foundation every other feature depends on.

## Current State

**What exists:**
- Monorepo scaffolded: `apps/web` (Vite + React 19 + Tailwind v4), `apps/api` (Express + TS + Prisma)
- Prisma schema with all 12 models targeting MongoDB Atlas — `prisma:push` verified against a live cluster
- Landing page with Nav, Hero, Sections, Footer — static, no routing
- API has `/health` endpoint only
- Helper stubs: `email.ts` (Resend integration with dev-mode console fallback), `otp.ts` (6-digit OTP generator)
- No `packages/shared` directory yet (referenced in `package.json` workspaces but not created)
- No routing, no auth, no state management on the frontend

**What we're building (Stories 1–5, 16 points):**

| Story | Description | Points |
|---|---|---|
| 1 | Register with Fanshawe email | 5 |
| 2 | Confirm account with emailed OTP | 3 |
| 3 | Log in and log out securely | 3 |
| 4 | Reset a forgotten password | 2 |
| 5 | Create and edit profile | 3 |

---

## Open Questions

> [!IMPORTANT]
> **Email provider:** The `.env` has `EMAIL_API_KEY="change-me"`. Do you have a Resend or SendGrid account set up, or should we keep using the dev-mode console fallback for now (OTP printed to terminal)?

> [!IMPORTANT]
> **Routing library:** The web app currently has no router. I'll install **React Router v7** for client-side routing. Is that OK, or do you prefer something else?

> [!NOTE]
> **Password reset flow:** The plan uses the same OTP mechanism as email verification (send a 6-digit code, user enters it). This avoids adding reset-link token logic. OK?

---

## Proposed Changes

### 1. Shared Types Package

#### [NEW] `packages/shared/package.json`
#### [NEW] `packages/shared/src/index.ts`
#### [NEW] `packages/shared/src/dto.ts`
#### [NEW] `packages/shared/tsconfig.json`

Create the `@campushub/shared` package with TypeScript DTOs for the API contract:
- `RegisterInput`, `LoginInput`, `VerifyOtpInput`, `ResetPasswordInput`
- `AuthResponse` (token + user), `UserDto`, `ProfileDto`
- `ApiError` shape

---

### 2. API — Auth Module

#### [NEW] [prisma.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/lib/prisma.ts)
Singleton Prisma client instance.

#### [NEW] [jwt.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/lib/jwt.ts)
JWT sign/verify helpers using `jsonwebtoken`. Token contains `{ userId, role }`, expires in 7 days.

#### [NEW] [auth.middleware.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/middleware/auth.middleware.ts)
Express middleware that extracts and verifies the `Authorization: Bearer <token>` header, attaches `req.user`.

#### [NEW] [auth.routes.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/routes/auth.ts)
Endpoints:
- `POST /auth/register` — validate Fanshawe email domain, hash password (bcrypt, cost 12), create `User` (status: PENDING), generate OTP, store hashed OTP + expiry on User, send verification email (or log to console), return `{ message }`.
- `POST /auth/verify` — accept email + OTP, verify against stored hash, set `emailVerifiedAt`, flip status to ACTIVE, return JWT + user.
- `POST /auth/login` — validate credentials, check account is ACTIVE, return JWT + user.
- `POST /auth/logout` — client-side only (clear token), endpoint returns `{ ok: true }`.
- `POST /auth/forgot-password` — validate email exists, generate OTP, send email.
- `POST /auth/reset-password` — validate email + OTP + new password, update password hash, return JWT.

#### [NEW] [profile.routes.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/routes/profile.ts)
Endpoints (all require auth middleware):
- `GET /profile/me` — return the logged-in user's profile.
- `PUT /profile/me` — update displayName, program, yearOfStudy, bio, interests.

#### [MODIFY] [schema.prisma](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/prisma/schema.prisma)
Add fields to `User` model for OTP verification:
- `otpHash String?`
- `otpExpiresAt DateTime?`

#### [MODIFY] [index.ts](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/api/src/index.ts)
Register the new auth and profile routers.

#### New dependencies for `apps/api`:
- `bcryptjs` (password hashing)
- `jsonwebtoken` (JWT)
- `zod` (input validation)
- `@types/bcryptjs`, `@types/jsonwebtoken` (dev)

---

### 3. Frontend — Routing & Auth Pages

#### Install dependencies for `apps/web`:
- `react-router` (v7)
- `axios` (HTTP client)

#### [MODIFY] [App.tsx](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/web/src/App.tsx)
Add `BrowserRouter` with routes:
- `/` → Landing page (existing components)
- `/register` → Registration page
- `/verify` → OTP verification page
- `/login` → Login page
- `/forgot-password` → Forgot password page
- `/reset-password` → Reset password page
- `/profile` → Profile page (protected)

#### [NEW] `apps/web/src/context/AuthContext.tsx`
React context for auth state: `user`, `token`, `login()`, `logout()`, `isAuthenticated`. Token persisted in `localStorage`.

#### [NEW] `apps/web/src/lib/api.ts`
Axios instance with base URL `/api` and auth interceptor that attaches the JWT.

#### [NEW] `apps/web/src/components/ProtectedRoute.tsx`
Wrapper that redirects unauthenticated users to `/login`.

#### [NEW] `apps/web/src/pages/RegisterPage.tsx`
Form: Fanshawe email + password + confirm password. Client-side validation (must be `@fanshaweonline.ca`). On success → redirect to `/verify`.

#### [NEW] `apps/web/src/pages/VerifyPage.tsx`
6-digit OTP input. On success → redirect to `/` as logged-in user.

#### [NEW] `apps/web/src/pages/LoginPage.tsx`
Email + password form. On success → redirect to `/`.

#### [NEW] `apps/web/src/pages/ForgotPasswordPage.tsx`
Email input → sends OTP → redirect to `/reset-password`.

#### [NEW] `apps/web/src/pages/ResetPasswordPage.tsx`
OTP + new password + confirm. On success → redirect to `/login`.

#### [NEW] `apps/web/src/pages/ProfilePage.tsx`
Protected page. Form to view/edit: display name, program, year of study, bio, interests (tag-style input). Save button calls `PUT /profile/me`.

#### [MODIFY] [Nav.tsx](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/web/src/components/Nav.tsx)
- Show "Log in" / "Sign up" for guests
- Show user display name + "Log out" for authenticated users
- Use `react-router` `Link` components

#### [MODIFY] [Hero.tsx](file:///d:/SEM06/Software%20Project/Binary%20Minds/apps/web/src/components/Hero.tsx)
Wire the "Join with your Fanshawe email" button to navigate to `/register`.

---

### 4. UI Design Direction

All auth pages will follow the existing paper/ink design system:
- Centered card layout with the `paper` background, `rule` border
- `font-display` for headings, `font-body` for form labels/inputs
- `bg-pen` / `hover:bg-pen-dark` for primary buttons
- `stamp` color for error messages and the verified badge
- Form inputs: `border-rule`, `focus:border-pen`, `bg-paper` background
- Subtle transition animations on form state changes
- Mobile-first responsive (works from 360px)

---

## Verification Plan

### Automated Tests
```bash
# TypeScript compiles cleanly across all workspaces
npm run typecheck

# API builds
npm run build -w apps/api

# Web builds
npm run build -w apps/web
```

### Manual Verification
1. Start API (`npm run dev:api`) and Web (`npm run dev:web`)
2. Register with an email → OTP appears in API console
3. Verify with OTP → redirected to home as logged-in user
4. Log out → Nav shows guest state
5. Log in again → works
6. Edit profile → changes persist on refresh
7. Test forgot/reset password flow
8. Test validation: wrong email domain rejected, wrong OTP rejected, weak password rejected
9. Test on mobile viewport (360px)
