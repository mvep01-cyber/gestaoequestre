import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { isValidCpf } from "@/lib/brazilian-documents";
import { getPool } from "@/lib/db";
import { productTodaySql } from "@/lib/product-dates";
import { isSameOrigin } from "@/lib/request-security";
import { isHttpUrl } from "@/lib/url";
import { hash } from "bcryptjs";
import type { PoolClient } from "pg";

type ReproductionCycle = {
  id: string;
  tipo: string;
  garanhao_id: string | null;
  matriz_id: string | null;
  receptora_id: string | null;
  data_cobertura: string;
  hora_cobertura: string | null;
  veterinario: string | null;
  descricao: string | null;
  garanhao_origem: "INTERNO" | "EXTERNO";
  garanhao_externo_nome: string | null;
  garanhao_externo_registro: string | null;
  matriz_origem: "INTERNO" | "EXTERNO";
  matriz_externa_nome: string | null;
  matriz_externa_registro: string | null;
  status: string;
  data_previsao_parto: string | null;
  data_parto_real: string | null;
  potro_gerado_id: string | null;
};

type ReproductionCycleInput = {
  type: "MONTA" | "INSEMINACAO" | "TE";
  mareOrigin: "INTERNO" | "EXTERNO";
  mareId: string | null;
  mareExternalName: string | null;
  mareExternalRegistration: string | null;
  sireOrigin: "INTERNO" | "EXTERNO";
  sireId: string | null;
  sireExternalName: string | null;
  sireExternalRegistration: string | null;
  recipientId: string | null;
  coverageDate: string;
  coverageTime: string | null;
  dueDate: string | null;
  veterinarian: string | null;
  description: string | null;
};

const clientAccountActions = new Set([
  "createHorse",
  "updateHorse",
  "deleteHorse",
  "createClient",
  "updateClient",
  "createFinanceAccount",
  "createFinanceEntry",
  "updateFinanceEntry",
  "deleteFinanceEntry",
  "generateBilling",
  "payFinanceEntry",
  "createTreatment",
  "updateTreatment",
  "createTraining",
  "updateTraining",
]);

const financeCategories = new Set([
  "MENSALIDADE",
  "REPASSE_EXTRA",
  "PARCELA_VENDA",
  "COMISSAO",
  "ALIMENTACAO_FENO",
  "OPERACIONAL",
]);
const financeAccountTypes = new Set(["CONTA_CORRENTE", "PIX", "DINHEIRO", "OUTRO"]);

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

function parseReproductionCycleInput(
  body: Record<string, unknown>,
): ReproductionCycleInput | null {
  const mareOrigin = body.mareOrigin ?? "INTERNO";
  const sireOrigin = body.sireOrigin ?? "INTERNO";
  if (
    (mareOrigin !== "INTERNO" && mareOrigin !== "EXTERNO") ||
    (sireOrigin !== "INTERNO" && sireOrigin !== "EXTERNO") ||
    (body.type !== "MONTA" &&
      body.type !== "INSEMINACAO" &&
      body.type !== "TE") ||
    !isDateOnly(body.coverageDate)
  ) {
    return null;
  }

  const mareId =
    mareOrigin === "INTERNO" && isUuid(body.mareId) ? body.mareId : null;
  const sireId =
    sireOrigin === "INTERNO" && isUuid(body.sireId) ? body.sireId : null;
  if (
    (mareOrigin === "INTERNO" && !mareId) ||
    (sireOrigin === "INTERNO" && !sireId) ||
    (mareOrigin === "EXTERNO" &&
      body.mareId !== undefined &&
      body.mareId !== null &&
      body.mareId !== "" ) ||
    (sireOrigin === "EXTERNO" &&
      body.sireId !== undefined &&
      body.sireId !== null &&
      body.sireId !== "")
  ) {
    return null;
  }

  const mareExternalName = parseOptionalText(body.mareExternalName, 120);
  const mareExternalRegistration = parseOptionalText(
    body.mareExternalRegistration,
    80,
  );
  const sireExternalName = parseOptionalText(body.sireExternalName, 120);
  const sireExternalRegistration = parseOptionalText(
    body.sireExternalRegistration,
    80,
  );
  const veterinarian = parseOptionalText(body.veterinarian, 120);
  const description = parseOptionalText(body.description, 2000);
  const dueDate = parseOptionalDate(body.dueDate);
  const recipientId =
    body.recipientId === undefined ||
    body.recipientId === null ||
    body.recipientId === ""
      ? null
      : isUuid(body.recipientId)
        ? body.recipientId
        : undefined;
  const coverageTime =
    body.coverageTime === undefined ||
    body.coverageTime === null ||
    body.coverageTime === ""
      ? null
      : typeof body.coverageTime === "string" &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.coverageTime)
        ? body.coverageTime
        : undefined;

  if (
    !mareExternalName.valid ||
    !mareExternalRegistration.valid ||
    !sireExternalName.valid ||
    !sireExternalRegistration.valid ||
    !veterinarian.valid ||
    !description.valid ||
    dueDate === undefined ||
    recipientId === undefined ||
    coverageTime === undefined ||
    (mareOrigin === "EXTERNO" && !mareExternalName.value) ||
    (sireOrigin === "EXTERNO" && !sireExternalName.value)
  ) {
    return null;
  }

  return {
    type: body.type,
    mareOrigin,
    mareId,
    mareExternalName: mareOrigin === "EXTERNO" ? mareExternalName.value : null,
    mareExternalRegistration:
      mareOrigin === "EXTERNO" ? mareExternalRegistration.value : null,
    sireOrigin,
    sireId,
    sireExternalName: sireOrigin === "EXTERNO" ? sireExternalName.value : null,
    sireExternalRegistration:
      sireOrigin === "EXTERNO" ? sireExternalRegistration.value : null,
    recipientId,
    coverageDate: body.coverageDate,
    coverageTime,
    dueDate,
    veterinarian: veterinarian.value,
    description: description.value,
  };
}

function parseMoney(value: unknown): number | null {
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
  produtos?: HorseProductSelection;
};

