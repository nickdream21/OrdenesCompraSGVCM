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
    empresas: [],
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
    if (_appShown) return; // evita recargar en cada evento de sesión
    _appShown = true;
    cargarEmpresas();

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
    if (view === 'empresas' && window.renderEmpresasAdmin) renderEmpresasAdmin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------------------------
// PASO 1: EMPRESA
// ------------------------------------------------------------
// Empresas: se leen de la tabla `empresas` (o del catálogo si aún no existe)
async function cargarEmpresas(force = false) {
    try { appState.empresas = await sbLoadEmpresas(force); }
    catch (_) { appState.empresas = window.OC_EMPRESAS.map(e => window.OC_CATALOGO.normalizarEmpresa({ codigo: e.codigo })); }
    renderEmpresas();
    poblarSelectsEmpresa();
}

function empresasActivas() { return (appState.empresas || []).filter(e => e.activo !== false); }
function empresaPorCodigo(c) { return (appState.empresas || []).find(e => e.codigo === c) || null; }
function empresaActual() { return empresaPorCodigo(appState.selectedEmpresa); }
function empresaLabel(c) { const e = empresaPorCodigo(c) || window.OC_CATALOGO.getEmpresa(c); return e ? e.nombre : c; }
function logoSrc(e) { return e.logoData || (e.logo ? `images/${e.logo}` : ''); }
function iniciales(nombre) { return String(nombre || '?').split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'; }
function logoHTML(e, clase) {
    const src = logoSrc(e);
    return src ? `<img class="${clase}" src="${escapeHtml(src)}" alt="">`
        : `<span class="${clase} logo-iniciales" style="--emp:${escapeHtml(e.color)}">${escapeHtml(iniciales(e.nombre))}</span>`;
}

function poblarSelectsEmpresa() {
    const opts = empresasActivas().map(e => `<option value="${escapeHtml(e.codigo)}">${escapeHtml(e.nombre)}</option>`).join('');
    const ob = document.getElementById('ob_empresa');
    if (ob) ob.innerHTML = '<option value="">Elige…</option>' + opts;
    const h = document.getElementById('histEmpresa');
    if (h) { const v = h.value; h.innerHTML = '<option value="">Todas las empresas</option>' + opts; h.value = v; }
}

function renderEmpresas() {
    const cont = document.getElementById('empresaSelector');
    cont.innerHTML = empresasActivas().map(e => `
        <button type="button" class="empresa-card${e.codigo === appState.selectedEmpresa ? ' selected' : ''}" role="radio"
                aria-checked="${e.codigo === appState.selectedEmpresa}" data-empresa="${escapeHtml(e.codigo)}" style="--emp:${escapeHtml(e.color)}">
            ${logoHTML(e, 'empresa-logo')}
            <span class="empresa-nombre">${escapeHtml(e.nombre)}</span>
            <span class="empresa-ruc">RUC ${escapeHtml(e.ruc)}</span>
        </button>
    `).join('') + `
        <button type="button" class="empresa-card empresa-nueva" onclick="openEmpresaModal(null)">
            <span class="empresa-logo logo-mas" aria-hidden="true"><i class="fas fa-plus"></i></span>
            <span class="empresa-nombre">Agregar empresa</span>
            <span class="empresa-ruc">Usará el formato NISIRA</span>
        </button>`;
    cont.querySelectorAll('.empresa-card[data-empresa]').forEach(card => {
        card.addEventListener('click', () => selectEmpresa(card.dataset.empresa));
    });
}

function initEmpresaSelector() { /* listeners se agregan en renderEmpresas */ }

function marcarSeleccion(selector, attr, valor) {
    document.querySelectorAll(selector).forEach(c => {
        const on = c.dataset[attr] === valor;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
}

async function selectEmpresa(empresa) {
    appState.selectedEmpresa = empresa;
    appState.selectedTemplate = appState.selectedTemplateConfig = null;
    marcarSeleccion('.empresa-card', 'empresa', empresa);

    // Precargar obras (por empresa) y proveedores (globales)
    try {
        [appState.obras, appState.proveedores] = await Promise.all([
            sbLoadObras(empresa),
            sbLoadProveedores()
        ]);
    } catch (err) {
        showToast('No se pudieron cargar obras y proveedores: ' + err.message, 'error');
    }

    renderTiposOC(empresa);
    document.getElementById('tipoOCSection').style.display = 'block';
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('hoja').hidden = true;

    // Si la empresa tiene un solo tipo de orden, se elige solo
    const tipos = window.OC_CATALOGO.plantillasDe(empresaActual());
    if (tipos.length === 1) selectTipoOC(tipos[0].name);
    else document.getElementById('tipoOCSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ------------------------------------------------------------
// PASO 2: TIPO DE ORDEN
// ------------------------------------------------------------
function renderTiposOC(empresa) {
    const cont = document.getElementById('tipoOCSelector');
    const tipos = window.OC_CATALOGO.plantillasDe(empresaPorCodigo(empresa));
    cont.innerHTML = tipos.map(t => `
        <button type="button" class="tipo-oc-card" role="radio" aria-checked="false" data-template="${t.name}">
            <span class="tipo-oc-nombre">${escapeHtml(t.displayName)}</span>
            <span class="tipo-oc-desc">${escapeHtml(t.description)}</span>
        </button>
    `).join('');
    cont.querySelectorAll('.tipo-oc-card').forEach(card => {
        card.addEventListener('click', () => selectTipoOC(card.dataset.template));
    });
}

function selectTipoOC(templateName) {
    appState.selectedTemplate = templateName;
    appState.selectedTemplateConfig = window.OC_TEMPLATES[templateName];
    marcarSeleccion('.tipo-oc-card', 'template', templateName);
    document.getElementById('formSection').style.display = 'block';
    generateForm(appState.selectedTemplateConfig);
    prepararHoja();
    setTimeout(() => document.getElementById('formSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ------------------------------------------------------------
// FORMULARIO DINÁMICO (agrupado en secciones)
// ------------------------------------------------------------
// Sección a la que pertenece cada campo (por nombre). Lo no listado va a "Detalles".
const GRUPOS = [
    { titulo: 'Fechas', campos: ['fecha', 'fecha_entrega'] },
    { titulo: 'Proveedor', campos: ['proveedor_razon_social', 'proveedor_ruc', 'proveedor_direccion', 'proveedor_cuenta_corriente',
        'proveedor_contacto', 'proveedor_telefono', 'proveedor_correo', 'cuenta_corriente_1', 'cuenta_corriente_2'] },
    { titulo: 'Destino y referencias', campos: ['obra', 'para_ser_usado_en', 'lugar_entrega', 'area', 'cotizacion', 'orden_pedido', 'pedido',
        'lugar_carga', 'vehiculo_carga'] },
    { titulo: 'Pago y moneda', campos: ['condiciones_pago', 'moneda', 'precios_incluyen_igv'] },
    { titulo: 'Ítems', campos: ['items'] },
    { titulo: 'Contacto para el envío', campos: ['contacto_envio_nombre', 'contacto_envio_dni', 'contacto_envio_telefono'] },
    { titulo: 'Observaciones', campos: ['observaciones'] }
];
// Campos que ocupan todo el ancho
const ANCHO_COMPLETO = new Set(['proveedor_razon_social', 'proveedor_direccion', 'obra', 'para_ser_usado_en', 'lugar_entrega',
    'observaciones', 'precios_incluyen_igv', 'contacto_envio_nombre', 'proveedor_cuenta_corriente']);

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
                <span>${escapeHtml(f.label.replace(/^¿Incluir\s*/i, '').replace(/\?$/, ''))}</span>
            </label>
        `).join('');
        optionalSectionFields.forEach(f => {
            document.getElementById(`opt_${f.name}`).addEventListener('change', (e) => {
                appState.optionalFieldsState[f.name] = e.target.checked;
                // Re-dibuja SIN perder lo ya escrito (antes se borraba todo)
                const snapshot = tomarSnapshot();
                renderFields(normalFields, optionalSectionFields, conditionalFields);
                restaurarSnapshot(snapshot);
            });
        });
    } else {
        optionalToggle.style.display = 'none';
        optionalCheckboxes.innerHTML = '';
    }

    renderFields(normalFields, optionalSectionFields, conditionalFields);
}

function renderFields(normalFields, optionalSectionFields, conditionalFields) {
    const fieldsToShow = [...normalFields];
    optionalSectionFields.forEach(optField => {
        if (appState.optionalFieldsState[optField.name]) {
            fieldsToShow.push(...conditionalFields.filter(f => f.conditional === optField.name));
        }
    });

    const usados = new Set();
    const html = GRUPOS.map(g => {
        const campos = fieldsToShow.filter(f => g.campos.includes(f.name));
        campos.forEach(f => usados.add(f.name));
        return campos.length ? renderGrupo(g.titulo, campos) : '';
    });
    const resto = fieldsToShow.filter(f => !usados.has(f.name));
    if (resto.length) html.push(renderGrupo('Detalles', resto));
    document.getElementById('formFields').innerHTML = html.join('');

    const fecha = document.getElementById('fecha');
    if (fecha && !fecha.value) fecha.value = hoyLocal();

    populateObraSelect();
    populateProveedorSelect();
    initArrayFields();
    actualizarHoja();
}

function renderGrupo(titulo, campos) {
    if (campos.length === 1 && campos[0].type === 'array') {
        return `<fieldset class="grupo"><legend class="grupo-titulo">${titulo}</legend>${generateFieldHTML(campos[0])}</fieldset>`;
    }
    return `
        <fieldset class="grupo">
            <legend class="grupo-titulo">${titulo}</legend>
            <div class="form-grid">${campos.map(generateFieldHTML).join('')}</div>
        </fieldset>`;
}

function generateFieldHTML(field) {
    if (field.type === 'array') return generateArrayFieldHTML(field);

    const reqClass = field.required ? 'required' : '';
    const reqAttr = field.required ? 'required' : '';
    const span = ANCHO_COMPLETO.has(field.name) || field.type === 'textarea' ? ' span-2' : '';
    const ph = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
    let input = '';

    if (field.source === 'obra') {
        return `
            <div class="form-group span-2">
                <label class="form-label ${reqClass}">${field.label}</label>
                <div id="obra-cs-wrapper" class="cs-wrapper"></div>
                <textarea class="form-control" id="obra_otra" name="obra_otra" rows="2"
                    placeholder="Escribe el nombre de la obra" style="display:none; margin-top:8px;"></textarea>
            </div>`;
    }

    if (field.source === 'proveedor') {
        return `
            <div class="form-group span-2">
                <label class="form-label ${reqClass}">${field.label}</label>
                <div id="proveedor-cs-wrapper" class="cs-wrapper"></div>
            </div>`;
    }

    switch (field.type) {
        case 'text':
        case 'email':
        case 'date': {
            const extra = field.validate === 'ruc' || field.validate === 'dni' ? ' inputmode="numeric"'
                : field.validate === 'phone' ? ' inputmode="tel"' : '';
            input = `<input type="${field.type}" class="form-control" name="${field.name}" id="${field.name}"${ph}${extra} ${reqAttr}>`;
            break;
        }
        case 'number':
            input = `<input type="number" class="form-control" name="${field.name}" id="${field.name}" step="${field.step || '1'}" min="0" inputmode="decimal"${ph} ${reqAttr}>`;
            break;
        case 'textarea':
            input = `<textarea class="form-control" name="${field.name}" id="${field.name}" rows="${field.rows || 3}"${ph} ${reqAttr}></textarea>`;
            break;
        case 'select':
            input = `<select class="form-control" name="${field.name}" id="${field.name}" ${reqAttr}>
                ${field.default ? '' : '<option value="">Elige…</option>'}
                ${(field.options || []).map(o => `<option value="${o}"${o === field.default ? ' selected' : ''}>${o}</option>`).join('')}
            </select>`;
            break;
        case 'checkbox':
            return `
                <div class="form-group${span}">
                    <label class="form-check"><input type="checkbox" name="${field.name}" id="${field.name}"> ${field.label}</label>
                </div>`;
    }

    return `
        <div class="form-group${span}">
            <label class="form-label ${reqClass}" for="${field.name}">${field.label}</label>
            ${input}
        </div>`;
}

// ---- Conservar lo escrito al re-dibujar ----
function tomarSnapshot() {
    const campos = {};
    document.querySelectorAll('#formFields [id]').forEach(el => {
        if (el.closest('.item')) return;
        if (el.type === 'checkbox') campos[el.id] = el.checked;
        else if ('value' in el) campos[el.id] = el.value;
    });
    const obraLabel = document.querySelector('#obra-cs-wrapper .cs-value:not(.cs-value--placeholder)');
    const items = [...document.querySelectorAll('#formFields .item')].map(item => {
        const o = {};
        item.querySelectorAll('[data-sub]').forEach(i => { o[i.dataset.sub] = i.value; });
        return o;
    });
    return { campos, items, obraLabel: obraLabel ? obraLabel.textContent : null };
}

function restaurarSnapshot(s) {
    Object.entries(s.campos).forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = v; else el.value = v;
    });
    if (s.obraLabel && s.campos.obra) {
        const vs = document.querySelector('#obra-cs-wrapper .cs-value');
        if (vs) { vs.textContent = s.obraLabel; vs.classList.remove('cs-value--placeholder'); }
        if (s.campos.obra === '__otra__') {
            const ta = document.getElementById('obra_otra');
            if (ta) ta.style.display = 'block';
        }
    }
    if (s.campos.proveedor_razon_social && _comboProveedor) {
        _comboProveedor.fijar(s.campos.proveedor_razon_social, s.campos.proveedor_razon_social);
    }
    const field = appState.selectedTemplateConfig.fields.find(f => f.type === 'array');
    if (field && s.items.length) {
        const cont = document.getElementById(`array_${field.name}`);
        cont.innerHTML = '';
        s.items.forEach(vals => addArrayItem(field.name, vals));
    }
    actualizarHoja();
}

// ------------------------------------------------------------
// BUSCADOR DESPLEGABLE (obra y proveedor)
// Escritorio: lista bajo el campo. Móvil: hoja inferior con buscador.
// ------------------------------------------------------------
const _normaliza = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
let _comboAbierto = null;
document.addEventListener('click', (e) => {
    if (_comboAbierto && !_comboAbierto.wrapper.contains(e.target)) _comboAbierto.cerrar();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _comboAbierto) _comboAbierto.cerrar();
});

/**
 * @param {HTMLElement} wrapper
 * @param {object} cfg { hiddenId, placeholder, titulo, buscarPlaceholder, opciones:[{value,label,sub,data}],
 *                       extra:{label, icon} (opción fija al final), onPick(opt, consulta), vacio }
 */
function crearCombo(wrapper, cfg) {
    wrapper.innerHTML = `
        <button type="button" class="cs-trigger" aria-haspopup="listbox" aria-expanded="false">
            <span class="cs-value cs-value--placeholder">${escapeHtml(cfg.placeholder)}</span>
            <i class="fas fa-chevron-down cs-arrow" aria-hidden="true"></i>
        </button>
        <input type="hidden" id="${cfg.hiddenId}" name="${cfg.hiddenId}">
        <div class="cs-backdrop"></div>
        <div class="cs-panel" role="dialog" aria-label="${escapeHtml(cfg.titulo)}">
            <div class="cs-panel-header">
                <span class="cs-panel-title">${escapeHtml(cfg.titulo)}</span>
                <button type="button" class="cs-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
            </div>
            <div class="cs-search-wrapper">
                <i class="fas fa-search cs-search-icon" aria-hidden="true"></i>
                <input type="search" class="cs-search" placeholder="${escapeHtml(cfg.buscarPlaceholder)}"
                       autocomplete="off" aria-label="${escapeHtml(cfg.buscarPlaceholder)}">
            </div>
            <div class="cs-options" role="listbox"></div>
        </div>`;

    const trigger = wrapper.querySelector('.cs-trigger');
    const valor = wrapper.querySelector('.cs-value');
    const hidden = wrapper.querySelector('input[type=hidden]');
    const buscar = wrapper.querySelector('.cs-search');
    const lista = wrapper.querySelector('.cs-options');
    const indice = cfg.opciones.map(o => ({ o, t: _normaliza(o.label + ' ' + (o.sub || '')) }));

    const pintar = (q) => {
        const qn = _normaliza(q).trim();
        const visibles = qn ? indice.filter(x => x.t.includes(qn)).map(x => x.o) : cfg.opciones;
        lista.innerHTML = visibles.slice(0, 80).map((o, i) => `
            <div class="cs-option${o.value === hidden.value ? ' selected' : ''}" role="option" tabindex="0" data-i="${cfg.opciones.indexOf(o)}">
                <span class="cs-opt-label">${escapeHtml(o.label)}</span>
                ${o.sub ? `<span class="cs-opt-sub">${escapeHtml(o.sub)}</span>` : ''}
            </div>`).join('')
            + (!visibles.length ? `<div class="cs-no-results">${escapeHtml(cfg.vacio ? cfg.vacio(q) : 'Sin resultados')}</div>` : '')
            + (cfg.extra ? `<div class="cs-option cs-option-other" role="option" tabindex="0" data-extra="1">
                    <i class="fas ${cfg.extra.icon}" aria-hidden="true"></i><span class="cs-opt-label">${escapeHtml(typeof cfg.extra.label === 'function' ? cfg.extra.label(q) : cfg.extra.label)}</span></div>` : '');
    };

    const api = {
        wrapper,
        abrir() {
            if (_comboAbierto && _comboAbierto !== api) _comboAbierto.cerrar();
            _comboAbierto = api;
            wrapper.classList.add('cs-open');
            trigger.setAttribute('aria-expanded', 'true');
            document.body.classList.add('combo-abierto');
            pintar('');
            setTimeout(() => buscar.focus(), 60);
        },
        cerrar() {
            wrapper.classList.remove('cs-open');
            trigger.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('combo-abierto');
            buscar.value = '';
            if (_comboAbierto === api) _comboAbierto = null;
        },
        fijar(value, label) {
            hidden.value = value;
            valor.textContent = label || cfg.placeholder;
            valor.classList.toggle('cs-value--placeholder', !label);
        }
    };

    const elegir = (el) => {
        const q = buscar.value;
        if (el.dataset.extra) { api.cerrar(); cfg.onPick(null, q); return; }
        const o = cfg.opciones[+el.dataset.i];
        api.fijar(o.value, o.label);
        api.cerrar();
        cfg.onPick(o, q);
    };

    trigger.addEventListener('click', () => wrapper.classList.contains('cs-open') ? api.cerrar() : api.abrir());
    wrapper.querySelector('.cs-backdrop').addEventListener('click', api.cerrar);
    wrapper.querySelector('.cs-close').addEventListener('click', api.cerrar);
    buscar.addEventListener('input', () => pintar(buscar.value));
    buscar.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); const f = lista.querySelector('.cs-option'); if (f) f.focus(); }
        if (e.key === 'Enter') {
            e.preventDefault();
            const opciones = lista.querySelectorAll('.cs-option:not(.cs-option-other)');
            if (opciones.length === 1) elegir(opciones[0]);
        }
    });
    lista.addEventListener('click', (e) => { const el = e.target.closest('.cs-option'); if (el) elegir(el); });
    lista.addEventListener('keydown', (e) => {
        const el = e.target.closest('.cs-option');
        if (!el) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(el); }
        if (e.key === 'ArrowDown' && el.nextElementSibling) { e.preventDefault(); el.nextElementSibling.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (el.previousElementSibling || buscar).focus(); }
    });
    return api;
}

// ---- Obra ----
function populateObraSelect() {
    const wrapper = document.getElementById('obra-cs-wrapper');
    if (!wrapper) return;
    const otra = () => document.getElementById('obra_otra');
    crearCombo(wrapper, {
        hiddenId: 'obra',
        placeholder: 'Elige una obra…',
        titulo: 'Elegir obra',
        buscarPlaceholder: 'Buscar obra',
        opciones: (appState.obras || []).map(o => ({ value: o.nombre, label: o.nombre, sub: o.direccion || '' })),
        extra: { label: 'Otra obra (escribirla)', icon: 'fa-pencil' },
        vacio: () => 'No hay obras con ese nombre.',
        onPick: (o) => {
            const ta = otra();
            if (!o) {
                document.getElementById('obra').value = '__otra__';
                wrapper.querySelector('.cs-value').textContent = 'Otra obra';
                wrapper.querySelector('.cs-value').classList.remove('cs-value--placeholder');
                if (ta) { ta.style.display = 'block'; ta.required = true; setTimeout(() => ta.focus(), 50); }
            } else if (ta) { ta.style.display = 'none'; ta.required = false; ta.value = ''; }
            actualizarHoja();
        }
    });
}

// ---- Proveedor: buscar por nombre o RUC ----
let _comboProveedor = null;
function populateProveedorSelect() {
    const wrapper = document.getElementById('proveedor-cs-wrapper');
    if (!wrapper) return;
    const provs = appState.proveedores || [];
    _comboProveedor = crearCombo(wrapper, {
        hiddenId: 'proveedor_razon_social',
        placeholder: 'Busca por nombre o RUC…',
        titulo: 'Elegir proveedor',
        buscarPlaceholder: 'Nombre o RUC del proveedor',
        opciones: provs.map(p => ({ value: p.razon_social, label: p.razon_social, sub: p.ruc ? `RUC ${p.ruc}` : 'Sin RUC', data: p })),
        extra: { label: (q) => /^\d{11}$/.test(q.trim()) ? `Registrar proveedor con RUC ${q.trim()}` : 'Registrar proveedor nuevo', icon: 'fa-plus' },
        vacio: (q) => /^\d{11}$/.test(q.trim()) ? 'Ese RUC no está registrado todavía.' : 'Sin coincidencias.',
        onPick: (o, q) => {
            if (o) { applyProveedorAutofill(o.data); actualizarHoja(); return; }
            const preset = /^\d{11}$/.test((q || '').trim()) ? { ruc: q.trim() } : (q ? { razon_social: q.trim() } : null);
            window.openNuevoProveedor(async (nuevo) => {
                appState.proveedores = await sbLoadProveedores(true);
                populateProveedorSelect();
                _comboProveedor.fijar(nuevo.razon_social, nuevo.razon_social);
                applyProveedorAutofill(nuevo);
                actualizarHoja();
            }, preset);
        }
    });
}

function applyProveedorAutofill(prov) {
    Object.entries(window.PROVEEDOR_AUTOFILL).forEach(([fieldName, col]) => {
        const el = document.getElementById(fieldName);
        if (el && prov[col] != null) el.value = prov[col];
    });
}

// ------------------------------------------------------------
// ÍTEMS (filas con importe calculado)
// ------------------------------------------------------------
// Rol visual de cada sub-campo dentro de la fila
const ITEM_ROL = { descripcion: 'desc', cantidad: 'cant', unidad: 'um', precio_unitario: 'pu' };

function generateArrayFieldHTML(field) {
    return `
        <div class="array-field" data-array-name="${field.name}">
            <div class="array-items" id="array_${field.name}"></div>
            <button type="button" class="btn btn-secondary btn-sm btn-add-item" onclick="addArrayItem('${field.name}')">
                <i class="fas fa-plus"></i> Agregar ítem
            </button>
        </div>`;
}

function initArrayFields() {
    (appState.selectedTemplateConfig.fields.filter(f => f.type === 'array')).forEach(f => {
        const cont = document.getElementById(`array_${f.name}`);
        if (cont && cont.children.length === 0) addArrayItem(f.name);
    });
}

function subInputHTML(sf, valor) {
    const reqAttr = sf.required ? 'required' : '';
    const reqClass = sf.required ? 'required' : '';
    const v = valor != null ? ` value="${escapeHtml(valor)}"` : '';
    const ph = sf.placeholder ? ` placeholder="${escapeHtml(sf.placeholder)}"` : '';
    let input;
    if (sf.type === 'textarea') {
        input = `<textarea class="form-control" data-sub="${sf.name}" rows="1"${ph} ${reqAttr}>${valor != null ? escapeHtml(valor) : ''}</textarea>`;
    } else if (sf.type === 'number') {
        input = `<input type="number" class="form-control" data-sub="${sf.name}" step="${sf.step || '0.01'}" min="0" inputmode="decimal"${ph}${v} ${reqAttr}>`;
    } else {
        input = `<input type="${sf.type}" class="form-control" data-sub="${sf.name}"${ph}${v} ${reqAttr}>`;
    }
    return `<label class="form-label ${reqClass}">${sf.label}</label>${input}`;
}

function addArrayItem(arrayName, valores) {
    const field = appState.selectedTemplateConfig.fields.find(f => f.name === arrayName);
    if (!field) return;
    const container = document.getElementById(`array_${arrayName}`);
    const vals = valores || {};

    const principales = field.fields.filter(sf => ITEM_ROL[sf.name]);
    const extras = field.fields.filter(sf => !ITEM_ROL[sf.name]);
    const orden = ['descripcion', 'cantidad', 'unidad', 'precio_unitario'];
    principales.sort((a, b) => orden.indexOf(a.name) - orden.indexOf(b.name));

    container.insertAdjacentHTML('beforeend', `
        <div class="item">
            <span class="item-n"></span>
            ${principales.map(sf => `<div class="form-group item-${ITEM_ROL[sf.name]}">${subInputHTML(sf, vals[sf.name])}</div>`).join('')}
            <div class="item-importe"><span class="form-label">Importe</span><output>0.00</output></div>
            <div class="item-quitar">
                <button type="button" class="btn btn-ghost btn-sm" title="Quitar ítem" aria-label="Quitar ítem"
                        onclick="removeArrayItem('${arrayName}', this)"><i class="fas fa-trash"></i></button>
            </div>
            ${extras.length ? `<div class="item-extra">${extras.map(sf => `<div class="form-group">${subInputHTML(sf, vals[sf.name])}</div>`).join('')}</div>` : ''}
        </div>`);
    numerarItems(container);
    if (!valores) {
        const nuevo = container.lastElementChild.querySelector('[data-sub="descripcion"]');
        if (nuevo && container.children.length > 1) nuevo.focus();
    }
    actualizarHoja();
}

// La descripción del ítem crece con el texto (sin barra de desplazamiento)
function autoAltura(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
}

function numerarItems(container) {
    container.querySelectorAll('textarea[data-sub]').forEach(autoAltura);
    container.querySelectorAll('.item').forEach((item, i) => {
        item.querySelector('.item-n').textContent = String(i + 1).padStart(2, '0');
    });
}

function removeArrayItem(arrayName, btn) {
    const container = document.getElementById(`array_${arrayName}`);
    if (container.querySelectorAll('.item').length <= 1) {
        showToast('La orden necesita al menos un ítem.', 'warning');
        return;
    }
    btn.closest('.item').remove();
    numerarItems(container);
    actualizarHoja();
}

// ------------------------------------------------------------
// HOJA: resumen vivo del documento
// ------------------------------------------------------------
// Cálculo de referencia en pantalla. El PDF lo calcula el servidor
// (lib/calculo.js) con la misma regla; aquí solo se muestra.
const _r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const _fmt = (n, d = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function calcularEnPantalla(items) {
    const cfg = appState.selectedTemplateConfig;
    if (!cfg) return null;
    const monedaSel = document.getElementById('moneda');
    const igvIncl = document.getElementById('precios_incluyen_igv');
    const modo = cfg.calculo;
    const moneda = (modo === 'nisira' && monedaSel && monedaSel.value) || (cfg.moneda === 'USD' ? 'USD' : 'PEN');
    const incluye = modo === 'nisira' && igvIncl && igvIncl.checked;

    let bruto = 0;
    const lineas = items.map(it => {
        const c = parseFloat(it.cantidad) || 0;
        const p = parseFloat(it.precio_unitario) || 0;
        bruto += c * p;
        const neto = incluye ? p / 1.18 : p;
        return { ...it, importe: _r2(c * neto) };
    });
    const vv = _r2(lineas.reduce((s, l) => s + l.importe, 0));
    let igv, total;
    if (modo === 'sin_igv') { igv = 0; total = vv; }
    else if (incluye) { total = _r2(bruto); igv = _r2(total - vv); }
    else { igv = _r2(vv * 0.18); total = _r2(vv + igv); }
    return { lineas, vv, igv, total, moneda, sinIgv: modo === 'sin_igv' };
}

function leerItems() {
    return [...document.querySelectorAll('#formFields .item')].map(item => {
        const o = {};
        item.querySelectorAll('[data-sub]').forEach(i => { o[i.dataset.sub] = i.value.trim(); });
        return o;
    });
}

function prepararHoja() {
    const cfg = appState.selectedTemplateConfig;
    const emp = empresaActual();
    const hoja = document.getElementById('hoja');
    hoja.hidden = false;
    const hl = document.getElementById('hojaLogo');
    hl.src = logoSrc(emp); hl.hidden = !hl.src;
    document.getElementById('hojaRuc').textContent = `RUC ${emp.ruc}`;
    document.getElementById('hojaTipo').textContent = cfg.tipoDoc === 'OS' ? 'ORDEN DE SERVICIO' : 'ORDEN DE COMPRA';
    const num = document.getElementById('hojaNumero');
    num.textContent = 'N° se asigna al generar';
    num.classList.remove('listo');
    document.getElementById('hojaEmpresa').textContent = emp.razonSocial || emp.nombre;
    actualizarHoja();
}

function actualizarHoja() {
    const cfg = appState.selectedTemplateConfig;
    if (!cfg || document.getElementById('hoja').hidden) return;
    const items = leerItems();
    const c = calcularEnPantalla(items);

    // Importe por fila
    document.querySelectorAll('#formFields .item').forEach((row, i) => {
        const out = row.querySelector('.item-importe output');
        if (out && c.lineas[i]) out.textContent = _fmt(c.lineas[i].importe);
    });

    const prov = document.getElementById('proveedor_razon_social');
    document.getElementById('hojaProveedor').textContent = prov && prov.value && prov.value !== '__nuevo__' ? prov.value : 'Sin elegir';
    const f = document.getElementById('fecha');
    document.getElementById('hojaFecha').textContent = f && f.value ? f.value.split('-').reverse().join('/') : '—';

    const lista = document.getElementById('hojaItems');
    const conDatos = c.lineas.filter(l => l.descripcion || l.importe);
    lista.innerHTML = conDatos.length
        ? conDatos.map(l => `<li><span>${escapeHtml(l.descripcion || 'Ítem sin descripción')}</span><span>${_fmt(l.importe)}</span></li>`).join('')
        : '<li class="vacio">Los ítems aparecerán aquí.</li>';

    document.getElementById('hojaRowVV').hidden = c.sinIgv;
    document.getElementById('hojaRowIGV').hidden = c.sinIgv;
    document.getElementById('hojaVV').textContent = _fmt(c.vv);
    document.getElementById('hojaIGV').textContent = _fmt(c.igv);
    document.getElementById('hojaTotal').textContent = _fmt(c.total);
    document.getElementById('hojaMoneda').textContent = c.moneda;
    document.getElementById('hojaSon').textContent = c.total > 0 ? 'Monto estimado. El PDF muestra el total en letras.' : '';
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
            if (vs) { vs.textContent = 'Elige una obra…'; vs.classList.add('cs-value--placeholder'); }
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
        actualizarHoja();
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        appState.selectedEmpresa = appState.selectedTemplate = appState.selectedTemplateConfig = null;
        document.querySelectorAll('.empresa-card, .tipo-oc-card').forEach(c => {
            c.classList.remove('selected'); c.setAttribute('aria-checked', 'false');
        });
        document.getElementById('tipoOCSection').style.display = 'none';
        document.getElementById('formSection').style.display = 'none';
        document.getElementById('hoja').hidden = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // La hoja se actualiza con cada cambio del formulario
    const form = document.getElementById('ocForm');
    form.addEventListener('input', actualizarHoja);
    form.addEventListener('change', actualizarHoja);
    form.addEventListener('input', (e) => {
        e.target.classList && e.target.classList.remove('invalido');
        if (e.target.matches && e.target.matches('textarea[data-sub]')) autoAltura(e.target);
    });

    document.getElementById('ocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generatePDF(false);
    });

    document.getElementById('previewBtn').addEventListener('click', () => generatePDF(true));
}

// Resalta los campos obligatorios vacíos y lleva el foco al primero
function marcarInvalidos() {
    let primero = null;
    document.querySelectorAll('#ocForm [required]').forEach(el => {
        const vacio = !String(el.value || '').trim();
        el.classList.toggle('invalido', vacio);
        if (vacio && !primero && el.offsetParent !== null) primero = el;
    });
    if (primero) primero.focus({ preventScroll: false });
}

async function generatePDF(preview) {
    const data = collectFormData();
    const errors = validateData(data);
    if (errors.length) {
        marcarInvalidos();
        showToast(errors.length > 1 ? `${errors[0]} (y ${errors.length - 1} más)` : errors[0], 'error', 5000);
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
            const hn = document.getElementById('hojaNumero');
            if (numeroOC) { hn.textContent = `N° ${numeroOC}`; hn.classList.add('listo'); }
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
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Búsqueda instantánea en las tablas de listado
function filtrarFilas(inputId, contId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        document.querySelectorAll(`#${contId} tbody tr`).forEach(tr => {
            tr.hidden = q && !tr.textContent.toLowerCase().includes(q);
        });
    });
}
document.addEventListener('DOMContentLoaded', () => {
    filtrarFilas('pvBuscar', 'proveedoresContent');
    // Móvil: tocar el total abre/cierra el resumen completo
    document.getElementById('hojaToggle').addEventListener('click', () => {
        if (!window.matchMedia('(max-width: 860px)').matches) return;
        const h = document.getElementById('hoja');
        const abierta = h.classList.toggle('abierta');
        document.getElementById('hojaToggle').setAttribute('aria-expanded', abierta);
    });
    filtrarFilas('histBuscar', 'historialContent');
});

window.onclick = (e) => {
    if (e.target.classList.contains('modal') && e.target.id !== 'nameSetupModal')
        e.target.classList.remove('active');
};
