begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.proprietarios
  add column if not exists cadastro_cte_haras_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.proprietarios'::regclass
      and conname = 'proprietarios_cadastro_cte_haras_fk'
  ) then
    alter table public.proprietarios
      add constraint proprietarios_cadastro_cte_haras_fk
      foreign key (cadastro_cte_haras_id)
      references public.cadastros_cte_haras (id)
      on delete set null;
  end if;
end
$$;

create index if not exists proprietarios_cadastro_cte_haras_idx
  on public.proprietarios (cadastro_cte_haras_id);

commit;
