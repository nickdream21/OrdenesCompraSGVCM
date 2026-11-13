// ============================================================
// RENDER EJS -> PDF (mismo código en Vercel y en local)
// ============================================================
// - En Vercel/Linux serverless: @sparticuz/chromium.
// - En local (Windows/Mac): el Chrome/Edge ya instalado en la PC
//   (o la ruta de la variable CHROME_PATH). Ya no hace falta el
//   paquete `puppeteer` completo ni descargar Chromium.
// ============================================================

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const puppeteer = require('puppeteer-core');

moment.locale('es');

const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let _browserPromise = null;
const _imgCache = {};

const LOCAL_CHROME_PATHS = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
].filter(Boolean);

async function launch() {
    if (IS_SERVERLESS) {
        const chromium = require('@sparticuz/chromium');
        return puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });
    }
    const exe = LOCAL_CHROME_PATHS.find(p => fs.existsSync(p));
    if (!exe) throw new Error('No se encontró Chrome/Edge. Define la variable CHROME_PATH.');
    return puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
}

async function getBrowser() {
    if (_browserPromise) {
        const b = await _browserPromise.catch(() => null);
        if (b && b.connected) return b;
    }
    // Se guarda la PROMESA para que dos peticiones simultáneas no lancen dos navegadores
    _browserPromise = launch();
    return _browserPromise;
}

/** Devuelve la imagen como data-URI (cacheada) o null si no existe. */
function imagen(file) {
    if (!file) return null;
    if (file in _imgCache) return _imgCache[file];
    const p = path.join(IMAGES_DIR, path.basename(file));
    _imgCache[file] = fs.existsSync(p)
        ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
        : null;
    return _imgCache[file];
}

// Fuentes incrustadas (SIL OFL): métricas idénticas a Times / Arial / Courier.
// Vercel (Linux) no trae las fuentes de Windows; así el PDF sale igual en todos lados.
let _fontCss = null;
function fontFaceCss() {
    if (_fontCss !== null) return _fontCss;
    const dir = path.join(ROOT, 'assets', 'fonts');
    const fams = { Tinos: 'tinos', Arimo: 'arimo', Cousine: 'cousine' };
    _fontCss = Object.entries(fams).flatMap(([fam, file]) => [400, 700].map(w => {
        const p = path.join(dir, `${file}-latin-${w}-normal.woff2`);
        if (!fs.existsSync(p)) return '';
        const b64 = fs.readFileSync(p).toString('base64');
        return `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    })).join('\n');
    return _fontCss;
}

function formatNumber(value, decimals = 2) {
    const n = parseFloat(value) || 0;
    const [ent, dec] = n.toFixed(decimals).split('.');
    return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
}
function formatCurrency(value, currency = 'S/.') {
    return `${currency} ${formatNumber(value, 2)}`;
}

function renderHtml(templateName, vars) {
    const file = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
    const tpl = fs.readFileSync(file, 'utf-8');
    return ejs.render(tpl, { moment, formatNumber, formatCurrency, fontFaceCss, ...vars }, { filename: file });
}

async function htmlToPdf(html) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        // Todo va embebido (logos en base64): no hace falta esperar red
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
        return Buffer.from(await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
        }));
    } finally {
        await page.close().catch(() => {});
    }
}

module.exports = { renderHtml, htmlToPdf, imagen, formatNumber, formatCurrency, TEMPLATES_DIR };
