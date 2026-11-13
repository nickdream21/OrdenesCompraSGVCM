// ============================================================
// FUNCIÓN SERVERLESS (Vercel) - Generación de PDF de OC / OS
// ============================================================
// Flujo:
//   1. Verifica la sesión (token de Supabase) -> 401 si no hay login.
//   2. Valida la plantilla contra el catálogo (public/js/config.js):
//      la EMPRESA se deduce de la plantilla, no se confía en el cliente.
//   3. Calcula importes en el servidor (lib/calculo.js).
//   4. Reserva el correlativo (RPC atómica). Si el PDF falla, lo libera.
//   5. Renderiza EJS -> PDF, lo sube a Storage y registra en `ordenes`.
//   6. Devuelve el PDF. Si el archivo/registro falló, avisa en
//      la cabecera X-Advertencia (antes se perdía en silencio).
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE
// Opcional (solo servidor local): SHARED_FOLDER = carpeta de red de respaldo
// ============================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const catalogo = require('../public/js/config.js');
const { calcular } = require('../lib/calculo');
const { renderHtml, htmlToPdf, imagen } = require('../lib/pdf');

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

function sendJson(res, status, obj) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
}

/** Número visible en el PDF según el formato de la empresa. */
function formatearNumero(emp, anio, n) {
    const num = emp.numeracion || { formato: 'anio' };
    if (num.formato === 'serie') {
        return `${num.serie || '0001'} - ${String(n).padStart(num.digitos || 7, '0')}`;
    }
    return `${anio}-${String(n).padStart(6, '0')}`;
}

