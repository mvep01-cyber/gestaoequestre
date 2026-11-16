import "server-only";
import { Pool } from "pg";

type GlobalWithPg = typeof globalThis & {
  campovivoPool?: Pool;
};

const globalForPg = globalThis as GlobalWithPg;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não foi definida.");
  }

  if (!globalForPg.campovivoPool) {
    globalForPg.campovivoPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return globalForPg.campovivoPool;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET);
}
