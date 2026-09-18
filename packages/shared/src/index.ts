export type Role = "guest" | "student" | "organizer" | "administrator";

export type UserStatus = "pending" | "active" | "suspended";

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface ProfileDto {
  userId: string;
  displayName: string;
  program: string | null;
  yearOfStudy: number | null;
  bio: string | null;
  avatarUrl: string | null;
  interests: string[];
}

export type ListingStatus = "active" | "sold" | "removed";

export interface ListingDto {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  priceCents: number;
  condition: string;
  status: ListingStatus;
  images: string[];
  createdAt: string;
  archivedAt: string | null;
}

export type LostFoundKind = "lost" | "found";
export type LostFoundStatus = "open" | "resolved";

export interface LostFoundPostDto {
  id: string;
  authorId: string;
  kind: LostFoundKind;
  title: string;
  description: string;
  location: string;
  occurredOn: string;
  imageUrl: string | null;
  status: LostFoundStatus;
  createdAt: string;
}

export interface EventDto {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  imageUrl: string | null;
  status: "draft" | "published" | "cancelled";
}

export type ReportTargetType = "listing" | "lostFoundPost" | "event" | "user" | "message";

export interface ReportDto {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: "open" | "actioned" | "dismissed";
  createdAt: string;
}

export interface ApiError {
  message: string;
  code?: string;
}
