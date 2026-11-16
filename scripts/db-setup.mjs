import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("Defina DATABASE_URL no arquivo .env.local.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  console.log("Esquema PostgreSQL aplicado com sucesso.");
} catch (error) {
  console.error("Falha ao aplicar o esquema PostgreSQL:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
