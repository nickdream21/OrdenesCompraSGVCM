// ============================================================
// KEEP-ALIVE (Vercel Cron, 1 vez al día — ver vercel.json)
// ============================================================
// El plan gratuito de Supabase PAUSA el proyecto tras 7 días sin
// actividad y lo puede ELIMINAR si queda pausado ~90 días (eso fue
// lo que le pasó a la base anterior). Una consulta diaria lo evita.
//
// Si defines CRON_SECRET en Vercel, Vercel la envía automáticamente
// como "Authorization: Bearer <CRON_SECRET>" y aquí se exige.
// ============================================================
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
        res.statusCode = 401;
        return res.end('No autorizado');
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    res.setHeader('Content-Type', 'application/json');
    if (!url || !key) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, error: 'Faltan variables de entorno' }));
    }
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { count, error } = await sb.from('ordenes').select('id', { count: 'exact', head: true });
    res.statusCode = error ? 500 : 200;
    return res.end(JSON.stringify({ ok: !error, ordenes: count ?? null, error: error ? error.message : undefined, at: new Date().toISOString() }));
};
