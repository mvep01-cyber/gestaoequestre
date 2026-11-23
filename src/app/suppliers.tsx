"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { ProviderCenter } from "./service-providers";

type SupplierFields = {
  nome: string; cnpj_cpf: string; endereco: string; cep: string; bairro: string; cidade: string;
  estado: string; telefone: string; nome_vendedor: string; telefone_vendedor: string; email: string;
};
type Supplier = SupplierFields & { id: string; cadastro_cte_haras_id: string; produtos: number };
type SupplierData = { suppliers: Supplier[]; centers: ProviderCenter[] };
type FieldName = keyof SupplierFields;
const fields: { key: FieldName; label: string; column: string; type?: string }[] = [
  { key: "nome", label: "Nome do fornecedor", column: "Fornecedor" },
  { key: "cnpj_cpf", label: "CNPJ/CPF do fornecedor", column: "CNPJ/CPF" },
  { key: "endereco", label: "Endereço do fornecedor", column: "Endereço" },
  { key: "cep", label: "CEP do fornecedor", column: "CEP" },
  { key: "bairro", label: "Bairro do fornecedor", column: "Bairro" },
  { key: "cidade", label: "Cidade do fornecedor", column: "Cidade" },
  { key: "estado", label: "Estado do fornecedor", column: "Estado" },
  { key: "telefone", label: "Telefone do fornecedor", column: "Telefone do fornecedor", type: "tel" },
  { key: "nome_vendedor", label: "Nome do vendedor", column: "Nome do vendedor" },
  { key: "telefone_vendedor", label: "Telefone do vendedor", column: "Telefone do vendedor", type: "tel" },
  { key: "email", label: "E-mail", column: "E-mail", type: "email" },
];
const empty: SupplierFields = {
  nome: "", cnpj_cpf: "", endereco: "", cep: "", bairro: "", cidade: "",
  estado: "", telefone: "", nome_vendedor: "", telefone_vendedor: "", email: "",
};

