create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  plano text not null default 'CTE' check (plano in ('CTE', 'HARAS')),
  status_assinatura text not null default 'TRIAL'
    check (status_assinatura in ('TRIAL', 'ATIVO', 'BLOQUEADO')),
  gateway_api_key text,
  created_at timestamptz not null default now(),
  unique (id, plano)
);

comment on column public.tenants.gateway_api_key is
  'Segredo de integração; nunca retornar este valor ao cliente.';

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  senha_hash text not null,
  tenant_id uuid references public.tenants (id) on delete cascade,
  nome text not null,
  telefone text,
  perfil text not null check (perfil in ('SUPER_ADMIN', 'ADMIN', 'OPERACIONAL', 'CLIENTE')),
  percentual_comissao_padrao numeric(5, 2) not null default 0
    check (percentual_comissao_padrao between 0 and 100),
  check (
    (perfil = 'SUPER_ADMIN' and tenant_id is null)
    or (perfil <> 'SUPER_ADMIN' and tenant_id is not null)
  ),
  unique (id, tenant_id)
);

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_email_time_idx
  on public.login_attempts (email_hash, attempted_at desc);
create index if not exists login_attempts_time_idx
  on public.login_attempts (attempted_at);

create unique index if not exists usuarios_email_lower_unique
  on public.usuarios (lower(email));

create table if not exists public.proprietarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  criado_por uuid references public.usuarios (id) on delete set null,
  nome text not null,
  telefone_whatsapp text,
  documento text,
  dia_vencimento_padrao smallint check (dia_vencimento_padrao between 1 and 31),
  unique (id, tenant_id)
);

alter table if exists public.proprietarios
  add column if not exists criado_por uuid references public.usuarios (id) on delete set null,
  add column if not exists cpf text,
  add column if not exists rg text,
  add column if not exists data_nascimento date,
  add column if not exists idade integer,
  add column if not exists profissao text,
  add column if not exists endereco_completo text,
  add column if not exists numero_socio_abccmm numeric(12, 5),
  add column if not exists data_inicio date,
  add column if not exists data_fim date;

create index if not exists proprietarios_tenant_creator_idx
  on public.proprietarios (tenant_id, criado_por);
create unique index if not exists proprietarios_id_tenant_creator_unique
  on public.proprietarios (id, tenant_id, criado_por);

create table if not exists public.cadastros_cte_haras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  criado_por uuid references public.usuarios (id) on delete set null,
  tipo_cadastro text not null check (tipo_cadastro in ('CTE', 'HARAS')),
  nome text not null,
  telefone_whatsapp text not null,
  documento text not null,
  cpf text not null,
  rg text not null,
  data_nascimento date not null,
  idade integer not null,
  profissao text not null,
  endereco_completo text not null,
  numero_socio_abccmm numeric(12, 5) not null
    check (numero_socio_abccmm between 0 and 999999.99999),
  data_inicio date not null,
  data_fim date not null,
  unique (id, tenant_id)
);

create index if not exists cadastros_cte_haras_tenant_nome_idx
  on public.cadastros_cte_haras (tenant_id, nome);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cadastro_cte_haras_id uuid not null,
  criado_por uuid references public.usuarios (id) on delete set null,
  nome text not null,
  codigo text not null,
  marca text not null default '',
  fabricante text not null default '',
  descricao text not null default '',
  valor numeric(12, 2) not null check (valor >= 0),
  data_inicio date not null,
  data_fim date not null,
  created_at timestamptz not null default now(),
  foreign key (cadastro_cte_haras_id, tenant_id)
    references public.cadastros_cte_haras (id, tenant_id) on delete cascade,
  check (data_inicio <= data_fim),
  unique (cadastro_cte_haras_id, codigo, data_inicio)
);

