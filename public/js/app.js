// ============================================================
// SISTEMA DE ÓRDENES DE COMPRA - APP PRINCIPAL (cliente)
// ============================================================

const appState = {
    selectedEmpresa: null,
    selectedTemplate: null,
    selectedTemplateConfig: null,
    optionalFieldsState: {},
    obras: [],
    proveedores: [],
    usuario: null
};

// ------------------------------------------------------------
// INICIALIZACIÓN + GUARD DE SESIÓN
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    initLogin();
    initNav();
    initEmpresaSelector();
    initFormHandlers();
    initNameSetup();

    const session = await sbGetSession();
    if (session) showApp();
    else showLogin();

    // Reaccionar a cambios de sesión (logout/expiración/enlace de recuperación)
    SB.auth.onAuthStateChange((event, sess) => {
        if (event === 'PASSWORD_RECOVERY') {
            document.getElementById('newPasswordModal').classList.add('active');
            return;
        }
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
        if (sess) showApp(); else showLogin();
    });
});

// Fecha de HOY en la zona horaria local (toISOString usa UTC: en Perú,
// después de las 7 p. m. devolvía la fecha de mañana).
function hoyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showLogin() {
    _appShown = false;
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
}

let _appShown = false;
async function showApp() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('appView').style.display = 'block';
    renderEmpresas();
    if (_appShown) return; // evita recargar el usuario en cada evento de sesión
    _appShown = true;

    try {
        const user = await sbGetUser();
        appState.usuario = user;
        renderHeaderUser(user);
        if (user && !user.user_metadata?.nombre) {
            document.getElementById('nameSetupModal').style.display = 'flex';
        }
    } catch (_) {}
}

function renderHeaderUser(user) {
    if (!user) return;
    const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario';
    const chip = document.getElementById('headerUserChip');
    const nameEl = document.getElementById('headerUserName');
    if (chip && nameEl) {
        nameEl.textContent = nombre;
        chip.style.display = 'flex';
    }
}

