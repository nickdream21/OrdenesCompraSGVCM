const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const pdfController = require('../controllers/pdfController');

// Template Routes
router.get('/templates', templateController.getAllTemplates);
router.get('/templates/:name', templateController.getTemplateByName);
router.post('/templates', templateController.saveTemplate);
router.delete('/templates/:name', templateController.deleteTemplate);

// PDF Routes
router.post('/generate-pdf', pdfController.generatePdf);
router.get('/generated', pdfController.getGeneratedFiles);
router.get('/download/:filename', pdfController.downloadPdf);

module.exports = router;
