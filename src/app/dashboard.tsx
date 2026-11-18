"use client";

import {
  Activity,
  ArrowRight,
  Baby,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Dna,
  HeartPulse,
  Home,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

type HorseRecord = {
  id: string;
  nome: string;
  baia: string | null;
  raca: string[];
  categoria: string;
  status: string;
  nome_pai: string | null;
  nome_mae: string | null;
  data_nascimento: string | null;
  registro_associacao: string | null;
  sexo: string;
  pelagem: string | null;
  foto_url?: string | null;
  nome_proprietario?: string | null;
  nome_treinador?: string | null;
  chip_resenha?: string | null;
  alimentacao_diaria?: string | null;
  valor_mensalidade?: number;
  created_at?: string | null;
};

const horseCoatTypes = [
  "Branco",
  "Preto",
  "Alazão",
  "Baio",
  "Castanha",
  "Tordilha",
  "Rosilha",
  "Pampa de Preto",
  "Pampa de Marrom",
  "Pampa de Castanho",
  "Pampa de Alazão",
] as const;

type MedicationApplication = {
  id: string;
  data_hora_prevista: string;
  descricao: string;
  nome_equino: string;
};

type TrainingSession = {
  id: string;
  data_hora: string;
  tipo_atividade: string;
  status: string;
  nome_equino: string;
};

type TenantRecord = {
  id: string;
  nome: string;
  plano: string;
  status_assinatura: string;
};

type BillingOwner = {
  id: string;
  nome: string;
  telefone_whatsapp: string | null;
  documento?: string | null;
  cpf?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  idade?: number | null;
  profissao?: string | null;
  endereco_completo?: string | null;
  numero_socio_abccmm?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

type PixAccount = {
  id: string;
  nome: string;
  chave_pix: string | null;
  saldo_atual: number;
};

type FinanceEntry = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  natureza: string;
  categoria: string;
  status: string;
};

type BillingEntry = {
  descricao: string;
  valor: number;
  link_pagamento: string | null;
  pix_copia_cola: string | null;
};

type ReproductionCycle = {
  id: string;
  tipo: string;
  garanhao_id: string;
  matriz_id: string;
  receptora_id: string | null;
  data_cobertura: string;
  status: string;
  data_previsao_parto: string | null;
  data_parto_real: string | null;
  potro_gerado_id: string | null;
  nome_garanhao: string;
  nome_matriz: string;
};

type ClientRecord = {
  id: string;
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
};

type CteHarasRegistration = ClientRecord & {
  tipo_cadastro: "CTE" | "HARAS";
};

type DashboardProps = {
  demo: boolean;
  role: string;
  plan: string;
  tenantName: string;
  horses: HorseRecord[];
  clients?: ClientRecord[];
  cteHarasRegistrations?: CteHarasRegistration[];
  medicationApplications?: MedicationApplication[];
  todayTrainings?: TrainingSession[];
  pendingMedicationCount?: number;
  todayTrainingCount?: number;
  pendingFinanceCount?: number;
  breedingCount?: number;
  managedTenants?: TenantRecord[];
  billingOwners?: BillingOwner[];
  pixAccounts?: PixAccount[];
  financeEntries?: FinanceEntry[];
  reproductionCycles?: ReproductionCycle[];
};

type ClientFormState = {
  id: string;
  nome: string;
  telefone_whatsapp: string;
  documento: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  idade: string;
  profissao: string;
  endereco_completo: string;
  numero_socio_abccmm: string;
  data_inicio: string;
  data_fim: string;
  tipo_cadastro: "" | "CTE" | "HARAS";
};

const clientFormDefaults: ClientFormState = {
  id: "",
  nome: "",
  telefone_whatsapp: "",
  documento: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  idade: "",
  profissao: "",
  endereco_completo: "",
  numero_socio_abccmm: "",
  data_inicio: "",
  data_fim: "",
  tipo_cadastro: "",
};

function getClientFormError(form: ClientFormState): string | null {
  const requiredFields: { key: keyof ClientFormState; label: string }[] = [
    { key: "nome", label: "Nome do cliente" },
    { key: "telefone_whatsapp", label: "Telefone WhatsApp" },
    { key: "documento", label: "Documento" },
    { key: "cpf", label: "CPF" },
    { key: "rg", label: "RG" },
    { key: "data_nascimento", label: "Data de nascimento" },
    { key: "profissao", label: "Profissão" },
    { key: "endereco_completo", label: "Endereço completo" },
    { key: "numero_socio_abccmm", label: "Número de sócio ABCCMM" },
    { key: "data_inicio", label: "Data de início" },
    { key: "data_fim", label: "Data de fim" },
  ];
  const missingField = requiredFields.find(({ key }) => !form[key].trim());
  return missingField
    ? `${missingField.label} - Preenchimento Obrigatório.`
    : null;
}

function getCteHarasFormError(form: ClientFormState): string | null {
  return getClientFormError(form) ??
    (form.tipo_cadastro === "CTE" || form.tipo_cadastro === "HARAS"
      ? null
      : "Tipo do cadastro - Preenchimento Obrigatório.");
}

function clientToForm(client: ClientRecord): ClientFormState {
  return {
    id: client.id,
    nome: client.nome,
    telefone_whatsapp: client.telefone_whatsapp ?? "",
    documento: client.documento ?? "",
    cpf: client.cpf ?? "",
    rg: client.rg ?? "",
    data_nascimento: client.data_nascimento ?? "",
    idade: client.idade == null ? "" : String(client.idade),
    profissao: client.profissao ?? "",
    endereco_completo: client.endereco_completo ?? "",
    numero_socio_abccmm:
      client.numero_socio_abccmm == null ? "" : String(client.numero_socio_abccmm),
    data_inicio: client.data_inicio ?? "",
    data_fim: client.data_fim ?? "",
    tipo_cadastro: "",
  };
}

function clientFieldsFromForm(form: ClientFormState): Omit<ClientRecord, "id"> {
  return {
    nome: form.nome.trim(),
    telefone_whatsapp: form.telefone_whatsapp.trim() || null,
    documento: form.documento.trim() || null,
    cpf: form.cpf.trim() || null,
    rg: form.rg.trim() || null,
    data_nascimento: form.data_nascimento.trim() || null,
    idade: form.idade ? Number(form.idade) : null,
    profissao: form.profissao.trim() || null,
    endereco_completo: form.endereco_completo.trim() || null,
    numero_socio_abccmm: form.numero_socio_abccmm
      ? Number(form.numero_socio_abccmm)
      : null,
    data_inicio: form.data_inicio.trim() || null,
    data_fim: form.data_fim.trim() || null,
  };
}

function cteHarasRegistrationToForm(registration: CteHarasRegistration): ClientFormState {
  return {
    ...clientToForm(registration),
    tipo_cadastro: registration.tipo_cadastro,
  };
}

type Section =
  | "home"
  | "horses"
  | "health"
  | "schedule"
  | "breeding"
  | "finance"
  | "admin"
  | "clients"
  | "cteHarasRegistrations";

const demoApplications: MedicationApplication[] = [
  {
    id: "demo-app-1",
    data_hora_prevista: "2000-01-01T12:00:00.000Z",
    descricao: "Suplemento vitamínico",
    nome_equino: "Sertão",
  },
  {
    id: "demo-app-2",
    data_hora_prevista: "2000-01-01T13:00:00.000Z",
    descricao: "Curativo da pata dianteira",
    nome_equino: "Estrela do Campo",
  },
];

const demoTrainings: TrainingSession[] = [
  {
    id: "demo-training-1",
    data_hora: "2000-01-01T12:30:00.000Z",
    tipo_atividade: "Treino de pista",
    status: "PENDENTE",
    nome_equino: "Estrela do Campo",
  },
  {
    id: "demo-training-2",
    data_hora: "2000-01-01T14:00:00.000Z",
    tipo_atividade: "Caminhada leve",
    status: "PENDENTE",
    nome_equino: "Sertão",
  },
  {
    id: "demo-training-3",
    data_hora: "2000-01-01T15:00:00.000Z",
    tipo_atividade: "Trabalho de base",
    status: "CONCLUIDO",
    nome_equino: "Lua Serena",
  },
];

const navItems: {
  id: Section;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "horses", label: "Cavalos", icon: Activity },
  { id: "health", label: "Saúde", icon: HeartPulse },
  { id: "schedule", label: "Agenda", icon: CalendarDays },
  { id: "breeding", label: "Reprodução", icon: Dna },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "cteHarasRegistrations", label: "Cadastro CTE/Haras", icon: UsersRound },
  { id: "admin", label: "Plataforma", icon: ShieldCheck },
];

