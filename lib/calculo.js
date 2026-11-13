// ============================================================
// CÁLCULO DE IMPORTES Y MONTO EN LETRAS
// ============================================================
// Se calcula en el SERVIDOR (no en la plantilla) para que el PDF
// y el total guardado en el historial sean siempre el mismo número.

const IGV = 0.18;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const MONEDAS = {
    PEN: { simbolo: 'S/', texto: 'SOLES' },
    'S/.': { simbolo: 'S/', texto: 'SOLES' },
    USD: { simbolo: 'US$', texto: 'DÓLARES AMERICANOS' }
};

/**
 * @param {string} modo  'igv' | 'sin_igv' | 'nisira'
 * @param {object} data  datos del formulario (items, moneda, precios_incluyen_igv)
 * @param {string} monedaDefecto moneda de la plantilla si el formulario no la trae
 */
function calcular(modo, data, monedaDefecto) {
    const items = Array.isArray(data.items) ? data.items : [];
    const moneda = (modo === 'nisira' ? data.moneda : null) || monedaDefecto || 'PEN';
    const incluyeIgv = modo === 'nisira' && (data.precios_incluyen_igv === true || data.precios_incluyen_igv === 'true');

    let brutoTotal = 0;
    const lineas = items.map((it, i) => {
        const cantidad = num(it.cantidad);
        const precio = num(it.precio_unitario);
        const bruto = cantidad * precio;
        brutoTotal += bruto;
        // Si el precio incluye IGV, el valor de la línea se muestra sin IGV (como NISIRA)
        const precioNeto = incluyeIgv ? precio / (1 + IGV) : precio;
        return {
            ...it,
            item: String(i + 1).padStart(3, '0'),
            cantidad,
            precio_unitario: precioNeto,
            importe: round2(cantidad * precioNeto)
        };
    });

    const valorVenta = round2(lineas.reduce((s, l) => s + l.importe, 0));
    let igv, total;
    if (modo === 'sin_igv') {
        igv = 0;
        total = valorVenta;
    } else if (incluyeIgv) {
        total = round2(brutoTotal);       // lo que el usuario realmente pactó
        igv = round2(total - valorVenta); // el IGV cuadra exacto con el total
    } else {
        igv = round2(valorVenta * IGV);
        total = round2(valorVenta + igv);
    }

    const mon = MONEDAS[moneda] || { simbolo: moneda, texto: moneda };
    return {
        lineas,
        valorVenta,
        igv,
        igvPorcentaje: modo === 'sin_igv' ? 0 : IGV * 100,
        total,
        moneda: moneda === 'S/.' ? 'PEN' : moneda,
        monedaSimbolo: mon.simbolo,
        son: montoEnLetras(total, mon.texto)
    };
}

// ------------------------------------------------------------
// Número a letras (español, mayúsculas) — "CINCO MIL Y 00/100 SOLES"
// ------------------------------------------------------------
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorMil(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const r = n % 100;
    let s = CENTENAS[c];
    if (r > 0) {
        let t;
        if (r < 30) t = UNIDADES[r];
        else {
            const d = Math.floor(r / 10), u = r % 10;
            t = DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
        }
        s = s ? s + ' ' + t : t;
    }
    return s;
}

// "UNO" -> "UN" delante de MIL / MILLÓN(ES)
const apocope = (s) => s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');

function enteroALetras(n) {
    if (n === 0) return 'CERO';
    const millones = Math.floor(n / 1e6);
    const miles = Math.floor((n % 1e6) / 1000);
    const resto = n % 1000;
    const partes = [];
    if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : apocope(enteroALetras(millones)) + ' MILLONES');
    if (miles) partes.push(miles === 1 ? 'MIL' : apocope(menorMil(miles)) + ' MIL');
    if (resto) partes.push(menorMil(resto));
    return partes.join(' ');
}

function montoEnLetras(monto, monedaTexto) {
    const cent = Math.round(monto * 100);
    const entero = Math.floor(cent / 100);
    const dec = String(cent % 100).padStart(2, '0');
    return `${enteroALetras(entero)} Y ${dec}/100 ${monedaTexto}`;
}

module.exports = { calcular, montoEnLetras, round2, IGV };
