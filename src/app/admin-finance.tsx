"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet, X } from "lucide-react";

export type AdminFinanceEntry = {
  id: string;
  conta_id: string | null;
  conta_informada: string | null;
  tenant_id: string | null;
  tenant_nome: string | null;
  plano: string | null;
  cadastro_cte_haras_id: string | null;
  cadastro_cte_haras_nome: string | null;
  cadastro_cte_haras_tipo: string | null;
  descricao: string;
  valor: number;
  competencia: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  natureza: string;
  categoria: string;
  status: string;
};

type Account = { id: string; nome: string; saldo_atual: number };
type Tenant = { id: string; nome: string; plano: string };
export type AdminFinanceRegistration = {
  id: string;
  nome: string;
  tipo_cadastro: "CTE" | "HARAS";
  tenant_id: string;
  tenant_nome: string;
};
type EntryForm = {
  id: string;
  description: string;
  amount: string;
  nature: "RECEITA" | "DESPESA";
  category: string;
  tenantId: string;
  registrationId: string;
  registrationLabel: string;
  accountId: string;
  accountText: string;
  competence: string;
  dueDate: string;
  paymentDate: string;
  status: string;
};

const emptyEntry: EntryForm = {
  id: "",
  description: "",
  amount: "",
  nature: "RECEITA",
  category: "ASSINATURA",
  tenantId: "",
  registrationId: "",
  registrationLabel: "",
  accountId: "",
  accountText: "",
  competence: "",
  dueDate: "",
  paymentDate: "",
  status: "PENDENTE",
};

const categoryLabels: Record<string, string> = {
  ASSINATURA: "Assinatura",
  TARIFA: "Tarifa",
  OPERACIONAL: "Operacional",
  OUTRA: "Outra",
};
const statusLabels: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(value: string | null) {
  return value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function postFinanceAction(action: string, fields: Record<string, unknown>) {
  const response = await fetch("/api/admin-finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...fields }),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Não foi possível concluir a operação financeira.",
    );
  }
  if (!isRecord(result)) throw new Error("O servidor retornou uma resposta financeira inválida.");
  return result;
}