alter table if exists public.usuarios
  add column if not exists cadastro_cte_haras_id uuid;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_perfil_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios drop constraint usuarios_perfil_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_perfil_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_perfil_check
      check (perfil in ('SUPER_ADMIN', 'ADMIN', 'OPERACIONAL', 'CLIENTE'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_cadastro_cte_haras_tenant_fk'
      and conrelid = 'public.usuarios'::regclass
      and confdeltype <> 'c'
  ) then
    alter table public.usuarios
      drop constraint usuarios_cadastro_cte_haras_tenant_fk;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_cadastro_cte_haras_tenant_fk'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_cadastro_cte_haras_tenant_fk
      foreign key (cadastro_cte_haras_id, tenant_id)
      references public.cadastros_cte_haras (id, tenant_id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_cadastro_cliente_link_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_cadastro_cliente_link_check check (
        (perfil = 'CLIENTE' and cadastro_cte_haras_id is not null)
        or (perfil <> 'CLIENTE' and cadastro_cte_haras_id is null)
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_cadastro_cliente_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_cadastro_cliente_check check (
        (perfil = 'SUPER_ADMIN' and tenant_id is null)
        or (perfil <> 'SUPER_ADMIN' and tenant_id is not null)
      );
  end if;
end
$$;

create table if not exists public.equinos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  criado_por uuid references public.usuarios (id) on delete set null,
  proprietario_id uuid,
  treinador_id uuid,
  nome text not null,
  foto_url text,
  baia text,
  raca text[] not null default '{}',
  sexo text not null default 'INDEFINIDO'
    check (sexo in ('MACHO', 'FEMEA', 'INDEFINIDO')),
  data_nascimento date,
  nome_pai text,
  nome_mae text,
  pelagem text,
  origem text not null default 'TERCEIRO' check (origem in ('PROPRIO', 'TERCEIRO')),
  categoria text not null default 'ATLETA'
    check (categoria in ('ATLETA', 'MATRIZ', 'GARANHAO', 'POTRO', 'RECEPTORA')),
  status text not null default 'DESCANSO'
    check (status in ('EM_TREINO', 'EM_TRATAMENTO', 'DESCANSO')),
  registro_associacao text,
  excluido_em timestamptz,
  chip_resenha text,
  pai_id uuid,
  mae_id uuid,
  alimentacao_diaria text,
  valor_mensalidade numeric(12, 2) not null default 0 check (valor_mensalidade >= 0),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint equinos_proprietario_tenant_fk
    foreign key (proprietario_id, tenant_id)
    references public.proprietarios (id, tenant_id),
  constraint equinos_treinador_tenant_fk
    foreign key (treinador_id, tenant_id)
    references public.usuarios (id, tenant_id),
  constraint equinos_pai_tenant_fk
    foreign key (pai_id, tenant_id)
    references public.equinos (id, tenant_id),
  constraint equinos_mae_tenant_fk
    foreign key (mae_id, tenant_id)
    references public.equinos (id, tenant_id)
);

create table if not exists public.equinos_produtos (
  equino_id uuid not null,
  tenant_id uuid not null,
  categoria text not null check (categoria in ('feno', 'racao', 'baia', 'outros')),
  produto_id uuid references public.produtos (id) on delete set null,
  produto_codigo text,
  produto_cadastro_id uuid,
  primary key (equino_id, categoria),
  foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id) on delete cascade
);

alter table public.equinos_produtos
  add column if not exists produto_codigo text,
  add column if not exists produto_cadastro_id uuid;

update public.equinos_produtos ep
set produto_codigo = p.codigo, produto_cadastro_id = p.cadastro_cte_haras_id
from public.produtos p
where p.id = ep.produto_id
  and (ep.produto_codigo is null or ep.produto_cadastro_id is null);

alter table public.equinos
  add column if not exists criado_por uuid references public.usuarios (id) on delete set null,
  add column if not exists nome_pai text,
  add column if not exists nome_mae text,
  add column if not exists nome_proprietario text,
  add column if not exists nome_treinador text,
  add column if not exists pelagem text,
  add column if not exists excluido_em timestamptz;

update public.equinos as e
set nome_proprietario = p.nome
from public.proprietarios as p
where p.id = e.proprietario_id
  and p.tenant_id = e.tenant_id
  and e.nome_proprietario is null;

update public.equinos as e
set nome_treinador = u.nome
from public.usuarios as u
where u.id = e.treinador_id
  and u.tenant_id = e.tenant_id
  and e.nome_treinador is null;

update public.equinos as e
set nome_pai = pai.nome
from public.equinos as pai
where pai.id = e.pai_id
  and pai.tenant_id = e.tenant_id
  and e.nome_pai is null;

update public.equinos as e
set nome_mae = mae.nome
from public.equinos as mae
where mae.id = e.mae_id
  and mae.tenant_id = e.tenant_id
  and e.nome_mae is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equinos_pelagem_check'
      and conrelid = 'public.equinos'::regclass
  ) then
    alter table public.equinos
      add constraint equinos_pelagem_check check (
        pelagem is null or pelagem in (
          'Branco', 'Preto', 'Alazão', 'Baio', 'Castanha', 'Tordilha', 'Rosilha',
          'Pampa de Preto', 'Pampa de Marrom', 'Pampa de Castanho', 'Pampa de Alazão'
        )
      ) not valid;
  end if;
