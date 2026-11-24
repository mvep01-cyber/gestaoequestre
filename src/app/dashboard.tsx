"use client";

import {
  Activity,
  ArrowRight,
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
  Package,
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
import { CteHarasRegistrations, type CteHarasRegistration } from "./cte-haras-registrations";
import { AdminFinance, type AdminFinanceEntry, type AdminFinanceRegistration } from "./admin-finance";
import { Products } from "./products";
import { ServiceProviders, type ProviderCenter } from "./service-providers";
import { Employees } from "./employees";
import { Suppliers } from "./suppliers";
import { isHttpUrl } from "@/lib/url";
import { isValidCpf } from "@/lib/brazilian-documents";
import { productTimeZone } from "@/lib/product-dates";

type HorseRecord = {
  id: string;
  proprietario_id?: string | null;
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
  localizacao?: string | null;
  foto_url?: string | null;
  nome_proprietario?: string | null;
  nome_treinador?: string | null;
  chip_resenha?: string | null;
  alimentacao_diaria?: string | null;
  valor_mensalidade?: number;
  created_at?: string | null;
  cte_haras_nome?: string | null;
  cte_haras_tipo?: "CTE" | "HARAS" | null;
};

const horseCoatTypes = [
  "Branco", "Preto", "Alazão", "Baio", "Castanha", "Tordilha", "Rosilha",
  "Pampa de Preto", "Pampa de Marrom", "Pampa de Castanho", "Pampa de Alazão",
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
  garanhao_id: string | null;
  matriz_id: string | null;
  receptora_id: string | null;
  data_cobertura: string;
  hora_cobertura: string | null;
  veterinario: string | null;
  descricao: string | null;
  garanhao_origem: "INTERNO" | "EXTERNO";
  garanhao_externo_nome: string | null;
  garanhao_externo_registro: string | null;
  matriz_origem: "INTERNO" | "EXTERNO";
  matriz_externa_nome: string | null;
  matriz_externa_registro: string | null;
  status: string;
  data_previsao_parto: string | null;
  data_parto_real: string | null;
  potro_gerado_id: string | null;
  nome_garanhao: string;
  nome_matriz: string;
  nome_receptora: string | null;
  localizacao_receptora: string | null;
};

type ReproductionRecipientOption = Pick<
  HorseRecord,
  "id" | "nome" | "categoria" | "localizacao" | "registro_associacao"
>;

type ClientRecord = {
  id: string;
  nome: string;
  cte_haras_nome?: string | null;
  cte_haras_tipo?: "CTE" | "HARAS" | null;
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

type DashboardProps = {
  demo: boolean;
  role: string;
  clientRegistrationType?: "CTE" | "HARAS" | null;
  globalAdmin?: boolean;
  selectedTenantId?: string;
  adminFinanceConfigured?: boolean;
  adminFinanceNeedsMigration?: boolean;
  adminFinanceEntries?: AdminFinanceEntry[];
  adminFinanceRegistrations?: AdminFinanceRegistration[];
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
  reproductionVeterinarians?: string[];
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
};

type CycleFormState = {
  tipo: "MONTA" | "INSEMINACAO" | "TE";
  matriz_origem: "INTERNO" | "EXTERNO";
  matriz_id: string;
  matriz_externa_nome: string;
  matriz_externa_registro: string;
  garanhao_origem: "INTERNO" | "EXTERNO";
  garanhao_id: string;
  garanhao_externo_nome: string;
  garanhao_externo_registro: string;
  receptora_id: string;
  data_cobertura: string;
  hora_cobertura: string;
  veterinario: string;
  data_previsao_parto: string;
  descricao: string;
};

const cycleFormDefaults: CycleFormState = {
  tipo: "MONTA",
  matriz_origem: "INTERNO",
  matriz_id: "",
  matriz_externa_nome: "",
  matriz_externa_registro: "",
  garanhao_origem: "INTERNO",
  garanhao_id: "",
  garanhao_externo_nome: "",
  garanhao_externo_registro: "",
  receptora_id: "",
  data_cobertura: "",
  hora_cobertura: "",
  veterinario: "",
  data_previsao_parto: "",
  descricao: "",
};

type RecipientFormState = {
  nome: string;
  registro_associacao: string;
  localizacao: string;
};

const recipientFormDefaults: RecipientFormState = {
  nome: "",
  registro_associacao: "",
  localizacao: "",
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
};

type Section = "home" | "horses" | "health" | "schedule" | "breeding" | "finance" | "admin" | "clients" | "cteHarasRegistrations" | "products" | "providers" | "employees" | "suppliers";

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
  { id: "products", label: "Produtos", icon: Package },
  { id: "suppliers", label: "Fornecedores", icon: Building2 },
  { id: "providers", label: "Prestação de Serviços", icon: Stethoscope },
  { id: "employees", label: "Funcionários", icon: UsersRound },
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
  products: {
    title: "Produtos",
    subtitle: "Visualize os produtos vinculados a cada fornecedor.",
  },
  suppliers: {
    title: "Fornecedores",
    subtitle: "Cadastre fornecedores e consulte a lista de produtos de cada um.",
  },
  providers: {
    title: "Prestação de Serviços",
    subtitle: "Cadastre os prestadores e informe os serviços oferecidos ao centro.",
  },
  employees: {
    title: "Funcionários",
    subtitle: "Visualize a equipe vinculada ao CTE ou Haras.",
  },
  cteHarasRegistrations: {
    title: "Cadastro CTE/Haras",
    subtitle: "Cadastre, consulte e mantenha os dados de CTE e Haras.",
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

function formatHorseDate(date: string | null) {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatHorseRegistrationDate(date: string | null) {
  if (!date) return "—";
  const timestamp = new Date(date);
  return Number.isNaN(timestamp.getTime())
    ? formatHorseDate(date)
    : new Intl.DateTimeFormat("pt-BR", { timeZone: productTimeZone }).format(timestamp);
}

function getTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
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
    (typeof value.registro_associacao === "string" || value.registro_associacao === null) &&
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
    (typeof value.garanhao_id === "string" || value.garanhao_id === null) &&
    (typeof value.matriz_id === "string" || value.matriz_id === null) &&
    (typeof value.receptora_id === "string" || value.receptora_id === null) &&
    typeof value.data_cobertura === "string" &&
    (typeof value.hora_cobertura === "string" || value.hora_cobertura === null) &&
    (typeof value.veterinario === "string" || value.veterinario === null) &&
    (typeof value.descricao === "string" || value.descricao === null) &&
    (value.garanhao_origem === "INTERNO" || value.garanhao_origem === "EXTERNO") &&
    (typeof value.garanhao_externo_nome === "string" ||
      value.garanhao_externo_nome === null) &&
    (typeof value.garanhao_externo_registro === "string" ||
      value.garanhao_externo_registro === null) &&
    (value.matriz_origem === "INTERNO" || value.matriz_origem === "EXTERNO") &&
    (typeof value.matriz_externa_nome === "string" ||
      value.matriz_externa_nome === null) &&
    (typeof value.matriz_externa_registro === "string" ||
      value.matriz_externa_registro === null) &&
    typeof value.status === "string" &&
    (typeof value.data_previsao_parto === "string" ||
      value.data_previsao_parto === null) &&
    (typeof value.data_parto_real === "string" || value.data_parto_real === null) &&
    (typeof value.potro_gerado_id === "string" || value.potro_gerado_id === null) &&
    typeof value.nome_garanhao === "string" &&
    typeof value.nome_matriz === "string" &&
    (typeof value.nome_receptora === "string" || value.nome_receptora === null) &&
    (typeof value.localizacao_receptora === "string" ||
      value.localizacao_receptora === null)
  );
}

function isReproductionRecipient(value: unknown): value is ReproductionRecipientOption {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    value.categoria === "RECEPTORA" &&
    (typeof value.registro_associacao === "string" ||
      value.registro_associacao === null) &&
    (typeof value.localizacao === "string" || value.localizacao === null)
  );
}

function reproductionTypeLabel(type: string) {
  if (type === "INSEMINACAO") return "Inseminação";
  if (type === "TE") return "Transferência de embrião";
  return "Monta";
}

function reproductionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    AGUARDANDO_EXAME: "Aguardando exame",
    PRENHE: "Prenhe",
    VAZIA: "Vazia",
    PARIDA: "Parida",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatReproductionDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
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
    (typeof value.numero_socio_abccmm === "number" || value.numero_socio_abccmm === null) &&
    (typeof value.data_inicio === "string" || value.data_inicio === null) &&
    (typeof value.data_fim === "string" || value.data_fim === null)
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
  clientRegistrationType = null,
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
  reproductionVeterinarians = [],
  clients: initialClients = [],
  cteHarasRegistrations = [],
  selectedTenantId,
  adminFinanceConfigured = false,
  adminFinanceNeedsMigration = false,
  adminFinanceEntries = [],
  adminFinanceRegistrations = [],
}: DashboardProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(
    role === "SUPER_ADMIN" ? "admin" : role === "CLIENTE" ? "horses" : "home",
  );
  const [demoHorses, setDemoHorses] = useState(initialHorses);
  const horses = demo ? demoHorses : initialHorses;
  const [createdReproductionRecipients, setCreatedReproductionRecipients] =
    useState<ReproductionRecipientOption[]>([]);
  const reproductionHorses = [
    ...horses,
    ...createdReproductionRecipients.filter(
      (recipient) => !horses.some((horse) => horse.id === recipient.id),
    ),
  ];
  const [applications, setApplications] = useState(
    demo && medicationApplications.length === 0 ? demoApplications : medicationApplications,
  );
  const [trainings, setTrainings] = useState(
    demo && todayTrainings.length === 0 ? demoTrainings : todayTrainings,
  );
  const [tenants, setTenants] = useState(managedTenants);
  const [financeEntries, setFinanceEntries] = useState(initialFinanceEntries);
  const [reproductionCycles, setReproductionCycles] = useState(initialReproductionCycles);
  const [demoClients, setDemoClients] = useState(initialClients);
  const clients = demo ? demoClients : initialClients;
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [horseCategory, setHorseCategory] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [search, setSearch] = useState("");
  const [providerCenters, setProviderCenters] = useState<ProviderCenter[]>([]);
  const [providerCenterId, setProviderCenterId] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<{ id: string; nome: string } | null>(null);
  const [showHorseForm, setShowHorseForm] = useState(false);
  const [horseEditingId, setHorseEditingId] = useState<string | null>(null);
  const [horseName, setHorseName] = useState("");
  const [horseStable, setHorseStable] = useState("");
  const [horseOwnerName, setHorseOwnerName] = useState("");
  const [horseOwnerId, setHorseOwnerId] = useState("");
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
  const [cycleEditingId, setCycleEditingId] = useState<string | null>(null);
  const [cycleForm, setCycleForm] = useState<CycleFormState>({ ...cycleFormDefaults });
  const [cycleSearch, setCycleSearch] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<ReproductionCycle | null>(null);
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientForm, setRecipientForm] =
    useState<RecipientFormState>({ ...recipientFormDefaults });
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(clientFormDefaults);
  const isOperational = role === "OPERACIONAL";
  const isHaras = plan === "HARAS";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN";
  const isClientAccount =
    role === "CLIENTE" &&
    (clientRegistrationType === "CTE" || clientRegistrationType === "HARAS");
  const canManageReproduction = isAdmin && isHaras;
  const canManageHorses = isOperational || isClientAccount;
  const canManageClients = isAdmin || isOperational || isClientAccount;

  const visibleNav = useMemo(
    () =>
      navItems.filter((item) => {
        if (isSuperAdmin) return item.id === "admin";
        if (role === "CLIENTE") {
          return isClientAccount && (item.id === "horses" || item.id === "clients" || item.id === "finance" || item.id === "products" || item.id === "providers" || item.id === "employees" || item.id === "suppliers");
        }
        if (isAdmin) return item.id === "home" || item.id === "horses" || item.id === "health" || item.id === "schedule" || (item.id === "breeding" && isHaras) || item.id === "finance" || item.id === "clients" || item.id === "cteHarasRegistrations" || item.id === "products" || item.id === "providers" || item.id === "employees" || item.id === "suppliers";
        if (item.id === "cteHarasRegistrations" || item.id === "products" || item.id === "providers" || item.id === "employees" || item.id === "suppliers") return false;
        if (item.id === "breeding") return isHaras && !isOperational;
        if (item.id === "finance") return !isOperational;
        if (item.id === "admin") return isSuperAdmin;
        return true;
      }),
    [isAdmin, isClientAccount, isHaras, isOperational, isSuperAdmin, role],
  );

  const filteredHorses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return horses.filter((horse) => {
      const matchesCategory = !horseCategory || horse.categoria === horseCategory;
      const matchesSearch =
        !query ||
        [horse.nome, horse.baia ?? "", horse.categoria, horse.nome_pai ?? "",
          horse.nome_mae ?? "", horse.registro_associacao ?? "", horse.data_nascimento ?? "",
          horse.sexo, horse.pelagem ?? "", ...horse.raca]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [horseCategory, horses, search]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return clients.filter((client) => {
      if (!query) return true;
      const haystack = [
        client.nome,
        client.telefone_whatsapp ?? "",
        client.documento ?? "",
        client.cpf ?? "",
        client.rg ?? "",
        client.profissao ?? "",
        client.endereco_completo ?? "",
      ].join(" ").toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [clients, search]);

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
    setHorseOwnerId(
      horse?.proprietario_id && clients.some((client) => client.id === horse.proprietario_id)
        ? horse.proprietario_id
        : horse?.proprietario_id || horse?.nome_proprietario ? "unavailable" : "",
    );
    setHorseTrainerName(horse?.nome_treinador ?? "");
    setHorseFather(horse?.nome_pai ?? "");
    setHorseMother(horse?.nome_mae ?? "");
    setHorseBirthDate(horse?.data_nascimento?.slice(0, 10) ?? "");
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
    const selectedOwner = clients.find((client) => client.id === horseOwnerId);
    if (isClientAccount && horseOwnerId && !selectedOwner) {
      setFeedback("Selecione um proprietário do seu cadastro ou escolha a opção sem proprietário.");
      return;
    }
    setIsSaving(true);
    const fields = {
      nome: horseName.trim(),
      baia: horseStable.trim() || null,
      nome_proprietario: isClientAccount ? selectedOwner?.nome ?? null : horseOwnerName.trim() || null,
      proprietario_id: isClientAccount ? selectedOwner?.id ?? null : null,
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

    try {
      if (demo) {
        setDemoHorses((current) => horseEditingId
          ? current.map((horse) => horse.id === horseEditingId ? { ...horse, ...fields } : horse)
          : [...current, { id: `demo-${Date.now()}`, ...fields, created_at: new Date().toISOString() }]);
      } else {
        const result = await postDashboardAction(horseEditingId ? "updateHorse" : "createHorse", {
          ...fields,
          ...(horseEditingId ? { id: horseEditingId } : {}),
          tenantId: selectedTenantId,
        });
        const horse = isRecord(result) ? result.horse : null;
        if (!isHorseRecord(horse)) {
          throw new Error("O servidor não retornou o cavalo salvo.");
        }
      }
      closeHorseForm();
      setFeedback(horseEditingId ? "Animal atualizado." : "Cavalo cadastrado.");
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
    if (!window.confirm(`Excluir ${horse.nome} do cadastro? O registro será mantido no histórico.`)) return;
    setFeedback("");
    setIsSaving(true);
    try {
      if (demo) {
        setDemoHorses((current) => current.filter((item) => item.id !== horse.id));
      } else {
        await postDashboardAction("deleteHorse", { id: horse.id, tenantId: selectedTenantId });
      }
      setFeedback("Animal excluído do cadastro.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cavalo:", error);
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o cavalo.");
    } finally {
      setIsSaving(false);
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

  function openCycleForm(cycle?: ReproductionCycle) {
    setCycleEditingId(cycle?.id ?? null);
    setCycleForm(
      cycle
        ? {
            tipo:
              cycle.tipo === "INSEMINACAO" || cycle.tipo === "TE"
                ? cycle.tipo
                : "MONTA",
            matriz_origem: cycle.matriz_origem,
            matriz_id: cycle.matriz_id ?? "",
            matriz_externa_nome: cycle.matriz_externa_nome ?? "",
            matriz_externa_registro: cycle.matriz_externa_registro ?? "",
            garanhao_origem: cycle.garanhao_origem,
            garanhao_id: cycle.garanhao_id ?? "",
            garanhao_externo_nome: cycle.garanhao_externo_nome ?? "",
            garanhao_externo_registro: cycle.garanhao_externo_registro ?? "",
            receptora_id: cycle.receptora_id ?? "",
            data_cobertura: cycle.data_cobertura,
            hora_cobertura: cycle.hora_cobertura ?? "",
            veterinario: cycle.veterinario ?? "",
            data_previsao_parto: cycle.data_previsao_parto ?? "",
            descricao: cycle.descricao ?? "",
          }
        : { ...cycleFormDefaults },
    );
    setSelectedCycle(null);
    setShowCycleForm(true);
  }

  function closeCycleForm() {
    setShowCycleForm(false);
    setCycleEditingId(null);
  }

  async function handleSaveCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSaving(true);
    const mare = reproductionHorses.find(
      (horse) => horse.id === cycleForm.matriz_id,
    );
    const sire = reproductionHorses.find(
      (horse) => horse.id === cycleForm.garanhao_id,
    );
    const recipient = reproductionHorses.find(
      (horse) => horse.id === cycleForm.receptora_id,
    );
    const fields = {
      type: cycleForm.tipo,
      mareOrigin: cycleForm.matriz_origem,
      mareId: cycleForm.matriz_id || null,
      mareExternalName: cycleForm.matriz_externa_nome.trim(),
      mareExternalRegistration: cycleForm.matriz_externa_registro.trim(),
      sireOrigin: cycleForm.garanhao_origem,
      sireId: cycleForm.garanhao_id || null,
      sireExternalName: cycleForm.garanhao_externo_nome.trim(),
      sireExternalRegistration: cycleForm.garanhao_externo_registro.trim(),
      recipientId: cycleForm.receptora_id || null,
      coverageDate: cycleForm.data_cobertura,
      coverageTime: cycleForm.hora_cobertura,
      veterinarian: cycleForm.veterinario,
      dueDate: cycleForm.data_previsao_parto,
      description: cycleForm.descricao.trim(),
    };

    try {
      if (demo) {
        const existing = reproductionCycles.find(
          (cycle) => cycle.id === cycleEditingId,
        );
        const cycle: ReproductionCycle = {
          id: cycleEditingId ?? `demo-cycle-${Date.now()}`,
          tipo: fields.type,
          garanhao_id: fields.sireId,
          matriz_id: fields.mareId,
          receptora_id: fields.recipientId,
          data_cobertura: fields.coverageDate,
          hora_cobertura: fields.coverageTime || null,
          veterinario: fields.veterinarian || null,
          descricao: fields.description || null,
          garanhao_origem: fields.sireOrigin,
          garanhao_externo_nome:
            fields.sireOrigin === "EXTERNO" ? fields.sireExternalName : null,
          garanhao_externo_registro:
            fields.sireOrigin === "EXTERNO"
              ? fields.sireExternalRegistration || null
              : null,
          matriz_origem: fields.mareOrigin,
          matriz_externa_nome:
            fields.mareOrigin === "EXTERNO" ? fields.mareExternalName : null,
          matriz_externa_registro:
            fields.mareOrigin === "EXTERNO"
              ? fields.mareExternalRegistration || null
              : null,
          status: existing?.status ?? "AGUARDANDO_EXAME",
          data_previsao_parto: fields.dueDate || null,
          data_parto_real: existing?.data_parto_real ?? null,
          potro_gerado_id: existing?.potro_gerado_id ?? null,
          nome_garanhao:
            fields.sireOrigin === "EXTERNO"
              ? fields.sireExternalName
              : sire?.nome ?? "",
          nome_matriz:
            fields.mareOrigin === "EXTERNO"
              ? fields.mareExternalName
              : mare?.nome ?? "",
          nome_receptora: recipient?.nome ?? null,
          localizacao_receptora: recipient?.localizacao ?? null,
        };
        setReproductionCycles((current) =>
          cycleEditingId
            ? current.map((item) => (item.id === cycleEditingId ? cycle : item))
            : [cycle, ...current],
        );
      } else {
        const result = await postDashboardAction(
          cycleEditingId ? "updateCycle" : "createCycle",
          { ...fields, ...(cycleEditingId ? { id: cycleEditingId } : {}) },
        );
        const cycle = isRecord(result) ? result.cycle : null;
        if (!isReproductionCycle(cycle)) {
          throw new Error("O servidor não retornou o ciclo salvo.");
        }

        setReproductionCycles((current) =>
          cycleEditingId
            ? current.map((item) => (item.id === cycle.id ? cycle : item))
            : [cycle, ...current],
        );
      }

      setCycleForm({ ...cycleFormDefaults });
      setShowCycleForm(false);
      setFeedback(
        cycleEditingId ? "Ciclo reprodutivo atualizado." : "Ciclo reprodutivo registrado.",
      );
      setCycleEditingId(null);
      router.refresh();
    } catch (error) {
      console.error("Falha ao salvar ciclo reprodutivo:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível salvar o ciclo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSaving(true);
    const name = recipientForm.nome.trim();
    try {
      let recipient: ReproductionRecipientOption;
      if (demo) {
        recipient = {
          id: `demo-recipient-${Date.now()}`,
          nome: name,
          categoria: "RECEPTORA",
          registro_associacao: recipientForm.registro_associacao.trim() || null,
          localizacao: recipientForm.localizacao.trim() || null,
        };
      } else {
        const result = await postDashboardAction("createRecipient", {
          name,
          registration: recipientForm.registro_associacao,
          location: recipientForm.localizacao,
        });
        const created = isRecord(result) ? result.recipient : null;
        if (!isReproductionRecipient(created)) {
          throw new Error("O servidor não retornou a receptora cadastrada.");
        }
        recipient = created;
      }

      setCreatedReproductionRecipients((current) => [recipient, ...current]);
      setRecipientForm({ ...recipientFormDefaults });
      setShowRecipientForm(false);
      setFeedback("Receptora cadastrada.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao cadastrar receptora:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível cadastrar a receptora.",
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
    if (!isValidCpf(clientForm.cpf)) {
      setFeedback("Informe um CPF válido.");
      return;
    }
    setIsSaving(true);

    let demoClientNumber = 1;
    while (clients.some((client) => client.id === `demo-client-${demoClientNumber}`)) {
      demoClientNumber += 1;
    }
    const newClient: ClientRecord = {
      id: `demo-client-${demoClientNumber}`,
      nome: clientForm.nome.trim(),
      telefone_whatsapp: clientForm.telefone_whatsapp.trim() || null,
      documento: clientForm.documento.trim() || null,
      cpf: clientForm.cpf?.trim() || null,
      rg: clientForm.rg?.trim() || null,
      data_nascimento: clientForm.data_nascimento?.trim() || null,
      idade: clientForm.idade ? Number(clientForm.idade) : null,
      profissao: clientForm.profissao?.trim() || null,
      endereco_completo: clientForm.endereco_completo?.trim() || null,
      numero_socio_abccmm: clientForm.numero_socio_abccmm ? Number(clientForm.numero_socio_abccmm) : null,
      data_inicio: clientForm.data_inicio?.trim() || null,
      data_fim: clientForm.data_fim?.trim() || null,
    };

    try {
      if (demo) {
        setDemoClients((current) => [...current, newClient]);
      } else {
        const result = await postDashboardAction("createClient", { ...newClient, tenantId: selectedTenantId });
        const client = isRecord(result) ? result.client : null;
        if (!isClientRecord(client)) {
          throw new Error("O servidor não retornou o cliente cadastrado.");
        }
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
    if (!isValidCpf(clientForm.cpf)) {
      setFeedback("Informe um CPF válido.");
      return;
    }
    setIsSaving(true);

    const updatedClient: ClientRecord = {
      ...clientForm,
      idade: clientForm.idade ? Number(clientForm.idade) : null,
      numero_socio_abccmm: clientForm.numero_socio_abccmm ? Number(clientForm.numero_socio_abccmm) : null,
    };

    try {
      if (demo) {
        setDemoClients((current) =>
          current.map((client) => (client.id === updatedClient.id ? updatedClient : client)),
        );
      } else {
        const result = await postDashboardAction("updateClient", { ...updatedClient, tenantId: selectedTenantId });
        const client = isRecord(result) ? result.client : null;
        if (!isClientRecord(client)) {
          throw new Error("O servidor não retornou o cliente atualizado.");
        }
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
      setDemoClients((current) => current.filter((client) => client.id !== clientId));
      return;
    }

    try {
      await postDashboardAction("deleteClient", { id: clientId, tenantId: selectedTenantId });
      setFeedback("Cliente excluído.");
      router.refresh();
    } catch (error) {
      console.error("Falha ao excluir cliente:", error);
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível excluir o cliente.",
      );
    }
  }

  function navigate(section: Section) {
    setActiveSection(section);
    setSupplierFilter(null);
    setSearch("");
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
                : isAdmin
                  ? "Não há cavalos cadastrados para este centro."
                  : "Cadastre o primeiro cavalo para começar a organizar a rotina."}
            </p>
          </div>
        ) : (
          <div className="horse-table-wrap">
            <table className="horse-table" aria-label="Cadastro de cavalos">
              <thead>
                <tr>
                  <th scope="col">Animal</th>
                  {isAdmin && <th scope="col">CTE/Haras que cadastrou</th>}
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
                    {isAdmin && (
                      <td>
                        {horse.cte_haras_nome
                          ? `${horse.cte_haras_tipo === "CTE" ? "CTE" : "Haras"} — ${horse.cte_haras_nome}`
                          : "Sem vínculo CTE/Haras"}
                      </td>
                    )}
                    <td>{horse.nome_proprietario || "—"}</td>
                    <td>{horse.nome_treinador || "—"}</td>
                    <td>{horse.nome_pai || "—"}</td>
                    <td>{horse.nome_mae || "—"}</td>
                    <td>{formatHorseDate(horse.data_nascimento)}</td>
                    <td>{horse.registro_associacao || "—"}</td>
                    <td>{getHorseSexLabel(horse.sexo)}</td>
                    <td>{horse.pelagem || "—"}</td>
                    <td>{horse.raca.join(", ") || "—"}</td>
                    <td>{horse.baia || "—"}</td>
                    <td>{horse.categoria}</td>
                    <td><span className={`status-pill status-${horse.status.toLowerCase()}`}>{getStatusLabel(horse.status)}</span></td>
                    <td>{horse.chip_resenha || "—"}</td>
                    <td>{horse.alimentacao_diaria || "—"}</td>
                    <td>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(horse.valor_mensalidade ?? 0)}</td>
                    <td>{horse.foto_url && isHttpUrl(horse.foto_url)
                      ? <a href={horse.foto_url} target="_blank" rel="noopener noreferrer">{horse.foto_url}</a>
                      : horse.foto_url || "—"}</td>
                    <td>{formatHorseRegistrationDate(horse.created_at ?? null)}</td>
                    {canManageHorses && (
                      <td><div className="client-row-actions">
                        <button className="button button-secondary" disabled={isSaving} onClick={() => openHorseForm(horse)}>Alterar</button>
                        <button className="button button-quiet" disabled={isSaving} onClick={() => void handleDeleteHorse(horse)}>Excluir</button>
                      </div></td>
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
    const filteredCycles = reproductionCycles.filter((cycle) => {
      const searchable = [
        cycle.nome_matriz,
        cycle.matriz_origem,
        cycle.nome_garanhao,
        cycle.garanhao_origem,
        cycle.nome_receptora,
        cycle.tipo,
        cycle.data_cobertura,
        cycle.hora_cobertura,
        cycle.veterinario,
        cycle.descricao,
        reproductionStatusLabel(cycle.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return searchable.includes(cycleSearch.trim().toLocaleLowerCase("pt-BR"));
    });

    function changeOrigin(
      animal: "matriz" | "garanhao",
      value: string,
    ) {
      if (value !== "INTERNO" && value !== "EXTERNO") return;
      setCycleForm((current) =>
        animal === "matriz"
          ? {
              ...current,
              matriz_origem: value,
              matriz_id: "",
              matriz_externa_nome: "",
              matriz_externa_registro: "",
            }
          : {
              ...current,
              garanhao_origem: value,
              garanhao_id: "",
              garanhao_externo_nome: "",
              garanhao_externo_registro: "",
            },
      );
    }

    function renderOriginField(animal: "matriz" | "garanhao", label: string) {
      const isMare = animal === "matriz";
      const origin = isMare ? cycleForm.matriz_origem : cycleForm.garanhao_origem;
      const horseId = isMare ? cycleForm.matriz_id : cycleForm.garanhao_id;
      const externalName = isMare
        ? cycleForm.matriz_externa_nome
        : cycleForm.garanhao_externo_nome;
      const externalRegistration = isMare
        ? cycleForm.matriz_externa_registro
        : cycleForm.garanhao_externo_registro;
      const category = isMare ? "MATRIZ" : "GARANHAO";
      const eligibleHorses = reproductionHorses.filter(
        (horse) => horse.categoria === category,
      );

      return (
        <fieldset className="cycle-origin-group">
          <legend>{label}</legend>
          <div className="cycle-origin-options">
            <label>
              <input
                type="radio"
                name={`${animal}-origin`}
                value="INTERNO"
                required
                checked={origin === "INTERNO"}
                onChange={(event) => changeOrigin(animal, event.target.value)}
              />
              Interno — cavalo cadastrado
            </label>
            <label>
              <input
                type="radio"
                name={`${animal}-origin`}
                value="EXTERNO"
                checked={origin === "EXTERNO"}
                onChange={(event) => changeOrigin(animal, event.target.value)}
              />
              Externo
            </label>
          </div>
          {origin === "INTERNO" ? (
            <label className="cycle-form-field">
              {label} cadastrada
              <select
                required
                value={horseId}
                onChange={(event) =>
                  setCycleForm((current) =>
                    isMare
                      ? { ...current, matriz_id: event.target.value }
                      : { ...current, garanhao_id: event.target.value },
                  )
                }
              >
                <option value="">Selecione</option>
                {eligibleHorses.map((horse) => (
                  <option value={horse.id} key={horse.id}>{horse.nome}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="cycle-origin-fields">
              <label className="cycle-form-field">
                Nome {isMare ? "da matriz" : "do garanhão"} externo
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={externalName}
                  onChange={(event) =>
                    setCycleForm((current) =>
                      isMare
                        ? { ...current, matriz_externa_nome: event.target.value }
                        : { ...current, garanhao_externo_nome: event.target.value },
                    )
                  }
                />
              </label>
              <label className="cycle-form-field">
                Registro (opcional)
                <input
                  type="text"
                  maxLength={80}
                  value={externalRegistration}
                  onChange={(event) =>
                    setCycleForm((current) =>
                      isMare
                        ? {
                            ...current,
                            matriz_externa_registro: event.target.value,
                          }
                        : {
                            ...current,
                            garanhao_externo_registro: event.target.value,
                          },
                    )
                  }
                />
              </label>
            </div>
          )}
        </fieldset>
      );
    }

    const selectedRecipient = reproductionHorses.find(
      (horse) => horse.id === cycleForm.receptora_id,
    );

    return (
      <>
        <section className="panel reproduction-panel">
          <div className="panel-heading reproduction-heading">
            <div>
              <span className="eyebrow">Plantel reprodutivo</span>
              <h2>Ciclos reprodutivos</h2>
            </div>
            <span className="reproduction-count">{cycleCount} ciclos acompanhados</span>
          </div>
          <div className="reproduction-toolbar">
            <label className="reproduction-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar nesta lista</span>
              <input
                type="search"
                placeholder="Buscar nesta lista"
                aria-label="Buscar nesta lista"
                value={cycleSearch}
                onChange={(event) => setCycleSearch(event.target.value)}
              />
            </label>
            {canManageReproduction && (
              <div className="reproduction-toolbar-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setRecipientForm({ ...recipientFormDefaults });
                    setShowRecipientForm(true);
                  }}
                >
                  Cadastrar receptora
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => openCycleForm()}
                >
                  <Plus size={18} /> Novo ciclo
                </button>
              </div>
            )}
          </div>
          <div className="reproduction-table-wrap">
            <table className="reproduction-table">
              <thead>
                <tr>
                  <th scope="col">Matriz</th>
                  <th scope="col">Origem da matriz</th>
                  <th scope="col">Garanhão</th>
                  <th scope="col">Origem do garanhão</th>
                  <th scope="col">Receptora</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Cobertura</th>
                  <th scope="col">Horário</th>
                  <th scope="col">Veterinário</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCycles.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="reproduction-empty">
                      {reproductionCycles.length === 0
                        ? "Nenhum ciclo reprodutivo cadastrado."
                        : "Nenhum ciclo corresponde à busca."}
                    </td>
                  </tr>
                ) : (
                  filteredCycles.map((cycle) => (
                    <tr key={cycle.id}>
                      <td>{cycle.nome_matriz}</td>
                      <td>{cycle.matriz_origem === "INTERNO" ? "Interno" : "Externo"}</td>
                      <td>{cycle.nome_garanhao}</td>
                      <td>{cycle.garanhao_origem === "INTERNO" ? "Interno" : "Externo"}</td>
                      <td>{cycle.nome_receptora ?? "Não se aplica"}</td>
                      <td>{reproductionTypeLabel(cycle.tipo)}</td>
                      <td>{formatReproductionDate(cycle.data_cobertura)}</td>
                      <td>{cycle.hora_cobertura ?? "—"}</td>
                      <td>{cycle.veterinario ?? "—"}</td>
                      <td>{cycle.descricao ?? "—"}</td>
                      <td>
                        <span className={`cycle-status cycle-${cycle.status.toLowerCase()}`}>
                          {reproductionStatusLabel(cycle.status)}
                        </span>
                      </td>
                      <td>
                        <div className="reproduction-row-actions">
                          <button
                            type="button"
                            className="button button-secondary small-button"
                            onClick={() => setSelectedCycle(cycle)}
                          >
                            Visualizar
                          </button>
                          {canManageReproduction && (
                            <>
                              <button
                                type="button"
                                className="button button-quiet small-button"
                                disabled={cycle.status === "PARIDA" || Boolean(cycle.potro_gerado_id)}
                                title={
                                  cycle.status === "PARIDA" || cycle.potro_gerado_id
                                    ? "Ciclos com parto registrado não podem ser alterados."
                                    : undefined
                                }
                                onClick={() => openCycleForm(cycle)}
                              >
                                Alterar
                              </button>
                              {cycle.status === "AGUARDANDO_EXAME" && (
                                <>
                                  <button
                                    type="button"
                                    className="button button-secondary small-button"
                                    onClick={() => void updateCycleStatus(cycle.id, "PRENHE")}
                                  >
                                    Confirmar prenhez
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-quiet small-button"
                                    onClick={() => void updateCycleStatus(cycle.id, "VAZIA")}
                                  >
                                    Marcar vazia
                                  </button>
                                </>
                              )}
                              {cycle.status === "PRENHE" && (
                                <button
                                  type="button"
                                  className="button button-primary small-button"
                                  onClick={() => void updateCycleStatus(cycle.id, "PARIDA")}
                                >
                                  Registrar parto
                                </button>
                              )}
                            </>
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
            Receptoras vinculadas ao cadastro de cavalos do centro. As novas receptoras
            cadastradas aqui ficam salvas; veterinários disponíveis são prestadores com
            serviço veterinário registrado.
          </p>
        </section>
        {showCycleForm && (
          <div
            className="reproduction-dialog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCycleForm();
            }}
          >
            <section
              className="reproduction-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cycle-form-title"
              onKeyDown={(event) => {
                if (event.key === "Escape") closeCycleForm();
              }}
            >
              <div className="reproduction-dialog-header">
                <div>
                  <span className="eyebrow">Plantel reprodutivo</span>
                  <h2 id="cycle-form-title">
                    {cycleEditingId ? "Alterar ciclo" : "Registrar cobertura"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar formulário"
                  onClick={closeCycleForm}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={(event) => void handleSaveCycle(event)}>
                <div className="cycle-form-grid">
                  <label className="cycle-form-field">
                    Tipo
                    <select
                      value={cycleForm.tipo}
                      onChange={(event) => {
                        const tipo = event.target.value;
                        if (
                          tipo === "MONTA" ||
                          tipo === "INSEMINACAO" ||
                          tipo === "TE"
                        ) {
                          setCycleForm((current) => ({ ...current, tipo }));
                        }
                      }}
                    >
                      <option value="MONTA">Monta</option>
                      <option value="INSEMINACAO">Inseminação</option>
                      <option value="TE">Transferência de embrião</option>
                    </select>
                  </label>
                  {renderOriginField("matriz", "Matriz")}
                  {renderOriginField("garanhao", "Garanhão")}
                  <label className="cycle-form-field">
                    Receptora
                    <select
                      value={cycleForm.receptora_id}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          receptora_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Não se aplica</option>
                      {reproductionHorses
                        .filter((horse) => horse.categoria === "RECEPTORA")
                        .map((horse) => (
                          <option value={horse.id} key={horse.id}>{horse.nome}</option>
                        ))}
                    </select>
                    {selectedRecipient && (
                      <small className="reproduction-field-hint">
                        Local: {selectedRecipient.localizacao || "não informado"}
                      </small>
                    )}
                  </label>
                  <label className="cycle-form-field">
                    Data da cobertura
                    <input
                      type="date"
                      required
                      value={cycleForm.data_cobertura}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          data_cobertura: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="cycle-form-field">
                    Horário da cobertura
                    <input
                      type="time"
                      value={cycleForm.hora_cobertura}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          hora_cobertura: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="cycle-form-field">
                    Veterinário
                    <select
                      value={cycleForm.veterinario}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          veterinario: event.target.value,
                        }))
                      }
                    >
                      <option value="">Não informado</option>
                      {cycleForm.veterinario &&
                        !reproductionVeterinarians.includes(cycleForm.veterinario) && (
                          <option value={cycleForm.veterinario}>
                            {cycleForm.veterinario}
                          </option>
                        )}
                      {reproductionVeterinarians.map((veterinarian) => (
                        <option value={veterinarian} key={veterinarian}>
                          {veterinarian}
                        </option>
                      ))}
                    </select>
                    <small className="reproduction-field-hint">
                      Prestadores cadastrados com serviço veterinário.
                    </small>
                  </label>
                  <label className="cycle-form-field">
                    Previsão de parto
                    <input
                      type="date"
                      value={cycleForm.data_previsao_parto}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          data_previsao_parto: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="cycle-form-field cycle-form-field-full">
                    Descrição
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={cycleForm.descricao}
                      onChange={(event) =>
                        setCycleForm((current) => ({
                          ...current,
                          descricao: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="reproduction-dialog-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={closeCycleForm}
                  >
                    Cancelar
                  </button>
                  <button className="button button-primary" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar ciclo"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {showRecipientForm && (
          <div
            className="reproduction-dialog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setShowRecipientForm(false);
            }}
          >
            <section
              className="reproduction-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recipient-form-title"
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowRecipientForm(false);
              }}
            >
              <div className="reproduction-dialog-header">
                <div>
                  <span className="eyebrow">Plantel reprodutivo</span>
                  <h2 id="recipient-form-title">Cadastrar receptora</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar formulário"
                  onClick={() => setShowRecipientForm(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={(event) => void handleCreateRecipient(event)}>
                <div className="cycle-form-grid">
                  <label className="cycle-form-field">
                    CTE/Haras
                    <input type="text" value={tenantName} disabled />
                  </label>
                  <label className="cycle-form-field">
                    Nome da receptora
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={recipientForm.nome}
                      onChange={(event) =>
                        setRecipientForm((current) => ({
                          ...current,
                          nome: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="cycle-form-field">
                    Registro da receptora (opcional)
                    <input
                      type="text"
                      maxLength={80}
                      value={recipientForm.registro_associacao}
                      onChange={(event) =>
                        setRecipientForm((current) => ({
                          ...current,
                          registro_associacao: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="cycle-form-field">
                    Local onde está a receptora (opcional)
                    <input
                      type="text"
                      maxLength={160}
                      value={recipientForm.localizacao}
                      onChange={(event) =>
                        setRecipientForm((current) => ({
                          ...current,
                          localizacao: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="reproduction-note">
                  A receptora será salva no cadastro de cavalos deste CTE/Haras.
                </p>
                <div className="reproduction-dialog-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setShowRecipientForm(false)}
                  >
                    Cancelar
                  </button>
                  <button className="button button-primary" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar receptora"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {selectedCycle && (
          <div
            className="reproduction-dialog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedCycle(null);
            }}
          >
            <section
              className="reproduction-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cycle-detail-title"
              onKeyDown={(event) => {
                if (event.key === "Escape") setSelectedCycle(null);
              }}
            >
              <div className="reproduction-dialog-header">
                <div>
                  <span className="eyebrow">Acompanhamento</span>
                  <h2 id="cycle-detail-title">Detalhes do ciclo</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar detalhes"
                  onClick={() => setSelectedCycle(null)}
                >
                  <X size={20} />
                </button>
              </div>
              <dl className="reproduction-details">
                <div><dt>Matriz</dt><dd>{selectedCycle.nome_matriz}</dd></div>
                <div>
                  <dt>Origem da matriz</dt>
                  <dd>{selectedCycle.matriz_origem === "INTERNO" ? "Interno" : "Externo"}</dd>
                </div>
                {selectedCycle.matriz_externa_registro && (
                  <div><dt>Registro da matriz</dt><dd>{selectedCycle.matriz_externa_registro}</dd></div>
                )}
                <div><dt>Garanhão</dt><dd>{selectedCycle.nome_garanhao}</dd></div>
                <div>
                  <dt>Origem do garanhão</dt>
                  <dd>{selectedCycle.garanhao_origem === "INTERNO" ? "Interno" : "Externo"}</dd>
                </div>
                {selectedCycle.garanhao_externo_registro && (
                  <div><dt>Registro do garanhão</dt><dd>{selectedCycle.garanhao_externo_registro}</dd></div>
                )}
                <div><dt>Receptora</dt><dd>{selectedCycle.nome_receptora ?? "Não se aplica"}</dd></div>
                {selectedCycle.localizacao_receptora && (
                  <div><dt>Local da receptora</dt><dd>{selectedCycle.localizacao_receptora}</dd></div>
                )}
                <div><dt>Tipo</dt><dd>{reproductionTypeLabel(selectedCycle.tipo)}</dd></div>
                <div><dt>Data da cobertura</dt><dd>{formatReproductionDate(selectedCycle.data_cobertura)}</dd></div>
                <div><dt>Horário</dt><dd>{selectedCycle.hora_cobertura ?? "—"}</dd></div>
                <div><dt>Veterinário</dt><dd>{selectedCycle.veterinario ?? "—"}</dd></div>
                <div><dt>Previsão de parto</dt><dd>{formatReproductionDate(selectedCycle.data_previsao_parto)}</dd></div>
                <div><dt>Data do parto</dt><dd>{formatReproductionDate(selectedCycle.data_parto_real)}</dd></div>
                <div><dt>Situação</dt><dd>{reproductionStatusLabel(selectedCycle.status)}</dd></div>
                <div className="reproduction-details-full">
                  <dt>Descrição</dt>
                  <dd>{selectedCycle.descricao ?? "—"}</dd>
                </div>
              </dl>
              <div className="reproduction-dialog-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setSelectedCycle(null)}
                >
                  Fechar
                </button>
              </div>
            </section>
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
          <label className="search-box">
            <Search size={20} />
            <span className="sr-only">Buscar cliente</span>
            <input
              placeholder="Buscar por nome, documento ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {canManageClients && (
            <button className="button button-primary" onClick={() => {
              setFeedback("");
              setClientForm(clientFormDefaults);
              setShowClientForm(true);
            }}>
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
                  {isAdmin && <th scope="col">CTE/Haras cadastrado</th>}
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.nome}</td>
                    <td>{client.telefone_whatsapp || "—"}</td>
                    <td>{client.data_inicio ? client.data_inicio.slice(0, 10).split("-").reverse().join("/") : "—"}</td>
                    <td>{client.numero_socio_abccmm ?? "—"}</td>
                    {isAdmin && (
                      <td>
                        {client.cte_haras_nome
                          ? `${client.cte_haras_tipo === "CTE" ? "CTE" : "Haras"} — ${client.cte_haras_nome}`
                          : "Sem vínculo CTE/Haras"}
                      </td>
                    )}
                    <td>
                      <div className="client-row-actions">
                        {canManageClients && (
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setFeedback("");
                              setClientForm({
                                ...client,
                                telefone_whatsapp: client.telefone_whatsapp ?? "",
                                documento: client.documento ?? "",
                                cpf: client.cpf ?? "",
                                rg: client.rg ?? "",
                                data_nascimento: client.data_nascimento ?? "",
                                idade: client.idade?.toString() ?? "",
                                profissao: client.profissao ?? "",
                                endereco_completo: client.endereco_completo ?? "",
                                numero_socio_abccmm: client.numero_socio_abccmm?.toString() ?? "",
                                data_inicio: client.data_inicio ?? "",
                                data_fim: client.data_fim ?? "",
                              });
                              setShowClientForm(true);
                            }}
                          >
                            Alterar
                          </button>
                        )}
                        {isAdmin && (
                          <button className="button button-quiet" onClick={() => void handleDeleteClient(client.id)}>
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
        return isAdmin ? (
          <AdminFinance
            configured={adminFinanceConfigured}
            needsMigration={adminFinanceNeedsMigration}
            demo={demo}
            entries={adminFinanceEntries}
            accounts={pixAccounts}
            tenants={managedTenants}
            registrations={adminFinanceRegistrations}
          />
        ) : renderFinance();
      case "admin":
        return renderAdmin();
      case "clients":
        return renderClients();
      case "products":
        return isAdmin || isClientAccount ? <Products canCreate={isClientAccount} demo={demo} centerId={providerCenterId}
          onCentersChange={setProviderCenters} onCenterChange={setProviderCenterId}
          supplierFilter={supplierFilter} onClearSupplier={() => setSupplierFilter(null)} /> : renderHome();
      case "suppliers":
        return isAdmin || isClientAccount ? (
          <Suppliers
            demo={demo}
            centerId={providerCenterId}
            onCentersChange={setProviderCenters}
            onCenterChange={setProviderCenterId}
            onViewProducts={(supplier) => { navigate("products"); setSupplierFilter(supplier); }}
          />
        ) : renderHome();
      case "providers":
        return isAdmin || isClientAccount ? (
          <ServiceProviders
            demo={demo}
            centerId={providerCenterId}
            onCentersChange={setProviderCenters}
            onCenterChange={setProviderCenterId}
          />
        ) : renderHome();
      case "employees":
        return isAdmin || isClientAccount ? (
          <Employees
            demo={demo}
            centerId={providerCenterId}
            onCentersChange={setProviderCenters}
            onCenterChange={setProviderCenterId}
          />
        ) : renderHome();
      case "cteHarasRegistrations":
        return isAdmin ? (
          <CteHarasRegistrations
            registrations={cteHarasRegistrations}
            tenants={managedTenants}
            tenantId={selectedTenantId}
            demo={demo}
            action={postDashboardAction}
          />
        ) : renderHome();
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
            <span>{role === "OPERACIONAL" ? "Equipe operacional" : role === "SUPER_ADMIN" ? "Super administrador" : isClientAccount ? `Acesso ${clientRegistrationType === "CTE" ? "CTE" : "Haras"}` : "Administrador"}</span>
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
            {(activeSection === "providers" || activeSection === "employees" || activeSection === "suppliers" || activeSection === "products") && !demo && (
              <label className="provider-center-selector">
                <span>Centro</span>
                <select
                  aria-label="Selecionar CTE ou Haras"
                  value={providerCenterId}
                  onChange={(event) => { setProviderCenterId(event.target.value); setSupplierFilter(null); }}
                  disabled={providerCenters.length === 0}
                >
                  {providerCenters.length === 0 && <option value="">Nenhum centro disponível</option>}
                  {providerCenters.map((center) => (
                    <option key={center.id} value={center.id}>{center.nome}</option>
                  ))}
                </select>
              </label>
            )}
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

      </div>

      {showHorseForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) closeHorseForm();
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
                disabled={isSaving}
                onClick={closeHorseForm}
              >
                <X size={22} />
              </button>
            </div>
            <form className="horse-form" onSubmit={(event) => void handleSaveHorse(event)}>
              {feedback && <p className="feedback-message" role="alert">{feedback}</p>}
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
              <input id="horse-photo" type="url" value={horsePhotoUrl} onChange={(event) => setHorsePhotoUrl(event.target.value)} maxLength={2000} placeholder="https://..." />
              <label htmlFor="horse-owner">Proprietário (opcional)</label>
              {isClientAccount ? (
                <select id="horse-owner" value={horseOwnerId} onChange={(event) => setHorseOwnerId(event.target.value)}>
                  {horseOwnerId === "unavailable" && <option value="unavailable" disabled>Selecione novamente o proprietário</option>}
                  <option value="">Sem proprietário selecionado</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
                </select>
              ) : (
                <input id="horse-owner" value={horseOwnerName} onChange={(event) => setHorseOwnerName(event.target.value)} maxLength={120} placeholder="Digite o nome do proprietário" />
              )}
              <label htmlFor="horse-trainer">Treinador (opcional)</label>
              <input id="horse-trainer" value={horseTrainerName} onChange={(event) => setHorseTrainerName(event.target.value)} maxLength={120} placeholder="Digite o nome do treinador" />
              <label htmlFor="horse-breeds">Raça(s), separadas por vírgula (opcional)</label>
              <input id="horse-breeds" value={horseBreeds} onChange={(event) => setHorseBreeds(event.target.value)} maxLength={500} placeholder="Ex.: Mangalarga Marchador" />
              <label htmlFor="horse-category">Categoria</label>
              <select id="horse-category" value={horseFormCategory} onChange={(event) => setHorseFormCategory(event.target.value)}>
                <option value="ATLETA">Atleta</option>
                <option value="MATRIZ">Matriz</option>
                <option value="GARANHAO">Garanhão</option>
                <option value="POTRO">Potro</option>
                <option value="RECEPTORA">Receptora</option>
              </select>
              <label htmlFor="horse-status">Status</label>
              <select id="horse-status" value={horseStatus} onChange={(event) => setHorseStatus(event.target.value)}>
                <option value="EM_TREINO">Em treino</option>
                <option value="EM_TRATAMENTO">Em tratamento</option>
                <option value="DESCANSO">Descanso</option>
              </select>
              <label htmlFor="horse-father">Nome do pai (opcional)</label>
              <input id="horse-father" value={horseFather} onChange={(event) => setHorseFather(event.target.value)} maxLength={120} placeholder="Digite o nome do pai" />
              <label htmlFor="horse-mother">Nome da mãe (opcional)</label>
              <input id="horse-mother" value={horseMother} onChange={(event) => setHorseMother(event.target.value)} maxLength={120} placeholder="Digite o nome da mãe" />
              <label htmlFor="horse-birth-date">Data de nascimento (opcional)</label>
              <input id="horse-birth-date" type="date" value={horseBirthDate} onChange={(event) => setHorseBirthDate(event.target.value)} />
              <label htmlFor="horse-registration">Número de registro ABCCMM (opcional)</label>
              <input id="horse-registration" value={horseRegistration} onChange={(event) => setHorseRegistration(event.target.value)} maxLength={80} />
              <label htmlFor="horse-sex">Sexo</label>
              <select id="horse-sex" value={horseSex} onChange={(event) => setHorseSex(event.target.value)}>
                <option value="INDEFINIDO">Não informado</option>
                <option value="MACHO">Macho</option>
                <option value="FEMEA">Fêmea</option>
              </select>
              <label htmlFor="horse-coat">Pelagem (opcional)</label>
              <select id="horse-coat" value={horseCoat} onChange={(event) => setHorseCoat(event.target.value)}>
                <option value="">Selecione</option>
                {horseCoatTypes.map((coat) => <option key={coat} value={coat}>{coat}</option>)}
              </select>
              <label htmlFor="horse-stable">Baia (opcional)</label>
              <input
                id="horse-stable"
                value={horseStable}
                onChange={(event) => setHorseStable(event.target.value)}
                maxLength={40}
                placeholder="Ex.: 04"
              />
              <label htmlFor="horse-chip">Chip / resenha (opcional)</label>
              <input id="horse-chip" value={horseChip} onChange={(event) => setHorseChip(event.target.value)} maxLength={120} />
              <label htmlFor="horse-feeding">Alimentação diária (opcional)</label>
              <textarea id="horse-feeding" value={horseFeeding} onChange={(event) => setHorseFeeding(event.target.value)} maxLength={1000} rows={3} />
              <label htmlFor="horse-monthly-fee">Mensalidade (R$)</label>
              <input id="horse-monthly-fee" type="number" min="0" max="9999999999.99" step="0.01" value={horseMonthlyFee} onChange={(event) => setHorseMonthlyFee(event.target.value)} />
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isSaving}
                  onClick={closeHorseForm}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={isSaving}>
                  <Plus size={19} /> {isSaving ? "Salvando..." : horseEditingId ? "Salvar alterações" : "Salvar cavalo"}
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
                <span className="eyebrow">{clientForm.id ? "Atualização cadastral" : "Novo cadastro"}</span>
                <h2 id="client-form-title">{clientForm.id ? "Editar cliente" : "Cadastrar cliente"}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setShowClientForm(false)}
              >
                <X size={22} />
              </button>
            </div>
            <form className="client-form" onSubmit={(event) => void (clientForm.id ? handleUpdateClient(event) : handleCreateClient(event))}>
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
                maxLength={14}
                inputMode="numeric"
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
                min="0"
                max="999999.99999"
                step="any"
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
              {feedback && <p className="client-form-error" role="alert">{feedback}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowClientForm(false)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={isSaving}>
                  <Plus size={19} /> {isSaving ? "Salvando..." : "Salvar cliente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}