function csvCell(value: string | number | null) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function AdminFinance({
  configured,
  needsMigration,
  demo,
  entries,
  accounts,
  tenants,
  registrations,
}: {
  configured: boolean;
  needsMigration: boolean;
  demo: boolean;
  entries: AdminFinanceEntry[];
  accounts: Account[];
  tenants: Tenant[];
  registrations: AdminFinanceRegistration[];
}) {
  const router = useRouter();
  const [competence, setCompetence] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [nature, setNature] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [plan, setPlan] = useState("");
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("CONTA_CORRENTE");
  const [pixKey, setPixKey] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const available = configured && !needsMigration && !demo;

  const filtered = useMemo(() => entries.filter((entry) =>
    (!competence || entry.competencia?.slice(0, 7) === competence) &&
    (!dueFrom || entry.data_vencimento >= dueFrom) &&
    (!dueTo || entry.data_vencimento <= dueTo) &&
    (!nature || entry.natureza === nature) &&
    (!category || entry.categoria === category) &&
    (!status || entry.status === status) &&
    (!tenantId || (tenantId === "ADMINISTRADOR"
      ? !entry.cadastro_cte_haras_id && !entry.tenant_id && entry.cadastro_cte_haras_nome === "Administrador"
      : entry.tenant_id === tenantId)) &&
    (!plan || entry.plano === plan),
  ), [entries, competence, dueFrom, dueTo, nature, category, status, tenantId, plan]);

  const totals = filtered.reduce((result, entry) => {
    const cents = Math.round(entry.valor * 100);
    if (entry.natureza === "RECEITA") result.receitas += cents;
    if (entry.natureza === "DESPESA") result.despesas += cents;
    return result;
  }, { receitas: 0, despesas: 0 });

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryForm || !available) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await postFinanceAction(entryForm.id ? "updateEntry" : "createEntry", {
        id: entryForm.id || undefined,
        description: entryForm.description,
        amount: entryForm.amount,
        nature: entryForm.nature,
        category: entryForm.category,
        tenantId: entryForm.registrationId ? null : entryForm.tenantId || null,
        registrationId: entryForm.registrationId || null,
        accountId: entryForm.accountId || null,
        accountText: entryForm.accountText,
        competence: entryForm.competence ? `${entryForm.competence}-01` : null,
        dueDate: entryForm.dueDate,
        paymentDate: entryForm.paymentDate || null,
      });
      if (!isRecord(result.entry) || typeof result.entry.id !== "string") {
        throw new Error("O servidor não confirmou o lançamento.");
      }
      setEntryForm(null);
      setFeedback(entryForm.id ? "Lançamento atualizado." : "Lançamento cadastrado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao salvar lançamento ADMIN:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await postFinanceAction("createAccount", {
        name: accountName,
        type: accountType,
        pixKey,
      });
      if (!isRecord(result.account) || typeof result.account.id !== "string") {
        throw new Error("O servidor não confirmou a conta.");
      }
      setShowAccountForm(false);
      setAccountName("");
      setAccountType("CONTA_CORRENTE");
      setPixKey("");
      setFeedback("Conta financeira cadastrada.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao cadastrar conta ADMIN:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível cadastrar a conta.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: AdminFinanceEntry) {
    if (!window.confirm(`Excluir "${entry.descricao}"? A exclusão será registrada${entry.status === "PAGO" && entry.conta_id ? " e o efeito no saldo será estornado" : ""}.`)) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await postFinanceAction("deleteEntry", { id: entry.id });
      if (result.deleted !== true) throw new Error("O servidor não confirmou a exclusão.");
      setFeedback("Lançamento excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir lançamento ADMIN:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows: (string | number | null)[][] = [
      ["Descrição", "Natureza", "Categoria", "Valor", "Competência", "Vencimento", "Pagamento", "Status", "CTE/Haras", "Plano"],
      ...filtered.map((entry) => [
        entry.descricao, entry.natureza, categoryLabels[entry.categoria] ?? entry.categoria,
        entry.valor.toFixed(2).replace(".", ","), entry.competencia, entry.data_vencimento,
        entry.data_pagamento, statusLabels[entry.status] ?? entry.status,
        entry.cadastro_cte_haras_nome ?? entry.tenant_nome, entry.plano,
      ]),
    ];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financeiro-admin.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!available) {
    return (
      <section className="panel module-panel">
        <h2>Financeiro ADMIN</h2>
        <p>{demo
          ? "O financeiro da plataforma não está disponível no modo de demonstração."
          : needsMigration
            ? "A base financeira ADMIN precisa ser atualizada. Execute npm run db:admin-setup."
            : "A base financeira ADMIN não está configurada. Configure a conexão e execute a preparação da base."}</p>
      </section>
    );
  }

  return (
    <div className="admin-finance">
      {feedback && !entryForm && !showAccountForm && <p className="feedback-message" role="status">{feedback}</p>}
      <section className="panel module-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Finanças da plataforma</span><h2>Financeiro ADMIN</h2></div>
          <span className="module-badge"><Wallet size={20} /></span>
        </div>
        <div className="admin-finance-actions">
          <button className="button button-primary" disabled={saving} onClick={() => { setFeedback(""); setEntryForm(emptyEntry); }}><Plus size={19} /> Novo lançamento</button>
          <button className="button button-secondary" disabled={saving} onClick={() => { setFeedback(""); setShowAccountForm(true); }}><Plus size={19} /> Nova conta</button>
          <button className="button button-secondary" onClick={exportCsv}>Exportar CSV</button>
        </div>
        <div className="admin-finance-filters">
          <label>Competência<input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} /></label>
          <label>Vencimento de<input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} /></label>
          <label>Vencimento até<input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} /></label>
          <label>Natureza<select value={nature} onChange={(event) => setNature(event.target.value)}><option value="">Todas</option><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select></label>
          <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>CTE/Haras<select value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">Todos</option><option value="ADMINISTRADOR">Administrador</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome}</option>)}</select></label>
          <label>Plano<select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="">Todos</option><option value="CTE">CTE</option><option value="HARAS">Haras</option></select></label>
        </div>
        {dueFrom && dueTo && dueFrom > dueTo && <p className="client-form-error" role="alert">O vencimento inicial não pode ser posterior ao final.</p>}
        <div className="admin-finance-summary">
          <span>Receitas filtradas <strong>{currency.format(totals.receitas / 100)}</strong></span>
          <span>Despesas filtradas <strong>{currency.format(totals.despesas / 100)}</strong></span>
          <span>Diferença filtrada <strong>{currency.format((totals.receitas - totals.despesas) / 100)}</strong></span>
        </div>
        <p>Totais dos lançamentos exibidos, independentemente do status selecionado.</p>
      </section>

      <section className="panel module-panel">
        <h2>Contas da plataforma</h2>
        {accounts.length === 0 ? <p>Nenhuma conta financeira cadastrada.</p> : (
          <div className="account-balances">{accounts.map((account) => <div key={account.id}><span>{account.nome}</span><b>{currency.format(account.saldo_atual)}</b></div>)}</div>
        )}
      </section>

      <section className="panel module-panel">
        <h2>Lançamentos ({filtered.length})</h2>
        {filtered.length === 0 ? <p>Nenhum lançamento encontrado para os filtros.</p> : (
          <div className="client-table-wrap admin-finance-table-wrap" role="region" aria-label="Lista de lançamentos" tabIndex={0}>
            <table className="client-table">
              <thead><tr><th>Descrição</th><th>Natureza / categoria</th><th>Valor</th><th>Competência</th><th>Vencimento</th><th>Pagamento</th><th>Status</th><th>CTE/Haras / plano</th><th>Conta informada</th><th>Ações</th></tr></thead>
              <tbody>{filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.descricao}</td><td>{entry.natureza === "RECEITA" ? "Receita" : "Despesa"} / {categoryLabels[entry.categoria] ?? entry.categoria}</td>
                  <td>{currency.format(entry.valor)}</td><td>{entry.competencia ? entry.competencia.slice(0, 7).split("-").reverse().join("/") : "—"}</td>
                  <td>{formatDate(entry.data_vencimento)}</td><td>{formatDate(entry.data_pagamento)}</td><td>{statusLabels[entry.status] ?? entry.status}</td>
                  <td>{entry.cadastro_cte_haras_nome
                    ? `${entry.cadastro_cte_haras_nome}${entry.cadastro_cte_haras_tipo ? ` / ${entry.cadastro_cte_haras_tipo}` : ""}`
                    : entry.tenant_nome ? `${entry.tenant_nome} / ${entry.plano}` : "—"}</td>
                  <td>{entry.conta_informada || "—"}</td>
                  <td><div className="client-row-actions">
                    <button className="button button-secondary" disabled={saving} onClick={() => {
                      setFeedback("");
                      setEntryForm({
                        id: entry.id, description: entry.descricao, amount: String(entry.valor),
                        nature: entry.natureza === "DESPESA" ? "DESPESA" : "RECEITA",
                        category: entry.categoria, tenantId: entry.cadastro_cte_haras_id ? "" : entry.tenant_id ?? "",
                        registrationId: entry.cadastro_cte_haras_id ??
                          (!entry.tenant_id && entry.cadastro_cte_haras_nome === "Administrador" ? "ADMINISTRADOR" : ""),
                        registrationLabel: entry.cadastro_cte_haras_nome ?? entry.tenant_nome ?? "",
                        accountId: entry.conta_id ?? "", accountText: entry.conta_informada ?? "",
                        competence: entry.competencia?.slice(0, 7) ?? "", dueDate: entry.data_vencimento,
                        paymentDate: entry.data_pagamento ?? "", status: entry.status,
                      });
                    }}>Alterar</button>
                    <button className="button button-quiet" disabled={saving} onClick={() => void remove(entry)}>Excluir</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {entryForm && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card client-modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-entry-title">
            <div className="modal-heading"><h2 id="admin-entry-title">{entryForm.id ? "Alterar lançamento" : "Novo lançamento"}</h2><button className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setEntryForm(null)}><X size={22} /></button></div>
            <form className="client-form" onSubmit={(event) => void saveEntry(event)}>
              <label htmlFor="admin-entry-description">Descrição</label><input id="admin-entry-description" required maxLength={entryForm.id ? 200 : 30} value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} />
              <label htmlFor="admin-entry-nature">Natureza</label><select id="admin-entry-nature" value={entryForm.nature} onChange={(event) => setEntryForm({ ...entryForm, nature: event.target.value === "DESPESA" ? "DESPESA" : "RECEITA" })}><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select>
              <label htmlFor="admin-entry-category">Categoria</label><select id="admin-entry-category" value={entryForm.category} onChange={(event) => setEntryForm({ ...entryForm, category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label htmlFor="admin-entry-amount">Valor (R$)</label><input id="admin-entry-amount" type="number" min="0.01" max="9999999999.99" step="0.01" required value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} />
              <label className={entryForm.category !== "ASSINATURA" ? "optional-field" : undefined} htmlFor="admin-entry-tenant">CTE/Haras {entryForm.category !== "ASSINATURA" && "(opcional)"}</label>
              <select id="admin-entry-tenant" required={entryForm.category === "ASSINATURA"}
                value={entryForm.registrationId || (entryForm.tenantId ? `tenant:${entryForm.tenantId}` : "")}
                onChange={(event) => setEntryForm({ ...entryForm,
                  registrationId: event.target.value.startsWith("tenant:") ? "" : event.target.value,
                  tenantId: event.target.value.startsWith("tenant:") ? event.target.value.slice(7) : "",
                })}>
                <option value="">Selecione</option>
                <option value="ADMINISTRADOR">Administrador</option>
                {entryForm.tenantId && <option value={`tenant:${entryForm.tenantId}`}>{entryForm.registrationLabel} — centro anterior</option>}
                {entryForm.registrationId && entryForm.registrationId !== "ADMINISTRADOR" && !registrations.some((registration) => registration.id === entryForm.registrationId) &&
                  <option value={entryForm.registrationId}>{entryForm.registrationLabel} — cadastro indisponível</option>}
                {registrations.map((registration) => <option key={registration.id} value={registration.id}>{registration.nome} — {registration.tipo_cadastro} ({registration.tenant_nome})</option>)}
              </select>
              <label className="optional-field" htmlFor="admin-entry-competence">Competência (opcional)</label><input id="admin-entry-competence" type="month" value={entryForm.competence} onChange={(event) => setEntryForm({ ...entryForm, competence: event.target.value })} />
              <label htmlFor="admin-entry-due">Vencimento</label><input id="admin-entry-due" type="date" required value={entryForm.dueDate} onChange={(event) => setEntryForm({ ...entryForm, dueDate: event.target.value })} />
              <label className="optional-field" htmlFor="admin-entry-payment">Data de pagamento (opcional)</label><input id="admin-entry-payment" type="date" disabled={entryForm.status === "CANCELADO"} value={entryForm.paymentDate} onChange={(event) => setEntryForm({ ...entryForm, paymentDate: event.target.value })} />
              {entryForm.status === "PAGO" && entryForm.accountId && <p>Este pagamento anterior afetou o saldo de uma conta; remover a data estornará esse efeito.</p>}
              <label className="optional-field" htmlFor="admin-entry-account-text">Conta (opcional)</label><input id="admin-entry-account-text" maxLength={20} value={entryForm.accountText} onChange={(event) => setEntryForm({ ...entryForm, accountText: event.target.value })} />
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setEntryForm(null)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar lançamento"}</button></div>
            </form>
          </section>
        </div>
      )}
      {showAccountForm && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card client-modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-account-title">
            <div className="modal-heading"><h2 id="admin-account-title">Nova conta financeira</h2><button className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setShowAccountForm(false)}><X size={22} /></button></div>
            <form className="client-form" onSubmit={(event) => void saveAccount(event)}>
              <label htmlFor="admin-account-name">Nome da conta</label><input id="admin-account-name" required maxLength={120} value={accountName} onChange={(event) => setAccountName(event.target.value)} />
              <label htmlFor="admin-account-type">Tipo</label><select id="admin-account-type" value={accountType} onChange={(event) => setAccountType(event.target.value)}><option value="CONTA_CORRENTE">Conta corrente</option><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="OUTRO">Outro</option></select>
              <label className="optional-field" htmlFor="admin-account-pix">Chave PIX (opcional)</label><input id="admin-account-pix" maxLength={200} value={pixKey} onChange={(event) => setPixKey(event.target.value)} />
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={() => setShowAccountForm(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar conta"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
