import { authorizedCenterUser, isUuid } from "@/lib/center-access";
import { isValidCpfOrCnpj } from "@/lib/brazilian-documents";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

const fields = ["nome", "cnpj_cpf", "endereco", "complemento", "cep", "bairro", "cidade", "estado", "telefone", "nome_vendedor", "telefone_vendedor", "email"] as const;
type SupplierFields = Record<(typeof fields)[number], string>;

function supplierFields(input: Record<string, unknown>): SupplierFields | null {
  const result = {} as SupplierFields;
  for (const field of fields) {
    const value = input[field];
    if (typeof value !== "string" ||
        value.trim().length > (field === "complemento" ? 30 : 200)) return null;
    result[field] = value.trim();
  }
  if (!result.nome ||
      (result.cnpj_cpf && !isValidCpfOrCnpj(result.cnpj_cpf)) ||
      (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))) return null;
  result.cnpj_cpf = result.cnpj_cpf.toUpperCase();
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
    const [suppliers, centers] = await Promise.all([
      pool.query(
        `select f.id, f.cadastro_cte_haras_id, f.nome, f.cnpj_cpf, f.endereco, f.complemento, f.cep,
                f.bairro, f.cidade, f.estado, f.telefone, f.nome_vendedor, f.telefone_vendedor, f.email,
                count(distinct p.codigo)::int as produtos
         from public.fornecedores f
         left join public.produtos p on p.fornecedor_id = f.id
           and p.cadastro_cte_haras_id = f.cadastro_cte_haras_id and p.tenant_id = f.tenant_id
         where ($1::uuid is null or f.cadastro_cte_haras_id = $1)
         group by f.id order by f.nome, f.id`,
        [scope],
      ),
      pool.query(
        `select id, nome, tipo_cadastro from public.cadastros_cte_haras
         where ($1::uuid is null or id = $1) order by nome, id`,
        [scope],
      ),
    ]);
    return Response.json({ suppliers: suppliers.rows, centers: centers.rows });
  } catch (error) {
    console.error("Falha ao consultar fornecedores:", error);
    return Response.json({ error: "Não foi possível consultar os fornecedores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && supplierFields(input);
  const centerId = user.perfil === "ADMIN" ? input?.cadastro_cte_haras_id : user.cadastro_cte_haras_id;
  if (!values || !isUuid(centerId)) return Response.json({ error: "Confira o CTE/Haras e os dados do fornecedor." }, { status: 400 });
  try {
    const result = await getPool().query(
      `insert into public.fornecedores
       (tenant_id, cadastro_cte_haras_id, nome, cnpj_cpf, endereco, complemento, cep, bairro, cidade, estado, telefone, nome_vendedor, telefone_vendedor, email)
       select c.tenant_id, c.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       from public.cadastros_cte_haras c
       where c.id = $1 and ($14::uuid is null or c.tenant_id = $14)
       returning id`,
      [centerId, ...fields.map((field) => values[field]), user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "CTE/Haras não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar fornecedor:", error);
    return Response.json({ error: "Não foi possível cadastrar o fornecedor." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && supplierFields(input);
  if (!input || !isUuid(input.id) || !values) return Response.json({ error: "Confira os dados do fornecedor." }, { status: 400 });
  try {
    const result = await getPool().query(
      `update public.fornecedores
       set nome=$2, cnpj_cpf=$3, endereco=$4, complemento=$5, cep=$6, bairro=$7, cidade=$8,
           estado=$9, telefone=$10, nome_vendedor=$11, telefone_vendedor=$12, email=$13
       where id=$1 and ($14::uuid is null or cadastro_cte_haras_id=$14)
         and ($15::uuid is null or tenant_id=$15)
       returning id`,
      [input.id, ...fields.map((field) => values[field]), user.perfil === "ADMIN" ? null : user.cadastro_cte_haras_id,
        user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id });
  } catch (error) {
    console.error("Falha ao alterar fornecedor:", error);
    return Response.json({ error: "Não foi possível alterar o fornecedor." }, { status: 500 });
  }
}
