// ============================================================
// EMPRESAS (alta y edición desde la app)
// ============================================================
// Las empresas nuevas usan el formato NISIRA (OC y OS) con sus datos,
// logo y firma. VIVIANA y CAMAFRA conservan su formato propio.

let _empEditCodigo = null;
const _empImg = { logo: undefined, firma: undefined }; // undefined = sin cambios, null = quitar

async function renderEmpresasAdmin() {
    const cont = document.getElementById('empresasContent');
    cont.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
    const lista = await sbLoadEmpresas(true);
    appState.empresas = lista;
    renderEmpresas();
    poblarSelectsEmpresa();

    if (lista.sinTabla) {
        cont.innerHTML = `<div class="empty"><strong>Falta preparar la base de datos</strong>
            Ejecuta <code>supabase/migracion_v4_empresas.sql</code> en Supabase para poder crear empresas.</div>`;
        return;
    }
    cont.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Empresa</th><th>RUC</th><th>Formato</th><th>Aprueba</th><th></th></tr></thead>
            <tbody>
              ${lista.map(e => `
                <tr class="${e.activo === false ? 'fila-inactiva' : ''}">
                  <td data-label="Empresa"><span class="celda-empresa">${logoHTML(e, 'mini-logo')}<span>${escapeHtml(e.nombre)}${e.activo === false ? ' <span class="badge">Inactiva</span>' : ''}</span></span></td>
                  <td data-label="RUC">${escapeHtml(e.ruc)}</td>
                  <td data-label="Formato">${e.formato === 'nisira' ? `NISIRA · serie ${escapeHtml(e.serie || '0001')}` : 'Propio'}</td>
                  <td data-label="Aprueba">${escapeHtml(e.aprobador || '—')}</td>
                  <td class="row-actions">
                    <button class="btn btn-sm btn-secondary" data-accion="editar" data-codigo="${escapeHtml(e.codigo)}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn btn-sm ${e.activo === false ? 'btn-secondary' : 'btn-danger'}" data-accion="${e.activo === false ? 'activar' : 'ocultar'}" data-codigo="${escapeHtml(e.codigo)}"
                        aria-label="${e.activo === false ? 'Activar' : 'Desactivar'} empresa">
                        <i class="fas ${e.activo === false ? 'fa-rotate-left' : 'fa-eye-slash'}"></i></button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    // Sin onclick en línea: el código de la empresa nunca se interpreta como JavaScript
    cont.querySelectorAll('button[data-codigo]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.accion === 'editar') editarEmpresa(b.dataset.codigo);
        else alternarEmpresa(b.dataset.codigo, b.dataset.accion === 'activar');
    }));
}

function _val(id, v) { const el = document.getElementById(id); if (v === undefined) return el.value.trim(); el.value = v || ''; }

function openEmpresaModal(emp) {
    if (appState.empresas && appState.empresas.sinTabla) {
        showToast('Primero hay que ejecutar la migración de empresas en Supabase.', 'warning', 6000);
        return;
    }
    _empEditCodigo = emp ? emp.codigo : null;
    _empImg.logo = _empImg.firma = undefined;
    document.getElementById('empModalTitle').textContent = emp ? 'Editar empresa' : 'Nueva empresa';
    document.getElementById('empModalError').textContent = '';
    _val('emp_nombre', emp && emp.nombre);
    _val('emp_razon', emp && emp.razonSocial);
    _val('emp_ruc', emp && emp.ruc);
    _val('emp_direccion', emp && emp.direccion);
    _val('emp_telefono', emp && emp.telefono);
    _val('emp_email', emp && emp.email);
    _val('emp_aprobador', emp && emp.aprobador);
    _val('emp_serie', (emp && emp.serie) || '0001');
    document.getElementById('emp_color').value = (emp && emp.color) || '#16324F';
    _val('emp_ult_oc', '0'); _val('emp_ult_os', '0');
    document.getElementById('empNumeracionNueva').hidden = !!emp;
    document.getElementById('empFormatoPropio').hidden = !(emp && emp.formato === 'propio');
    document.getElementById('empSerieGrupo').hidden = !!(emp && emp.formato === 'propio');
    mostrarImagen('logo', emp ? logoSrc(emp) : '');
    mostrarImagen('firma', emp ? (emp.firmaData || '') : '');
    document.getElementById('empresaModal').classList.add('active');
    setTimeout(() => document.getElementById(emp ? 'emp_nombre' : 'emp_ruc').focus(), 60);
}

function editarEmpresa(codigo) {
    const e = empresaPorCodigo(codigo);
    if (e) openEmpresaModal(e);
}

function mostrarImagen(tipo, src) {
    const img = document.getElementById(`emp_${tipo}_prev`);
    const vacio = document.getElementById(`emp_${tipo}_vacio`);
    const quitar = document.getElementById(`emp_${tipo}_quitar`);
    img.hidden = !src; vacio.hidden = !!src; quitar.hidden = !src;
    if (src) img.src = src; else img.removeAttribute('src');
}

// Reduce la imagen en el navegador (máx. 480 px) para guardarla liviana en la base
async function leerImagen(file, conTransparencia) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Usa una imagen PNG o JPG.');
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let url = c.toDataURL('image/png');
    if (url.length > 400000 && !conTransparencia) url = c.toDataURL('image/jpeg', 0.85);
    if (url.length > 440000) throw new Error('La imagen es demasiado grande incluso reducida.');
    return url;
}

async function consultarRucEmpresa() {
    const ruc = _val('emp_ruc');
    const btn = document.getElementById('empSunatBtn');
    const err = document.getElementById('empModalError');
    err.textContent = '';
    if (!/^\d{11}$/.test(ruc)) { err.textContent = 'Escribe un RUC de 11 dígitos.'; return; }
    btn.disabled = true;
    try {
        const d = await sbConsultarRuc(ruc);
        _val('emp_razon', d.razon_social);
        if (d.direccion) _val('emp_direccion', d.direccion);
        if (!_val('emp_nombre')) _val('emp_nombre', d.razon_social);
        showToast('Datos traídos de SUNAT. Revísalos antes de guardar.', 'success');
    } catch (e) {
        err.textContent = e.status === 501 ? 'La consulta a SUNAT no está activada. Completa los datos a mano.' : e.message;
    } finally { btn.disabled = false; }
}

const _slug = (t) => _normaliza(t).replace(/&/g, 'y').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'empresa';

async function guardarEmpresa() {
    const err = document.getElementById('empModalError');
    err.textContent = '';
    const reg = {
        nombre: _val('emp_nombre'),
        razon_social: _val('emp_razon').toUpperCase(),
        ruc: _val('emp_ruc'),
        direccion: _val('emp_direccion') || null,
        telefono: _val('emp_telefono') || null,
        email: _val('emp_email') || null,
        aprobador: _val('emp_aprobador') || null,
        color: document.getElementById('emp_color').value,
        serie: (_val('emp_serie') || '0001').padStart(4, '0')
    };
    if (!/^\d{11}$/.test(reg.ruc)) { err.textContent = 'El RUC debe tener 11 dígitos.'; return; }
    if (!reg.razon_social) { err.textContent = 'La razón social es obligatoria.'; return; }
    if (!reg.nombre) reg.nombre = reg.razon_social;
    if (!/^\d{1,4}$/.test(reg.serie)) { err.textContent = 'La serie debe ser un número de hasta 4 dígitos (ej. 0001).'; return; }
    const repetida = (appState.empresas || []).find(e => e.ruc === reg.ruc && e.codigo !== _empEditCodigo);
    if (repetida) { err.textContent = `Ese RUC ya está registrado como “${repetida.nombre}”.`; return; }
    if (_empImg.logo !== undefined) reg.logo_data = _empImg.logo;
    if (_empImg.firma !== undefined) reg.firma_data = _empImg.firma;

    const btn = document.getElementById('empSaveBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';
    try {
        if (_empEditCodigo) {
            const { error } = await SB.from('empresas').update(reg).eq('codigo', _empEditCodigo);
            if (error) throw error;
        } else {
            let codigo = _slug(reg.nombre), n = 2;
            while (empresaPorCodigo(codigo)) codigo = `${_slug(reg.nombre).slice(0, 27)}-${n++}`;
            const { error } = await SB.from('empresas').insert({ ...reg, codigo, formato: 'nisira' });
            if (error) throw error;
            const { error: e2 } = await SB.rpc('inicializar_correlativos', {
                p_empresa: codigo,
                p_ultimo_oc: parseInt(_val('emp_ult_oc'), 10) || 0,
                p_ultimo_os: parseInt(_val('emp_ult_os'), 10) || 0
            });
            if (e2) throw e2;
        }
        closeModal('empresaModal');
        showToast(_empEditCodigo ? 'Empresa actualizada' : 'Empresa creada', 'success');
        await renderEmpresasAdmin();
    } catch (e) {
        err.textContent = 'No se pudo guardar: ' + e.message;
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

async function alternarEmpresa(codigo, activar) {
    if (!activar && !confirm('¿Ocultar esta empresa? Sus órdenes siguen en el historial y puedes reactivarla.')) return;
    const { error } = await SB.from('empresas').update({ activo: !!activar }).eq('codigo', codigo);
    if (error) { showToast('No se pudo cambiar: ' + error.message, 'error'); return; }
    if (!activar && appState.selectedEmpresa === codigo) document.getElementById('backBtn').click();
    showToast(activar ? 'Empresa activada' : 'Empresa ocultada', 'success');
    renderEmpresasAdmin();
}

document.addEventListener('DOMContentLoaded', () => {
    const add = document.getElementById('addEmpresaBtn');
    if (add) add.addEventListener('click', () => openEmpresaModal(null));
    const form = document.getElementById('empresaModalForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); guardarEmpresa(); });
    const sunat = document.getElementById('empSunatBtn');
    if (sunat) sunat.addEventListener('click', consultarRucEmpresa);

    ['logo', 'firma'].forEach(tipo => {
        const input = document.getElementById(`emp_${tipo}`);
        if (!input) return;
        input.addEventListener('change', async () => {
            const f = input.files && input.files[0];
            if (!f) return;
            try {
                _empImg[tipo] = await leerImagen(f, tipo === 'firma' || f.type === 'image/png');
                mostrarImagen(tipo, _empImg[tipo]);
            } catch (e) {
                document.getElementById('empModalError').textContent = e.message;
            }
            input.value = '';
        });
        document.getElementById(`emp_${tipo}_quitar`).addEventListener('click', () => {
            _empImg[tipo] = null;
            mostrarImagen(tipo, '');
        });
    });
});
