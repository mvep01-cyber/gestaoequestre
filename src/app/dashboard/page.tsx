import { redirect } from "next/navigation";
import { Dashboard } from "@/app/dashboard";
import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import { getPool, isDatabaseConfigured } from "@/lib/db";

type HorseRecord = {
  id: string;
  nome: string;
  baia: string | null;
  raca: string[];
  categoria: string;
  status: string;
};

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

type CteHarasRegistration = BillingOwner & {
  tipo_cadastro: "CTE" | "HARAS";
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

const demoHorses: HorseRecord[] = [
  {
    id: "demo-1",
    nome: "Estrela do Campo",
    baia: "04",
    raca: ["Quarto de Milha"],
    categoria: "ATLETA",
    status: "EM_TREINO",
  },
  {
    id: "demo-2",
    nome: "Sertão",
    baia: "07",
    raca: ["Mangalarga Marchador"],
    categoria: "ATLETA",
    status: "EM_TRATAMENTO",
  },
  {
    id: "demo-3",
    nome: "Lua Serena",
    baia: "02",
    raca: ["Crioulo"],
    categoria: "MATRIZ",
    status: "DESCANSO",
  },
  {
    id: "demo-4",
    nome: "Trovão do Vale",
    baia: "10",
    raca: ["Quarto de Milha"],
    categoria: "GARANHAO",
    status: "DESCANSO",
  },
  {
    id: "demo-5",
    nome: "Brisa Clara",
    baia: "12",
    raca: ["Crioulo"],
    categoria: "RECEPTORA",
    status: "DESCANSO",
  },
];

const demoCycles: ReproductionCycle[] = [
  {
    id: "demo-cycle-1",
    tipo: "MONTA",
    garanhao_id: "demo-4",
    matriz_id: "demo-3",
    receptora_id: null,
    data_cobertura: "2026-10-15",
    status: "PRENHE",
    data_previsao_parto: "2027-08-20",
    data_parto_real: null,
    potro_gerado_id: null,
    nome_garanhao: "Trovão do Vale",
    nome_matriz: "Lua Serena",
  },
];

export const instant = false;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function SetupNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="setup-notice">
      <div className="setup-card">
        <span className="eyebrow">Configuração necessária</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function DashboardPage() {
  if (!isDatabaseConfigured()) {
    return (
      <Dashboard
        demo
        role="ADMIN"
        plan="HARAS"
        tenantName="Haras demonstração"
        horses={demoHorses}
        pendingMedicationCount={2}
        todayTrainingCount={3}
        pendingFinanceCount={4}
        breedingCount={demoCycles.length}
        reproductionCycles={demoCycles}
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const pool = getPool();

  if (user.perfil === "SUPER_ADMIN") {
    const tenants = await pool.query<TenantRecord>(
      `select id, nome, plano, status_assinatura
       from public.tenants
       order by nome`,
    );

    return (
      <Dashboard
        demo={false}
        role={user.perfil}
        plan="CTE"
        tenantName="Campo Vivo | Administração"
        horses={[]}
        managedTenants={tenants.rows}
      />
    );
  }

  if (!user.tenant_id || !user.tenant_nome || !user.plano) {
    return (
      <SetupNotice
        title="Seu usuário ainda não está vinculado a um centro."
        message="Peça ao administrador para conferir o cadastro do seu usuário."
      />
    );
  }

  if (!isTenantAvailable(user)) {
    return (
      <SetupNotice
        title="A assinatura está bloqueada."
        message="Fale com o responsável pelo seu centro para liberar o acesso."
      />
    );
  }

  const tenantId = user.tenant_id;
  const isManager = user.perfil !== "OPERACIONAL";
  const clientsSelect = `select id, nome, telefone_whatsapp, documento, cpf, rg,
                                data_nascimento::text as data_nascimento, idade, profissao,
                                endereco_completo, numero_socio_abccmm,
                                data_inicio::text as data_inicio, data_fim::text as data_fim
                         from public.proprietarios`;
  const ownerResultQuery =
    user.perfil === "ADMIN"
      ? pool.query<BillingOwner>(
          `${clientsSelect}
           where tenant_id = $1
           order by nome`,
          [tenantId],
        )
      : pool.query<BillingOwner>(
          `${clientsSelect}
           where tenant_id = $1 and criado_por = $2
           order by nome`,
          [tenantId, user.id],
        );
  const cteHarasRegistrationsQuery =
    user.perfil === "ADMIN"
      ? pool.query<CteHarasRegistration>(
          `select id, tipo_cadastro, nome, telefone_whatsapp, documento, cpf, rg,
                  data_nascimento::text as data_nascimento, idade, profissao,
                  endereco_completo, numero_socio_abccmm,
                  data_inicio::text as data_inicio, data_fim::text as data_fim
           from public.cadastros_cte_haras
           where tenant_id = $1
           order by nome`,
          [tenantId],
        )
      : Promise.resolve({ rows: [] as CteHarasRegistration[] });
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dayStart = new Date(`${localDay}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [
    horseResult,
    medicationCountResult,
    applicationsResult,
    trainingCountResult,
    trainingsResult,
    ownerResult,
    cteHarasRegistrationsResult,
    accountResult,
    financeCountResult,
    financeResult,
    cycleCountResult,
    cyclesResult,
  ] = await Promise.all([
    pool.query<HorseRecord>(
      `select id, nome, baia, raca, categoria, status
       from public.equinos
       where tenant_id = $1
       order by nome
       limit 100`,
      [tenantId],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count
       from public.medicamentos_aplicacoes
       where tenant_id = $1 and status = 'PENDENTE'`,
      [tenantId],
    ),
    pool.query<MedicationApplication & { data_hora_prevista: Date }>(
      `select ma.id, ma.data_hora_prevista, tm.descricao, e.nome as nome_equino
       from public.medicamentos_aplicacoes as ma
       join public.tratamentos_medicamentos as tm
         on tm.id = ma.tratamento_id and tm.tenant_id = ma.tenant_id
       join public.equinos as e
         on e.id = tm.equino_id and e.tenant_id = tm.tenant_id
       where ma.tenant_id = $1 and ma.status = 'PENDENTE'
       order by ma.data_hora_prevista
       limit 12`,
      [tenantId],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count
       from public.agenda_treinos
       where tenant_id = $1 and data_hora >= $2 and data_hora < $3`,
      [tenantId, dayStart.toISOString(), dayEnd.toISOString()],
    ),
    pool.query<
      TrainingSession & {
        data_hora: Date;
      }
    >(
      `select at.id, at.data_hora, at.tipo_atividade, at.status, e.nome as nome_equino
       from public.agenda_treinos as at
       join public.equinos as e
         on e.id = at.equino_id and e.tenant_id = at.tenant_id
       where at.tenant_id = $1 and at.data_hora >= $2 and at.data_hora < $3
       order by at.data_hora
       limit 20`,
      [tenantId, dayStart.toISOString(), dayEnd.toISOString()],
    ),
    ownerResultQuery,
    cteHarasRegistrationsQuery,
    isManager
      ? pool.query<PixAccount & { saldo_atual: string }>(
          `select id, nome, chave_pix, saldo_atual
           from public.contas_bancarias
           where tenant_id = $1
           order by nome`,
          [tenantId],
        )
      : Promise.resolve({ rows: [] } as { rows: PixAccount[] }),
    isManager
      ? pool.query<{ count: string }>(
          `select count(*)::text as count
           from public.financeiro_lancamentos
           where tenant_id = $1 and status in ('PENDENTE', 'ATRASADO')`,
          [tenantId],
        )
      : Promise.resolve({ rows: [{ count: "0" }] }),
    isManager
      ? pool.query<FinanceEntry & { valor: string }>(
          `select id, descricao, valor, data_vencimento, natureza, categoria, status
           from public.financeiro_lancamentos
           where tenant_id = $1 and status in ('PENDENTE', 'ATRASADO')
           order by data_vencimento
           limit 30`,
          [tenantId],
        )
      : Promise.resolve({ rows: [] } as { rows: FinanceEntry[] }),
    user.plano === "HARAS" && isManager
      ? pool.query<{ count: string }>(
          `select count(*)::text as count
           from public.reproducao_ciclos
           where tenant_id = $1`,
          [tenantId],
        )
      : Promise.resolve({ rows: [{ count: "0" }] }),
    user.plano === "HARAS" && isManager
      ? pool.query<ReproductionCycle & { data_cobertura: string }>(
          `select
             rc.id, rc.tipo, rc.garanhao_id, rc.matriz_id, rc.receptora_id,
             rc.data_cobertura, rc.status, rc.data_previsao_parto,
             rc.data_parto_real, rc.potro_gerado_id,
             garanhao.nome as nome_garanhao, matriz.nome as nome_matriz
           from public.reproducao_ciclos as rc
           join public.equinos as garanhao
             on garanhao.id = rc.garanhao_id and garanhao.tenant_id = rc.tenant_id
           join public.equinos as matriz
             on matriz.id = rc.matriz_id and matriz.tenant_id = rc.tenant_id
           where rc.tenant_id = $1
           order by rc.data_cobertura desc
           limit 30`,
          [tenantId],
        )
      : Promise.resolve({ rows: [] } as { rows: ReproductionCycle[] }),
  ]);

  const horses = horseResult.rows;
  const todayTrainings = trainingsResult.rows.map((row) => ({
    ...row,
    data_hora: toIso(row.data_hora),
  }));
  const medicationApplications = applicationsResult.rows.map((row) => ({
    ...row,
    data_hora_prevista: toIso(row.data_hora_prevista),
  }));

  return (
    <Dashboard
      demo={false}
      role={user.perfil}
      plan={user.plano}
      tenantName={user.tenant_nome}
      horses={horses}
      medicationApplications={medicationApplications}
      todayTrainings={todayTrainings}
      pendingMedicationCount={Number(medicationCountResult.rows[0]?.count ?? 0)}
      todayTrainingCount={Number(trainingCountResult.rows[0]?.count ?? 0)}
      pendingFinanceCount={Number(financeCountResult.rows[0]?.count ?? 0)}
      breedingCount={Number(cycleCountResult.rows[0]?.count ?? 0)}
      billingOwners={isManager ? ownerResult.rows : []}
      pixAccounts={accountResult.rows.map((row) => ({
        ...row,
        saldo_atual: Number(row.saldo_atual),
      }))}
      financeEntries={financeResult.rows.map((row) => ({
        ...row,
        valor: Number(row.valor),
      }))}
      reproductionCycles={cyclesResult.rows}
      clients={ownerResult.rows.map((owner) => ({
        ...owner,
        numero_socio_abccmm:
          owner.numero_socio_abccmm === null
            ? null
            : Number(owner.numero_socio_abccmm),
      }))}
      cteHarasRegistrations={cteHarasRegistrationsResult.rows.map((registration) => ({
        ...registration,
        numero_socio_abccmm:
            registration.numero_socio_abccmm === null
              ? null
              : Number(registration.numero_socio_abccmm),
      }))}
    />
  );
}
