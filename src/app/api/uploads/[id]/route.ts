import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.perfil !== "ADMIN" && !user.tenant_id) ||
    !isTenantAvailable(user)
  ) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const isClientAccount =
    user.perfil === "CLIENTE" &&
    (user.tipo_cadastro === "CTE" || user.tipo_cadastro === "HARAS");

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const result = await getPool().query<{
    caminho: string;
    nome_original: string;
    mime_type: string;
    tipo: string;
    tenant_id: string;
    equino_id: string | null;
    lancamento_id: string | null;
  }>(
    `select caminho, nome_original, mime_type, tipo, tenant_id, equino_id, lancamento_id
     from public.arquivos
     where id = $1 and ($2::uuid is null or tenant_id = $2)`,
    [id, user.perfil === "ADMIN" ? null : user.tenant_id],
  );
  const fileRecord = result.rows[0];
  if (!fileRecord) {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  if (fileRecord.tipo === "COMPROVANTE") {
    if (!isClientAccount || !fileRecord.lancamento_id) {
      return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    const entryAccess = await getPool().query(
      `select 1 from public.financeiro_lancamentos
       where id = $1 and tenant_id = $2 and criado_por = $3
         and excluido_em is null`,
      [fileRecord.lancamento_id, fileRecord.tenant_id, user.id],
    );
    if (!entryAccess.rowCount) {
      return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
  }
  if (
    fileRecord.tipo === "EQUINO" &&
    user.perfil !== "ADMIN" &&
    user.perfil !== "OPERACIONAL"
  ) {
    const horseAccess = await getPool().query(
      `select 1
       from public.equinos
       where id = $1 and tenant_id = $2 and criado_por = $3
         and excluido_em is null`,
      [fileRecord.equino_id, fileRecord.tenant_id, user.id],
    );
    if (!horseAccess.rowCount) {
      return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
  }

  const storageRoot = path.resolve(process.cwd(), "storage", "uploads");
  const filePath = path.resolve(storageRoot, fileRecord.caminho);
  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  try {
    const bytes = new Uint8Array(await readFile(filePath));
    const disposition = fileRecord.mime_type.startsWith("image/") ? "inline" : "attachment";
    return new Response(bytes, {
      headers: {
        "Content-Type": fileRecord.mime_type,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(fileRecord.nome_original)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Falha ao ler arquivo privado:", error);
    return Response.json({ error: "Arquivo indisponível." }, { status: 404 });
  }
}