type HorseProductSelection = {
  feno: string | null;
  racao: string | null;
  baia: string | null;
  outros: string | null;
};

const horseProductFields = ["feno", "racao", "baia", "outros"] as const;
const horseProductFieldSet = new Set<string>(horseProductFields);
const horseProductTypes = {
  feno: "FENO",
  racao: "RACAO",
  baia: "BAIA",
  outros: "OUTRO",
} as const;
const emptyHorseProductSelection: HorseProductSelection = {
  feno: null,
  racao: null,
  baia: null,
  outros: null,
};

function parseHorseProductSelection(value: unknown): HorseProductSelection | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || horseProductFields.some((field) => !(field in value)) ||
      Object.keys(value).some((field) => !horseProductFieldSet.has(field))) {
    return null;
  }
  const parsed: HorseProductSelection = {
    feno: null,
    racao: null,
    baia: null,
    outros: null,
  };
  for (const field of horseProductFields) {
    const productId = value[field];
    if (productId === null || productId === "") {
      parsed[field] = null;
    } else if (isUuid(productId)) {
      parsed[field] = productId;
    } else {
      return null;
    }
  }
  const selectedIds = horseProductFields
    .map((field) => parsed[field])
    .filter((id): id is string => id !== null);
  return new Set(selectedIds).size === selectedIds.length ? parsed : null;
}

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
  const produtos = parseHorseProductSelection(body.produtos);
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
    (produtos === null) ||
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
    ...(produtos ? { produtos } : {}),
  };
}

function horseCoatValid(value: string | null) {
  return value === null || horseCoatTypes.some((coat) => coat === value);
}

