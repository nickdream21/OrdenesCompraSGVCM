// ============================================================
// GESTIÓN DE OBRAS (CRUD sobre Supabase)
// ============================================================

let _obEditId = null;

// Etiquetas cortas por empresa, tomadas del catálogo (config.js)
const EMPRESA_LABEL = Object.fromEntries(window.OC_EMPRESAS.map(e => [e.codigo, e.nombre.toUpperCase()]));

async function renderObras() {
    const cont = document.getElementById('obrasContent');
    cont.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const obras = await sbLoadObras(null, true);
        if (obras.length === 0) {
            cont.innerHTML = '<div class="empty"><strong>Aún no hay obras</strong>Agrega la primera con “Nueva obra” para elegirla rápido en cada orden.</div>';
            return;
        }
        cont.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead><tr><th>Empresa</th><th>Obra</th><th>Dirección</th><th></th></tr></thead>
                <tbody>
                  ${obras.map(o => `
                    <tr>
                      <td data-label="Empresa"><span class="badge">${EMPRESA_LABEL[o.empresa] || o.empresa}</span></td>
                      <td data-label="Obra">${escapeHtml(o.nombre)}</td>
                      <td data-label="Dirección">${escapeHtml(o.direccion || '')}</td>
                      <td class="row-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editObra(${o.id})" aria-label="Editar obra"><i class="fas fa-pen"></i> Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deactivateObra(${o.id})" aria-label="Quitar obra"><i class="fas fa-trash"></i></button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
    } catch (err) {
        cont.innerHTML = `<p class="empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function openObraModal(obra) {
    _obEditId = obra ? obra.id : null;
    document.getElementById('obModalTitle').textContent = obra ? 'Editar obra' : 'Nueva obra';
    document.getElementById('obModalError').textContent = '';
    document.getElementById('ob_empresa').value = obra ? obra.empresa : '';
    document.getElementById('ob_nombre').value = obra ? obra.nombre : '';
    document.getElementById('ob_direccion').value = (obra && obra.direccion) || '';
    document.getElementById('obraModal').classList.add('active');
}

async function editObra(id) {
    const obra = (await sbLoadObras()).find(o => String(o.id) === String(id));
    if (obra) openObraModal(obra);
}

async function saveObraFromModal() {
    const errEl = document.getElementById('obModalError');
    errEl.textContent = '';
    const record = {
        empresa: document.getElementById('ob_empresa').value,
        nombre: document.getElementById('ob_nombre').value.trim(),
        direccion: document.getElementById('ob_direccion').value.trim()
    };
    if (!record.empresa) { errEl.textContent = 'Selecciona la empresa.'; return; }
    if (!record.nombre) { errEl.textContent = 'El nombre de la obra es obligatorio.'; return; }

    const btn = document.getElementById('obSaveBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        if (_obEditId) {
            const { error } = await SB.from('obras').update(record).eq('id', _obEditId);
            if (error) throw error;
        } else {
            const { error } = await SB.from('obras').insert(record);
            if (error) throw error;
        }
        sbInvalidate('obras');
        closeModal('obraModal');
        showToast('Obra guardada', 'success');
        renderObras();
    } catch (err) {
        errEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

async function deactivateObra(id) {
    if (!confirm('¿Quitar esta obra de la lista?')) return;
    try {
        const { error } = await SB.from('obras').update({ activo: false }).eq('id', id);
        if (error) throw error;
        sbInvalidate('obras');
        showToast('Obra quitada', 'success');
        renderObras();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('ob_empresa');
    if (sel) sel.insertAdjacentHTML('beforeend',
        window.OC_EMPRESAS.map(e => `<option value="${e.codigo}">${escapeHtml(e.nombre)}</option>`).join(''));
    const addBtn = document.getElementById('addObraBtn');
    if (addBtn) addBtn.addEventListener('click', () => openObraModal(null));
    const form = document.getElementById('obraModalForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); saveObraFromModal(); });
});
