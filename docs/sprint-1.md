# Sprint 1 — Accounts & Verification (Stories 1–5)

**Sprint dates:** Sep 28 – Oct 9  
**Points committed:** 16  
**Status:** Complete ✅

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
- `src/lib/prisma.ts` — Singleton Prisma client
- `src/lib/jwt.ts` — JWT sign/verify helpers (7-day expiry)
- `src/middleware/auth.middleware.ts` — Bearer token extraction and verification

**Modified files:**
- `prisma/schema.prisma` — Added `otpHash` and `otpExpiresAt` fields to `User` model
- `src/index.ts` — Registered auth and profile routers

**New dependencies:** `bcryptjs`, `jsonwebtoken`, `zod`

**Key implementation details:**
- Passwords hashed with bcrypt (cost 12) — never stored or logged in plaintext
- OTP codes are also bcrypt-hashed before storage (15-minute expiry)
- Only `@fanshaweonline.ca` emails accepted (enforced on both client and server)
- Forgot-password endpoint returns a constant response to prevent email enumeration
- Email sending falls back to console logging when no `EMAIL_API_KEY` is configured

### Frontend (`apps/web`)

**New files:**
- `src/pages/RegisterPage.tsx` — Registration form with Fanshawe email validation
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

**Modified files:**
- `src/App.tsx` — Added BrowserRouter with all routes
- `src/components/Nav.tsx` — Auth-aware: shows Log in/Sign up for guests, profile/logout for users
- `src/components/Hero.tsx` — CTA navigates to /register (guests) or /profile (logged in)

**New dependencies:** `react-router`, `axios`

### Shared Types (`packages/shared`)

**New package** — `@campushub/shared` with TypeScript DTOs:
- `RegisterInput`, `LoginInput`, `VerifyOtpInput`, `ForgotPasswordInput`, `ResetPasswordInput`
- `AuthResponse`, `MessageResponse`, `UserDto`, `ProfileDto`, `UpdateProfileInput`
- `ApiErrorResponse`

---

## Design

All auth pages follow the existing paper/ink design system:
- Centered card layout with `paper` background and `rule` borders
- `font-display` for headings, `font-body` for form labels
- `bg-pen` / `hover:bg-pen-dark` primary buttons
- `stamp` color for error messages
- Dark mode supported via `prefers-color-scheme`
- Responsive from 360px to 1920px

---

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` (API) | ✅ Pass |
| `npm run typecheck` (Web) | ✅ Pass |
| `npm run build` (API) | ✅ Pass |
| `npm run build` (Web) | ✅ Pass |
| Prisma schema pushed to MongoDB Atlas | ✅ Synced |
| Landing page renders | ✅ |
| Nav shows guest/auth state | ✅ |
| Registration page renders | ✅ |
| Non-Fanshawe email rejected | ✅ |
| Login page renders | ✅ |
| Forgot password page renders | ✅ |
| `/profile` redirects unauthenticated → `/login` | ✅ |

---

## Next Sprint

**Sprint 2 — Marketplace (Stories 6–8, 10):**
- Post a listing with photos, price, condition, and category
- Browse listings filtered by category and price range
- Search listings by keyword
- Mark a listing as sold
