create extension if not exists pgcrypto;

create table if not exists public.contas_financeiro_admin (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('CONTA_CORRENTE', 'PIX', 'DINHEIRO', 'OUTRO')),
  chave_pix text,
  saldo_atual numeric(14, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lancamentos_financeiro_admin (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas_financeiro_admin (id),
  tenant_id uuid,
  tenant_nome text,
  plano text check (plano is null or plano in ('CTE', 'HARAS')),
  natureza text not null check (natureza in ('RECEITA', 'DESPESA')),
  categoria text not null
    check (categoria in ('ASSINATURA', 'TARIFA', 'OPERACIONAL', 'OUTRA')),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  competencia date,
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO')),
  gateway_cobranca_id text unique,
  criado_por uuid not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  check ((tenant_id is null and tenant_nome is null) or
         (tenant_id is not null and tenant_nome is not null))
);

alter table public.lancamentos_financeiro_admin
  add column if not exists cadastro_cte_haras_id uuid,
  add column if not exists cadastro_cte_haras_nome text,
  add column if not exists cadastro_cte_haras_tipo text,
  add column if not exists conta_informada text;

create index if not exists lancamentos_admin_status_vencimento_idx
  on public.lancamentos_financeiro_admin (status, data_vencimento)
  where excluido_em is null;
create index if not exists lancamentos_admin_tenant_competencia_idx
  on public.lancamentos_financeiro_admin (tenant_id, competencia)
  where excluido_em is null;

create table if not exists public.auditoria_financeiro_admin (
  id uuid primary key default gen_random_uuid(),
  registro_tipo text not null default 'LANCAMENTO'
    check (registro_tipo in ('LANCAMENTO', 'CONTA')),
  registro_id uuid not null,
  ator_id uuid not null,
  acao text not null
    check (acao in ('CRIAR', 'ALTERAR', 'BAIXAR', 'EXCLUIR', 'CRIAR_CONTA')),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auditoria_financeiro_admin'
      and column_name = 'lancamento_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auditoria_financeiro_admin'
      and column_name = 'registro_id'
  ) then
    alter table public.auditoria_financeiro_admin
      rename column lancamento_id to registro_id;
  end if;
end
$$;

alter table public.auditoria_financeiro_admin
  add column if not exists registro_tipo text not null default 'LANCAMENTO';

alter table public.auditoria_financeiro_admin
  drop constraint if exists auditoria_financeiro_admin_acao_check;
alter table public.auditoria_financeiro_admin
  add constraint auditoria_financeiro_admin_acao_check
  check (acao in ('CRIAR', 'ALTERAR', 'BAIXAR', 'EXCLUIR', 'CRIAR_CONTA'));

alter table public.auditoria_financeiro_admin
  drop constraint if exists auditoria_financeiro_admin_registro_tipo_check;
alter table public.auditoria_financeiro_admin
  add constraint auditoria_financeiro_admin_registro_tipo_check
  check (registro_tipo in ('LANCAMENTO', 'CONTA'));

create index if not exists auditoria_financeiro_admin_registro_idx
  on public.auditoria_financeiro_admin (registro_tipo, registro_id, criado_em desc);

create or replace function public.atualizar_saldo_conta_financeiro_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_delta numeric(14, 2) := 0;
  new_delta numeric(14, 2) := 0;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.status = 'PAGO'
     and old.excluido_em is null
     and old.conta_id is not null then
    old_delta := case when old.natureza = 'RECEITA' then old.valor else -old.valor end;
    update public.contas_financeiro_admin
      set saldo_atual = saldo_atual - old_delta
      where id = old.conta_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.status = 'PAGO'
     and new.excluido_em is null
     and new.conta_id is not null then
    new_delta := case when new.natureza = 'RECEITA' then new.valor else -new.valor end;
    update public.contas_financeiro_admin
      set saldo_atual = saldo_atual + new_delta
      where id = new.conta_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists lancamentos_admin_atualiza_saldo
  on public.lancamentos_financeiro_admin;
create trigger lancamentos_admin_atualiza_saldo
after insert or update or delete on public.lancamentos_financeiro_admin
for each row execute function public.atualizar_saldo_conta_financeiro_admin();
