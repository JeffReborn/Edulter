import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // 在真正运行数据库相关逻辑前，必须配置 DATABASE_URL
  throw new Error(
    "DATABASE_URL is not set. Please configure it in your environment."
  );
}

const adapter = new PrismaPg({ connectionString });

declare global {
  var __prisma__: PrismaClient | undefined;
}

const prismaInstance = globalThis.__prisma__ ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prismaInstance;
}

export const prisma = prismaInstance;

export type DbClient = PrismaClient;

