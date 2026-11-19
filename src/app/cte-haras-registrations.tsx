"use client";

import { Plus, Search, UsersRound, X } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type CteHarasRegistration = {
  id: string;
  tipo_cadastro: "CTE" | "HARAS";
  nome: string;
  telefone_whatsapp: string | null;
  documento: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  idade: number | null;
  profissao: string | null;
  endereco_completo: string | null;
  numero_socio_abccmm: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  login_email?: string | null;
};

type FormState = {
  id: string;
  tipo_cadastro: "" | "CTE" | "HARAS";
  nome: string;
  telefone_whatsapp: string;
  documento: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  profissao: string;
  endereco_completo: string;
  numero_socio_abccmm: string;
  data_inicio: string;
  data_fim: string;
  gerar_acesso: boolean;
  login_email: string;
  login_senha: string;
};

const emptyForm: FormState = {
  id: "", tipo_cadastro: "", nome: "", telefone_whatsapp: "", documento: "",
  cpf: "", rg: "", data_nascimento: "", profissao: "", endereco_completo: "",
  numero_socio_abccmm: "", data_inicio: "", data_fim: "", gerar_acesso: false,
  login_email: "", login_senha: "",
};

type TextField = Exclude<keyof FormState, "id" | "tipo_cadastro" | "gerar_acesso">;
const fields: { key: TextField; label: string; type?: string; placeholder?: string }[] = [
  { key: "nome", label: "Nome do cliente", placeholder: "Ex.: João da Silva" },
  { key: "telefone_whatsapp", label: "Telefone WhatsApp", placeholder: "Ex.: (11) 91234-5678" },
  { key: "documento", label: "Documento" },
  { key: "cpf", label: "CPF" },
  { key: "rg", label: "RG" },
  { key: "data_nascimento", label: "Data de nascimento", type: "date" },
  { key: "profissao", label: "Profissão" },
  { key: "endereco_completo", label: "Endereço completo" },
  { key: "numero_socio_abccmm", label: "Número de sócio ABCCMM", type: "number" },
  { key: "data_inicio", label: "Data de início", type: "date" },
  { key: "data_fim", label: "Data de fim", type: "date" },
];

