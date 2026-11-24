"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { isValidCpfOrCnpj } from "@/lib/brazilian-documents";

type ProviderFields = {
  nome: string; cpf: string; rg: string; endereco: string; complemento: string; cep: string; bairro: string;
  cidade: string; estado: string; telefone: string; email: string; servicos: string;
};
type Provider = ProviderFields & { id: string; cadastro_cte_haras_id: string; cadastro_nome: string };
export type ProviderCenter = { id: string; nome: string; tipo_cadastro: "CTE" | "HARAS" };
type ProviderData = { providers: Provider[]; centers: ProviderCenter[] };
type FieldName = keyof ProviderFields;
const fields: { key: FieldName; label: string; column: string; type?: string }[] = [
  { key: "nome", label: "Nome do prestador", column: "Prestador" },
  { key: "cpf", label: "CPF/CNPJ do prestador", column: "CPF/CNPJ" },
  { key: "rg", label: "RG do prestador", column: "RG" },
  { key: "endereco", label: "Endereço do prestador", column: "Endereço" },
  { key: "complemento", label: "Complemento", column: "Complemento" },
  { key: "cep", label: "CEP do prestador", column: "CEP" },
  { key: "bairro", label: "Bairro do prestador", column: "Bairro" },
  { key: "cidade", label: "Cidade do prestador", column: "Cidade" },
  { key: "estado", label: "Estado do prestador", column: "Estado" },
  { key: "telefone", label: "Telefone", column: "Telefone", type: "tel" },
  { key: "email", label: "E-mail", column: "E-mail", type: "email" },
  { key: "servicos", label: "Serviços oferecidos", column: "Serviços oferecidos" },
];
const states = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const empty: ProviderFields = {
  nome: "", cpf: "", rg: "", endereco: "", complemento: "", cep: "", bairro: "", cidade: "",
  estado: "", telefone: "", email: "", servicos: "",
};

