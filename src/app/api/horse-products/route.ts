import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";
import { productTimeZone, productTodaySql } from "@/lib/product-dates";

function isUuid(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isTenantAvailable(user)) {
    return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const horseId = params.get("horseId");
  const requestedRegistration = params.get("cadastroId");
  const pool = getPool();
  try {
    if (horseId !== null) {
      if (!isUuid(horseId) || !["ADMIN", "CLIENTE", "OPERACIONAL"].includes(user.perfil)) {
        return Response.json({ error: "Cavalo inválido." }, { status: 400 });
      }
      const horse = await pool.query(
        `select id from public.equinos
         where id = $1 and excluido_em is null
           and ($2::boolean or (tenant_id = $3 and criado_por = $4))`,
        [horseId, user.perfil === "ADMIN", user.tenant_id, user.id],
      );
      if (!horse.rowCount) return Response.json({ error: "Cavalo não encontrado." }, { status: 404 });
      const selected = await pool.query(
        `select ep.categoria, p.id as produto_id, p.nome, p.marca, ep.produto_codigo as codigo,
                p.descricao, p.valor::text as valor
         from public.equinos_produtos ep
         join public.equinos e on e.id = ep.equino_id and e.tenant_id = ep.tenant_id
         left join public.produtos p on p.tenant_id = ep.tenant_id
           and p.cadastro_cte_haras_id = ep.produto_cadastro_id
           and p.codigo = ep.produto_codigo
           and (e.created_at at time zone '${productTimeZone}')::date between p.data_inicio and p.data_fim
         where ep.equino_id = $1 order by ep.categoria`,
        [horseId],
      );
      if (new Set(selected.rows.map((item) => item.categoria)).size !== selected.rows.length) {
        return Response.json({ error: "Ajuste o cadastro de produtos." }, { status: 409 });
      }
      return Response.json({ selections: selected.rows });
    }

    if (!user.tenant_id || (user.perfil !== "CLIENTE" && user.perfil !== "OPERACIONAL")) {
      return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
    let registrationId: string | null = null;
    let registrations: { id: string; nome: string; tipo_cadastro: string }[] = [];
    if (user.perfil === "CLIENTE") {
      if (!user.cadastro_cte_haras_id || !user.tipo_cadastro ||
          (requestedRegistration && requestedRegistration !== user.cadastro_cte_haras_id)) {
        return Response.json({ error: "Cadastro CTE/Haras não autorizado." }, { status: 403 });
      }
      registrationId = user.cadastro_cte_haras_id;
    } else {
      const result = await pool.query<{ id: string; nome: string; tipo_cadastro: string }>(
        `select id, nome, tipo_cadastro from public.cadastros_cte_haras
         where tenant_id = $1 order by nome, id`,
        [user.tenant_id],
      );
      registrations = result.rows;
      if (requestedRegistration && !registrations.some((item) => item.id === requestedRegistration)) {
        return Response.json({ error: "Cadastro CTE/Haras não autorizado." }, { status: 403 });
      }
      registrationId = requestedRegistration;
    }
    const products = registrationId
      ? await pool.query(
          `select id, nome, marca, codigo, descricao, valor::text as valor,
                  data_inicio::text as data_inicio, data_fim::text as data_fim,
                  count(*) over (partition by codigo) > 1 as duplicado
           from public.produtos
           where tenant_id = $1 and cadastro_cte_haras_id = $2
             and ${productTodaySql} between data_inicio and data_fim
           order by nome, marca, codigo, data_inicio desc, id`,
          [user.tenant_id, registrationId],
        )
      : { rows: [] };
    return Response.json({ cadastroId: registrationId, registrations, products: products.rows });
  } catch (error) {
    console.error("Falha ao consultar produtos do cavalo:", error);
    return Response.json({ error: "Não foi possível consultar os produtos do cavalo." }, { status: 500 });
  }
}
