const pdfService = require('../services/pdfService');
const fs = require('fs');

exports.generatePdf = async (req, res) => {
    try {
        const { template, data, filename } = req.body;

        console.log('Generando PDF para template:', template);

        if (!template || !data) {
            return res.status(400).json({
                success: false,
                error: 'Template y data son requeridos'
            });
        }

        const result = await pdfService.generatePdf(template, data, filename);

        // Send PDF to browser
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.buffer.length);
        res.send(result.buffer);

    } catch (error) {
        console.error('Error in generatePdf controller:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error desconocido al generar PDF'
        });
    }
};

exports.getGeneratedFiles = (req, res) => {
    try {
        const files = pdfService.getGeneratedFiles();
        res.json(files);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.downloadPdf = (req, res) => {
    try {
        const filePath = pdfService.getFilePath(req.params.filename);

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
};
