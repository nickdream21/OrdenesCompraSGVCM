-- ============================================================
-- MIGRACIÓN v2 -> v3  (proyecto EXISTENTE con datos)
-- Agrega Edificaciones, OC/OS separadas y endurece permisos.
-- No borra datos. Se puede ejecutar más de una vez.
-- Después de esto, schema.sql también es seguro de re-ejecutar.
-- ============================================================
begin;

-- 1) Quitar restricciones que solo aceptaban viviana/camafra
alter table public.obras        drop constraint if exists obras_empresa_check;
alter table public.correlativos drop constraint if exists correlativos_empresa_check;

-- 2) correlativos: (empresa, anio) -> (empresa, tipo_doc, periodo)
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'correlativos' and column_name = 'anio') then
        alter table public.correlativos rename column anio to periodo;
    end if;
end $$;
alter table public.correlativos add column if not exists tipo_doc text not null default 'OC';
alter table public.correlativos drop constraint if exists correlativos_tipo_doc_check;
alter table public.correlativos add constraint correlativos_tipo_doc_check check (tipo_doc in ('OC', 'OS'));
alter table public.correlativos drop constraint if exists correlativos_pkey;
alter table public.correlativos add primary key (empresa, tipo_doc, periodo);

insert into public.correlativos (empresa, tipo_doc, periodo, ultimo_numero) values
    ('edificaciones', 'OC', 0, 0),
    ('edificaciones', 'OS', 0, 0)
on conflict do nothing;

-- 3) ordenes: nuevas columnas + unicidad por tipo de documento
alter table public.ordenes add column if not exists tipo_doc text not null default 'OC';
alter table public.ordenes add column if not exists datos jsonb;
alter table public.ordenes add column if not exists creado_por_email text;
alter table public.ordenes add column if not exists creado_por_nombre text;
drop index if exists public.ordenes_numero_unique;
create unique index if not exists ordenes_numero_tipo_unique on public.ordenes (empresa, tipo_doc, numero_oc);

-- 4) Funciones de numeración nuevas (la antigua deja de existir)
drop function if exists public.siguiente_correlativo(text, int);

create or replace function public.siguiente_correlativo(p_empresa text, p_tipo_doc text, p_periodo int)
returns int language plpgsql security definer set search_path = public as $$
declare v_num int;
begin
    insert into public.correlativos (empresa, tipo_doc, periodo, ultimo_numero)
    values (p_empresa, p_tipo_doc, p_periodo, 1)
    on conflict (empresa, tipo_doc, periodo)
    do update set ultimo_numero = public.correlativos.ultimo_numero + 1
    returning ultimo_numero into v_num;
    return v_num;
end; $$;

create or replace function public.liberar_correlativo(p_empresa text, p_tipo_doc text, p_periodo int, p_numero int)
returns boolean language sql security definer set search_path = public as $$
    with u as (
        update public.correlativos set ultimo_numero = ultimo_numero - 1
        where empresa = p_empresa and tipo_doc = p_tipo_doc and periodo = p_periodo and ultimo_numero = p_numero
        returning 1
    ) select exists (select 1 from u);
$$;

revoke execute on function public.siguiente_correlativo(text, text, int) from public, anon, authenticated;
revoke execute on function public.liberar_correlativo(text, text, int, int) from public, anon, authenticated;
grant  execute on function public.siguiente_correlativo(text, text, int) to service_role;
grant  execute on function public.liberar_correlativo(text, text, int, int) to service_role;

-- 5) Permisos: historial solo lectura; correlativos y escritura de PDFs solo servidor
drop policy if exists "auth_all_correlativos" on public.correlativos;
drop policy if exists "auth_all_ordenes"      on public.ordenes;
drop policy if exists "auth_read_ordenes"     on public.ordenes;
create policy "auth_read_ordenes" on public.ordenes for select to authenticated using (true);
drop policy if exists "auth_write_pdf" on storage.objects;

commit;

-- Verificación
select empresa, tipo_doc, periodo, ultimo_numero from public.correlativos order by 1, 2, 3;
