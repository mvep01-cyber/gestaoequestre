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
  tenantId: string | null;
  nature: "RECEITA" | "DESPESA";
  category: string;
  description: string;
  amount: number;
  competence: string | null;
  dueDate: string;
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

function parseEntry(body: Record<string, unknown>): EntryInput | null {
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
  const competence =
    body.competence === undefined || body.competence === null || body.competence === ""
      ? null
      : body.competence;
  const amount = parseAmount(body.amount);

  if (
    (accountId !== null && !isUuid(accountId)) ||
    (tenantId !== null && !isUuid(tenantId)) ||
    (competence !== null && !isDateOnly(competence)) ||
    (body.nature !== "RECEITA" && body.nature !== "DESPESA") ||
    typeof body.category !== "string" ||
    !categories.has(body.category) ||
    !description ||
    description.length > 200 ||
    amount === null ||
    !isDateOnly(body.dueDate) ||
    (body.category === "ASSINATURA" && tenantId === null)
  ) {
    return null;
  }

  return {
    accountId,
    tenantId,
    nature: body.nature,
    category: body.category,
    description,
    amount,
    competence,
    dueDate: body.dueDate,
  };
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function getTenantSnapshot(
  tenantId: string | null,
): Promise<{ tenant_nome: string | null; plano: string | null } | null> {
  if (!tenantId) {
    return { tenant_nome: null, plano: null };
  }
  const result = await getPool().query<{ tenant_nome: string; plano: string }>(
    "select nome as tenant_nome, plano from public.tenants where id = $1",
    [tenantId],
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
        const input = parseEntry(body);
        if (!input) {
          return errorResponse("Confira os dados do lançamento financeiro.", 400);
        }
        const tenant = await getTenantSnapshot(input.tenantId);
        if (!tenant) {
          return errorResponse("Tenant não encontrado.", 404);
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
               descricao, valor, competencia, data_vencimento, criado_por
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             returning id`,
            [
              input.accountId,
              input.tenantId,
              tenant.tenant_nome,
              tenant.plano,
              input.nature,
              input.category,
              input.description,
              input.amount,
              input.competence,
              input.dueDate,
              user.id,
            ],
          );
          await writeAudit(
            client,
            user.id,
            "LANCAMENTO",
            result.rows[0].id,
            "CRIAR",
            { categoria: input.category, natureza: input.nature, valor: input.amount },
          );
          await client.query("commit");
          return Response.json(
            {
              entry: {
                id: result.rows[0].id,
                tenant_id: input.tenantId,
                tenant_nome: tenant.tenant_nome,
                plano: tenant.plano,
                descricao: input.description,
                valor: input.amount,
                data_vencimento: input.dueDate,
                natureza: input.nature,
                categoria: input.category,
                status: "PENDENTE",
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
        const input = parseEntry(body);
        if (!input) {
          return errorResponse("Confira os dados do lançamento financeiro.", 400);
        }
        const tenant = await getTenantSnapshot(input.tenantId);
        if (!tenant) {
          return errorResponse("Tenant não encontrado.", 404);
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
          const previous = await client.query<{ status: string }>(
            `select conta_id, tenant_id, tenant_nome, plano, categoria, natureza,
                    descricao, valor, competencia, data_vencimento, status
             from public.lancamentos_financeiro_admin
             where id = $1 and excluido_em is null
             for update`,
            [body.id],
          );
          if (!previous.rowCount) {
            await client.query("rollback");
            return errorResponse("Lançamento não encontrado.", 404);
          }
          if (previous.rows[0].status === "PAGO" && !input.accountId) {
            await client.query("rollback");
            return errorResponse("Um lançamento pago deve manter uma conta financeira.", 400);
          }
          const updated = await client.query<{ status: string }>(
            `update public.lancamentos_financeiro_admin
             set conta_id = $1, tenant_id = $2, tenant_nome = $3, plano = $4,
                 natureza = $5, categoria = $6, descricao = $7, valor = $8,
                 competencia = $9, data_vencimento = $10, atualizado_em = now()
             where id = $11
             returning status`,
            [
              input.accountId,
              input.tenantId,
              tenant.tenant_nome,
              tenant.plano,
              input.nature,
              input.category,
              input.description,
              input.amount,
              input.competence,
              input.dueDate,
              body.id,
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
                conta_id: input.accountId,
                tenant_id: input.tenantId,
                tenant_nome: tenant.tenant_nome,
                plano: tenant.plano,
                categoria: input.category,
                natureza: input.nature,
                descricao: input.description,
                valor: input.amount,
                competencia: input.competence,
                data_vencimento: input.dueDate,
              },
            },
          );
          await client.query("commit");
          return Response.json({
            entry: {
              id: body.id,
              tenant_id: input.tenantId,
              tenant_nome: tenant.tenant_nome,
              plano: tenant.plano,
              descricao: input.description,
              valor: input.amount,
              data_vencimento: input.dueDate,
              natureza: input.nature,
              categoria: input.category,
              status: updated.rows[0]?.status ?? previous.rows[0].status,
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
             where id = $2 and excluido_em is null and status in ('PENDENTE', 'ATRASADO')
               and exists (
                 select 1 from public.contas_financeiro_admin
                 where id = $1 and ativo
               )
             returning id`,
            [body.accountId, body.id],
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
             where id = $2 and excluido_em is null
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
    return errorResponse("Não foi possível concluir a operação financeira.", 500);
  }
}
