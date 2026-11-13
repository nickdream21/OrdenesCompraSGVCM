// ============================================================
// SERVIDOR LOCAL (desarrollo / uso en red de oficina)
// ============================================================
// Sirve /public y monta EXACTAMENTE la misma función que usa Vercel
// (api/generate-pdf.js), así no hay dos versiones distintas del PDF.
//
// Requiere un archivo .env (ver .env.example) con SUPABASE_URL y
// SUPABASE_SERVICE_ROLE. Usa el Chrome/Edge instalado en la PC.
// ============================================================
const path = require('path');
const fs = require('fs');

// Carga mínima de .env sin dependencias
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf-8').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
}

const express = require('express');
const config = require('./config');

if (config.SHARED_FOLDER && !process.env.SHARED_FOLDER) process.env.SHARED_FOLDER = config.SHARED_FOLDER;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/generate-pdf', require('../api/generate-pdf'));
app.get('/api/keepalive', require('../api/keepalive'));

app.listen(config.PORT, '0.0.0.0', () => {
    const ips = Object.values(require('os').networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log(`\n  Órdenes de Compra — servidor local`);
    console.log(`  Local:  http://localhost:${config.PORT}`);
    ips.forEach(ip => console.log(`  Red:    http://${ip}:${config.PORT}`));
    console.log(`  Carpeta de red: ${process.env.SHARED_FOLDER || '(desactivada)'}`);
    if (!process.env.SUPABASE_URL) console.warn('  ⚠  Falta .env con SUPABASE_URL / SUPABASE_SERVICE_ROLE');
    console.log('');
});