end
$$;

create table if not exists public.reproducao_ciclos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipo text not null check (tipo in ('MONTA', 'INSEMINACAO', 'TE')),
  garanhao_id uuid not null,
  matriz_id uuid not null,
  receptora_id uuid,
  data_cobertura date not null,
  status text not null default 'AGUARDANDO_EXAME'
    check (status in ('AGUARDANDO_EXAME', 'PRENHE', 'VAZIA', 'PARIDA')),
  data_previsao_parto date,
  data_parto_real date,
  potro_gerado_id uuid,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint ciclos_garanhao_tenant_fk
    foreign key (garanhao_id, tenant_id) references public.equinos (id, tenant_id),
  constraint ciclos_matriz_tenant_fk
    foreign key (matriz_id, tenant_id) references public.equinos (id, tenant_id),
  constraint ciclos_receptora_tenant_fk
    foreign key (receptora_id, tenant_id) references public.equinos (id, tenant_id),
  constraint ciclos_potro_tenant_fk
    foreign key (potro_gerado_id, tenant_id) references public.equinos (id, tenant_id)
);

create table if not exists public.tratamentos_medicamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  equino_id uuid not null,
  tipo text not null
    check (tipo in ('MEDICAMENTO', 'VACINA', 'VERMIFUGO', 'VETERINARIO', 'FERRAGEAMENTO')),
  descricao text not null,
  dose_via text,
  data_inicio date not null,
  data_fim date,
  custo numeric(12, 2) not null default 0 check (custo >= 0),
  cobrar_proprietario boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint tratamentos_equino_tenant_fk
    foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id)
);

create table if not exists public.medicamentos_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tratamento_id uuid not null,
  data_hora_prevista timestamptz not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'APLICADO')),
  aplicado_por uuid,
  aplicado_em timestamptz,
  unique (id, tenant_id),
  constraint aplicacoes_tratamento_tenant_fk
    foreign key (tratamento_id, tenant_id)
    references public.tratamentos_medicamentos (id, tenant_id),
  constraint aplicacoes_usuario_tenant_fk
    foreign key (aplicado_por) references public.usuarios (id)
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'aplicacoes_usuario_tenant_fk'
      and conrelid = 'public.medicamentos_aplicacoes'::regclass
  ) then
    alter table public.medicamentos_aplicacoes
      drop constraint aplicacoes_usuario_tenant_fk;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'aplicacoes_usuario_fk'
      and conrelid = 'public.medicamentos_aplicacoes'::regclass
  ) then
    alter table public.medicamentos_aplicacoes
      add constraint aplicacoes_usuario_fk
      foreign key (aplicado_por) references public.usuarios (id);
  end if;
end
$$;

create table if not exists public.agenda_treinos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  equino_id uuid not null,
  treinador_id uuid,
  data_hora timestamptz not null,
  tipo_atividade text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONCLUIDO')),
  observacoes text,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint agenda_equino_tenant_fk
    foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id),
  constraint agenda_treinador_tenant_fk
    foreign key (treinador_id, tenant_id) references public.usuarios (id, tenant_id)
);

create table if not exists public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nome text not null,
  chave_pix text,
  saldo_atual numeric(14, 2) not null default 0,
  unique (id, tenant_id)
);