async function replaceHorseProducts(
  client: PoolClient,
  tenantId: string,
  horseId: string,
  registrationId: string | null,
  selection: HorseProductSelection,
) {
  const requested = horseProductFields.flatMap((field) => {
    const produtoId = selection[field];
    return produtoId ? [{ produtoId, tipo: horseProductTypes[field] }] : [];
  });
  const currentResult = await client.query<{ produto_id: string; tipo_vinculo: string }>(
    `select produto_id, tipo_vinculo
     from public.equinos_produtos
     where equino_id = $1 and tenant_id = $2`,
    [horseId, tenantId],
  );
  const current = new Map(currentResult.rows.map((row) => [row.produto_id, row.tipo_vinculo]));

  if (!registrationId) {
    return requested.length === current.size &&
      requested.every((link) => current.get(link.produtoId) === link.tipo);
  }

  const requestedIds = requested.map((link) => link.produtoId);
  if (requestedIds.length > 0) {
    const validProducts = await client.query<{ id: string }>(
      `select id
       from public.produtos
       where id = any($1::uuid[])
         and tenant_id = $2
         and cadastro_cte_haras_id = $3
         and (data_inicio <= ${productTodaySql} and data_fim >= ${productTodaySql}
              or id = any($4::uuid[]))
       for key share`,
      [requestedIds, tenantId, registrationId, Array.from(current.keys())],
    );
    if (validProducts.rowCount !== requestedIds.length) return false;
  }

  await client.query(
    "delete from public.equinos_produtos where equino_id = $1 and tenant_id = $2",
    [horseId, tenantId],
  );
  for (const link of requested) {
    await client.query(
      `insert into public.equinos_produtos (equino_id, produto_id, tenant_id, tipo_vinculo)
       values ($1, $2, $3, $4)`,
      [horseId, link.produtoId, tenantId, link.tipo],
    );
  }
  return true;
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
            e.created_at::text as created_at,
            coalesce((
              select json_agg(json_build_object(
                'id', p.id, 'tipo_vinculo', ep.tipo_vinculo, 'nome', p.nome,
                'codigo', p.codigo, 'fornecedor_nome', f.nome
              ) order by ep.tipo_vinculo)
              from public.equinos_produtos as ep
              join public.produtos as p
                on p.id = ep.produto_id and p.tenant_id = ep.tenant_id
              join public.fornecedores as f
                on f.id = p.fornecedor_id
                 and f.cadastro_cte_haras_id = p.cadastro_cte_haras_id
                 and f.tenant_id = p.tenant_id
              where ep.equino_id = e.id and ep.tenant_id = e.tenant_id
            ), '[]'::json) as produtos
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
  if (!isValidCpf(cpf.value)) {
    return { valid: false, message: "CPF inválido." };
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

const treatmentTypes = new Set([
  "MEDICAMENTO",
  "VACINA",
  "VERMIFUGO",
  "VETERINARIO",
  "FERRAGEAMENTO",
]);
const maxScheduledApplications = 1000;

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parseWeekdays(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const days = new Set<number>();
  for (const day of value) {
    if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 7) {
      return null;
    }
    days.add(day as number);
  }
  return Array.from(days).sort((a, b) => a - b);
}

function countScheduledDays(start: string, end: string, weekdays: number[]) {
  let total = 0;
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    const isoDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    if (weekdays.includes(isoDay)) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

function parseTreatmentInput(body: Record<string, unknown>) {
  const times = Array.isArray(body.times) ? body.times : [];
  const weekdays = parseWeekdays(body.weekdays);
  const description = sanitizeText(body.description, 300);
  const dose = parseOptionalText(body.dose, 160);
  const provider = parseOptionalText(body.provider, 120);
  const notes = parseOptionalText(body.notes, 2000);
  if (
    !isUuid(body.horseId) ||
    typeof body.type !== "string" ||
    !treatmentTypes.has(body.type) ||
    !description ||
    !dose.valid ||
    !provider.valid ||
    !notes.valid ||
    !isDateOnly(body.startDate) ||
    !isDateOnly(body.endDate) ||
    !weekdays ||
    times.length === 0 ||
    times.length > 12 ||
    !times.every(isTime)
  ) {
    return { error: "Confira os dados do tratamento." } as const;
  }
  if (body.endDate < body.startDate) {
    return { error: "A data final não pode ser anterior à data inicial." } as const;
  }
  const uniqueTimes = Array.from(new Set(times as string[])).sort();
  if (
    countScheduledDays(body.startDate, body.endDate, weekdays) *
      uniqueTimes.length >
    maxScheduledApplications
  ) {
    return { error: "O período gera aplicações demais; reduza o intervalo." } as const;
  }
  if (countScheduledDays(body.startDate, body.endDate, weekdays) === 0) {
    return { error: "Nenhum dia selecionado ocorre no período informado." } as const;
  }
  return {
    fields: {
      horseId: body.horseId,
      type: body.type,
      description,
      dose: dose.value,
      provider: provider.value,
      notes: notes.value,
      startDate: body.startDate,
      endDate: body.endDate,
      weekdays,
      times: uniqueTimes,
    },
  } as const;
}

function parseTrainingInput(body: Record<string, unknown>) {
  const weekdays = parseWeekdays(body.weekdays);
  const activity = sanitizeText(body.activity, 160);
  const trainer = parseOptionalText(body.trainer, 120);
  const notes = parseOptionalText(body.notes, 2000);
  const endTime = body.endTime === "" || body.endTime === undefined ? null : body.endTime;
  if (
    !isUuid(body.horseId) ||
    !activity ||
    !trainer.valid ||
    !notes.valid ||
    !isDateOnly(body.startDate) ||
    !isDateOnly(body.endDate) ||
    !weekdays ||
    !isTime(body.startTime) ||
    (endTime !== null && !isTime(endTime))
  ) {
    return { error: "Confira os dados do treino." } as const;
  }
  if (body.endDate < body.startDate) {
    return { error: "A data final não pode ser anterior à data inicial." } as const;
  }
  if (endTime !== null && endTime <= body.startTime) {
    return { error: "O horário de fim deve ser posterior ao de início." } as const;
  }
  if (countScheduledDays(body.startDate, body.endDate, weekdays) === 0) {
    return { error: "Nenhum dia selecionado ocorre no período informado." } as const;
  }
  return {
    fields: {
      horseId: body.horseId,
      activity,
      trainer: trainer.value,
      notes: notes.value,
      startDate: body.startDate,
      endDate: body.endDate,
      weekdays,
      startTime: body.startTime,
      endTime,
    },
  } as const;
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
  const pool = getPool();
  const tenantId =
    isManager && isUuid(body.tenantId) ? body.tenantId : user.tenant_id;
  const hasTenant = Boolean(tenantId);
  const tenantContext =
    isManager && tenantId
      ? await pool.query<{ plano: string }>(
          "select plano from public.tenants where id = $1",
          [tenantId],
        )
      : null;
  if (isManager && (!tenantId || !tenantContext?.rowCount)) {
    return errorResponse("Selecione um CTE/Haras válido.", 400);
  }
  const tenantPlan = isManager
    ? tenantContext?.rows[0]?.plano ?? null
    : user.plano;
  const isClientAccount =
    user.perfil === "CLIENTE" &&
    (user.tipo_cadastro === "CTE" || user.tipo_cadastro === "HARAS");
  const canManageHorses =
    hasTenant &&
    (user.perfil === "OPERACIONAL" || isClientAccount);
  const canManageClients =
    hasTenant &&
    (user.perfil === "ADMIN" || user.perfil === "OPERACIONAL" || isClientAccount);
  if (
    user.perfil === "CLIENTE" &&
    (!isClientAccount || !clientAccountActions.has(body.action))
  ) {
    return errorResponse("Este acesso não tem permissão para esta ação.", 403);
  }
  try {
    switch (body.action) {
      case "createHorse": {
        if (!canManageHorses) {
          return errorResponse("Este perfil não tem permissão para alterar o cadastro de cavalos.", 403);
        }
        if ("produto_cadastro_id" in body) {
          return errorResponse("Atualize a página para selecionar os produtos por tipo.", 400);
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
          tenantId!,
          user.id,
          fields.proprietario_id,
          isClientAccount,
          fields.nome_proprietario,
        );
        if (!owner) {
          return errorResponse("Proprietário não encontrado no seu cadastro.", 403);
        }
        const client = await pool.connect();
        let horseId: string;
        try {
          await client.query("begin");
          const result = await client.query<{ id: string }>(
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
              tenantId,
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
          horseId = result.rows[0].id;
          const productsSaved = await replaceHorseProducts(
            client,
            tenantId!,
            horseId,
            isClientAccount ? user.cadastro_cte_haras_id : null,
            fields.produtos ?? emptyHorseProductSelection,
          );
          if (!productsSaved) {
            await client.query("rollback");
            return errorResponse("Selecione produtos ativos do seu CTE/Haras.", 400);
          }
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
        const horse = await fetchHorseForResponse(
          pool,
          tenantId!,
          horseId,
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
          return errorResponse("Este perfil não tem permissão para alterar o cadastro de cavalos.", 403);
        }
        if ("produto_cadastro_id" in body) {
          return errorResponse("Atualize a página para selecionar os produtos por tipo.", 400);
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
          tenantId!,
          user.id,
          fields.proprietario_id,
          isClientAccount,
          fields.nome_proprietario,
        );
        if (!owner) {
          return errorResponse("Proprietário não encontrado no seu cadastro.", 403);
        }
        const client = await pool.connect();
        let horseId: string;
        try {
          await client.query("begin");
          const result = await client.query<{ id: string }>(
            `update public.equinos
           set nome_proprietario = $1,
               proprietario_id = case
                 when not $23::boolean and nome_proprietario is not distinct from $1
                   then proprietario_id
                 else $2
               end,
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
              tenantId,
              isManager,
              user.id,
              isClientAccount,
            ],
          );
          if (!result.rowCount) {
            await client.query("rollback");
            return errorResponse("Cavalo não encontrado neste centro.", 404);
          }
          horseId = result.rows[0].id;
          if (fields.produtos) {
            const productsSaved = await replaceHorseProducts(
              client,
              tenantId!,
              horseId,
              isClientAccount ? user.cadastro_cte_haras_id : null,
              fields.produtos,
            );
            if (!productsSaved) {
              await client.query("rollback");
              return errorResponse("Selecione produtos ativos do seu CTE/Haras.", 400);
            }
          }
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
        const horse = await fetchHorseForResponse(
          pool,
          tenantId!,
          horseId,
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
          return errorResponse("Este perfil não tem permissão para alterar o cadastro de cavalos.", 403);
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
          [body.id, tenantId, isManager, user.id],
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
          [user.id, body.id, tenantId, isManager, user.id],
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
          [body.id, tenantId, isManager, user.id],
        );
        if (!result.rowCount) {
          return errorResponse("Treino não encontrado ou já concluído.", 404);
        }
        return Response.json({ updated: true });
      }

      case "createTreatment":
      case "updateTreatment": {
        if (!hasTenant || !(isManager || canManageHorses)) {
          return errorResponse("Este perfil não tem permissão para agendar tratamentos.", 403);
        }
        const isUpdate = body.action === "updateTreatment";
        if (isUpdate && !isUuid(body.id)) {
          return errorResponse("Tratamento inválido.", 400);
        }
        const parsed = parseTreatmentInput(body);
        if (!parsed.fields) {
          return errorResponse(parsed.error ?? "Dados inválidos.", 400);
        }
        const fields = parsed.fields;
        const horse = await pool.query(
          `select 1 from public.equinos
           where id = $1 and tenant_id = $2 and excluido_em is null
             and ($3::boolean or criado_por = $4)`,
          [fields.horseId, tenantId, isManager, user.id],
        );
        if (!horse.rowCount) {
          return errorResponse("Cavalo não encontrado neste centro.", 404);
        }

        const client = await pool.connect();
        try {
          await client.query("begin");
          let treatmentId: string;
          if (isUpdate) {
            const updated = await client.query<{ id: string }>(
              `update public.tratamentos_medicamentos as tm
               set equino_id = $3, tipo = $4, descricao = $5, dose_via = $6,
                   data_inicio = $7, data_fim = $8, dias_semana = $9::smallint[],
                   horarios = $10::time[], prestador_nome = $11, observacoes = $12
               where tm.id = $1 and tm.tenant_id = $2
                 and exists (
                   select 1 from public.equinos as e
                   where e.id = tm.equino_id and e.tenant_id = tm.tenant_id
                     and ($13::boolean or e.criado_por = $14)
                 )
               returning tm.id`,
              [
                body.id, tenantId, fields.horseId, fields.type, fields.description,
                fields.dose, fields.startDate, fields.endDate, fields.weekdays,
                fields.times, fields.provider, fields.notes, isManager, user.id,
              ],
            );
            if (!updated.rowCount) {
              await client.query("rollback");
              return errorResponse("Tratamento não encontrado.", 404);
            }
            treatmentId = updated.rows[0].id;
            await client.query(
              `delete from public.medicamentos_aplicacoes
               where tratamento_id = $1 and tenant_id = $2 and status = 'PENDENTE'`,
              [treatmentId, tenantId],
            );
          } else {
            const inserted = await client.query<{ id: string }>(
              `insert into public.tratamentos_medicamentos (
                 tenant_id, equino_id, tipo, descricao, dose_via, data_inicio, data_fim,
                 dias_semana, horarios, prestador_nome, observacoes
               )
               values ($1, $2, $3, $4, $5, $6, $7, $8::smallint[], $9::time[], $10, $11)
               returning id`,
              [
                tenantId, fields.horseId, fields.type, fields.description, fields.dose,
                fields.startDate, fields.endDate, fields.weekdays, fields.times,
                fields.provider, fields.notes,
              ],
            );
            treatmentId = inserted.rows[0].id;
          }
          await client.query(
            `insert into public.medicamentos_aplicacoes (tenant_id, tratamento_id, data_hora_prevista)
             select $1::uuid, $2::uuid, (d::date + h) at time zone 'America/Sao_Paulo'
             from generate_series($3::timestamp, $4::timestamp, interval '1 day') as d
             cross join unnest($6::time[]) as h
             where extract(isodow from d)::int = any($5::int[])
               and not exists (
                 select 1 from public.medicamentos_aplicacoes as ma
                 where ma.tratamento_id = $2
                   and ma.data_hora_prevista = (d::date + h) at time zone 'America/Sao_Paulo'
               )`,
            [tenantId, treatmentId, fields.startDate, fields.endDate, fields.weekdays, fields.times],
          );
          await client.query("commit");
          return Response.json({ id: treatmentId }, { status: isUpdate ? 200 : 201 });
        } catch (error) {
          await client.query("rollback").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      }

      case "createTraining":
      case "updateTraining": {
        if (!hasTenant || !(isManager || canManageHorses)) {
          return errorResponse("Este perfil não tem permissão para programar treinos.", 403);
        }
        const isUpdate = body.action === "updateTraining";
        if (isUpdate && !isUuid(body.id)) {
          return errorResponse("Treino inválido.", 400);
        }
        const parsed = parseTrainingInput(body);
        if (!parsed.fields) {
          return errorResponse(parsed.error ?? "Dados inválidos.", 400);
        }
        const fields = parsed.fields;
        const horse = await pool.query(
          `select 1 from public.equinos
           where id = $1 and tenant_id = $2 and excluido_em is null
             and categoria <> 'RECEPTORA'
             and ($3::boolean or criado_por = $4)`,
          [fields.horseId, tenantId, isManager, user.id],
        );
        if (!horse.rowCount) {
          return errorResponse("Cavalo não encontrado neste centro.", 404);
        }
        const params = [
          tenantId, fields.horseId, fields.activity, fields.trainer, fields.notes,
          fields.startDate, fields.endDate, fields.weekdays, fields.startTime,
          fields.endTime,
        ];
        const result = isUpdate
          ? await pool.query<{ id: string }>(
              `update public.agenda_treinos as at
               set equino_id = $2, tipo_atividade = $3, treinador_nome = $4,
                   observacoes = $5, data_inicio = $6, data_fim = $7,
                   dias_semana = $8::smallint[], hora_inicio = $9::time,
                   hora_fim = $10::time,
                   data_hora = ($6::date + $9::time) at time zone 'America/Sao_Paulo'
               where at.id = $11 and at.tenant_id = $1
                 and exists (
                   select 1 from public.equinos as e
                   where e.id = at.equino_id and e.tenant_id = at.tenant_id
                     and ($12::boolean or e.criado_por = $13)
                 )
               returning at.id`,
              [...params, body.id, isManager, user.id],
            )
          : await pool.query<{ id: string }>(
              `insert into public.agenda_treinos (
                 tenant_id, equino_id, tipo_atividade, treinador_nome, observacoes,
                 data_inicio, data_fim, dias_semana, hora_inicio, hora_fim, data_hora
               )
               values ($1, $2, $3, $4, $5, $6, $7, $8::smallint[], $9::time, $10::time,
                       ($6::date + $9::time) at time zone 'America/Sao_Paulo')
               returning id`,
              params,
            );
        if (!result.rowCount) {
          return errorResponse("Treino não encontrado.", 404);
        }
        return Response.json({ id: result.rows[0].id }, { status: isUpdate ? 200 : 201 });
      }

      case "updateTenant": {
        if (
          (user.perfil !== "SUPER_ADMIN" && user.perfil !== "ADMIN") ||
          !isUuid(body.id)
        ) {
          return errorResponse("Ação permitida somente ao perfil ADMIN.", 403);
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

      case "createFinanceEntry": {
        if (!isClientAccount || !hasTenant) {
          return errorResponse("Apenas o login CTE/Haras pode criar lançamentos próprios.", 403);
        }
        const clientId = body.clientId;
        const descricao = sanitizeText(body.description, 200);
        const natureza = body.nature;
        const categoria = body.category;
        const valor = parseMoney(body.amount);
        const dataVencimento = body.dueDate;
        const competencia = parseOptionalDate(body.competence);
        const dataPagamento = parseOptionalDate(body.paymentDate);
        const contaInformada = parseOptionalText(body.accountText, 120);
        const contaId =
          body.accountId === undefined || body.accountId === null || body.accountId === ""
            ? null
            : isUuid(body.accountId)
              ? body.accountId
              : undefined;
        if (
          !isUuid(clientId) ||
          !descricao ||
          (natureza !== "RECEITA" && natureza !== "DESPESA") ||
          typeof categoria !== "string" ||
          !financeCategories.has(categoria) ||
          valor === null ||
          !isDateOnly(dataVencimento) ||
          competencia === undefined ||
          dataPagamento === undefined ||
          !contaInformada.valid ||
          contaId === undefined ||
          (dataPagamento !== null && !contaId)
        ) {
          return errorResponse("Confira o cliente, a conta e os dados do lançamento.", 400);
        }
        const client = await pool.query<{ nome: string }>(
          `select nome from public.proprietarios
           where id = $1 and tenant_id = $2 and criado_por = $3`,
          [clientId, tenantId, user.id],
        );
        if (!client.rowCount) {
          return errorResponse("Cliente não encontrado para este login.", 404);
        }
        if (contaId) {
          const account = await pool.query(
            "select 1 from public.contas_bancarias where id = $1 and tenant_id = $2",
            [contaId, tenantId],
          );
          if (!account.rowCount) {
            return errorResponse("Conta bancária não encontrada para este centro.", 404);
          }
        }
        const result = await pool.query<{ id: string; status: string }>(
          `insert into public.financeiro_lancamentos (
             tenant_id, criado_por, proprietario_id, conta_bancaria_id, conta_informada,
             natureza, categoria, descricao, valor, competencia, data_vencimento,
             data_pagamento, status
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                   case when $12::date is null then 'PENDENTE' else 'PAGO' end)
           returning id, status`,
          [
            tenantId,
            user.id,
            clientId,
            contaId,
            contaInformada.value,
            natureza,
            categoria,
            descricao,
            valor,
            competencia,
            dataVencimento,
            dataPagamento,
          ],
        );
        return Response.json(
          {
            entry: {
              id: result.rows[0].id,
              proprietario_id: clientId,
              cliente_nome: client.rows[0].nome,
              descricao,
              valor,
              data_vencimento: dataVencimento,
              natureza,
              categoria,
              status: result.rows[0].status,
              competencia,
              data_pagamento: dataPagamento,
              conta_bancaria_id: contaId,
              conta_informada: contaInformada.value,
            },
          },
          { status: 201 },
        );
      }

      case "updateFinanceEntry": {
        if (!isClientAccount || !hasTenant) {
          return errorResponse("Apenas o login que criou o lançamento pode alterá-lo.", 403);
        }
        const clientId = body.clientId;
        const descricao = sanitizeText(body.description, 200);
        const natureza = body.nature;
        const categoria = body.category;
        const valor = parseMoney(body.amount);
        const dataVencimento = body.dueDate;
        const competencia = parseOptionalDate(body.competence);
        const paymentFieldsProvided = body.paymentDate !== undefined;
        const dataPagamento = paymentFieldsProvided
          ? parseOptionalDate(body.paymentDate)
          : undefined;
        const contaInformada = parseOptionalText(body.accountText, 120);
        const contaId =
          body.accountId === undefined
            ? undefined
            : body.accountId === null || body.accountId === ""
              ? null
              : isUuid(body.accountId)
                ? body.accountId
                : undefined;
        const invalidContaId =
          body.accountId !== undefined &&
          body.accountId !== null &&
          body.accountId !== "" &&
          !isUuid(body.accountId);
        if (
          !isUuid(body.id) ||
          !isUuid(clientId) ||
          !descricao ||
          (natureza !== "RECEITA" && natureza !== "DESPESA") ||
          typeof categoria !== "string" ||
          !financeCategories.has(categoria) ||
          valor === null ||
          !isDateOnly(dataVencimento) ||
          competencia === undefined ||
          (paymentFieldsProvided && dataPagamento === undefined) ||
          !contaInformada.valid ||
          invalidContaId ||
          (paymentFieldsProvided && contaId === undefined) ||
          (!paymentFieldsProvided && contaId !== undefined) ||
          (dataPagamento !== undefined && dataPagamento !== null && !contaId)
        ) {
          return errorResponse("Confira o cliente, a conta e os dados do lançamento.", 400);
        }
        const client = await pool.query<{ nome: string }>(
          `select nome from public.proprietarios
           where id = $1 and tenant_id = $2 and criado_por = $3`,
          [clientId, tenantId, user.id],
        );
        if (!client.rowCount) {
          return errorResponse("Cliente não encontrado para este login.", 404);
        }
        if (contaId) {
          const account = await pool.query(
            "select 1 from public.contas_bancarias where id = $1 and tenant_id = $2",
            [contaId, tenantId],
          );
          if (!account.rowCount) {
            return errorResponse("Conta bancária não encontrada para este centro.", 404);
          }
        }
        const result = await pool.query<{
          id: string;
          status: string;
          data_pagamento: string | null;
          conta_bancaria_id: string | null;
        }>(
          `update public.financeiro_lancamentos
           set proprietario_id = $1, conta_informada = $3,
               natureza = $4, categoria = $5, descricao = $6, valor = $7,
               competencia = $8, data_vencimento = $9,
               conta_bancaria_id = case when $11::boolean then $2 else conta_bancaria_id end,
               data_pagamento = case when $11::boolean then $10 else data_pagamento end,
               status = case when not $11::boolean then status
                             when $10::date is null then 'PENDENTE' else 'PAGO' end
           where id = $12 and tenant_id = $13 and criado_por = $14
             and excluido_em is null
           returning id, status, data_pagamento::text as data_pagamento, conta_bancaria_id`,
          [
            clientId,
            contaId,
            contaInformada.value,
            natureza,
            categoria,
            descricao,
            valor,
            competencia,
            dataVencimento,
            dataPagamento,
            paymentFieldsProvided,
            body.id,
            tenantId,
            user.id,
          ],
        );
        if (!result.rowCount) {
          return errorResponse("Lançamento não encontrado para este login.", 404);
        }
        return Response.json({
          entry: {
            id: body.id,
            proprietario_id: clientId,
            cliente_nome: client.rows[0].nome,
            descricao,
            valor,
            data_vencimento: dataVencimento,
            natureza,
            categoria,
            status: result.rows[0].status,
            competencia,
            data_pagamento: result.rows[0].data_pagamento,
            conta_bancaria_id: result.rows[0].conta_bancaria_id,
            conta_informada: contaInformada.value,
          },
        });
      }

      case "deleteFinanceEntry": {
        if (!isClientAccount || !hasTenant || !isUuid(body.id)) {
          return errorResponse("Apenas o login que criou o lançamento pode excluí-lo.", 403);
        }
        const result = await pool.query(
          `update public.financeiro_lancamentos
           set excluido_em = now()
           where id = $1 and tenant_id = $2 and criado_por = $3
             and excluido_em is null
           returning id`,
          [body.id, tenantId, user.id],
        );
        if (!result.rowCount) {
          return errorResponse("Lançamento não encontrado para este login.", 404);
        }
        return Response.json({ deleted: true });
      }

      case "createFinanceAccount": {
        if (!isClientAccount || !hasTenant) {
          return errorResponse("Apenas o login CTE/Haras pode criar contas próprias.", 403);
        }
        const name = sanitizeText(body.name, 120);
        const type = body.type;
        const pixKey = parseOptionalText(body.pixKey, 200);
        if (
          !name ||
          typeof type !== "string" ||
          !financeAccountTypes.has(type) ||
          !pixKey.valid
        ) {
          return errorResponse("Confira os dados da conta financeira.", 400);
        }
        const result = await pool.query<{
          id: string;
          nome: string;
          tipo: string;
          chave_pix: string | null;
          saldo_atual: number;
        }>(
          `insert into public.contas_bancarias (tenant_id, nome, tipo, chave_pix)
           values ($1, $2, $3, $4)
           returning id, nome, tipo, chave_pix, saldo_atual::double precision as saldo_atual`,
          [tenantId, name, type, pixKey.value],
        );
        return Response.json({ account: result.rows[0] }, { status: 201 });
      }

      case "generateBilling": {
        if (!isClientAccount || !hasTenant) {
          return errorResponse("Apenas logins CTE/Haras podem gerar cobranças próprias.", 403);
        }
        if (
          !isUuid(body.ownerId) ||
          typeof body.month !== "string" ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)
        ) {
          return errorResponse("Cliente ou competência inválidos.", 400);
        }
        const owner = await pool.query(
          `select 1 from public.proprietarios
           where id = $1 and tenant_id = $2 and criado_por = $3`,
          [body.ownerId, tenantId, user.id],
        );
        if (!owner.rowCount) {
          return errorResponse("Cliente não encontrado para este login.", 404);
        }
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(
            "select public.app_gerar_cobranca_mensal($1, $2, $3, $4::date)",
            [tenantId, body.ownerId, user.id, `${body.month}-01`],
          );
          const entries = await client.query<{
            id: string;
            descricao: string;
            valor: string;
            data_vencimento: string;
            natureza: string;
            categoria: string;
            status: string;
            proprietario_id: string;
            competencia: string | null;
            link_pagamento: string | null;
            pix_copia_cola: string | null;
          }>(
            `select id, descricao, valor,
                    data_vencimento::text as data_vencimento,
                    natureza, categoria, status, proprietario_id,
                    competencia::text as competencia,
                    link_pagamento, pix_copia_cola
             from public.financeiro_lancamentos
             where tenant_id = $1 and criado_por = $2 and proprietario_id = $3
               and competencia = $4::date and status = 'PENDENTE'
               and excluido_em is null
             order by data_vencimento, created_at`,
            [tenantId, user.id, body.ownerId, `${body.month}-01`],
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
        if (!isClientAccount || !hasTenant) {
          return errorResponse("Apenas o login que criou o lançamento pode dar baixa.", 403);
        }
        if (!isUuid(body.id) || !isUuid(body.accountId)) {
          return errorResponse("Lançamento ou conta inválidos.", 400);
        }
        const result = await pool.query(
          `update public.financeiro_lancamentos
           set status = 'PAGO', data_pagamento = current_date, conta_bancaria_id = $1
           where id = $2 and tenant_id = $3 and criado_por = $4
             and status <> 'PAGO' and excluido_em is null
             and exists (
               select 1 from public.contas_bancarias
               where id = $1 and tenant_id = $3
             )
           returning id`,
          [body.accountId, body.id, tenantId, user.id],
        );
        if (!result.rowCount) {
          return errorResponse("Lançamento ou conta não encontrados para este login.", 404);
        }
        return Response.json({ updated: true });
      }

      case "createRecipient": {
        if (!isManager || !hasTenant || tenantPlan !== "HARAS") {
          return errorResponse("Reprodução está disponível somente para gestores HARAS.", 403);
        }
        const name = sanitizeText(body.name, 120);
        const registration = parseOptionalText(body.registration, 80);
        const location = parseOptionalText(body.location, 160);
        if (!name || !registration.valid || !location.valid) {
          return errorResponse("Informe um nome válido para a receptora.", 400);
        }
        const available = body.available !== false;
        const result = await pool.query<{ id: string }>(
          `insert into public.equinos (
             tenant_id, criado_por, nome, origem, categoria, status,
             registro_associacao, localizacao, receptora_disponivel
           )
           values ($1, $2, $3, 'TERCEIRO', 'RECEPTORA', 'DESCANSO', $4, $5, $6)
           returning id`,
          [tenantId, user.id, name, registration.value, location.value, available],
        );
        return Response.json(
          {
            recipient: {
              id: result.rows[0].id,
              nome: name,
              categoria: "RECEPTORA",
              registro_associacao: registration.value,
              localizacao: location.value,
              receptora_disponivel: available,
            },
          },
          { status: 201 },
        );
      }

      case "createCycle": {
        if (!isManager || !hasTenant || tenantPlan !== "HARAS") {
          return errorResponse("Reprodução está disponível somente para gestores HARAS.", 403);
        }
        const fields = parseReproductionCycleInput(body);
        if (!fields) {
          return errorResponse("Dados do ciclo inválidos.", 400);
        }

        const horseIds = [
          fields.mareId,
          fields.sireId,
          fields.recipientId,
        ].filter((id): id is string => Boolean(id));
        const horses = await pool.query<{
          id: string;
          nome: string;
          categoria: string;
          localizacao: string | null;
        }>(
          `select id, nome, categoria, localizacao
           from public.equinos
          where tenant_id = $1 and id = any($2::uuid[]) and excluido_em is null`,
          [tenantId, horseIds],
        );
        const mare = fields.mareId
          ? horses.rows.find((horse) => horse.id === fields.mareId)
          : null;
        const sire = fields.sireId
          ? horses.rows.find((horse) => horse.id === fields.sireId)
          : null;
        const recipient = fields.recipientId
          ? horses.rows.find((horse) => horse.id === fields.recipientId)
          : null;
        if (
          (fields.mareOrigin === "INTERNO" && mare?.categoria !== "MATRIZ") ||
          (fields.sireOrigin === "INTERNO" && sire?.categoria !== "GARANHAO") ||
          (fields.recipientId && recipient?.categoria !== "RECEPTORA")
        ) {
          return errorResponse("Confira as categorias dos animais selecionados.", 400);
        }
        if (fields.recipientId) {
          const reserved = await pool.query(
            `update public.equinos set receptora_disponivel = false
             where id = $1 and tenant_id = $2 and receptora_disponivel`,
            [fields.recipientId, tenantId],
          );
          if (!reserved.rowCount) {
            return errorResponse("A receptora selecionada não está disponível.", 409);
          }
        }

        const result = await pool.query<ReproductionCycle>(
          `insert into public.reproducao_ciclos (
             tenant_id, tipo, garanhao_id, matriz_id,
             garanhao_origem, garanhao_externo_nome, garanhao_externo_registro,
             matriz_origem, matriz_externa_nome, matriz_externa_registro,
             receptora_id, data_cobertura, hora_cobertura, veterinario, descricao,
             data_previsao_parto, status
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, 'AGUARDANDO_EXAME'
           )
           returning id, tipo, garanhao_id, matriz_id, receptora_id,
             garanhao_origem, garanhao_externo_nome, garanhao_externo_registro,
             matriz_origem, matriz_externa_nome, matriz_externa_registro,
             data_cobertura, to_char(hora_cobertura, 'HH24:MI') as hora_cobertura,
             veterinario, descricao, status, data_previsao_parto, data_parto_real,
             potro_gerado_id`,
          [
            tenantId,
            fields.type,
            fields.sireId,
            fields.mareId,
            fields.sireOrigin,
            fields.sireExternalName,
            fields.sireExternalRegistration,
            fields.mareOrigin,
            fields.mareExternalName,
            fields.mareExternalRegistration,
            fields.recipientId,
            fields.coverageDate,
            fields.coverageTime,
            fields.veterinarian,
            fields.description,
            fields.dueDate,
          ],
        ).catch(async (error: unknown) => {
          if (fields.recipientId) {
            await pool.query(
              `update public.equinos set receptora_disponivel = true
               where id = $1 and tenant_id = $2`,
              [fields.recipientId, tenantId],
            );
          }
          throw error;
        });
        return Response.json(
          {
            cycle: {
              ...result.rows[0],
              nome_garanhao: sire?.nome ?? fields.sireExternalName ?? "",
              nome_matriz: mare?.nome ?? fields.mareExternalName ?? "",
              nome_receptora: recipient?.nome ?? null,
              localizacao_receptora: recipient?.localizacao ?? null,
            },
          },
          { status: 201 },
        );
      }

      case "updateCycle": {
        if (!isManager || !hasTenant || tenantPlan !== "HARAS") {
          return errorResponse("Reprodução está disponível somente para gestores HARAS.", 403);
        }
        const fields = parseReproductionCycleInput(body);
        if (!isUuid(body.id) || !fields) {
          return errorResponse("Dados do ciclo inválidos.", 400);
        }
        const existing = await pool.query<{
          status: string;
          potro_gerado_id: string | null;
          receptora_id: string | null;
        }>(
          `select status, potro_gerado_id, receptora_id
           from public.reproducao_ciclos
           where id = $1 and tenant_id = $2`,
          [body.id, tenantId],
        );
        if (!existing.rowCount) {
          return errorResponse("Ciclo não encontrado.", 404);
        }
        if (
          existing.rows[0].status === "PARIDA" ||
          existing.rows[0].potro_gerado_id
        ) {
          return errorResponse("Ciclos com parto registrado não podem ser alterados.", 409);
        }

        const horseIds = [
          fields.mareId,
          fields.sireId,
          fields.recipientId,
        ].filter((id): id is string => Boolean(id));
        const horses = await pool.query<{
          id: string;
          nome: string;
          categoria: string;
          localizacao: string | null;
        }>(
          `select id, nome, categoria, localizacao
           from public.equinos
           where tenant_id = $1 and id = any($2::uuid[]) and excluido_em is null`,
          [tenantId, horseIds],
        );
        const mare = fields.mareId
          ? horses.rows.find((horse) => horse.id === fields.mareId)
          : null;
        const sire = fields.sireId
          ? horses.rows.find((horse) => horse.id === fields.sireId)
          : null;
        const recipient = fields.recipientId
          ? horses.rows.find((horse) => horse.id === fields.recipientId)
          : null;
        if (
          (fields.mareOrigin === "INTERNO" && mare?.categoria !== "MATRIZ") ||
          (fields.sireOrigin === "INTERNO" && sire?.categoria !== "GARANHAO") ||
          (fields.recipientId && recipient?.categoria !== "RECEPTORA")
        ) {
          return errorResponse("Confira as categorias dos animais selecionados.", 400);
        }
        const previousRecipientId = existing.rows[0].receptora_id;
        const recipientChanged = fields.recipientId !== previousRecipientId;
        if (recipientChanged && fields.recipientId) {
          const reserved = await pool.query(
            `update public.equinos set receptora_disponivel = false
             where id = $1 and tenant_id = $2 and receptora_disponivel`,
            [fields.recipientId, tenantId],
          );
          if (!reserved.rowCount) {
            return errorResponse("A receptora selecionada não está disponível.", 409);
          }
        }
        const releaseRecipient = (id: string | null) =>
          id
            ? pool.query(
                `update public.equinos set receptora_disponivel = true
                 where id = $1 and tenant_id = $2`,
                [id, tenantId],
              )
            : Promise.resolve();

        const result = await pool.query<ReproductionCycle>(
          `update public.reproducao_ciclos
           set tipo = $1, garanhao_id = $2, matriz_id = $3,
               garanhao_origem = $4, garanhao_externo_nome = $5,
               garanhao_externo_registro = $6, matriz_origem = $7,
               matriz_externa_nome = $8, matriz_externa_registro = $9,
               receptora_id = $10, data_cobertura = $11, hora_cobertura = $12,
               veterinario = $13, descricao = $14, data_previsao_parto = $15
           where id = $16 and tenant_id = $17 and status <> 'PARIDA'
             and potro_gerado_id is null
           returning id, tipo, garanhao_id, matriz_id, receptora_id,
             garanhao_origem, garanhao_externo_nome, garanhao_externo_registro,
             matriz_origem, matriz_externa_nome, matriz_externa_registro,
             data_cobertura, to_char(hora_cobertura, 'HH24:MI') as hora_cobertura,
             veterinario, descricao, status, data_previsao_parto, data_parto_real,
             potro_gerado_id`,
          [
            fields.type,
            fields.sireId,
            fields.mareId,
            fields.sireOrigin,
            fields.sireExternalName,
            fields.sireExternalRegistration,
            fields.mareOrigin,
            fields.mareExternalName,
            fields.mareExternalRegistration,
            fields.recipientId,
            fields.coverageDate,
            fields.coverageTime,
            fields.veterinarian,
            fields.description,
            fields.dueDate,
            body.id,
            tenantId,
          ],
        ).catch(async (error: unknown) => {
          if (recipientChanged) await releaseRecipient(fields.recipientId);
          throw error;
        });
        if (!result.rowCount) {
          if (recipientChanged) await releaseRecipient(fields.recipientId);
          return errorResponse("Ciclo não encontrado ou com parto registrado.", 409);
        }
        if (recipientChanged) await releaseRecipient(previousRecipientId);
        return Response.json({
          cycle: {
            ...result.rows[0],
            nome_garanhao: sire?.nome ?? fields.sireExternalName ?? "",
            nome_matriz: mare?.nome ?? fields.mareExternalName ?? "",
            nome_receptora: recipient?.nome ?? null,
            localizacao_receptora: recipient?.localizacao ?? null,
          },
        });
      }

      case "updateCycleStatus": {
        if (!isManager || !hasTenant || tenantPlan !== "HARAS") {
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
          [body.status, body.id, tenantId],
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
             endereco_completo, numero_socio_abccmm::double precision as numero_socio_abccmm,
             data_inicio::text as data_inicio, data_fim::text as data_fim`,
          [
            tenantId,
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
             endereco_completo, numero_socio_abccmm::double precision as numero_socio_abccmm,
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
            tenantId,
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

        if (!isValidCpf(cpf)) {
          return errorResponse("CPF inválido.", 400);
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
              tenantId,
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
            tenantId,
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
          [body.id, tenantId],
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
              tenantId,
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
                tenantId,
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
              tenantId,
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
              [body.id, tenantId],
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
                [fields.nome, accessEmail, accessPasswordHash, existingAccess.rows[0].id, tenantId],
              );
            } else {
              await client.query(
                `insert into public.usuarios (
                   tenant_id, cadastro_cte_haras_id, nome, email, senha_hash, perfil
                 )
                 values ($1, $2, $3, $4, $5, 'CLIENTE')`,
                [tenantId, body.id, fields.nome, accessEmail, accessPasswordHash],
              );
            }
          } else {
            const existingAccess = await client.query(
              `select email from public.usuarios
               where cadastro_cte_haras_id = $1 and tenant_id = $2
               limit 1`,
              [body.id, tenantId],
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
          [body.id, tenantId],
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
