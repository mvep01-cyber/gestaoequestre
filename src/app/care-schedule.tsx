"use client";

import { Plus, Search, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export type TreatmentRecord = {
  id: string;
  equino_id: string;
  nome_equino: string;
  tipo: string;
  descricao: string;
  dose_via: string | null;
  data_inicio: string;
  data_fim: string;
  dias_semana: number[];
  horarios: string[];
  prestador_nome: string | null;
  observacoes: string | null;
  pendentes: number;
  proxima_aplicacao_id: string | null;
};

export type TrainingRecord = {
  id: string;
  equino_id: string;
  nome_equino: string;
  treinador_nome: string | null;
  data_inicio: string;
  data_fim: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string | null;
  tipo_atividade: string;
  observacoes: string | null;
  status: string;
};

type CareHorse = { id: string; nome: string; nome_treinador?: string | null };

type CommonProps = {
  demo: boolean;
  canManage: boolean;
  horses: CareHorse[];
  post: (action: string, fields?: Record<string, unknown>) => Promise<unknown>;
  onFeedback: (message: string) => void;
  onSaved: () => void;
};

const weekdayLabels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const allWeekdays = [1, 2, 3, 4, 5, 6, 7];

const treatmentTypes = [
  { value: "MEDICAMENTO", label: "Medicamento" },
  { value: "VACINA", label: "Vacina" },
  { value: "VERMIFUGO", label: "Vermífugo" },
  { value: "VETERINARIO", label: "Veterinário" },
  { value: "FERRAGEAMENTO", label: "Ferrageamento" },
];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} a ${formatDate(end)}`;
}

function formatWeekdays(days: number[]) {
  return days.map((day) => weekdayLabels[day - 1]).join(", ");
}

function matchesSearch(values: (string | null | undefined)[], query: string) {
  return values
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .includes(query.trim().toLocaleLowerCase("pt-BR"));
}

function Dialog({
  eyebrow,
  title,
  titleId,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="reproduction-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="reproduction-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="reproduction-dialog-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <fieldset className="care-weekdays">
      <legend>Dias da semana</legend>
      <div className="care-weekday-list">
        {weekdayLabels.map((label, index) => {
          const day = index + 1;
          return (
            <label key={day}>
              <input
                type="checkbox"
                checked={value.includes(day)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, day].sort((a, b) => a - b)
                      : value.filter((item) => item !== day),
                  )
                }
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toolbar({
  search,
  onSearch,
  buttonLabel,
  canManage,
  onNew,
}: {
  search: string;
  onSearch: (value: string) => void;
  buttonLabel: string;
  canManage: boolean;
  onNew: () => void;
}) {
  return (
    <div className="reproduction-toolbar">
      <label className="reproduction-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar nesta lista</span>
        <input
          type="search"
          placeholder="Buscar nesta lista"
          aria-label="Buscar nesta lista"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {canManage && (
        <div className="reproduction-toolbar-actions">
          <button type="button" className="button button-primary" onClick={onNew}>
            <Plus size={18} /> {buttonLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function statusClass(pending: boolean) {
  return pending ? "cycle-status" : "cycle-status cycle-prenhe";
}

type TreatmentForm = {
  equino_id: string;
  prestador_nome: string;
  tipo: string;
  descricao: string;
  dose_via: string;
  data_inicio: string;
  data_fim: string;
  dias_semana: number[];
  horarios: string[];
  observacoes: string;
};

const treatmentFormDefaults: TreatmentForm = {
  equino_id: "",
  prestador_nome: "",
  tipo: "MEDICAMENTO",
  descricao: "",
  dose_via: "",
  data_inicio: "",
  data_fim: "",
  dias_semana: allWeekdays,
  horarios: [""],
  observacoes: "",
};

export function HealthModule({
  demo,
  canManage,
  horses,
  post,
  onFeedback,
  onSaved,
  providers,
  treatments,
  onApply,
}: CommonProps & {
  providers: string[];
  treatments: TreatmentRecord[];
  onApply: (applicationId: string) => Promise<void>;
}) {
  const [demoRows, setDemoRows] = useState(treatments);
  const rows = demo ? demoRows : treatments;
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<TreatmentForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TreatmentRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = rows.filter((row) =>
    matchesSearch(
      [
        formatPeriod(row.data_inicio, row.data_fim),
        formatWeekdays(row.dias_semana),
        row.horarios.join(" "),
        row.descricao,
        row.nome_equino,
        row.prestador_nome,
        row.pendentes > 0 ? "Pendente" : "Concluído",
      ],
      search,
    ),
  );

  function openForm(row?: TreatmentRecord) {
    setEditingId(row?.id ?? null);
    setForm(
      row
        ? {
            equino_id: row.equino_id,
            prestador_nome: row.prestador_nome ?? "",
            tipo: row.tipo,
            descricao: row.descricao,
            dose_via: row.dose_via ?? "",
            data_inicio: row.data_inicio,
            data_fim: row.data_fim,
            dias_semana: row.dias_semana,
            horarios: row.horarios.length ? row.horarios : [""],
            observacoes: row.observacoes ?? "",
          }
        : { ...treatmentFormDefaults },
    );
    setSelected(null);
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const times = Array.from(new Set(form.horarios.filter(Boolean))).sort();
    if (form.dias_semana.length === 0 || times.length === 0) {
      onFeedback("Selecione ao menos um dia da semana e um horário.");
      return;
    }
    if (form.data_fim < form.data_inicio) {
      onFeedback("A data final não pode ser anterior à data inicial.");
      return;
    }
    setIsSaving(true);
    onFeedback("");
    try {
      if (demo) {
        const horse = horses.find((item) => item.id === form.equino_id);
        const record: TreatmentRecord = {
          id: editingId ?? `demo-treatment-${Date.now()}`,
          equino_id: form.equino_id,
          nome_equino: horse?.nome ?? "",
          tipo: form.tipo,
          descricao: form.descricao.trim(),
          dose_via: form.dose_via.trim() || null,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim,
          dias_semana: form.dias_semana,
          horarios: times,
          prestador_nome: form.prestador_nome || null,
          observacoes: form.observacoes.trim() || null,
          pendentes: 1,
          proxima_aplicacao_id: null,
        };
        setDemoRows((current) =>
          editingId
            ? current.map((item) => (item.id === editingId ? record : item))
            : [record, ...current],
        );
      } else {
        await post(editingId ? "updateTreatment" : "createTreatment", {
          ...(editingId ? { id: editingId } : {}),
          horseId: form.equino_id,
          provider: form.prestador_nome,
          type: form.tipo,
          description: form.descricao.trim(),
          dose: form.dose_via.trim(),
          startDate: form.data_inicio,
          endDate: form.data_fim,
          weekdays: form.dias_semana,
          times,
          notes: form.observacoes.trim(),
        });
      }
      onFeedback(editingId ? "Tratamento atualizado." : "Tratamento agendado.");
      closeForm();
      onSaved();
    } catch (error) {
      console.error("Falha ao salvar tratamento:", error);
      onFeedback(
        error instanceof Error ? error.message : "Não foi possível salvar o tratamento.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateTime(index: number, value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            horarios: current.horarios.map((item, position) =>
              position === index ? value : item,
            ),
          }
        : current,
    );
  }

  return (
    <section className="panel reproduction-panel">
      <Toolbar
        search={search}
        onSearch={setSearch}
        buttonLabel="Agendar tratamento"
        canManage={canManage}
        onNew={() => openForm()}
      />
      <div className="reproduction-table-wrap">
        <table className="reproduction-table care-table">
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Dias da semana</th>
              <th scope="col">Horários</th>
              <th scope="col">Cuidado</th>
              <th scope="col">Animal</th>
              <th scope="col">Prestador de serviço</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="reproduction-empty">
                  {rows.length === 0
                    ? "Nenhum tratamento agendado."
                    : "Nenhum tratamento corresponde à busca."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td>{formatPeriod(row.data_inicio, row.data_fim)}</td>
                  <td>{formatWeekdays(row.dias_semana)}</td>
                  <td>{row.horarios.join(", ") || "—"}</td>
                  <td>{row.descricao}</td>
                  <td>{row.nome_equino}</td>
                  <td>{row.prestador_nome ?? "—"}</td>
                  <td>
                    <span className={statusClass(row.pendentes > 0)}>
                      {row.pendentes > 0 ? "Pendente" : "Concluído"}
                    </span>
                  </td>
                  <td>
                    <div className="reproduction-row-actions">
                      <button
                        type="button"
                        className="button button-secondary small-button"
                        onClick={() => setSelected(row)}
                      >
                        Visualizar
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className="button button-quiet small-button"
                          onClick={() => openForm(row)}
                        >
                          Alterar
                        </button>
                      )}
                      {row.proxima_aplicacao_id && (
                        <button
                          type="button"
                          className="button button-primary small-button"
                          onClick={() => void onApply(row.proxima_aplicacao_id as string)}
                        >
                          Marcar aplicado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="reproduction-note">
        Os períodos e horários definem as aplicações a conferir. Para tratamentos reais,
        siga a orientação veterinária.
      </p>
      {form && (
        <Dialog
          eyebrow="Saúde e medicamentos"
          title={editingId ? "Alterar tratamento" : "Agendar tratamento"}
          titleId="treatment-form-title"
          onClose={closeForm}
        >
          <form onSubmit={(event) => void handleSave(event)}>
            <div className="cycle-form-grid">
              <label className="cycle-form-field">
                Animal
                <select
                  required
                  value={form.equino_id}
                  onChange={(event) =>
                    setForm({ ...form, equino_id: event.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {horses.map((horse) => (
                    <option value={horse.id} key={horse.id}>{horse.nome}</option>
                  ))}
                </select>
              </label>
              <label className="cycle-form-field">
                Prestador de serviço
                <select
                  value={form.prestador_nome}
                  onChange={(event) =>
                    setForm({ ...form, prestador_nome: event.target.value })
                  }
                >
                  <option value="">Não informado</option>
                  {form.prestador_nome && !providers.includes(form.prestador_nome) && (
                    <option value={form.prestador_nome}>{form.prestador_nome}</option>
                  )}
                  {providers.map((provider) => (
                    <option value={provider} key={provider}>{provider}</option>
                  ))}
                </select>
                <small className="reproduction-field-hint">
                  Prestadores do cadastro de prestação de serviços do centro.
                </small>
              </label>
              <label className="cycle-form-field">
                Tipo de cuidado
                <select
                  value={form.tipo}
                  onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                >
                  {treatmentTypes.map((type) => (
                    <option value={type.value} key={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label className="cycle-form-field">
                Descrição do tratamento / medicamento
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={form.descricao}
                  onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                />
              </label>
              <label className="cycle-form-field">
                Dose / via
                <input
                  type="text"
                  maxLength={160}
                  value={form.dose_via}
                  onChange={(event) => setForm({ ...form, dose_via: event.target.value })}
                />
              </label>
              <span aria-hidden="true" />
              <label className="cycle-form-field">
                Data inicial do tratamento
                <input
                  type="date"
                  required
                  value={form.data_inicio}
                  onChange={(event) =>
                    setForm({ ...form, data_inicio: event.target.value })
                  }
                />
              </label>
              <label className="cycle-form-field">
                Data final do tratamento
                <input
                  type="date"
                  required
                  min={form.data_inicio || undefined}
                  value={form.data_fim}
                  onChange={(event) => setForm({ ...form, data_fim: event.target.value })}
                />
              </label>
              <WeekdayPicker
                value={form.dias_semana}
                onChange={(days) => setForm({ ...form, dias_semana: days })}
              />
              <fieldset className="care-weekdays">
                <legend>Horários de aplicação</legend>
                <div className="care-time-list">
                  {form.horarios.map((time, index) => (
                    <div className="care-time-row" key={index}>
                      <label className="cycle-form-field">
                        <span>Horário {index + 1}</span>
                        <input
                          type="time"
                          required
                          value={time}
                          onChange={(event) => updateTime(index, event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="button button-secondary small-button"
                        disabled={form.horarios.length === 1}
                        aria-label={`Remover horário ${index + 1}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            horarios: form.horarios.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="button button-secondary small-button"
                  disabled={form.horarios.length >= 12}
                  onClick={() => setForm({ ...form, horarios: [...form.horarios, ""] })}
                >
                  <Plus size={14} /> Adicionar horário
                </button>
              </fieldset>
              <label className="cycle-form-field cycle-form-field-full">
                Observações
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.observacoes}
                  onChange={(event) =>
                    setForm({ ...form, observacoes: event.target.value })
                  }
                />
              </label>
            </div>
            <p className="reproduction-note">
              Para um tratamento em um único dia, informe a mesma data inicial e final.
              Os horários se aplicam aos dias selecionados.
            </p>
            <div className="reproduction-dialog-actions">
              <button type="button" className="button button-quiet" onClick={closeForm}>
                Cancelar
              </button>
              <button className="button button-primary" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar tratamento"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {selected && (
        <Dialog
          eyebrow="Acompanhamento"
          title="Detalhes do tratamento"
          titleId="treatment-detail-title"
          onClose={() => setSelected(null)}
        >
          <dl className="reproduction-details">
            <div><dt>Animal</dt><dd>{selected.nome_equino}</dd></div>
            <div><dt>Prestador de serviço</dt><dd>{selected.prestador_nome ?? "—"}</dd></div>
            <div>
              <dt>Tipo de cuidado</dt>
              <dd>
                {treatmentTypes.find((type) => type.value === selected.tipo)?.label ??
                  selected.tipo}
              </dd>
            </div>
            <div><dt>Descrição</dt><dd>{selected.descricao}</dd></div>
            <div><dt>Dose / via</dt><dd>{selected.dose_via ?? "—"}</dd></div>
            <div>
              <dt>Período</dt>
              <dd>{formatPeriod(selected.data_inicio, selected.data_fim)}</dd>
            </div>
            <div><dt>Dias da semana</dt><dd>{formatWeekdays(selected.dias_semana)}</dd></div>
            <div><dt>Horários</dt><dd>{selected.horarios.join(", ") || "—"}</dd></div>
            <div>
              <dt>Situação</dt>
              <dd>
                {selected.pendentes > 0
                  ? `Pendente (${selected.pendentes} aplicações)`
                  : "Concluído"}
              </dd>
            </div>
            <div className="reproduction-details-full">
              <dt>Observações</dt>
              <dd>{selected.observacoes ?? "—"}</dd>
            </div>
          </dl>
          <div className="reproduction-dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

