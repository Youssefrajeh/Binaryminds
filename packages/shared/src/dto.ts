/* ------------------------------------------------------------------ */
/*  CampusHub shared DTOs — API contract between web and api          */
/* ------------------------------------------------------------------ */

/* ---- Auth ---- */

export interface RegisterInput {
  email: string;
  password: string;
  /** Must be true: the user accepted the Terms and Conditions */
  acceptTerms: boolean;
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

/** What other students can see about a user */
export interface PublicProfileDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  program: string | null;
  yearOfStudy: number | null;
  bio: string | null;
  interests: string[];
  createdAt: string;
}

export interface UpdateProfileInput {
  displayName: string;
  program?: string | null;
  yearOfStudy?: number | null;
  bio?: string | null;
  interests?: string[];
}

/* ---- Messaging ---- */

export type ConversationType = "DIRECT" | "GROUP";
export type ConversationStatus = "PENDING" | "ACCEPTED";
export type ConversationTab = "inbox" | "requests";

export interface AttachmentDto {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ConversationMemberDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface LastMessageDto {
  text: string;
  senderId: string;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  type: ConversationType;
  /** Group name, or the other person's display name for a DM */
  name: string;
  status: ConversationStatus;
  /** True when someone else started this DM and I have not accepted it yet */
  isRequest: boolean;
  /** I blocked this conversation (it is hidden from my lists) */
  blockedByMe: boolean;
  studyGroupId: string | null;
  members: ConversationMemberDto[];
  lastMessage: LastMessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: AttachmentDto[];
  clientId: string | null;
  createdAt: string;
}

export interface MessagesPageDto {
  messages: MessageDto[];
  hasMore: boolean;
  /** Pass as `before` to load the next (older) page */
  nextCursor: string | null;
}

export interface StartConversationInput {
  recipientId: string;
}

/* ---- Study groups ---- */

export interface StudyGroupDto {
  id: string;
  name: string;
  courseCode: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  /** The group's chat; only returned to members */
  conversationId: string | null;
  createdAt: string;
}

export interface CreateStudyGroupInput {
  name: string;
  courseCode: string;
  description?: string | null;
}

/* ---- API Error ---- */

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
}
