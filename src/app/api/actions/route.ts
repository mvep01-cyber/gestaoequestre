import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";
import { hash } from "bcryptjs";

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

const clientAccountActions = new Set([
  "createHorse",
  "updateHorse",
  "deleteHorse",
  "createClient",
  "updateClient",
]);

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

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function parseOptionalText(
  value: unknown,
  maxLength: number,
): { value: string | null; valid: boolean } {
  if (value === undefined || value === null) {
    return { value: null, valid: true };
  }
  if (typeof value !== "string") {
    return { value: null, valid: false };
  }
  const text = value.trim();
  if (text.length > maxLength) {
    return { value: null, valid: false };
  }
  return { value: text || null, valid: true };
}

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return isDateOnly(value) ? value : undefined;
}

const horseCoatTypes = [
  "Branco",
  "Preto",
  "Alazão",
  "Baio",
  "Castanha",
  "Tordilha",
  "Rosilha",
  "Pampa de Preto",
  "Pampa de Marrom",
  "Pampa de Castanho",
  "Pampa de Alazão",
] as const;

type HorseInput = {
  nome_proprietario: string;
  proprietario_id: string | null;
  nome_treinador: string;
  nome: string;
  foto_url: string | null;
  baia: string | null;
  raca: string[];
  sexo: "MACHO" | "FEMEA" | "INDEFINIDO";
  data_nascimento: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  pelagem: string | null;
  categoria: "ATLETA" | "MATRIZ" | "GARANHAO" | "POTRO" | "RECEPTORA";
  status: "EM_TREINO" | "EM_TRATAMENTO" | "DESCANSO";
  registro_associacao: string | null;
  chip_resenha: string | null;
  alimentacao_diaria: string | null;
  valor_mensalidade: number;
};

function parseHorseInput(body: Record<string, unknown>): HorseInput | null {
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const proprietario = parseOptionalText(body.nome_proprietario, 120);
  const rawOwnerId = body.proprietario_id;
  const proprietarioId =
    rawOwnerId === undefined || rawOwnerId === null || rawOwnerId === ""
      ? null
      : isUuid(rawOwnerId)
        ? rawOwnerId
        : undefined;
  const treinador = parseOptionalText(body.nome_treinador, 120);
  const fotoUrl = parseOptionalText(body.foto_url, 2000);
  const baia = parseOptionalText(body.baia, 40);
  const nomePai = parseOptionalText(body.nome_pai, 120);
  const nomeMae = parseOptionalText(body.nome_mae, 120);
  const registro = parseOptionalText(body.registro_associacao, 80);
  const chip = parseOptionalText(body.chip_resenha, 120);
  const alimentacao = parseOptionalText(body.alimentacao_diaria, 1000);
  const mensalidade = parseOptionalDecimal(body.valor_mensalidade);
  const dataNascimento = parseOptionalDate(body.data_nascimento);
  const sexo = body.sexo === undefined ? "INDEFINIDO" : body.sexo;
  const pelagem = parseOptionalText(body.pelagem, 40);
  const categoria = body.categoria === undefined ? "ATLETA" : body.categoria;
  const status = body.status === undefined ? "DESCANSO" : body.status;
  const rawBreeds = body.raca;
  const breedsValid =
    rawBreeds === undefined ||
    rawBreeds === null ||
    typeof rawBreeds === "string" ||
    Array.isArray(rawBreeds);
  const breeds: unknown[] = Array.isArray(rawBreeds)
    ? rawBreeds
    : typeof rawBreeds === "string"
      ? rawBreeds.split(",")
      : [];
  const raca = breeds
    .map((breed) => (typeof breed === "string" ? breed.trim() : ""))
    .filter(Boolean);
  const fee = mensalidade.value ?? 0;

  if (
    !nome ||
    nome.length > 120 ||
    !proprietario.valid ||
    proprietarioId === undefined ||
    !treinador.valid ||
    !fotoUrl.valid ||
    !isHttpUrl(fotoUrl.value) ||
    !baia.valid ||
    !nomePai.valid ||
    !nomeMae.valid ||
    !registro.valid ||
    !chip.valid ||
    !alimentacao.valid ||
    !mensalidade.valid ||
    fee < 0 ||
    fee > 9999999999.99 ||
    Math.abs(fee * 100 - Math.round(fee * 100)) > 0.000001 ||
    !pelagem.valid ||
    !horseCoatValid(pelagem.value) ||
    dataNascimento === undefined ||
    (sexo !== "MACHO" && sexo !== "FEMEA" && sexo !== "INDEFINIDO") ||
    (categoria !== "ATLETA" &&
      categoria !== "MATRIZ" &&
      categoria !== "GARANHAO" &&
      categoria !== "POTRO" &&
      categoria !== "RECEPTORA") ||
    (status !== "EM_TREINO" &&
      status !== "EM_TRATAMENTO" &&
      status !== "DESCANSO") ||
    !breedsValid ||
    breeds.length > 20 ||
    (Array.isArray(rawBreeds) &&
      rawBreeds.some((breed) => typeof breed !== "string")) ||
    raca.some((breed) => breed.length > 80) ||
    raca.join(", ").length > 500
  ) {
    return null;
  }

  return {
    nome_proprietario: proprietario.value ?? "",
    proprietario_id: proprietarioId,
    nome_treinador: treinador.value ?? "",
    nome,
    foto_url: fotoUrl.value,
    baia: baia.value,
    raca,
    sexo,
    data_nascimento: dataNascimento,
    nome_pai: nomePai.value,
    nome_mae: nomeMae.value,
    pelagem: pelagem.value,
    categoria,
    status,
    registro_associacao: registro.value,
    chip_resenha: chip.value,
    alimentacao_diaria: alimentacao.value,
    valor_mensalidade: fee,
  };
}

