"use client";

import { useEffect, useState } from "react";
import {
  horseProductLabels,
  horseProductSlot,
  horseProductSlots,
  type HorseProductSelection,
  type HorseProductSlot,
} from "@/lib/horse-products";

type Product = {
  id: string;
  nome: string;
  marca: string;
  codigo: string;
  descricao: string;
  valor: string;
  data_inicio: string;
  data_fim: string;
  duplicado: boolean;
};

type Catalog = {
  cadastroId: string | null;
  registrations: { id: string; nome: string; tipo_cadastro: string }[];
  products: Product[];
};

type SavedProduct = {
  categoria: HorseProductSlot;
  produto_id: string | null;
  nome: string | null;
  marca: string | null;
  codigo: string | null;
  descricao: string | null;
  valor: string | null;
};

const emptyIds = () => ({ feno: "", racao: "", baia: "", outros: "" });

async function requestProducts(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível consultar os produtos.");
  return result;
}

function price(value: string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function HorseProducts({
  operational,
  horseId,
  selection,
  onChange,
  onTotalChange,
}: {
  operational: boolean;
  horseId: string | null;
  selection: HorseProductSelection | null;
  onChange: (selection: HorseProductSelection) => void;
  onTotalChange: (total: string) => void;
}) {
  const [registrationId, setRegistrationId] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [saved, setSaved] = useState<SavedProduct[] | null>(null);
  const [picker, setPicker] = useState<{ slot: HorseProductSlot; group: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickerError, setPickerError] = useState("");

  useEffect(() => {
    let active = true;
    const url = horseId
      ? `/api/horse-products?horseId=${encodeURIComponent(horseId)}`
      : registrationId
        ? `/api/horse-products?cadastroId=${encodeURIComponent(registrationId)}`
        : "/api/horse-products";
    requestProducts(url).then((result) => {
      if (!active) return;
      if (horseId) setSaved(result.selections);
      else setCatalog(result);
    }).catch((failure: unknown) => {
      console.error("Falha ao consultar produtos do cavalo:", failure);
      if (active) setError(failure instanceof Error ? failure.message : "Não foi possível consultar os produtos.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [horseId, registrationId]);

  if (loading) return <p>Carregando produtos...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (horseId) {
    return (
      <section aria-label="Produtos vinculados">
        <h3>Produtos vinculados</h3>
        {saved?.length ? saved.map((item) => (
          <p key={item.categoria}>
            <strong>{horseProductLabels[item.categoria]}: </strong>
            {item.produto_id && item.valor !== null ? `${item.nome} — código ${item.codigo} — ${price(item.valor)}` : "Produto indisponível."}
          </p>
        )) : <p>Este cavalo não possui produtos vinculados.</p>}
      </section>
    );
  }
  if (!catalog) return <p role="alert">Não foi possível consultar os produtos.</p>;
  const products = catalog.products;
  const ids = selection?.ids ?? emptyIds();
  const candidates = picker ? products.filter((product) => horseProductSlot(product.nome) === picker.slot) : [];
  const groups = candidates.filter((product, index) =>
    candidates.findIndex((other) => other.nome === product.nome && other.marca === product.marca) === index,
  );
  const matched = picker?.group ? candidates.filter((product) => JSON.stringify([product.nome, product.marca]) === picker.group) : [];

  return (
    <section className="horse-product-selection" aria-label="Produtos obrigatórios">
      <h3>Produtos obrigatórios</h3>
      {operational && (
        <>
          <label htmlFor="horse-product-registration">CTE/Haras dos produtos</label>
          <select id="horse-product-registration" required value={registrationId} onChange={(event) => {
            const id = event.target.value;
            setRegistrationId(id);
            setCatalog(null);
            setPicker(null);
            setLoading(true);
            setError("");
            onChange({ cadastroId: id, ids: emptyIds() });
          }}>
            <option value="">Selecione</option>
            {catalog.registrations.map((item) => <option key={item.id} value={item.id}>{item.tipo_cadastro === "CTE" ? "CTE" : "Haras"} — {item.nome}</option>)}
          </select>
        </>
      )}
      {horseProductSlots.map((slot) => {
        const selected = products.find((product) => product.id === ids[slot]);
        return (
          <div className="horse-product-field" key={slot}>
            <strong>{horseProductLabels[slot]} *</strong>
            <span>{selected ? `${selected.nome} — código ${selected.codigo} — ${price(selected.valor)}` : "Nenhum produto selecionado"}</span>
            <button type="button" className="button button-secondary" disabled={!catalog.cadastroId} onClick={() => {
              setPickerError("");
              setPicker({ slot, group: null });
            }}>
              {selected ? "Trocar produto" : "Selecionar produto"}
            </button>
          </div>
        );
      })}
      {picker && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.stopPropagation()}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="horse-product-picker-title">
            <div className="modal-heading">
              <h2 id="horse-product-picker-title">{horseProductLabels[picker.slot]} — {picker.group ? "Código e descrição" : "Produto e marca"}</h2>
              <button type="button" className="icon-button" aria-label="Fechar seleção" onClick={() => setPicker(null)}>×</button>
            </div>
            <div className="horse-product-options">
              {pickerError && <p role="alert">{pickerError}</p>}
              {picker.group ? matched.map((product) => (
                <button type="button" className="button button-secondary" key={product.id} onClick={() => {
                  if (!catalog.cadastroId) return;
                  if (product.duplicado) {
                    setPickerError("Ajuste o cadastro de produtos.");
                    return;
                  }
                  const nextIds = { ...ids, [picker.slot]: product.id };
                  const selected = horseProductSlots.map((slot) => products.find((item) => item.id === nextIds[slot]));
                  if (selected.every((item) => item !== undefined)) {
                    const cents = selected.reduce((total, item) => total + Math.round(Number(item.valor) * 100), 0);
                    onTotalChange((cents / 100).toFixed(2));
                  }
                  onChange({ cadastroId: catalog.cadastroId, ids: nextIds });
                  setPicker(null);
                }}>
                  {product.codigo} — {product.descricao || "Sem descrição"} — {price(product.valor)} ({product.data_inicio} a {product.data_fim})
                </button>
              )) : groups.map((product) => (
                <button type="button" className="button button-secondary" key={JSON.stringify([product.nome, product.marca])}
                  onClick={() => {
                    setPickerError("");
                    setPicker({ ...picker, group: JSON.stringify([product.nome, product.marca]) });
                  }}>
                  {product.nome} — {product.marca || "Sem marca"}
                </button>
              ))}
              {candidates.length === 0 && <p>Nenhum produto vigente encontrado para este campo.</p>}
              <button type="button" className="button button-quiet" onClick={() => {
                setPickerError("");
                if (picker.group) setPicker({ ...picker, group: null });
                else setPicker(null);
              }}>
                {picker.group ? "Voltar" : "Cancelar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
