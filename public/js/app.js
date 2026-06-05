// ============================================================
// SISTEMA DE ÓRDENES DE COMPRA - APP PRINCIPAL (cliente)
// ============================================================

const appState = {
    selectedEmpresa: null,
    selectedTemplate: null,
    selectedTemplateConfig: null,
    optionalFieldsState: {},
    obras: [],
    proveedores: []
};

// ------------------------------------------------------------
// INICIALIZACIÓN + GUARD DE SESIÓN
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    initLogin();
    initNav();
    initEmpresaSelector();
    initFormHandlers();

    const session = await sbGetSession();
    if (session) showApp();
    else showLogin();

    // Reaccionar a cambios de sesión (logout/expiración)
    SB.auth.onAuthStateChange((_event, sess) => {
        if (sess) showApp(); else showLogin();
    });
});

function showLogin() {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
}

function showApp() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('appView').style.display = 'block';
    renderEmpresas();
}

// ------------------------------------------------------------
// LOGIN COMPARTIDO
// ------------------------------------------------------------
function initLogin() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');
        const errEl = document.getElementById('loginError');
        errEl.textContent = '';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
        try {
            await sbLogin(email, password);
            showApp();
        } catch (err) {
            errEl.textContent = 'Correo o contraseña incorrectos.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Ingresar';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await sbLogout();
        showLogin();
    });
}

// ------------------------------------------------------------
// NAVEGACIÓN ENTRE SECCIONES
// ------------------------------------------------------------
function initNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
}

function switchView(view) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    if (view === 'obras' && window.renderObras) renderObras();
    if (view === 'proveedores' && window.renderProveedores) renderProveedores();
    if (view === 'historial' && window.renderHistorial) renderHistorial();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------------------------
// PASO 1: EMPRESA
// ------------------------------------------------------------
function renderEmpresas() {
    const cont = document.getElementById('empresaSelector');
    if (cont.dataset.rendered) return;
    cont.innerHTML = window.OC_EMPRESAS.map(e => `
        <button type="button" class="empresa-card" data-empresa="${e.codigo}">
            <i class="fas ${e.icon}" style="color:${e.color}"></i>
            <h4>${e.nombre}</h4>
            <p>${e.tipo}</p>
            <span class="badge">RUC: ${e.ruc}</span>
        </button>
    `).join('');
    cont.dataset.rendered = '1';
    cont.querySelectorAll('.empresa-card').forEach(card => {
        card.addEventListener('click', () => selectEmpresa(card.dataset.empresa));
    });
}

function initEmpresaSelector() { /* listeners se agregan en renderEmpresas */ }

