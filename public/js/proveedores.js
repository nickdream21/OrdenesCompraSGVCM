// ============================================================
// GESTIÓN DE PROVEEDORES (CRUD sobre Supabase)
// ============================================================

let _pvEditId = null;
let _pvOnSaved = null;

async function renderProveedores() {
    const cont = document.getElementById('proveedoresContent');
    cont.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const provs = await sbLoadProveedores(true);
        if (provs.length === 0) {
            cont.innerHTML = '<div class="empty"><strong>Aún no hay proveedores</strong>Registra el primero con “Nuevo proveedor”. También puedes hacerlo desde una orden.</div>';
            return;
        }
        cont.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead><tr><th>Razón social</th><th>RUC</th><th>Dirección</th><th>Contacto</th><th></th></tr></thead>
                <tbody>
                  ${provs.map(p => `
                    <tr>
                      <td data-label="Razón social">${escapeHtml(p.razon_social)}</td>
                      <td data-label="RUC">${escapeHtml(p.ruc || '')}</td>
                      <td data-label="Dirección">${escapeHtml(p.direccion || '')}</td>
                      <td data-label="Contacto">${escapeHtml(p.contacto || '')}${p.telefono ? ' · ' + escapeHtml(p.telefono) : ''}</td>
                      <td class="row-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editProveedor(${p.id})" aria-label="Editar proveedor"><i class="fas fa-pen"></i> Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deactivateProveedor(${p.id})" aria-label="Quitar proveedor"><i class="fas fa-trash"></i></button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
    } catch (err) {
        cont.innerHTML = `<p class="empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function openProveedorModal(prov, onSaved) {
    _pvEditId = prov ? prov.id : null;
    _pvOnSaved = onSaved || null;
    document.getElementById('pvModalTitle').textContent = prov ? 'Editar proveedor' : 'Nuevo proveedor';
    document.getElementById('pvModalError').textContent = '';
    const set = (id, v) => { document.getElementById(id).value = v || ''; };
    set('pv_razon_social', prov && prov.razon_social);
    set('pv_ruc', prov && prov.ruc);
    set('pv_direccion', prov && prov.direccion);
    set('pv_cuenta_corriente', prov && prov.cuenta_corriente);
    set('pv_contacto', prov && prov.contacto);
    set('pv_telefono', prov && prov.telefono);
    set('pv_correo', prov && prov.correo);
    document.getElementById('proveedorModal').classList.add('active');
}

// Usado desde el formulario de la orden ("Registrar proveedor…"); preset trae el RUC o nombre buscado
function openNuevoProveedor(onCreated, preset) {
    openProveedorModal(null, onCreated);
    if (preset && preset.ruc) document.getElementById('pv_ruc').value = preset.ruc;
    if (preset && preset.razon_social) document.getElementById('pv_razon_social').value = preset.razon_social;
    setTimeout(() => document.getElementById(preset && preset.ruc ? 'pv_razon_social' : 'pv_ruc').focus(), 60);
    if (preset && preset.ruc) consultarRucProveedor(true);
}

// Trae razón social y dirección desde SUNAT (si la consulta está activada)
async function consultarRucProveedor(silencioso) {
    const ruc = document.getElementById('pv_ruc').value.trim();
    const errEl = document.getElementById('pvModalError');
    const btn = document.getElementById('pvSunatBtn');
    if (!/^\d{11}$/.test(ruc)) { if (!silencioso) errEl.textContent = 'Escribe un RUC de 11 dígitos.'; return; }
    errEl.textContent = '';
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const d = await sbConsultarRuc(ruc);
        document.getElementById('pv_razon_social').value = d.razon_social;
        if (d.direccion) document.getElementById('pv_direccion').value = d.direccion;
        const aviso = d.estado && d.estado.toUpperCase() !== 'ACTIVO' ? ` Atención: SUNAT lo reporta ${d.estado}.` : '';
        showToast('Datos traídos de SUNAT.' + aviso, aviso ? 'warning' : 'success', aviso ? 7000 : 3500);
    } catch (e) {
        if (!silencioso || e.status !== 501) {
            errEl.textContent = e.status === 501 ? 'La consulta a SUNAT no está activada. Completa los datos a mano.' : e.message;
        }
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-magnifying-glass"></i> SUNAT';
    }
}

async function editProveedor(id) {
    const prov = (await sbLoadProveedores()).find(p => String(p.id) === String(id));
    if (prov) openProveedorModal(prov, renderProveedores);
}

async function saveProveedorFromModal() {
    const errEl = document.getElementById('pvModalError');
    errEl.textContent = '';
    const record = {
        razon_social: document.getElementById('pv_razon_social').value.trim(),
        ruc: document.getElementById('pv_ruc').value.trim(),
        direccion: document.getElementById('pv_direccion').value.trim(),
        cuenta_corriente: document.getElementById('pv_cuenta_corriente').value.trim(),
        contacto: document.getElementById('pv_contacto').value.trim(),
        telefono: document.getElementById('pv_telefono').value.trim(),
        correo: document.getElementById('pv_correo').value.trim()
    };

    if (!record.razon_social) { errEl.textContent = 'La razón social es obligatoria.'; return; }
    if (record.ruc && !/^\d{11}$/.test(record.ruc)) { errEl.textContent = 'El RUC debe tener 11 dígitos.'; return; }
    if (record.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.correo)) { errEl.textContent = 'Correo inválido.'; return; }

    const btn = document.getElementById('pvSaveBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        let saved;
        if (_pvEditId) {
            const { data, error } = await SB.from('proveedores').update(record).eq('id', _pvEditId).select().single();
            if (error) throw error;
            saved = data;
        } else {
            // ¿Ya existe ese RUC? Si estaba quitado, se reactiva con los datos nuevos
            const previo = record.ruc
                ? (await SB.from('proveedores').select('id,activo,razon_social').eq('ruc', record.ruc).maybeSingle()).data
                : null;
            if (previo && previo.activo) {
                errEl.textContent = `Ese RUC ya está registrado como “${previo.razon_social}”. Búscalo en la lista.`;
                return;
            }
            const q = previo
                ? SB.from('proveedores').update({ ...record, activo: true }).eq('id', previo.id)
                : SB.from('proveedores').insert(record);
            const { data, error } = await q.select().single();
            if (error) throw error;
            saved = data;
        }
        sbInvalidate('proveedores');
        closeModal('proveedorModal');
        showToast('Proveedor guardado', 'success');
        if (_pvOnSaved) _pvOnSaved(saved);
    } catch (err) {
        errEl.textContent = err.code === '23505' ? 'Ya existe un proveedor con ese RUC.' : ('Error: ' + err.message);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

async function deactivateProveedor(id) {
    if (!confirm('¿Quitar este proveedor de la lista?')) return;
    try {
        const { error } = await SB.from('proveedores').update({ activo: false }).eq('id', id);
        if (error) throw error;
        sbInvalidate('proveedores');
        showToast('Proveedor quitado', 'success');
        renderProveedores();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addProveedorBtn');
    if (addBtn) addBtn.addEventListener('click', () => openProveedorModal(null, renderProveedores));
    const form = document.getElementById('proveedorModalForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); saveProveedorFromModal(); });
    const sunat = document.getElementById('pvSunatBtn');
    if (sunat) sunat.addEventListener('click', () => consultarRucProveedor(false));
});
