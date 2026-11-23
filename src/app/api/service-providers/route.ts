import { authorizedCenterUser, brazilianStates, isUuid } from "@/lib/center-access";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

const fields = ["nome", "cpf", "rg", "endereco", "complemento", "cep", "bairro", "cidade", "estado", "telefone", "email", "servicos"] as const;
type ProviderFields = Record<Exclude<(typeof fields)[number], "complemento">, string> & { complemento: string | null };

function providerFields(input: Record<string, unknown>): ProviderFields | null {
  const result = {} as ProviderFields;
  for (const field of fields) {
    const value = input[field];
    if (field === "complemento" && value === undefined) {
      result.complemento = null;
      continue;
    }
    if (typeof value !== "string" || value.trim().length > (field === "complemento" ? 30 : field === "servicos" ? 1000 : 200)) return null;
    result[field] = value.trim();
  }
  if (!result.nome || (result.estado && !brazilianStates.has(result.estado)) ||
      (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))) return null;
  return result;
}

async function readInput(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const input: unknown = await request.json();
    return typeof input === "object" && input !== null && !Array.isArray(input)
      ? input as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const scope = user.perfil === "ADMIN" ? null : user.cadastro_cte_haras_id;
    const pool = getPool();
    const [providers, centers] = await Promise.all([
      pool.query(
        `select p.id, p.cadastro_cte_haras_id, p.nome, p.cpf, p.rg, p.endereco, p.complemento, p.cep,
                p.bairro, p.cidade, p.estado, p.telefone, p.email, p.servicos, c.nome as cadastro_nome
         from public.prestadores_servicos p
         join public.cadastros_cte_haras c on c.id = p.cadastro_cte_haras_id and c.tenant_id = p.tenant_id
         where ($1::uuid is null or p.cadastro_cte_haras_id = $1)
         order by c.nome, p.nome, p.id`,
        [scope],
      ),
      pool.query(
        `select id, nome, tipo_cadastro from public.cadastros_cte_haras
         where ($1::uuid is null or id = $1) order by nome, id`,
        [scope],
      ),
    ]);
    return Response.json({ providers: providers.rows, centers: centers.rows });
  } catch (error) {
    console.error("Falha ao consultar prestadores:", error);
    return Response.json({ error: "Não foi possível consultar os prestadores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && providerFields(input);
  const centerId = user.perfil === "ADMIN" ? input?.cadastro_cte_haras_id : user.cadastro_cte_haras_id;
  if (!values || !isUuid(centerId)) return Response.json({ error: "Confira o CTE/Haras e os dados do prestador." }, { status: 400 });
  try {
    const result = await getPool().query(
      `insert into public.prestadores_servicos
       (tenant_id, cadastro_cte_haras_id, nome, cpf, rg, endereco, complemento, cep, bairro, cidade, estado, telefone, email, servicos)
       select c.tenant_id, c.id, $2, $3, $4, $5, coalesce($6, ''), $7, $8, $9, $10, $11, $12, $13
       from public.cadastros_cte_haras c
       where c.id = $1 and ($14::uuid is null or c.tenant_id = $14)
       returning id`,
      [centerId, ...fields.map((field) => values[field]), user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "CTE/Haras não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar prestador:", error);
    return Response.json({ error: "Não foi possível cadastrar o prestador." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && providerFields(input);
  if (!input || !isUuid(input.id) || !values) return Response.json({ error: "Confira os dados do prestador." }, { status: 400 });
  try {
    const result = await getPool().query(
      `update public.prestadores_servicos
       set nome=$2, cpf=$3, rg=$4, endereco=$5, complemento=coalesce($6, complemento),
           cep=$7, bairro=$8, cidade=$9, estado=$10, telefone=$11, email=$12, servicos=$13
       where id=$1 and ($14::uuid is null or cadastro_cte_haras_id=$14)
         and ($15::uuid is null or tenant_id=$15)
       returning id`,
      [input.id, ...fields.map((field) => values[field]), user.perfil === "ADMIN" ? null : user.cadastro_cte_haras_id,
        user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "Prestador não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id });
  } catch (error) {
    console.error("Falha ao alterar prestador:", error);
    return Response.json({ error: "Não foi possível alterar o prestador." }, { status: 500 });
  }
}
