# Sprint 1 — Auth Flow Test Results

All tests passed ✅. Here's what was built and verified:

## Browser Recording

![Auth flow walkthrough](images/auth_flow_test_1789930632009.webp)

## Page Screenshots

### Landing Page
Nav shows **Log in** + **Sign up** for guests. Hero CTA: "Join with your Fanshawe email".

![Landing page](images/landing_page_1789930663478.png)

### Registration Page
Clean form with Fanshawe email, password, and confirm password fields.

![Registration page](images/registration_page_1789930675437.png)

### Email Validation
Non-Fanshawe emails (`@gmail.com`) are rejected client-side with a clear error.

![Registration error](images/registration_error_1789930698504.png)

### Login Page
Email + password with "Forgot password?" link.

![Login page](images/login_page_1789930721735.png)

### Forgot Password Page
Enter email to receive a reset code.

![Forgot password](images/forgot_password_page_1789930731855.png)

### Protected Route Redirect
Navigating to `/profile` while unauthenticated redirects to `/login` ✅

![Profile redirect](images/profile_redirect_to_login_1789930746223.png)

## Test Summary

| Test | Result |
|---|---|
| Landing page renders | ✅ |
| Nav shows guest links (Log in / Sign up) | ✅ |
| Hero CTA links to /register | ✅ |
| Registration page renders | ✅ |
| Non-Fanshawe email rejected | ✅ |
| Login page renders | ✅ |
| Forgot password page renders | ✅ |
| `/profile` redirects to `/login` when unauthenticated | ✅ |
| API typechecks clean | ✅ |
| Web typechecks clean | ✅ |
| API builds clean | ✅ |
| Web builds clean | ✅ |
| Prisma schema pushed to MongoDB Atlas | ✅ |
