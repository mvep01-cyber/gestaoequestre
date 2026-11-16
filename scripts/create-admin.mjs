import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const required = [
  "DATABASE_URL",
  "INITIAL_ADMIN_NAME",
  "INITIAL_ADMIN_EMAIL",
  "INITIAL_ADMIN_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Defina ${name} no arquivo .env.local.`);
  }
}

if (process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
  throw new Error("INITIAL_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
}

const plan = process.env.INITIAL_PLAN || "CTE";
if (plan !== "CTE" && plan !== "HARAS") {
  throw new Error("INITIAL_PLAN deve ser CTE ou HARAS.");
}
const role = process.env.INITIAL_ADMIN_ROLE || "ADMIN";
if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
  throw new Error("INITIAL_ADMIN_ROLE deve ser ADMIN ou SUPER_ADMIN.");
}
if (role === "ADMIN" && !process.env.INITIAL_TENANT_NAME) {
  throw new Error("Defina INITIAL_TENANT_NAME para criar um administrador de centro.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let transactionStarted = false;

try {
  const email = process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await client.query(
    "select id from public.usuarios where lower(email) = $1",
    [email],
  );
  if (existing.rowCount) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }

  await client.query("begin");
  transactionStarted = true;
  const userId = randomUUID();
  const passwordHash = await hash(process.env.INITIAL_ADMIN_PASSWORD, 12);

  let tenantId = null;
  if (role === "ADMIN") {
    tenantId = randomUUID();
    await client.query(
      `insert into public.tenants (id, nome, plano, status_assinatura)
       values ($1, $2, $3, 'TRIAL')`,
      [tenantId, process.env.INITIAL_TENANT_NAME.trim(), plan],
    );
  }
  await client.query(
    `insert into public.usuarios (id, tenant_id, nome, email, senha_hash, perfil)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      tenantId,
      process.env.INITIAL_ADMIN_NAME.trim(),
      email,
      passwordHash,
      role,
    ],
  );
  await client.query("commit");
  transactionStarted = false;
  console.log(
    role === "ADMIN"
      ? `Administrador criado para o centro "${process.env.INITIAL_TENANT_NAME}".`
      : "Super administrador criado.",
  );
} catch (error) {
  if (transactionStarted) {
    await client.query("rollback");
  }
  console.error("Falha ao criar o administrador inicial:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
