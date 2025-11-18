// ==================== CONFIGURACIÓN ====================
const API_URL = 'http://localhost:3000/api';

// ==================== VARIABLES GLOBALES ====================
let currentTemplate = null;
let templates = [];

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadTemplates();
    loadHistory();
    setupEventListeners();
});

// ==================== GESTIÓN DE TABS ====================
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Cargar datos si es necesario
    if (tabName === 'history') {
        loadHistory();
    } else if (tabName === 'templates') {
        loadTemplatesGrid();
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Formulario de OC
    document.getElementById('ocForm')?.addEventListener('submit', handleGeneratePDF);
    document.getElementById('clearForm')?.addEventListener('click', clearForm);
    document.getElementById('previewBtn')?.addEventListener('click', previewPDF);

    // Historial
    document.getElementById('refreshHistoryBtn')?.addEventListener('click', loadHistory);

    // Editor de templates
    document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);
    document.getElementById('newTemplateBtn')?.addEventListener('click', () => {
        switchTab('editor');
        document.getElementById('templateName').value = '';
        document.getElementById('templateEditor').value = '';
    });
}

// ==================== GESTIÓN DE TEMPLATES ====================
async function loadTemplates() {
    try {
        const response = await fetch(`${API_URL}/templates`);
        const data = await response.json();

        if (data.success) {
            templates = data.templates;
            renderTemplateSelector(templates);
        } else {
            showToast('Error cargando templates', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    }
}

function renderTemplateSelector(templates) {
    const selector = document.getElementById('templateSelector');
    
    if (templates.length === 0) {
        selector.innerHTML = `
            <div class="loading">
                <i class="fas fa-folder-open"></i>
                <p>No hay templates disponibles. Crea uno en la pestaña "Editor de Templates".</p>
            </div>
        `;
        return;
    }

    selector.innerHTML = templates.map(template => `
        <div class="template-card" onclick="selectTemplate('${template.filename.replace('.ejs', '')}')">
            <h4>${template.displayName || template.name}</h4>
            <p>${template.description || 'Sin descripción'}</p>
            <span class="template-badge">${template.fields?.length || 0} campos</span>
        </div>
    `).join('');
}

function selectTemplate(templateName) {
    // Remover selección anterior
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Seleccionar nuevo
    event.currentTarget.classList.add('selected');
    currentTemplate = templates.find(t => t.filename === `${templateName}.ejs`);

    // Mostrar formulario
    document.getElementById('formSection').style.display = 'block';
    renderForm(currentTemplate);

    // Scroll al formulario
    document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
}

function renderForm(template) {
    const formFields = document.getElementById('formFields');
    
    if (!template.fields || template.fields.length === 0) {
        formFields.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                Este template no tiene campos configurados. Usa el editor para agregar configuración.
            </div>
        `;
        return;
    }

    formFields.innerHTML = template.fields.map(field => {
        const required = field.required ? 'required' : '';
        const label = field.required ? `<label class="form-label required">` : `<label class="form-label">`;

        switch(field.type) {
            case 'textarea':
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <textarea name="${field.name}" class="form-control" 
                                  placeholder="${field.placeholder || ''}" ${required}></textarea>
                    </div>
                `;
            
            case 'number':
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <input type="number" name="${field.name}" class="form-control" 
                               placeholder="${field.placeholder || ''}" 
                               step="${field.step || 'any'}" ${required}>
                    </div>
                `;

            case 'date':
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <input type="date" name="${field.name}" class="form-control" ${required}>
                    </div>
                `;

            case 'select':
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <select name="${field.name}" class="form-control" ${required}>
                            <option value="">Seleccione...</option>
                            ${field.options?.map(opt => `<option value="${opt}">${opt}</option>`).join('') || ''}
                        </select>
                    </div>
                `;

            case 'array':
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <div id="array_${field.name}">
                            <button type="button" class="btn btn-secondary btn-sm" 
                                    onclick="addArrayItem('${field.name}', ${JSON.stringify(field.fields).replace(/"/g, '&quot;')})">
                                <i class="fas fa-plus"></i> Agregar ${field.itemLabel || 'Item'}
                            </button>
                            <div class="array-items"></div>
                        </div>
                    </div>
                `;

            default: // text
                return `
                    <div class="form-group">
                        ${label}${field.label}</label>
                        <input type="text" name="${field.name}" class="form-control" 
                               placeholder="${field.placeholder || ''}" ${required}>
                    </div>
                `;
        }
    }).join('');
}