create table if not exists public.contratos_vendas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  criado_por uuid,
  tipo text not null check (tipo in ('COBERTURA', 'ANIMAL')),
  equino_id uuid not null,
  comprador_id uuid not null,
  vendedor_id uuid,
  percentual_comissao numeric(5, 2) not null default 0
    check (percentual_comissao between 0 and 100),
  valor_total numeric(12, 2) not null check (valor_total >= 0),
  qtd_parcelas integer not null check (qtd_parcelas > 0),
  data_primeira_parcela date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint contratos_equino_tenant_fk
    foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id),
  constraint contratos_comprador_tenant_fk
    foreign key (comprador_id, tenant_id) references public.proprietarios (id, tenant_id),
  constraint contratos_vendedor_tenant_fk
   foreign key (vendedor_id, tenant_id) references public.usuarios (id, tenant_id),
 constraint contratos_criador_tenant_fk
   foreign key (criado_por, tenant_id) references public.usuarios (id, tenant_id)
);

alter table public.contratos_vendas
 add column if not exists criado_por uuid;

do $$
begin
 if not exists (
   select 1
   from pg_constraint
   where conname = 'contratos_criador_tenant_fk'
     and conrelid = 'public.contratos_vendas'::regclass
 ) then
   alter table public.contratos_vendas
     add constraint contratos_criador_tenant_fk
     foreign key (criado_por, tenant_id) references public.usuarios (id, tenant_id);
 end if;
end
$$;

create table if not exists public.financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
 criado_por uuid,
  conta_bancaria_id uuid,
  equino_id uuid,
  proprietario_id uuid,
  contrato_venda_id uuid,
  comissionado_id uuid,
  origem_tratamento_id uuid unique,
  lancamento_origem_id uuid unique,
  competencia date,
  natureza text not null check (natureza in ('RECEITA', 'DESPESA')),
  categoria text not null
    check (categoria in ('MENSALIDADE', 'REPASSE_EXTRA', 'PARCELA_VENDA', 'COMISSAO',
                         'ALIMENTACAO_FENO', 'OPERACIONAL')),
  descricao text not null,
  numero_parcela integer check (numero_parcela is null or numero_parcela > 0),
  valor numeric(12, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'PAGO', 'ATRASADO')),
  comprovante_url text,
  gateway_cobranca_id text,
  pix_copia_cola text,
  link_pagamento text,
  excluido_em timestamptz,
  percentual_comissao numeric(5, 2)
    check (percentual_comissao is null or percentual_comissao between 0 and 100),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint lancamentos_conta_tenant_fk
    foreign key (conta_bancaria_id, tenant_id) references public.contas_bancarias (id, tenant_id),
  constraint lancamentos_equino_tenant_fk
    foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id),
  constraint lancamentos_proprietario_tenant_fk
    foreign key (proprietario_id, tenant_id) references public.proprietarios (id, tenant_id),
  constraint lancamentos_contrato_tenant_fk
    foreign key (contrato_venda_id, tenant_id) references public.contratos_vendas (id, tenant_id),
  constraint lancamentos_comissionado_tenant_fk
    foreign key (comissionado_id, tenant_id) references public.usuarios (id, tenant_id),
  constraint lancamentos_criador_tenant_fk
    foreign key (criado_por, tenant_id) references public.usuarios (id, tenant_id),
  constraint lancamentos_cliente_criador_fk
    foreign key (proprietario_id, tenant_id, criado_por)
    references public.proprietarios (id, tenant_id, criado_por),
  constraint lancamentos_tratamento_tenant_fk
    foreign key (origem_tratamento_id, tenant_id)
    references public.tratamentos_medicamentos (id, tenant_id),
  constraint lancamentos_origem_tenant_fk
    foreign key (lancamento_origem_id, tenant_id)
    references public.financeiro_lancamentos (id, tenant_id),
  constraint lancamentos_gateway_id_unique unique (gateway_cobranca_id)
);

alter table public.financeiro_lancamentos
  add column if not exists criado_por uuid,
  add column if not exists excluido_em timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_criador_tenant_fk'
      and conrelid = 'public.financeiro_lancamentos'::regclass
  ) then
    alter table public.financeiro_lancamentos
      add constraint lancamentos_criador_tenant_fk
      foreign key (criado_por, tenant_id) references public.usuarios (id, tenant_id);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_cliente_criador_fk'
      and conrelid = 'public.financeiro_lancamentos'::regclass
  ) then
    alter table public.financeiro_lancamentos
      add constraint lancamentos_cliente_criador_fk
      foreign key (proprietario_id, tenant_id, criado_por)
      references public.proprietarios (id, tenant_id, criado_por);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_autoria_e_cliente_obrigatorios'
      and conrelid = 'public.financeiro_lancamentos'::regclass
  ) then
    alter table public.financeiro_lancamentos
      add constraint lancamentos_autoria_e_cliente_obrigatorios
      check (criado_por is not null and proprietario_id is not null) not valid;
  end if;
