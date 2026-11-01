import { vi } from "vitest";

/**
 * In-memory stand-in for the Prisma client. Tests import this through
 * `vi.mock("../lib/prisma.js", ...)` and program each call's return value.
 */
export function createPrismaMock() {
  const mock = {
    user: { count: vi.fn().mockResolvedValue(1), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    pendingRegistration: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    profile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    listing: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    event: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    lostFoundPost: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    report: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    moderationAction: { create: vi.fn() },
    $transaction: vi.fn(),
    participant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    conversation: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      groupBy: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
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
  mock.$transaction.mockImplementation((callback) => callback(mock));
  return mock;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
