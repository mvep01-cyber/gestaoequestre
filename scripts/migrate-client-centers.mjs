import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Defina DATABASE_URL no arquivo .env.local.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const migration = await readFile(
    new URL("../database/migracao-clientes-cte-haras.sql", import.meta.url),
    "utf8",
  );
  await pool.query(migration);
  await pool.query(`
    select p.id, coalesce(p.cadastro_cte_haras_id, creator.cadastro_cte_haras_id),
           c.nome, c.tipo_cadastro
    from public.proprietarios p
    left join public.usuarios creator
      on creator.id = p.criado_por and creator.tenant_id = p.tenant_id
    left join public.cadastros_cte_haras c
      on c.id = coalesce(p.cadastro_cte_haras_id, creator.cadastro_cte_haras_id)
     and c.tenant_id = p.tenant_id
    limit 0
  `);
  console.log("Migração de clientes e CTE/Haras aplicada com sucesso.");
} catch (error) {
  console.error("Falha ao aplicar a migração de clientes e CTE/Haras:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
