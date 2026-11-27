"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { ProviderCenter } from "./service-providers";

type Product = {
  id: string;
  cadastro_cte_haras_id: string;
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
  fornecedor_id: string;
  fornecedor_nome: string;
};

type ProductResponse = { products: Product[]; centers: ProviderCenter[]; suppliers: { id: string; nome: string; cadastro_cte_haras_id: string }[]; hoje: string; amanha: string };
type ProductForm = {
  nome: string;
  codigo: string;
  marca: string;
  fabricante: string;
  descricao: string;
  valor: string;
  data_inicio: string;
  data_fim: string;
  fornecedor_id: string;
};

const emptyForm: ProductForm = {
  nome: "", codigo: "", marca: "", fabricante: "", descricao: "", valor: "",
  data_inicio: "", data_fim: "9999-12-31", fornecedor_id: "",
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

export function Products({ isAdmin, canCreate, demo, centerId, onCentersChange, onCenterChange, supplierFilter, onClearSupplier }: {
  isAdmin: boolean;
  canCreate: boolean;
  demo: boolean;
  centerId: string;
  onCentersChange: Dispatch<SetStateAction<ProviderCenter[]>>;
  onCenterChange: Dispatch<SetStateAction<string>>;
  supplierFilter: { id: string; nome: string } | null;
  onClearSupplier: () => void;
}) {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    loadProducts().then((result) => {
      if (active) {
        setData(result);
        onCentersChange(result.centers);
        onCenterChange((current) => result.centers.some((center) => center.id === current) ? current : result.centers[0]?.id ?? "");
      }
    }).catch((error: unknown) => {
      console.error("Falha ao consultar produtos:", error);
      if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível consultar os produtos.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [demo, onCentersChange, onCenterChange]);

  const codeProduct = form && data?.products.find((product) => product.cadastro_cte_haras_id === centerId && product.codigo === form.codigo.trim());
  const existing = !editingId && codeProduct;
  const locked = Boolean(editingId || codeProduct);
  const filtered = (data?.products ?? []).filter((product) =>
    product.cadastro_cte_haras_id === centerId && (!supplierFilter || product.fornecedor_id === supplierFilter.id) &&
    [product.codigo, product.nome, product.marca, product.fabricante, product.descricao, product.cadastro_nome, product.fornecedor_nome]
      .join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  function canDelete(product: Product) {
    return Boolean(data && product.data_inicio > data.hoje && product.data_fim === "9999-12-31");
  }

  async function refreshAfterChange(message: string) {
    try {
      setData(await loadProducts());
      setFeedback(message);
    } catch (error) {
      console.error("Falha ao atualizar produtos:", error);
      setData(null);
      setFeedback(`${message} Não foi possível atualizar a lista. Abra o menu novamente.`);
    }
  }

  async function remove(product: Product) {
    if (!canDelete(product) || saving) return;
    if (!window.confirm(`Excluir a versão futura de ${product.nome}? Se houver outra versão, a de início mais recente terá vigência até 31/12/9999.`)) return;
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
      await refreshAfterChange(result.reactivated
        ? "Versão futura excluída e vigência da versão restante atualizada."
        : "Versão futura excluída.");
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
          nova_vigencia: Boolean(existing),
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
      {feedback && !form && !viewing && <p className="feedback-message" role="status">{feedback}</p>}
      <div className="provider-toolbar">
        <input className="provider-search" type="search" aria-label="Buscar nesta lista" placeholder="Buscar nesta lista" value={search} onChange={(event) => setSearch(event.target.value)} />
        {canCreate && <button className="button button-primary" disabled={saving || !centerId} onClick={() => { setFeedback(""); setEditingId(null); setForm({ ...emptyForm, data_inicio: data.hoje, fornecedor_id: supplierFilter?.id ?? "" }); }}>＋ Novo produto</button>}
      </div>
      {data.centers.length === 0 && <p role="status">Nenhum CTE/Haras disponível para este cadastro.</p>}
      {supplierFilter && <div className="provider-note">Produtos de <strong>{supplierFilter.nome}</strong> <button type="button" className="button button-quiet provider-small-button" onClick={onClearSupplier}>Ver todos</button></div>}
        <div className="provider-table-wrap">
          <table className="provider-table">
            <thead><tr>{!isAdmin && <th scope="col">CTE/Haras</th>}<th scope="col">Fornecedor</th>{isAdmin && <th scope="col">Código</th>}<th scope="col">Nome</th><th scope="col">Marca</th><th scope="col">Valor</th>{isAdmin && <><th scope="col">Início</th><th scope="col">Fim</th></>}<th scope="col">Ações</th></tr></thead>
            <tbody>{filtered.map((product) => (
              <tr key={product.id}>
                {!isAdmin && <td>{product.cadastro_nome}</td>}<td>{product.fornecedor_nome}</td>{isAdmin && <td>{product.codigo}</td>}<td>{product.nome}</td><td>{product.marca || "—"}</td>
                <td>{Number(product.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                {isAdmin && <><td>{formatDate(product.data_inicio)}</td><td>{formatDate(product.data_fim)}</td></>}
                <td><div className="provider-row-actions">
                  <button type="button" className="button button-secondary provider-small-button" disabled={saving} onClick={() => { setFeedback(""); setViewing(product); }}>Visualizar</button>
                  {(isAdmin || canCreate) && (product.data_inicio > data.hoje || (isAdmin && product.data_inicio === data.hoje)) && product.data_fim === "9999-12-31" && (
                    <button className="button button-quiet provider-small-button" disabled={saving} onClick={() => {
                      setFeedback("");
                      setEditingId(product.id);
                      setForm({
                        codigo: product.codigo, nome: product.nome, marca: product.marca,
                        fabricante: product.fabricante, descricao: product.descricao, valor: product.valor,
                        data_inicio: product.data_inicio, data_fim: product.data_fim, fornecedor_id: product.fornecedor_id,
                      });
                    }}>Alterar</button>
                  )}
                  {canCreate && product.data_inicio > data.hoje && (
                    <>
                      <button className="button button-quiet provider-small-button" disabled={saving || !canDelete(product)}
                        onClick={() => void remove(product)}>Excluir</button>
                      {!canDelete(product) && <small>Exige fim de vigência em 31/12/9999.</small>}
                    </>
                  )}
                </div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="provider-empty" colSpan={isAdmin ? 8 : 6}>Nenhum registro encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      <div className="provider-note">Cada produto pertence a um fornecedor do mesmo CTE/Haras. {isAdmin ? "A alteração está disponível para vigências elegíveis iniciadas hoje ou no futuro." : "A alteração e a exclusão estão disponíveis para vigências futuras elegíveis."}</div>
      {(form || viewing) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setForm(null); setViewing(null); } }}>
          <section className="modal-card provider-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className="provider-modal-heading">
              <h2 id="product-form-title">{viewing ? "Visualizar registro" : editingId ? "Alterar — Produto" : "Produto"}</h2>
              <button type="button" className="provider-close" aria-label="Fechar" disabled={saving} onClick={() => { setForm(null); setViewing(null); }}>×</button>
            </div>
            {viewing ? <>
              <div className="provider-form-grid">
                {[
                  ["CTE/Haras", viewing.cadastro_nome], ["Fornecedor", viewing.fornecedor_nome],
                  ["Código", viewing.codigo], ["Nome", viewing.nome],
                  ["Marca", viewing.marca], ["Fabricante", viewing.fabricante], ["Descrição", viewing.descricao],
                  ["Valor", Number(viewing.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
                  ["Início", formatDate(viewing.data_inicio)], ["Fim", formatDate(viewing.data_fim)],
                ].map(([label, value]) => <div className="provider-field" key={label}><span>{label}</span><strong>{value || "—"}</strong></div>)}
              </div>
              <div className="provider-form-actions"><button type="button" className="button button-secondary" onClick={() => setViewing(null)}>Fechar</button></div>
            </> : form && <form onSubmit={(event) => void submit(event)}>
              <div className="provider-form-grid">
              <label className="provider-field" htmlFor="product-center">CTE/Haras
                {!isAdmin && !editingId ? (
                  <input id="product-center" readOnly value={data.centers.find((center) => center.id === centerId)?.nome ?? ""} />
                ) : (
                  <select id="product-center" disabled value={centerId}>
                    {data.centers.map((center) => <option key={center.id} value={center.id}>{center.nome}</option>)}
                  </select>
                )}
              </label>
              <label className="provider-field" htmlFor="product-supplier">Fornecedor responsável
                <select id="product-supplier" required disabled={Boolean(editingId)} value={form.fornecedor_id} onChange={(event) => setForm({ ...form, fornecedor_id: event.target.value })}>
                  <option value="">Selecione</option>
                  {data.suppliers.filter((supplier) => supplier.cadastro_cte_haras_id === centerId).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
                </select>
              </label>
              <label className="provider-field" htmlFor="product-code">Código do produto
              <input id="product-code" required maxLength={5} pattern="[A-Za-z0-9]{1,5}" readOnly={!!editingId} value={form.codigo} onChange={(event) => {
                const codigo = event.target.value;
                const product = data.products.find((item) => item.cadastro_cte_haras_id === centerId && item.codigo === codigo.trim());
                setForm({
                  ...emptyForm, codigo,
                  fornecedor_id: form.fornecedor_id || product?.fornecedor_id || "",
                  nome: product?.nome ?? "", marca: product?.marca ?? "", fabricante: product?.fabricante ?? "",
                  descricao: product?.descricao ?? "", valor: product?.valor ?? "",
                  data_inicio: product ? data.amanha : data.hoje,
                });
              }} />
              </label>
              <label className="provider-field" htmlFor="product-name">Nome do produto
              <input id="product-name" required maxLength={200} readOnly={locked} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
              </label>
              <label className="provider-field" htmlFor="product-brand">Marca
              <input id="product-brand" maxLength={200} readOnly={locked} value={form.marca} onChange={(event) => setForm({ ...form, marca: event.target.value })} />
              </label>
              <label className="provider-field" htmlFor="product-maker">Fabricante
              <input id="product-maker" maxLength={200} readOnly={locked} value={form.fabricante} onChange={(event) => setForm({ ...form, fabricante: event.target.value })} />
              </label>
              <label className="provider-field provider-field-full" htmlFor="product-description">Descrição
              <textarea id="product-description" maxLength={2000} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />
              </label>
              <label className="provider-field" htmlFor="product-value">Valor (R$)
              <input id="product-value" type="number" min="0" max="9999999999.99" step="0.01" required value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} />
              </label>
              <label className="provider-field" htmlFor="product-start">Início da vigência
              <input id="product-start" type="date" required max="9999-12-31" value={existing ? data.amanha : form.data_inicio} readOnly={locked} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })} />
              </label>
              <label className="provider-field" htmlFor="product-end">Fim da vigência
              <input id="product-end" type="date" required min={existing ? data.amanha : form.data_inicio} max="9999-12-31" value={existing ? "9999-12-31" : form.data_fim} readOnly={locked} onChange={(event) => setForm({ ...form, data_fim: event.target.value })} />
              </label>
              </div>
              {!data.suppliers.some((supplier) => supplier.cadastro_cte_haras_id === centerId) && <p className="provider-form-note">Cadastre um fornecedor neste CTE/Haras antes de cadastrar produtos.</p>}
              {existing && <p className="provider-form-note">Produto existente: a última vigência será encerrada hoje e a nova começará amanhã.</p>}
              <p className="provider-form-note">Para trocar o centro, feche o formulário e selecione-o no topo.</p>
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="provider-form-actions">
                <button type="button" className="button button-quiet" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
                <button className="button button-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
              </div>
            </form>}
          </section>
        </div>
      )}
    </>
  );
}