function initNameSetup() {
    const btn = document.getElementById('saveNombreBtn');
    if (!btn) return;
    const input = document.getElementById('setupNombre');
    const errEl = document.getElementById('nameSetupError');

    const save = async () => {
        const nombre = input.value.trim();
        if (!nombre) { errEl.textContent = 'Ingresa tu nombre.'; return; }
        errEl.textContent = '';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        try {
            await sbUpdateUserName(nombre);
            appState.usuario = await sbGetUser();
            renderHeaderUser(appState.usuario);
            document.getElementById('nameSetupModal').style.display = 'none';
            showToast('¡Hola, ' + nombre.split(' ')[0] + '!', 'success');
        } catch (err) {
            errEl.textContent = 'Error: ' + err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Guardar y continuar';
        }
    };

    btn.addEventListener('click', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
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

    // Recuperar contraseña: Supabase envía un enlace al correo
    document.getElementById('forgotBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const errEl = document.getElementById('loginError');
        if (!email) { errEl.textContent = 'Escribe tu correo arriba y vuelve a pulsar.'; return; }
        try {
            const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
            if (error) throw error;
            errEl.textContent = '';
            showToast('Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo.', 'success');
        } catch (err) {
            errEl.textContent = 'No se pudo enviar el correo: ' + err.message;
        }
    });

    document.getElementById('newPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('newPassword').value;
        const errEl = document.getElementById('newPasswordError');
        if (pwd.length < 8) { errEl.textContent = 'Mínimo 8 caracteres.'; return; }
        const { error } = await SB.auth.updateUser({ password: pwd });
        if (error) { errEl.textContent = error.message; return; }
        closeModal('newPasswordModal');
        showToast('Contraseña actualizada', 'success');
        showApp();
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
    if (fecha && !fecha.value) fecha.value = hoyLocal();

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

    // Campo OBRA -> custom select con bottom-sheet en móvil
    if (field.source === 'obra') {
        return `
            <div class="form-group">
                <label class="form-label ${reqClass}">${field.label}</label>
                <div id="obra-cs-wrapper" class="cs-wrapper"></div>
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
                ${field.default ? '' : '<option value="">Seleccione...</option>'}
                ${(field.options || []).map(o => `<option value="${o}"${o === field.default ? ' selected' : ''}>${o}</option>`).join('')}
            </select>`;
            break;
        case 'checkbox':
            return `
                <div class="form-group">
                    <label class="form-check"><input type="checkbox" name="${field.name}" id="${field.name}"> ${field.label}</label>
                </div>`;
    }

    return `
        <div class="form-group">
            <label class="form-label ${reqClass}" for="${field.name}">${field.label}</label>
            ${input}
        </div>`;
}

// ---- Custom Select de OBRA ----
function populateObraSelect() {
    const wrapper = document.getElementById('obra-cs-wrapper');
    if (!wrapper) return;
    const obras = appState.obras || [];
    const options = obras.map(o => ({ value: o.nombre, label: o.nombre }));
    options.push({ value: '__otra__', label: 'Otra (escribir)...', isOther: true });
    buildObraCustomSelect(wrapper, options);
}

function buildObraCustomSelect(wrapper, options) {
    wrapper.innerHTML = `
        <button type="button" class="cs-trigger" aria-haspopup="listbox" aria-expanded="false">
            <span class="cs-value cs-value--placeholder">Seleccione una obra...</span>
            <i class="fas fa-chevron-down cs-arrow" aria-hidden="true"></i>
        </button>
        <input type="hidden" id="obra" name="obra">
        <div class="cs-backdrop"></div>
        <div class="cs-panel" role="listbox" aria-label="Seleccione una obra">
            <div class="cs-panel-header">
                <span class="cs-panel-title">Seleccionar obra</span>
                <button type="button" class="cs-close" aria-label="Cerrar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="cs-search-wrapper">
                <i class="fas fa-search cs-search-icon" aria-hidden="true"></i>
                <input type="text" class="cs-search" placeholder="Buscar obra..." autocomplete="off" aria-label="Buscar">
            </div>
            <div class="cs-options">
                ${options.map(opt => `
                    <div class="cs-option${opt.isOther ? ' cs-option-other' : ''}"
                         data-value="${escapeHtml(opt.value)}" role="option" tabindex="0">
                        ${opt.isOther ? '<i class="fas fa-pencil" aria-hidden="true"></i>' : ''}<span>${escapeHtml(opt.label)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;

    const trigger    = wrapper.querySelector('.cs-trigger');
    const valueSpan  = wrapper.querySelector('.cs-value');
    const backdrop   = wrapper.querySelector('.cs-backdrop');
    const search     = wrapper.querySelector('.cs-search');
    const optsList   = wrapper.querySelector('.cs-options');
    const closeBtn   = wrapper.querySelector('.cs-close');
    const hidden     = wrapper.querySelector('#obra');

    const openPanel = () => {
        wrapper.classList.add('cs-open');
        trigger.setAttribute('aria-expanded', 'true');
        setTimeout(() => search.focus(), 80);
    };

    const closePanel = () => {
        wrapper.classList.remove('cs-open');
        trigger.setAttribute('aria-expanded', 'false');
        search.value = '';
        filterOpts('');
    };

    const filterOpts = (q) => {
        const ql = q.toLowerCase();
        let any = false;
        optsList.querySelectorAll('.cs-option').forEach(opt => {
            const match = !ql || opt.textContent.toLowerCase().includes(ql);
            opt.hidden = !match;
            if (match) any = true;
        });
        let noRes = optsList.querySelector('.cs-no-results');
        if (!any) {
            if (!noRes) { noRes = document.createElement('div'); noRes.className = 'cs-no-results'; noRes.textContent = 'Sin resultados'; optsList.appendChild(noRes); }
        } else if (noRes) noRes.remove();
    };

    const pickValue = (value, label) => {
        hidden.value = value;
        valueSpan.textContent = label;
        valueSpan.classList.remove('cs-value--placeholder');
        optsList.querySelectorAll('.cs-option').forEach(o =>
            o.classList.toggle('selected', o.dataset.value === value)
        );
        const otraTA = document.getElementById('obra_otra');
        if (value === '__otra__') {
            if (otraTA) { otraTA.style.display = 'block'; otraTA.required = true; setTimeout(() => otraTA.focus(), 50); }
        } else {
            if (otraTA) { otraTA.style.display = 'none'; otraTA.required = false; otraTA.value = ''; }
        }
        closePanel();
    };

    trigger.addEventListener('click', () => wrapper.classList.contains('cs-open') ? closePanel() : openPanel());
    backdrop.addEventListener('click', closePanel);
    closeBtn.addEventListener('click', closePanel);
    search.addEventListener('input', () => filterOpts(search.value));

    optsList.addEventListener('click', e => {
        const opt = e.target.closest('.cs-option');
        if (opt && !opt.hidden) pickValue(opt.dataset.value, opt.querySelector('span').textContent.trim());
    });
    optsList.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            const opt = e.target.closest('.cs-option');
            if (opt && !opt.hidden) { e.preventDefault(); pickValue(opt.dataset.value, opt.querySelector('span').textContent.trim()); }
        }
    });

    // Un solo par de listeners globales (antes se acumulaban en cada re-render)
    if (_obraDocHandlers) {
        document.removeEventListener('click', _obraDocHandlers.click);
        document.removeEventListener('keydown', _obraDocHandlers.key);
    }
    _obraDocHandlers = {
        click: e => { if (!wrapper.contains(e.target) && wrapper.classList.contains('cs-open')) closePanel(); },
        key: e => { if (e.key === 'Escape' && wrapper.classList.contains('cs-open')) closePanel(); }
    };
    document.addEventListener('click', _obraDocHandlers.click);
    document.addEventListener('keydown', _obraDocHandlers.key);
}
let _obraDocHandlers = null;