const sectionTitles: Record<Section, { title: string; subtitle: string }> = {
  home: {
    title: "Visão do dia",
    subtitle: "O que precisa de atenção na rotina de hoje.",
  },
  horses: {
    title: "Cavalos",
    subtitle: "Encontre os animais e confira a situação de cada um.",
  },
  health: {
    title: "Saúde e medicamentos",
    subtitle: "Confira e marque os cuidados realizados.",
  },
  schedule: {
    title: "Agenda de treinos",
    subtitle: "Acompanhe as atividades programadas para hoje.",
  },
  breeding: {
    title: "Reprodução",
    subtitle: "Acompanhe ciclos, matrizes, garanhões e potros.",
  },
  finance: {
    title: "Financeiro",
    subtitle: "Acompanhe cobranças e despesas do seu centro.",
  },
  clients: {
    title: "Clientes",
    subtitle: "Cadastre, consulte e mantenha os dados dos clientes do centro.",
  },
  cteHarasRegistrations: {
    title: "Cadastro CTE/Haras",
    subtitle: "Cadastre e consulte registros separados de CTE e Haras.",
  },
  admin: {
    title: "Plataforma",
    subtitle: "Gerencie os centros atendidos pela plataforma.",
  },
};

function getStatusLabel(status: string) {
  switch (status) {
    case "EM_TREINO":
      return "Em treino";
    case "EM_TRATAMENTO":
      return "Em tratamento";
    default:
      return "Descanso";
  }
}

function getHorseSexLabel(sex: string) {
  if (sex === "MACHO") return "Macho";
  if (sex === "FEMEA") return "Fêmea";
  return "Não informado";
}

function getTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}

