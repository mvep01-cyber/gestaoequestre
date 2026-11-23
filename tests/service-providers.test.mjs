import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

test("prestadores, funcionários e fornecedores são compartilhados e protegidos por centro", { timeout: 120000 }, async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é necessária para o teste.");
  const name = `test_prestadores_${randomBytes(8).toString("hex")}`;
  const bootstrap = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  let db, server, created = false, output = "";
  try {
    await bootstrap.query(`create database "${name}"`);
    created = true;
    db = new pg.Pool({ connectionString: url.toString() });
    const schema = await readFile("database/schema.sql", "utf8");
    await db.query(schema);
    await db.query(schema);
    const tenant = (await db.query("insert into tenants (nome, plano) values ('Teste', 'CTE') returning id")).rows[0].id;
    async function center(name) {
      return (await db.query(
        `insert into cadastros_cte_haras
         (tenant_id,tipo_cadastro,nome,telefone_whatsapp,documento,cpf,rg,data_nascimento,idade,profissao,endereco_completo,numero_socio_abccmm,data_inicio,data_fim)
         values ($1,'CTE',$2,'1','1','1','1','2000-01-01',26,'Teste','Teste',1,'2020-01-01','9999-12-31') returning id`,
        [tenant, name],
      )).rows[0].id;
    }
    const a = await center("Centro A"), b = await center("Centro B");
    const legacy = (await db.query(
      "insert into prestadores_servicos (tenant_id, cadastro_cte_haras_id, nome) values ($1,$2,'Cadastro anterior') returning id",
      [tenant, a],
    )).rows[0].id;
    await db.query("alter table prestadores_servicos drop column complemento");
    await db.query(schema);
    assert.deepEqual((await db.query("select nome, complemento from prestadores_servicos where id=$1", [legacy])).rows[0],
      { nome: "Cadastro anterior", complemento: "" });
    await db.query("delete from prestadores_servicos where id=$1", [legacy]);
    const password = randomBytes(24).toString("hex"), hash = await bcrypt.hash(password, 10);
    async function user(email, role, centerId = null) {
      await db.query(
        "insert into usuarios (tenant_id,cadastro_cte_haras_id,nome,email,senha_hash,perfil) values ($1,$2,$3,$3,$4,$5)",
        [tenant, centerId, email, hash, role],
      );
    }
    await user("a@test.invalid", "CLIENTE", a);
    await user("a2@test.invalid", "CLIENTE", a);
    await user("b@test.invalid", "CLIENTE", b);
    await user("admin@test.invalid", "ADMIN");
    await user("operacional@test.invalid", "OPERACIONAL");
    const port = await new Promise((resolve, reject) => {
      const socket = net.createServer();
      socket.once("error", reject);
      socket.listen(0, "127.0.0.1", () => { const selected = socket.address().port; socket.close(() => resolve(selected)); });
    });
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.toString(), NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString("hex") },
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
          ...options, redirect: "manual", headers: { ...options.headers, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
        });
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(";")[0], index = pair.indexOf("=");
          cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      }
      const csrf = await (await request("/api/auth/csrf")).json();
      await request("/api/auth/callback/credentials", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
      });
      assert.equal((await (await request("/api/auth/session")).json()).user.email, email);
      return request;
    }
    const clientA = await login("a@test.invalid"), clientA2 = await login("a2@test.invalid");
    const clientB = await login("b@test.invalid"), admin = await login("admin@test.invalid");
    const operational = await login("operacional@test.invalid");
    const input = {
      nome: "Prestador A", cpf: "", rg: "", endereco: "", cep: "", bairro: "", cidade: "",
      estado: "MG", telefone: "", email: "teste@exemplo.invalid", servicos: "Veterinária, Ferrageamento",
    };
    const write = (request, method, data, origin = base) => request("/api/service-providers", {
      method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(data),
    });
    assert.equal((await fetch(`${base}/api/service-providers`)).status, 403);
    assert.equal((await operational("/api/service-providers")).status, 403);
    assert.equal((await write(clientA, "POST", input, "")).status, 403);
    assert.equal((await write(clientA, "POST", { ...input, nome: " " })).status, 400);
    assert.equal((await write(clientA, "POST", { ...input, estado: "XX" })).status, 400);
    assert.equal((await write(clientA, "POST", { ...input, email: "incorreto" })).status, 400);
    assert.equal((await write(clientA, "POST", { ...input, complemento: "x".repeat(31) })).status, 400);
    const createdA = await write(clientA, "POST", { ...input, cadastro_cte_haras_id: b });
    assert.equal(createdA.status, 201);
    const id = (await createdA.json()).id;
    const saved = (await (await clientA2("/api/service-providers")).json()).providers[0];
    assert.equal(saved.id, id);
    assert.equal(saved.complemento, "");
    assert.equal((await (await clientB("/api/service-providers")).json()).providers.length, 0);
    assert.equal((await write(clientB, "PATCH", { ...input, id, nome: "Alteração indevida" })).status, 404);
    const complemento = "x".repeat(30);
    assert.equal((await write(clientA2, "PATCH", { ...input, id, nome: "Prestador alterado", complemento })).status, 200);
    let updated = (await (await clientA("/api/service-providers")).json()).providers[0];
    assert.equal(updated.nome, "Prestador alterado");
    assert.equal(updated.complemento, complemento);
    assert.equal((await write(clientA2, "PATCH", { ...input, id, complemento: "x".repeat(31) })).status, 400);
    assert.equal((await write(clientA2, "PATCH", { ...input, id })).status, 200);
    assert.equal((await (await clientA("/api/service-providers")).json()).providers[0].complemento, complemento);
    assert.equal((await write(clientA2, "PATCH", { ...input, id, complemento: "" })).status, 200);
    updated = (await (await clientA("/api/service-providers")).json()).providers[0];
    assert.equal(updated.complemento, "");
    await assert.rejects(db.query("update prestadores_servicos set complemento=$1 where id=$2", ["x".repeat(31), id]), { code: "22001" });
    assert.equal((await write(admin, "POST", { ...input, cadastro_cte_haras_id: b, nome: "Prestador B" })).status, 201);
    assert.equal((await (await clientB("/api/service-providers")).json()).providers[0].nome, "Prestador B");
    assert.equal((await (await admin("/api/service-providers")).json()).providers.length, 2);
    assert.equal((await write(operational, "PATCH", { ...input, id })).status, 403);
    assert.match(await (await clientA("/dashboard")).text(), /Prestação de Serviços/);

    const employee = {
      nome: "Funcionário A", cpf: "", rg: "", endereco: "", cep: "", bairro: "", cidade: "",
      estado: "MG", telefone: "", email: "", cargo: "Tratador", tipo_contratacao: "Diarista", valor: "150.25",
    };
    const writeEmployee = (request, method, data, origin = base) => request("/api/employees", {
      method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(data),
    });
    assert.equal((await fetch(`${base}/api/employees`)).status, 403);
    assert.equal((await operational("/api/employees")).status, 403);
    assert.equal((await writeEmployee(clientA, "POST", employee, "")).status, 403);
    for (const invalid of [
      { nome: " " }, { estado: "XX" }, { email: "inválido" }, { tipo_contratacao: "Autônomo" },
      { valor: "-1" }, { valor: "1.001" }, { valor: "10000000000" }, { valor: "NaN" },
    ]) {
      assert.equal((await writeEmployee(clientA, "POST", { ...employee, ...invalid })).status, 400);
    }
    const createdEmployee = await writeEmployee(clientA, "POST", { ...employee, cadastro_cte_haras_id: b });
    assert.equal(createdEmployee.status, 201);
    const employeeId = (await createdEmployee.json()).id;
    const employeeA = (await (await clientA2("/api/employees")).json()).employees[0];
    assert.equal(employeeA.id, employeeId);
    assert.equal(employeeA.cadastro_cte_haras_id, a);
    assert.equal(employeeA.valor, "150.25");
    assert.equal((await (await clientB("/api/employees")).json()).employees.length, 0);
    assert.equal((await writeEmployee(clientB, "PATCH", { ...employee, id: employeeId })).status, 404);
    assert.equal((await writeEmployee(clientA2, "PATCH", { ...employee, id: employeeId, tipo_contratacao: "Mensalista", valor: "0" })).status, 200);
    const changed = (await (await clientA("/api/employees")).json()).employees[0];
    assert.equal(changed.tipo_contratacao, "Mensalista");
    assert.equal(changed.valor, "0.00");
    assert.equal((await writeEmployee(admin, "POST", { ...employee, cadastro_cte_haras_id: b, nome: "Funcionário B", tipo_contratacao: "", valor: "" })).status, 201);
    const employeeB = (await (await clientB("/api/employees")).json()).employees[0];
    assert.equal(employeeB.nome, "Funcionário B");
    assert.equal(employeeB.valor, null);
    assert.equal((await (await admin("/api/employees")).json()).employees.length, 2);
    assert.equal((await writeEmployee(operational, "PATCH", { ...employee, id: employeeId })).status, 403);
    assert.match(await (await clientA("/dashboard")).text(), /Funcionários/);
    assert.doesNotMatch(await (await operational("/dashboard")).text(), /Funcionários/);

    const supplier = {
      nome: "Fornecedor A", cnpj_cpf: "", endereco: "", cep: "", bairro: "", cidade: "",
      estado: "São Paulo", telefone: "", nome_vendedor: "", telefone_vendedor: "", email: "",
    };
    const writeSupplier = (request, method, data, origin = base) => request("/api/suppliers", {
      method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(data),
    });
    assert.equal((await fetch(`${base}/api/suppliers`)).status, 403);
    assert.equal((await operational("/api/suppliers")).status, 403);
    assert.equal((await writeSupplier(clientA, "POST", supplier, "")).status, 403);
    assert.equal((await writeSupplier(clientA, "POST", { ...supplier, nome: "" })).status, 400);
    assert.equal((await writeSupplier(clientA, "POST", { ...supplier, email: "inválido" })).status, 400);
    const createdSupplier = await writeSupplier(clientA, "POST", { ...supplier, cadastro_cte_haras_id: b });
    assert.equal(createdSupplier.status, 201);
    const supplierId = (await createdSupplier.json()).id;
    const supplierA = (await (await clientA2("/api/suppliers")).json()).suppliers[0];
    assert.equal(supplierA.cadastro_cte_haras_id, a);
    assert.equal(supplierA.produtos, 0);
    assert.equal((await (await clientB("/api/suppliers")).json()).suppliers.length, 0);
    assert.equal((await writeSupplier(clientB, "PATCH", { ...supplier, id: supplierId })).status, 404);
    assert.equal((await writeSupplier(clientA2, "PATCH", { ...supplier, id: supplierId, nome: "Fornecedor alterado" })).status, 200);
    assert.equal((await (await clientA("/api/suppliers")).json()).suppliers[0].nome, "Fornecedor alterado");
    assert.equal((await writeSupplier(admin, "POST", { ...supplier, cadastro_cte_haras_id: b, nome: "Fornecedor B" })).status, 201);
    assert.equal((await (await clientB("/api/suppliers")).json()).suppliers[0].nome, "Fornecedor B");
    assert.equal((await (await admin("/api/suppliers")).json()).suppliers.length, 2);
    assert.equal((await writeSupplier(operational, "PATCH", { ...supplier, id: supplierId })).status, 403);
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
