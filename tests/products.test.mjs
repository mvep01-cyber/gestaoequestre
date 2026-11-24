import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

test("produtos isolam cadastros, preservam histórico e validam vigências", { timeout: 120000 }, async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é necessária para o teste.");
  const name = `test_produtos_${randomBytes(8).toString("hex")}`;
  const bootstrap = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  let db;
  let server;
  let created = false;
  let output = "";
  try {
    await bootstrap.query(`create database "${name}"`);
    created = true;
    db = new pg.Pool({ connectionString: url.toString(), options: "-c timezone=America/Sao_Paulo" });
    const schema = await readFile("database/schema.sql", "utf8");
    await db.query(schema);
    const tenant = (await db.query("insert into tenants (nome, plano) values ('Teste', 'CTE') returning id")).rows[0].id;
    const password = randomBytes(24).toString("hex");
    const hash = await bcrypt.hash(password, 10);
    async function registration(name, type) {
      return (await db.query(
        `insert into cadastros_cte_haras
         (tenant_id,tipo_cadastro,nome,telefone_whatsapp,documento,cpf,rg,data_nascimento,idade,profissao,endereco_completo,numero_socio_abccmm,data_inicio,data_fim)
         values ($1,$2,$3,'1','1','1','1','2000-01-01',26,'Teste','Teste',1,'2020-01-01','9999-12-31') returning id`,
        [tenant, type, name],
      )).rows[0].id;
    }
    const a = await registration("Centro A", "CTE");
    const b = await registration("Centro B", "HARAS");
    const supplierA = (await db.query("insert into fornecedores (tenant_id,cadastro_cte_haras_id,nome) values ($1,$2,'Fornecedor A') returning id", [tenant, a])).rows[0].id;
    const supplierB = (await db.query("insert into fornecedores (tenant_id,cadastro_cte_haras_id,nome) values ($1,$2,'Fornecedor B') returning id", [tenant, b])).rows[0].id;
    async function user(email, role, registrationId = null) {
      return (await db.query(
        "insert into usuarios (tenant_id,cadastro_cte_haras_id,nome,email,senha_hash,perfil) values ($1,$2,$3,$3,$4,$5) returning id",
        [tenant, registrationId, email, hash, role],
      )).rows[0].id;
    }
    const userA = await user("a@test.invalid", "CLIENTE", a);
    await user("b@test.invalid", "CLIENTE", b);
    await user("admin@test.invalid", "ADMIN");
    await user("operacional@test.invalid", "OPERACIONAL");
    await db.query(
      `insert into equinos (tenant_id, criado_por, nome, foto_url)
       values ($1, $2, 'Cavalo com foto', 'https://example.com/foto'),
              ($1, $2, 'Cavalo legado', 'javascript:alert(1)'),
              ($1, $2, 'Cavalo sem foto', null)`,
      [tenant, userA],
    );
    await db.query(`alter table produtos drop constraint produtos_cadastro_codigo_inicio_key,
      add column subitem text not null default '01', alter column fornecedor_id drop not null;
      alter table produtos add constraint produtos_cadastro_codigo_subitem_inicio_key
      unique (cadastro_cte_haras_id, codigo, subitem, data_inicio);
      create table equinos_produtos (equino_id uuid, produto_id uuid)`);
    const migrationProduct = (await db.query(
      `insert into produtos (tenant_id, cadastro_cte_haras_id, fornecedor_id, codigo, nome, valor, data_inicio, data_fim)
       values ($1,$2,$3,'MIG','Feno',1,current_date,current_date) returning id`,
      [tenant, a, supplierA],
    )).rows[0].id;
    const conflict = (await db.query(
      `insert into produtos (tenant_id, cadastro_cte_haras_id, fornecedor_id, codigo, subitem, nome, valor, data_inicio, data_fim)
       values ($1,$2,$3,'MIG','02','Feno',1,current_date - 1,current_date - 1) returning id`,
      [tenant, a, supplierA],
    )).rows[0].id;
    await assert.rejects(db.query(schema), /múltiplos subitens/);
    await db.query("delete from produtos where id = $1", [conflict]);
    const migrationHorse = (await db.query("select id from equinos where nome = 'Cavalo legado'")).rows[0].id;
    await db.query(
      "insert into equinos_produtos (equino_id,produto_id) values ($1,$2)",
      [migrationHorse, migrationProduct],
    );
    await assert.rejects(db.query(schema), /vínculos de produtos com cavalos/);
    assert.equal((await db.query("select id from produtos where id = $1", [migrationProduct])).rowCount, 1);
    await db.query("delete from equinos_produtos");
    await db.query("update produtos set fornecedor_id = null where id = $1", [migrationProduct]);
    await assert.rejects(db.query(schema), /produtos sem fornecedor/);
    assert.equal((await db.query("select id from produtos where id = $1", [migrationProduct])).rowCount, 1);
    await db.query("update produtos set fornecedor_id = $1 where id = $2", [supplierA, migrationProduct]);
    await db.query(schema);
    await db.query(schema);
    assert.equal((await db.query("select id from produtos where id = $1", [migrationProduct])).rowCount, 1);
    const columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='produtos'")).rows.map((row) => row.column_name);
    assert(!columns.includes("subitem") && columns.includes("fornecedor_id"));
    assert.equal((await db.query("select to_regclass('public.equinos_produtos') as name")).rows[0].name, null);
    await db.query("delete from produtos where id = $1", [migrationProduct]);
    const dates = (await db.query(
      "select (current_date - 5)::text as inicio, current_date::text as hoje, (current_date + 1)::text as amanha",
    )).rows[0];
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
      env: { ...process.env, DATABASE_URL: url.toString(), NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString("hex") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => { output += chunk.toString(); });
    server.stderr.on("data", (chunk) => { output += chunk.toString(); });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(output);
      try { if ((await fetch(`${base}/login`)).ok) break; } catch {}
      if (attempt === 99) throw new Error(`Servidor não iniciou: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    async function login(email) {
      const cookies = new Map();
      async function request(target, options = {}) {
        const response = await fetch(`${base}${target}`, {
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
    const clientA = await login("a@test.invalid");
    const clientB = await login("b@test.invalid");
    const admin = await login("admin@test.invalid");
    const operational = await login("operacional@test.invalid");
    const clientPage = await (await clientA("/dashboard")).text();
    assert.match(clientPage, />Produtos</);
    assert.match(clientPage, /href="https:\/\/example\.com\/foto" target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(clientPage, /href="javascript:alert\(1\)"/);
    const productDates = await (await clientA("/api/products")).json();
    assert.equal(productDates.hoje, dates.hoje);
    assert.equal(productDates.amanha, dates.amanha);
    const input = {
      codigo: "P01", nova_vigencia: false, nome: "Produto A", marca: "Marca", fabricante: "Fabricante",
      descricao: "Descrição", valor: "12.50", data_inicio: dates.inicio, data_fim: "9999-12-31", fornecedor_id: supplierA,
    };
    async function create(request, fields) {
      return request("/api/products", {
        method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(fields),
      });
    }
    async function update(request, fields) {
      return request("/api/products", {
        method: "PATCH", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(fields),
      });
    }
    async function remove(request, id) {
      return request("/api/products", {
        method: "DELETE", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ id }),
      });
    }
    assert.equal((await fetch(`${base}/api/products`)).status, 403);
    assert.equal((await operational("/api/products")).status, 403);
    assert.equal((await create(admin, input)).status, 403);
    assert.equal((await clientA("/api/products", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    })).status, 403);
    assert.equal((await create(clientA, { ...input, data_inicio: "" })).status, 400);
    assert.equal((await create(clientA, { ...input, data_inicio: "2025-02-30" })).status, 400);
    assert.equal((await create(clientA, { ...input, data_fim: "2000-01-01" })).status, 400);
    assert.equal((await create(clientA, { ...input, valor: "1.999" })).status, 400);
    assert.equal((await create(clientA, { ...input, codigo: "ABC123" })).status, 400);
    assert.equal((await create(clientA, { ...input, codigo: "A-1" })).status, 400);
    assert.equal((await create(clientA, { ...input, subitem: "01" })).status, 400);
    assert.equal((await create(clientA, { ...input, fornecedor_id: "" })).status, 400);
    assert.equal((await create(clientA, { ...input, fornecedor_id: supplierB })).status, 400);
    assert.equal((await create(clientA, input)).status, 201);
    assert.equal((await create(clientB, { ...input, nome: "Produto B", fornecedor_id: supplierB })).status, 201);
    assert.equal((await create(clientA, input)).status, 409);
    const suppliersA = (await (await clientA("/api/suppliers")).json()).suppliers;
    assert.equal(suppliersA[0].id, supplierA);
    assert.equal(suppliersA[0].produtos, 1);
    assert.deepEqual((await (await clientA("/api/products")).json()).products.map((p) => p.nome), ["Produto A"]);
    assert.deepEqual((await (await clientB("/api/products")).json()).products.map((p) => p.nome), ["Produto B"]);
    const clientProductList = await (await clientA("/api/products")).json();
    assert.deepEqual(clientProductList.centers.map((center) => center.id), [a]);
    assert.equal(clientProductList.products[0].cadastro_cte_haras_id, a);
    assert.equal("subitem" in clientProductList.products[0], false);
    assert.equal(clientProductList.products[0].fornecedor_id, supplierA);
    await assert.rejects(db.query(
      `insert into produtos (tenant_id,cadastro_cte_haras_id,fornecedor_id,codigo,nome,valor,data_inicio,data_fim)
       values ($1,$2,$3,'ERR','Erro',1,current_date,current_date)`,
      [tenant, a, supplierB],
    ), { code: "23503" });
    const adminProductList = await (await admin("/api/products")).json();
    assert.equal(adminProductList.products.length, 2);
    assert.deepEqual(adminProductList.centers.map((center) => center.id), [a, b]);
    assert.deepEqual(adminProductList.products.map((product) => product.cadastro_cte_haras_id), [a, b]);
    assert.equal((await create(clientA, { ...input, nova_vigencia: true, fornecedor_id: supplierB })).status, 400);
    assert.equal((await (await clientA("/api/products")).json()).products[0].data_fim, "9999-12-31");

    const simultaneous = await Promise.all([
      create(clientA, { ...input, nova_vigencia: true, nome: "Nome adulterado", marca: "Outra marca", fabricante: "Outro fabricante", descricao: "Versão 2", valor: "20.00" }),
      create(clientA, { ...input, nova_vigencia: true, nome: "Nome concorrente", marca: "Outra marca", fabricante: "Outro fabricante", descricao: "Versão concorrente", valor: "25.00" }),
    ]);
    assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
    const products = (await (await clientA("/api/products")).json()).products;
    assert.equal(products.length, 2);
    assert.equal(products[0].data_inicio, dates.amanha);
    assert.equal(products[0].data_fim, "9999-12-31");
    assert.equal(products[0].nome, input.nome);
    assert.equal(products[0].marca, input.marca);
    assert.equal(products[0].fabricante, input.fabricante);
    assert(["Versão 2", "Versão concorrente"].includes(products[0].descricao));
    assert.equal(products[1].data_inicio, dates.inicio);
    assert.equal(products[1].data_fim, dates.hoje);
    assert.equal((await (await clientA("/api/suppliers")).json()).suppliers[0].produtos, 1);
    assert.equal((await create(clientA, { ...input, nova_vigencia: true })).status, 409);
    assert.equal((await (await clientB("/api/products")).json()).products[0].data_fim, "9999-12-31");

    const changes = { id: products[0].id, descricao: "Descrição alterada", valor: "35.75" };
    assert.equal((await update(admin, changes)).status, 403);
    assert.equal((await update(operational, changes)).status, 403);
    assert.equal((await update(clientB, changes)).status, 404);
    assert.equal((await update(clientA, { ...changes, nome: "Tentativa indevida" })).status, 400);
    assert.equal((await update(clientA, { ...changes, codigo: "TESTE" })).status, 400);
    assert.equal((await update(clientA, { ...changes, valor: "1.999" })).status, 400);
    assert.equal((await update(clientA, { ...changes, id: products[1].id })).status, 404);
    assert.equal((await clientA("/api/products", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(changes),
    })).status, 403);
    assert.equal((await update(clientA, changes)).status, 200);
    const updated = (await (await clientA("/api/products")).json()).products[0];
    assert.equal(updated.nome, input.nome);
    assert.equal(updated.marca, input.marca);
    assert.equal(updated.fabricante, input.fabricante);
    assert.equal(updated.descricao, changes.descricao);
    assert.equal(updated.valor, changes.valor);
    assert.equal(updated.data_inicio, dates.amanha);
    assert.equal(updated.data_fim, "9999-12-31");
    const endLimited = await create(clientA, { ...input, codigo: "FUTUR", data_inicio: dates.amanha, data_fim: "9998-12-31" });
    assert.equal(endLimited.status, 201);
    const endLimitedId = (await endLimited.json()).id;
    assert.equal((await update(clientA, { ...changes, id: endLimitedId })).status, 404);
    const startsToday = await create(clientA, { ...input, codigo: "HOJE", data_inicio: dates.hoje });
    assert.equal(startsToday.status, 201);
    const startsTodayId = (await startsToday.json()).id;
    assert.equal((await update(clientA, { ...changes, id: startsTodayId })).status, 404);

    assert.equal((await remove(admin, products[0].id)).status, 403);
    assert.equal((await remove(operational, products[0].id)).status, 403);
    assert.equal((await remove(clientB, products[0].id)).status, 404);
    assert.equal((await remove(clientA, "inválido")).status, 400);
    assert.equal((await remove(clientA, startsTodayId)).status, 404);
    assert.equal((await remove(clientA, products[1].id)).status, 404);
    assert.equal((await remove(clientA, endLimitedId)).status, 404);
    assert.equal((await clientA("/api/products", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: products[0].id }),
    })).status, 403);

    const older = (await db.query(
      `insert into produtos
       (tenant_id, cadastro_cte_haras_id, criado_por, codigo, nome, marca, fabricante, descricao, valor, data_inicio, data_fim, fornecedor_id)
       values ($1,$2,$3,'P01','Produto A','Marca','Fabricante','Histórico antigo',10,$4::date - 2,$4::date - 1,$5)
       returning id`,
      [tenant, a, userA, dates.inicio, supplierA],
    )).rows[0].id;
    await db.query("update produtos set data_fim = current_date - 1 where id = $1", [products[1].id]);
    await db.query("update produtos set data_fim = '9998-12-31' where id = $1", [products[0].id]);
    assert.equal((await remove(clientA, products[0].id)).status, 404);
    assert.equal((await db.query("select id from produtos where id = $1", [products[0].id])).rowCount, 1);
    await db.query("update produtos set data_fim = '9999-12-31' where id = $1", [products[0].id]);
    const deletions = await Promise.all([remove(clientA, products[0].id), remove(clientA, products[0].id)]);
    assert.deepEqual(deletions.map((response) => response.status).sort(), [200, 404]);
    assert.equal((await deletions.find((response) => response.status === 200).json()).reactivated, true);
    const remaining = (await (await clientA("/api/products")).json()).products;
    assert(!remaining.some((product) => product.id === products[0].id));
    assert.equal(remaining.find((product) => product.id === products[1].id).data_fim, "9999-12-31");
    assert.equal(remaining.find((product) => product.id === older).descricao, "Histórico antigo");
    assert.equal((await (await clientB("/api/products")).json()).products[0].data_fim, "9999-12-31");

    const single = await create(clientA, { ...input, codigo: "UNICO", data_inicio: dates.amanha });
    assert.equal(single.status, 201);
    const singleDeletion = await remove(clientA, (await single.json()).id);
    assert.equal(singleDeletion.status, 200);
    assert.deepEqual(await singleDeletion.json(), { deleted: true, reactivated: false });

    const versions = (await db.query(
      `insert into produtos (tenant_id, cadastro_cte_haras_id, codigo, nome, valor, data_inicio, data_fim, fornecedor_id)
       values ($1,$2,'SEQ','Teste',1,current_date - 4,current_date - 2,$4),
              ($1,$2,'SEQ','Teste',1,current_date + 1,'9999-12-31',$4),
              ($1,$2,'SEQ','Teste',1,current_date + 3,'9998-12-31',$4),
              ($1,$3,'SEQ','Teste',1,current_date - 1,current_date,$5)
       returning id,cadastro_cte_haras_id,data_inicio::text,data_fim::text`,
      [tenant, a, b, supplierA, supplierB],
    )).rows;
    const target = versions.find((item) => item.cadastro_cte_haras_id === a && item.data_fim === "9999-12-31");
    const latest = versions.find((item) => item.cadastro_cte_haras_id === a && item.data_fim === "9998-12-31");
    const earlier = versions.find((item) => item.cadastro_cte_haras_id === a && item.id !== target.id && item.id !== latest.id);
    const otherRegistration = versions.find((item) => item.cadastro_cte_haras_id === b);
    assert.equal((await remove(clientA, target.id)).status, 200);
    const afterRemoval = (await db.query(
      "select id,data_fim::text from produtos where id = any($1::uuid[])",
      [[latest.id, earlier.id, otherRegistration.id]],
    )).rows;
    assert.equal(afterRemoval.find((item) => item.id === latest.id).data_fim, "9999-12-31");
    assert.equal(afterRemoval.find((item) => item.id === otherRegistration.id).data_fim, otherRegistration.data_fim);
    assert.equal(afterRemoval.find((item) => item.id === earlier.id).data_fim, earlier.data_fim);
    await db.query("delete from produtos where id = any($1::uuid[])", [versions.map((item) => item.id)]);

    async function horseAction(request, fields) {
      return request("/api/actions", {
        method: "POST", headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ action: "createHorse", nome: "Cavalo novo", ...fields }),
      });
    }
    const createdHorse = await horseAction(clientA, { valor_mensalidade: 85.67 });
    assert.equal(createdHorse.status, 201);
    const horseId = (await createdHorse.json()).horse.id;
    assert.equal((await db.query("select valor_mensalidade::text as valor from equinos where id = $1", [horseId])).rows[0].valor, "85.67");
    assert.equal((await horseAction(operational, {})).status, 201);
    assert.equal((await horseAction(admin, {})).status, 403);
    assert.equal((await horseAction(clientA, { produtos: {} })).status, 400);
    assert.equal((await clientA("/api/horse-products")).status, 404);

    await db.query("delete from usuarios where email = 'a@test.invalid'");
    const retained = await db.query("select criado_por from produtos where cadastro_cte_haras_id = $1", [a]);
    assert(retained.rowCount > 0);
    assert(retained.rows.every((row) => row.criado_por === null));
    await db.query("delete from cadastros_cte_haras where id = $1", [b]);
    assert.equal((await db.query("select id from produtos where cadastro_cte_haras_id = $1", [b])).rowCount, 0);
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (db) await db.end();
    if (created) await bootstrap.query(`drop database "${name}"`);
    await bootstrap.end();
  }
});
