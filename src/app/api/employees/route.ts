import { authorizedCenterUser, brazilianStates, isUuid } from "@/lib/center-access";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

const fields = ["nome", "cpf", "rg", "endereco", "cep", "bairro", "cidade", "estado", "telefone", "email", "cargo", "tipo_contratacao"] as const;
type EmployeeFields = Record<(typeof fields)[number], string> & { valor: string | null };

function employeeFields(input: Record<string, unknown>): EmployeeFields | null {
  const result = {} as EmployeeFields;
  for (const field of fields) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length > 200) return null;
    result[field] = value.trim();
  }
  if (!result.nome || (result.estado && !brazilianStates.has(result.estado)) ||
      (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) ||
      !["", "Diarista", "Mensalista"].includes(result.tipo_contratacao)) return null;
  if (typeof input.valor !== "string") return null;
  const amount = input.valor.trim();
  if (amount && !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) return null;
  result.valor = amount || null;
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
    const [employees, centers] = await Promise.all([
      pool.query(
        `select f.id, f.cadastro_cte_haras_id, f.nome, f.cpf, f.rg, f.endereco, f.cep,
                f.bairro, f.cidade, f.estado, f.telefone, f.email, f.cargo, f.tipo_contratacao, f.valor
         from public.funcionarios f
         join public.cadastros_cte_haras c on c.id = f.cadastro_cte_haras_id and c.tenant_id = f.tenant_id
         where ($1::uuid is null or f.cadastro_cte_haras_id = $1)
         order by c.nome, f.nome, f.id`,
        [scope],
      ),
      pool.query(
        `select id, nome, tipo_cadastro from public.cadastros_cte_haras
         where ($1::uuid is null or id = $1) order by nome, id`,
        [scope],
      ),
    ]);
    return Response.json({ employees: employees.rows, centers: centers.rows });
  } catch (error) {
    console.error("Falha ao consultar funcionários:", error);
    return Response.json({ error: "Não foi possível consultar os funcionários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && employeeFields(input);
  const centerId = user.perfil === "ADMIN" ? input?.cadastro_cte_haras_id : user.cadastro_cte_haras_id;
  if (!values || !isUuid(centerId)) return Response.json({ error: "Confira o CTE/Haras e os dados do funcionário." }, { status: 400 });
  try {
    const result = await getPool().query(
      `insert into public.funcionarios
       (tenant_id, cadastro_cte_haras_id, nome, cpf, rg, endereco, cep, bairro, cidade, estado, telefone, email, cargo, tipo_contratacao, valor)
       select c.tenant_id, c.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
       from public.cadastros_cte_haras c
       where c.id = $1 and ($15::uuid is null or c.tenant_id = $15)
       returning id`,
      [centerId, ...fields.map((field) => values[field]), values.valor, user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "CTE/Haras não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Falha ao cadastrar funcionário:", error);
    return Response.json({ error: "Não foi possível cadastrar o funcionário." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await authorizedCenterUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  const input = await readInput(request);
  const values = input && employeeFields(input);
  if (!input || !isUuid(input.id) || !values) return Response.json({ error: "Confira os dados do funcionário." }, { status: 400 });
  try {
    const result = await getPool().query(
      `update public.funcionarios
       set nome=$2, cpf=$3, rg=$4, endereco=$5, cep=$6, bairro=$7, cidade=$8,
           estado=$9, telefone=$10, email=$11, cargo=$12, tipo_contratacao=$13, valor=$14
       where id=$1 and ($15::uuid is null or cadastro_cte_haras_id=$15)
         and ($16::uuid is null or tenant_id=$16)
       returning id`,
      [input.id, ...fields.map((field) => values[field]), values.valor,
        user.perfil === "ADMIN" ? null : user.cadastro_cte_haras_id, user.perfil === "ADMIN" ? null : user.tenant_id],
    );
    if (!result.rowCount) return Response.json({ error: "Funcionário não encontrado." }, { status: 404 });
    return Response.json({ id: result.rows[0].id });
  } catch (error) {
    console.error("Falha ao alterar funcionário:", error);
    return Response.json({ error: "Não foi possível alterar o funcionário." }, { status: 500 });
  }
}
