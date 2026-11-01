import type { UserRole, UserStatus } from "./dto.js";

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export interface CampusEventDto {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  endDate?: string | null;
  location: string;
  imageUrl: string | null;
  status: EventStatus;
  organizer?: { id: string; profile?: { displayName: string; avatarUrl?: string | null } | null };
}
export interface EventInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  endDate?: string | null;
  imageUrl?: string | null;
  location: string;
}
export interface AdminUserDto {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  profile: { displayName: string; avatarUrl: string | null } | null;
}
export type AssignableRole = "STUDENT" | "ORGANIZER" | "ADMINISTRATOR";
