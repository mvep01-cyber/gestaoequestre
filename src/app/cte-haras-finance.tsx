"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";

type FinanceClient = { id: string; nome: string };
type FinanceAccount = {
  id: string;
  nome: string;
  tipo: string;
  chave_pix: string | null;
  saldo_atual: number;
};
type FinanceEntry = {
  id: string;
  proprietario_id: string;
  cliente_nome: string;
  descricao: string;
  valor: number;
  competencia: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  conta_bancaria_id: string | null;
  conta_informada: string | null;
  natureza: string;
  categoria: string;
  status: string;
};
type EntryForm = {
  id: string;
  clientId: string;
  description: string;
  nature: "RECEITA" | "DESPESA";
  category: string;
  amount: string;
  competence: string;
  dueDate: string;
  paymentDate: string;
  accountId: string;
  accountText: string;
};
type AccountForm = { name: string; type: string; pixKey: string };

const categories: Record<string, string> = {
  MENSALIDADE: "Mensalidade",
  REPASSE_EXTRA: "Repasse extra",
  PARCELA_VENDA: "Parcela de venda",
  COMISSAO: "Comissão",
  ALIMENTACAO_FENO: "Alimentação / feno",
  OPERACIONAL: "Operacional",
};
const statuses: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
};
const accountTypes: Record<string, string> = {
  CONTA_CORRENTE: "Conta corrente",
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatDate(value: string | null) {
  return value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
}

export function CteHarasFinance({
  demo,
  entries: initialEntries,
  accounts: initialAccounts,
  clients,
  action,
}: {
  demo: boolean;
  entries: FinanceEntry[];
  accounts: FinanceAccount[];
  clients: FinanceClient[];
  action: (name: string, fields?: Record<string, unknown>) => Promise<unknown>;
}) {
  const router = useRouter();
  const entries = initialEntries;
  const accounts = initialAccounts;
  const [search, setSearch] = useState("");
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FinanceEntry | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.descricao,
        entry.cliente_nome,
        entry.natureza,
        categories[entry.categoria] ?? entry.categoria,
        entry.data_vencimento,
        entry.data_pagamento ?? "",
        statuses[entry.status] ?? entry.status,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [entries, search]);

  const totals = entries.reduce(
    (result, entry) => {
      const cents = Math.round(entry.valor * 100);
      if (entry.natureza === "RECEITA") result.receitas += cents;
      if (entry.natureza === "DESPESA") result.despesas += cents;
      if (entry.status === "PENDENTE" || entry.status === "ATRASADO") result.pendentes += 1;
      return result;
    },
    { receitas: 0, despesas: 0, pendentes: 0 },
  );

  function openEntryForm(entry?: FinanceEntry) {
    setFeedback("");
    setEntryForm(
      entry
        ? {
            id: entry.id,
            clientId: entry.proprietario_id,
            description: entry.descricao,
            nature: entry.natureza === "DESPESA" ? "DESPESA" : "RECEITA",
            category: entry.categoria,
            amount: String(entry.valor),
            competence: entry.competencia?.slice(0, 7) ?? "",
            dueDate: entry.data_vencimento.slice(0, 10),
            paymentDate: entry.data_pagamento?.slice(0, 10) ?? "",
            accountId: entry.conta_bancaria_id ?? "",
            accountText: entry.conta_informada ?? "",
          }
        : {
            id: "",
            clientId: "",
            description: "",
            nature: "RECEITA",
            category: "MENSALIDADE",
            amount: "",
            competence: "",
            dueDate: "",
            paymentDate: "",
            accountId: "",
            accountText: "",
          },
    );
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryForm || demo) return;
    if (entryForm.paymentDate && !entryForm.accountId) {
      setFeedback("Selecione a conta bancária para registrar o pagamento.");
      return;
    }

    setSaving(true);
    setFeedback("");
    try {
      const result = await action(entryForm.id ? "updateFinanceEntry" : "createFinanceEntry", {
        id: entryForm.id || undefined,
        clientId: entryForm.clientId,
        description: entryForm.description,
        nature: entryForm.nature,
        category: entryForm.category,
        amount: entryForm.amount,
        competence: entryForm.competence ? `${entryForm.competence}-01` : null,
        dueDate: entryForm.dueDate,
        paymentDate: entryForm.paymentDate || null,
        accountId: entryForm.paymentDate ? entryForm.accountId : null,
        accountText: entryForm.accountText,
      });
      if (!isRecord(result) || !isRecord(result.entry) || typeof result.entry.id !== "string") {
        throw new Error("O servidor não confirmou o lançamento financeiro.");
      }
      setEntryForm(null);
      setFeedback(entryForm.id ? "Lançamento atualizado." : "Lançamento cadastrado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao salvar lançamento CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountForm || demo) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await action("createFinanceAccount", {
        name: accountForm.name,
        type: accountForm.type,
        pixKey: accountForm.pixKey,
      });
      if (!isRecord(result) || !isRecord(result.account) || typeof result.account.id !== "string") {
        throw new Error("O servidor não confirmou a conta financeira.");
      }
      setAccountForm(null);
      setFeedback("Conta financeira cadastrada.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao cadastrar conta CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível cadastrar a conta.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: FinanceEntry) {
    if (!window.confirm(`Excluir o lançamento "${entry.descricao}"?`)) return;
    setSaving(true);
    setFeedback("");
    try {
      const result = await action("deleteFinanceEntry", { id: entry.id });
      if (!isRecord(result) || result.deleted !== true) {
        throw new Error("O servidor não confirmou a exclusão do lançamento.");
      }
      setFeedback("Lançamento excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir lançamento CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function payEntry(entry: FinanceEntry) {
    const accountId = selectedAccounts[entry.id];
    if (!accountId) {
      setFeedback("Selecione a conta bancária antes de dar baixa.");
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const result = await action("payFinanceEntry", { id: entry.id, accountId });
      if (!isRecord(result) || result.updated !== true) {
        throw new Error("O servidor não confirmou o pagamento.");
      }
      setFeedback("Pagamento registrado e saldo atualizado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao dar baixa no lançamento CTE/Haras:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cte-finance">
      {feedback && <p className="feedback-message" role="status">{feedback}</p>}
      {demo && <p className="finance-note">Modo demonstração: os dados financeiros são somente para visualização.</p>}

      <section className="panel module-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Contas a receber e pagar</span>
            <h2>Financeiro CTE/Haras</h2>
          </div>
          <span className="module-badge"><Wallet size={20} /></span>
        </div>
        <div className="finance-metrics">
          <div className="panel finance-metric">
            <span className="eyebrow">Receitas</span>
            <strong>{currency.format(totals.receitas / 100)}</strong>
          </div>
          <div className="panel finance-metric">
            <span className="eyebrow">Despesas</span>
            <strong>{currency.format(totals.despesas / 100)}</strong>
          </div>
          <div className="panel finance-metric">
            <span className="eyebrow">Pendentes</span>
            <strong>{totals.pendentes}</strong>
            <span className="muted">lançamentos</span>
          </div>
        </div>
        <div className="finance-toolbar">
          <input
            className="finance-search"
            type="search"
            placeholder="Buscar lançamento"
            aria-label="Buscar lançamento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="finance-actions">
            <button className="button button-secondary" disabled={saving || demo} onClick={() => {
              setFeedback("");
              setAccountForm({ name: "", type: "CONTA_CORRENTE", pixKey: "" });
            }}>
              <Plus size={18} /> Nova conta
            </button>
            <button className="button button-primary" disabled={saving || demo} onClick={() => openEntryForm()}>
              <Plus size={18} /> Novo lançamento
            </button>
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="finance-accounts">
            <h3>Contas</h3>
            <div className="account-balances">
              {accounts.map((account) => (
                <div key={account.id}>
                  <span>{account.nome} · {accountTypes[account.tipo] ?? account.tipo}</span>
                  <b>{currency.format(Number(account.saldo_atual))}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel module-panel">
        <div className="panel-heading">
          <h2>Lançamentos ({filtered.length})</h2>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state compact">Nenhum lançamento encontrado.</div>
        ) : (
          <div className="client-table-wrap finance-table-wrap" role="region" aria-label="Lançamentos financeiros" tabIndex={0}>
            <table className="client-table">
              <thead>
                <tr>
                  <th>Descrição / cliente</th>
                  <th>Natureza</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.descricao}<small className="finance-client-name">{entry.cliente_nome}</small></td>
                    <td>{entry.natureza === "RECEITA" ? "Receita" : "Despesa"}</td>
                    <td>{categories[entry.categoria] ?? entry.categoria}</td>
                    <td className={entry.natureza === "DESPESA" ? "expense-amount" : undefined}>{currency.format(entry.valor)}</td>
                    <td>{formatDate(entry.data_vencimento)}</td>
                    <td><span className={`finance-status finance-status-${entry.status.toLowerCase()}`}>{statuses[entry.status] ?? entry.status}</span></td>
                    <td>
                      <div className="finance-row-actions">
                        <button className="button button-secondary" aria-label={`Visualizar ${entry.descricao}`} onClick={() => setSelectedEntry(entry)}>
                          <Eye size={16} /> Visualizar
                        </button>
                        <button className="button button-secondary" disabled={saving || demo} aria-label={`Alterar ${entry.descricao}`} onClick={() => openEntryForm(entry)}>
                          <Pencil size={16} /> Alterar
                        </button>
                        <button className="button button-quiet" disabled={saving || demo} aria-label={`Excluir ${entry.descricao}`} onClick={() => void removeEntry(entry)}>
                          <Trash2 size={16} /> Excluir
                        </button>
                        {entry.status !== "PAGO" && accounts.length > 0 && (
                          <div className="finance-settlement">
                            <select
                              aria-label={`Conta bancária de ${entry.descricao}`}
                              value={selectedAccounts[entry.id] ?? ""}
                              disabled={saving || demo}
                              onChange={(event) => setSelectedAccounts((current) => ({ ...current, [entry.id]: event.target.value }))}
                            >
                              <option value="">Conta para baixa</option>
                              {accounts.map((account) => <option value={account.id} key={account.id}>{account.nome}</option>)}
                            </select>
                            <button className="button button-complete" disabled={saving || demo} onClick={() => void payEntry(entry)}>
                              Baixar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {entryForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEntryForm(null);
        }}>
          <section className="modal-card finance-modal-card" role="dialog" aria-modal="true" aria-labelledby="finance-entry-title">
            <div className="modal-heading">
              <h2 id="finance-entry-title">{entryForm.id ? "Alterar lançamento CTE/Haras" : "Novo lançamento CTE/Haras"}</h2>
              <button className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setEntryForm(null)}><X size={22} /></button>
            </div>
            <form className="finance-form-grid" onSubmit={(event) => void saveEntry(event)}>
              <label>Descrição<input required maxLength={200} value={entryForm.description} onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })} /></label>
              <label>Natureza<select value={entryForm.nature} onChange={(event) => setEntryForm({ ...entryForm, nature: event.target.value === "DESPESA" ? "DESPESA" : "RECEITA" })}><option value="RECEITA">Receita</option><option value="DESPESA">Despesa</option></select></label>
              <label>Categoria<select value={entryForm.category} onChange={(event) => setEntryForm({ ...entryForm, category: event.target.value })}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Cliente<select required value={entryForm.clientId} onChange={(event) => setEntryForm({ ...entryForm, clientId: event.target.value })}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}</select></label>
              <label>Valor (R$)<input type="number" min="0.01" max="9999999999.99" step="0.01" required value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} /></label>
              <label>Competência<input type="month" value={entryForm.competence} onChange={(event) => setEntryForm({ ...entryForm, competence: event.target.value })} /></label>
              <label>Vencimento<input type="date" required value={entryForm.dueDate} onChange={(event) => setEntryForm({ ...entryForm, dueDate: event.target.value })} /></label>
              <label>Pagamento<input type="date" value={entryForm.paymentDate} onChange={(event) => setEntryForm({ ...entryForm, paymentDate: event.target.value, accountId: event.target.value ? entryForm.accountId : "" })} /></label>
              <label>Conta para baixa{entryForm.paymentDate ? " (obrigatória)" : " (opcional)"}
                <select required={Boolean(entryForm.paymentDate)} value={entryForm.accountId} onChange={(event) => setEntryForm({ ...entryForm, accountId: event.target.value })}>
                  <option value="">Selecione</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.nome}</option>)}
                </select>
              </label>
              <label>Conta informada (opcional)<input maxLength={120} value={entryForm.accountText} onChange={(event) => setEntryForm({ ...entryForm, accountText: event.target.value })} /></label>
              {feedback && <p className="client-form-error finance-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions finance-form-actions">
                <button type="button" className="button button-quiet" disabled={saving} onClick={() => setEntryForm(null)}>Cancelar</button>
                <button className="button button-primary" disabled={saving || clients.length === 0}>{saving ? "Salvando..." : "Salvar lançamento"}</button>
              </div>
            </form>
            {clients.length === 0 && <p className="finance-note">Cadastre um cliente vinculado ao seu login antes de criar um lançamento.</p>}
          </section>
        </div>
      )}

      {accountForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setAccountForm(null);
        }}>
          <section className="modal-card finance-modal-card" role="dialog" aria-modal="true" aria-labelledby="finance-account-title">
            <div className="modal-heading">
              <h2 id="finance-account-title">Nova conta financeira</h2>
              <button className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setAccountForm(null)}><X size={22} /></button>
            </div>
            <form className="finance-form-grid" onSubmit={(event) => void saveAccount(event)}>
              <label>Nome da conta<input required maxLength={120} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} /></label>
              <label>Tipo<select value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}>{Object.entries(accountTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="finance-full-field">Chave PIX (opcional)<input maxLength={200} value={accountForm.pixKey} onChange={(event) => setAccountForm({ ...accountForm, pixKey: event.target.value })} /></label>
              {feedback && <p className="client-form-error finance-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions finance-form-actions">
                <button type="button" className="button button-quiet" disabled={saving} onClick={() => setAccountForm(null)}>Cancelar</button>
                <button className="button button-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar conta"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedEntry && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedEntry(null);
        }}>
          <section className="modal-card finance-modal-card" role="dialog" aria-modal="true" aria-labelledby="finance-detail-title">
            <div className="modal-heading">
              <h2 id="finance-detail-title">Detalhes do lançamento</h2>
              <button className="icon-button" aria-label="Fechar" onClick={() => setSelectedEntry(null)}><X size={22} /></button>
            </div>
            <dl className="finance-detail-grid">
              <div><dt>Descrição</dt><dd>{selectedEntry.descricao}</dd></div>
              <div><dt>Natureza</dt><dd>{selectedEntry.natureza === "RECEITA" ? "Receita" : "Despesa"}</dd></div>
              <div><dt>Categoria</dt><dd>{categories[selectedEntry.categoria] ?? selectedEntry.categoria}</dd></div>
              <div><dt>Cliente</dt><dd>{selectedEntry.cliente_nome}</dd></div>
              <div><dt>Valor</dt><dd>{currency.format(selectedEntry.valor)}</dd></div>
              <div><dt>Competência</dt><dd>{selectedEntry.competencia ? selectedEntry.competencia.slice(0, 7).split("-").reverse().join("/") : "—"}</dd></div>
              <div><dt>Vencimento</dt><dd>{formatDate(selectedEntry.data_vencimento)}</dd></div>
              <div><dt>Pagamento</dt><dd>{formatDate(selectedEntry.data_pagamento)}</dd></div>
              <div><dt>Status</dt><dd>{statuses[selectedEntry.status] ?? selectedEntry.status}</dd></div>
              <div><dt>Conta</dt><dd>{selectedEntry.conta_informada || accounts.find((account) => account.id === selectedEntry.conta_bancaria_id)?.nome || "—"}</dd></div>
            </dl>
            <div className="modal-actions"><button className="button button-secondary" onClick={() => setSelectedEntry(null)}>Fechar</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
