"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { ProviderCenter } from "./service-providers";

type EmployeeFields = {
  nome: string; cpf: string; rg: string; endereco: string; cep: string; bairro: string;
  cidade: string; estado: string; telefone: string; email: string; cargo: string;
  tipo_contratacao: string; valor: string;
};
type Employee = Omit<EmployeeFields, "valor"> & { id: string; cadastro_cte_haras_id: string; valor: string | null };
type EmployeeData = { employees: Employee[]; centers: ProviderCenter[] };
type FieldName = keyof EmployeeFields;
const fields: { key: FieldName; label: string; column: string; type?: string }[] = [
  { key: "nome", label: "Nome do funcionário", column: "Funcionário" },
  { key: "cpf", label: "CPF do funcionário", column: "CPF" },
  { key: "rg", label: "RG do funcionário", column: "RG" },
  { key: "endereco", label: "Endereço do funcionário", column: "Endereço" },
  { key: "cep", label: "CEP do funcionário", column: "CEP" },
  { key: "bairro", label: "Bairro do funcionário", column: "Bairro" },
  { key: "cidade", label: "Cidade do funcionário", column: "Cidade" },
  { key: "estado", label: "Estado do funcionário", column: "Estado" },
  { key: "telefone", label: "Telefone", column: "Telefone", type: "tel" },
  { key: "email", label: "E-mail", column: "E-mail", type: "email" },
  { key: "cargo", label: "Cargo", column: "Cargo" },
  { key: "tipo_contratacao", label: "Tipo de contratação", column: "Tipo de contratação" },
  { key: "valor", label: "Valor da diária ou do mês (R$)", column: "Valor", type: "number" },
];
const columns: FieldName[] = ["nome", "cpf", "rg", "endereco", "cep", "bairro", "cidade", "estado", "cargo", "tipo_contratacao", "valor", "telefone", "email"];
const states = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const empty: EmployeeFields = {
  nome: "", cpf: "", rg: "", endereco: "", cep: "", bairro: "", cidade: "", estado: "",
  telefone: "", email: "", cargo: "", tipo_contratacao: "", valor: "",
};

function displayValue(key: FieldName, value: string | null) {
  if (!value) return "—";
  return key === "valor" ? Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : value;
}

