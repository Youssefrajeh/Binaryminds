import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: npm run admin:bootstrap -w @campushub/api -- verified-student@fanshaweonline.ca");
  if (await prisma.user.count({ where: { role: "ADMINISTRATOR" } })) {
    throw new Error("An administrator already exists. This command is only for initial setup.");
  }
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) throw new Error("Register and verify this account before making it the first administrator.");
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMINISTRATOR" } });
  console.log("Initial administrator assigned. Sign in again or refresh the account session to open Admin users.");
} catch (err) {
  // Avoid printing database connection strings or a full Prisma exception.
  console.error(err instanceof Error && !err.message.includes("prisma.") ? err.message : "Administrator setup failed. Check database access.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
