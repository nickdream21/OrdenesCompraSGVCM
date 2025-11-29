const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../../templates');

// Ensure templates directory exists
if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

exports.getAllTemplates = (req, res) => {
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
                    name: file.replace('.ejs', ''),
                    filename: file,
                    config: config
                };
            });

        res.json(templates);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getTemplateByName = (req, res) => {
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

        res.json({ config, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveTemplate = (req, res) => {
    try {
        const { name, content, config } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                success: false,
                error: 'Nombre y contenido son requeridos'
            });
        }

        // Add config to template content if provided
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
};

exports.deleteTemplate = (req, res) => {
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
};
