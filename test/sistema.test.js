// Ejecutar con: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { calcular, montoEnLetras } = require('../lib/calculo');
const { renderHtml, TEMPLATES_DIR } = require('../lib/pdf');
const catalogo = require('../public/js/config.js');

test('monto en letras (formato NISIRA)', () => {
    assert.equal(montoEnLetras(5000, 'SOLES'), 'CINCO MIL Y 00/100 SOLES');
    assert.equal(montoEnLetras(100.01, 'SOLES'), 'CIEN Y 01/100 SOLES');
    assert.equal(montoEnLetras(1521.5, 'SOLES'), 'MIL QUINIENTOS VEINTIUNO Y 50/100 SOLES');
    assert.equal(montoEnLetras(21000, 'SOLES'), 'VEINTIÚN MIL Y 00/100 SOLES');
    assert.equal(montoEnLetras(1000000, 'SOLES'), 'UN MILLÓN Y 00/100 SOLES');
    assert.equal(montoEnLetras(2345678.9, 'DÓLARES AMERICANOS'),
        'DOS MILLONES TRESCIENTOS CUARENTA Y CINCO MIL SEISCIENTOS SETENTA Y OCHO Y 90/100 DÓLARES AMERICANOS');
    assert.equal(montoEnLetras(0.5, 'SOLES'), 'CERO Y 50/100 SOLES');
});

test('cálculo NISIRA: precio sin IGV (reproduce OS 106)', () => {
    const c = calcular('nisira', { moneda: 'PEN', items: [{ cantidad: 1, precio_unitario: 84.75 }] });
    assert.equal(c.valorVenta, 84.75);
    assert.equal(c.igv, 15.26);
    assert.equal(c.total, 100.01);
    assert.equal(c.son, 'CIEN Y 01/100 SOLES');
});

test('cálculo NISIRA: precios con IGV incluido cuadran al céntimo', () => {
    const c = calcular('nisira', {
        moneda: 'PEN', precios_incluyen_igv: true,
        items: [{ cantidad: 2000, precio_unitario: 0.0325 }, { cantidad: 6000, precio_unitario: 0.31 }]
    });
    assert.equal(c.total, 1925);
    assert.equal(Math.round((c.valorVenta + c.igv) * 100), 192500);
});

test('cálculo importación: sin IGV y en USD', () => {
    const c = calcular('sin_igv', { items: [{ cantidad: 3, precio_unitario: 10.5 }] }, 'USD');
    assert.equal(c.igv, 0);
    assert.equal(c.total, 31.5);
    assert.equal(c.moneda, 'USD');
});

test('catálogo: cada plantilla tiene empresa válida y archivo .ejs', () => {
    for (const t of Object.values(catalogo.TEMPLATES)) {
        assert.ok(catalogo.getEmpresa(t.empresa), `empresa inexistente en ${t.name}`);
        assert.ok(['OC', 'OS'].includes(t.tipoDoc), `tipoDoc inválido en ${t.name}`);
        const file = path.join(TEMPLATES_DIR, `${t.archivo || t.name}.ejs`);
        assert.ok(fs.existsSync(file), `falta ${file}`);
    }
});

test('todas las plantillas renderizan con datos mínimos', () => {
    for (const t of Object.values(catalogo.TEMPLATES)) {
        const data = { items: [{ cantidad: '2', unidad: 'UND', descripcion: 'PRUEBA <b>', precio_unitario: '10' }] };
        for (const f of t.fields) {
            if (f.type === 'array') continue;
            data[f.name] = f.type === 'checkbox' ? false : (f.type === 'date' ? '2026-11-13' : 'X');
        }
        const emp = catalogo.getEmpresa(t.empresa);
        const calc = calcular(t.calculo, data, t.moneda);
        const html = renderHtml(t.archivo || t.name, {
            ...data, numero_oc: 'T-1', d: data, calc, emp, numero: 'T-1', tipoDoc: t.tipoDoc,
            logo: null, firma: null, elaborado: 'Tester', logoViviana: null, logoCamafra: null
        });
        assert.match(html, /<\/html>/i, t.name);
        assert.ok(!html.includes('PRUEBA <b>'), `${t.name}: el texto del usuario debe ir escapado`);
    }
});
