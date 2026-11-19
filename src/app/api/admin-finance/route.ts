import { getCurrentUser } from "@/lib/current-user";
import {
  getAdminFinancePool,
  getPool,
  isAdminFinanceDatabaseConfigured,
} from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";
import type { PoolClient } from "pg";

const categories = new Set(["ASSINATURA", "TARIFA", "OPERACIONAL", "OUTRA"]);
const accountTypes = new Set(["CONTA_CORRENTE", "PIX", "DINHEIRO", "OUTRO"]);

type EntryInput = {
  accountId: string | null;
  accountText: string | null;
  tenantId: string | null;
  registrationId: string | null;
  nature: "RECEITA" | "DESPESA";
  category: string;
  description: string;
  amount: number;
  competence: string | null;
  dueDate: string;
  paymentDate: string | null | undefined;
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

function parseAmount(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
  ) {
    return null;
  }
  return amount;
}

function parseEntry(body: Record<string, unknown>, creating: boolean): EntryInput | null {
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const accountId =
    body.accountId === undefined || body.accountId === null || body.accountId === ""
      ? null
      : body.accountId;
  const tenantId =
    body.tenantId === undefined || body.tenantId === null || body.tenantId === ""
      ? null
      : body.tenantId;
  const registrationId =
    body.registrationId === undefined || body.registrationId === null || body.registrationId === ""
      ? null
      : body.registrationId;
  const accountText =
    body.accountText === undefined || body.accountText === null
      ? null
      : typeof body.accountText === "string"
        ? body.accountText.trim() || null
        : undefined;
  const competence =
    body.competence === undefined || body.competence === null || body.competence === ""
      ? null
      : body.competence;
  const paymentDate =
    body.paymentDate === undefined
      ? undefined
      : body.paymentDate === null || body.paymentDate === ""
        ? null
        : body.paymentDate;
  const amount = parseAmount(body.amount);

  if (
    (accountId !== null && !isUuid(accountId)) ||
    (tenantId !== null && !isUuid(tenantId)) ||
    (registrationId !== null && registrationId !== "ADMINISTRADOR" && !isUuid(registrationId)) ||
    accountText === undefined ||
    (accountText !== null && accountText.length > 20) ||
    (competence !== null && !isDateOnly(competence)) ||
    (paymentDate !== undefined && paymentDate !== null && !isDateOnly(paymentDate)) ||
    (body.nature !== "RECEITA" && body.nature !== "DESPESA") ||
    typeof body.category !== "string" ||
    !categories.has(body.category) ||
    !description ||
    description.length > (creating ? 30 : 200) ||
    amount === null ||
    !isDateOnly(body.dueDate) ||
    (body.category === "ASSINATURA" && registrationId === null && tenantId === null) ||
    (creating && (tenantId !== null ||
      (body.category === "ASSINATURA" && registrationId === null) ||
      (paymentDate != null && accountId !== null)))
  ) {
    return null;
  }

  return {
    accountId,
    accountText,
    tenantId,
    registrationId,
    nature: body.nature,
    category: body.category,
    description,
    amount,
    competence,
    dueDate: body.dueDate,
    paymentDate,
  };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

type RegistrationSnapshot = {
  tenant_id: string | null;
  tenant_nome: string | null;
  plano: string | null;
  cadastro_cte_haras_id: string | null;
  cadastro_cte_haras_nome: string;
  cadastro_cte_haras_tipo: string | null;
};

async function getRegistrationSnapshot(registrationId: string) {
  if (registrationId === "ADMINISTRADOR") {
    return {
      tenant_id: null,
      tenant_nome: null,
      plano: null,
      cadastro_cte_haras_id: null,
      cadastro_cte_haras_nome: "Administrador",
      cadastro_cte_haras_tipo: null,
    };
  }
  const result = await getPool().query<RegistrationSnapshot>(
    `select t.id as tenant_id, t.nome as tenant_nome, t.plano,
            c.id as cadastro_cte_haras_id, c.nome as cadastro_cte_haras_nome,
            c.tipo_cadastro as cadastro_cte_haras_tipo
     from public.cadastros_cte_haras as c
     join public.usuarios as creator on creator.id = c.criado_por and creator.perfil = 'ADMIN'
     join public.tenants as t on t.id = c.tenant_id
     where c.id = $1 and c.tipo_cadastro in ('CTE', 'HARAS')`,
    [registrationId],
  );
  return result.rows[0] ?? null;
}

async function writeAudit(
  client: PoolClient,
  actorId: string,
  recordType: "LANCAMENTO" | "CONTA",
  recordId: string,
  action: "CRIAR" | "ALTERAR" | "BAIXAR" | "EXCLUIR" | "CRIAR_CONTA",
  details: Record<string, unknown>,
) {
  await client.query(
    `insert into public.auditoria_financeiro_admin
       (registro_tipo, registro_id, ator_id, acao, detalhes)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [recordType, recordId, actorId, action, JSON.stringify(details)],
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse("Origem da solicitação inválida.", 403);
  }
  const user = await getCurrentUser();
  if (!user || user.perfil !== "ADMIN") {
    return errorResponse("Ação permitida somente ao perfil ADMIN.", 403);
  }
  if (!isAdminFinanceDatabaseConfigured()) {
    return errorResponse("Financeiro ADMIN não está configurado.", 503);
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

  const pool = getAdminFinancePool();
  try {
    switch (body.action) {
      case "createAccount": {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const type = body.type;
        const pixKey =
          typeof body.pixKey === "string" ? body.pixKey.trim() || null : null;
        if (
          !name ||
          name.length > 120 ||
          typeof type !== "string" ||
          !accountTypes.has(type) ||
          (pixKey !== null && pixKey.length > 200)
        ) {
          return errorResponse("Confira os dados da conta financeira.", 400);
        }

        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await client.query<{ id: string }>(
            `insert into public.contas_financeiro_admin (nome, tipo, chave_pix)
             values ($1, $2, $3)
             returning id`,
            [name, type, pixKey],
          );
          await writeAudit(
            client,
            user.id,
            "CONTA",
            result.rows[0].id,
            "CRIAR_CONTA",
            { nome: name, tipo: type },
          );
          await client.query("commit");
          return Response.json(
            { account: { id: result.rows[0].id, nome: name, tipo: type, chave_pix: pixKey, saldo_atual: 0 } },
            { status: 201 },
          );
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "createEntry": {
        const input = parseEntry(body, true);
        if (!input) {
          return errorResponse("Confira os dados do lançamento financeiro.", 400);
        }
        const registration = input.registrationId
          ? await getRegistrationSnapshot(input.registrationId)
          : null;
        if (input.registrationId && !registration) {
          return errorResponse("CTE/Haras não encontrado no cadastro ADMIN.", 404);
        }
        const client = await pool.connect();
        try {
          await client.query("begin");
          if (input.accountId) {
            const account = await client.query(
              "select 1 from public.contas_financeiro_admin where id = $1 and ativo",
              [input.accountId],
            );
            if (!account.rowCount) {
              await client.query("rollback");
              return errorResponse("Conta financeira não encontrada.", 404);
            }
          }
          const result = await client.query<{ id: string }>(
            `insert into public.lancamentos_financeiro_admin (
               conta_id, tenant_id, tenant_nome, plano, natureza, categoria,
               descricao, valor, competencia, data_vencimento, criado_por,
               cadastro_cte_haras_id, cadastro_cte_haras_nome, cadastro_cte_haras_tipo,
               conta_informada, data_pagamento, status
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             returning id`,
            [
              input.accountId,
              registration?.tenant_id ?? null,
              registration?.tenant_nome ?? null,
              registration?.plano ?? null,
              input.nature,
              input.category,
              input.description,
              input.amount,
              input.competence,
              input.dueDate,
              user.id,
              registration?.cadastro_cte_haras_id ?? null,
              registration?.cadastro_cte_haras_nome ?? null,
              registration?.cadastro_cte_haras_tipo ?? null,
              input.accountText,
              input.paymentDate ?? null,
              input.paymentDate ? "PAGO" : "PENDENTE",
            ],
          );
          await writeAudit(
            client,
            user.id,
            "LANCAMENTO",
            result.rows[0].id,
            "CRIAR",
            { categoria: input.category, natureza: input.nature, valor: input.amount,
              cadastro_cte_haras_id: registration?.cadastro_cte_haras_id ?? null,
              conta_informada: input.accountText, data_pagamento: input.paymentDate ?? null,
              status: input.paymentDate ? "PAGO" : "PENDENTE" },
          );
          await client.query("commit");
          return Response.json(
            {
              entry: {
                id: result.rows[0].id,
                tenant_id: registration?.tenant_id ?? null,
                tenant_nome: registration?.tenant_nome ?? null,
                plano: registration?.plano ?? null,
                cadastro_cte_haras_id: registration?.cadastro_cte_haras_id ?? null,
                cadastro_cte_haras_nome: registration?.cadastro_cte_haras_nome ?? null,
                cadastro_cte_haras_tipo: registration?.cadastro_cte_haras_tipo ?? null,
                conta_informada: input.accountText,
                descricao: input.description,
                valor: input.amount,
                data_vencimento: input.dueDate,
                data_pagamento: input.paymentDate ?? null,
                natureza: input.nature,
                categoria: input.category,
                status: input.paymentDate ? "PAGO" : "PENDENTE",
                competencia: input.competence,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "updateEntry": {
        if (!isUuid(body.id)) {
          return errorResponse("Lançamento inválido.", 400);
        }
        const input = parseEntry(body, false);
        if (!input) {
          return errorResponse("Confira os dados do lançamento financeiro.", 400);
        }
        const registration = input.registrationId
          ? await getRegistrationSnapshot(input.registrationId)
          : null;
        const client = await pool.connect();
        try {
          await client.query("begin");
          const previous = await client.query<{
            status: string;
            conta_id: string | null;
            data_pagamento: string | null;
            tenant_id: string | null;
            tenant_nome: string | null;
            plano: string | null;
            cadastro_cte_haras_id: string | null;
            cadastro_cte_haras_nome: string | null;
            cadastro_cte_haras_tipo: string | null;
          }>(
            `select conta_id, tenant_id, tenant_nome, plano, categoria, natureza,
                    descricao, valor, competencia, data_vencimento, status,
                    data_pagamento::text as data_pagamento,
                    cadastro_cte_haras_id, cadastro_cte_haras_nome, cadastro_cte_haras_tipo,
                    conta_informada
             from public.lancamentos_financeiro_admin
             where id = $1 and criado_por = $2 and excluido_em is null
             for update`,
            [body.id, user.id],
          );
          if (!previous.rowCount) {
            await client.query("rollback");
            return errorResponse("Lançamento não encontrado.", 404);
          }
          const oldEntry = previous.rows[0];
          if (input.accountId && input.accountId !== oldEntry.conta_id) {
            const account = await client.query(
              "select 1 from public.contas_financeiro_admin where id = $1 and ativo",
              [input.accountId],
            );
            if (!account.rowCount) {
              await client.query("rollback");
              return errorResponse("Conta financeira não encontrada.", 404);
            }
          }
          const preserveRegistration =
            input.registrationId !== null &&
            input.registrationId === oldEntry.cadastro_cte_haras_id;
          if (input.registrationId && !registration && !preserveRegistration) {
            await client.query("rollback");
            return errorResponse("CTE/Haras não encontrado no cadastro ADMIN.", 404);
          }
          if (
            input.tenantId &&
            (input.registrationId || oldEntry.cadastro_cte_haras_id || input.tenantId !== oldEntry.tenant_id)
          ) {
            await client.query("rollback");
            return errorResponse("Selecione um CTE/Haras do cadastro ADMIN.", 400);
          }
          const link = registration ?? (preserveRegistration || input.tenantId ? oldEntry : null);
          const paymentDate = input.paymentDate === undefined
            ? oldEntry.data_pagamento
            : input.paymentDate;
          if (oldEntry.status === "CANCELADO" && paymentDate !== oldEntry.data_pagamento) {
            await client.query("rollback");
            return errorResponse("Não é possível alterar o pagamento de um lançamento cancelado.", 400);
          }
          const status = oldEntry.status === "CANCELADO"
            ? "CANCELADO"
            : input.paymentDate === undefined ||
            (oldEntry.status === "PAGO" && !oldEntry.data_pagamento && !paymentDate)
            ? oldEntry.status
            : paymentDate ? "PAGO" : oldEntry.status === "PAGO" ? "PENDENTE" : oldEntry.status;
          if (oldEntry.status === "PAGO" && oldEntry.conta_id && status === "PAGO" && !input.accountId) {
            await client.query("rollback");
            return errorResponse("Um pagamento anterior deve manter sua conta financeira.", 400);
          }
          const accountId = status === "PAGO" && oldEntry.status !== "PAGO"
            ? null
            : input.accountId;
          const updated = await client.query<{ status: string }>(
            `update public.lancamentos_financeiro_admin
             set conta_id = $1, tenant_id = $2, tenant_nome = $3, plano = $4,
                 natureza = $5, categoria = $6, descricao = $7, valor = $8,
                 competencia = $9, data_vencimento = $10, atualizado_em = now(),
                 cadastro_cte_haras_id = $12, cadastro_cte_haras_nome = $13,
                 cadastro_cte_haras_tipo = $14, conta_informada = $15,
                 data_pagamento = $16, status = $17
             where id = $11 and criado_por = $18
             returning status`,
            [
              accountId,
              link?.tenant_id ?? null,
              link?.tenant_nome ?? null,
              link?.plano ?? null,
              input.nature,
              input.category,
              input.description,
              input.amount,
              input.competence,
              input.dueDate,
              body.id,
              link?.cadastro_cte_haras_id ?? null,
              link?.cadastro_cte_haras_nome ?? null,
              link?.cadastro_cte_haras_tipo ?? null,
              input.accountText,
              paymentDate,
              status,
              user.id,
            ],
          );
          await writeAudit(
            client,
            user.id,
            "LANCAMENTO",
            body.id,
            "ALTERAR",
            {
              antes: previous.rows[0],
              depois: {
                conta_id: accountId,
                tenant_id: link?.tenant_id ?? null,
                tenant_nome: link?.tenant_nome ?? null,
                plano: link?.plano ?? null,
                cadastro_cte_haras_id: link?.cadastro_cte_haras_id ?? null,
                cadastro_cte_haras_nome: link?.cadastro_cte_haras_nome ?? null,
                cadastro_cte_haras_tipo: link?.cadastro_cte_haras_tipo ?? null,
                conta_informada: input.accountText,
                categoria: input.category,
                natureza: input.nature,
                descricao: input.description,
                valor: input.amount,
                competencia: input.competence,
                data_vencimento: input.dueDate,
                data_pagamento: paymentDate,
                status,
              },
            },
          );
          if (status === "PAGO" && oldEntry.status !== "PAGO") {
            await writeAudit(client, user.id, "LANCAMENTO", body.id, "BAIXAR", {
              data_pagamento: paymentDate,
              conta_id: null,
            });
          }
          await client.query("commit");
          return Response.json({
            entry: {
              id: body.id,
              tenant_id: link?.tenant_id ?? null,
              tenant_nome: link?.tenant_nome ?? null,
              plano: link?.plano ?? null,
              cadastro_cte_haras_id: link?.cadastro_cte_haras_id ?? null,
              cadastro_cte_haras_nome: link?.cadastro_cte_haras_nome ?? null,
              cadastro_cte_haras_tipo: link?.cadastro_cte_haras_tipo ?? null,
              conta_informada: input.accountText,
              descricao: input.description,
              valor: input.amount,
              data_vencimento: input.dueDate,
              data_pagamento: paymentDate,
              natureza: input.nature,
              categoria: input.category,
              status: updated.rows[0].status,
              competencia: input.competence,
            },
          });
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "payEntry": {
        if (!isUuid(body.id) || !isUuid(body.accountId)) {
          return errorResponse("Lançamento ou conta inválidos.", 400);
        }
        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await client.query(
            `update public.lancamentos_financeiro_admin
             set status = 'PAGO', data_pagamento = current_date,
                 conta_id = $1, atualizado_em = now()
             where id = $2 and criado_por = $3 and excluido_em is null and status in ('PENDENTE', 'ATRASADO')
               and exists (
                 select 1 from public.contas_financeiro_admin
                 where id = $1 and ativo
               )
             returning id`,
            [body.accountId, body.id, user.id],
          );
          if (!result.rowCount) {
            await client.query("rollback");
            return errorResponse("Lançamento ou conta não encontrados.", 404);
          }
          await writeAudit(client, user.id, "LANCAMENTO", body.id, "BAIXAR", {
            conta_id: body.accountId,
          });
          await client.query("commit");
          return Response.json({ updated: true });
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "deleteEntry": {
        if (!isUuid(body.id)) {
          return errorResponse("Lançamento inválido.", 400);
        }
        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await client.query(
            `update public.lancamentos_financeiro_admin
             set excluido_em = now(), excluido_por = $1, atualizado_em = now()
             where id = $2 and criado_por = $1 and excluido_em is null
             returning id`,
            [user.id, body.id],
          );
          if (!result.rowCount) {
            await client.query("rollback");
            return errorResponse("Lançamento não encontrado.", 404);
          }
          await writeAudit(client, user.id, "LANCAMENTO", body.id, "EXCLUIR", {});
          await client.query("commit");
          return Response.json({ deleted: true });
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      default:
        return errorResponse("Ação financeira ADMIN não reconhecida.", 400);
    }
  } catch (error) {
    console.error("Falha ao executar ação do Financeiro ADMIN:", error);
    if (
      (body.action === "createEntry" || body.action === "updateEntry") &&
      isRecord(error) && error.code === "42703"
    ) {
      return errorResponse("Atualize a base financeira ADMIN executando npm run db:admin-setup.", 503);
    }
    return errorResponse("Não foi possível concluir a operação financeira.", 500);
  }
}
