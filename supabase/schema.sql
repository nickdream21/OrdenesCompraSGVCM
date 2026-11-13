-- ============================================================
-- ESQUEMA SUPABASE - Sistema de Órdenes de Compra / Servicio  (v3)
-- ============================================================
-- Cómo usar (proyecto NUEVO):
-- 1. Crea un proyecto gratis en https://supabase.com
-- 2. SQL Editor -> New query -> pega TODO este archivo -> Run
-- 3. Authentication -> Users -> "Add user" (uno por persona, Auto Confirm)
-- 4. Settings -> API: copia URL + anon/publishable key a
--    public/js/supabase-config.js, y URL + service_role a Vercel.
--
-- Es idempotente: se puede volver a ejecutar sin perder datos.
-- Después ejecuta también migracion_v4_empresas.sql (tabla de empresas).
-- ============================================================

-- ------------------------------------------------------------
-- OBRAS (por empresa)
-- ------------------------------------------------------------
create table if not exists public.obras (
    id          bigint generated always as identity primary key,
    empresa     text not null,          -- 'viviana' | 'camafra' | 'edificaciones' (ver public/js/config.js)
    nombre      text not null,
    direccion   text,
    activo      boolean not null default true,
    created_at  timestamptz not null default now()
);
create index if not exists obras_empresa_idx on public.obras (empresa) where activo;

-- ------------------------------------------------------------
-- PROVEEDORES (compartidos entre empresas)
-- ------------------------------------------------------------
create table if not exists public.proveedores (
    id                bigint generated always as identity primary key,
    razon_social      text not null,
    ruc               text,
    direccion         text,
    cuenta_corriente  text,
    contacto          text,
    telefono          text,
    correo            text,
    activo            boolean not null default true,
    created_at        timestamptz not null default now()
);
create unique index if not exists proveedores_ruc_unique
    on public.proveedores (ruc) where ruc is not null and ruc <> '';

-- ------------------------------------------------------------
-- CORRELATIVOS  (empresa + tipo de documento + periodo)
--   periodo = año (2026)  -> numeración que reinicia cada año  (VIVIANA, CAMAFRA)
--   periodo = 0           -> numeración continua tipo NISIRA   (EDIFICACIONES)
-- ------------------------------------------------------------
create table if not exists public.correlativos (
    empresa        text not null,
    tipo_doc       text not null default 'OC' check (tipo_doc in ('OC', 'OS')),
    periodo        int  not null,
    ultimo_numero  int  not null default 0,
    primary key (empresa, tipo_doc, periodo)
);

-- Para CONTINUAR una numeración existente, pon aquí el último número usado
-- (la siguiente orden será ultimo_numero + 1). Ej.: si Edificaciones ya
-- emitió la OC 0001-0000045 a mano, usa 45.
insert into public.correlativos (empresa, tipo_doc, periodo, ultimo_numero) values
    ('viviana',       'OC', extract(year from now())::int, 0),
    ('camafra',       'OC', extract(year from now())::int, 0),
    ('edificaciones', 'OC', 0, 0),
    ('edificaciones', 'OS', 0, 0)
on conflict do nothing;

-- Reserva atómica del siguiente número (seguro con usuarios simultáneos)
drop function if exists public.siguiente_correlativo(text, int);
create or replace function public.siguiente_correlativo(p_empresa text, p_tipo_doc text, p_periodo int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_num int;
begin
    insert into public.correlativos (empresa, tipo_doc, periodo, ultimo_numero)
    values (p_empresa, p_tipo_doc, p_periodo, 1)
    on conflict (empresa, tipo_doc, periodo)
    do update set ultimo_numero = public.correlativos.ultimo_numero + 1
    returning ultimo_numero into v_num;
    return v_num;
end;
$$;

-- Devuelve el número si el PDF falló (solo si nadie tomó uno después)
create or replace function public.liberar_correlativo(p_empresa text, p_tipo_doc text, p_periodo int, p_numero int)
returns boolean
language sql
security definer
set search_path = public
as $$
    with u as (
        update public.correlativos set ultimo_numero = ultimo_numero - 1
        where empresa = p_empresa and tipo_doc = p_tipo_doc and periodo = p_periodo and ultimo_numero = p_numero
        returning 1
    ) select exists (select 1 from u);
$$;

-- Solo el servidor (service_role) numera: un usuario no puede "quemar" números
revoke execute on function public.siguiente_correlativo(text, text, int) from public, anon, authenticated;
revoke execute on function public.liberar_correlativo(text, text, int, int) from public, anon, authenticated;
grant  execute on function public.siguiente_correlativo(text, text, int) to service_role;
grant  execute on function public.liberar_correlativo(text, text, int, int) to service_role;

-- ------------------------------------------------------------
-- ORDENES (historial central)
-- ------------------------------------------------------------
create table if not exists public.ordenes (
    id                      bigint generated always as identity primary key,
    empresa                 text not null,
    tipo_doc                text not null default 'OC',
    numero_oc               text not null,
    anio                    int  not null,
    correlativo             int  not null,
    template                text,
    proveedor_razon_social  text,
    obra                    text,
    fecha                   date,
    total                   numeric(14,2),
    moneda                  text,
    pdf_path                text,
    datos                   jsonb,         -- formulario completo (permite re-generar / duplicar)
    creado_por_email        text,
    creado_por_nombre       text,
    created_at              timestamptz not null default now()
);
-- Migración desde la versión anterior (no hace nada en un proyecto nuevo)
alter table public.ordenes add column if not exists tipo_doc text not null default 'OC';
alter table public.ordenes add column if not exists datos jsonb;
alter table public.ordenes add column if not exists creado_por_email text;
alter table public.ordenes add column if not exists creado_por_nombre text;

drop index if exists public.ordenes_numero_unique;
create unique index if not exists ordenes_numero_tipo_unique on public.ordenes (empresa, tipo_doc, numero_oc);
create index if not exists ordenes_created_idx on public.ordenes (created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
--   obras / proveedores: usuarios con sesión leen y editan.
--   ordenes: usuarios con sesión SOLO LEEN (las escribe el servidor).
--   correlativos: sin acceso directo (solo vía funciones del servidor).
-- ============================================================
alter table public.obras        enable row level security;
alter table public.proveedores  enable row level security;
alter table public.correlativos enable row level security;
alter table public.ordenes      enable row level security;

drop policy if exists "auth_all_obras"        on public.obras;
drop policy if exists "auth_all_proveedores"  on public.proveedores;
drop policy if exists "auth_all_correlativos" on public.correlativos;
drop policy if exists "auth_all_ordenes"      on public.ordenes;
drop policy if exists "auth_read_ordenes"     on public.ordenes;

create policy "auth_all_obras"       on public.obras       for all    to authenticated using (true) with check (true);
create policy "auth_all_proveedores" on public.proveedores for all    to authenticated using (true) with check (true);
create policy "auth_read_ordenes"    on public.ordenes     for select to authenticated using (true);

-- ============================================================
-- STORAGE: bucket privado de PDFs (lo escribe solo el servidor)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ordenes-pdf', 'ordenes-pdf', false)
on conflict (id) do nothing;

drop policy if exists "auth_read_pdf"  on storage.objects;
drop policy if exists "auth_write_pdf" on storage.objects;
create policy "auth_read_pdf" on storage.objects
    for select to authenticated using (bucket_id = 'ordenes-pdf');