// ---- Select de PROVEEDOR (con autocompletado) ----
function populateProveedorSelect() {
    const sel = document.getElementById('proveedor_razon_social');
    if (!sel) return;
    const provs = appState.proveedores || [];
    sel.innerHTML = `<option value="">Seleccione un proveedor...</option>`
        + provs.map(p => `<option value="${escapeHtml(p.razon_social)}" data-id="${p.id}">${escapeHtml(p.razon_social)}</option>`).join('')
        + `<option value="__nuevo__">➕ Nuevo proveedor...</option>`;

    sel.onchange = () => {
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
    };
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
        if (field.type === 'checkbox') {
            const cb = document.getElementById(field.name);
            data[field.name] = !!(cb && cb.checked);
            return;
        }
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

        // Reset custom obra select
        const csWrapper = document.getElementById('obra-cs-wrapper');
        if (csWrapper) {
            csWrapper.classList.remove('cs-open');
            const vs = csWrapper.querySelector('.cs-value');
            if (vs) { vs.textContent = 'Seleccione una obra...'; vs.classList.add('cs-value--placeholder'); }
            const hi = csWrapper.querySelector('#obra');
            if (hi) hi.value = '';
            csWrapper.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
        }
        const otraTA = document.getElementById('obra_otra');
        if (otraTA) { otraTA.style.display = 'none'; otraTA.required = false; otraTA.value = ''; }

        appState.selectedTemplateConfig.fields.filter(f => f.type === 'array').forEach(f => {
            const c = document.getElementById(`array_${f.name}`);
            if (c) { c.innerHTML = ''; addArrayItem(f.name); }
        });
        const fecha = document.getElementById('fecha');
        if (fecha) fecha.value = hoyLocal();
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

        const dec = (h) => { const v = response.headers.get(h); try { return v ? decodeURIComponent(v) : ''; } catch { return v || ''; } };
        const numeroOC = dec('X-Numero-OC');
        const nombreArchivo = dec('X-Nombre-Archivo');
        const advertencia = dec('X-Advertencia');
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('El PDF generado está vacío');
        const url = window.URL.createObjectURL(blob);

        if (preview) {
            document.getElementById('previewFrame').src = url;
            document.getElementById('previewModal').classList.add('active');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo || `OC_${numeroOC || Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            const tipo = appState.selectedTemplateConfig.tipoDoc === 'OS' ? 'Orden de servicio' : 'Orden de compra';
            if (advertencia) showToast(`${tipo} ${numeroOC} descargada. ATENCIÓN: ${advertencia}`, 'warning', 9000);
            else showToast(`${tipo} ${numeroOC} generada y descargada`, 'success');
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
let _toastTimer = null;
function showToast(message, type = 'info', ms = 3500) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.onclick = (e) => {
    if (e.target.classList.contains('modal') && e.target.id !== 'nameSetupModal')
        e.target.classList.remove('active');
};
