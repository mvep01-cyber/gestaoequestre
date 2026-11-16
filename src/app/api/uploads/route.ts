import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

const maxFileSize = 10 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function isUuid(value: FormDataEntryValue | null): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function matchesFileSignature(mimeType: string, bytes: Uint8Array) {
  if (
    mimeType === "image/jpeg" &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return true;
  }
  if (
    mimeType === "image/png" &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return true;
  }
  if (
    mimeType === "image/webp" &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (
    mimeType === "application/pdf" &&
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
  ) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxFileSize + 64 * 1024) {
    return Response.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });
  }

  const user = await getCurrentUser();
  if (!user || !user.tenant_id || user.perfil !== "ADMIN") {
    return Response.json({ error: "Ação permitida somente a gestores." }, { status: 403 });
  }
  if (!isTenantAvailable(user)) {
    return Response.json({ error: "A assinatura está bloqueada." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Formulário de arquivo inválido." }, { status: 400 });
  }

  const file = form.get("file");
  const type = form.get("tipo");
  const horseId = form.get("equinoId");
  const entryId = form.get("lancamentoId");
  if (
    !(file instanceof File) ||
    (type !== "EQUINO" && type !== "COMPROVANTE") ||
    file.size < 1 ||
    file.size > maxFileSize ||
    !Object.hasOwn(allowedTypes, file.type) ||
    file.name.length > 200
  ) {
    return Response.json({ error: "Arquivo inválido ou maior que 10 MB." }, { status: 400 });
  }
  if (
    (type === "EQUINO" && (!isUuid(horseId) || entryId !== null)) ||
    (type === "COMPROVANTE" && (!isUuid(entryId) || horseId !== null))
  ) {
    return Response.json({ error: "Vínculo do arquivo inválido." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(file.type, bytes)) {
    return Response.json({ error: "O conteúdo do arquivo não corresponde ao formato." }, {
      status: 400,
    });
  }

  const pool = getPool();
  const linkedRecord = await pool.query(
    type === "EQUINO"
      ? "select id from public.equinos where id = $1 and tenant_id = $2"
      : "select id from public.financeiro_lancamentos where id = $1 and tenant_id = $2",
    [type === "EQUINO" ? horseId : entryId, user.tenant_id],
  );
  if (!linkedRecord.rowCount) {
    return Response.json({ error: "Registro não encontrado neste centro." }, { status: 404 });
  }

  const id = randomUUID();
  const extension = allowedTypes[file.type];
  const relativePath = `${user.tenant_id}/${id}${extension}`;
  const absolutePath = path.join(
    process.cwd(),
    "storage",
    "uploads",
    user.tenant_id,
    `${id}${extension}`,
  );
  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes, { flag: "wx" });
  } catch (error) {
    console.error("Falha ao salvar arquivo local:", error);
    return Response.json({ error: "Não foi possível salvar o arquivo." }, { status: 500 });
  }

  try {
    await pool.query(
      `insert into public.arquivos (
         id, tenant_id, enviado_por, tipo, nome_original, mime_type,
         tamanho_bytes, caminho, equino_id, lancamento_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        user.tenant_id,
        user.id,
        type,
        path.basename(file.name),
        file.type,
        file.size,
        relativePath,
        type === "EQUINO" ? horseId : null,
        type === "COMPROVANTE" ? entryId : null,
      ],
    );
  } catch (error) {
    try {
      await rm(absolutePath, { force: true });
    } catch (cleanupError) {
      console.error("Falha ao remover arquivo não registrado:", cleanupError);
    }
    console.error("Falha ao registrar o arquivo enviado:", error);
    return Response.json({ error: "Não foi possível registrar o arquivo." }, { status: 500 });
  }

  return Response.json({ id, url: `/api/uploads/${id}` }, { status: 201 });
}
