// ============================================================
// postinstall: compatibilidad de yargs 17 con Node >= 22 en Vercel
// ============================================================
// puppeteer-core -> @puppeteer/browsers hace require('yargs/yargs').
// Ese archivo NO tiene extensión y vive en un paquete "type": "module",
// así que Node moderno lo trata como ESM y el runtime de Vercel falla con
// ERR_REQUIRE_ESM (FUNCTION_INVOCATION_FAILED al cargar /api/generate-pdf).
// Su contenido es CommonJS: lo copiamos como yargs.cjs y apuntamos ahí el
// "require" del mapa de exports. Es idempotente y no hace nada si no aplica.
// ============================================================
const fs = require('fs');
const path = require('path');

function parchar(dir) {
    const pkgFile = path.join(dir, 'package.json');
    const src = path.join(dir, 'yargs');
    if (!fs.existsSync(pkgFile) || !fs.existsSync(src)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const exp = pkg.exports && pkg.exports['./yargs'];
    if (!Array.isArray(exp) || !exp[0] || exp[0].require !== './yargs') return false;

    fs.copyFileSync(src, path.join(dir, 'yargs.cjs'));
    exp[0].require = './yargs.cjs';
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
    return true;
}

const raiz = path.join(__dirname, '..', 'node_modules');
const candidatos = [
    path.join(raiz, 'yargs'),
    path.join(raiz, 'puppeteer-core', 'node_modules', 'yargs'),
    path.join(raiz, 'puppeteer-core', 'node_modules', '@puppeteer', 'browsers', 'node_modules', 'yargs')
];
const hechos = candidatos.filter(parchar);
console.log(hechos.length ? `fix-yargs: parcheado ${hechos.length} copia(s)` : 'fix-yargs: nada que parchar');