end
$$;

create index if not exists equinos_tenant_status_idx
  on public.equinos (tenant_id, status);
create index if not exists equinos_tenant_criador_idx
  on public.equinos (tenant_id, criado_por, excluido_em);
create index if not exists tratamentos_tenant_equino_idx
  on public.tratamentos_medicamentos (tenant_id, equino_id, data_inicio);
create index if not exists aplicacoes_tenant_agenda_idx
  on public.medicamentos_aplicacoes (tenant_id, status, data_hora_prevista);
create index if not exists agenda_tenant_data_idx
  on public.agenda_treinos (tenant_id, data_hora);
create index if not exists lancamentos_tenant_vencimento_idx
  on public.financeiro_lancamentos (tenant_id, status, data_vencimento);
create index if not exists lancamentos_login_vencimento_idx
  on public.financeiro_lancamentos (tenant_id, criado_por, status, data_vencimento)
  where excluido_em is null;
create index if not exists ciclos_tenant_matriz_idx
  on public.reproducao_ciclos (tenant_id, matriz_id, status);
create unique index if not exists mensalidade_equino_competencia_unique
  on public.financeiro_lancamentos (tenant_id, equino_id, competencia)
  where categoria = 'MENSALIDADE' and competencia is not null;

create table if not exists public.arquivos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enviado_por uuid not null,
  tipo text not null check (tipo in ('EQUINO', 'COMPROVANTE')),
  nome_original text not null,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes between 1 and 10485760),
  caminho text not null unique,
  equino_id uuid,
  lancamento_id uuid,
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint arquivos_usuario_tenant_fk
    foreign key (enviado_por) references public.usuarios (id),
  constraint arquivos_equino_tenant_fk
    foreign key (equino_id, tenant_id) references public.equinos (id, tenant_id),
  constraint arquivos_lancamento_tenant_fk
    foreign key (lancamento_id, tenant_id)
    references public.financeiro_lancamentos (id, tenant_id),
  check (
    (tipo = 'EQUINO' and equino_id is not null and lancamento_id is null)
    or (tipo = 'COMPROVANTE' and lancamento_id is not null and equino_id is null)
  )
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'arquivos_usuario_tenant_fk'
      and conrelid = 'public.arquivos'::regclass
  ) then
    alter table public.arquivos
      drop constraint arquivos_usuario_tenant_fk;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'arquivos_enviado_por_fk'
      and conrelid = 'public.arquivos'::regclass
  ) then
    alter table public.arquivos
      add constraint arquivos_enviado_por_fk
      foreign key (enviado_por) references public.usuarios (id);
  end if;
end
$$;

create index if not exists arquivos_tenant_tipo_idx
  on public.arquivos (tenant_id, tipo, created_at desc);

create or replace function public.app_update_bank_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_delta numeric(14, 2) := 0;
  new_delta numeric(14, 2) := 0;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.status = 'PAGO'
     and old.excluido_em is null
     and old.conta_bancaria_id is not null then
    old_delta := case when old.natureza = 'RECEITA' then old.valor else -old.valor end;
    update public.contas_bancarias
      set saldo_atual = saldo_atual - old_delta
      where id = old.conta_bancaria_id and tenant_id = old.tenant_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.status = 'PAGO'
     and new.excluido_em is null
     and new.conta_bancaria_id is not null then
    new_delta := case when new.natureza = 'RECEITA' then new.valor else -new.valor end;
    update public.contas_bancarias
      set saldo_atual = saldo_atual + new_delta
      where id = new.conta_bancaria_id and tenant_id = new.tenant_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function public.app_create_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_rate numeric(5, 2);
