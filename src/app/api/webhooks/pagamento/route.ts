import { timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/db";

function isValidSecret(received: string | null, expected: string) {
  if (!received) {
    return false;
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "Webhook de pagamento não configurado." },
      { status: 503 },
    );
  }
  if (!isValidSecret(request.headers.get("x-webhook-secret"), webhookSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("gateway_cobranca_id" in payload) ||
    typeof payload.gateway_cobranca_id !== "string" ||
    !payload.gateway_cobranca_id.trim() ||
    !("status" in payload) ||
    payload.status !== "PAGO"
  ) {
    return Response.json(
      { error: "Informe gateway_cobranca_id e status PAGO." },
      { status: 400 },
    );
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const lookup = await client.query<{ id: string; status: string }>(
      `select id, status
       from public.financeiro_lancamentos
       where gateway_cobranca_id = $1
       for update`,
      [payload.gateway_cobranca_id.trim()],
    );
    const entry = lookup.rows[0];
    if (!entry) {
      await client.query("rollback");
      return Response.json({ error: "Cobrança não encontrada." }, { status: 404 });
    }
    if (entry.status === "PAGO") {
      await client.query("commit");
      return Response.json({ received: true, alreadyPaid: true });
    }

    await client.query(
      `update public.financeiro_lancamentos
       set status = 'PAGO', data_pagamento = current_date
       where id = $1`,
      [entry.id],
    );
    await client.query("commit");
    return Response.json({ received: true });
  } catch (error) {
    await client.query("rollback");
    console.error("Falha ao processar webhook de pagamento:", error);
    return Response.json({ error: "Falha ao processar webhook." }, { status: 500 });
  } finally {
    client.release();
  }
}