// ==================== MANEJO DE ARRAYS DINÁMICOS ====================
window.addArrayItem = function(arrayName, fields) {
    const container = document.querySelector(`#array_${arrayName} .array-items`);
    const index = container.children.length;

    const itemHTML = `
        <div class="card" style="margin-top: 1rem; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <strong>Item ${index + 1}</strong>
                <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ${fields.map(field => `
                <div class="form-group">
                    <label class="form-label">${field.label}</label>
                    <input type="${field.type || 'text'}" 
                           name="${arrayName}[${index}][${field.name}]" 
                           class="form-control"
                           step="${field.step || 'any'}">
                </div>
            `).join('')}
        </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
};

// ==================== GENERACIÓN DE PDF ====================
async function handleGeneratePDF(e) {
    e.preventDefault();

    if (!currentTemplate) {
        showToast('Selecciona un template primero', 'warning');
        return;
    }

    const formData = collectFormData();
    const btn = e.target.querySelector('[type="submit"]');
    const originalHTML = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

        const response = await fetch(`${API_URL}/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: currentTemplate.name,
                data: formData,
                filename: formData.filename || `OC_${formData.oc_number || Date.now()}.pdf`
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('¡PDF generado exitosamente!', 'success');
            downloadPDF(result.filename);
            loadHistory();
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error generando PDF', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function collectFormData() {
    const form = document.getElementById('ocForm');
    const formData = new FormData(form);
    const data = {};

    // Procesar campos normales
    for (let [key, value] of formData.entries()) {
        if (key.includes('[')) {
            // Es un array
            const match = key.match(/(.+)\[(\d+)\]\[(.+)\]/);
            if (match) {
                const [, arrayName, index, fieldName] = match;
                if (!data[arrayName]) data[arrayName] = [];
                if (!data[arrayName][index]) data[arrayName][index] = {};
                data[arrayName][index][fieldName] = value;
            }
        } else {
            data[key] = value;
        }
    }

    // Limpiar arrays (eliminar nulls)
    Object.keys(data).forEach(key => {
        if (Array.isArray(data[key])) {
            data[key] = data[key].filter(item => item !== null);
        }
    });

    return data;
}

function clearForm() {
    document.getElementById('ocForm').reset();
    document.querySelectorAll('.array-items').forEach(container => {
        container.innerHTML = '';
    });
}

async function previewPDF() {
    if (!currentTemplate) {
        showToast('Selecciona un template primero', 'warning');
        return;
    }

    const formData = collectFormData();

    try {
        // Renderizar el template en el iframe
        const response = await fetch(`${API_URL}/templates/${currentTemplate.name}`);
        const data = await response.json();

        if (data.success) {
            // Aquí puedes implementar una vista previa simple
            showToast('Vista previa disponible próximamente', 'warning');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error generando vista previa', 'error');
    }
}

function downloadPDF(filename) {
    const downloadUrl = `${API_URL}/download/${filename}`;
    window.open(downloadUrl, '_blank');
}

// ==================== HISTORIAL ====================
async function loadHistory() {
    const tbody = document.querySelector('#historyTable tbody');
    
    try {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div></td></tr>';

        const response = await fetch(`${API_URL}/generated`);
        const data = await response.json();

        if (data.success && data.files.length > 0) {
            tbody.innerHTML = data.files.map(file => `
                <tr>
                    <td>${file.filename}</td>
                    <td>${formatFileSize(file.size)}</td>
                    <td>${formatDate(file.created)}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="downloadPDF('${file.filename}')">
                            <i class="fas fa-download"></i> Descargar
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay PDFs generados aún</td></tr>';
        }
    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Error cargando historial</td></tr>';
    }
}

// ==================== GESTIÓN DE TEMPLATES (Grid) ====================
async function loadTemplatesGrid() {
    const grid = document.getElementById('templatesGrid');
    
    try {
        grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

        const response = await fetch(`${API_URL}/templates`);
        const data = await response.json();

        if (data.success && data.templates.length > 0) {
            grid.innerHTML = data.templates.map(template => `
                <div class="template-item">
                    <h4>${template.displayName || template.name}</h4>
                    <p>${template.description || 'Sin descripción'}</p>
                    <p><small>${template.fields?.length || 0} campos configurados</small></p>
                    <div class="template-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editTemplate('${template.name}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${template.name}')">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p>No hay templates disponibles. Crea uno en la pestaña "Editor de Templates".</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        grid.innerHTML = '<p>Error cargando templates</p>';
    }
}

window.editTemplate = async function(name) {
    try {
        const response = await fetch(`${API_URL}/templates/${name}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('templateName').value = name;
            document.getElementById('templateEditor').value = data.template;
            switchTab('editor');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error cargando template', 'error');
    }
};

window.deleteTemplate = async function(name) {
    if (!confirm(`¿Estás seguro de eliminar el template "${name}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/templates/${name}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Template eliminado exitosamente', 'success');
            loadTemplatesGrid();
            loadTemplates();
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error eliminando template', 'error');
    }
};

// ==================== EDITOR DE TEMPLATES ====================
async function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateEditor').value.trim();

    if (!name) {
        showToast('Ingresa un nombre para el template', 'warning');
        return;
    }

    if (!content) {
        showToast('El contenido del template no puede estar vacío', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Template guardado exitosamente', 'success');
            loadTemplates();
            loadTemplatesGrid();
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error guardando template', 'error');
    }
}

// ==================== UTILIDADES ====================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}