begin
  if tg_op = 'UPDATE' and old.status = 'PAGO' then
    return new;
  end if;

  if new.status <> 'PAGO'
     or new.excluido_em is not null
     or new.natureza <> 'RECEITA'
     or new.categoria not in ('MENSALIDADE', 'PARCELA_VENDA')
     or new.comissionado_id is null
     or new.lancamento_origem_id is not null then
    return new;
  end if;

  commission_rate := coalesce(
    new.percentual_comissao,
    (select u.percentual_comissao_padrao
     from public.usuarios as u
     where u.id = new.comissionado_id and u.tenant_id = new.tenant_id),
    0
  );

  if commission_rate > 0 then
    insert into public.financeiro_lancamentos (
      tenant_id, criado_por, proprietario_id, comissionado_id,
      lancamento_origem_id, natureza, categoria,
      descricao, valor, data_vencimento, status
    )
    values (
      new.tenant_id, new.criado_por, new.proprietario_id, new.comissionado_id,
      new.id, 'DESPESA', 'COMISSAO',
      'Comissão: ' || new.descricao,
      round(new.valor * commission_rate / 100, 2),
      current_date, 'PENDENTE'
    )
    on conflict (lancamento_origem_id) do nothing;
  end if;

  return new;
end
$$;

create or replace function public.app_create_sale_installments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  installment_number integer;
  installment_value numeric(12, 2);
  regular_value numeric(12, 2) := round(new.valor_total / new.qtd_parcelas, 2);
begin
  for installment_number in 1..new.qtd_parcelas loop
    installment_value := case
      when installment_number = new.qtd_parcelas
        then new.valor_total - (regular_value * (new.qtd_parcelas - 1))
      else regular_value
    end;

    insert into public.financeiro_lancamentos (
      tenant_id, criado_por, equino_id, proprietario_id, contrato_venda_id,
      comissionado_id, percentual_comissao, natureza, categoria,
      descricao, numero_parcela, valor, data_vencimento, status
    )
    values (
      new.tenant_id,
      new.criado_por,
      new.equino_id,
      new.comprador_id,
      new.id,
      new.vendedor_id,
      new.percentual_comissao,
      'RECEITA',
      'PARCELA_VENDA',
      'Parcela ' || installment_number || '/' || new.qtd_parcelas || ' - ' || new.tipo,
      installment_number,
      installment_value,
      (new.data_primeira_parcela + make_interval(months => installment_number - 1))::date,
      'PENDENTE'
    );
  end loop;

  return new;
end
$$;

create or replace function public.app_create_foal_on_birth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mare public.equinos%rowtype;
  sire public.equinos%rowtype;
  foal_id uuid;
begin
  if new.status <> 'PARIDA'
     or new.potro_gerado_id is not null
     or (tg_op = 'UPDATE' and old.status = 'PARIDA') then
    return new;
  end if;

  select * into mare
  from public.equinos
  where id = new.matriz_id and tenant_id = new.tenant_id;

  select * into sire
  from public.equinos
  where id = new.garanhao_id and tenant_id = new.tenant_id;

  insert into public.equinos (
    tenant_id, proprietario_id, nome, raca, sexo, data_nascimento,
    origem, categoria, status, pai_id, mae_id
  )
  values (
    new.tenant_id,
    mare.proprietario_id,
    'Potro de ' || mare.nome || ' - ' || coalesce(new.data_parto_real, current_date)::text,
    mare.raca,
    'INDEFINIDO',
    coalesce(new.data_parto_real, current_date),
    'PROPRIO',
    'POTRO',
    'DESCANSO',
    sire.id,
    mare.id
  )
  returning id into foal_id;

  update public.reproducao_ciclos
  set potro_gerado_id = foal_id
  where id = new.id and tenant_id = new.tenant_id;

  return new;
end
$$;

drop trigger if exists financeiro_atualiza_saldo on public.financeiro_lancamentos;
create trigger financeiro_atualiza_saldo
after insert or update or delete on public.financeiro_lancamentos
for each row execute function public.app_update_bank_balance();

drop trigger if exists financeiro_gera_comissao on public.financeiro_lancamentos;
create trigger financeiro_gera_comissao
after insert or update of status on public.financeiro_lancamentos
for each row execute function public.app_create_commission();

drop trigger if exists contratos_gera_parcelas on public.contratos_vendas;
create trigger contratos_gera_parcelas
after insert on public.contratos_vendas
for each row execute function public.app_create_sale_installments();