async function selectEmpresa(empresa) {
    appState.selectedEmpresa = empresa;
    document.querySelectorAll('.empresa-card').forEach(c => c.classList.toggle('selected', c.dataset.empresa === empresa));

    // Precargar obras (por empresa) y proveedores (globales)
    try {
        [appState.obras, appState.proveedores] = await Promise.all([
            sbLoadObras(empresa),
            sbLoadProveedores()
        ]);
    } catch (err) {
        showToast('Error cargando datos: ' + err.message, 'error');
    }

    renderTiposOC(empresa);
    document.getElementById('tipoOCSection').style.display = 'block';
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('tipoOCSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ------------------------------------------------------------
// PASO 2: TIPO DE OC
// ------------------------------------------------------------
function renderTiposOC(empresa) {
    const cont = document.getElementById('tipoOCSelector');
    const tipos = Object.values(window.OC_TEMPLATES).filter(t => t.empresa === empresa);
    cont.innerHTML = tipos.map(t => `
        <button type="button" class="tipo-oc-card" data-template="${t.name}">
            <h4><i class="fas fa-file-invoice"></i> ${t.displayName}</h4>
            <p>${t.description}</p>
            <span class="badge">${t.moneda}</span>
        </button>
    `).join('');
    cont.querySelectorAll('.tipo-oc-card').forEach(card => {
        card.addEventListener('click', () => selectTipoOC(card.dataset.template));
    });
}

function selectTipoOC(templateName) {
    appState.selectedTemplate = templateName;
    appState.selectedTemplateConfig = window.OC_TEMPLATES[templateName];
    document.querySelectorAll('.tipo-oc-card').forEach(c => c.classList.toggle('selected', c.dataset.template === templateName));
    document.getElementById('formSection').style.display = 'block';
    generateForm(appState.selectedTemplateConfig);
    setTimeout(() => document.getElementById('formSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ------------------------------------------------------------
// FORMULARIO DINÁMICO
// ------------------------------------------------------------
function generateForm(config) {
    appState.optionalFieldsState = {};
    const optionalToggle = document.getElementById('optionalFieldsToggle');
    const optionalCheckboxes = document.getElementById('optionalFieldsCheckboxes');

    const normalFields = config.fields.filter(f => !f.conditional && f.section !== 'opcionales');
    const optionalSectionFields = config.fields.filter(f => f.section === 'opcionales');
    const conditionalFields = config.fields.filter(f => f.conditional);

    if (optionalSectionFields.length > 0) {
        optionalToggle.style.display = 'block';
        optionalCheckboxes.innerHTML = optionalSectionFields.map(f => `
            <label class="optional-checkbox-item">
                <input type="checkbox" id="opt_${f.name}" data-field="${f.name}">
                <span>${f.label}</span>
            </label>
        `).join('');
        optionalSectionFields.forEach(f => {
            document.getElementById(`opt_${f.name}`).addEventListener('change', (e) => {
                appState.optionalFieldsState[f.name] = e.target.checked;
                renderFields(normalFields, optionalSectionFields, conditionalFields);
            });
        });
    } else {
        optionalToggle.style.display = 'none';
    }

    renderFields(normalFields, optionalSectionFields, conditionalFields);
}

function renderFields(normalFields, optionalSectionFields, conditionalFields) {
    let fieldsToShow = [...normalFields];
    optionalSectionFields.forEach(optField => {
        if (appState.optionalFieldsState[optField.name]) {
            fieldsToShow.push(...conditionalFields.filter(f => f.conditional === optField.name));
        }
    });

    document.getElementById('formFields').innerHTML = fieldsToShow.map(generateFieldHTML).join('');

    // Valor por defecto: fecha de hoy
    const fecha = document.getElementById('fecha');
    if (fecha && !fecha.value) fecha.value = new Date().toISOString().slice(0, 10);

    // Poblar selects especiales y enganchar autocompletado
    populateObraSelect();
    populateProveedorSelect();
    initArrayFields();
}

function generateFieldHTML(field) {
    if (field.type === 'array') return generateArrayFieldHTML(field);

    const reqClass = field.required ? 'required' : '';
    const reqAttr = field.required ? 'required' : '';
    let input = '';

    // Campo OBRA -> select desde la BD
    if (field.source === 'obra') {
        return `
            <div class="form-group">
                <label class="form-label ${reqClass}" for="obra">${field.label}</label>
                <select class="form-control" id="obra" name="obra" ${reqAttr}>
                    <option value="">Seleccione una obra...</option>
                </select>
                <textarea class="form-control" id="obra_otra" name="obra_otra" rows="2"
                    placeholder="Escribe la obra" style="display:none; margin-top:8px;"></textarea>
            </div>`;
    }

    // Campo PROVEEDOR -> select desde la BD (autocompleta los demás)
    if (field.source === 'proveedor') {
        return `
            <div class="form-group">
                <label class="form-label ${reqClass}" for="proveedor_razon_social">${field.label}</label>
                <select class="form-control" id="proveedor_razon_social" name="proveedor_razon_social" ${reqAttr}>
                    <option value="">Seleccione un proveedor...</option>
                </select>
            </div>`;
    }

    switch (field.type) {
        case 'text':
        case 'email':
        case 'date':
            input = `<input type="${field.type}" class="form-control" name="${field.name}" id="${field.name}" placeholder="${field.placeholder || ''}" ${reqAttr}>`;
            break;
        case 'number':
            input = `<input type="number" class="form-control" name="${field.name}" id="${field.name}" step="${field.step || '1'}" min="0" placeholder="${field.placeholder || ''}" ${reqAttr}>`;
            break;
        case 'textarea':
            input = `<textarea class="form-control" name="${field.name}" id="${field.name}" rows="${field.rows || 3}" placeholder="${field.placeholder || ''}" ${reqAttr}></textarea>`;
            break;
        case 'select':
            input = `<select class="form-control" name="${field.name}" id="${field.name}" ${reqAttr}>
                <option value="">Seleccione...</option>
                ${(field.options || []).map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>`;
            break;
        case 'checkbox':
            input = `<input type="checkbox" name="${field.name}" id="${field.name}">`;
            break;
    }

    return `
        <div class="form-group">
            <label class="form-label ${reqClass}" for="${field.name}">${field.label}</label>
            ${input}
        </div>`;
}

// ---- Select de OBRA ----
function populateObraSelect() {
    const sel = document.getElementById('obra');
    if (!sel) return;
    const obras = appState.obras || [];
    sel.innerHTML = `<option value="">Seleccione una obra...</option>`
        + obras.map(o => `<option value="${escapeHtml(o.nombre)}">${escapeHtml(o.nombre)}</option>`).join('')
        + `<option value="__otra__">✏️ Otra (escribir)...</option>`;

    sel.addEventListener('change', () => {
        const otra = document.getElementById('obra_otra');
        if (sel.value === '__otra__') { otra.style.display = 'block'; otra.required = true; }
        else { otra.style.display = 'none'; otra.required = false; otra.value = ''; }
    });
}

// ---- Select de PROVEEDOR (con autocompletado) ----
function populateProveedorSelect() {
    const sel = document.getElementById('proveedor_razon_social');
    if (!sel) return;
    const provs = appState.proveedores || [];
    sel.innerHTML = `<option value="">Seleccione un proveedor...</option>`
        + provs.map(p => `<option value="${escapeHtml(p.razon_social)}" data-id="${p.id}">${escapeHtml(p.razon_social)}</option>`).join('')
        + `<option value="__nuevo__">➕ Nuevo proveedor...</option>`;

    sel.addEventListener('change', () => {
        if (sel.value === '__nuevo__') {
            sel.value = '';
            if (window.openNuevoProveedor) {
                window.openNuevoProveedor(async (nuevo) => {
                    appState.proveedores = await sbLoadProveedores(true);
                    populateProveedorSelect();
                    sel.value = nuevo.razon_social;
                    applyProveedorAutofill(nuevo);
                });
            }
            return;
        }
        const opt = sel.options[sel.selectedIndex];
        const id = opt && opt.dataset ? opt.dataset.id : null;
        const prov = (appState.proveedores || []).find(p => String(p.id) === String(id));
        if (prov) applyProveedorAutofill(prov);
    });
}

function applyProveedorAutofill(prov) {
    Object.entries(window.PROVEEDOR_AUTOFILL).forEach(([fieldName, col]) => {
        const el = document.getElementById(fieldName);
        if (el && prov[col] != null) el.value = prov[col];
    });
}

// ------------------------------------------------------------
// CAMPOS ARRAY (items)
// ------------------------------------------------------------
function generateArrayFieldHTML(field) {
    return `
        <div class="array-field" data-array-name="${field.name}">
            <div class="array-field-header">
                <h4><i class="fas fa-list"></i> ${field.label}</h4>
                <button type="button" class="btn btn-sm btn-primary" onclick="addArrayItem('${field.name}')">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>
            <div class="array-items" id="array_${field.name}"></div>
        </div>`;
}

function initArrayFields() {
    (appState.selectedTemplateConfig.fields.filter(f => f.type === 'array')).forEach(f => {
        const cont = document.getElementById(`array_${f.name}`);
        if (cont && cont.children.length === 0) addArrayItem(f.name);
    });
}

function addArrayItem(arrayName) {
    const field = appState.selectedTemplateConfig.fields.find(f => f.name === arrayName);
    if (!field) return;
    const container = document.getElementById(`array_${arrayName}`);
    const index = container.children.length;

    const subInputs = field.fields.map(sf => {
        const reqAttr = sf.required ? 'required' : '';
        const reqClass = sf.required ? 'required' : '';
        let input;
        if (sf.type === 'textarea') {
            input = `<textarea class="form-control" data-sub="${sf.name}" rows="${sf.rows || 2}" placeholder="${sf.placeholder || ''}" ${reqAttr}></textarea>`;
        } else if (sf.type === 'number') {
            input = `<input type="number" class="form-control" data-sub="${sf.name}" step="${sf.step || '0.01'}" min="0" placeholder="${sf.placeholder || ''}" ${reqAttr}>`;
        } else {
            input = `<input type="${sf.type}" class="form-control" data-sub="${sf.name}" placeholder="${sf.placeholder || ''}" ${reqAttr}>`;
        }
        return `<div class="form-group"><label class="form-label ${reqClass}">${sf.label}</label>${input}</div>`;
    }).join('');

    container.insertAdjacentHTML('beforeend', `
        <div class="array-item" data-index="${index}">
            <div class="array-item-header">
                <span class="array-item-title">Item #${index + 1}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeArrayItem('${arrayName}', this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="form-row">${subInputs}</div>
        </div>`);
}

function removeArrayItem(arrayName, btn) {
    const container = document.getElementById(`array_${arrayName}`);
    if (container.querySelectorAll('.array-item').length <= 1) {
        showToast('Debe haber al menos un item', 'warning');
        return;
    }
    btn.closest('.array-item').remove();
    container.querySelectorAll('.array-item').forEach((item, i) => {
        item.dataset.index = i;
        item.querySelector('.array-item-title').textContent = `Item #${i + 1}`;
    });
}

// ------------------------------------------------------------
// RECOLECTAR + VALIDAR DATOS
// ------------------------------------------------------------
function collectFormData() {
    const config = appState.selectedTemplateConfig;
    const data = {};

    // Inicializa TODOS los campos para que la plantilla EJS nunca encuentre
    // una variable indefinida (checkbox -> false; resto -> '').
    config.fields.forEach(field => {
        if (field.type === 'array') return;
        if (field.type === 'checkbox') { data[field.name] = false; return; }
        const el = document.getElementById(field.name);
        data[field.name] = el ? el.value.trim() : '';
    });

    // Obra "otra"
    if (data.obra === '__otra__') {
        const otra = document.getElementById('obra_otra');
        data.obra = otra ? otra.value.trim() : '';
    }

    // Checkboxes opcionales
    Object.keys(appState.optionalFieldsState).forEach(k => { data[k] = appState.optionalFieldsState[k]; });

    // Arrays
    config.fields.filter(f => f.type === 'array').forEach(arrayField => {
        data[arrayField.name] = [];
        document.querySelectorAll(`#array_${arrayField.name} .array-item`).forEach(item => {
            const itemData = {};
            arrayField.fields.forEach(sf => {
                const input = item.querySelector(`[data-sub="${sf.name}"]`);
                itemData[sf.name] = input ? input.value.trim() : '';
            });
            data[arrayField.name].push(itemData);
        });
    });

    return data;
}

const VALIDATORS = {
    ruc: { test: v => /^\d{11}$/.test(v), msg: 'El RUC debe tener 11 dígitos.' },
    dni: { test: v => /^\d{8}$/.test(v), msg: 'El DNI debe tener 8 dígitos.' },
    email: { test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Correo electrónico inválido.' },
    phone: { test: v => /^[\d\s+\-()]{6,}$/.test(v), msg: 'Teléfono inválido.' }
};

function validateData(data) {
    const config = appState.selectedTemplateConfig;
    const errors = [];

    config.fields.forEach(field => {
        if (field.type === 'array' || field.type === 'checkbox') return;
        const val = (data[field.name] || '').toString().trim();
        if (field.required && !val) { errors.push(`Falta: ${field.label}`); return; }
        if (val && field.validate && VALIDATORS[field.validate] && !VALIDATORS[field.validate].test(val)) {
            errors.push(`${field.label}: ${VALIDATORS[field.validate].msg}`);
        }
    });

    // Items
    const itemsField = config.fields.find(f => f.type === 'array');
    if (itemsField) {
        const items = data[itemsField.name] || [];
        if (items.length === 0) errors.push('Agrega al menos un item.');
        items.forEach((it, i) => {
            const cant = parseFloat(it.cantidad);
            const precio = parseFloat(it.precio_unitario);
            if (!it.descripcion) errors.push(`Item #${i + 1}: falta la descripción.`);
            if (!it.unidad) errors.push(`Item #${i + 1}: falta la unidad.`);
            if (!(cant > 0)) errors.push(`Item #${i + 1}: la cantidad debe ser mayor a 0.`);
            if (!(precio >= 0) || isNaN(precio)) errors.push(`Item #${i + 1}: el precio no es válido.`);
        });
    }

    return errors;
}

// ------------------------------------------------------------
// GENERAR PDF (vía función serverless) + DESCARGA
// ------------------------------------------------------------
function initFormHandlers() {
    document.getElementById('clearForm').addEventListener('click', () => {
        document.getElementById('ocForm').reset();
        appState.selectedTemplateConfig.fields.filter(f => f.type === 'array').forEach(f => {
            const c = document.getElementById(`array_${f.name}`);
            if (c) { c.innerHTML = ''; addArrayItem(f.name); }
        });
        const fecha = document.getElementById('fecha');
        if (fecha) fecha.value = new Date().toISOString().slice(0, 10);
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        appState.selectedEmpresa = appState.selectedTemplate = appState.selectedTemplateConfig = null;
        document.querySelectorAll('.empresa-card, .tipo-oc-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('tipoOCSection').style.display = 'none';
        document.getElementById('formSection').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('ocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generatePDF(false);
    });

    document.getElementById('previewBtn').addEventListener('click', () => generatePDF(true));
}

async function generatePDF(preview) {
    const data = collectFormData();
    const errors = validateData(data);
    if (errors.length) {
        showToast(errors[0], 'error');
        return;
    }

    const submitBtn = document.getElementById('generateBtn');
    const previewBtn = document.getElementById('previewBtn');
    const btn = preview ? previewBtn : submitBtn;
    const original = btn.innerHTML;
    btn.disabled = true;
    submitBtn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    try {
        const token = await sbGetAccessToken();
        if (!token) throw new Error('Tu sesión expiró. Vuelve a ingresar.');

        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                template: appState.selectedTemplate,
                empresa: appState.selectedEmpresa,
                preview: !!preview,
                data
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Error al generar el PDF');
        }

        const numeroOC = response.headers.get('X-Numero-OC') || '';
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('El PDF generado está vacío');
        const url = window.URL.createObjectURL(blob);

        if (preview) {
            document.getElementById('previewFrame').src = url;
            document.getElementById('previewModal').classList.add('active');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = `OC_${numeroOC || Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            showToast(`OC ${numeroOC} generada y descargada`, 'success');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        submitBtn.disabled = false;
        btn.innerHTML = original;
    }
}

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };
