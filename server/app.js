const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const moment = require('moment');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Directorios
const TEMPLATES_DIR = path.join(__dirname, '../templates');
const GENERATED_DIR = path.join(__dirname, '../generated');

// Asegurar que existan los directorios
[TEMPLATES_DIR, GENERATED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ============================================
// RUTAS DE LA API
// ============================================

// Obtener lista de templates disponibles
app.get('/api/templates', (req, res) => {
    try {
        const templates = fs.readdirSync(TEMPLATES_DIR)
            .filter(file => file.endsWith('.ejs'))
            .map(file => {
                const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
                const configMatch = content.match(/<%#\s*CONFIG:\s*({[\s\S]*?})\s*%>/);
                
                let config = {
                    name: file.replace('.ejs', ''),
                    displayName: file.replace('.ejs', '').replace(/_/g, ' '),
                    fields: []
                };

                if (configMatch) {
                    try {
                        const parsedConfig = JSON.parse(configMatch[1]);
                        config = { ...config, ...parsedConfig };
                    } catch (e) {
                        console.error(`Error parsing config for ${file}:`, e);
                    }
                }

                return {
                    filename: file,
                    ...config
                };
            });

        res.json({ success: true, templates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener configuración de un template específico
app.get('/api/templates/:name', (req, res) => {
    try {
        const templatePath = path.join(TEMPLATES_DIR, `${req.params.name}.ejs`);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ success: false, error: 'Template no encontrado' });
        }

        const content = fs.readFileSync(templatePath, 'utf-8');
        const configMatch = content.match(/<%#\s*CONFIG:\s*({[\s\S]*?})\s*%>/);

        let config = {
            name: req.params.name,
            displayName: req.params.name.replace(/_/g, ' '),
            fields: []
        };

        if (configMatch) {
            try {
                const parsedConfig = JSON.parse(configMatch[1]);
                config = { ...config, ...parsedConfig };
            } catch (e) {
                console.error(`Error parsing config:`, e);
            }
        }

        res.json({ success: true, config, template: content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generar PDF
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { template, data, filename } = req.body;

        if (!template || !data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Template y data son requeridos' 
            });
        }

        // Leer el template
        const templatePath = path.join(TEMPLATES_DIR, `${template}.ejs`);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Template no encontrado' 
            });
        }

        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        // Renderizar el HTML con EJS
        const html = ejs.render(templateContent, { 
            ...data, 
            moment,
            formatCurrency: (value, currency = 'S/.') => {
                const num = parseFloat(value) || 0;
                return `${currency} ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
            },
            formatNumber: (value, decimals = 2) => {
                const num = parseFloat(value) || 0;
                return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
        });

        // Generar PDF con Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfFilename = filename || `OC_${data.oc_number || Date.now()}.pdf`;
        const pdfPath = path.join(GENERATED_DIR, pdfFilename);

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        await browser.close();

        res.json({ 
            success: true, 
            filename: pdfFilename,
            path: pdfPath,
            downloadUrl: `/api/download/${pdfFilename}`
        });

    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Descargar PDF generado
app.get('/api/download/:filename', (req, res) => {
    try {
        const filePath = path.join(GENERATED_DIR, req.params.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Archivo no encontrado' 
            });
        }

        res.download(filePath);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Listar PDFs generados
app.get('/api/generated', (req, res) => {
    try {
        const files = fs.readdirSync(GENERATED_DIR)
            .filter(file => file.endsWith('.pdf'))
            .map(file => {
                const stats = fs.statSync(path.join(GENERATED_DIR, file));
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    downloadUrl: `/api/download/${file}`
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json({ success: true, files });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Guardar nuevo template
app.post('/api/templates', (req, res) => {
    try {
        const { name, content, config } = req.body;

        if (!name || !content) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nombre y contenido son requeridos' 
            });
        }

        // Agregar configuración al inicio del template
        let templateContent = content;
        if (config) {
            const configComment = `<%# CONFIG: ${JSON.stringify(config)} %>`;
            templateContent = configComment + '\n' + content;
        }

        const templatePath = path.join(TEMPLATES_DIR, `${name}.ejs`);
        fs.writeFileSync(templatePath, templateContent, 'utf-8');

        res.json({ 
            success: true, 
            message: 'Template guardado correctamente',
            filename: `${name}.ejs`
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Eliminar template
app.delete('/api/templates/:name', (req, res) => {
    try {
        const templatePath = path.join(TEMPLATES_DIR, `${req.params.name}.ejs`);
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Template no encontrado' 
            });
        }

        fs.unlinkSync(templatePath);
        res.json({ 
            success: true, 
            message: 'Template eliminado correctamente' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🚀 SISTEMA DE ÓRDENES DE COMPRA INICIADO             ║
║                                                           ║
║     🌐 Servidor corriendo en: http://localhost:${PORT}    ║
║     📁 Templates: ${TEMPLATES_DIR}                        
║     📄 PDFs generados: ${GENERATED_DIR}                   
║                                                           ║
║     👉 Abre tu navegador en http://localhost:${PORT}      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