type TrainingForm = {
  equino_id: string;
  treinador_nome: string;
  data_inicio: string;
  data_fim: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  tipo_atividade: string;
  observacoes: string;
};

const trainingFormDefaults: TrainingForm = {
  equino_id: "",
  treinador_nome: "",
  data_inicio: "",
  data_fim: "",
  dias_semana: [1, 2, 3, 4, 5],
  hora_inicio: "",
  hora_fim: "",
  tipo_atividade: "",
  observacoes: "",
};

export function ScheduleModule({
  demo,
  canManage,
  horses,
  post,
  onFeedback,
  onSaved,
  trainings,
  onComplete,
}: CommonProps & {
  trainings: TrainingRecord[];
  onComplete: (trainingId: string) => Promise<void>;
}) {
  const [demoRows, setDemoRows] = useState(trainings);
  const rows = demo ? demoRows : trainings;
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<TrainingForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrainingRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = rows.filter((row) =>
    matchesSearch(
      [
        formatPeriod(row.data_inicio, row.data_fim),
        formatWeekdays(row.dias_semana),
        row.hora_inicio,
        row.hora_fim,
        row.tipo_atividade,
        row.nome_equino,
        row.treinador_nome,
        row.status === "CONCLUIDO" ? "Concluído" : "Pendente",
      ],
      search,
    ),
  );

  function openForm(row?: TrainingRecord) {
    setEditingId(row?.id ?? null);
    setForm(
      row
        ? {
            equino_id: row.equino_id,
            treinador_nome: row.treinador_nome ?? "",
            data_inicio: row.data_inicio,
            data_fim: row.data_fim,
            dias_semana: row.dias_semana,
            hora_inicio: row.hora_inicio,
            hora_fim: row.hora_fim ?? "",
            tipo_atividade: row.tipo_atividade,
            observacoes: row.observacoes ?? "",
          }
        : { ...trainingFormDefaults },
    );
    setSelected(null);
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
  }

  function chooseHorse(horseId: string) {
    setForm((current) => {
      if (!current) return current;
      const trainer = horses.find((horse) => horse.id === horseId)?.nome_treinador;
      return {
        ...current,
        equino_id: horseId,
        treinador_nome: current.treinador_nome || trainer || "",
      };
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (form.dias_semana.length === 0) {
      onFeedback("Selecione ao menos um dia da semana.");
      return;
    }
    if (form.data_fim < form.data_inicio) {
      onFeedback("A data final não pode ser anterior à data inicial.");
      return;
    }
    if (form.hora_fim && form.hora_fim <= form.hora_inicio) {
      onFeedback("O horário de fim deve ser posterior ao de início.");
      return;
    }
    setIsSaving(true);
    onFeedback("");
    try {
      if (demo) {
        const horse = horses.find((item) => item.id === form.equino_id);
        const existing = rows.find((item) => item.id === editingId);
        const record: TrainingRecord = {
          id: editingId ?? `demo-training-${Date.now()}`,
          equino_id: form.equino_id,
          nome_equino: horse?.nome ?? "",
          treinador_nome: form.treinador_nome.trim() || null,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim,
          dias_semana: form.dias_semana,
          hora_inicio: form.hora_inicio,
          hora_fim: form.hora_fim || null,
          tipo_atividade: form.tipo_atividade.trim(),
          observacoes: form.observacoes.trim() || null,
          status: existing?.status ?? "PENDENTE",
        };
        setDemoRows((current) =>
          editingId
            ? current.map((item) => (item.id === editingId ? record : item))
            : [record, ...current],
        );
      } else {
        await post(editingId ? "updateTraining" : "createTraining", {
          ...(editingId ? { id: editingId } : {}),
          horseId: form.equino_id,
          trainer: form.treinador_nome.trim(),
          startDate: form.data_inicio,
          endDate: form.data_fim,
          weekdays: form.dias_semana,
          startTime: form.hora_inicio,
          endTime: form.hora_fim,
          activity: form.tipo_atividade.trim(),
          notes: form.observacoes.trim(),
        });
      }
      onFeedback(editingId ? "Treino atualizado." : "Treino programado.");
      closeForm();
      onSaved();
    } catch (error) {
      console.error("Falha ao salvar treino:", error);
      onFeedback(error instanceof Error ? error.message : "Não foi possível salvar o treino.");
    } finally {
      setIsSaving(false);
    }
  }

  async function complete(row: TrainingRecord) {
    await onComplete(row.id);
    if (demo) {
      setDemoRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status: "CONCLUIDO" } : item,
        ),
      );
    }
  }

  function timeLabel(row: TrainingRecord) {
    return row.hora_fim ? `${row.hora_inicio} às ${row.hora_fim}` : row.hora_inicio;
  }

  return (
    <section className="panel reproduction-panel">
      <Toolbar
        search={search}
        onSearch={setSearch}
        buttonLabel="Novo treino"
        canManage={canManage}
        onNew={() => openForm()}
      />
      <div className="reproduction-table-wrap">
        <table className="reproduction-table care-table">
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col">Dias da semana</th>
              <th scope="col">Horário</th>
              <th scope="col">Atividade</th>
              <th scope="col">Animal</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="reproduction-empty">
                  {rows.length === 0
                    ? "Nenhum treino programado."
                    : "Nenhum treino corresponde à busca."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td>{formatPeriod(row.data_inicio, row.data_fim)}</td>
                  <td>{formatWeekdays(row.dias_semana)}</td>
                  <td>{timeLabel(row)}</td>
                  <td>{row.tipo_atividade}</td>
                  <td>{row.nome_equino}</td>
                  <td>
                    <span className={statusClass(row.status !== "CONCLUIDO")}>
                      {row.status === "CONCLUIDO" ? "Concluído" : "Pendente"}
                    </span>
                  </td>
                  <td>
                    <div className="reproduction-row-actions">
                      <button
                        type="button"
                        className="button button-secondary small-button"
                        onClick={() => setSelected(row)}
                      >
                        Visualizar
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className="button button-quiet small-button"
                          onClick={() => openForm(row)}
                        >
                          Alterar
                        </button>
                      )}
                      {row.status !== "CONCLUIDO" && (
                        <button
                          type="button"
                          className="button button-primary small-button"
                          onClick={() => void complete(row)}
                        >
                          Marcar feito
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="reproduction-note">
        O período e os dias da semana definem quando o treino acontece.
      </p>
      {form && (
        <Dialog
          eyebrow="Agenda de treinos"
          title={editingId ? "Alterar treino" : "Novo treino"}
          titleId="training-form-title"
          onClose={closeForm}
        >
          <form onSubmit={(event) => void handleSave(event)}>
            <div className="cycle-form-grid">
              <label className="cycle-form-field">
                Animal
                <select
                  required
                  value={form.equino_id}
                  onChange={(event) => chooseHorse(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {horses.map((horse) => (
                    <option value={horse.id} key={horse.id}>{horse.nome}</option>
                  ))}
                </select>
              </label>
              <label className="cycle-form-field">
                Treinador
                <input
                  type="text"
                  maxLength={120}
                  value={form.treinador_nome}
                  onChange={(event) =>
                    setForm({ ...form, treinador_nome: event.target.value })
                  }
                />
              </label>
              <label className="cycle-form-field">
                Data inicial do treino
                <input
                  type="date"
                  required
                  value={form.data_inicio}
                  onChange={(event) =>
                    setForm({ ...form, data_inicio: event.target.value })
                  }
                />
              </label>
              <label className="cycle-form-field">
                Data final do treino
                <input
                  type="date"
                  required
                  min={form.data_inicio || undefined}
                  value={form.data_fim}
                  onChange={(event) => setForm({ ...form, data_fim: event.target.value })}
                />
              </label>
              <WeekdayPicker
                value={form.dias_semana}
                onChange={(days) => setForm({ ...form, dias_semana: days })}
              />
              <label className="cycle-form-field">
                Horário de início
                <input
                  type="time"
                  required
                  value={form.hora_inicio}
                  onChange={(event) =>
                    setForm({ ...form, hora_inicio: event.target.value })
                  }
                />
              </label>
              <label className="cycle-form-field">
                Horário de fim
                <input
                  type="time"
                  min={form.hora_inicio || undefined}
                  value={form.hora_fim}
                  onChange={(event) => setForm({ ...form, hora_fim: event.target.value })}
                />
              </label>
              <label className="cycle-form-field cycle-form-field-full">
                Tipo de atividade
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={form.tipo_atividade}
                  onChange={(event) =>
                    setForm({ ...form, tipo_atividade: event.target.value })
                  }
                />
              </label>
              <label className="cycle-form-field cycle-form-field-full">
                Observações
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.observacoes}
                  onChange={(event) =>
                    setForm({ ...form, observacoes: event.target.value })
                  }
                />
              </label>
            </div>
            <p className="reproduction-note">
              Para um treino em um único dia, informe a mesma data inicial e final.
            </p>
            <div className="reproduction-dialog-actions">
              <button type="button" className="button button-quiet" onClick={closeForm}>
                Cancelar
              </button>
              <button className="button button-primary" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar treino"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {selected && (
        <Dialog
          eyebrow="Acompanhamento"
          title="Detalhes do treino"
          titleId="training-detail-title"
          onClose={() => setSelected(null)}
        >
          <dl className="reproduction-details">
            <div><dt>Animal</dt><dd>{selected.nome_equino}</dd></div>
            <div><dt>Treinador</dt><dd>{selected.treinador_nome ?? "—"}</dd></div>
            <div>
              <dt>Período</dt>
              <dd>{formatPeriod(selected.data_inicio, selected.data_fim)}</dd>
            </div>
            <div><dt>Dias da semana</dt><dd>{formatWeekdays(selected.dias_semana)}</dd></div>
            <div><dt>Horário</dt><dd>{timeLabel(selected)}</dd></div>
            <div><dt>Atividade</dt><dd>{selected.tipo_atividade}</dd></div>
            <div>
              <dt>Situação</dt>
              <dd>{selected.status === "CONCLUIDO" ? "Concluído" : "Pendente"}</dd>
            </div>
            <div className="reproduction-details-full">
              <dt>Observações</dt>
              <dd>{selected.observacoes ?? "—"}</dd>
            </div>
          </dl>
          <div className="reproduction-dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
