/* ------------------------------------------------------------------ */
/*  CampusHub shared DTOs — API contract between web and api          */
/* ------------------------------------------------------------------ */

/* ---- Auth ---- */

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface MessageResponse {
  message: string;
}

/* ---- User ---- */

export type UserRole = "STUDENT" | "ORGANIZER" | "ADMINISTRATOR";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  profile: ProfileDto | null;
}

/* ---- Profile ---- */

export interface ProfileDto {
  displayName: string;
  program: string | null;
  yearOfStudy: number | null;
  bio: string | null;
  avatarUrl: string | null;
  interests: string[];
}

export interface UpdateProfileInput {
  displayName: string;
  program?: string | null;
  yearOfStudy?: number | null;
  bio?: string | null;
  interests?: string[];
}

/* ---- API Error ---- */

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
}
