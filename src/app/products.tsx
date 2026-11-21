"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Product = {
  id: string;
  nome: string;
  codigo: string;
  marca: string;
  fabricante: string;
  descricao: string;
  valor: string;
  data_inicio: string;
  data_fim: string;
  cadastro_nome: string;
  tipo_cadastro: "CTE" | "HARAS";
};

type ProductResponse = { products: Product[]; hoje: string; amanha: string };
type ProductForm = {
  nome: string;
  codigo: string;
  marca: string;
  fabricante: string;
  descricao: string;
  valor: string;
  data_inicio: string;
  data_fim: string;
};

const emptyForm: ProductForm = {
  nome: "", codigo: "", marca: "", fabricante: "", descricao: "", valor: "",
  data_inicio: "", data_fim: "9999-12-31",
};

async function loadProducts(): Promise<ProductResponse> {
  const response = await fetch("/api/products", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Não foi possível consultar os produtos.");
  return data;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function Products({ canCreate, demo }: { canCreate: boolean; demo: boolean }) {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    loadProducts().then((result) => {
      if (active) setData(result);
    }).catch((error: unknown) => {
      console.error("Falha ao consultar produtos:", error);
      if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível consultar os produtos.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [demo]);

  const existing = !editingId && form && data?.products.find((product) => product.codigo === form.codigo.trim());
  const locked = Boolean(editingId || existing);
  const filtered = (data?.products ?? []).filter((product) =>
    [product.codigo, product.nome, product.marca, product.fabricante, product.cadastro_nome]
      .join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  function canDelete(product: Product) {
    if (!data || product.data_inicio <= data.hoje) return false;
    const versions = data.products.filter((item) => item.codigo === product.codigo)
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
    return versions[0]?.id === product.id && versions[1]?.data_fim === data.hoje;
  }

  async function refreshAfterChange(message: string) {
    setFeedback(message);
    try {
      setData(await loadProducts());
    } catch (error) {
      console.error("Falha ao atualizar produtos:", error);
      setData(null);
      setFeedback(`${message} Não foi possível atualizar a lista. Abra o menu novamente.`);
    }
  }

  async function remove(product: Product) {
    if (!canDelete(product) || saving) return;
    if (!window.confirm(`Excluir a versão futura de ${product.nome}? A vigência da versão anterior será reativada até 31/12/9999.`)) return;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível excluir o produto.");
      if (result.deleted !== true) throw new Error("O servidor não confirmou a exclusão.");
      await refreshAfterChange("Versão futura excluída e vigência anterior reativada.");
    } catch (error) {
      console.error("Falha ao excluir produto:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !data) return;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? {
          id: editingId, descricao: form.descricao, valor: form.valor,
        } : {
          ...form,
          data_inicio: existing ? data.amanha : form.data_inicio,
          data_fim: existing ? "9999-12-31" : form.data_fim,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível salvar o produto.");
      if (typeof result.id !== "string") throw new Error("O servidor não confirmou o produto.");
      setForm(null);
      await refreshAfterChange(editingId ? "Produto alterado." : "Produto cadastrado.");
    } catch (error) {
      console.error("Falha ao salvar produto:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  if (demo) return <p className="feedback-message">O cadastro de produtos exige uma conexão com o banco de dados.</p>;
  if (loading) return <p>Carregando produtos...</p>;
  if (!data) return <p className="feedback-message" role="alert">{feedback}</p>;

  return (
    <>
      {feedback && !form && <p className="feedback-message" role="status">{feedback}</p>}
      <div className="list-toolbar">
        <label className="search-box">
          <Search size={20} />
          <span className="sr-only">Buscar produto</span>
          <input type="search" placeholder="Buscar produto, código ou marca" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {canCreate && <button className="button button-primary" disabled={saving} onClick={() => { setFeedback(""); setEditingId(null); setForm({ ...emptyForm, data_inicio: data.hoje }); }}><Plus size={20} /> Novo produto</button>}
      </div>
      {filtered.length === 0 ? <div className="panel empty-state"><h2>Nenhum produto encontrado</h2></div> : (
        <div className="client-table-wrap">
          <table className="client-table">
            <thead><tr>{!canCreate && <th>CTE/Haras</th>}<th>Código</th><th>Nome</th><th>Marca</th><th>Fabricante</th><th>Descrição</th><th>Valor</th><th>Início</th><th>Fim</th>{canCreate && <th>Ações</th>}</tr></thead>
            <tbody>{filtered.map((product) => (
              <tr key={product.id}>
                {!canCreate && <td>{product.cadastro_nome} ({product.tipo_cadastro})</td>}
                <td>{product.codigo}</td><td>{product.nome}</td><td>{product.marca || "—"}</td><td>{product.fabricante || "—"}</td>
                <td>{product.descricao || "—"}</td><td>{Number(product.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td>{formatDate(product.data_inicio)}</td><td>{formatDate(product.data_fim)}</td>
                {canCreate && <td><div className="client-row-actions">
                  {product.data_inicio > data.hoje && product.data_fim === "9999-12-31" && (
                    <button className="button button-secondary" disabled={saving} onClick={() => {
                      setFeedback("");
                      setEditingId(product.id);
                      setForm({
                        codigo: product.codigo, nome: product.nome, marca: product.marca,
                        fabricante: product.fabricante, descricao: product.descricao, valor: product.valor,
                        data_inicio: product.data_inicio, data_fim: product.data_fim,
                      });
                    }}>Alterar</button>
                  )}
                  {product.data_inicio > data.hoje && (
                    <>
                      <button className="button button-quiet" disabled={saving || !canDelete(product)}
                        onClick={() => void remove(product)}>Excluir</button>
                      {!canDelete(product) && <small>Exige última versão futura e anterior com fim hoje.</small>}
                    </>
                  )}
                </div></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {form && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setForm(null); }}>
          <section className="modal-card client-modal-card" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className="modal-heading">
              <h2 id="product-form-title">{editingId ? "Alterar produto" : "Novo produto"}</h2>
              <button type="button" className="icon-button" aria-label="Fechar" disabled={saving} onClick={() => setForm(null)}><X size={22} /></button>
            </div>
            <form className="client-form" onSubmit={(event) => void submit(event)}>
              <label htmlFor="product-code">Código do produto</label>
              <input id="product-code" required maxLength={100} readOnly={!!editingId} value={form.codigo} onChange={(event) => {
                const codigo = event.target.value;
                const product = data.products.find((item) => item.codigo === codigo.trim());
                if (product) {
                  setForm({
                    codigo, nome: product.nome, marca: product.marca, fabricante: product.fabricante,
                    descricao: product.descricao, valor: product.valor,
                    data_inicio: data.amanha, data_fim: "9999-12-31",
                  });
                } else {
                  setForm(existing ? { ...emptyForm, codigo, data_inicio: data.hoje } : { ...form, codigo });
                }
              }} />
              <label htmlFor="product-name">Nome do produto</label>
              <input id="product-name" required maxLength={200} readOnly={locked} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
              <label className="optional-field" htmlFor="product-brand">Marca do produto</label>
              <input id="product-brand" maxLength={200} readOnly={locked} value={form.marca} onChange={(event) => setForm({ ...form, marca: event.target.value })} />
              <label className="optional-field" htmlFor="product-maker">Fabricante do produto</label>
              <input id="product-maker" maxLength={200} readOnly={locked} value={form.fabricante} onChange={(event) => setForm({ ...form, fabricante: event.target.value })} />
              <label className="optional-field" htmlFor="product-description">Descrição do produto</label>
              <input id="product-description" maxLength={2000} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />
              <label htmlFor="product-value">Valor do produto (R$)</label>
              <input id="product-value" type="number" min="0" max="9999999999.99" step="0.01" required value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} />
              <label htmlFor="product-start">Data de início de vigência</label>
              <input id="product-start" type="date" required max="9999-12-31" value={existing ? data.amanha : form.data_inicio} readOnly={locked} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })} />
              <label htmlFor="product-end">Data de fim de vigência</label>
              <input id="product-end" type="date" required min={existing ? data.amanha : form.data_inicio} max="9999-12-31" value={existing ? "9999-12-31" : form.data_fim} readOnly={locked} onChange={(event) => setForm({ ...form, data_fim: event.target.value })} />
              {existing && <p>Produto existente: a última vigência será encerrada hoje e a nova começará amanhã.</p>}
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions">
                <button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
                <button className="button button-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