function isHttpUrl(value: string | null) {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function horseCoatValid(value: string | null) {
  return value === null || horseCoatTypes.some((coat) => coat === value);
}

async function fetchHorseForResponse(
  pool: ReturnType<typeof getPool>,
  tenantId: string,
  horseId: string,
  isManager: boolean,
  userId: string,
) {
  const result = await pool.query(
    `select e.id, e.proprietario_id, e.nome_proprietario, e.nome_treinador,
            e.nome, e.foto_url, e.baia, e.raca, e.sexo,
            e.data_nascimento::text as data_nascimento, e.nome_pai, e.nome_mae,
            e.pelagem, e.categoria, e.status, e.registro_associacao,
            e.chip_resenha, e.alimentacao_diaria,
            e.valor_mensalidade::double precision as valor_mensalidade,
            e.created_at::text as created_at
     from public.equinos as e
     where e.id = $1 and e.tenant_id = $2 and e.excluido_em is null
       and ($3::boolean or e.criado_por = $4)`,
    [horseId, tenantId, isManager, userId],
  );
  return result.rows[0];
}

async function resolveHorseOwner(
  pool: ReturnType<typeof getPool>,
  tenantId: string,
  userId: string,
  ownerId: string | null,
  clientAccount: boolean,
  providedName: string,
) {
  if (!clientAccount) {
    return { id: null, name: providedName || null };
  }
  if (!ownerId) {
    return { id: null, name: null };
  }

  const result = await pool.query<{ id: string; nome: string }>(
    `select id, nome
     from public.proprietarios
     where id = $1 and tenant_id = $2 and criado_por = $3
     limit 1`,
    [ownerId, tenantId, userId],
  );
  const owner = result.rows[0];
  return owner ? { id: owner.id, name: owner.nome } : null;
}

function getMissingClientField(body: Record<string, unknown>): string | null {
  const requiredTextFields: [string, string][] = [
    ["nome", "Nome do cliente"],
    ["telefone_whatsapp", "Telefone WhatsApp"],
    ["documento", "Documento"],
    ["cpf", "CPF"],
    ["rg", "RG"],
    ["data_nascimento", "Data de nascimento"],
    ["profissao", "Profissão"],
    ["endereco_completo", "Endereço completo"],
  ];

  for (const [field, label] of requiredTextFields) {
    const value = body[field];
    if (typeof value !== "string" || !value.trim()) {
      return label;
    }
  }

  const memberNumber = body.numero_socio_abccmm;
  if (
    memberNumber === undefined ||
    memberNumber === null ||
    memberNumber === "" ||
    (typeof memberNumber === "string" && !memberNumber.trim())
  ) {
    return "Número de sócio ABCCMM";
  }

  const requiredDateFields: [string, string][] = [
    ["data_inicio", "Data de início"],
    ["data_fim", "Data de fim"],
  ];
  for (const [field, label] of requiredDateFields) {
    const value = body[field];
    if (typeof value !== "string" || !value.trim()) {
      return label;
    }
  }
  return null;
}

function parseDecimalField(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(5));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(5));
}