function formatClientDate(date: string | Date | null) {
  if (!date) return "—";
  if (date instanceof Date && Number.isNaN(date.getTime())) return "—";
  const dateOnly =
    date instanceof Date
      ? `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
      : date.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateOnly;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHorseRecord(value: unknown): value is HorseRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    (typeof value.baia === "string" || value.baia === null) &&
    Array.isArray(value.raca) &&
    value.raca.every((race) => typeof race === "string") &&
    typeof value.categoria === "string" &&
    typeof value.status === "string" &&
    (typeof value.nome_pai === "string" || value.nome_pai === null) &&
    (typeof value.nome_mae === "string" || value.nome_mae === null) &&
    (typeof value.data_nascimento === "string" || value.data_nascimento === null) &&
    (typeof value.registro_associacao === "string" ||
      value.registro_associacao === null) &&
    typeof value.sexo === "string" &&
    (typeof value.pelagem === "string" || value.pelagem === null)
  );
}

function isBillingEntry(value: unknown): value is BillingEntry {
  return (
    isRecord(value) &&
    typeof value.descricao === "string" &&
    typeof value.valor === "number" &&
    (typeof value.link_pagamento === "string" || value.link_pagamento === null) &&
    (typeof value.pix_copia_cola === "string" || value.pix_copia_cola === null)
  );
}

function isReproductionCycle(value: unknown): value is ReproductionCycle {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.tipo === "string" &&
    typeof value.garanhao_id === "string" &&
    typeof value.matriz_id === "string" &&
    (typeof value.receptora_id === "string" || value.receptora_id === null) &&
    typeof value.data_cobertura === "string" &&
    typeof value.status === "string" &&
    (typeof value.data_previsao_parto === "string" ||
      value.data_previsao_parto === null) &&
    (typeof value.data_parto_real === "string" || value.data_parto_real === null) &&
    (typeof value.potro_gerado_id === "string" || value.potro_gerado_id === null) &&
    typeof value.nome_garanhao === "string" &&
    typeof value.nome_matriz === "string"
  );
}

function isClientRecord(value: unknown): value is ClientRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    (typeof value.telefone_whatsapp === "string" || value.telefone_whatsapp === null) &&
    (typeof value.documento === "string" || value.documento === null) &&
    (typeof value.cpf === "string" || value.cpf === null) &&
    (typeof value.rg === "string" || value.rg === null) &&
    (typeof value.data_nascimento === "string" || value.data_nascimento === null) &&
    (typeof value.idade === "number" || value.idade === null) &&
    (typeof value.profissao === "string" || value.profissao === null) &&
    (typeof value.endereco_completo === "string" || value.endereco_completo === null) &&
    (
      typeof value.numero_socio_abccmm === "number" ||
      typeof value.numero_socio_abccmm === "string" ||
      value.numero_socio_abccmm === null
    ) &&
    (typeof value.data_inicio === "string" || value.data_inicio === null) &&
    (typeof value.data_fim === "string" || value.data_fim === null)
  );
}

function isCteHarasRegistration(value: unknown): value is CteHarasRegistration {
  if (!isRecord(value)) return false;
  const registrationType = value.tipo_cadastro;
  return (
    isClientRecord(value) &&
    (registrationType === "CTE" || registrationType === "HARAS")
  );
}

async function postDashboardAction(
  action: string,
  fields: Record<string, unknown> = {},
): Promise<unknown> {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...fields }),
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível concluir a operação.";
    throw new Error(message);
  }
  return payload;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="stat-card" onClick={onClick}>
      <span className="stat-icon">
        <Icon size={25} strokeWidth={2.2} />
      </span>
      <span className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <span className="stat-detail">{detail}</span>
      </span>
      <ChevronRight className="stat-arrow" size={20} />
    </button>
  );
}

function BadgeCheckIcon() {
  return <ShieldCheck size={30} className="empty-check-icon" />;
}

export function Dashboard({
  demo,
  role,
  plan,
  tenantName,
  horses: initialHorses,
  medicationApplications = [],
  todayTrainings = [],
  pendingMedicationCount = 0,
  todayTrainingCount = 0,
  pendingFinanceCount = 0,
  breedingCount = 0,
  managedTenants = [],
  billingOwners = [],
  pixAccounts = [],
  financeEntries: initialFinanceEntries = [],
  reproductionCycles: initialReproductionCycles = [],
  clients: initialClients = [],
  cteHarasRegistrations: initialCteHarasRegistrations = [],
}: DashboardProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(
    role === "SUPER_ADMIN" ? "admin" : "home",
  );
  const [horses, setHorses] = useState(initialHorses);
  const [applications, setApplications] = useState(
    demo && medicationApplications.length === 0 ? demoApplications : medicationApplications,
  );
  const [trainings, setTrainings] = useState(
    demo && todayTrainings.length === 0 ? demoTrainings : todayTrainings,
  );
  const [tenants, setTenants] = useState(managedTenants);
  const [financeEntries, setFinanceEntries] = useState(initialFinanceEntries);
  const [reproductionCycles, setReproductionCycles] = useState(initialReproductionCycles);
  const [clients, setClients] = useState(initialClients);
  const [cteHarasRegistrations, setCteHarasRegistrations] = useState(
    initialCteHarasRegistrations,
  );
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [horseCategory, setHorseCategory] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [search, setSearch] = useState("");
  const [showHorseForm, setShowHorseForm] = useState(false);
  const [horseEditingId, setHorseEditingId] = useState<string | null>(null);
  const [horseName, setHorseName] = useState("");
  const [horseStable, setHorseStable] = useState("");
  const [horseOwnerName, setHorseOwnerName] = useState("");
  const [horseTrainerName, setHorseTrainerName] = useState("");
  const [horseFather, setHorseFather] = useState("");
  const [horseMother, setHorseMother] = useState("");
  const [horseBirthDate, setHorseBirthDate] = useState("");
  const [horseRegistration, setHorseRegistration] = useState("");
  const [horseSex, setHorseSex] = useState("INDEFINIDO");
  const [horseCoat, setHorseCoat] = useState("");
  const [horsePhotoUrl, setHorsePhotoUrl] = useState("");
  const [horseBreeds, setHorseBreeds] = useState("");
  const [horseFormCategory, setHorseFormCategory] = useState("ATLETA");
  const [horseStatus, setHorseStatus] = useState("DESCANSO");
  const [horseChip, setHorseChip] = useState("");
  const [horseFeeding, setHorseFeeding] = useState("");
  const [horseMonthlyFee, setHorseMonthlyFee] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [cycleType, setCycleType] = useState("MONTA");
  const [cycleMareId, setCycleMareId] = useState("");
  const [cycleSireId, setCycleSireId] = useState("");
  const [cycleRecipientId, setCycleRecipientId] = useState("");
  const [cycleDate, setCycleDate] = useState("");
  const [cycleDueDate, setCycleDueDate] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(clientFormDefaults);
  const [clientFormContext, setClientFormContext] = useState<
    "client" | "cteHarasRegistration"
  >("client");
  const isOperational = role === "OPERACIONAL";
  const isHaras = plan === "HARAS";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN";
  const canManageHorses = isAdmin || isOperational;

  const visibleNav = useMemo(
    () =>
      navItems.filter((item) => {
        if (isSuperAdmin) return item.id === "admin";
        if (item.id === "cteHarasRegistrations") return isAdmin;
        if (isAdmin) return item.id === "home" || item.id === "horses" || item.id === "health" || item.id === "schedule" || item.id === "finance" || item.id === "clients";
        if (item.id === "breeding") return isHaras && !isOperational;
        if (item.id === "finance") return !isOperational;
        if (item.id === "admin") return isSuperAdmin;
        return true;
      }),
    [isAdmin, isHaras, isOperational, isSuperAdmin],
  );

  const filteredHorses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return horses.filter((horse) => {
      const matchesCategory = !horseCategory || horse.categoria === horseCategory;
      const matchesSearch =
        !query ||
        [
          horse.nome,
          horse.baia ?? "",
          horse.categoria,
          horse.nome_pai ?? "",
          horse.nome_mae ?? "",
          horse.registro_associacao ?? "",
          horse.data_nascimento ?? "",
          horse.sexo,
          horse.pelagem ?? "",
          ...horse.raca,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [horseCategory, horses, search]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (!query) return true;
      const haystack = [
        client.nome,
        client.telefone_whatsapp ?? "",
        client.cpf ?? "",
        client.rg ?? "",
        client.documento ?? "",
        client.profissao ?? "",
        client.endereco_completo ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [clients, search]);

  const filteredCteHarasRegistrations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cteHarasRegistrations.filter((registration) => {
      if (!query) return true;
      const haystack = [
        registration.tipo_cadastro,
        registration.nome,
        registration.telefone_whatsapp ?? "",
        registration.cpf ?? "",
        registration.rg ?? "",
        registration.documento ?? "",
        registration.profissao ?? "",
        registration.endereco_completo ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [cteHarasRegistrations, search]);

  const title = sectionTitles[activeSection];
  const pendingCount = demo ? applications.length : pendingMedicationCount;
  const trainingCount = demo ? 3 : todayTrainingCount;
  const financeCount = demo ? 4 : pendingFinanceCount;
  const cycleCount = demo ? reproductionCycles.length : breedingCount;

  async function handleLogout() {
    if (demo) {
      router.replace("/login");
      return;
    }

    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Falha ao encerrar a sessão:", error);
      setFeedback("Não foi possível encerrar a sessão. Tente novamente.");
    }
  }

  function openHorseForm(horse?: HorseRecord) {
    setFeedback("");
    setHorseEditingId(horse?.id ?? null);
    setHorseName(horse?.nome ?? "");
    setHorseStable(horse?.baia ?? "");
    setHorseOwnerName(horse?.nome_proprietario ?? "");
    setHorseTrainerName(horse?.nome_treinador ?? "");
    setHorseFather(horse?.nome_pai ?? "");
    setHorseMother(horse?.nome_mae ?? "");
    setHorseBirthDate(horse?.data_nascimento ?? "");
    setHorseRegistration(horse?.registro_associacao ?? "");
    setHorseSex(horse?.sexo ?? "INDEFINIDO");
    setHorseCoat(horse?.pelagem ?? "");
    setHorsePhotoUrl(horse?.foto_url ?? "");
    setHorseBreeds(horse?.raca.join(", ") ?? "");
    setHorseFormCategory(horse?.categoria ?? "ATLETA");
    setHorseStatus(horse?.status ?? "DESCANSO");
    setHorseChip(horse?.chip_resenha ?? "");
    setHorseFeeding(horse?.alimentacao_diaria ?? "");
    setHorseMonthlyFee(String(horse?.valor_mensalidade ?? 0));
    setShowHorseForm(true);
  }

  function closeHorseForm() {
    setShowHorseForm(false);
    setHorseEditingId(null);
  }

  async function handleSaveHorse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSaving(true);

    const horseFields = {
      nome: horseName.trim(),
      baia: horseStable.trim() || null,
      nome_proprietario: horseOwnerName.trim() || null,
      nome_treinador: horseTrainerName.trim() || null,
      nome_pai: horseFather.trim() || null,
      nome_mae: horseMother.trim() || null,
      data_nascimento: horseBirthDate || null,
      registro_associacao: horseRegistration.trim() || null,
      sexo: horseSex,
      pelagem: horseCoat || null,
      foto_url: horsePhotoUrl.trim() || null,
      raca: horseBreeds.split(",").map((breed) => breed.trim()).filter(Boolean),
      categoria: horseFormCategory,
      status: horseStatus,
      chip_resenha: horseChip.trim() || null,
      alimentacao_diaria: horseFeeding.trim() || null,
      valor_mensalidade: horseMonthlyFee.trim() ? Number(horseMonthlyFee) : 0,
    };
    const horseId = horseEditingId;

    try {
      if (demo) {
        if (horseId) {
          setHorses((current) =>
            current.map((horse) =>
              horse.id === horseId ? { ...horse, ...horseFields } : horse,
            ),
          );
        } else {
          setHorses((current) => [
            ...current,
            {
              id: `demo-${Date.now()}`,
              ...horseFields,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } else {
        const result = await postDashboardAction(
          horseId ? "updateHorse" : "createHorse",
          { ...horseFields, ...(horseId ? { id: horseId } : {}) },
        );
        const horse = isRecord(result) ? result.horse : null;
        if (!isHorseRecord(horse)) {
          throw new Error("O servidor não retornou o cavalo salvo.");
        }
        setHorses((current) =>
          horseId
            ? current.map((currentHorse) =>
                currentHorse.id === horseId
                  ? { ...currentHorse, ...horse }
                  : currentHorse,
              )
            : [...current, horse],
        );
      }

      setHorseName("");
      setHorseStable("");
      setHorseOwnerName("");
      setHorseTrainerName("");
      setHorseFather("");
      setHorseMother("");
      setHorseBirthDate("");
      setHorseRegistration("");
      setHorseSex("INDEFINIDO");
      setHorseCoat("");
      setHorsePhotoUrl("");
      setHorseBreeds("");
      setHorseFormCategory("ATLETA");
      setHorseStatus("DESCANSO");
      setHorseChip("");
      setHorseFeeding("");
      setHorseMonthlyFee("0");
      setShowHorseForm(false);
      setHorseEditingId(null);
      setFeedback(horseId ? "Animal atualizado." : "Cavalo cadastrado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao salvar cavalo:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível salvar o cavalo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteHorse(horse: HorseRecord) {
    if (
      !window.confirm(
        `Excluir ${horse.nome} do cadastro? O registro será mantido no histórico.`,
      )
    ) {
      return;
    }

    try {
      if (!demo) {
        await postDashboardAction("deleteHorse", { id: horse.id });
      }
      setHorses((current) => current.filter((currentHorse) => currentHorse.id !== horse.id));
      setFeedback("Animal excluído do cadastro.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cavalo:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível excluir o cavalo.",
      );
    }
  }

  async function markApplicationDone(applicationId: string) {
    if (demo) {
      setApplications((current) => current.filter((item) => item.id !== applicationId));
      return;
    }

    try {
      await postDashboardAction("applyMedication", { id: applicationId });
      setApplications((current) => current.filter((item) => item.id !== applicationId));
      setFeedback("Aplicação registrada.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao registrar aplicação:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível registrar a aplicação.",
      );
    }
  }

  async function markTrainingDone(trainingId: string) {
    if (demo) {
      setTrainings((current) =>
        current.map((item) =>
          item.id === trainingId ? { ...item, status: "CONCLUIDO" } : item,
        ),
      );
      return;
    }

    try {
      await postDashboardAction("completeTraining", { id: trainingId });
      setTrainings((current) =>
        current.map((item) =>
          item.id === trainingId ? { ...item, status: "CONCLUIDO" } : item,
        ),
      );
      setFeedback("Treino concluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao concluir treino:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível atualizar o treino.",
      );
    }
  }

  async function updateTenant(
    tenantId: string,
    field: "plano" | "status_assinatura",
    value: string,
  ) {
    const previousTenants = tenants;
    setTenants((current) =>
      current.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, [field]: value } : tenant,
      ),
    );
    setFeedback("");

    try {
      await postDashboardAction("updateTenant", { id: tenantId, field, value });
      setFeedback("Cliente atualizado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao atualizar cliente:", error);
      setTenants(previousTenants);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível atualizar o cliente.",
      );
    }
  }

  async function generateBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setWhatsappUrl("");

    const owner = billingOwners.find((item) => item.id === selectedOwnerId);
    if (!owner) {
      setFeedback("Selecione um proprietário.");
      return;
    }

    try {
      const result = await postDashboardAction("generateBilling", {
        ownerId: owner.id,
        month: billingMonth,
      });
      if (!isRecord(result) || !Array.isArray(result.entries) || !result.entries.every(isBillingEntry)) {
        throw new Error("O servidor não retornou os itens da cobrança.");
      }
      const entries = result.entries;

      if (entries.length === 0) {
        setFeedback("Não há valores pendentes para esta competência.");
        return;
      }

      const currency = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const total = entries.reduce((sum, entry) => sum + entry.valor, 0);
      const pixKey = pixAccounts.find((account) => account.chave_pix)?.chave_pix;
      const paymentLinks = Array.from(
        new Set(
          entries
            .map((entry) => entry.link_pagamento)
            .filter((link): link is string => Boolean(link)),
        ),
        (link) => `Link de pagamento: ${link}`,
      );
      const pixCodes = Array.from(
        new Set(
          entries
            .map((entry) => entry.pix_copia_cola)
            .filter((pix): pix is string => Boolean(pix)),
        ),
        (pix) => `PIX copia e cola: ${pix}`,
      );
      const message = [
        `Olá, ${owner.nome}!`,
        `Segue o resumo da cobrança de ${billingMonth.split("-").reverse().join("/")}:`,
        ...entries.map(
          (entry) => `• ${entry.descricao}: ${currency.format(entry.valor)}`,
        ),
        `Total: ${currency.format(total)}`,
        ...paymentLinks,
        ...pixCodes,
        ...(pixKey ? [`PIX: ${pixKey}`] : []),
      ].join("\n");
      const phone = owner.telefone_whatsapp?.replace(/\D/g, "");

      if (!phone) {
        setFeedback("Cobrança gerada, mas falta o WhatsApp do proprietário.");
        return;
      }

      setWhatsappUrl(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
      setFeedback("Cobrança consolidada. Confira o resumo antes de enviar.");
    } catch (error) {
      console.error("Falha ao gerar a cobrança consolidada:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível gerar a cobrança.",
      );
    }
  }

  async function markFinanceEntryPaid(entryId: string) {
    const accountId = selectedAccounts[entryId];
    if (!accountId) {
      setFeedback("Selecione a conta bancária antes de dar baixa.");
      return;
    }

    try {
      await postDashboardAction("payFinanceEntry", { id: entryId, accountId });
      setFinanceEntries((current) => current.filter((entry) => entry.id !== entryId));
      setFeedback("Pagamento registrado e saldo atualizado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao dar baixa no lançamento:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível registrar o pagamento.",
      );
    }
  }

  async function handleCreateCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSaving(true);
    const mare = horses.find((horse) => horse.id === cycleMareId);
    const sire = horses.find((horse) => horse.id === cycleSireId);

    if (!mare || !sire) {
      setFeedback("Selecione uma matriz e um garanhão.");
      setIsSaving(false);
      return;
    }

    try {
      if (demo) {
        setReproductionCycles((current) => [
          {
            id: `demo-cycle-${Date.now()}`,
            tipo: cycleType,
            garanhao_id: sire.id,
            matriz_id: mare.id,
            receptora_id: cycleRecipientId || null,
            data_cobertura: cycleDate,
            status: "AGUARDANDO_EXAME",
            data_previsao_parto: cycleDueDate || null,
            data_parto_real: null,
            potro_gerado_id: null,
            nome_garanhao: sire.nome,
            nome_matriz: mare.nome,
          },
          ...current,
        ]);
      } else {
        const result = await postDashboardAction("createCycle", {
          type: cycleType,
          mareId: mare.id,
          sireId: sire.id,
          recipientId: cycleRecipientId || null,
          coverageDate: cycleDate,
          dueDate: cycleDueDate,
        });
        const cycle = isRecord(result) ? result.cycle : null;
        if (!isReproductionCycle(cycle)) {
          throw new Error("O servidor não retornou o ciclo registrado.");
        }

        setReproductionCycles((current) => [
          cycle,
          ...current,
        ]);
      }

      setCycleMareId("");
      setCycleSireId("");
      setCycleRecipientId("");
      setCycleDate("");
      setCycleDueDate("");
      setShowCycleForm(false);
      setFeedback("Ciclo reprodutivo registrado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao registrar ciclo reprodutivo:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível registrar o ciclo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCycleStatus(cycleId: string, status: string) {
    const dataParto = status === "PARIDA" ? new Date().toISOString().slice(0, 10) : null;

    if (demo) {
      setReproductionCycles((current) =>
        current.map((cycle) =>
          cycle.id === cycleId
            ? { ...cycle, status, data_parto_real: dataParto }
            : cycle,
        ),
      );
      return;
    }

    try {
      await postDashboardAction("updateCycleStatus", { id: cycleId, status });

      setReproductionCycles((current) =>
        current.map((cycle) =>
          cycle.id === cycleId
            ? { ...cycle, status, data_parto_real: dataParto ?? cycle.data_parto_real }
            : cycle,
        ),
      );
      setFeedback(
        status === "PARIDA"
          ? "Parto registrado. O potro foi incluído no plantel."
          : "Ciclo atualizado.",
      );
      router.refresh();
    } catch (error) {
      console.error("Falha ao atualizar ciclo:", error);
      setFeedback("Não foi possível atualizar o ciclo.");
    }
  }

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const formError = getClientFormError(clientForm);
    if (formError) {
      setFeedback(formError);
      return;
    }
    setIsSaving(true);

    const newClient: ClientRecord = {
      id: `demo-client-${clients.length + 1}`,
      ...clientFieldsFromForm(clientForm),
    };

    try {
      if (demo) {
        setClients((current) => [...current, newClient]);
      } else {
        const result = await postDashboardAction("createClient", newClient);
        const client = isRecord(result) ? result.client : null;
        if (!isClientRecord(client)) {
          throw new Error("O servidor não retornou o cliente cadastrado.");
        }
        setClients((current) => [...current, client]);
      }

      setClientForm(clientFormDefaults);
      setShowClientForm(false);
      setFeedback("Cliente cadastrado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao cadastrar cliente:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const formError = getClientFormError(clientForm);
    if (formError) {
      setFeedback(formError);
      return;
    }
    setIsSaving(true);

    const updatedClient: ClientRecord = {
      id: clientForm.id,
      ...clientFieldsFromForm(clientForm),
    };

    try {
      if (demo) {
        setClients((current) =>
          current.map((client) => (client.id === updatedClient.id ? updatedClient : client)),
        );
      } else {
        const result = await postDashboardAction("updateClient", updatedClient);
        const client = isRecord(result) ? result.client : null;
        if (!isClientRecord(client)) {
          throw new Error("O servidor não retornou o cliente atualizado.");
        }
        setClients((current) =>
          current.map((currentClient) =>
            currentClient.id === updatedClient.id
              ? {
                  ...client,
                  numero_socio_abccmm:
                    typeof client.numero_socio_abccmm === "string"
                      ? Number(client.numero_socio_abccmm)
                      : client.numero_socio_abccmm,
                }
              : currentClient,
          ),
        );
      }

      setClientForm(clientFormDefaults);
      setShowClientForm(false);
      setFeedback("Cliente atualizado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao atualizar cliente:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível atualizar o cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteClient(clientId: string) {
    if (demo) {
      setClients((current) => current.filter((client) => client.id !== clientId));
      return;
    }

    try {
      await postDashboardAction("deleteClient", { id: clientId });
      setClients((current) => current.filter((client) => client.id !== clientId));
      setFeedback("Cliente excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cliente:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível excluir o cliente.",
      );
    }
  }

  async function handleCreateCteHarasRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const formError = getCteHarasFormError(clientForm);
    if (formError) {
      setFeedback(formError);
      return;
    }
    const tipoCadastro = clientForm.tipo_cadastro;
    if (tipoCadastro !== "CTE" && tipoCadastro !== "HARAS") {
      setFeedback("Tipo do cadastro - Preenchimento Obrigatório.");
      return;
    }
    setIsSaving(true);

    const newRegistration: CteHarasRegistration = {
      id: `demo-cte-haras-${cteHarasRegistrations.length + 1}`,
      ...clientFieldsFromForm(clientForm),
      tipo_cadastro: tipoCadastro,
    };

    try {
      if (demo) {
        setCteHarasRegistrations((current) => [...current, newRegistration]);
      } else {
        const result = await postDashboardAction("createCteHarasRegistration", {
          ...clientFieldsFromForm(clientForm),
          tipo_cadastro: tipoCadastro,
        });
        const registration = isRecord(result) ? result.registration : null;
        if (!isCteHarasRegistration(registration)) {
          throw new Error("O servidor não retornou o cadastro criado.");
        }
        setCteHarasRegistrations((current) => [...current, registration]);
      }

      setClientForm(clientFormDefaults);
      setShowClientForm(false);
      setFeedback("Cadastro CTE/Haras criado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao criar cadastro CTE/Haras:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível criar o cadastro.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateCteHarasRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const formError = getCteHarasFormError(clientForm);
    if (formError) {
      setFeedback(formError);
      return;
    }
    const tipoCadastro = clientForm.tipo_cadastro;
    if (tipoCadastro !== "CTE" && tipoCadastro !== "HARAS") {
      setFeedback("Tipo do cadastro - Preenchimento Obrigatório.");
      return;
    }
    setIsSaving(true);

    const updatedRegistration: CteHarasRegistration = {
      id: clientForm.id,
      ...clientFieldsFromForm(clientForm),
      tipo_cadastro: tipoCadastro,
    };

    try {
      if (demo) {
        setCteHarasRegistrations((current) =>
          current.map((registration) =>
            registration.id === updatedRegistration.id ? updatedRegistration : registration,
          ),
        );
      } else {
        const result = await postDashboardAction(
          "updateCteHarasRegistration",
          updatedRegistration,
        );
        const registration = isRecord(result) ? result.registration : null;
        if (!isCteHarasRegistration(registration)) {
          throw new Error("O servidor não retornou o cadastro atualizado.");
        }
        setCteHarasRegistrations((current) =>
          current.map((currentRegistration) =>
            currentRegistration.id === updatedRegistration.id ? registration : currentRegistration,
          ),
        );
      }

      setClientForm(clientFormDefaults);
      setShowClientForm(false);
      setFeedback("Cadastro CTE/Haras atualizado.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao atualizar cadastro CTE/Haras:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível atualizar o cadastro.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCteHarasRegistration(registrationId: string) {
    if (demo) {
      setCteHarasRegistrations((current) =>
        current.filter((registration) => registration.id !== registrationId),
      );
      return;
    }

    try {
      await postDashboardAction("deleteCteHarasRegistration", { id: registrationId });
      setCteHarasRegistrations((current) =>
        current.filter((registration) => registration.id !== registrationId),
      );
      setFeedback("Cadastro CTE/Haras excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cadastro CTE/Haras:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível excluir o cadastro.",
      );
    }
  }

  function navigate(section: Section) {
    setActiveSection(section);
    if (section === "clients" || section === "cteHarasRegistrations") {
      setSearch("");
    }
    setFeedback("");
  }

  function renderHome() {
    return (
      <>
        <section className="stats-grid" aria-label="Resumo">
          <StatCard
            icon={Activity}
            label="Cavalos"
            value={horses.length}
            detail="animais cadastrados"
            onClick={() => navigate("horses")}
          />
          <StatCard
            icon={HeartPulse}
            label="Cuidados pendentes"
            value={pendingCount}
            detail="aplicações para conferir"
            onClick={() => navigate("health")}
          />
          <StatCard
            icon={CalendarDays}
            label="Treinos de hoje"
            value={trainingCount}
            detail="atividades na agenda"
            onClick={() => navigate("schedule")}
          />
          {!isOperational && (
            <StatCard
              icon={CircleDollarSign}
              label="Cobranças pendentes"
              value={financeCount}
              detail="lançamentos em aberto"
              onClick={() => navigate("finance")}
            />
          )}
        </section>

        <div className="content-grid">
          <section className="panel attention-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Rotina da equipe</span>
                <h2>Cuidados para conferir</h2>
              </div>
              <button className="text-button" onClick={() => navigate("health")}>
                Ver lista <ArrowRight size={17} />
              </button>
            </div>
            {applications.length === 0 ? (
              <div className="empty-state compact">
                <BadgeCheckIcon />
                <span>Nenhum cuidado pendente.</span>
              </div>
            ) : (
              <div className="task-list">
                {applications.slice(0, 3).map((application) => (
                  <div className="task-row" key={application.id}>
                    <span className="task-icon health-icon">
                      <Stethoscope size={21} />
                    </span>
                    <span className="task-copy">
                      <strong>{application.descricao}</strong>
                      <span>
                        {application.nome_equino} · {getTime(application.data_hora_prevista)}
                      </span>
                    </span>
                    <span className="pending-dot" aria-label="Pendente" />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel day-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Atalhos</span>
                <h2>Acesso rápido</h2>
              </div>
              <span className="sun-icon" aria-hidden="true">☀</span>
            </div>
            <div className="quick-actions">
              <button onClick={() => navigate("horses")}>
                <span className="quick-icon"><Activity size={21} /></span>
                <span>Ver cavalos</span>
                <ChevronRight size={18} />
              </button>
              <button onClick={() => navigate("health")}>
                <span className="quick-icon"><ClipboardCheck size={21} /></span>
                <span>Checklist de saúde</span>
                <ChevronRight size={18} />
              </button>
              <button onClick={() => navigate("schedule")}>
                <span className="quick-icon"><CalendarDays size={21} /></span>
                <span>Agenda de treinos</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        </div>

        <section className="welcome-strip">
          <div className="welcome-mark"><ShieldCheck size={25} /></div>
          <div>
            <strong>Informação clara, cuidado em dia.</strong>
            <p>Registre cada tarefa assim que ela for feita.</p>
          </div>
          <Bell className="welcome-bell" size={22} />
        </section>
      </>
    );
  }

  function renderHorses() {
    return (
      <>
        {horseCategory && (
          <button className="filter-reset" onClick={() => setHorseCategory("")}>
            Mostrando: {horseCategory.toLocaleLowerCase("pt-BR")} <X size={15} /> Limpar filtro
          </button>
        )}
        <div className="list-toolbar">
          <label className="search-box">
            <Search size={20} />
            <span className="sr-only">Buscar cavalo</span>
            <input
              placeholder="Buscar por nome, pais, registro ou baia"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {canManageHorses && (
            <button className="button button-primary" onClick={() => openHorseForm()}>
              <Plus size={20} /> Cadastrar cavalo
            </button>
          )}
        </div>
        {filteredHorses.length === 0 ? (
          <div className="panel empty-state">
            <Activity size={34} />
            <h2>{search ? "Nenhum cavalo encontrado" : "Ainda não há cavalos cadastrados"}</h2>
            <p>
              {search
                ? "Tente buscar usando outro nome, raça ou número de baia."
                : "Cadastre o primeiro cavalo para começar a organizar a rotina."}
            </p>
          </div>
        ) : (
          <div className="horse-table-wrap">
            <table className="horse-table" aria-label="Cadastro de cavalos">
              <thead>
                <tr>
                  <th scope="col">Animal</th>
                  <th scope="col">Proprietário</th>
                  <th scope="col">Treinador</th>
                  <th scope="col">Nome do pai</th>
                  <th scope="col">Nome da mãe</th>
                  <th scope="col">Nascimento</th>
                  <th scope="col">Registro ABCCMM</th>
                  <th scope="col">Sexo</th>
                  <th scope="col">Pelagem</th>
                  <th scope="col">Raça</th>
                  <th scope="col">Baia</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Chip/Resenha</th>
                  <th scope="col">Alimentação diária</th>
                  <th scope="col">Mensalidade</th>
                  <th scope="col">Foto (URL)</th>
                  <th scope="col">Cadastro</th>
                  {canManageHorses && <th scope="col">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredHorses.map((horse) => (
                  <tr key={horse.id}>
                    <td>{horse.nome}</td>
                    <td>{horse.nome_proprietario || "—"}</td>
                    <td>{horse.nome_treinador || "—"}</td>
                    <td>{horse.nome_pai || "—"}</td>
                    <td>{horse.nome_mae || "—"}</td>
                    <td>{formatClientDate(horse.data_nascimento)}</td>
                    <td>{horse.registro_associacao || "—"}</td>
                    <td>{getHorseSexLabel(horse.sexo)}</td>
                    <td>{horse.pelagem || "—"}</td>
                    <td>{horse.raca.join(", ") || "—"}</td>
                    <td>{horse.baia || "—"}</td>
                    <td>{horse.categoria}</td>
                    <td>
                      <span className={`status-pill status-${horse.status.toLowerCase()}`}>
                        {getStatusLabel(horse.status)}
                      </span>
                    </td>
                    <td>{horse.chip_resenha || "—"}</td>
                    <td>{horse.alimentacao_diaria || "—"}</td>
                    <td>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(horse.valor_mensalidade ?? 0)}
                    </td>
                    <td>{horse.foto_url || "—"}</td>
                    <td>{formatClientDate(horse.created_at ?? null)}</td>
                    {canManageHorses && (
                      <td>
                        <div className="client-row-actions">
                          <button
                            className="button button-secondary"
                            onClick={() => openHorseForm(horse)}
                          >
                            Alterar
                          </button>
                          <button
                            className="button button-quiet"
                            onClick={() => void handleDeleteHorse(horse)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  function renderHealth() {
    return (
      <section className="panel module-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Checklist de saúde</span>
            <h2>{applications.length} cuidados para conferir</h2>
          </div>
          <span className="module-badge"><HeartPulse size={20} /></span>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state compact">
            <BadgeCheckIcon />
            <span>Todos os cuidados foram conferidos.</span>
          </div>
        ) : (
          <div className="care-list">
            {applications.map((application) => (
              <article className="care-row" key={application.id}>
                <span className="care-time">
                  <Clock3 size={17} /> {getTime(application.data_hora_prevista)}
                </span>
                <div className="care-info">
                  <strong>{application.descricao}</strong>
                  <span>{application.nome_equino}</span>
                </div>
                <button
                  className="button button-complete"
                  onClick={() => void markApplicationDone(application.id)}
                >
                  <Check size={19} /> Aplicado
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderSchedule() {
    return (
      <section className="panel module-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Agenda de hoje</span>
            <h2>{trainings.length} treinos programados</h2>
          </div>
          <span className="module-badge"><CalendarDays size={20} /></span>
        </div>
        {trainings.length === 0 ? (
          <div className="empty-state compact">
            <CalendarDays size={30} />
            <span>Nenhum treino programado para hoje.</span>
          </div>
        ) : (
          <div className="care-list">
            {trainings.map((training) => (
              <article className="care-row" key={training.id}>
                <span className="care-time">
                  <Clock3 size={17} /> {getTime(training.data_hora)}
                </span>
                <div className="care-info">
                  <strong>{training.tipo_atividade}</strong>
                  <span>{training.nome_equino}</span>
                </div>
                {training.status === "CONCLUIDO" ? (
                  <span className="completed-label"><Check size={17} /> Concluído</span>
                ) : (
                  <button
                    className="button button-secondary"
                    onClick={() => void markTrainingDone(training.id)}
                  >
                    Marcar feito
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderBreeding() {
    return (
      <>
        <div className="module-grid">
          <section className="panel module-panel breeding-hero">
            <span className="module-badge"><Dna size={22} /></span>
            <span className="eyebrow">Plantel reprodutivo</span>
            <h2>{cycleCount} ciclos acompanhados</h2>
            <p>Consulte coberturas, exames, previsões de parto e nascimentos.</p>
            {!isOperational && (
              <button
                className="button button-primary"
                onClick={() => setShowCycleForm((visible) => !visible)}
              >
                <Plus size={19} /> Novo ciclo
              </button>
            )}
          </section>
          <section className="panel category-panel">
            <h2>Atalhos do plantel</h2>
            <div className="category-list">
              {[
                { label: "Matrizes", value: "MATRIZ", icon: UsersRound },
                { label: "Garanhões", value: "GARANHAO", icon: Activity },
                { label: "Potros", value: "POTRO", icon: Baby },
                { label: "Receptoras", value: "RECEPTORA", icon: HeartPulse },
              ].map((category) => {
                const Icon = category.icon;
                const count = horses.filter((horse) => horse.categoria === category.value).length;
                return (
                  <button
                    key={category.value}
                    onClick={() => {
                      setHorseCategory(category.value);
                      setSearch("");
                      navigate("horses");
                    }}
                  >
                    <Icon size={20} />
                    <span>{category.label}</span>
                    <small>{count}</small>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        {showCycleForm && (
          <form
            className="panel cycle-form"
            onSubmit={(event) => void handleCreateCycle(event)}
          >
            <div className="panel-heading">
              <h2>Registrar cobertura</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar formulário"
                onClick={() => setShowCycleForm(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="cycle-form-grid">
              <label>
                Tipo
                <select value={cycleType} onChange={(event) => setCycleType(event.target.value)}>
                  <option value="MONTA">Monta</option>
                  <option value="INSEMINACAO">Inseminação</option>
                  <option value="TE">Transferência de embrião</option>
                </select>
              </label>
              <label>
                Matriz
                <select required value={cycleMareId} onChange={(event) => setCycleMareId(event.target.value)}>
                  <option value="">Selecione</option>
                  {horses.filter((horse) => horse.categoria === "MATRIZ").map((horse) => (
                    <option key={horse.id} value={horse.id}>{horse.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Garanhão
                <select required value={cycleSireId} onChange={(event) => setCycleSireId(event.target.value)}>
                  <option value="">Selecione</option>
                  {horses.filter((horse) => horse.categoria === "GARANHAO").map((horse) => (
                    <option key={horse.id} value={horse.id}>{horse.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Receptora (opcional)
                <select value={cycleRecipientId} onChange={(event) => setCycleRecipientId(event.target.value)}>
                  <option value="">Não se aplica</option>
                  {horses.filter((horse) => horse.categoria === "RECEPTORA").map((horse) => (
                    <option key={horse.id} value={horse.id}>{horse.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Data da cobertura
                <input
                  type="date"
                  required
                  value={cycleDate}
                  onChange={(event) => setCycleDate(event.target.value)}
                />
              </label>
              <label>
                Previsão de parto (opcional)
                <input
                  type="date"
                  value={cycleDueDate}
                  onChange={(event) => setCycleDueDate(event.target.value)}
                />
              </label>
            </div>
            <button className="button button-primary" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar ciclo"}
            </button>
          </form>
        )}
        <section className="panel cycle-list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Acompanhamento</span>
              <h2>Ciclos reprodutivos</h2>
            </div>
            <span className="module-badge"><Dna size={20} /></span>
          </div>
          {reproductionCycles.length === 0 ? (
            <div className="empty-state compact">Nenhum ciclo reprodutivo cadastrado.</div>
          ) : (
            reproductionCycles.map((cycle) => (
              <article className="cycle-row" key={cycle.id}>
                <div className="cycle-info">
                  <strong>{cycle.nome_matriz} × {cycle.nome_garanhao}</strong>
                  <span>
                    {cycle.tipo} · Cobertura{" "}
                    {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                      new Date(`${cycle.data_cobertura}T12:00:00Z`),
                    )}
                  </span>
                  {cycle.data_previsao_parto && (
                    <small>Parto previsto: {cycle.data_previsao_parto}</small>
                  )}
                  {cycle.potro_gerado_id && <small>Potro registrado no plantel.</small>}
                </div>
                <span className={`cycle-status cycle-${cycle.status.toLowerCase()}`}>
                  {cycle.status.replaceAll("_", " ")}
                </span>
                {!isOperational && cycle.status === "AGUARDANDO_EXAME" && (
                  <div className="cycle-actions">
                    <button className="button button-secondary" onClick={() => void updateCycleStatus(cycle.id, "PRENHE")}>
                      Confirmar prenhez
                    </button>
                    <button className="button button-quiet" onClick={() => void updateCycleStatus(cycle.id, "VAZIA")}>
                      Marcar vazia
                    </button>
                  </div>
                )}
                {!isOperational && cycle.status === "PRENHE" && (
                  <button className="button button-primary" onClick={() => void updateCycleStatus(cycle.id, "PARIDA")}>
                    Registrar parto
                  </button>
                )}
              </article>
            ))
          )}
        </section>
      </>
    );
  }

  function renderCteHarasRegistrations() {
    return (
      <>
        <div className="list-toolbar">
          <form
            className="search-box"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(search.trim());
            }}
          >
            <Search size={20} />
            <span className="sr-only">Buscar cadastro CTE/Haras</span>
            <input
              type="search"
              placeholder="Buscar por tipo, nome, documento ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          {isAdmin && (
            <button
              className="button button-primary"
              onClick={() => {
                setFeedback("");
                setClientFormContext("cteHarasRegistration");
                setClientForm(clientFormDefaults);
                setShowClientForm(true);
              }}
            >
              <Plus size={20} /> Novo cadastro
            </button>
          )}
        </div>
        {filteredCteHarasRegistrations.length === 0 ? (
          <div className="panel empty-state">
            <UsersRound size={34} />
            <h2>
              {search
                ? "Nenhum cadastro CTE/Haras encontrado"
                : "Ainda não há cadastros CTE/Haras"}
            </h2>
            <p>
              {search
                ? "Tente buscar usando outro tipo, nome, documento ou telefone."
                : "Cadastre o primeiro registro para começar."}
            </p>
          </div>
        ) : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Data de início</th>
                  <th scope="col">Sócio ABCCMM</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCteHarasRegistrations.map((registration) => (
                  <tr key={registration.id}>
                    <td>{registration.tipo_cadastro === "CTE" ? "CTE" : "Haras"}</td>
                    <td>{registration.nome}</td>
                    <td>{registration.telefone_whatsapp || "—"}</td>
                    <td>{formatClientDate(registration.data_inicio)}</td>
                    <td>{registration.numero_socio_abccmm ?? "—"}</td>
                    <td>
                      <div className="client-row-actions">
                        {isAdmin && (
                          <>
                            <button
                              className="button button-secondary"
                              onClick={() => {
                                setFeedback("");
                                setClientFormContext("cteHarasRegistration");
                                setClientForm(cteHarasRegistrationToForm(registration));
                                setShowClientForm(true);
                              }}
                            >
                              Alterar
                            </button>
                            <button
                              className="button button-quiet"
                              onClick={() =>
                                void handleDeleteCteHarasRegistration(registration.id)
                              }
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  function renderFinance() {
    return (
      <div className="module-grid">
        <section className="panel finance-summary">
          <span className="module-badge"><Wallet size={22} /></span>
          <span className="eyebrow">A receber</span>
          <strong className="finance-number">{financeCount}</strong>
          <p>lançamentos pendentes</p>
          <div className="finance-note">
            <CircleDollarSign size={19} />
            <span>Mensalidades, extras e despesas ficam disponíveis somente para gestores.</span>
          </div>
          {pixAccounts.length > 0 && (
            <div className="account-balances">
              <strong>Contas</strong>
              {pixAccounts.map((account) => (
                <div key={account.id}>
                  <span>{account.nome}</span>
                  <b>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(account.saldo_atual))}
                  </b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel module-panel finance-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Contas a receber e pagar</span>
              <h2>Lançamentos em aberto</h2>
            </div>
            <span className="module-badge"><CircleDollarSign size={20} /></span>
          </div>
          {financeEntries.length === 0 ? (
            <div className="empty-state compact">Nenhum lançamento em aberto.</div>
          ) : (
            <div className="finance-entry-list">
              {financeEntries.map((entry) => (
                <article className="finance-entry" key={entry.id}>
                  <div className="finance-entry-info">
                    <strong>{entry.descricao}</strong>
                    <span>
                      {entry.natureza === "RECEITA" ? "Receita" : "Despesa"} · Vence{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(`${entry.data_vencimento}T12:00:00`))}
                    </span>
                  </div>
                  <b className={entry.natureza === "DESPESA" ? "expense-amount" : ""}>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(entry.valor))}
                  </b>
                  <div className="finance-entry-actions">
                    <label>
                      <span className="sr-only">Conta bancária de {entry.descricao}</span>
                      <select
                        value={selectedAccounts[entry.id] ?? ""}
                        onChange={(event) =>
                          setSelectedAccounts((current) => ({
                            ...current,
                            [entry.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Conta para baixa</option>
                        {pixAccounts.map((account) => (
                          <option value={account.id} key={account.id}>{account.nome}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button button-complete"
                      disabled={pixAccounts.length === 0}
                      onClick={() => void markFinanceEntryPaid(entry.id)}
                    >
                      <Check size={17} /> Baixar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="finance-billing">
            <span className="eyebrow">Cobrança consolidada</span>
            <h3>Uma cobrança por proprietário</h3>
            {billingOwners.length === 0 ? (
              <div className="info-callout">Cadastre proprietários para gerar cobranças.</div>
            ) : (
              <form className="billing-form" onSubmit={(event) => void generateBilling(event)}>
                <label htmlFor="billing-owner">Proprietário</label>
                <select
                  id="billing-owner"
                  required
                  value={selectedOwnerId}
                  onChange={(event) => setSelectedOwnerId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {billingOwners.map((owner) => (
                    <option value={owner.id} key={owner.id}>{owner.nome}</option>
                  ))}
                </select>
                <label htmlFor="billing-month">Competência</label>
                <input
                  id="billing-month"
                  type="month"
                  required
                  value={billingMonth}
                  onChange={(event) => setBillingMonth(event.target.value)}
                />
                <button className="button button-primary">
                  <CircleDollarSign size={19} /> Gerar resumo
                </button>
                {whatsappUrl && (
                  <a
                    className="button button-secondary whatsapp-link"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir WhatsApp
                    <ArrowRight size={17} />
                  </a>
                )}
              </form>
            )}
            <div className="info-callout">
              A baixa automática depende da configuração do gateway de pagamento.
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderAdmin() {
    return (
      <section className="panel module-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Painel da plataforma</span>
            <h2>Gestão de clientes</h2>
          </div>
          <span className="module-badge"><Building2 size={20} /></span>
        </div>
        <p>
          O acesso global aos clientes está protegido pelo perfil SUPER_ADMIN e pelas
          políticas RLS do banco.
        </p>
        <div className="admin-summary">
          <span><ShieldCheck size={20} /> Perfil autorizado</span>
          <strong>{tenantName}</strong>
        </div>
        <div className="managed-tenants">
          {tenants.length === 0 ? (
            <div className="empty-state compact">Nenhum cliente cadastrado.</div>
          ) : (
            tenants.map((tenant) => (
              <article className="managed-tenant" key={tenant.id}>
                <div>
                  <strong>{tenant.nome}</strong>
                  <small>{tenant.status_assinatura}</small>
                </div>
                <label>
                  <span className="sr-only">Plano de {tenant.nome}</span>
                  <select
                    value={tenant.plano}
                    onChange={(event) =>
                      void updateTenant(tenant.id, "plano", event.target.value)
                    }
                  >
                    <option value="CTE">CTE</option>
                    <option value="HARAS">HARAS</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Status de {tenant.nome}</span>
                  <select
                    value={tenant.status_assinatura}
                    onChange={(event) =>
                      void updateTenant(tenant.id, "status_assinatura", event.target.value)
                    }
                  >
                    <option value="TRIAL">Teste</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="BLOQUEADO">Bloqueado</option>
                  </select>
                </label>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderClients() {
    return (
      <>
        <div className="list-toolbar">
          <form
            className="search-box"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(search.trim());
            }}
          >
            <Search size={20} />
            <span className="sr-only">Buscar cliente</span>
            <input
              type="search"
              placeholder="Buscar por nome, documento ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          {(isAdmin || isOperational) && (
            <button
              className="button button-primary"
              onClick={() => {
                setFeedback("");
                setClientFormContext("client");
                setClientForm(clientFormDefaults);
                setShowClientForm(true);
              }}
            >
              <Plus size={20} /> Cadastrar cliente
            </button>
          )}
        </div>
        {filteredClients.length === 0 ? (
          <div className="panel empty-state">
            <Building2 size={34} />
            <h2>{search ? "Nenhum cliente encontrado" : "Ainda não há clientes cadastrados"}</h2>
            <p>
              {search
                ? "Tente buscar usando outro nome, documento ou telefone."
                : "Cadastre o primeiro cliente para começar a organizar a rotina."}
            </p>
          </div>
        ) : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Data de início</th>
                  <th scope="col">Sócio ABCCMM</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.nome}</td>
                    <td>{client.telefone_whatsapp || "—"}</td>
                    <td>{formatClientDate(client.data_inicio)}</td>
                    <td>{client.numero_socio_abccmm ?? "—"}</td>
                    <td>
                      <div className="client-row-actions">
                        {(isAdmin || isOperational) && (
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setFeedback("");
                              setClientFormContext("client");
                              setClientForm(clientToForm(client));
                              setShowClientForm(true);
                            }}
                          >
                            Alterar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="button button-quiet"
                            onClick={() => void handleDeleteClient(client.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  function renderSection() {
    switch (activeSection) {
      case "horses":
        return renderHorses();
      case "health":
        return renderHealth();
      case "schedule":
        return renderSchedule();
      case "breeding":
        return renderBreeding();
      case "finance":
        return renderFinance();
      case "admin":
        return renderAdmin();
      case "clients":
        return renderClients();
      case "cteHarasRegistrations":
        return isAdmin ? renderCteHarasRegistrations() : renderHome();
      default:
        return renderHome();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">CV</div>
          <div>
            <strong>Campo Vivo</strong>
            <span>Gestão equestre</span>
          </div>
        </div>

        <div className="tenant-card">
          <span className="tenant-icon"><Building2 size={20} /></span>
          <span>
            <strong>{tenantName}</strong>
            <small>{isHaras ? "Plano Haras" : "Plano CTE"}</small>
          </span>
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          <span className="nav-caption">MENU PRINCIPAL</span>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeSection === item.id ? "nav-item-active" : ""}`}
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={activeSection === item.id ? "page" : undefined}
              >
                <Icon size={21} strokeWidth={2.2} />
                <span>{item.label}</span>
                {item.id === "health" && pendingCount > 0 && (
                  <span className="nav-count">{pendingCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="role-label">
            <ShieldCheck size={17} />
            <span>{role === "OPERACIONAL" ? "Equipe operacional" : role === "SUPER_ADMIN" ? "Super administrador" : "Administrador"}</span>
          </div>
          {!demo && (
            <button className="logout-button" onClick={() => void handleLogout()}>
              <LogOut size={18} /> Sair
            </button>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">CV</div>
            <strong>Campo Vivo</strong>
          </div>
          <div className="topbar-context">
            <span className="today-label">
              <CalendarDays size={16} />
              Hoje
            </span>
            <span className="plan-tag">{isHaras ? "HARAS" : "CTE"}</span>
            {demo && <span className="demo-tag">MODO DEMONSTRAÇÃO</span>}
          </div>
          {!demo && (
            <button
              className="mobile-logout"
              onClick={() => void handleLogout()}
              aria-label="Sair da conta"
            >
              <LogOut size={19} />
            </button>
          )}
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                Olá,{" "}
                {isSuperAdmin
                  ? "administrador da plataforma"
                  : isOperational
                    ? "equipe"
                    : "gestor"}
                !
              </span>
              <h1>{title.title}</h1>
              <p>{title.subtitle}</p>
            </div>
            {activeSection === "home" && pendingCount > 0 && (
              <button className="alert-button" onClick={() => navigate("health")}>
                <Bell size={20} />
                <span>{pendingCount} cuidados pendentes</span>
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {feedback && (
            <p className="feedback-message" role="status">
              {feedback}
            </p>
          )}

          {renderSection()}
        </main>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`mobile-nav-item ${activeSection === item.id ? "mobile-nav-active" : ""}`}
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={activeSection === item.id ? "page" : undefined}
              >
                <Icon size={21} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {showHorseForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeHorseForm();
        }}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="horse-form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{horseEditingId ? "Editar cadastro" : "Novo cadastro"}</span>
                <h2 id="horse-form-title">{horseEditingId ? "Alterar animal" : "Cadastrar cavalo"}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={closeHorseForm}
              >
                <X size={22} />
              </button>
            </div>
            <form className="horse-form" onSubmit={(event) => void handleSaveHorse(event)}>
              <label htmlFor="horse-name">Nome do animal</label>
              <input
                id="horse-name"
                autoFocus
                required
                value={horseName}
                onChange={(event) => setHorseName(event.target.value)}
                maxLength={120}
                placeholder="Ex.: Estrela do Campo"
              />
              <label htmlFor="horse-photo">URL da foto (opcional)</label>
              <input
                id="horse-photo"
                type="url"
                value={horsePhotoUrl}
                onChange={(event) => setHorsePhotoUrl(event.target.value)}
                maxLength={2000}
                placeholder="https://..."
              />
              <label htmlFor="horse-owner">Proprietário (opcional)</label>
              <input
                id="horse-owner"
                value={horseOwnerName}
                onChange={(event) => setHorseOwnerName(event.target.value)}
                maxLength={120}
                placeholder="Digite o nome do proprietário"
              />
              <label htmlFor="horse-trainer">Treinador (opcional)</label>
              <input
                id="horse-trainer"
                value={horseTrainerName}
                onChange={(event) => setHorseTrainerName(event.target.value)}
                maxLength={120}
                placeholder="Digite o nome do treinador"
              />
              <label htmlFor="horse-breeds">Raça(s), separadas por vírgula (opcional)</label>
              <input
                id="horse-breeds"
                value={horseBreeds}
                onChange={(event) => setHorseBreeds(event.target.value)}
                maxLength={500}
                placeholder="Ex.: Mangalarga Marchador"
              />
              <label htmlFor="horse-category">Categoria</label>
              <select
                id="horse-category"
                value={horseFormCategory}
                onChange={(event) => setHorseFormCategory(event.target.value)}
              >
                <option value="ATLETA">Atleta</option>
                <option value="MATRIZ">Matriz</option>
                <option value="GARANHAO">Garanhão</option>
                <option value="POTRO">Potro</option>
                <option value="RECEPTORA">Receptora</option>
              </select>
              <label htmlFor="horse-status">Status</label>
              <select
                id="horse-status"
                value={horseStatus}
                onChange={(event) => setHorseStatus(event.target.value)}
              >
                <option value="EM_TREINO">Em treino</option>
                <option value="EM_TRATAMENTO">Em tratamento</option>
                <option value="DESCANSO">Descanso</option>
              </select>
              <label htmlFor="horse-father">Nome do pai (opcional)</label>
              <input
                id="horse-father"
                value={horseFather}
                onChange={(event) => setHorseFather(event.target.value)}
                maxLength={120}
                placeholder="Digite o nome do pai"
              />
              <label htmlFor="horse-mother">Nome da mãe (opcional)</label>
              <input
                id="horse-mother"
                value={horseMother}
                onChange={(event) => setHorseMother(event.target.value)}
                maxLength={120}
                placeholder="Digite o nome da mãe"
              />
              <label htmlFor="horse-birth-date">Data de nascimento (opcional)</label>
              <input
                id="horse-birth-date"
                type="date"
                value={horseBirthDate}
                onChange={(event) => setHorseBirthDate(event.target.value)}
              />
              <label htmlFor="horse-registration">Número de registro ABCCMM (opcional)</label>
              <input
                id="horse-registration"
                value={horseRegistration}
                onChange={(event) => setHorseRegistration(event.target.value)}
                maxLength={80}
              />
              <label htmlFor="horse-sex">Sexo</label>
              <select
                id="horse-sex"
                value={horseSex}
                onChange={(event) => setHorseSex(event.target.value)}
              >
                <option value="INDEFINIDO">Não informado</option>
                <option value="MACHO">Macho</option>
                <option value="FEMEA">Fêmea</option>
              </select>
              <label htmlFor="horse-coat">Pelagem (opcional)</label>
              <select
                id="horse-coat"
                value={horseCoat}
                onChange={(event) => setHorseCoat(event.target.value)}
              >
                <option value="">Selecione</option>
                {horseCoatTypes.map((coat) => (
                  <option key={coat} value={coat}>
                    {coat}
                  </option>
                ))}
              </select>
              <label htmlFor="horse-stable">Baia (opcional)</label>
              <input
                id="horse-stable"
                value={horseStable}
                onChange={(event) => setHorseStable(event.target.value)}
                placeholder="Ex.: 04"
              />
              <label htmlFor="horse-chip">Chip / resenha (opcional)</label>
              <input
                id="horse-chip"
                value={horseChip}
                onChange={(event) => setHorseChip(event.target.value)}
                maxLength={120}
              />
              <label htmlFor="horse-feeding">Alimentação diária (opcional)</label>
              <textarea
                id="horse-feeding"
                value={horseFeeding}
                onChange={(event) => setHorseFeeding(event.target.value)}
                maxLength={1000}
                rows={3}
              />
              <label htmlFor="horse-monthly-fee">Mensalidade (R$)</label>
              <input
                id="horse-monthly-fee"
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                value={horseMonthlyFee}
                onChange={(event) => setHorseMonthlyFee(event.target.value)}
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={closeHorseForm}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={isSaving}>
                  <Plus size={19} />
                  {isSaving
                    ? "Salvando..."
                    : horseEditingId
                      ? "Salvar alterações"
                      : "Salvar cavalo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showClientForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowClientForm(false);
        }}>
          <section
            className="modal-card client-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {clientForm.id ? "Atualização cadastral" : "Novo cadastro"}
                </span>
                <h2 id="client-form-title">
                  {clientFormContext === "cteHarasRegistration"
                    ? clientForm.id
                      ? "Editar cadastro CTE/Haras"
                      : "Novo cadastro CTE/Haras"
                    : clientForm.id
                      ? "Editar cliente"
                      : "Cadastrar cliente"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setShowClientForm(false)}
              >
                <X size={22} />
              </button>
            </div>
            <form
              className="client-form"
              noValidate
              onSubmit={(event) => {
                if (clientFormContext === "cteHarasRegistration") {
                  void (clientForm.id
                    ? handleUpdateCteHarasRegistration(event)
                    : handleCreateCteHarasRegistration(event));
                  return;
                }
                void (clientForm.id
                  ? handleUpdateClient(event)
                  : handleCreateClient(event));
              }}
            >
              {clientFormContext === "cteHarasRegistration" && (
                <>
                  <label htmlFor="client-registration-type">Tipo do cadastro</label>
                  <select
                    id="client-registration-type"
                    required
                    value={clientForm.tipo_cadastro}
                    onChange={(event) =>
                      setClientForm({
                        ...clientForm,
                        tipo_cadastro:
                          event.target.value === "CTE" || event.target.value === "HARAS"
                            ? event.target.value
                            : "",
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    <option value="CTE">CTE</option>
                    <option value="HARAS">Haras</option>
                  </select>
                </>
              )}
              <label htmlFor="client-name">Nome do cliente</label>
              <input
                id="client-name"
                autoFocus
                required
                value={clientForm.nome}
                onChange={(event) => setClientForm({ ...clientForm, nome: event.target.value })}
                placeholder="Ex.: João da Silva"
              />
              <label htmlFor="client-phone">Telefone WhatsApp</label>
              <input
                id="client-phone"
                required
                value={clientForm.telefone_whatsapp}
                onChange={(event) => setClientForm({ ...clientForm, telefone_whatsapp: event.target.value })}
                placeholder="Ex.: (11) 91234-5678"
              />
              <label htmlFor="client-document">Documento</label>
              <input
                id="client-document"
                required
                value={clientForm.documento}
                onChange={(event) => setClientForm({ ...clientForm, documento: event.target.value })}
                placeholder="Ex.: 123.456.789-09"
              />
              <label htmlFor="client-cpf">CPF</label>
              <input
                id="client-cpf"
                required
                value={clientForm.cpf}
                onChange={(event) => setClientForm({ ...clientForm, cpf: event.target.value })}
                placeholder="Ex.: 123.456.789-09"
              />
              <label htmlFor="client-rg">RG</label>
              <input
                id="client-rg"
                required
                value={clientForm.rg}
                onChange={(event) => setClientForm({ ...clientForm, rg: event.target.value })}
                placeholder="Ex.: 12.345.678-9"
              />
              <label htmlFor="client-birthdate">Data de nascimento</label>
              <input
                id="client-birthdate"
                type="date"
                required
                value={clientForm.data_nascimento}
                onChange={(event) => setClientForm({ ...clientForm, data_nascimento: event.target.value })}
              />
              <label htmlFor="client-profession">Profissão</label>
              <input
                id="client-profession"
                required
                value={clientForm.profissao}
                onChange={(event) => setClientForm({ ...clientForm, profissao: event.target.value })}
                placeholder="Ex.: Agricultor"
              />
              <label htmlFor="client-address">Endereço completo</label>
              <input
                id="client-address"
                required
                value={clientForm.endereco_completo}
                onChange={(event) => setClientForm({ ...clientForm, endereco_completo: event.target.value })}
                placeholder="Ex.: Rua das Flores, 123"
              />
              <label htmlFor="client-member-number">Número de sócio ABCCMM</label>
              <input
                id="client-member-number"
                type="number"
                required
                value={clientForm.numero_socio_abccmm ?? ""}
                onChange={(event) => setClientForm({ ...clientForm, numero_socio_abccmm: event.target.value })}
                placeholder="Ex.: 1234"
              />
              <label htmlFor="client-start-date">Data de início</label>
              <input
                id="client-start-date"
                type="date"
                required
                value={clientForm.data_inicio}
                onChange={(event) => setClientForm({ ...clientForm, data_inicio: event.target.value })}
              />
              <label htmlFor="client-end-date">Data de fim</label>
              <input
                id="client-end-date"
                type="date"
                required
                value={clientForm.data_fim}
                onChange={(event) => setClientForm({ ...clientForm, data_fim: event.target.value })}
              />
              {feedback && (
                <p className="client-form-error" role="alert">
                  {feedback}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowClientForm(false)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={isSaving}>
                  <Plus size={19} />{" "}
                  {isSaving
                    ? "Salvando..."
                    : clientFormContext === "cteHarasRegistration"
                      ? "Salvar cadastro"
                      : "Salvar cliente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}