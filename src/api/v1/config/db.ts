import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDB(): Promise<PrismaClient> {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
    return prisma;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Database connection failed: ${message}`);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