async function loadProviders(): Promise<ProviderData> {
  const response = await fetch("/api/service-providers", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível consultar os prestadores.");
  return result;
}

export function ServiceProviders({ demo, centerId, onCentersChange, onCenterChange }: {
  demo: boolean;
  centerId: string;
  onCentersChange: Dispatch<SetStateAction<ProviderCenter[]>>;
  onCenterChange: Dispatch<SetStateAction<string>>;
}) {
  const [data, setData] = useState<ProviderData | null>(null);
  const [form, setForm] = useState<ProviderFields | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    loadProviders().then((result) => {
      if (active) {
        setData(result);
        onCentersChange(result.centers);
        onCenterChange((current) => result.centers.some((center) => center.id === current) ? current : result.centers[0]?.id ?? "");
      }
    })
      .catch((error: unknown) => {
        console.error("Falha ao consultar prestadores:", error);
        if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível consultar os prestadores.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, onCentersChange, onCenterChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (form.cpf.trim() && !isValidCpfOrCnpj(form.cpf)) {
      setFeedback("Informe um CPF ou CNPJ válido.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/service-providers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : { cadastro_cte_haras_id: centerId }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível salvar o prestador.");
      if (typeof result.id !== "string") throw new Error("O servidor não confirmou o cadastro.");
      setForm(null);
      setFeedback(editingId ? "Prestador alterado." : "Prestador cadastrado.");
      try {
        const updated = await loadProviders();
        setData(updated);
        onCentersChange(updated.centers);
        onCenterChange((current) => updated.centers.some((center) => center.id === current) ? current : updated.centers[0]?.id ?? "");
      } catch (error) {
        console.error("Falha ao atualizar prestadores:", error);
        setData(null);
        setFeedback("Prestador salvo, mas não foi possível atualizar a lista. Abra o menu novamente.");
      }
    } catch (error) {
      console.error("Falha ao salvar prestador:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o prestador.");
    } finally {
      setSaving(false);
    }
  }

  if (demo) return <p className="feedback-message">O cadastro de prestadores exige uma conexão com o banco de dados.</p>;
  if (loading) return <p>Carregando prestadores...</p>;
  if (!data) return <p className="feedback-message" role="alert">{feedback}</p>;
  const filtered = data.providers.filter((provider) => provider.cadastro_cte_haras_id === centerId &&
    [provider.cadastro_nome, ...fields.map(({ key }) => provider[key])].join(" ")
      .toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const open = (provider?: Provider, readOnly = false) => {
    setFeedback("");
    setEditingId(provider?.id ?? null);
    setViewing(readOnly);
    setForm(provider ? { nome: provider.nome, cpf: provider.cpf.toUpperCase(), rg: provider.rg, endereco: provider.endereco, complemento: provider.complemento, cep: provider.cep,
      bairro: provider.bairro, cidade: provider.cidade, estado: provider.estado, telefone: provider.telefone,
      email: provider.email, servicos: provider.servicos } : { ...empty });
  };
  return (
    <>
      {feedback && !form && <p className="feedback-message" role="status">{feedback}</p>}
      <div className="provider-toolbar">
        <input className="provider-search" type="search" aria-label="Buscar nesta lista" placeholder="Buscar nesta lista" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="button button-primary" disabled={saving || !centerId} onClick={() => open()}>＋ Nova prestação de serviços</button>
      </div>
      {data.centers.length === 0 && <p role="status">Nenhum CTE/Haras disponível para este cadastro.</p>}
      <div className="provider-table-wrap"><table className="provider-table">
          <thead><tr>{fields.map(({ key, column }) => <th scope="col" key={key}>{column}</th>)}<th scope="col">Ações</th></tr></thead>
          <tbody>{filtered.map((provider) => <tr key={provider.id}>
            {fields.map(({ key }) => <td key={key}>{provider[key] || "—"}</td>)}
            <td><div className="provider-row-actions">
              <button className="button button-secondary provider-small-button" onClick={() => open(provider, true)}>Visualizar</button>
              <button className="button button-quiet provider-small-button" onClick={() => open(provider)}>Alterar</button>
            </div></td>
          </tr>)}
          {filtered.length === 0 && <tr><td className="provider-empty" colSpan={fields.length + 1}>Nenhum registro encontrado.</td></tr>}
          </tbody>
        </table></div>
      <div className="provider-note">Informe os serviços oferecidos pelo prestador.</div>
      {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setForm(null); }}>
        <section className="modal-card provider-modal" role="dialog" aria-modal="true" aria-labelledby="provider-title">
          <div className="provider-modal-heading"><h2 id="provider-title">{viewing ? "Visualizar registro" : editingId ? "Alterar — Prestação de Serviços" : "Prestação de Serviços"}</h2>
            <button type="button" className="provider-close" aria-label="Fechar" disabled={saving} onClick={() => setForm(null)}>×</button>
          </div>
          {viewing ? <>
            <div className="provider-form-grid">
              {fields.map(({ key, column }) => <div className="provider-field" key={key}><span>{column}</span><strong>{form[key] || "—"}</strong></div>)}
            </div>
            <div className="provider-form-actions"><button type="button" className="button button-secondary" onClick={() => setForm(null)}>Fechar</button></div>
          </> : <form onSubmit={(event) => void submit(event)}>
            <div className="provider-form-grid">
            <label className="provider-field" htmlFor="provider-center">CTE/Haras
              <select id="provider-center" disabled value={centerId}>
                {data.centers.map((center) => <option key={center.id} value={center.id}>{center.nome}</option>)}
              </select>
            </label>
            {fields.map(({ key, label, type }) => <label className="provider-field" htmlFor={`provider-${key}`} key={key}>
              {label}
              {key === "estado" ? <select id={`provider-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
                <option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}
              </select> : <input id={`provider-${key}`} type={type ?? "text"} required={key === "nome"}
                maxLength={key === "cpf" ? 18 : key === "complemento" ? 30 : key === "servicos" ? 1000 : 200}
                autoCapitalize={key === "cpf" ? "characters" : undefined}
                placeholder={key === "cpf" ? "CPF ou CNPJ" : undefined}
                value={form[key]} onChange={(event) => setForm({ ...form, [key]: key === "cpf" ? event.target.value.toUpperCase() : event.target.value })} />}
            </label>)}
            </div>
            <p className="provider-form-note">O nome do prestador é obrigatório. Para trocar o centro, feche o formulário e selecione-o no topo.</p>
            {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
            <div className="provider-form-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
              <button className="button button-primary" disabled={saving || !centerId}>{saving ? "Salvando..." : "Salvar"}</button></div>
          </form>}
        </section>
      </div>}
    </>
  );
}