async function loadEmployees(): Promise<EmployeeData> {
  const response = await fetch("/api/employees", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível consultar os funcionários.");
  return result;
}

export function Employees({ demo, centerId, onCentersChange, onCenterChange }: {
  demo: boolean;
  centerId: string;
  onCentersChange: Dispatch<SetStateAction<ProviderCenter[]>>;
  onCenterChange: Dispatch<SetStateAction<string>>;
}) {
  const [data, setData] = useState<EmployeeData | null>(null);
  const [form, setForm] = useState<EmployeeFields | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    loadEmployees().then((result) => {
      if (active) {
        setData(result);
        onCentersChange(result.centers);
        onCenterChange((current) => result.centers.some((center) => center.id === current) ? current : result.centers[0]?.id ?? "");
      }
    }).catch((error: unknown) => {
      console.error("Falha ao consultar funcionários:", error);
      if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível consultar os funcionários.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, onCentersChange, onCenterChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/employees", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : { cadastro_cte_haras_id: centerId }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível salvar o funcionário.");
      if (typeof result.id !== "string") throw new Error("O servidor não confirmou o cadastro.");
      setForm(null);
      setFeedback(editingId ? "Funcionário alterado." : "Funcionário cadastrado.");
      try {
        const updated = await loadEmployees();
        setData(updated);
        onCentersChange(updated.centers);
        onCenterChange((current) => updated.centers.some((center) => center.id === current) ? current : updated.centers[0]?.id ?? "");
      } catch (error) {
        console.error("Falha ao atualizar funcionários:", error);
        setData(null);
        setFeedback("Funcionário salvo, mas não foi possível atualizar a lista. Abra o menu novamente.");
      }
    } catch (error) {
      console.error("Falha ao salvar funcionário:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o funcionário.");
    } finally {
      setSaving(false);
    }
  }

  if (demo) return <p className="feedback-message">O cadastro de funcionários exige uma conexão com o banco de dados.</p>;
  if (loading) return <p>Carregando funcionários...</p>;
  if (!data) return <p className="feedback-message" role="alert">{feedback}</p>;
  const filtered = data.employees.filter((employee) => employee.cadastro_cte_haras_id === centerId &&
    columns.map((key) => displayValue(key, employee[key])).join(" ")
      .toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const open = (employee?: Employee, readOnly = false) => {
    setFeedback("");
    setEditingId(employee?.id ?? null);
    setViewing(readOnly);
    setForm(employee ? {
      nome: employee.nome, cpf: employee.cpf, rg: employee.rg, endereco: employee.endereco,
      cep: employee.cep, bairro: employee.bairro, cidade: employee.cidade, estado: employee.estado,
      telefone: employee.telefone, email: employee.email, cargo: employee.cargo,
      tipo_contratacao: employee.tipo_contratacao, valor: employee.valor ?? "",
    } : { ...empty });
  };
  const columnFields = [...fields].sort((a, b) => columns.indexOf(a.key) - columns.indexOf(b.key));
  return (
    <>
      {feedback && !form && <p className="feedback-message" role="status">{feedback}</p>}
      <div className="provider-toolbar">
        <input className="provider-search" type="search" aria-label="Buscar nesta lista" placeholder="Buscar nesta lista" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="button button-primary" disabled={saving || !centerId} onClick={() => open()}>＋ Novo funcionário</button>
      </div>
      {data.centers.length === 0 && <p role="status">Nenhum CTE/Haras disponível para este cadastro.</p>}
      <div className="provider-table-wrap"><table className="provider-table">
        <thead><tr>{columnFields.map(({ key, column }) => <th scope="col" key={key}>{column}</th>)}<th scope="col">Ações</th></tr></thead>
        <tbody>{filtered.map((employee) => <tr key={employee.id}>
          {columnFields.map(({ key }) => <td key={key}>{displayValue(key, employee[key])}</td>)}
          <td><div className="provider-row-actions">
            <button className="button button-secondary provider-small-button" onClick={() => open(employee, true)}>Visualizar</button>
            <button className="button button-quiet provider-small-button" onClick={() => open(employee)}>Alterar</button>
          </div></td>
        </tr>)}
        {filtered.length === 0 && <tr><td className="provider-empty" colSpan={columns.length + 1}>Nenhum registro encontrado.</td></tr>}
        </tbody>
      </table></div>
      <div className="provider-note">Cada funcionário está vinculado a um único CTE/Haras. O valor informado corresponde à diária ou ao mês, conforme o tipo de contratação.</div>
      {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setForm(null); }}>
        <section className="modal-card provider-modal" role="dialog" aria-modal="true" aria-labelledby="employee-title">
          <div className="provider-modal-heading"><h2 id="employee-title">{viewing ? "Visualizar registro" : editingId ? "Alterar — Funcionário" : "Funcionário"}</h2>
            <button type="button" className="provider-close" aria-label="Fechar" disabled={saving} onClick={() => setForm(null)}>×</button>
          </div>
          {viewing ? <>
            <div className="provider-form-grid">
              {columnFields.map(({ key, column }) => <div className="provider-field" key={key}><span>{column}</span><strong>{displayValue(key, form[key])}</strong></div>)}
            </div>
            <div className="provider-form-actions"><button type="button" className="button button-secondary" onClick={() => setForm(null)}>Fechar</button></div>
          </> : <form onSubmit={(event) => void submit(event)}>
            <div className="provider-form-grid">
              <label className="provider-field" htmlFor="employee-center">CTE/Haras
                <select id="employee-center" disabled value={centerId}>
                  {data.centers.map((center) => <option key={center.id} value={center.id}>{center.nome}</option>)}
                </select>
              </label>
              {fields.map(({ key, label, type }) => <label className="provider-field" htmlFor={`employee-${key}`} key={key}>
                {label}
                {key === "estado" || key === "tipo_contratacao" ? <select id={`employee-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
                  <option value="">Selecione</option>{(key === "estado" ? states : ["Diarista", "Mensalista"]).map((option) => <option key={option}>{option}</option>)}
                </select> : <input id={`employee-${key}`} type={type ?? "text"} required={key === "nome"}
                  maxLength={type === "number" ? undefined : 200}
                  min={type === "number" ? "0" : undefined} max={type === "number" ? "9999999999.99" : undefined}
                  step={type === "number" ? "0.01" : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
              </label>)}
            </div>
            <p className="provider-form-note">O nome do funcionário é obrigatório. Para trocar o centro, feche o formulário e selecione-o no topo.</p>
            {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
            <div className="provider-form-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
              <button className="button button-primary" disabled={saving || !centerId}>{saving ? "Salvando..." : "Salvar"}</button></div>
          </form>}
        </section>
      </div>}
    </>
  );
}
