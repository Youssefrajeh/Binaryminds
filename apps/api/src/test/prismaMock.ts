import { vi } from "vitest";

/**
 * In-memory stand-in for the Prisma client. Tests import this through
 * `vi.mock("../lib/prisma.js", ...)` and program each call's return value.
 */
export function createPrismaMock() {
  return {
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pendingRegistration: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    profile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    listing: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    participant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    studyGroup: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    studyGroupMember: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
