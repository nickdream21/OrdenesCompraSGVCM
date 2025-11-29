const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes/apiRoutes');

// Initialize Express
const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRoutes);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';

    // Detect local IP
    for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIP = iface.address;
                break;
            }
        }
    }

    const sharedFolderStatus = config.SHARED_FOLDER
        ? `✅ Activa: ${config.SHARED_FOLDER}`
        : '❌ Desactivada (edita server/config.js)';

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🚀 SISTEMA DE ÓRDENES DE COMPRA (OPTIMIZADO)         ║
║                                                           ║
║     🌐 Acceso local:  http://localhost:${PORT}            ║
║     🌐 Acceso en red: http://${localIP}:${PORT}       ║
║                                                           ║
║     ⚡ Optimizaciones Activas:                           ║
║        - Puppeteer Singleton (Rápido)                    ║
║        - Caché de Assets (Logos en memoria)              ║
║        - Arquitectura Modular                            ║
║                                                           ║
║     🌐 Carpeta compartida: ${sharedFolderStatus}
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
