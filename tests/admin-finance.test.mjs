import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

test("Financeiro ADMIN isola lançamentos e registra pagamento sem movimentar saldo", { timeout: 120000 }, async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é necessária para o teste.");
  const suffix = randomBytes(8).toString("hex");
  const names = [`test_finance_op_${suffix}`, `test_finance_admin_${suffix}`];
  const bootstrap = new Pool({ connectionString: process.env.DATABASE_URL });
  const opUrl = new URL(process.env.DATABASE_URL);
  const finUrl = new URL(process.env.DATABASE_URL);
  opUrl.pathname = `/${names[0]}`;
  finUrl.pathname = `/${names[1]}`;
  const created = [];
  let op;
  let fin;
  let server;
  let serverOutput = "";
  try {
    for (const name of names) {
      await bootstrap.query(`create database "${name}"`);
      created.push(name);
    }
    op = new Pool({ connectionString: opUrl.toString() });
    fin = new Pool({ connectionString: finUrl.toString() });
    await op.query(await readFile("database/schema.sql", "utf8"));
    await fin.query(await readFile("database/admin-finance-schema.sql", "utf8"));

    const tenantId = (await op.query(
      "insert into tenants (nome, plano) values ('Centro teste', 'CTE') returning id",
    )).rows[0].id;
    const password = randomBytes(24).toString("hex");
    const hash = await bcrypt.hash(password, 10);
    async function addAdmin(email) {
      return (await op.query(
        `insert into usuarios (tenant_id, nome, email, senha_hash, perfil)
         values ($1,$2,$2,$3,'ADMIN') returning id`,
        [tenantId, email, hash],
      )).rows[0].id;
    }
    const adminA = await addAdmin("admin-a@test.invalid");
    const adminB = await addAdmin("admin-b@test.invalid");
    const accountId = (await fin.query(
      "insert into contas_financeiro_admin (nome,tipo,saldo_atual) values ('Conta histórica','PIX',100) returning id",
    )).rows[0].id;
    async function addEntry(owner, name, status, account, date) {
      return (await fin.query(
        `insert into lancamentos_financeiro_admin
         (criado_por, descricao, natureza, categoria, valor, data_vencimento, status, conta_id, data_pagamento)
         values ($1,$2,'RECEITA','OUTRA',15,'2026-12-01',$3,$4,$5) returning id`,
        [owner, name, status, account, date],
      )).rows[0].id;
    }
    const otherEntry = await addEntry(adminB, "Lançamento de outro ADMIN", "PENDENTE", null, null);
    const pending = await addEntry(adminA, "Pendente", "PENDENTE", accountId, null);
    const paid = await addEntry(adminA, "Pagamento anterior", "PAGO", accountId, "2026-10-01");
    await fin.query("update contas_financeiro_admin set ativo = false where id = $1", [accountId]);
    const balance = (await fin.query("select saldo_atual::float as valor from contas_financeiro_admin where id=$1", [accountId])).rows[0].valor;

    const port = await new Promise((resolve, reject) => {
      const socket = net.createServer();
      socket.once("error", reject);
      socket.listen(0, "127.0.0.1", () => {
        const selected = socket.address().port;
        socket.close(() => resolve(selected));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: opUrl.toString(), ADMIN_DATABASE_URL: finUrl.toString(),
        NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString("hex") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
    server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput);
      try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
      if (attempt === 99) throw new Error(`Servidor não iniciou: ${serverOutput}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    async function login(email) {
      const cookies = new Map();
      async function request(url, options = {}) {
        const response = await fetch(`${base}${url}`, {
          ...options, redirect: "manual",
          headers: { ...options.headers, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
        });
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(";")[0];
          const index = pair.indexOf("=");
          cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      }
      const csrf = await (await request("/api/auth/csrf")).json();
      await request("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
      });
      assert.equal((await (await request("/api/auth/session")).json()).user.email, email);
      return request;
    }
    async function action(request, actionName, fields, status) {
      const response = await request("/api/admin-finance", {
        method: "POST", headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ action: actionName, ...fields }),
      });
      const result = await response.json();
      assert.equal(response.status, status, `${actionName}: ${JSON.stringify(result)}`);
      return result;
    }

    const requestA = await login("admin-a@test.invalid");
    const requestB = await login("admin-b@test.invalid");
    const pageA = await (await requestA(`/dashboard?tenantId=${tenantId}`)).text();
    const pageB = await (await requestB(`/dashboard?tenantId=${tenantId}`)).text();
    assert(pageA.includes("Pendente") && !pageA.includes("Lançamento de outro ADMIN"));
    assert(pageB.includes("Lançamento de outro ADMIN") && !pageB.includes("Pagamento anterior"));

    const fields = { description: "Pagamento ADM", amount: 15, nature: "RECEITA",
      category: "ASSINATURA", registrationId: "ADMINISTRADOR", accountText: "Conta teste",
      dueDate: "2026-12-01", paymentDate: "2026-11-15" };
    await action(requestA, "updateEntry", { ...fields, id: otherEntry }, 404);
    await action(requestA, "deleteEntry", { id: otherEntry }, 404);
    await action(requestA, "payEntry", { id: otherEntry, accountId }, 404);
    await action(requestA, "createEntry", { ...fields, paymentDate: "2026-02-31" }, 400);
    const entry = (await action(requestA, "createEntry", fields, 201)).entry;
    assert.equal(entry.cadastro_cte_haras_nome, "Administrador");
    assert.equal(entry.status, "PAGO");
    assert.equal(entry.data_pagamento, "2026-11-15");
    await action(requestA, "updateEntry", { ...fields, id: pending, accountId }, 200);
    const marked = (await fin.query(
      "select status,conta_id,data_pagamento::text as data from lancamentos_financeiro_admin where id=$1", [pending],
    )).rows[0];
    assert.deepEqual(marked, { status: "PAGO", conta_id: null, data: "2026-11-15" });
    await action(requestA, "updateEntry", { ...fields, id: pending, paymentDate: null }, 200);
    assert.equal((await fin.query("select status from lancamentos_financeiro_admin where id=$1", [pending])).rows[0].status, "PENDENTE");
    await action(requestA, "updateEntry", { ...fields, id: paid, accountId, paymentDate: "2026-10-02" }, 200);
    await action(requestA, "deleteEntry", { id: entry.id }, 200);
    assert.equal((await fin.query("select saldo_atual::float as valor from contas_financeiro_admin where id=$1", [accountId])).rows[0].valor, balance);
    assert((await fin.query("select 1 from auditoria_financeiro_admin where registro_id=$1 and acao='BAIXAR'", [pending])).rowCount);
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (op) await op.end();
    if (fin) await fin.end();
    for (const name of created.reverse()) await bootstrap.query(`drop database "${name}"`);
    await bootstrap.end();
  }
});
