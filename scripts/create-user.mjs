import { hash } from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const required = [
  "DATABASE_URL",
  "USER_NAME",
  "USER_EMAIL",
  "USER_PASSWORD",
  "USER_TENANT_ID",
  "USER_ROLE",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Defina ${name} no arquivo .env.local.`);
  }
}

if (process.env.USER_PASSWORD.length < 12) {
  throw new Error("USER_PASSWORD deve ter pelo menos 12 caracteres.");
}
if (process.env.USER_ROLE !== "ADMIN" && process.env.USER_ROLE !== "OPERACIONAL") {
  throw new Error("USER_ROLE deve ser ADMIN ou OPERACIONAL.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const email = process.env.USER_EMAIL.trim().toLowerCase();
  const tenant = await pool.query(
    `select id from public.tenants
     where id = $1 and status_assinatura in ('TRIAL', 'ATIVO')`,
    [process.env.USER_TENANT_ID],
  );
  if (!tenant.rowCount) {
    throw new Error("Tenant não encontrado ou bloqueado.");
  }

  const passwordHash = await hash(process.env.USER_PASSWORD, 12);
  const result = await pool.query(
    `insert into public.usuarios (tenant_id, nome, email, senha_hash, perfil)
     values ($1, $2, $3, $4, $5)
     on conflict (email) do nothing
     returning id`,
    [
      process.env.USER_TENANT_ID,
      process.env.USER_NAME.trim(),
      email,
      passwordHash,
      process.env.USER_ROLE,
    ],
  );
  if (!result.rowCount) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }
  console.log(`Usuário ${email} criado com perfil ${process.env.USER_ROLE}.`);
} catch (error) {
  console.error("Falha ao criar usuário:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
