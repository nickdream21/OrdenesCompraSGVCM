const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const config = require('../config');

// Configure moment
moment.locale('es');

class PdfService {
    constructor() {
        this.browser = null;
        this.logoViviana = null;
        this.logoCamafra = null;
        this.templatesDir = path.join(__dirname, '../../templates');
        this.generatedDir = path.join(__dirname, '../../generated');
        this.publicDir = path.join(__dirname, '../../public');

        this.init();
    }

    async init() {
        // Ensure directories exist
        [this.templatesDir, this.generatedDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Cache logos
        this.loadLogos();

        // Initialize browser
        await this.getBrowser();
    }

    loadLogos() {
        try {
            const logoVivianaPath = path.join(this.publicDir, 'images/logo-viviana.png');
            const logoCamafraPath = path.join(this.publicDir, 'images/logo-camafra.png');

            if (fs.existsSync(logoVivianaPath)) {
                const buffer = fs.readFileSync(logoVivianaPath);
                this.logoViviana = `data:image/png;base64,${buffer.toString('base64')}`;
            }

            if (fs.existsSync(logoCamafraPath)) {
                const buffer = fs.readFileSync(logoCamafraPath);
                this.logoCamafra = `data:image/png;base64,${buffer.toString('base64')}`;
            }
            console.log('✅ Logos cached in memory');
        } catch (error) {
            console.error('❌ Error loading logos:', error);
        }
    }

    async getBrowser() {
        if (!this.browser) {
            console.log('🚀 Launching Puppeteer browser...');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            
            // Handle browser disconnect/crash
            this.browser.on('disconnected', () => {
                console.log('⚠️ Browser disconnected, resetting instance...');
                this.browser = null;
            });
        }
        return this.browser;
    }

    async generatePdf(templateName, data, filename) {
        let page = null;
        try {
            const templatePath = path.join(this.templatesDir, `${templateName}.ejs`);

            if (!fs.existsSync(templatePath)) {
                throw new Error('Template no encontrado');
            }

            const templateContent = fs.readFileSync(templatePath, 'utf-8');

            // Render HTML
            const html = ejs.render(templateContent, {
                ...data,
                moment,
                logoViviana: this.logoViviana,
                logoCamafra: this.logoCamafra,
                formatCurrency: (value, currency = 'S/.') => {
                    const num = parseFloat(value) || 0;
                    return `${currency} ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
                },
                formatNumber: (value, decimals = 2) => {
                    const num = parseFloat(value) || 0;
                    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                }
            });

            const browser = await this.getBrowser();
            page = await browser.newPage();

            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
            });

            // Save locally
            const pdfFilename = filename || `OC_${data.numero_oc || Date.now()}.pdf`;
            const pdfPath = path.join(this.generatedDir, pdfFilename);
            fs.writeFileSync(pdfPath, pdfBuffer);
            console.log('📄 PDF guardado localmente en:', pdfPath);

            // Save to shared folder
            const empresaName = data.empresa || templateName.split('_')[0];
            this.saveToSharedFolder(pdfBuffer, pdfFilename, empresaName);

            return { buffer: pdfBuffer, filename: pdfFilename, path: pdfPath };

        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        } finally {
            if (page) await page.close();
        }
    }

    saveToSharedFolder(pdfBuffer, filename, empresa = '') {
        try {
            if (!config.SHARED_FOLDER) return;

            if (!fs.existsSync(config.SHARED_FOLDER)) {
                console.warn(`⚠️  Carpeta compartida no encontrada: ${config.SHARED_FOLDER}`);
                return;
            }

            let targetPath = config.SHARED_FOLDER;

            if (config.USE_COMPANY_SUBFOLDERS && empresa) {
                targetPath = path.join(targetPath, empresa.toLowerCase());
            }

            if (config.USE_DATE_SUBFOLDERS) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                targetPath = path.join(targetPath, String(year), month);
            }

            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            const fullPath = path.join(targetPath, filename);
            fs.writeFileSync(fullPath, pdfBuffer);
            console.log(`✅ PDF guardado en carpeta compartida: ${fullPath}`);

        } catch (error) {
            console.error('❌ Error guardando en carpeta compartida:', error.message);
        }
    }

    getGeneratedFiles() {
        try {
            if (!fs.existsSync(this.generatedDir)) return [];
            
            return fs.readdirSync(this.generatedDir)
                .filter(file => file.endsWith('.pdf'))
                .map(file => {
                    const stats = fs.statSync(path.join(this.generatedDir, file));
                    return {
                        name: file,
                        size: stats.size,
                        date: stats.birthtime,
                        downloadUrl: `/api/download/${file}`
                    };
                })
                .sort((a, b) => b.date - a.date);
        } catch (error) {
            console.error('Error listing files:', error);
            return [];
        }
    }

    getFilePath(filename) {
        return path.join(this.generatedDir, filename);
    }
}

module.exports = new PdfService();
