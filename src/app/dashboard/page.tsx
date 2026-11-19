import { redirect } from "next/navigation";
import { Dashboard } from "@/app/dashboard";
import type { AdminFinanceEntry, AdminFinanceRegistration } from "@/app/admin-finance";
import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";
import {
  getAdminFinancePool,
  getPool,
  isAdminFinanceDatabaseConfigured,
  isDatabaseConfigured,
} from "@/lib/db";

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

type CteHarasRegistration = BillingOwner & {
  tipo_cadastro: "CTE" | "HARAS";
  login_email?: string | null;
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
  proprietario_id?: string | null;
  cliente_nome?: string | null;
  tenant_id?: string | null;
  tenant_nome?: string | null;
  plano?: string | null;
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
    nome_pai: null,
    nome_mae: null,
    data_nascimento: null,
    registro_associacao: null,
    sexo: "INDEFINIDO",
    pelagem: null,
  },
  {
    id: "demo-2",
    nome: "Sertão",
    baia: "07",
    raca: ["Mangalarga Marchador"],
    categoria: "ATLETA",
    status: "EM_TRATAMENTO",
    nome_pai: null,
    nome_mae: null,
    data_nascimento: null,
    registro_associacao: null,
    sexo: "INDEFINIDO",
    pelagem: null,
  },
  {
    id: "demo-3",
    nome: "Lua Serena",
    baia: "02",
    raca: ["Crioulo"],
    categoria: "MATRIZ",
    status: "DESCANSO",
    nome_pai: null,
    nome_mae: null,
    data_nascimento: null,
    registro_associacao: null,
    sexo: "INDEFINIDO",
    pelagem: null,
  },
  {
    id: "demo-4",
    nome: "Trovão do Vale",
    baia: "10",
    raca: ["Quarto de Milha"],
    categoria: "GARANHAO",
    status: "DESCANSO",
    nome_pai: null,
    nome_mae: null,
    data_nascimento: null,
    registro_associacao: null,
    sexo: "INDEFINIDO",
    pelagem: null,
  },
  {
    id: "demo-5",
    nome: "Brisa Clara",
    baia: "12",
    raca: ["Crioulo"],
    categoria: "RECEPTORA",
    status: "DESCANSO",
    nome_pai: null,
    nome_mae: null,
    data_nascimento: null,
    registro_associacao: null,
    sexo: "INDEFINIDO",
    pelagem: null,
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string | string[] }>;
}) {
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
        adminFinanceConfigured={false}
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

  const isGlobalAdmin = user.perfil === "ADMIN";
  let tenantId: string;
  let tenantName: string;
  let tenantPlan: string;
  let managedTenants: TenantRecord[] = [];

  if (isGlobalAdmin) {
    const tenants = await pool.query<TenantRecord>(
      `select id, nome, plano, status_assinatura
       from public.tenants
       order by nome`,
    );
    managedTenants = tenants.rows;
    const params = await searchParams;
    const requestedTenantId =
      typeof params.tenantId === "string" ? params.tenantId : null;
    const selectedTenant =
      tenants.rows.find((tenant) => tenant.id === requestedTenantId) ??
      tenants.rows[0];
    if (!selectedTenant) {
      return (
        <SetupNotice
          title="Nenhum CTE ou Haras cadastrado."
          message="Cadastre um tenant para começar a administrar os módulos operacionais."
        />
      );
    }
    if (requestedTenantId !== selectedTenant.id) {
      redirect(`/dashboard?tenantId=${encodeURIComponent(selectedTenant.id)}`);
    }
    tenantId = selectedTenant.id;
    tenantName = selectedTenant.nome;
    tenantPlan = selectedTenant.plano;
  } else {
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
    tenantId = user.tenant_id;
    tenantName = user.tenant_nome;
    tenantPlan = user.plano;
  }

  if (user.perfil === "CLIENTE") {
    if (!user.cadastro_cte_haras_id || !user.tipo_cadastro) {
      return (
        <SetupNotice
          title="Seu acesso ainda não está vinculado ao cadastro."
          message="Peça ao administrador para concluir a vinculação do seu CTE/Haras."
        />
      );
    }

    const [
      horseResult,
      clientResult,
      accountResult,
      financeCountResult,
      financeResult,
    ] = await Promise.all([
      pool.query<HorseRecord>(
        `select e.id, e.proprietario_id, e.nome, e.baia, e.raca, e.categoria, e.status,
                  e.nome_pai, e.nome_mae,
                  e.data_nascimento::text as data_nascimento,
                  e.registro_associacao, e.sexo, e.pelagem, e.foto_url,
                  e.nome_proprietario, e.nome_treinador,
                  e.chip_resenha, e.alimentacao_diaria,
                  e.valor_mensalidade::double precision as valor_mensalidade,
                  e.created_at::text as created_at
           from public.equinos as e
           where e.tenant_id = $1 and e.criado_por = $2 and e.excluido_em is null
           order by e.nome
           limit 100`,
        [user.tenant_id, user.id],
      ),
      pool.query<BillingOwner>(
        `select id, nome, telefone_whatsapp, documento, cpf, rg,
                  data_nascimento::text as data_nascimento, idade, profissao,
                  endereco_completo, numero_socio_abccmm,
                  data_inicio::text as data_inicio, data_fim::text as data_fim
           from public.proprietarios
           where tenant_id = $1 and criado_por = $2
           order by nome`,
        [user.tenant_id, user.id],
      ),
      pool.query<PixAccount>(
        `select id, nome, chave_pix, saldo_atual::double precision as saldo_atual
         from public.contas_bancarias
         where tenant_id = $1
         order by nome`,
        [user.tenant_id],
      ),
      pool.query<{ count: string }>(
        `select count(*)::text as count
         from public.financeiro_lancamentos
         where tenant_id = $1 and criado_por = $2 and excluido_em is null
           and status in ('PENDENTE', 'ATRASADO')`,
        [user.tenant_id, user.id],
      ),
      pool.query<FinanceEntry>(
        `select f.id, f.proprietario_id, p.nome as cliente_nome,
               f.descricao, f.valor::double precision as valor,
                f.data_vencimento::text as data_vencimento,
               f.competencia::text as competencia, f.natureza, f.categoria, f.status,
               comprovante.id as comprovante_id,
               comprovante.nome_original as comprovante_nome
         from public.financeiro_lancamentos as f
         join public.proprietarios as p
           on p.id = f.proprietario_id and p.tenant_id = f.tenant_id
              and p.criado_por = f.criado_por
         left join lateral (
           select a.id, a.nome_original
           from public.arquivos as a
           where a.lancamento_id = f.id and a.tenant_id = f.tenant_id
           order by a.created_at desc
           limit 1
         ) as comprovante on true
         where f.tenant_id = $1 and f.criado_por = $2 and f.excluido_em is null
         order by f.data_vencimento, f.created_at desc
         `,
        [user.tenant_id, user.id],
      ),
    ]);

    return (
      <Dashboard
        demo={false}
        role={user.perfil}
        clientRegistrationType={user.tipo_cadastro}
        plan={tenantPlan}
        tenantName={tenantName}
        horses={horseResult.rows}
        clients={clientResult.rows.map((client) => ({
          ...client,
          numero_socio_abccmm:
            client.numero_socio_abccmm === null
              ? null
              : Number(client.numero_socio_abccmm),
        }))}
        billingOwners={clientResult.rows}
        pixAccounts={accountResult.rows}
        pendingFinanceCount={Number(financeCountResult.rows[0]?.count ?? 0)}
        financeEntries={financeResult.rows}
      />
    );
  }

  const isManager = user.perfil === "ADMIN";
  const adminFinanceConfigured =
    isManager && isAdminFinanceDatabaseConfigured();
  const adminFinancePool = adminFinanceConfigured
    ? getAdminFinancePool()
    : null;
  const adminFinanceNeedsMigration = adminFinancePool
    ? Number((await adminFinancePool.query<{ count: string }>(
        `select count(*)::text as count
         from information_schema.columns
         where table_schema = 'public' and table_name = 'lancamentos_financeiro_admin'
           and column_name in ('cadastro_cte_haras_id', 'cadastro_cte_haras_nome',
                               'cadastro_cte_haras_tipo', 'conta_informada')`,
      )).rows[0].count) !== 4
    : false;
  const clientsSelect = `select id, nome, telefone_whatsapp, documento, cpf, rg,
                                data_nascimento::text as data_nascimento, idade, profissao,
                                endereco_completo, numero_socio_abccmm,
                                data_inicio::text as data_inicio, data_fim::text as data_fim
                         from public.proprietarios`;
  const ownerResultQuery =
    user.perfil === "ADMIN"
      ? pool.query<BillingOwner>(
          `select p.id, p.nome, p.telefone_whatsapp, p.documento, p.cpf, p.rg,
                  p.data_nascimento::text as data_nascimento, p.idade, p.profissao,
                  p.endereco_completo, p.numero_socio_abccmm,
                  p.data_inicio::text as data_inicio, p.data_fim::text as data_fim,
                  c.nome as cte_haras_nome, c.tipo_cadastro as cte_haras_tipo
           from public.proprietarios as p
           left join public.usuarios as creator
             on creator.id = p.criado_por and creator.tenant_id = p.tenant_id
           left join public.cadastros_cte_haras as c
             on c.id = creator.cadastro_cte_haras_id and c.tenant_id = p.tenant_id
           where p.tenant_id = $1
           order by p.nome`,
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
          `select c.id, c.tipo_cadastro, c.nome, c.telefone_whatsapp, c.documento,
                  c.cpf, c.rg, c.data_nascimento::text as data_nascimento, c.idade,
                  c.profissao, c.endereco_completo, c.numero_socio_abccmm,
                  c.data_inicio::text as data_inicio, c.data_fim::text as data_fim,
                  u.email as login_email
           from public.cadastros_cte_haras c
           left join public.usuarios u
             on u.cadastro_cte_haras_id = c.id and u.tenant_id = c.tenant_id
           where c.tenant_id = $1
           order by c.nome`,
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
    adminFinanceRegistrationsResult,
    accountResult,
    financeCountResult,
    financeResult,
    cycleCountResult,
    cyclesResult,
  ] = await Promise.all([
    pool.query<HorseRecord>(
      `select e.id, e.proprietario_id, e.nome, e.baia, e.raca, e.categoria, e.status,
              e.nome_pai, e.nome_mae,
              e.data_nascimento::text as data_nascimento,
              e.registro_associacao, e.sexo, e.pelagem, e.foto_url,
              e.nome_proprietario, e.nome_treinador,
              e.chip_resenha, e.alimentacao_diaria,
              e.valor_mensalidade::double precision as valor_mensalidade,
              e.created_at::text as created_at,
              c.nome as cte_haras_nome, c.tipo_cadastro as cte_haras_tipo
       from public.equinos as e
       left join public.usuarios as creator
         on $2::boolean and creator.id = e.criado_por and creator.tenant_id = e.tenant_id
       left join public.cadastros_cte_haras as c
         on c.id = creator.cadastro_cte_haras_id and c.tenant_id = e.tenant_id
       where e.tenant_id = $1 and e.excluido_em is null
         and ($2::boolean or e.criado_por = $3)
       order by e.nome
       limit 100`,
      [tenantId, isManager, user.id],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count
       from public.medicamentos_aplicacoes as ma
       join public.tratamentos_medicamentos as tm
         on tm.id = ma.tratamento_id and tm.tenant_id = ma.tenant_id
       join public.equinos as e
         on e.id = tm.equino_id and e.tenant_id = tm.tenant_id
       where ma.tenant_id = $1 and ma.status = 'PENDENTE'
         and ($2::boolean or e.criado_por = $3)`,
      [tenantId, isManager, user.id],
    ),
    pool.query<MedicationApplication & { data_hora_prevista: Date }>(
      `select ma.id, ma.data_hora_prevista, tm.descricao, e.nome as nome_equino
       from public.medicamentos_aplicacoes as ma
       join public.tratamentos_medicamentos as tm
         on tm.id = ma.tratamento_id and tm.tenant_id = ma.tenant_id
       join public.equinos as e
         on e.id = tm.equino_id and e.tenant_id = tm.tenant_id
       where ma.tenant_id = $1 and ma.status = 'PENDENTE'
         and ($2::boolean or e.criado_por = $3)
       order by ma.data_hora_prevista
       limit 12`,
      [tenantId, isManager, user.id],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as count
       from public.agenda_treinos as at
       join public.equinos as e
         on e.id = at.equino_id and e.tenant_id = at.tenant_id
       where at.tenant_id = $1 and at.data_hora >= $2 and at.data_hora < $3
         and ($4::boolean or e.criado_por = $5)`,
      [tenantId, dayStart.toISOString(), dayEnd.toISOString(), isManager, user.id],
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
         and ($4::boolean or e.criado_por = $5)
       order by at.data_hora
       limit 20`,
      [tenantId, dayStart.toISOString(), dayEnd.toISOString(), isManager, user.id],
    ),
    ownerResultQuery,
    cteHarasRegistrationsQuery,
    adminFinancePool
      ? pool.query<AdminFinanceRegistration>(
          `select c.id, c.nome, c.tipo_cadastro, c.tenant_id, t.nome as tenant_nome
           from public.cadastros_cte_haras as c
           join public.usuarios as creator on creator.id = c.criado_por and creator.perfil = 'ADMIN'
           join public.tenants as t on t.id = c.tenant_id
           where c.tipo_cadastro in ('CTE', 'HARAS')
           order by c.nome, c.id`,
        )
      : Promise.resolve({ rows: [] as AdminFinanceRegistration[] }),
    isManager
      ? adminFinancePool
        ? adminFinancePool.query<PixAccount>(
            `select id, nome, chave_pix, saldo_atual::double precision as saldo_atual
             from public.contas_financeiro_admin
             where ativo
             order by nome`,
          )
        : Promise.resolve({ rows: [] as PixAccount[] })
      : Promise.resolve({ rows: [] as PixAccount[] }),
    isManager
      ? adminFinancePool
        ? adminFinancePool.query<{ count: string }>(
            `select count(*)::text as count
             from public.lancamentos_financeiro_admin
             where criado_por = $1 and excluido_em is null and status in ('PENDENTE', 'ATRASADO')`,
            [user.id],
          )
        : Promise.resolve({ rows: [{ count: "0" }] })
      : Promise.resolve({ rows: [{ count: "0" }] }),
    isManager
      ? adminFinancePool
        ? !adminFinanceNeedsMigration
          ? adminFinancePool.query<AdminFinanceEntry>(
            `select id, conta_id, conta_informada, tenant_id, tenant_nome, plano,
                    cadastro_cte_haras_id, cadastro_cte_haras_nome, cadastro_cte_haras_tipo, descricao,
                    valor::double precision as valor,
                    data_vencimento::text as data_vencimento,
                    data_pagamento::text as data_pagamento,
                    competencia::text as competencia, natureza, categoria, status
             from public.lancamentos_financeiro_admin
             where criado_por = $1 and excluido_em is null
             order by data_vencimento, criado_em desc`,
            [user.id],
          )
          : Promise.resolve({ rows: [] as AdminFinanceEntry[] })
        : Promise.resolve({ rows: [] as AdminFinanceEntry[] })
      : Promise.resolve({ rows: [] as AdminFinanceEntry[] }),
    tenantPlan === "HARAS" && isManager
      ? pool.query<{ count: string }>(
          `select count(*)::text as count
           from public.reproducao_ciclos
           where tenant_id = $1`,
          [tenantId],
        )
      : Promise.resolve({ rows: [{ count: "0" }] }),
    tenantPlan === "HARAS" && isManager
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
      clientRegistrationType={user.tipo_cadastro}
      plan={tenantPlan}
      tenantName={tenantName}
      globalAdmin={isGlobalAdmin}
      selectedTenantId={tenantId}
      managedTenants={managedTenants}
      horses={horses}
      medicationApplications={medicationApplications}
      todayTrainings={todayTrainings}
      pendingMedicationCount={Number(medicationCountResult.rows[0]?.count ?? 0)}
      todayTrainingCount={Number(trainingCountResult.rows[0]?.count ?? 0)}
      pendingFinanceCount={Number(financeCountResult.rows[0]?.count ?? 0)}
      adminFinanceConfigured={adminFinanceConfigured}
      adminFinanceNeedsMigration={adminFinanceNeedsMigration}
      adminFinanceEntries={financeResult.rows}
      adminFinanceRegistrations={adminFinanceRegistrationsResult.rows}
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
