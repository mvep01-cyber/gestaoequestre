import "server-only";
import { getSession } from "@/lib/auth";
import { getPool, isDatabaseConfigured } from "@/lib/db";

export type CurrentUser = {
  id: string;
  tenant_id: string | null;
  cadastro_cte_haras_id: string | null;
  nome: string;
  perfil: "SUPER_ADMIN" | "ADMIN" | "OPERACIONAL" | "CLIENTE";
  tenant_nome: string | null;
  plano: "CTE" | "HARAS" | null;
  status_assinatura: "TRIAL" | "ATIVO" | "BLOQUEADO" | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const result = await getPool().query<CurrentUser>(
    `select
       u.id,
       u.tenant_id,
       u.cadastro_cte_haras_id,
       u.nome,
       u.perfil,
       t.nome as tenant_nome,
       t.plano,
       t.status_assinatura
     from public.usuarios as u
     left join public.tenants as t on t.id = u.tenant_id
     where u.id = $1
     limit 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export function isTenantAvailable(user: CurrentUser) {
  return (
    user.perfil === "SUPER_ADMIN" ||
    user.status_assinatura === "TRIAL" ||
    user.status_assinatura === "ATIVO"
  );
}
