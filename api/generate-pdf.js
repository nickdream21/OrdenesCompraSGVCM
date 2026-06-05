// ============================================================
// FUNCIÓN SERVERLESS (Vercel) - Generación de PDF de OC
// ============================================================
// Reutiliza EXACTAMENTE las plantillas templates/*.ejs y Puppeteer,
// para que el PDF sea idéntico al del sistema local.
//
// Flujo:
//   1. Verifica la sesión (token de Supabase) -> rechaza si no hay login.
//   2. Reserva el correlativo de forma atómica (RPC siguiente_correlativo).
//   3. Renderiza el EJS y genera el PDF con chromium serverless.
//   4. Sube el PDF a Supabase Storage e inserta el registro en `ordenes`.
//   5. Devuelve el PDF para que el navegador lo descargue.
//
// Variables de entorno requeridas en Vercel:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE
// ============================================================

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

moment.locale('es');

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');

// Cache a nivel de módulo (se reutiliza en invocaciones "calientes")
let _browser = null;
let _logos = null;

function loadLogos() {
    if (_logos) return _logos;
    const read = (file) => {
        try {
            const p = path.join(IMAGES_DIR, file);
            if (fs.existsSync(p)) return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
        } catch (_) {}
        return null;
    };
    _logos = { viviana: read('logo-viviana.png'), camafra: read('logo-camafra.png') };
    return _logos;
}

async function getBrowser() {
    if (_browser && _browser.connected) return _browser;
    _browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
    });
    return _browser;
}

function formatNumber(value, decimals = 2) {
    const num = parseFloat(value) || 0;
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function formatCurrency(value, currency = 'S/.') {
    const num = parseFloat(value) || 0;
    return `${currency} ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function readBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') return resolve(req.body);
        if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
        req.on('error', () => resolve({}));
    });
}

module.exports = async (req, res) => {
    // CORS (por si el front se sirve en otro origen durante pruebas)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'X-Numero-OC');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (req.method !== 'POST') { res.statusCode = 405; return res.json({ error: 'Método no permitido' }); }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
        res.statusCode = 500;
        return res.json({ error: 'Faltan variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE' });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let page = null;
    try {
        // 1) Autenticación: token de sesión Supabase
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) { res.statusCode = 401; return res.json({ error: 'No autenticado' }); }
        const { data: userData, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userData || !userData.user) { res.statusCode = 401; return res.json({ error: 'Sesión inválida' }); }

        // 2) Datos de entrada
        const body = await readBody(req);
        const { template, data, empresa } = body;
        const preview = !!body.preview;
        if (!template || !data || !empresa) {
            res.statusCode = 400;
            return res.json({ error: 'template, data y empresa son requeridos' });
        }
        const templatePath = path.join(TEMPLATES_DIR, `${template}.ejs`);
        if (!fs.existsSync(templatePath)) { res.statusCode = 404; return res.json({ error: 'Plantilla no encontrada' }); }

        // 3) Correlativo: en vista previa NO se reserva ni se archiva
        const anio = (typeof data.fecha === 'string' && /^\d{4}/.test(data.fecha))
            ? parseInt(data.fecha.slice(0, 4), 10)
            : new Date().getFullYear();
        let correlativo = null;
        let numero_oc;
        if (preview) {
            numero_oc = 'BORRADOR';
        } else {
            const { data: corr, error: corrErr } = await sb.rpc('siguiente_correlativo', { p_empresa: empresa, p_anio: anio });
            if (corrErr) throw new Error('No se pudo reservar el correlativo: ' + corrErr.message);
            correlativo = corr;
            numero_oc = `${anio}-${String(correlativo).padStart(6, '0')}`;
        }
        data.numero_oc = numero_oc;

        // 4) Render EJS -> PDF (idéntico al sistema local)
        const logos = loadLogos();
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const html = ejs.render(templateContent, {
            ...data,
            moment,
            logoViviana: logos.viviana,
            logoCamafra: logos.camafra,
            formatCurrency,
            formatNumber
        });

        const browser = await getBrowser();
        page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
        });

        // 5) Totales para el registro del historial
        const items = Array.isArray(data.items) ? data.items : [];
        let subtotal = 0;
        items.forEach((it) => { subtotal += (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0); });
        const esImportacion = template.includes('importacion');
        const moneda = esImportacion ? 'USD' : 'S/.';
        const total = esImportacion ? subtotal : subtotal * 1.18;

        // 6) Archivar PDF en Storage + registrar en `ordenes` (no en vista previa)
        if (!preview) {
            const pdfPath = `${empresa}/${anio}/${numero_oc}.pdf`;
            const { error: upErr } = await sb.storage.from('ordenes-pdf')
                .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
            if (upErr) console.error('Error subiendo a Storage:', upErr.message);

            const { error: insErr } = await sb.from('ordenes').insert({
                empresa,
                numero_oc,
                anio,
                correlativo,
                template,
                proveedor_razon_social: data.proveedor_razon_social || null,
                obra: data.obra || null,
                fecha: data.fecha || null,
                total: Number(total.toFixed(2)),
                moneda,
                pdf_path: pdfPath
            });
            if (insErr) console.error('Error registrando la orden:', insErr.message);
        }

        // 7) Devolver el PDF
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="OC_${numero_oc}.pdf"`);
        res.setHeader('X-Numero-OC', numero_oc);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);

    } catch (error) {
        console.error('Error generando PDF:', error);
        res.statusCode = 500;
        return res.json({ error: error.message || 'Error desconocido al generar PDF' });
    } finally {
        if (page) { try { await page.close(); } catch (_) {} }
    }
};
