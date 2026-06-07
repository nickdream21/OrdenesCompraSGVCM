// ============================================================
// HISTORIAL DE ÓRDENES (archivo central en Supabase)
// ============================================================

const _HIST_EMPRESA = { viviana: 'VIVIANA', camafra: 'CAMAFRA' };

async function renderHistorial() {
    const cont = document.getElementById('historialContent');
    cont.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    try {
        const { data, error } = await SB
            .from('ordenes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;

        if (!data || data.length === 0) {
            cont.innerHTML = '<p class="empty">Todavía no se ha generado ninguna orden.</p>';
            return;
        }

        cont.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead><tr><th>N° OC</th><th>Empresa</th><th>Fecha</th><th>Proveedor</th><th>Generado por</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  ${data.map(o => `
                    <tr>
                      <td data-label="N° OC"><strong>${escapeHtml(o.numero_oc)}</strong></td>
                      <td data-label="Empresa"><span class="badge">${_HIST_EMPRESA[o.empresa] || o.empresa}</span></td>
                      <td data-label="Fecha">${o.fecha ? formatDate(o.fecha) : ''}</td>
                      <td data-label="Proveedor">${escapeHtml(o.proveedor_razon_social || '')}</td>
                      <td data-label="Generado por" class="col-autor">${escapeHtml(o.creado_por_nombre || o.creado_por_email || '—')}</td>
                      <td data-label="Total">${o.total != null ? `${o.moneda || ''} ${Number(o.total).toFixed(2)}` : ''}</td>
                      <td class="row-actions">
                        ${o.pdf_path ? `<button class="btn btn-sm btn-primary" onclick="descargarOrden('${encodeURIComponent(o.pdf_path)}','${escapeHtml(o.numero_oc)}')"><i class="fas fa-download"></i></button>` : ''}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
    } catch (err) {
        cont.innerHTML = `<p class="empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

async function descargarOrden(pathEnc, numero) {
    try {
        const pdfPath = decodeURIComponent(pathEnc);
        const { data, error } = await SB.storage.from('ordenes-pdf').createSignedUrl(pdfPath, 120);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (err) {
        showToast('No se pudo abrir el PDF: ' + err.message, 'error');
    }
}

function formatDate(s) {
    const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return s;
    return d.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
