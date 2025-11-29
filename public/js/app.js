// ========================================
// SISTEMA DE ÓRDENES DE COMPRA - APP.JS
// ========================================

// Estado global de la aplicación
const appState = {
    selectedEmpresa: null,
    selectedTemplate: null,
    selectedTemplateConfig: null,
    allTemplates: [],
    optionalFieldsState: {}
};

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeEmpresaSelector();
    initializeBackButton();
    initializeFormHandlers();
    loadTemplates();
    loadHistory();
    initializeTemplateEditor();
});

// ========================================
// GESTIÓN DE TABS
// ========================================
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Actualizar botones
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Actualizar contenido
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTab).classList.add('active');

            // Cargar datos según el tab
            if (targetTab === 'history') {
                loadHistory();
            } else if (targetTab === 'templates') {
                loadTemplatesManagement();
            }
        });
    });
}

// ========================================
// SELECTOR DE EMPRESA
// ========================================
function initializeEmpresaSelector() {
    const empresaCards = document.querySelectorAll('.empresa-card');

    empresaCards.forEach(card => {
        card.addEventListener('click', () => {
            const empresa = card.dataset.empresa;
            selectEmpresa(empresa);
        });
    });
}

function selectEmpresa(empresa) {
    appState.selectedEmpresa = empresa;

    // Actualizar UI - marcar empresa seleccionada
    document.querySelectorAll('.empresa-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.empresa-card[data-empresa="${empresa}"]`).classList.add('selected');

    // Mostrar sección de tipo de OC
    document.getElementById('tipoOCSection').style.display = 'block';

    // Cargar tipos de OC para la empresa seleccionada
    loadTiposOC(empresa);

    // Ocultar formulario si estaba visible
    document.getElementById('formSection').style.display = 'none';

    // Scroll suave a la siguiente sección
    document.getElementById('tipoOCSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========================================
// CARGAR TIPOS DE OC
// ========================================
function loadTiposOC(empresa) {
    const tipoOCSelector = document.getElementById('tipoOCSelector');

    // Filtrar templates por empresa
    const templatesEmpresa = appState.allTemplates.filter(t => t.config.empresa === empresa);

    if (templatesEmpresa.length === 0) {
        tipoOCSelector.innerHTML = `
            <div class="loading">
                <p>No hay templates disponibles para esta empresa</p>
            </div>
        `;
        return;
    }

    // Generar cards de tipos de OC
    tipoOCSelector.innerHTML = templatesEmpresa.map(template => {
        const moneda = template.name.includes('importacion') ? 'USD' : 'S/.';
        const igv = template.name.includes('importacion') ? 'Sin IGV' : 'Con IGV';

        return `
            <div class="tipo-oc-card" data-template="${template.name}">
                <h4>
                    <i class="fas fa-file-invoice"></i>
                    ${template.config.displayName}
                </h4>
                <p>${template.config.description}</p>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <span class="tipo-oc-badge">${moneda}</span>
                    <span class="tipo-oc-badge">${igv}</span>
                </div>
            </div>
        `;
    }).join('');

    // Añadir event listeners
    document.querySelectorAll('.tipo-oc-card').forEach(card => {
        card.addEventListener('click', () => {
            const templateName = card.dataset.template;
            selectTipoOC(templateName);
        });
    });
}

// ========================================
// SELECCIONAR TIPO DE OC
// ========================================
function selectTipoOC(templateName) {
    appState.selectedTemplate = templateName;

    // Buscar configuración del template
    const template = appState.allTemplates.find(t => t.name === templateName);
    if (!template) {
        showToast('Template no encontrado', 'error');
        return;
    }

    appState.selectedTemplateConfig = template.config;

    // Actualizar UI
    document.querySelectorAll('.tipo-oc-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.tipo-oc-card[data-template="${templateName}"]`).classList.add('selected');

    // Mostrar formulario
    document.getElementById('formSection').style.display = 'block';

    // Generar formulario
    generateForm(template.config);

    // Scroll suave
    setTimeout(() => {
        document.getElementById('formSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ========================================
// GENERAR FORMULARIO DINÁMICO
// ========================================
function generateForm(config) {
    const formFields = document.getElementById('formFields');
    const optionalToggle = document.getElementById('optionalFieldsToggle');
    const optionalCheckboxes = document.getElementById('optionalFieldsCheckboxes');

    // Resetear estado de campos opcionales
    appState.optionalFieldsState = {};

    // Separar campos: normales (obligatorios y opcionales), de sección "opcionales" y condicionales
    const normalFields = config.fields.filter(f => !f.conditional && f.section !== 'opcionales');
    const optionalSectionFields = config.fields.filter(f => f.section === 'opcionales');
    const conditionalFields = config.fields.filter(f => f.conditional);

    // Si hay campos de sección "opcionales", mostrar los checkboxes
    if (optionalSectionFields.length > 0) {
        optionalToggle.style.display = 'block';
        optionalCheckboxes.innerHTML = optionalSectionFields.map(field => `
            <div class="optional-checkbox-item">
                <input type="checkbox" id="opt_${field.name}" data-field="${field.name}">
                <label for="opt_${field.name}">${field.label}</label>
            </div>
        `).join('');

        // Event listeners para checkboxes opcionales
        optionalSectionFields.forEach(field => {
            const checkbox = document.getElementById(`opt_${field.name}`);
            checkbox.addEventListener('change', (e) => {
                appState.optionalFieldsState[field.name] = e.target.checked;
                generateFormFields(normalFields, optionalSectionFields, conditionalFields);
            });
        });
    } else {
        optionalToggle.style.display = 'none';
    }

    // Generar campos del formulario
    generateFormFields(normalFields, optionalSectionFields, conditionalFields);
}

function generateFormFields(normalFields, optionalSectionFields, conditionalFields) {
    const formFields = document.getElementById('formFields');

    // Campos que se mostrarán: todos los campos normales (obligatorios y opcionales)
    let fieldsToShow = [...normalFields];

    // Añadir campos condicionales de los opcionales activados
    // NO añadir los campos checkbox de la sección opcionales, solo sus condicionales
    optionalSectionFields.forEach(optField => {
        if (appState.optionalFieldsState[optField.name]) {
            // Solo añadir los campos condicionales, no el checkbox en sí
            const relatedConditionals = conditionalFields.filter(f => f.conditional === optField.name);
            fieldsToShow.push(...relatedConditionals);
        }
    });

    // Generar HTML de los campos
    formFields.innerHTML = fieldsToShow.map(field => generateFieldHTML(field)).join('');

    // Inicializar event listeners para arrays
    initializeArrayFields();
}

function generateFieldHTML(field) {
    if (field.type === 'array') {
        return generateArrayFieldHTML(field);
    }

    const requiredClass = field.required ? 'required' : '';
    const requiredAttr = field.required ? 'required' : '';

    let inputHTML = '';

    switch (field.type) {
        case 'text':
        case 'email':
        case 'date':
            inputHTML = `<input
                type="${field.type}"
                class="form-control"
                name="${field.name}"
                id="${field.name}"
                placeholder="${field.placeholder || ''}"
                ${requiredAttr}>`;
            break;

        case 'number':
            inputHTML = `<input
                type="number"
                class="form-control"
                name="${field.name}"
                id="${field.name}"
                step="${field.step || '1'}"
                placeholder="${field.placeholder || ''}"
                ${requiredAttr}>`;
            break;

        case 'textarea':
            inputHTML = `<textarea
                class="form-control"
                name="${field.name}"
                id="${field.name}"
                rows="${field.rows || 3}"
                placeholder="${field.placeholder || ''}"
                ${requiredAttr}></textarea>`;
            break;

        case 'select':
            inputHTML = `<select class="form-control" name="${field.name}" id="${field.name}" ${requiredAttr}>
                <option value="">Seleccione...</option>
                ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>`;
            break;

        case 'checkbox':
            inputHTML = `<input type="checkbox" name="${field.name}" id="${field.name}">`;
            break;
    }

    return `
        <div class="form-group">
            <label class="form-label ${requiredClass}" for="${field.name}">${field.label}</label>
            ${inputHTML}
        </div>
    `;
}

function generateArrayFieldHTML(field) {
    return `
        <div class="array-field" data-array-name="${field.name}">
            <div class="array-field-header">
                <h4><i class="fas fa-list"></i> ${field.label}</h4>
                <button type="button" class="btn btn-primary btn-sm" onclick="addArrayItem('${field.name}')">
                    <i class="fas fa-plus"></i> Agregar ${field.itemLabel || 'Item'}
                </button>
            </div>
            <div class="array-items" id="array_${field.name}">
                <!-- Items se generarán aquí -->
            </div>
        </div>
    `;
}

// ========================================
// GESTIÓN DE CAMPOS ARRAY
// ========================================
function initializeArrayFields() {
    const arrayFields = appState.selectedTemplateConfig.fields.filter(f => f.type === 'array');

    arrayFields.forEach(field => {
        // Añadir el primer item por defecto
        addArrayItem(field.name);
    });
}

function addArrayItem(arrayName) {
    const arrayField = appState.selectedTemplateConfig.fields.find(f => f.name === arrayName);
    if (!arrayField) return;

    const container = document.getElementById(`array_${arrayName}`);
    const itemIndex = container.children.length;

    const itemHTML = `
        <div class="array-item" data-index="${itemIndex}">
            <div class="array-item-header">
                <span class="array-item-title">${arrayField.itemLabel || 'Item'} #${itemIndex + 1}</span>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeArrayItem('${arrayName}', ${itemIndex})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
            <div class="form-row">
                ${arrayField.fields.map(subField => {
                    const requiredAttr = subField.required ? 'required' : '';
                    const requiredClass = subField.required ? 'required' : '';

                    let inputHTML = '';

                    if (subField.type === 'textarea') {
                        inputHTML = `<textarea
                            class="form-control"
                            name="${arrayName}[${itemIndex}][${subField.name}]"
                            rows="${subField.rows || 2}"
                            placeholder="${subField.placeholder || ''}"
                            ${requiredAttr}></textarea>`;
                    } else if (subField.type === 'number') {
                        inputHTML = `<input
                            type="number"
                            class="form-control"
                            name="${arrayName}[${itemIndex}][${subField.name}]"
                            step="${subField.step || '0.01'}"
                            placeholder="${subField.placeholder || ''}"
                            ${requiredAttr}>`;
                    } else {
                        inputHTML = `<input
                            type="${subField.type}"
                            class="form-control"
                            name="${arrayName}[${itemIndex}][${subField.name}]"
                            placeholder="${subField.placeholder || ''}"
                            ${requiredAttr}>`;
                    }

                    return `
                        <div class="form-group">
                            <label class="form-label ${requiredClass}">${subField.label}</label>
                            ${inputHTML}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
}

function removeArrayItem(arrayName, index) {
    const container = document.getElementById(`array_${arrayName}`);
    const items = container.querySelectorAll('.array-item');

    if (items.length <= 1) {
        showToast('Debe haber al menos un item', 'warning');
        return;
    }

    items[index].remove();

    // Renumerar items restantes
    container.querySelectorAll('.array-item').forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        item.querySelector('.array-item-title').textContent =
            `${appState.selectedTemplateConfig.fields.find(f => f.name === arrayName).itemLabel || 'Item'} #${newIndex + 1}`;
    });
}

// ========================================
// BOTÓN "VOLVER"
// ========================================
function initializeBackButton() {
    document.getElementById('backBtn').addEventListener('click', () => {
        // Resetear selecciones
        appState.selectedEmpresa = null;
        appState.selectedTemplate = null;
        appState.selectedTemplateConfig = null;

        // Limpiar UI
        document.querySelectorAll('.empresa-card').forEach(card => card.classList.remove('selected'));
        document.querySelectorAll('.tipo-oc-card').forEach(card => card.classList.remove('selected'));

        // Ocultar secciones
        document.getElementById('tipoOCSection').style.display = 'none';
        document.getElementById('formSection').style.display = 'none';

        // Scroll al inicio
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ========================================
// HANDLERS DE FORMULARIO
// ========================================
function initializeFormHandlers() {
    // Limpiar formulario
    document.getElementById('clearForm').addEventListener('click', () => {
        document.getElementById('ocForm').reset();

        // Resetear arrays
        const arrayFields = appState.selectedTemplateConfig?.fields.filter(f => f.type === 'array') || [];
        arrayFields.forEach(field => {
            const container = document.getElementById(`array_${field.name}`);
            container.innerHTML = '';
            addArrayItem(field.name);
        });
    });

    // Generar PDF
    document.getElementById('ocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generatePDF();
    });

    // Vista previa
    document.getElementById('previewBtn').addEventListener('click', async () => {
        await previewPDF();
    });
}

// ========================================
// GENERAR PDF
// ========================================
async function generatePDF() {
    const formData = collectFormData();

    if (!formData) return;

    const submitBtn = document.querySelector('#ocForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';

    try {
        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: appState.selectedTemplate,
                data: formData,
                filename: `OC_${formData.numero_oc}.pdf`
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al generar el PDF');
        }

        // Verificar que la respuesta es un PDF
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
            throw new Error('La respuesta no es un PDF válido');
        }

        const blob = await response.blob();

        // Verificar que el blob tiene contenido
        if (blob.size === 0) {
            throw new Error('El PDF generado está vacío');
        }

        console.log('PDF descargado, tamaño:', blob.size, 'bytes');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OC_${formData.numero_oc}.pdf`;
        document.body.appendChild(a);
        a.click();

        // Limpiar después de un breve delay
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);

        showToast('PDF generado y descargado correctamente', 'success');

        // Actualizar historial después de un pequeño delay
        setTimeout(() => loadHistory(), 500);

    } catch (error) {
        console.error('Error completo:', error);
        showToast('Error al generar el PDF: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ========================================
// VISTA PREVIA
// ========================================
async function previewPDF() {
    const formData = collectFormData();

    if (!formData) return;

    try {
        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template: appState.selectedTemplate,
                data: formData,
                filename: `preview_${Date.now()}.pdf`
            })
        });

        if (!response.ok) {
            throw new Error('Error al generar la vista previa');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const previewFrame = document.getElementById('previewFrame');
        previewFrame.src = url;

        document.getElementById('previewModal').classList.add('active');

    } catch (error) {
        console.error('Error:', error);
        showToast('Error al generar la vista previa: ' + error.message, 'error');
    }
}

// ========================================
// RECOLECTAR DATOS DEL FORMULARIO
// ========================================
function collectFormData() {
    const form = document.getElementById('ocForm');
    const formData = new FormData(form);
    const data = {};

    // Inicializar todos los campos del template con valores vacíos
    appState.selectedTemplateConfig.fields.forEach(field => {
        if (field.type !== 'array' && field.type !== 'checkbox') {
            data[field.name] = '';
        }
    });

    // Procesar campos simples del formulario (sobrescribir con valores reales)
    for (let [key, value] of formData.entries()) {
        if (!key.includes('[')) {
            data[key] = value;
        }
    }

    // Añadir estados de checkboxes opcionales
    Object.keys(appState.optionalFieldsState).forEach(key => {
        data[key] = appState.optionalFieldsState[key];
    });

    // Procesar campos array
    const arrayFields = appState.selectedTemplateConfig.fields.filter(f => f.type === 'array');

    arrayFields.forEach(arrayField => {
        data[arrayField.name] = [];
        const container = document.getElementById(`array_${arrayField.name}`);
        const items = container.querySelectorAll('.array-item');

        items.forEach(item => {
            const itemData = {};
            arrayField.fields.forEach(subField => {
                const input = item.querySelector(`[name*="[${subField.name}]"]`);
                if (input) {
                    itemData[subField.name] = input.value;
                }
            });
            data[arrayField.name].push(itemData);
        });
    });

    return data;
}

// ========================================
// CARGAR TEMPLATES
// ========================================
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const templates = await response.json();

        appState.allTemplates = templates;

    } catch (error) {
        console.error('Error al cargar templates:', error);
        showToast('Error al cargar templates', 'error');
    }
}

// ========================================
// HISTORIAL DE PDFs
// ========================================
async function loadHistory() {
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div></td></tr>';

    try {
        const response = await fetch('/api/generated');
        const files = await response.json();

        if (files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay PDFs generados</td></tr>';
            return;
        }

        tbody.innerHTML = files.map(file => `
            <tr>
                <td>${file.name}</td>
                <td>${formatFileSize(file.size)}</td>
                <td>${formatDate(file.date)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="downloadPDF('${file.name}')">
                        <i class="fas fa-download"></i> Descargar
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar el historial</td></tr>';
    }
}

async function downloadPDF(filename) {
    try {
        const response = await fetch(`/api/download/${encodeURIComponent(filename)}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al descargar el archivo', 'error');
    }
}

// ========================================
// GESTIÓN DE TEMPLATES
// ========================================
async function loadTemplatesManagement() {
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

    try {
        const response = await fetch('/api/templates');
        const templates = await response.json();

        if (templates.length === 0) {
            grid.innerHTML = '<p class="text-center">No hay templates disponibles</p>';
            return;
        }

        grid.innerHTML = templates.map(template => `
            <div class="template-item">
                <h4>${template.config.displayName}</h4>
                <p>${template.config.description}</p>
                <div class="template-badge">${template.name}</div>
                <div class="template-actions" style="margin-top: 1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="editTemplate('${template.name}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${template.name}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
        grid.innerHTML = '<p class="text-center">Error al cargar templates</p>';
    }
}

// ========================================
// EDITOR DE TEMPLATES
// ========================================
function initializeTemplateEditor() {
    document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
    document.getElementById('newTemplateBtn').addEventListener('click', () => {
        document.querySelector('[data-tab="editor"]').click();
        document.getElementById('templateName').value = '';
        document.getElementById('templateEditor').value = '';
    });
}

async function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateEditor').value.trim();

    if (!name || !content) {
        showToast('Por favor completa el nombre y contenido del template', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        });

        if (!response.ok) {
            throw new Error('Error al guardar el template');
        }

        showToast('Template guardado correctamente', 'success');
        await loadTemplates();
        document.querySelector('[data-tab="templates"]').click();

    } catch (error) {
        console.error('Error:', error);
        showToast('Error al guardar el template: ' + error.message, 'error');
    }
}

async function editTemplate(name) {
    try {
        const response = await fetch(`/api/templates/${name}`);
        const template = await response.json();

        document.getElementById('templateName').value = name.replace('.ejs', '');
        document.getElementById('templateEditor').value = template.content;
        document.querySelector('[data-tab="editor"]').click();

    } catch (error) {
        console.error('Error:', error);
        showToast('Error al cargar el template', 'error');
    }
}

async function deleteTemplate(name) {
    if (!confirm(`¿Estás seguro de eliminar el template "${name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/templates/${name}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Error al eliminar el template');
        }

        showToast('Template eliminado correctamente', 'success');
        await loadTemplates();
        loadTemplatesManagement();

    } catch (error) {
        console.error('Error:', error);
        showToast('Error al eliminar el template: ' + error.message, 'error');
    }
}

// ========================================
// UTILIDADES
// ========================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Cerrar modal al hacer clic fuera
window.onclick = (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// Refrescar historial
document.getElementById('refreshHistoryBtn').addEventListener('click', loadHistory);