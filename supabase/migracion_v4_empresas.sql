-- ============================================================
-- MIGRACIÓN v4: EMPRESAS administrables desde la app
-- Solo AGREGA (tabla + función). No modifica datos existentes.
-- Se puede ejecutar más de una vez.
-- ============================================================
begin;

create table if not exists public.empresas (
    codigo        text primary key,                 -- identificador corto (ej. 'edificaciones')
    nombre        text not null,                    -- nombre corto que se ve en la app
    razon_social  text not null,
    ruc           text not null,
    direccion     text,
    telefono      text,
    email         text,
    aprobador     text,                             -- nombre en "Vº Bº Aprobado"
    color         text not null default '#16324F',
    logo_data     text,                             -- imagen PNG/JPEG en data-URL (≤ ~300 KB)
    firma_data    text,                             -- firma escaneada opcional (data-URL)
    formato       text not null default 'nisira' check (formato in ('nisira', 'propio')),
    serie         text not null default '0001',
    activo        boolean not null default true,
    created_at    timestamptz not null default now(),
    constraint empresas_codigo_formato check (codigo ~ '^[a-z0-9_-]{2,40}$'),
    constraint empresas_color_formato check (color ~ '^#[0-9a-fA-F]{6}$'),
    constraint empresas_ruc_formato check (ruc ~ '^[0-9]{11}$'),
    constraint empresas_logo_tamano check (logo_data is null or length(logo_data) < 450000),
    constraint empresas_firma_tamano check (firma_data is null or length(firma_data) < 450000)
);

-- Empresas actuales (los logos de estas tres se sirven desde public/images)
insert into public.empresas (codigo, nombre, razon_social, ruc, direccion, telefono, email, color, formato) values
    ('viviana', 'Servicios Generales VIVIANA', 'SERVICIOS GENERALES VIVIANA EIRL', '20483851171',
        'JR. CAÑETE NRO 416 DPTO 100 BARRIO UNION DEL CERCADO DE LIMA - LIMA - LIMA', '073 - 506402', null, '#2563eb', 'propio'),
    ('camafra', 'CAMAFRA MOTORS', 'CAMAFRA MOTORS S.A.C.', '20529940395', null, null, null, '#E8630A', 'propio'),
    ('edificaciones', 'Edificaciones & Construcciones del Norte', 'EDIFICACIONES & CONSTRUCCIONES DEL NORTE E.I.R.L.', '20611247142',
        'MZA. 01 LOTE. 11 A.H. CIUDAD ROJA DEL PESCADOR PIURA - PAITA - PAITA', '+51 958 429 065', 'eycdelnorte@gmail.com', '#9a7520', 'nisira')
on conflict (codigo) do nothing;

alter table public.empresas enable row level security;
drop policy if exists "auth_read_empresas"   on public.empresas;
drop policy if exists "auth_insert_empresas" on public.empresas;
drop policy if exists "auth_update_empresas" on public.empresas;
create policy "auth_read_empresas"   on public.empresas for select to authenticated using (true);
create policy "auth_insert_empresas" on public.empresas for insert to authenticated with check (true);
create policy "auth_update_empresas" on public.empresas for update to authenticated using (true) with check (true);
-- (sin DELETE: las empresas se desactivan con activo = false para no romper el historial)

-- Al crear una empresa: fija desde qué número continúa cada tipo de orden.
-- Solo crea filas que no existen (no puede retroceder una numeración en uso).
create or replace function public.inicializar_correlativos(p_empresa text, p_ultimo_oc int, p_ultimo_os int)
returns void language sql security definer set search_path = public as $$
    insert into public.correlativos (empresa, tipo_doc, periodo, ultimo_numero) values
        (p_empresa, 'OC', 0, greatest(coalesce(p_ultimo_oc, 0), 0)),
        (p_empresa, 'OS', 0, greatest(coalesce(p_ultimo_os, 0), 0))
    on conflict do nothing;
$$;
revoke execute on function public.inicializar_correlativos(text, int, int) from public, anon;
grant  execute on function public.inicializar_correlativos(text, int, int) to authenticated, service_role;

commit;

select codigo, nombre, ruc, formato from public.empresas order by nombre;
