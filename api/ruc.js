// ============================================================
// CONSULTA RUC (SUNAT) — GET /api/ruc?numero=20123456789
// ============================================================
// Usa un proveedor de datos SUNAT con token (p. ej. Decolecta o
// apis.net.pe). Se configura con variables de entorno en Vercel:
//   RUC_API_TOKEN  token del proveedor (obligatorio para activarlo)
//   RUC_API_URL    URL con {ruc} donde va el número; por defecto:
//                  https://api.decolecta.com/v1/sunat/ruc?numero={ruc}
// Sin token responde 501 y la app simplemente avisa que no está activo.
// Requiere sesión iniciada para no ser un proxy abierto.
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const URL_DEFECTO = 'https://api.decolecta.com/v1/sunat/ruc?numero={ruc}';

function enviar(res, status, obj) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
}

// Toma el primer campo con valor entre varios nombres posibles (cada proveedor usa los suyos)
const pick = (o, ...keys) => {
    for (const k of keys) if (o && o[k] != null && String(o[k]).trim() && String(o[k]).trim() !== '-') return String(o[k]).trim();
    return '';
};

module.exports = async (req, res) => {
    if (req.method !== 'GET') return enviar(res, 405, { error: 'Método no permitido' });

    const token = process.env.RUC_API_TOKEN;
    if (!token) return enviar(res, 501, { error: 'La consulta a SUNAT no está activada (falta RUC_API_TOKEN).' });

    // Sesión
    const auth = req.headers['authorization'] || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!jwt || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return enviar(res, 401, { error: 'No autenticado' });
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: u, error: uErr } = await sb.auth.getUser(jwt);
    if (uErr || !u || !u.user) return enviar(res, 401, { error: 'Sesión inválida' });

    const url = new URL(req.url, 'http://x');
    const ruc = (url.searchParams.get('numero') || '').trim();
    if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return enviar(res, 400, { error: 'El RUC debe tener 11 dígitos y empezar con 10 o 20.' });

    try {
        const destino = (process.env.RUC_API_URL || URL_DEFECTO).replace('{ruc}', ruc);
        const r = await fetch(destino, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(8000)
        });
        if (r.status === 404) return enviar(res, 404, { error: 'SUNAT no tiene registrado ese RUC.' });
        if (!r.ok) return enviar(res, 502, { error: `El servicio de consulta respondió ${r.status}.` });
        const j = await r.json();
        const d = j && typeof j.data === 'object' && j.data ? j.data : j;

        const razon = pick(d, 'razon_social', 'razonSocial', 'nombre', 'nombre_o_razon_social');
        if (!razon) return enviar(res, 404, { error: 'SUNAT no tiene registrado ese RUC.' });
        let direccion = pick(d, 'direccion_completa', 'direccion', 'domicilio_fiscal');
        const ubigeo = [pick(d, 'departamento'), pick(d, 'provincia'), pick(d, 'distrito')].filter(Boolean).join(' - ');
        if (direccion && ubigeo && !direccion.toUpperCase().includes(ubigeo.split(' - ').pop().toUpperCase())) {
            direccion = `${direccion} ${ubigeo}`;
        }
        return enviar(res, 200, {
            ruc,
            razon_social: razon,
            direccion,
            estado: pick(d, 'estado'),
            condicion: pick(d, 'condicion')
        });
    } catch (e) {
        return enviar(res, 502, { error: 'No se pudo consultar SUNAT: ' + (e.name === 'TimeoutError' ? 'tardó demasiado' : e.message) });
    }
};
