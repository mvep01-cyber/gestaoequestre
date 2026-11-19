import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const bootstrapUrl =
  process.env.ADMIN_DATABASE_BOOTSTRAP_URL || process.env.DATABASE_URL;

if (!adminDatabaseUrl || !bootstrapUrl) {
  throw new Error(
    "Defina ADMIN_DATABASE_URL e DATABASE_URL (ou ADMIN_DATABASE_BOOTSTRAP_URL) no arquivo .env.local.",
  );
}

function quoteIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error("O nome do banco ou usuário ADMIN contém caracteres inválidos.");
  }
  return `"${value}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const target = new URL(adminDatabaseUrl);
const targetDatabase = decodeURIComponent(target.pathname.slice(1));
const targetUser = decodeURIComponent(target.username);
const targetPassword = decodeURIComponent(target.password);
const bootstrapTarget = new URL(bootstrapUrl);
const bootstrapDatabase = decodeURIComponent(bootstrapTarget.pathname.slice(1));

if (!targetDatabase || !targetUser || !targetPassword) {
  throw new Error(
    "ADMIN_DATABASE_URL deve informar banco, usuário e senha dedicados.",
  );
}
if (
  target.hostname !== bootstrapTarget.hostname ||
  (target.port || "5432") !== (bootstrapTarget.port || "5432")
) {
  throw new Error(
    "O provisionamento local exige que ADMIN_DATABASE_URL e a conexão de bootstrap usem o mesmo servidor PostgreSQL.",
  );
}
if (targetDatabase === bootstrapDatabase) {
  throw new Error("A base financeira ADMIN deve ser diferente da base operacional.");
}

const bootstrapPool = new Pool({
  connectionString: bootstrapUrl,
  connectionTimeoutMillis: 5000,
});
let adminPool;

try {
  const existingRole = await bootstrapPool.query(
    "select 1 from pg_roles where rolname = $1",
    [targetUser],
  );
  const roleStatement = existingRole.rowCount
    ? `alter role ${quoteIdentifier(targetUser)} login password ${quoteLiteral(targetPassword)}`
    : `create role ${quoteIdentifier(targetUser)} login password ${quoteLiteral(targetPassword)}`;
  await bootstrapPool.query(roleStatement);

  const existingDatabase = await bootstrapPool.query(
    "select 1 from pg_database where datname = $1",
    [targetDatabase],
  );
  if (!existingDatabase.rowCount) {
    await bootstrapPool.query(
      `create database ${quoteIdentifier(targetDatabase)} owner ${quoteIdentifier(targetUser)}`,
    );
  } else {
    await bootstrapPool.query(
      `alter database ${quoteIdentifier(targetDatabase)} owner to ${quoteIdentifier(targetUser)}`,
    );
  }

  adminPool = new Pool({
    connectionString: adminDatabaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const schema = await readFile(
    new URL("../database/admin-finance-schema.sql", import.meta.url),
    "utf8",
  );
  await adminPool.query(schema);
  console.log("Base e esquema do Financeiro ADMIN preparados.");
} catch (error) {
  console.error(
    "Falha ao preparar o Financeiro ADMIN:",
    error instanceof Error ? error.message : "erro inesperado",
  );
  process.exitCode = 1;
} finally {
  await adminPool?.end();
  await bootstrapPool.end();
}