function parseOptionalDecimal(
  value: unknown,
): { value: number | null; valid: boolean } {
  if (value === undefined || value === null || value === "") {
    return { value: null, valid: true };
  }
  const parsed = parseDecimalField(value);
  return { value: parsed, valid: parsed !== null };
}

function calculateAge(dateOfBirth: string): number {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = today.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

type ClientFields = {
  nome: string;
  telefone_whatsapp: string;
  documento: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  idade: number;
  profissao: string;
  endereco_completo: string;
  numero_socio_abccmm: number;
  data_inicio: string;
  data_fim: string;
};

type ClientFieldsValidation =
  | { valid: true; fields: ClientFields }
  | { valid: false; message: string };

function validateClientFields(body: Record<string, unknown>): ClientFieldsValidation {
  const missingField = getMissingClientField(body);
  if (missingField) {
    return { valid: false, message: `${missingField} - Preenchimento Obrigatório.` };
  }

  const nome = sanitizeText(body.nome, 120);
  const telefone = parseOptionalText(body.telefone_whatsapp, 20);
  const documento = parseOptionalText(body.documento, 40);
  const cpf = parseOptionalText(body.cpf, 20);
  const rg = parseOptionalText(body.rg, 30);
  const profissao = parseOptionalText(body.profissao, 120);
  const enderecoCompleto = parseOptionalText(body.endereco_completo, 400);
  const numeroSocio = parseOptionalDecimal(body.numero_socio_abccmm);

  if (!nome) {
    return { valid: false, message: "Informe um nome válido para o cliente." };
  }
  if (
    !telefone.valid ||
    !telefone.value ||
    !documento.valid ||
    !documento.value ||
    !cpf.valid ||
    !cpf.value ||
    !rg.valid ||
    !rg.value ||
    !profissao.valid ||
    !profissao.value ||
    !enderecoCompleto.valid ||
    !enderecoCompleto.value
  ) {
    return { valid: false, message: "Confira o tamanho e o formato dos dados informados." };
  }
  if (cpf.value.replace(/\D/g, "").length !== 11) {
    return { valid: false, message: "CPF deve conter 11 dígitos." };
  }

  const dataNascimento = parseOptionalDate(body.data_nascimento);
  const dataInicio = parseOptionalDate(body.data_inicio);
  const dataFim = parseOptionalDate(body.data_fim);
  if (!dataNascimento) {
    return { valid: false, message: "Data de nascimento inválida." };
  }
  if (!dataInicio || !dataFim) {
    return { valid: false, message: "Data de início ou fim inválida." };
  }
  if (dataFim < dataInicio) {
    return { valid: false, message: "A data fim não pode ser anterior à data de início." };
  }
  if (
    !numeroSocio.valid ||
    numeroSocio.value === null ||
    numeroSocio.value < 0 ||
    numeroSocio.value > 999999.99999
  ) {
    return { valid: false, message: "Número do sócio ABCCMM inválido." };
  }

  return {
    valid: true,
    fields: {
      nome,
      telefone_whatsapp: telefone.value,
      documento: documento.value,
      cpf: cpf.value,
      rg: rg.value,
      data_nascimento: dataNascimento,
      idade: calculateAge(dataNascimento),
      profissao: profissao.value,
      endereco_completo: enderecoCompleto.value,
      numero_socio_abccmm: numeroSocio.value,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
  };
}

function isRegistrationType(value: unknown): value is "CTE" | "HARAS" {
  return value === "CTE" || value === "HARAS";
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
  const isClientAccount =
    user.perfil === "CLIENTE" &&
    (user.tipo_cadastro === "CTE" || user.tipo_cadastro === "HARAS");
  const canManageHorses =
    hasTenant &&
    (user.perfil === "ADMIN" || user.perfil === "OPERACIONAL" || isClientAccount);
  const canManageClients =
    hasTenant &&
    (user.perfil === "ADMIN" || user.perfil === "OPERACIONAL" || isClientAccount);
  if (
    user.perfil === "CLIENTE" &&
    (!isClientAccount || !clientAccountActions.has(body.action))
  ) {
    return errorResponse("Este acesso não tem permissão para esta ação.", 403);
  }
  const pool = getPool();

  try {
    switch (body.action) {
      case "createHorse": {
        if (!canManageHorses) {
          return errorResponse("Ação permitida somente a usuários do centro.", 403);
        }
        const fields = parseHorseInput(body);
        if (!fields) {
          return errorResponse(
            "Confira os dados do cavalo e os valores informados.",
            400,
          );
        }
        const owner = await resolveHorseOwner(
          pool,
          user.tenant_id!,
          user.id,
          fields.proprietario_id,
          isClientAccount,
          fields.nome_proprietario,
        );
        if (!owner) {
          return errorResponse("Proprietário não encontrado no seu cadastro.", 403);
        }
        const result = await pool.query<{ id: string }>(
          `insert into public.equinos (
             tenant_id, criado_por, nome_proprietario, proprietario_id,
             nome_treinador, nome, foto_url, baia, raca,
             sexo, data_nascimento, nome_pai, nome_mae, pelagem, categoria, status,
             registro_associacao, chip_resenha, alimentacao_diaria, valor_mensalidade,
             origem
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12,
             $13, $14, $15, $16, $17, $18, $19, $20, 'PROPRIO'
           )
           returning id`,
          [
            user.tenant_id,
            user.id,
            owner.name,
            owner.id,
            fields.nome_treinador,
            fields.nome,
            fields.foto_url,
            fields.baia,
            fields.raca,
            fields.sexo,
            fields.data_nascimento,
            fields.nome_pai,
            fields.nome_mae,
            fields.pelagem,
            fields.categoria,
            fields.status,
            fields.registro_associacao,
            fields.chip_resenha,
            fields.alimentacao_diaria,
            fields.valor_mensalidade,
          ],
        );
        const horse = await fetchHorseForResponse(
          pool,
          user.tenant_id!,
          result.rows[0].id,
          isManager,
          user.id,
        );
        if (!horse) {
          return errorResponse("Não foi possível carregar o cavalo cadastrado.", 500);
        }
        return Response.json({ horse }, { status: 201 });
      }

      case "updateHorse": {
        if (!canManageHorses) {
          return errorResponse("Ação permitida somente a usuários do centro.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cavalo inválido.", 400);
        }
        const fields = parseHorseInput(body);
        if (!fields) {
          return errorResponse(
            "Confira os dados do cavalo e os valores informados.",
            400,
          );
        }
        const owner = await resolveHorseOwner(
          pool,
          user.tenant_id!,
          user.id,
          fields.proprietario_id,
          isClientAccount,
          fields.nome_proprietario,
        );
        if (!owner) {
          return errorResponse("Proprietário não encontrado no seu cadastro.", 403);
        }
        const result = await pool.query<{ id: string }>(
          `update public.equinos
           set nome_proprietario = $1, proprietario_id = $2,
               nome_treinador = $3, nome = $4, foto_url = $5, baia = $6,
               raca = $7, sexo = $8, data_nascimento = $9::date,
               nome_pai = $10, nome_mae = $11, pelagem = $12,
               categoria = $13, status = $14, registro_associacao = $15,
               chip_resenha = $16, alimentacao_diaria = $17, valor_mensalidade = $18
           where id = $19 and tenant_id = $20 and excluido_em is null
             and ($21::boolean or criado_por = $22)
           returning id`,
          [
            owner.name,
            owner.id,
            fields.nome_treinador,
            fields.nome,
            fields.foto_url,
            fields.baia,
            fields.raca,
            fields.sexo,
            fields.data_nascimento,
            fields.nome_pai,
            fields.nome_mae,
            fields.pelagem,
            fields.categoria,
            fields.status,
            fields.registro_associacao,
            fields.chip_resenha,
            fields.alimentacao_diaria,
            fields.valor_mensalidade,
            body.id,
            user.tenant_id,
            isManager,
            user.id,
          ],
        );
        if (!result.rowCount) {
          return errorResponse("Cavalo não encontrado neste centro.", 404);
        }
        const horse = await fetchHorseForResponse(
          pool,
          user.tenant_id!,
          result.rows[0].id,
          isManager,
          user.id,
        );
        if (!horse) {
          return errorResponse("Não foi possível carregar o cavalo atualizado.", 500);
        }
        return Response.json({ horse });
      }

      case "deleteHorse": {
        if (!canManageHorses) {
          return errorResponse("Ação permitida somente a usuários do centro.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cavalo inválido.", 400);
        }
        const result = await pool.query(
          `update public.equinos
           set excluido_em = now()
           where id = $1 and tenant_id = $2 and excluido_em is null
             and ($3::boolean or criado_por = $4)
           returning id`,
          [body.id, user.tenant_id, isManager, user.id],
        );
        if (!result.rowCount) {
          return errorResponse("Cavalo não encontrado neste centro.", 404);
        }
        return Response.json({ deleted: true });
      }

      case "applyMedication": {
        if (!hasTenant || !isUuid(body.id)) {
          return errorResponse("Aplicação inválida.", 400);
        }
        const result = await pool.query(
          `update public.medicamentos_aplicacoes as ma
           set status = 'APLICADO', aplicado_por = $1, aplicado_em = now()
           where ma.id = $2 and ma.tenant_id = $3 and ma.status = 'PENDENTE'
             and exists (
               select 1
               from public.tratamentos_medicamentos as tm
               join public.equinos as e
                 on e.id = tm.equino_id and e.tenant_id = tm.tenant_id
               where tm.id = ma.tratamento_id
                 and tm.tenant_id = ma.tenant_id
                 and ($4::boolean or e.criado_por = $5)
             )
           returning id`,
          [user.id, body.id, user.tenant_id, isManager, user.id],
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
          `update public.agenda_treinos as at
           set status = 'CONCLUIDO'
           where at.id = $1 and at.tenant_id = $2 and at.status = 'PENDENTE'
             and exists (
               select 1
               from public.equinos as e
               where e.id = at.equino_id
                 and e.tenant_id = at.tenant_id
                 and ($3::boolean or e.criado_por = $4)
             )
           returning id`,
          [body.id, user.tenant_id, isManager, user.id],
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
          where tenant_id = $1 and id = any($2::uuid[]) and excluido_em is null`,
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

      case "createClient": {
        if (!canManageClients) {
          return errorResponse("Ação permitida somente a usuários vinculados a um centro.", 403);
        }
        const validation = validateClientFields(body);
        if (!validation.valid) {
          return errorResponse(validation.message, 400);
        }
        const fields = validation.fields;

        const result = await pool.query(
          `insert into public.proprietarios (
             tenant_id, criado_por, nome, telefone_whatsapp, documento, cpf, rg,
             data_nascimento, idade, profissao, endereco_completo,
             numero_socio_abccmm, data_inicio, data_fim
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13::date, $14::date)
           returning id, nome, telefone_whatsapp, documento, cpf, rg,
             data_nascimento::text as data_nascimento, idade, profissao,
             endereco_completo, numero_socio_abccmm,
             data_inicio::text as data_inicio, data_fim::text as data_fim`,
          [
            user.tenant_id,
            user.id,
            fields.nome,
            fields.telefone_whatsapp,
            fields.documento,
            fields.cpf,
            fields.rg,
            fields.data_nascimento,
            fields.idade,
            fields.profissao,
            fields.endereco_completo,
            fields.numero_socio_abccmm,
            fields.data_inicio,
            fields.data_fim,
          ],
        );
        return Response.json({ client: result.rows[0] }, { status: 201 });
      }

      case "updateClient": {
        if (!canManageClients) {
          return errorResponse("Ação permitida somente a usuários vinculados a um centro.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cliente inválido.", 400);
        }
        const validation = validateClientFields(body);
        if (!validation.valid) {
          return errorResponse(validation.message, 400);
        }
        const fields = validation.fields;

        const result = await pool.query(
          `update public.proprietarios
           set nome = $1, telefone_whatsapp = $2, documento = $3, cpf = $4,
               rg = $5, data_nascimento = $6::date, idade = $7,
               profissao = $8, endereco_completo = $9,
               numero_socio_abccmm = $10, data_inicio = $11::date, data_fim = $12::date
           where id = $13 and tenant_id = $14
             and ($15::uuid is null or criado_por = $15)
           returning id, nome, telefone_whatsapp, documento, cpf, rg,
             data_nascimento::text as data_nascimento, idade, profissao,
             endereco_completo, numero_socio_abccmm,
             data_inicio::text as data_inicio, data_fim::text as data_fim`,
          [
            fields.nome,
            fields.telefone_whatsapp,
            fields.documento,
            fields.cpf,
            fields.rg,
            fields.data_nascimento,
            fields.idade,
            fields.profissao,
            fields.endereco_completo,
            fields.numero_socio_abccmm,
            fields.data_inicio,
            fields.data_fim,
            body.id,
            user.tenant_id,
            user.perfil === "ADMIN" ? null : user.id,
          ],
        );
        if (!result.rowCount) {
          return errorResponse("Cliente não encontrado para edição.", 404);
        }
        return Response.json({ client: result.rows[0] });
      }

      case "saveClient": {
        if (!isManager || !hasTenant) {
          return errorResponse("Somente administradores podem cadastrar clientes.", 403);
        }

        const nome = sanitizeText(body.nome, 120);
        const enderecoCompleto = sanitizeText(body.endereco_completo, 400);
        const profissao = sanitizeText(body.profissao, 120);
        const cpf = sanitizeText(body.cpf, 20);
        const rg = sanitizeText(body.rg, 30);
        const documento = sanitizeText(body.documento, 40);

        if (!nome || !enderecoCompleto || !profissao || !cpf || !rg) {
          return errorResponse("Preencha nome, endereço, profissão, CPF e RG.", 400);
        }

        const cpfDigits = cpf.replace(/\D/g, "");
        if (cpfDigits.length !== 11) {
          return errorResponse("CPF deve conter 11 dígitos.", 400);
        }

        if (!isDateOnly(body.data_nascimento)) {
          return errorResponse("Data de nascimento inválida.", 400);
        }

        const numeroSocio = parseDecimalField(body.numero_socio_abccmm);
        if (numeroSocio === null || numeroSocio < 0 || numeroSocio > 999999.99999) {
          return errorResponse("Número do sócio ABCCMM inválido.", 400);
        }

        const dataInicio = body.data_inicio && isDateOnly(body.data_inicio) ? body.data_inicio : null;
        const dataFim = body.data_fim && isDateOnly(body.data_fim) ? body.data_fim : null;
        if (dataInicio && dataFim && dataFim < dataInicio) {
          return errorResponse("A data fim não pode ser anterior à data de início.", 400);
        }

        const idade = calculateAge(body.data_nascimento as string);
        const safeId = typeof body.id === "string" && isUuid(body.id) ? body.id : null;

        if (safeId) {
          const result = await pool.query(
            `update public.proprietarios
             set nome = $1,
                 telefone_whatsapp = $2,
                 documento = $3,
                 cpf = $4,
                 rg = $5,
                 data_nascimento = $6::date,
                 idade = $7,
                 profissao = $8,
                 endereco_completo = $9,
                 numero_socio_abccmm = $10,
                 dia_vencimento_padrao = $11,
                 data_inicio = $12::date,
                 data_fim = $13::date
             where id = $14 and tenant_id = $15
             returning id`,
            [
              nome,
              typeof body.telefone_whatsapp === "string" ? body.telefone_whatsapp.trim() || null : null,
              documento,
              cpf,
              rg,
              body.data_nascimento,
              idade,
              profissao,
              enderecoCompleto,
              numeroSocio,
              typeof body.dia_vencimento_padrao === "number"
                ? body.dia_vencimento_padrao
                : null,
              dataInicio,
              dataFim,
              safeId,
              user.tenant_id,
            ],
          );
          if (!result.rowCount) {
            return errorResponse("Cliente não encontrado para edição.", 404);
          }
          return Response.json({ updated: true });
        }

        const result = await pool.query(
          `insert into public.proprietarios (
             tenant_id, criado_por, nome, telefone_whatsapp, documento, cpf, rg,
             data_nascimento, idade, profissao, endereco_completo,
             numero_socio_abccmm, dia_vencimento_padrao, data_inicio, data_fim
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14::date, $15::date)
           returning id`,
          [
            user.tenant_id,
            user.id,
            nome,
            typeof body.telefone_whatsapp === "string" ? body.telefone_whatsapp.trim() || null : null,
            documento,
            cpf,
            rg,
            body.data_nascimento,
            idade,
            profissao,
            enderecoCompleto,
            numeroSocio,
            typeof body.dia_vencimento_padrao === "number"
              ? body.dia_vencimento_padrao
              : null,
            dataInicio,
            dataFim,
          ],
        );
        return Response.json({ id: result.rows[0]?.id ?? null }, { status: 201 });
      }

      case "deleteClient": {
        if (!isManager || !hasTenant) {
          return errorResponse("Somente administradores podem remover clientes.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cliente inválido.", 400);
        }
        const result = await pool.query(
          `delete from public.proprietarios
           where id = $1 and tenant_id = $2
           returning id`,
          [body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Cliente não encontrado.", 404);
        }
        return Response.json({ deleted: true });
      }

      case "createCteHarasRegistration": {
        if (user.perfil !== "ADMIN" || !hasTenant) {
          return errorResponse("Somente usuários ADMIN podem acessar este cadastro.", 403);
        }
        if (!isRegistrationType(body.tipo_cadastro)) {
          return errorResponse("Tipo do cadastro deve ser CTE ou Haras.", 400);
        }
        const validation = validateClientFields(body);
        if (!validation.valid) {
          return errorResponse(validation.message, 400);
        }
        const fields = validation.fields;
        const generateAccess = body.gerar_acesso === true;
        let accessEmail: string | null = null;
        let accessPasswordHash: string | null = null;
        if (generateAccess) {
          if (typeof body.login_email !== "string" || typeof body.login_senha !== "string") {
            return errorResponse("Informe o e-mail e a senha do acesso.", 400);
          }
          accessEmail = body.login_email.trim().toLowerCase();
          if (accessEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accessEmail)) {
            return errorResponse("E-mail de acesso inválido.", 400);
          }
          if (body.login_senha.length < 12 || body.login_senha.length > 200) {
            return errorResponse("A senha de acesso deve ter entre 12 e 200 caracteres.", 400);
          }
          accessPasswordHash = await hash(body.login_senha, 12);
        }

        const client = await pool.connect();
        try {
          await client.query("begin");
          if (accessEmail) {
            const existing = await client.query(
              "select id from public.usuarios where lower(email) = $1",
              [accessEmail],
            );
            if (existing.rowCount) {
              await client.query("rollback");
              return errorResponse("Já existe um usuário com esse e-mail.", 409);
            }
          }

          const result = await client.query(
            `insert into public.cadastros_cte_haras (
               tenant_id, criado_por, tipo_cadastro, nome, telefone_whatsapp,
               documento, cpf, rg, data_nascimento, idade, profissao,
               endereco_completo, numero_socio_abccmm, data_inicio, data_fim
             )
             values (
               $1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11,
               $12, $13, $14::date, $15::date
             )
             returning id, tipo_cadastro, nome, telefone_whatsapp, documento, cpf, rg,
               data_nascimento::text as data_nascimento, idade, profissao,
               endereco_completo, numero_socio_abccmm,
               data_inicio::text as data_inicio, data_fim::text as data_fim`,
            [
              user.tenant_id,
              user.id,
              body.tipo_cadastro,
              fields.nome,
              fields.telefone_whatsapp,
              fields.documento,
              fields.cpf,
              fields.rg,
              fields.data_nascimento,
              fields.idade,
              fields.profissao,
              fields.endereco_completo,
              fields.numero_socio_abccmm,
              fields.data_inicio,
              fields.data_fim,
            ],
          );
          const registration = result.rows[0];

          if (generateAccess && accessEmail && accessPasswordHash) {
            await client.query(
              `insert into public.usuarios (
                 tenant_id, cadastro_cte_haras_id, nome, email, senha_hash, perfil
               )
               values ($1, $2, $3, $4, $5, 'CLIENTE')`,
              [
                user.tenant_id,
                registration.id,
                fields.nome,
                accessEmail,
                accessPasswordHash,
              ],
            );
          }

          await client.query("commit");
          return Response.json(
            {
              registration: { ...registration, login_email: accessEmail },
              accessCreated: generateAccess,
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

      case "updateCteHarasRegistration": {
        if (user.perfil !== "ADMIN" || !hasTenant) {
          return errorResponse("Somente usuários ADMIN podem acessar este cadastro.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cadastro inválido.", 400);
        }
        if (!isRegistrationType(body.tipo_cadastro)) {
          return errorResponse("Tipo do cadastro deve ser CTE ou Haras.", 400);
        }
        const validation = validateClientFields(body);
        if (!validation.valid) {
          return errorResponse(validation.message, 400);
        }
        const fields = validation.fields;
        const generateAccess = body.gerar_acesso === true;
        let accessEmail: string | null = null;
        let accessPasswordHash: string | null = null;
        if (generateAccess) {
          if (typeof body.login_email !== "string" || typeof body.login_senha !== "string") {
            return errorResponse("Informe o e-mail e a senha do acesso.", 400);
          }
          accessEmail = body.login_email.trim().toLowerCase();
          if (accessEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accessEmail)) {
            return errorResponse("E-mail de acesso inválido.", 400);
          }
          if (body.login_senha.length < 12 || body.login_senha.length > 200) {
            return errorResponse("A senha de acesso deve ter entre 12 e 200 caracteres.", 400);
          }
          accessPasswordHash = await hash(body.login_senha, 12);
        }

        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await client.query(
            `update public.cadastros_cte_haras
             set tipo_cadastro = $1, nome = $2, telefone_whatsapp = $3,
                 documento = $4, cpf = $5, rg = $6, data_nascimento = $7::date,
                 idade = $8, profissao = $9, endereco_completo = $10,
                 numero_socio_abccmm = $11, data_inicio = $12::date, data_fim = $13::date
             where id = $14 and tenant_id = $15
             returning id, tipo_cadastro, nome, telefone_whatsapp, documento, cpf, rg,
               data_nascimento::text as data_nascimento, idade, profissao,
               endereco_completo, numero_socio_abccmm,
               data_inicio::text as data_inicio, data_fim::text as data_fim`,
            [
              body.tipo_cadastro,
              fields.nome,
              fields.telefone_whatsapp,
              fields.documento,
              fields.cpf,
              fields.rg,
              fields.data_nascimento,
              fields.idade,
              fields.profissao,
              fields.endereco_completo,
              fields.numero_socio_abccmm,
              fields.data_inicio,
              fields.data_fim,
              body.id,
              user.tenant_id,
            ],
          );
          if (!result.rowCount) {
            await client.query("rollback");
            return errorResponse("Cadastro não encontrado para edição.", 404);
          }
          const registration = result.rows[0];

          if (generateAccess && accessEmail && accessPasswordHash) {
            const existingAccess = await client.query(
              `select id from public.usuarios
               where cadastro_cte_haras_id = $1 and tenant_id = $2`,
              [body.id, user.tenant_id],
            );
            const duplicate = await client.query(
              `select id from public.usuarios
               where lower(email) = $1
                 and ($2::uuid is null or id <> $2)`,
              [accessEmail, existingAccess.rows[0]?.id ?? null],
            );
            if (duplicate.rowCount) {
              await client.query("rollback");
              return errorResponse("Já existe um usuário com esse e-mail.", 409);
            }

            if (existingAccess.rowCount) {
              await client.query(
                `update public.usuarios
                 set nome = $1, email = $2, senha_hash = $3, perfil = 'CLIENTE'
                 where id = $4 and tenant_id = $5`,
                [fields.nome, accessEmail, accessPasswordHash, existingAccess.rows[0].id, user.tenant_id],
              );
            } else {
              await client.query(
                `insert into public.usuarios (
                   tenant_id, cadastro_cte_haras_id, nome, email, senha_hash, perfil
                 )
                 values ($1, $2, $3, $4, $5, 'CLIENTE')`,
                [user.tenant_id, body.id, fields.nome, accessEmail, accessPasswordHash],
              );
            }
          } else {
            const existingAccess = await client.query(
              `select email from public.usuarios
               where cadastro_cte_haras_id = $1 and tenant_id = $2
               limit 1`,
              [body.id, user.tenant_id],
            );
            accessEmail = existingAccess.rows[0]?.email ?? null;
          }

          await client.query("commit");
          return Response.json({
            registration: { ...registration, login_email: accessEmail },
            accessCreated: generateAccess,
          });
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }

      case "deleteCteHarasRegistration": {
        if (user.perfil !== "ADMIN" || !hasTenant) {
          return errorResponse("Somente usuários ADMIN podem acessar este cadastro.", 403);
        }
        if (!isUuid(body.id)) {
          return errorResponse("Cadastro inválido.", 400);
        }
        const result = await pool.query(
          `delete from public.cadastros_cte_haras
           where id = $1 and tenant_id = $2
           returning id`,
          [body.id, user.tenant_id],
        );
        if (!result.rowCount) {
          return errorResponse("Cadastro não encontrado.", 404);
        }
        return Response.json({ deleted: true });
      }

      default:
        return errorResponse("Ação não reconhecida.", 400);
    }
  } catch (error) {
    console.error("Falha ao executar ação do painel:", error);
    return errorResponse("Não foi possível concluir a operação.", 500);
  }
}