// La firma escaneada NO va en el repositorio (es público): se guarda en el
// bucket privado como  ordenes-pdf/_firmas/<archivo>.png  y se cachea aquí.
const _firmas = {};
async function obtenerFirma(sb, archivo) {
    if (!archivo) return null;
    const local = imagen(archivo);           // permite una copia local (ignorada por git)
    if (local) return local;
    if (archivo in _firmas) return _firmas[archivo];
    const { data, error } = await sb.storage.from('ordenes-pdf').download(`_firmas/${archivo}`);
    _firmas[archivo] = (error || !data) ? null
        : `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
    return _firmas[archivo];
}

/** Empresa desde la tabla `empresas`; si la tabla aún no existe, usa el catálogo. */
async function resolverEmpresa(sb, codigo) {
    if (!/^[a-z0-9_-]{2,40}$/.test(codigo)) return null;
    const { data, error } = await sb.from('empresas').select('*').eq('codigo', codigo).maybeSingle();
    if (error) {
        const base = catalogo.getEmpresa(codigo);
        return base ? catalogo.normalizarEmpresa({ codigo }) : null;
    }
    if (!data || data.activo === false) return null;
    return catalogo.normalizarEmpresa(data);
}

/** Solo acepta imágenes PNG/JPEG/WEBP en base64 (lo demás se ignora). */
function dataUrlSegura(v) {
    return typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}

function copiarARed(empresa, anio, mes, nombre, buffer) {
    const base = process.env.SHARED_FOLDER;
    if (!base) return;
    try {
        const dir = path.join(base, empresa, String(anio), mes);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, nombre), buffer);
    } catch (e) {
        console.warn('No se pudo copiar a la carpeta de red:', e.message);
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
        return sendJson(res, 500, { error: 'Faltan variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE' });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let reserva = null; // { empresa, tipo, periodo, n } para liberar si algo falla
    try {
        // 1) Autenticación
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return sendJson(res, 401, { error: 'No autenticado' });
        const { data: userData, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userData || !userData.user) return sendJson(res, 401, { error: 'Sesión inválida' });
        const user = userData.user;
        const creado_por_email = user.email || null;
        const creado_por_nombre = (user.user_metadata && user.user_metadata.nombre) || null;

        // 2) Validación contra el catálogo
        const body = await readBody(req);
        const preview = !!body.preview;
        const data = body.data && typeof body.data === 'object' ? body.data : null;
        const tpl = catalogo.TEMPLATES[body.template];
        if (!tpl || !data) return sendJson(res, 400, { error: 'Plantilla o datos inválidos' });
        // Plantillas propias van atadas a su empresa; las NISIRA ('*') sirven a cualquiera con ese formato
        const codigoEmpresa = tpl.empresa === '*' ? String(body.empresa || '') : tpl.empresa;
        const emp = await resolverEmpresa(sb, codigoEmpresa);
        if (!emp) return sendJson(res, 400, { error: 'Empresa no encontrada o inactiva' });
        if (!catalogo.plantillasDe(emp).some(t => t.name === tpl.name)) {
            return sendJson(res, 400, { error: 'Esa plantilla no corresponde a la empresa elegida' });
        }
        if (!Array.isArray(data.items) || data.items.length === 0) {
            return sendJson(res, 400, { error: 'La orden debe tener al menos un item' });
        }
        if (typeof data.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
            return sendJson(res, 400, { error: 'Fecha inválida' });
        }

        // Toda variable que la plantilla usa debe existir (EJS lanza ReferenceError si falta)
        for (const f of tpl.fields) {
            if (f.type === 'array' || data[f.name] !== undefined) continue;
            data[f.name] = f.type === 'checkbox' ? false : '';
        }

        const tipoDoc = tpl.tipoDoc || 'OC';
        const anio = parseInt(data.fecha.slice(0, 4), 10);
        const mes = data.fecha.slice(5, 7);
        const periodo = (emp.numeracion && emp.numeracion.formato === 'serie') ? 0 : anio;

        // 3) Importes
        const calc = calcular(tpl.calculo, data, tpl.moneda);

        // 4) Correlativo (no en vista previa)
        let correlativo = null;
        let numero = 'BORRADOR';
        if (!preview) {
            const { data: n, error: corrErr } = await sb.rpc('siguiente_correlativo', {
                p_empresa: emp.codigo, p_tipo_doc: tipoDoc, p_periodo: periodo
            });
            if (corrErr) throw new Error('No se pudo reservar el correlativo: ' + corrErr.message);
            correlativo = n;
            reserva = { p_empresa: emp.codigo, p_tipo_doc: tipoDoc, p_periodo: periodo, p_numero: n };
            numero = formatearNumero(emp, anio, n);
        }

        // 5) Render -> PDF
        const html = renderHtml(tpl.archivo || tpl.name, {
            ...data,                 // plantillas antiguas leen las variables sueltas
            numero_oc: numero,
            d: data,                 // plantilla NISIRA
            calc, emp, numero, tipoDoc,
            logo: dataUrlSegura(emp.logoData) || imagen(emp.logo),
            firma: dataUrlSegura(emp.firmaData) || await obtenerFirma(sb, emp.firma).catch(() => null),
            elaborado: creado_por_nombre || creado_por_email || '',
            logoViviana: imagen('logo-viviana.png'),
            logoCamafra: imagen('logo-camafra.png')
        });
        const pdfBuffer = await htmlToPdf(html);

        const nombreArchivo = `${tipoDoc}_${numero.replace(/\s+/g, '')}.pdf`;
        const advertencias = [];

        // 6) Archivar + registrar
        if (!preview) {
            const pdfPath = `${emp.codigo}/${tipoDoc}/${anio}/${mes}/${nombreArchivo}`;
            const { error: upErr } = await sb.storage.from('ordenes-pdf')
                .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
            if (upErr) {
                console.error('Error subiendo a Storage:', upErr.message);
                advertencias.push('El PDF no se archivó en la nube; guarda la copia descargada.');
            }

            const { error: insErr } = await sb.from('ordenes').insert({
                empresa: emp.codigo,
                tipo_doc: tipoDoc,
                numero_oc: numero,
                anio,
                correlativo,
                template: tpl.name,
                proveedor_razon_social: data.proveedor_razon_social || null,
                obra: data.obra || null,
                fecha: data.fecha,
                total: calc.total,
                moneda: calc.moneda,
                pdf_path: upErr ? null : pdfPath,
                datos: data,
                creado_por_email,
                creado_por_nombre
            });
            if (insErr) {
                console.error('Error registrando la orden:', insErr.message);
                advertencias.push('La orden no quedó en el historial: ' + insErr.message);
            }
            reserva = null; // el número ya está usado en un PDF entregado
            copiarARed(emp.codigo, anio, mes, nombreArchivo, pdfBuffer);
        }

        // 7) Respuesta
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombreArchivo)}"`);
        res.setHeader('X-Numero-OC', encodeURIComponent(numero));
        res.setHeader('X-Nombre-Archivo', encodeURIComponent(nombreArchivo));
        if (advertencias.length) res.setHeader('X-Advertencia', encodeURIComponent(advertencias.join(' ')));
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);

    } catch (error) {
        console.error('Error generando PDF:', error);
        // Devuelve el número si el PDF nunca llegó al usuario (evita huecos en la numeración)
        if (reserva) {
            await sb.rpc('liberar_correlativo', reserva).then(() => {}, () => {});
        }
        return sendJson(res, 500, { error: error.message || 'Error desconocido al generar PDF' });
    }
};