drop trigger if exists reproducao_registra_nascimento on public.reproducao_ciclos;
create trigger reproducao_registra_nascimento
after insert or update of status on public.reproducao_ciclos
for each row execute function public.app_create_foal_on_birth();

drop function if exists public.app_gerar_cobranca_mensal(uuid, uuid, date);
create or replace function public.app_gerar_cobranca_mensal(
  p_tenant_id uuid,
  p_proprietario_id uuid,
  p_criado_por uuid,
  p_competencia date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_key uuid := p_tenant_id;
  creator_key uuid := p_criado_por;
  due_day integer;
  due_date date;
  inserted_count integer := 0;
  monthly_total numeric(12, 2) := 0;
  extras_total numeric(12, 2) := 0;
  row_count integer;
begin
  if tenant_key is null
     or creator_key is null
     or p_competencia is null then
    raise exception 'Dados inválidos.';
  end if;

  if p_competencia <> date_trunc('month', p_competencia)::date then
    raise exception 'A competência deve ser o primeiro dia do mês.';
  end if;

  select coalesce(dia_vencimento_padrao, 10)
  into due_day
  from public.proprietarios
  where id = p_proprietario_id
    and tenant_id = tenant_key
    and criado_por = creator_key;

  if due_day is null then
    raise exception 'Proprietário não encontrado neste centro.';
  end if;

  due_date := make_date(
    extract(year from p_competencia)::integer,
    extract(month from p_competencia)::integer,
    least(
      due_day,
      extract(day from (p_competencia + interval '1 month' - interval '1 day'))::integer
    )
  );

  with inserted as (
    insert into public.financeiro_lancamentos (
      tenant_id, criado_por, equino_id, proprietario_id,
      comissionado_id, percentual_comissao,
      natureza, categoria, descricao, valor, data_vencimento, status, competencia
    )
    select
      tenant_key,
      creator_key,
      e.id,
      p_proprietario_id,
      e.treinador_id,
      case when e.treinador_id is null then null
           else u.percentual_comissao_padrao end,
      'RECEITA',
      'MENSALIDADE',
      'Mensalidade - ' || e.nome || ' - ' || to_char(p_competencia, 'MM/YYYY'),
      e.valor_mensalidade,
      due_date,
      'PENDENTE',
      p_competencia
    from public.equinos as e
    left join public.usuarios as u
      on u.id = e.treinador_id and u.tenant_id = e.tenant_id
    where e.tenant_id = tenant_key
      and e.proprietario_id = p_proprietario_id
      and e.criado_por = creator_key
      and e.valor_mensalidade > 0
      and e.excluido_em is null
    on conflict (tenant_id, equino_id, competencia)
      where categoria = 'MENSALIDADE' and competencia is not null
      do nothing
    returning valor
  )
  select count(*)::integer, coalesce(sum(valor), 0)
  into row_count, monthly_total
  from inserted;

  inserted_count := inserted_count + row_count;

  with inserted as (
    insert into public.financeiro_lancamentos (
      tenant_id, criado_por, equino_id, proprietario_id, origem_tratamento_id,
      natureza, categoria, descricao, valor, data_vencimento, status, competencia
    )
    select
      tenant_key,
      creator_key,
      e.id,
      p_proprietario_id,
      tm.id,
      'RECEITA',
      'REPASSE_EXTRA',
      tm.descricao || ' - ' || e.nome,
      tm.custo,
      due_date,
      'PENDENTE',
      p_competencia
    from public.tratamentos_medicamentos as tm
    join public.equinos as e
      on e.id = tm.equino_id and e.tenant_id = tm.tenant_id
    where tm.tenant_id = tenant_key
      and e.proprietario_id = p_proprietario_id
      and e.criado_por = creator_key
      and tm.cobrar_proprietario
      and tm.custo > 0
      and e.excluido_em is null
      and tm.data_inicio >= p_competencia
      and tm.data_inicio < (p_competencia + interval '1 month')
    on conflict (origem_tratamento_id) do nothing
    returning valor
  )
  select count(*)::integer, coalesce(sum(valor), 0)
  into row_count, extras_total
  from inserted;

  inserted_count := inserted_count + row_count;
  return jsonb_build_object(
    'quantidade', inserted_count,
    'total', monthly_total + extras_total
  );
end
$$;