function toForm(registration: CteHarasRegistration): FormState {
  return {
    ...emptyForm,
    id: registration.id,
    tipo_cadastro: registration.tipo_cadastro,
    nome: registration.nome,
    telefone_whatsapp: registration.telefone_whatsapp ?? "",
    documento: registration.documento ?? "",
    cpf: registration.cpf ?? "",
    rg: registration.rg ?? "",
    data_nascimento: registration.data_nascimento ?? "",
    profissao: registration.profissao ?? "",
    endereco_completo: registration.endereco_completo ?? "",
    numero_socio_abccmm: registration.numero_socio_abccmm?.toString() ?? "",
    data_inicio: registration.data_inicio ?? "",
    data_fim: registration.data_fim ?? "",
    login_email: registration.login_email ?? "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function CteHarasRegistrations({
  registrations,
  tenants,
  tenantId,
  demo,
  action,
}: {
  registrations: CteHarasRegistration[];
  tenants: { id: string; nome: string }[];
  tenantId?: string;
  demo: boolean;
  action: (name: string, fields: Record<string, unknown>) => Promise<unknown>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [demoRegistrations, setDemoRegistrations] = useState(registrations);
  const filtered = (demo ? demoRegistrations : registrations).filter((item) =>
    [item.tipo_cadastro, item.nome, item.documento, item.telefone_whatsapp]
      .join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (demo) {
      if (form.tipo_cadastro !== "CTE" && form.tipo_cadastro !== "HARAS") return;
      const registration: CteHarasRegistration = {
        id: form.id || `demo-${crypto.randomUUID()}`,
        tipo_cadastro: form.tipo_cadastro,
        nome: form.nome.trim(),
        telefone_whatsapp: form.telefone_whatsapp.trim(),
        documento: form.documento.trim(),
        cpf: form.cpf.trim(),
        rg: form.rg.trim(),
        data_nascimento: form.data_nascimento,
        idade: null,
        profissao: form.profissao.trim(),
        endereco_completo: form.endereco_completo.trim(),
        numero_socio_abccmm: Number(form.numero_socio_abccmm),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        login_email: form.login_email || null,
      };
      setDemoRegistrations((current) =>
        form.id
          ? current.map((item) => item.id === form.id ? registration : item)
          : [...current, registration],
      );
      setForm(null);
      setFeedback(form.id ? "Cadastro CTE/Haras atualizado." : "Cadastro CTE/Haras criado.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const result = await action(form.id ? "updateCteHarasRegistration" : "createCteHarasRegistration", {
        ...form,
        tenantId,
      });
      if (!isRecord(result) || !isRecord(result.registration) || typeof result.registration.id !== "string") {
        throw new Error("O servidor não confirmou o cadastro.");
      }
      setForm(null);
      setFeedback(form.id ? "Cadastro CTE/Haras atualizado." : "Cadastro CTE/Haras criado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao salvar cadastro CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(registration: CteHarasRegistration) {
    if (!window.confirm(`Excluir o cadastro de ${registration.nome}? O acesso vinculado também será excluído.`)) return;
    if (demo) {
      setDemoRegistrations((current) => current.filter((item) => item.id !== registration.id));
      setFeedback("Cadastro CTE/Haras excluído.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const result = await action("deleteCteHarasRegistration", { id: registration.id, tenantId });
      if (!isRecord(result) || result.deleted !== true) {
        throw new Error("O servidor não confirmou a exclusão.");
      }
      setFeedback("Cadastro CTE/Haras excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cadastro CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {feedback && !form && <p className="feedback-message" role="status">{feedback}</p>}
      {tenants.length > 1 && tenantId && (
        <label className="registration-tenant-select">
          Centro selecionado
          <select
            value={tenantId}
            onChange={(event) => {
              setFeedback("");
              router.push(`/dashboard?tenantId=${encodeURIComponent(event.target.value)}`);
            }}
          >
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome}</option>)}
          </select>
        </label>
      )}
      <div className="list-toolbar">
        <label className="search-box">
          <Search size={20} />
          <span className="sr-only">Buscar cadastro CTE/Haras</span>
          <input type="search" placeholder="Buscar por tipo, nome, documento ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button className="button button-primary" onClick={() => { setFeedback(""); setForm(emptyForm); }}>
          <Plus size={20} /> Novo cadastro
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="panel empty-state">
          <UsersRound size={34} />
          <h2>{search ? "Nenhum cadastro CTE/Haras encontrado" : "Ainda não há cadastros CTE/Haras"}</h2>
          <p>{search ? "Tente buscar usando outro tipo, nome, documento ou telefone." : "Cadastre o primeiro registro para começar."}</p>
        </div>
      ) : (
        <div className="client-table-wrap">
          <table className="client-table">
            <thead><tr><th>Tipo</th><th>Nome</th><th>Telefone</th><th>Data de início</th><th>Sócio ABCCMM</th><th>Acesso</th><th>Ações</th></tr></thead>
            <tbody>{filtered.map((registration) => (
              <tr key={registration.id}>
                <td>{registration.tipo_cadastro === "CTE" ? "CTE" : "Haras"}</td>
                <td>{registration.nome}</td><td>{registration.telefone_whatsapp || "—"}</td>
                <td>{registration.data_inicio ? new Date(`${registration.data_inicio.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                <td>{registration.numero_socio_abccmm ?? "—"}</td><td>{registration.login_email || "Não gerado"}</td>
                <td><div className="client-row-actions">
                  <button className="button button-secondary" disabled={saving} onClick={() => { setFeedback(""); setForm(toForm(registration)); }}>Alterar</button>
                  <button className="button button-quiet" disabled={saving} onClick={() => void remove(registration)}>Excluir</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {form && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setForm(null); }}>
          <section className="modal-card client-modal-card" role="dialog" aria-modal="true" aria-labelledby="registration-form-title">
            <div className="modal-heading">
              <div><span className="eyebrow">{form.id ? "Atualização cadastral" : "Novo cadastro"}</span><h2 id="registration-form-title">{form.id ? "Editar cadastro CTE/Haras" : "Novo cadastro CTE/Haras"}</h2></div>
              <button type="button" className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setForm(null)}><X size={22} /></button>
            </div>
            <form className="client-form" onSubmit={(event) => void submit(event)}>
              <label htmlFor="registration-type">Tipo do cadastro</label>
              <select id="registration-type" required value={form.tipo_cadastro} onChange={(event) => setForm({ ...form, tipo_cadastro: event.target.value === "CTE" || event.target.value === "HARAS" ? event.target.value : "" })}>
                <option value="">Selecione</option><option value="CTE">CTE</option><option value="HARAS">Haras</option>
              </select>
              <label className="checkbox-label" htmlFor="registration-generate-access">
                <input id="registration-generate-access" type="checkbox" checked={form.gerar_acesso} onChange={(event) => setForm({ ...form, gerar_acesso: event.target.checked })} />
                Gerar login e senha para este CTE/Haras
              </label>
              {form.gerar_acesso && (
                <>
                  <label htmlFor="registration-email">E-mail de acesso</label>
                  <input id="registration-email" type="email" autoComplete="email" required maxLength={254} value={form.login_email} onChange={(event) => setForm({ ...form, login_email: event.target.value })} />
                  <label htmlFor="registration-password">Senha de acesso</label>
                  <input id="registration-password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={form.login_senha} onChange={(event) => setForm({ ...form, login_senha: event.target.value })} placeholder="Mínimo de 12 caracteres" />
                </>
              )}
              {fields.map((field) => (
                <Fragment key={field.key}>
                  <label htmlFor={`registration-${field.key}`}>{field.label}</label>
                  <input id={`registration-${field.key}`} type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} required value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                </Fragment>
              ))}
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions">
                <button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
                <button className="button button-primary" disabled={saving}><Plus size={19} /> {saving ? "Salvando..." : "Salvar cadastro"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