async function loadSuppliers(): Promise<SupplierData> {
  const response = await fetch("/api/suppliers", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível consultar os fornecedores.");
  return result;
}

export function Suppliers({ demo, centerId, onCentersChange, onCenterChange, onViewProducts }: {
  demo: boolean;
  centerId: string;
  onCentersChange: Dispatch<SetStateAction<ProviderCenter[]>>;
  onCenterChange: Dispatch<SetStateAction<string>>;
  onViewProducts: (supplier: { id: string; nome: string }) => void;
}) {
  const [data, setData] = useState<SupplierData | null>(null);
  const [form, setForm] = useState<SupplierFields | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    loadSuppliers().then((result) => {
      if (active) {
        setData(result);
        onCentersChange(result.centers);
        onCenterChange((current) => result.centers.some((center) => center.id === current) ? current : result.centers[0]?.id ?? "");
      }
    }).catch((error: unknown) => {
      console.error("Falha ao consultar fornecedores:", error);
      if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível consultar os fornecedores.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, onCentersChange, onCenterChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/suppliers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : { cadastro_cte_haras_id: centerId }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível salvar o fornecedor.");
      if (typeof result.id !== "string") throw new Error("O servidor não confirmou o cadastro.");
      setForm(null);
      setFeedback(editingId ? "Fornecedor alterado." : "Fornecedor cadastrado.");
      try {
        const updated = await loadSuppliers();
        setData(updated);
        onCentersChange(updated.centers);
        onCenterChange((current) => updated.centers.some((center) => center.id === current) ? current : updated.centers[0]?.id ?? "");
      } catch (error) {
        console.error("Falha ao atualizar fornecedores:", error);
        setData(null);
        setFeedback("Fornecedor salvo, mas não foi possível atualizar a lista. Abra o menu novamente.");
      }
    } catch (error) {
      console.error("Falha ao salvar fornecedor:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  if (demo) return <p className="feedback-message">O cadastro de fornecedores exige uma conexão com o banco de dados.</p>;
  if (loading) return <p>Carregando fornecedores...</p>;
  if (!data) return <p className="feedback-message" role="alert">{feedback}</p>;
  const filtered = data.suppliers.filter((supplier) => supplier.cadastro_cte_haras_id === centerId &&
    [...fields.map(({ key }) => supplier[key]), String(supplier.produtos)].join(" ")
      .toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const open = (supplier?: Supplier) => {
    setFeedback("");
    setEditingId(supplier?.id ?? null);
    setForm(supplier ? {
      nome: supplier.nome, cnpj_cpf: supplier.cnpj_cpf, endereco: supplier.endereco, cep: supplier.cep,
      bairro: supplier.bairro, cidade: supplier.cidade, estado: supplier.estado, telefone: supplier.telefone,
      nome_vendedor: supplier.nome_vendedor, telefone_vendedor: supplier.telefone_vendedor, email: supplier.email,
    } : { ...empty });
  };
  const count = (supplier: Supplier) => `${supplier.produtos} ${supplier.produtos === 1 ? "produto" : "produtos"}`;
  return (
    <>
      {feedback && !form && !viewing && <p className="feedback-message" role="status">{feedback}</p>}
      <div className="provider-toolbar">
        <input className="provider-search" type="search" aria-label="Buscar nesta lista" placeholder="Buscar nesta lista" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="button button-primary" disabled={saving || !centerId} onClick={() => open()}>＋ Novo fornecedor</button>
      </div>
      {data.centers.length === 0 && <p role="status">Nenhum CTE/Haras disponível para este cadastro.</p>}
      <div className="provider-table-wrap"><table className="provider-table">
        <thead><tr>{fields.map(({ key, column }) => <th scope="col" key={key}>{column}</th>)}<th scope="col">Produtos</th><th scope="col">Ações</th></tr></thead>
        <tbody>{filtered.map((supplier) => <tr key={supplier.id}>
          {fields.map(({ key }) => <td key={key}>{supplier[key] || "—"}</td>)}<td>{count(supplier)}</td>
          <td><div className="provider-row-actions">
            <button className="button button-secondary provider-small-button" onClick={() => onViewProducts({ id: supplier.id, nome: supplier.nome })}>Ver produtos</button>
            <button className="button button-secondary provider-small-button" onClick={() => { setFeedback(""); setViewing(supplier); }}>Visualizar</button>
            <button className="button button-quiet provider-small-button" onClick={() => open(supplier)}>Alterar</button>
          </div></td>
        </tr>)}
        {filtered.length === 0 && <tr><td className="provider-empty" colSpan={fields.length + 2}>Nenhum registro encontrado.</td></tr>}
        </tbody>
      </table></div>
      <div className="provider-note">Cada fornecedor pertence a um CTE/Haras e possui sua lista de produtos.</div>
      {(form || viewing) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) { setForm(null); setViewing(null); }
      }}>
        <section className="modal-card provider-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-title">
          <div className="provider-modal-heading"><h2 id="supplier-title">{viewing ? "Visualizar registro" : editingId ? "Alterar — Fornecedor" : "Fornecedor"}</h2>
            <button type="button" className="provider-close" aria-label="Fechar" disabled={saving} onClick={() => { setForm(null); setViewing(null); }}>×</button>
          </div>
          {viewing ? <>
            <div className="provider-form-grid">
              {fields.map(({ key, column }) => <div className="provider-field" key={key}><span>{column}</span><strong>{viewing[key] || "—"}</strong></div>)}
              <div className="provider-field"><span>Produtos</span><strong>{count(viewing)}</strong></div>
            </div>
            <div className="provider-form-actions"><button type="button" className="button button-secondary" onClick={() => setViewing(null)}>Fechar</button></div>
          </> : form && <form onSubmit={(event) => void submit(event)}>
            <div className="provider-form-grid">
              <label className="provider-field" htmlFor="supplier-center">CTE/Haras
                <select id="supplier-center" disabled value={centerId}>
                  {data.centers.map((center) => <option key={center.id} value={center.id}>{center.nome}</option>)}
                </select>
              </label>
              {fields.map(({ key, label, type }) => <label className="provider-field" htmlFor={`supplier-${key}`} key={key}>
                {label}
                <input id={`supplier-${key}`} type={type ?? "text"} required={key === "nome"} maxLength={200}
                  value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>)}
            </div>
            <p className="provider-form-note">O nome do fornecedor é obrigatório. Para trocar o centro, feche o formulário e selecione-o no topo.</p>
            {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
            <div className="provider-form-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
              <button className="button button-primary" disabled={saving || !centerId}>{saving ? "Salvando..." : "Salvar"}</button></div>
          </form>}
        </section>
      </div>}
    </>
  );
}
