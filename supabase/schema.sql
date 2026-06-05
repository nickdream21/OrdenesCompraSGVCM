-- ============================================================
-- ESQUEMA SUPABASE - Sistema de Órdenes de Compra
-- ============================================================
-- Cómo usar:
-- 1. Crea un proyecto gratis en https://supabase.com
-- 2. Ve a "SQL Editor" -> "New query"
-- 3. Pega TODO este archivo y dale "Run"
-- 4. Crea el usuario compartido en Authentication -> Users -> "Add user"
--    (email + contraseña que usará todo el equipo). Marca "Auto Confirm".
-- 5. Copia la URL del proyecto y la "anon key" (Settings -> API) a
--    public/js/supabase-config.js
-- ============================================================

-- ------------------------------------------------------------
-- TABLA: obras (lista de obras hábiles por empresa)
-- ------------------------------------------------------------
create table if not exists public.obras (
    id          bigint generated always as identity primary key,
    empresa     text not null check (empresa in ('viviana', 'camafra')),
    nombre      text not null,
    direccion   text,
    activo      boolean not null default true,
    created_at  timestamptz not null default now()
);

create index if not exists obras_empresa_idx on public.obras (empresa) where activo;

-- ------------------------------------------------------------
-- TABLA: proveedores (datos vinculados; al elegir la razón social
-- se autocompletan dirección, RUC, etc.)
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
-- TABLA: correlativos (último número por empresa y año)
-- ------------------------------------------------------------
create table if not exists public.correlativos (
    empresa        text not null check (empresa in ('viviana', 'camafra')),
    anio           int  not null,
    ultimo_numero  int  not null default 0,
    primary key (empresa, anio)
);

-- Siembra inicial del año 2026 (cambia el 0 si quieres continuar
-- desde un número específico; el primer OC será ultimo_numero + 1).
insert into public.correlativos (empresa, anio, ultimo_numero) values
    ('viviana', 2026, 0),
    ('camafra', 2026, 0)
on conflict (empresa, anio) do nothing;

-- ------------------------------------------------------------
-- FUNCIÓN: siguiente_correlativo (reserva atómica del número)
-- Devuelve el siguiente correlativo de forma segura aunque dos
-- personas generen una OC al mismo tiempo.
-- ------------------------------------------------------------
create or replace function public.siguiente_correlativo(p_empresa text, p_anio int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_num int;
begin
    insert into public.correlativos (empresa, anio, ultimo_numero)
    values (p_empresa, p_anio, 1)
    on conflict (empresa, anio)
    do update set ultimo_numero = public.correlativos.ultimo_numero + 1
    returning ultimo_numero into v_num;

    return v_num;
end;
$$;

-- ------------------------------------------------------------
-- TABLA: ordenes (historial central de OC generadas)
-- ------------------------------------------------------------
create table if not exists public.ordenes (
    id                      bigint generated always as identity primary key,
    empresa                 text not null,
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
    created_at              timestamptz not null default now()
);

create unique index if not exists ordenes_numero_unique
    on public.ordenes (empresa, numero_oc);

create index if not exists ordenes_created_idx on public.ordenes (created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Solo usuarios autenticados (login compartido) pueden leer/escribir.
-- La función serverless usa la service_role y omite RLS.
-- ============================================================
alter table public.obras        enable row level security;
alter table public.proveedores  enable row level security;
alter table public.correlativos enable row level security;
alter table public.ordenes      enable row level security;

drop policy if exists "auth_all_obras"        on public.obras;
drop policy if exists "auth_all_proveedores"  on public.proveedores;
drop policy if exists "auth_all_correlativos" on public.correlativos;
drop policy if exists "auth_all_ordenes"      on public.ordenes;

create policy "auth_all_obras"        on public.obras
    for all to authenticated using (true) with check (true);
create policy "auth_all_proveedores"  on public.proveedores
    for all to authenticated using (true) with check (true);
create policy "auth_all_correlativos" on public.correlativos
    for all to authenticated using (true) with check (true);
create policy "auth_all_ordenes"      on public.ordenes
    for all to authenticated using (true) with check (true);

grant execute on function public.siguiente_correlativo(text, int) to authenticated, service_role;

-- ============================================================
-- STORAGE: bucket privado para archivar los PDF
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ordenes-pdf', 'ordenes-pdf', false)
on conflict (id) do nothing;

drop policy if exists "auth_read_pdf"  on storage.objects;
drop policy if exists "auth_write_pdf" on storage.objects;

create policy "auth_read_pdf" on storage.objects
    for select to authenticated using (bucket_id = 'ordenes-pdf');

create policy "auth_write_pdf" on storage.objects
    for insert to authenticated with check (bucket_id = 'ordenes-pdf');
