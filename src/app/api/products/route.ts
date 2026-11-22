import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";
import { productTodaySql } from "@/lib/product-dates";

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function text(value: unknown, maximum: number, required = false): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length <= maximum && (!required || result.length > 0) ? result : null;
}

function money(value: unknown): string | null {
  const amount = typeof value === "string" ? value.trim() : "";
  return /^\d{1,10}(\.\d{1,2})?$/.test(amount) ? amount : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function authorizedUser() {
  const user = await getCurrentUser();
  if (!user || !isTenantAvailable(user)) return null;
  if (user.perfil === "ADMIN") return user;
  if (user.perfil === "CLIENTE" && user.tenant_id && user.cadastro_cte_haras_id && user.tipo_cadastro) return user;
  return null;
}

export async function GET() {
  const user = await authorizedUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const result = await getPool().query(
      `select p.id, p.nome, p.codigo, p.marca, p.fabricante, p.descricao,
              p.valor::text as valor, p.data_inicio::text as data_inicio,
              p.data_fim::text as data_fim, c.nome as cadastro_nome, c.tipo_cadastro
       from public.produtos p
       join public.cadastros_cte_haras c on c.id = p.cadastro_cte_haras_id and c.tenant_id = p.tenant_id
       where ($1::uuid is null or p.cadastro_cte_haras_id = $1)
       order by c.nome, p.codigo, p.data_inicio desc`,
      [user.perfil === "ADMIN" ? null : user.cadastro_cte_haras_id],
    );
    const dates = await getPool().query<{ hoje: string; amanha: string }>(
      `select (${productTodaySql})::text as hoje, (${productTodaySql} + 1)::text as amanha`,
    );
    return Response.json({ products: result.rows, ...dates.rows[0] });
  } catch (error) {
    console.error("Falha ao consultar produtos:", error);
    return Response.json({ error: "Não foi possível consultar os produtos. Verifique a configuração do banco de dados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedUser();
  if (!user || user.perfil !== "CLIENTE" || !user.tenant_id || !user.cadastro_cte_haras_id) {
    return Response.json({ error: "Somente CTE/Haras pode cadastrar produtos." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const nome = text(input.nome, 200, true);
  const codigo = text(input.codigo, 100, true);
  const marca = text(input.marca, 200);
  const fabricante = text(input.fabricante, 200);
  const descricao = text(input.descricao, 2000);
  const valor = money(input.valor);
  if (!nome || !codigo || marca === null || fabricante === null || descricao === null ||
      valor === null ||
      !isDate(input.data_inicio) || !isDate(input.data_fim) || input.data_inicio > input.data_fim) {
    return Response.json({ error: "Confira os dados, o valor e as datas de vigência do produto." }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${user.cadastro_cte_haras_id}:${codigo}`]);
    const previous = await client.query<{ id: string; nome: string; marca: string; fabricante: string; data_inicio: string; hoje: string; amanha: string }>(
      `select id, nome, marca, fabricante, data_inicio::text as data_inicio, (${productTodaySql})::text as hoje,
              (${productTodaySql} + 1)::text as amanha
       from public.produtos
       where cadastro_cte_haras_id = $1 and codigo = $2
       order by data_inicio desc limit 1 for update`,
      [user.cadastro_cte_haras_id, codigo],
    );
    const last = previous.rows[0];
    if (last && last.data_inicio > last.hoje) {
      await client.query("rollback");
      return Response.json({ error: "A última vigência ainda não começou. Aguarde seu início para cadastrar outra versão." }, { status: 409 });
    }
    if (last) {
      await client.query(`update public.produtos set data_fim = ${productTodaySql} where id = $1`, [last.id]);
    }
    const result = await client.query(
      `insert into public.produtos
       (tenant_id, cadastro_cte_haras_id, criado_por, nome, codigo, marca, fabricante, descricao, valor, data_inicio, data_fim)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date)
       returning id`,
      [user.tenant_id, user.cadastro_cte_haras_id, user.id, last ? last.nome : nome, codigo,
        last ? last.marca : marca, last ? last.fabricante : fabricante, descricao, valor,
        last ? last.amanha : input.data_inicio, last ? "9999-12-31" : input.data_fim],
    );
    await client.query("commit");
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    console.error("Falha ao cadastrar produto:", error);
    return Response.json({ error: "Não foi possível cadastrar o produto." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedUser();
  if (!user || user.perfil !== "CLIENTE" || !user.tenant_id || !user.cadastro_cte_haras_id) {
    return Response.json({ error: "Somente CTE/Haras pode alterar produtos." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const descricao = text(input.descricao, 2000);
  const valor = money(input.valor);
  if (!isUuid(input.id) ||
      descricao === null || valor === null ||
      Object.keys(input).some((key) => key !== "id" && key !== "descricao" && key !== "valor")) {
    return Response.json({ error: "Informe uma descrição e um valor válidos." }, { status: 400 });
  }
  try {
    const result = await getPool().query(
      `update public.produtos
       set descricao = $1, valor = $2
       where id = $3 and tenant_id = $4 and cadastro_cte_haras_id = $5
         and data_inicio > ${productTodaySql} and data_fim = '9999-12-31'::date
       returning id`,
      [descricao, valor, input.id, user.tenant_id, user.cadastro_cte_haras_id],
    );
    if (!result.rowCount) {
      return Response.json({ error: "Produto não encontrado ou não disponível para alteração." }, { status: 404 });
    }
    return Response.json({ id: result.rows[0].id });
  } catch (error) {
    console.error("Falha ao alterar produto:", error);
    return Response.json({ error: "Não foi possível alterar o produto." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedUser();
  if (!user || user.perfil !== "CLIENTE" || !user.tenant_id || !user.cadastro_cte_haras_id) {
    return Response.json({ error: "Somente CTE/Haras pode excluir produtos." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body) ||
      !("id" in body) || !isUuid(body.id)) {
    return Response.json({ error: "Produto inválido." }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const lookup = await client.query<{ codigo: string }>(
      `select codigo from public.produtos
       where id = $1 and tenant_id = $2 and cadastro_cte_haras_id = $3`,
      [body.id, user.tenant_id, user.cadastro_cte_haras_id],
    );
    if (!lookup.rowCount) {
      await client.query("rollback");
      return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    }
    const codigo = lookup.rows[0].codigo;
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${user.cadastro_cte_haras_id}:${codigo}`]);
    const target = await client.query(
      `select id from public.produtos p
       where p.id = $1 and p.tenant_id = $2 and p.cadastro_cte_haras_id = $3
         and p.codigo = $4 and p.data_inicio > ${productTodaySql}
         and p.data_fim = '9999-12-31'::date
       for update`,
      [body.id, user.tenant_id, user.cadastro_cte_haras_id, codigo],
    );
    if (!target.rowCount) {
      await client.query("rollback");
      return Response.json({ error: "Produto não encontrado ou não disponível para exclusão." }, { status: 404 });
    }
    await client.query("delete from public.produtos where id = $1", [body.id]);
    const remaining = await client.query<{ id: string }>(
      `select id
       from public.produtos
       where tenant_id = $1 and cadastro_cte_haras_id = $2 and codigo = $3
       order by data_inicio desc limit 1 for update`,
      [user.tenant_id, user.cadastro_cte_haras_id, codigo],
    );
    if (remaining.rows[0]) {
      await client.query("update public.produtos set data_fim = '9999-12-31'::date where id = $1", [remaining.rows[0].id]);
    }
    await client.query("commit");
    return Response.json({ deleted: true, reactivated: remaining.rowCount === 1 });
  } catch (error) {
    await client.query("rollback");
    console.error("Falha ao excluir produto:", error);
    return Response.json({ error: "Não foi possível excluir o produto." }, { status: 500 });
  } finally {
    client.release();
  }
}
