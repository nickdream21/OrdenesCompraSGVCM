// ============================================================
// CLIENTE SUPABASE + AUTENTICACIÓN (login compartido)
// ============================================================
// Requiere que en index.html se cargue, en este orden:
//   1) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2  (global `supabase`)
//   2) supabase-config.js  (window.SUPABASE_CONFIG)
//   3) este archivo
// ============================================================

const SB = (() => {
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.url || cfg.url.includes('TU-PROYECTO') || !cfg.anonKey || cfg.anonKey.includes('TU_ANON')) {
        console.warn('⚠️ Supabase no está configurado. Edita public/js/supabase-config.js');
    }
    // `supabase` global viene del script CDN; `createClient` crea la instancia.
    return supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
    });
})();

// ------------------------------------------------------------
// Sesión / Autenticación
// ------------------------------------------------------------
async function sbGetSession() {
    const { data } = await SB.auth.getSession();
    return data.session;
}

async function sbGetAccessToken() {
    const session = await sbGetSession();
    return session ? session.access_token : null;
}

async function sbLogin(email, password) {
    const { data, error } = await SB.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
}

async function sbLogout() {
    await SB.auth.signOut();
}

async function sbGetUser() {
    const { data } = await SB.auth.getUser();
    return data?.user || null;
}

async function sbUpdateUserName(nombre) {
    const { error } = await SB.auth.updateUser({ data: { nombre } });
    if (error) throw error;
}

// ------------------------------------------------------------
// Lecturas comunes (cacheadas en memoria por sesión de página)
// ------------------------------------------------------------
const _cache = { obras: null, proveedores: null };

async function sbLoadObras(empresa, force = false) {
    if (!_cache.obras || force) {
        const { data, error } = await SB
            .from('obras')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        if (error) throw error;
        _cache.obras = data || [];
    }
    return empresa ? _cache.obras.filter(o => o.empresa === empresa) : _cache.obras;
}

async function sbLoadProveedores(force = false) {
    if (!_cache.proveedores || force) {
        const { data, error } = await SB
            .from('proveedores')
            .select('*')
            .eq('activo', true)
            .order('razon_social', { ascending: true });
        if (error) throw error;
        _cache.proveedores = data || [];
    }
    return _cache.proveedores;
}

function sbInvalidate(key) {
    if (key) _cache[key] = null;
    else { _cache.obras = null; _cache.proveedores = null; }
}

// ------------------------------------------------------------
// Empresas (tabla `empresas`; si aún no existe, catálogo fijo)
// ------------------------------------------------------------
let _empresasCache = null;
async function sbLoadEmpresas(force = false) {
    if (_empresasCache && !force) return _empresasCache;
    const { data, error } = await SB.from('empresas').select('*').order('nombre', { ascending: true });
    if (error) {
        console.warn('Tabla empresas no disponible, usando catálogo:', error.message);
        _empresasCache = window.OC_EMPRESAS.map(e => window.OC_CATALOGO.normalizarEmpresa({ codigo: e.codigo }));
        _empresasCache.sinTabla = true;
    } else {
        _empresasCache = data.map(window.OC_CATALOGO.normalizarEmpresa);
        _empresasCache.forEach((e, i) => { e.activo = data[i].activo !== false; e.serie = data[i].serie; });
    }
    return _empresasCache;
}

// ------------------------------------------------------------
// Consulta de RUC en SUNAT (vía /api/ruc)
// ------------------------------------------------------------
async function sbConsultarRuc(ruc) {
    const token = await sbGetAccessToken();
    const r = await fetch(`/api/ruc?numero=${encodeURIComponent(ruc)}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`); e.status = r.status; throw e; }
    return j;
}
