import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

type ReproductionCycle = {
  id: string;
  tipo: string;
  garanhao_id: string;
  matriz_id: string;
  receptora_id: string | null;
  data_cobertura: string;
  status: string;
  data_previsao_parto: string | null;
  data_parto_real: string | null;
  potro_gerado_id: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse("Origem da solicitação inválida.", 403);
  }

  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Entre novamente para continuar.", 401);
  }
  if (!isTenantAvailable(user)) {
    return errorResponse("A assinatura deste centro está bloqueada.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Solicitação inválida.", 400);
  }
  if (!isRecord(body) || typeof body.action !== "string") {
    return errorResponse("Ação inválida.", 400);
  }

  const isManager = user.perfil === "ADMIN";
  const hasTenant = Boolean(user.tenant_id);
  const pool = getPool();

  try {
    switch (body.action) {
      case "createHorse": {
        if (!isManager || !hasTenant) {
          return errorResponse("Somente gestores podem cadastrar cavalos.", 403);
        }
        const nome = typeof body.nome === "string" ? body.nome.trim() : "";
        const baia = typeof body.baia === "string" ? body.baia.trim() : "";
        if (!nome || nome.length > 120 || baia.length > 40) {
          return errorResponse("Informe um nome e uma baia válidos.", 400);
        }
        const result = await pool.query(
          `insert into public.equinos (tenant_id, nome, baia, categoria, origem, status)
           values ($1, $2, $3, 'ATLETA', 'PROPRIO', 'DESCANSO')
           returning id, nome, baia, raca, categoria, status`,
          [user.tenant_id, nome, baia || null],
        );
        return Response.json({ horse: result.rows[0] }, { status: 201 });
      }

      case "applyMedication": {
        if (!hasTenant || !isUuid(body.id)) {
          return errorResponse("Aplicação inválida.", 400);
        }
        const result = await pool.query(
          `update public.medicamentos_aplicacoes
           set status = 'APLICADO', aplicado_por = $1, aplicado_em = now()
           where id = $2 and tenant_id = $3 and status = 'PENDENTE'
           returning id`,
          [user.id, body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Aplicação não encontrada ou já registrada.", 404);
        }
        return Response.json({ updated: true });
      }

      case "completeTraining": {
        if (!hasTenant || !isUuid(body.id)) {
          return errorResponse("Treino inválido.", 400);
        }
        const result = await pool.query(
          `update public.agenda_treinos
           set status = 'CONCLUIDO'
           where id = $1 and tenant_id = $2 and status = 'PENDENTE'
           returning id`,
          [body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Treino não encontrado ou já concluído.", 404);
        }
        return Response.json({ updated: true });
      }

      case "updateTenant": {
        if (user.perfil !== "SUPER_ADMIN" || !isUuid(body.id)) {
          return errorResponse("Ação permitida somente ao super administrador.", 403);
        }
        if (
          body.field !== "plano" &&
          body.field !== "status_assinatura"
        ) {
          return errorResponse("Campo inválido.", 400);
        }
        const validValue =
          body.field === "plano"
            ? body.value === "CTE" || body.value === "HARAS"
            : body.value === "TRIAL" ||
              body.value === "ATIVO" ||
              body.value === "BLOQUEADO";
        if (!validValue) {
          return errorResponse("Valor inválido.", 400);
        }
        const column = body.field === "plano" ? "plano" : "status_assinatura";
        const result = await pool.query(
          `update public.tenants set ${column} = $1 where id = $2 returning id`,
          [body.value, body.id],
        );
        if (!result.rowCount) {
          return errorResponse("Centro não encontrado.", 404);
        }
        return Response.json({ updated: true });
      }

      case "generateBilling": {
        if (!isManager || !hasTenant) {
          return errorResponse("Ação permitida somente a gestores.", 403);
        }
        if (
          !isUuid(body.ownerId) ||
          typeof body.month !== "string" ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)
        ) {
          return errorResponse("Proprietário ou competência inválidos.", 400);
        }
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(
            "select public.app_gerar_cobranca_mensal($1, $2, $3::date)",
            [user.tenant_id, body.ownerId, `${body.month}-01`],
          );
          const entries = await client.query<{
            id: string;
            descricao: string;
            valor: string;
            link_pagamento: string | null;
            pix_copia_cola: string | null;
          }>(
            `select id, descricao, valor, link_pagamento, pix_copia_cola
             from public.financeiro_lancamentos
             where tenant_id = $1 and proprietario_id = $2
               and competencia = $3::date and status = 'PENDENTE'
             order by data_vencimento, created_at`,
            [user.tenant_id, body.ownerId, `${body.month}-01`],
          );
          await client.query("commit");
          return Response.json({
            entries: entries.rows.map((entry) => ({
              ...entry,
              valor: Number(entry.valor),
            })),
          });
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "payFinanceEntry": {
        if (!isManager || !hasTenant) {
          return errorResponse("Ação permitida somente a gestores.", 403);
        }
        if (!isUuid(body.id) || !isUuid(body.accountId)) {
          return errorResponse("Lançamento ou conta inválidos.", 400);
        }
        const result = await pool.query(
          `update public.financeiro_lancamentos
           set status = 'PAGO', data_pagamento = current_date, conta_bancaria_id = $1
           where id = $2 and tenant_id = $3 and status <> 'PAGO'
             and exists (
               select 1 from public.contas_bancarias
               where id = $1 and tenant_id = $3
             )
           returning id`,
          [body.accountId, body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Lançamento ou conta não encontrados.", 404);
        }
        return Response.json({ updated: true });
      }

      case "createCycle": {
        if (!isManager || !hasTenant || user.plano !== "HARAS") {
          return errorResponse("Reprodução está disponível somente para gestores HARAS.", 403);
        }
        if (
          !isUuid(body.mareId) ||
          !isUuid(body.sireId) ||
          (body.recipientId !== null &&
            body.recipientId !== "" &&
            !isUuid(body.recipientId)) ||
          !isDateOnly(body.coverageDate) ||
          (body.dueDate !== "" && !isDateOnly(body.dueDate)) ||
          !["MONTA", "INSEMINACAO", "TE"].includes(String(body.type))
        ) {
          return errorResponse("Dados do ciclo inválidos.", 400);
        }

        const recipientId =
          typeof body.recipientId === "string" && body.recipientId
            ? body.recipientId
            : null;
        const horseIds = [body.mareId, body.sireId, ...(recipientId ? [recipientId] : [])];
        const horses = await pool.query<{ id: string; categoria: string }>(
          `select id, categoria
           from public.equinos
           where tenant_id = $1 and id = any($2::uuid[])`,
          [user.tenant_id, horseIds],
        );
        const mare = horses.rows.find((horse) => horse.id === body.mareId);
        const sire = horses.rows.find((horse) => horse.id === body.sireId);
        const recipient = recipientId
          ? horses.rows.find((horse) => horse.id === recipientId)
          : null;
        if (
          mare?.categoria !== "MATRIZ" ||
          sire?.categoria !== "GARANHAO" ||
          (recipientId && recipient?.categoria !== "RECEPTORA")
        ) {
          return errorResponse("Confira as categorias dos animais selecionados.", 400);
        }

        const result = await pool.query<ReproductionCycle>(
          `insert into public.reproducao_ciclos (
             tenant_id, tipo, garanhao_id, matriz_id, receptora_id,
             data_cobertura, data_previsao_parto, status
           )
           values ($1, $2, $3, $4, $5, $6, $7, 'AGUARDANDO_EXAME')
           returning id, tipo, garanhao_id, matriz_id, receptora_id,
             data_cobertura, status, data_previsao_parto, data_parto_real,
             potro_gerado_id`,
          [
            user.tenant_id,
            body.type,
            body.sireId,
            body.mareId,
            recipientId,
            body.coverageDate,
            body.dueDate || null,
          ],
        );
        return Response.json(
          {
            cycle: {
              ...result.rows[0],
              nome_garanhao: "Garanhão",
              nome_matriz: "Matriz",
            },
          },
          { status: 201 },
        );
      }

      case "updateCycleStatus": {
        if (!isManager || !hasTenant || user.plano !== "HARAS") {
          return errorResponse("Reprodução está disponível somente para gestores HARAS.", 403);
        }
        if (
          !isUuid(body.id) ||
          !["AGUARDANDO_EXAME", "PRENHE", "VAZIA", "PARIDA"].includes(
            String(body.status),
          )
        ) {
          return errorResponse("Ciclo ou status inválido.", 400);
        }
        const result = await pool.query(
          `update public.reproducao_ciclos
           set status = $1,
               data_parto_real = case when $1 = 'PARIDA' then current_date
                                      else data_parto_real end
           where id = $2 and tenant_id = $3
           returning id`,
          [body.status, body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Ciclo não encontrado.", 404);
        }
        return Response.json({ updated: true });
      }

      default:
        return errorResponse("Ação não reconhecida.", 400);
    }
  } catch (error) {
    console.error("Falha ao executar ação do painel:", error);
    return errorResponse("Não foi possível concluir a operação.", 500);
  }
}
