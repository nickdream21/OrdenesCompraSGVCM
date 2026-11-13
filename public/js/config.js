// ============================================================
// CATÁLOGO DE EMPRESAS Y PLANTILLAS  (fuente única de verdad)
// ============================================================
// Este archivo lo usan TANTO el navegador (construir el formulario)
// COMO el servidor (api/generate-pdf.js: validar, numerar, calcular).
// Por eso no usa nada del DOM: en el navegador se publica en `window`
// y en Node se exporta con `module.exports`.
//
// Campos especiales de formulario:
//   source: 'obra'      -> selector poblado desde la tabla `obras`
//   source: 'proveedor' -> select desde `proveedores` (autocompleta)
//   autofill: 'columna' -> se rellena solo al elegir el proveedor
//   validate: 'ruc'|'dni'|'email'|'phone'
//   section: 'opcionales' + conditional -> campos que se activan a mano
// ============================================================
(function (root, factory) {
    const catalogo = factory();
    if (typeof module === 'object' && module.exports) module.exports = catalogo;
    else {
        root.OC_CATALOGO = catalogo;
        // Alias usados por el resto del front
        root.OC_EMPRESAS = catalogo.EMPRESAS;
        root.OC_TEMPLATES = catalogo.TEMPLATES;
        root.PROVEEDOR_AUTOFILL = catalogo.PROVEEDOR_AUTOFILL;
    }
})(typeof self !== 'undefined' ? self : this, function () {

    // --------------------------------------------------------
    // EMPRESAS
    // numeracion.formato:
    //   'anio'  -> 2026-000001 (reinicia cada año)          [VIVIANA, CAMAFRA]
    //   'serie' -> 0001 - 0000001 (estilo NISIRA, continuo)  [EDIFICACIONES]
    // --------------------------------------------------------
    const EMPRESAS = [
        {
            codigo: 'viviana',
            nombre: 'Servicios Generales VIVIANA',
            razonSocial: 'SERVICIOS GENERALES VIVIANA EIRL',
            tipo: 'E.I.R.L.',
            ruc: '20483851171',
            logo: 'logo-viviana.png',
            icon: 'fa-truck',
            color: '#2563eb',
            formato: 'propio',
            numeracion: { formato: 'anio' }
        },
        {
            codigo: 'camafra',
            nombre: 'CAMAFRA MOTORS',
            razonSocial: 'CAMAFRA MOTORS S.A.C.',
            tipo: 'S.A.C.',
            ruc: '20529940395',
            logo: 'logo-camafra.png',
            icon: 'fa-hard-hat',
            color: '#E8630A',
            formato: 'propio',
            numeracion: { formato: 'anio' }
        },
        {
            codigo: 'edificaciones',
            nombre: 'Edificaciones & Construcciones del Norte',
            razonSocial: 'EDIFICACIONES & CONSTRUCCIONES DEL NORTE E.I.R.L.',
            tipo: 'E.I.R.L.',
            ruc: '20611247142',
            direccion: 'MZA. 01 LOTE. 11 A.H. CIUDAD ROJA DEL PESCADOR PIURA - PAITA - PAITA',
            telefono: '+51 958 429 065',
            email: 'eycdelnorte@gmail.com',
            logo: 'logo-edificaciones.png',
            // Firma escaneada opcional: bucket privado ordenes-pdf/_firmas/ (ver README)
            firma: 'firma-edificaciones.png',
            // TODO: nombre de quien firma "Vº Bº Aprobado"
            aprobador: '',
            icon: 'fa-building',
            color: '#9a7520',
            formato: 'nisira',
            numeracion: { formato: 'serie', serie: '0001', digitos: 7 }
        }
    ];

    // Mapa: campo del formulario -> columna en la tabla `proveedores`
    const PROVEEDOR_AUTOFILL = {
        proveedor_direccion: 'direccion',
        proveedor_ruc: 'ruc',
        proveedor_cuenta_corriente: 'cuenta_corriente',
        proveedor_contacto: 'contacto',
        proveedor_telefono: 'telefono',
        proveedor_correo: 'correo'
    };

    const CONDICIONES_PAGO = ['CONTADO', 'CREDITO A 15 DIAS', 'CREDITO A 30 DIAS', 'CREDITO A 45 DIAS', 'CREDITO A 60 DIAS', 'CREDITO A 90 DIAS'];

    const ITEMS_FIELD = (monedaLabel) => ({
        name: 'items', label: 'Items de la Orden', type: 'array', required: true, itemLabel: 'Item',
        fields: [
            { name: 'cantidad', label: 'Cantidad', type: 'number', required: true, step: '0.01' },
            { name: 'unidad', label: 'Unidad', type: 'text', required: true, placeholder: 'GLN, m³, Und, etc.' },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', required: true, rows: 2 },
            { name: 'precio_unitario', label: `Precio Unitario (${monedaLabel})`, type: 'number', required: true, step: '0.01' }
        ]
    });

    // Items estilo NISIRA (Edificaciones): incluye observación y centro de costo por línea
    const ITEMS_NISIRA = {
        name: 'items', label: 'Items', type: 'array', required: true, itemLabel: 'Item',
        fields: [
            { name: 'descripcion', label: 'Descripción', type: 'textarea', required: true, rows: 2 },
            { name: 'cantidad', label: 'Cantidad', type: 'number', required: true, step: '0.01' },
            { name: 'unidad', label: 'U. Medida', type: 'text', required: true, placeholder: 'UND, GLN, M3, KG...' },
            { name: 'precio_unitario', label: 'Precio Unitario', type: 'number', required: true, step: '0.0001' },
            { name: 'c_costo', label: 'C. Costo', type: 'text', required: false },
            { name: 'observaciones', label: 'Observaciones', type: 'text', required: false }
        ]
    };

    // Campos comunes de cabecera NISIRA
    const NISIRA_PROVEEDOR = [
        { name: 'proveedor_razon_social', label: 'Proveedor', type: 'select', source: 'proveedor', required: true },
        { name: 'proveedor_ruc', label: 'RUC / DNI del Proveedor', type: 'text', required: true, autofill: 'ruc' },
        { name: 'proveedor_direccion', label: 'Dirección', type: 'text', required: false, autofill: 'direccion' },
        { name: 'proveedor_cuenta_corriente', label: 'Cta. Cte.', type: 'text', required: false, autofill: 'cuenta_corriente' },
        { name: 'proveedor_contacto', label: 'Atención', type: 'text', required: false, autofill: 'contacto' }
    ];
    const NISIRA_IMPORTES = [
        { name: 'moneda', label: 'Moneda', type: 'select', required: true, options: ['PEN', 'USD'], default: 'PEN' },
        { name: 'precios_incluyen_igv', label: 'Los precios unitarios ya incluyen IGV', type: 'checkbox' }
    ];

    // --------------------------------------------------------
    // PLANTILLAS
    //   tipoDoc: 'OC' (orden de compra) | 'OS' (orden de servicio)
    //   calculo: 'igv'       -> valor venta + IGV 18 %
    //            'sin_igv'   -> importación, total = subtotal
    //            'nisira'    -> igual a 'igv' pero respeta moneda y
    //                           "precios incluyen IGV" (ver lib/calculo.js)
    // --------------------------------------------------------
    const TEMPLATES = {
        viviana_nacional: {
            name: 'viviana_nacional', empresa: 'viviana', tipoDoc: 'OC', calculo: 'igv',
            displayName: 'VIVIANA - Nacional (Soles)', description: 'Orden de compra nacional con IGV', moneda: 'S/.',
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true },
                { name: 'obra', label: 'Obra', type: 'select', source: 'obra', required: true },
                { name: 'proveedor_razon_social', label: 'Razón Social del Proveedor', type: 'select', source: 'proveedor', required: true },
                { name: 'proveedor_direccion', label: 'Dirección del Proveedor', type: 'text', required: true, autofill: 'direccion' },
                { name: 'proveedor_ruc', label: 'RUC del Proveedor', type: 'text', required: true, autofill: 'ruc', validate: 'ruc' },
                { name: 'proveedor_cuenta_corriente', label: 'Cuenta Corriente', type: 'text', required: false, autofill: 'cuenta_corriente' },
                { name: 'cotizacion', label: 'N° de Cotización', type: 'text', required: false },
                { name: 'proveedor_contacto', label: 'Contacto', type: 'text', required: false, autofill: 'contacto' },
                { name: 'proveedor_telefono', label: 'Teléfono', type: 'text', required: false, autofill: 'telefono', validate: 'phone' },
                { name: 'proveedor_correo', label: 'Correo Electrónico', type: 'email', required: false, autofill: 'correo', validate: 'email' },
                { name: 'condiciones_pago', label: 'Condiciones de Pago', type: 'select', required: true, options: CONDICIONES_PAGO },
                { name: 'lugar_entrega', label: 'Lugar de Entrega', type: 'text', required: true },
                { name: 'incluir_lugar_carga', label: '¿Incluir Lugar de Carga?', type: 'checkbox', section: 'opcionales' },
                { name: 'lugar_carga', label: 'Lugar de Carga', type: 'text', required: false, conditional: 'incluir_lugar_carga' },
                { name: 'incluir_vehiculo_carga', label: '¿Incluir Vehículo de Carga?', type: 'checkbox', section: 'opcionales' },
                { name: 'vehiculo_carga', label: 'Vehículo de Carga', type: 'text', required: false, conditional: 'incluir_vehiculo_carga' },
                ITEMS_FIELD('S/.'),
                { name: 'contacto_envio_nombre', label: 'Nombre y Apellidos (Contacto para Envío)', type: 'text', required: true },
                { name: 'contacto_envio_dni', label: 'DNI', type: 'text', required: false, validate: 'dni' },
                { name: 'contacto_envio_telefono', label: 'Teléfono', type: 'text', required: true, validate: 'phone' }
            ]
        },
        viviana_importacion: {
            name: 'viviana_importacion', empresa: 'viviana', tipoDoc: 'OC', calculo: 'sin_igv',
            displayName: 'VIVIANA - Importación (USD)', description: 'Orden de compra internacional sin IGV', moneda: 'USD',
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true },
                { name: 'obra', label: 'Obra', type: 'select', source: 'obra', required: true },
                { name: 'proveedor_razon_social', label: 'Razón Social del Proveedor', type: 'select', source: 'proveedor', required: true },
                { name: 'proveedor_direccion', label: 'Dirección del Proveedor', type: 'text', required: true, autofill: 'direccion' },
                { name: 'cotizacion', label: 'N° de Cotización', type: 'text', required: true },
                { name: 'proveedor_cuenta_corriente', label: 'Cuenta Corriente Internacional', type: 'textarea', required: true, rows: 2, autofill: 'cuenta_corriente' },
                { name: 'proveedor_contacto', label: 'Contacto', type: 'text', required: true, autofill: 'contacto' },
                { name: 'proveedor_telefono', label: 'Teléfono', type: 'text', required: true, autofill: 'telefono', validate: 'phone' },
                { name: 'proveedor_correo', label: 'Correo Electrónico', type: 'email', required: true, autofill: 'correo', validate: 'email' },
                { name: 'condiciones_pago', label: 'Condiciones de Pago', type: 'select', required: true, options: CONDICIONES_PAGO },
                { name: 'lugar_entrega', label: 'Lugar de Entrega', type: 'text', required: true },
                ITEMS_FIELD('USD'),
                { name: 'contacto_envio_nombre', label: 'Nombre y Apellidos (Contacto para Envío)', type: 'text', required: true },
                { name: 'contacto_envio_dni', label: 'DNI', type: 'text', required: true, validate: 'dni' },
                { name: 'contacto_envio_telefono', label: 'Teléfono', type: 'text', required: true, validate: 'phone' }
            ]
        },
        camafra_nacional: {
            name: 'camafra_nacional', empresa: 'camafra', tipoDoc: 'OC', calculo: 'igv',
            displayName: 'CAMAFRA - Nacional (Soles)', description: 'Orden de compra nacional con IGV', moneda: 'S/.',
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true },
                { name: 'obra', label: 'Obra', type: 'select', source: 'obra', required: true },
                { name: 'proveedor_razon_social', label: 'Razón Social del Proveedor', type: 'select', source: 'proveedor', required: true },
                { name: 'proveedor_direccion', label: 'Dirección del Proveedor', type: 'text', required: true, autofill: 'direccion' },
                { name: 'proveedor_ruc', label: 'RUC del Proveedor', type: 'text', required: true, autofill: 'ruc', validate: 'ruc' },
                { name: 'incluir_cotizacion', label: '¿Incluir N° de Cotización?', type: 'checkbox', section: 'opcionales' },
                { name: 'cotizacion', label: 'N° de Cotización', type: 'text', required: false, conditional: 'incluir_cotizacion' },
                { name: 'incluir_cuenta_corriente', label: '¿Incluir Cuenta(s) Corriente(s)?', type: 'checkbox', section: 'opcionales' },
                { name: 'cuenta_corriente_1', label: 'Cuenta Corriente 1', type: 'text', required: false, conditional: 'incluir_cuenta_corriente', placeholder: 'Banco de Crédito del Perú: S/ ...' },
                { name: 'cuenta_corriente_2', label: 'Cuenta Corriente 2', type: 'text', required: false, conditional: 'incluir_cuenta_corriente', placeholder: 'Banco Continental: S/ ...' },
                { name: 'condiciones_pago', label: 'Condiciones de Pago', type: 'select', required: true, options: CONDICIONES_PAGO },
                { name: 'lugar_entrega', label: 'Lugar de Entrega', type: 'text', required: true },
                ITEMS_FIELD('S/.'),
                { name: 'contacto_envio_nombre', label: 'Nombre y Apellidos (Contacto para Envío)', type: 'text', required: true },
                { name: 'contacto_envio_telefono', label: 'Teléfono', type: 'text', required: true, validate: 'phone' }
            ]
        },

        // ---------- FORMATO NISIRA (cualquier empresa con formato 'nisira') ----------
        nisira_oc: {
            name: 'nisira_oc', empresa: '*', tipoDoc: 'OC', calculo: 'nisira', archivo: 'nisira',
            displayName: 'Orden de Compra', description: 'Formato NISIRA · Valor venta + IGV', moneda: 'PEN / USD',
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true },
                { name: 'fecha_entrega', label: 'Fecha de Entrega', type: 'date', required: false },
                ...NISIRA_PROVEEDOR,
                { name: 'condiciones_pago', label: 'Condiciones de Pago', type: 'select', required: true, options: CONDICIONES_PAGO },
                { name: 'obra', label: 'Proyecto / Obra', type: 'select', source: 'obra', required: false },
                { name: 'para_ser_usado_en', label: 'Para ser usado en', type: 'text', required: false },
                { name: 'lugar_entrega', label: 'Lugar de Entrega', type: 'text', required: false },
                { name: 'cotizacion', label: 'Cotización', type: 'text', required: false },
                { name: 'orden_pedido', label: 'Orden de Pedido', type: 'text', required: false, placeholder: '2026-0000001' },
                ...NISIRA_IMPORTES,
                ITEMS_NISIRA,
                { name: 'observaciones', label: 'Observaciones generales', type: 'textarea', required: false, rows: 2 }
            ]
        },
        nisira_os: {
            name: 'nisira_os', empresa: '*', tipoDoc: 'OS', calculo: 'nisira', archivo: 'nisira',
            displayName: 'Orden de Servicio', description: 'Formato NISIRA · Valor venta + IGV', moneda: 'PEN / USD',
            fields: [
                { name: 'fecha', label: 'Fecha', type: 'date', required: true },
                { name: 'fecha_entrega', label: 'Fecha de Entrega', type: 'date', required: false },
                ...NISIRA_PROVEEDOR,
                { name: 'condiciones_pago', label: 'Condiciones de Pago', type: 'select', required: true, options: CONDICIONES_PAGO },
                { name: 'area', label: 'Área', type: 'text', required: false },
                { name: 'obra', label: 'Proyecto / Obra', type: 'select', source: 'obra', required: false },
                { name: 'para_ser_usado_en', label: 'Para ser usado en', type: 'text', required: false },
                { name: 'pedido', label: 'Pedido N°', type: 'text', required: false, placeholder: 'PSR 2026 0000001' },
                ...NISIRA_IMPORTES,
                ITEMS_NISIRA,
                { name: 'observaciones', label: 'Observaciones generales', type: 'textarea', required: false, rows: 2 }
            ]
        }
    };

    function getEmpresa(codigo) {
        return EMPRESAS.find(e => e.codigo === codigo) || null;
    }

    /** Une una fila de la tabla `empresas` con los valores por defecto del catálogo. */
    function normalizarEmpresa(row) {
        const base = getEmpresa(row.codigo) || {};
        const formato = row.formato || base.formato || 'nisira';
        return {
            ...base,
            codigo: row.codigo,
            nombre: row.nombre || base.nombre,
            razonSocial: row.razon_social || base.razonSocial,
            ruc: row.ruc || base.ruc,
            direccion: row.direccion != null ? row.direccion : base.direccion,
            telefono: row.telefono != null ? row.telefono : base.telefono,
            email: row.email != null ? row.email : base.email,
            aprobador: row.aprobador != null ? row.aprobador : base.aprobador,
            color: row.color || base.color || '#16324F',
            logoData: row.logo_data || null,
            firmaData: row.firma_data || null,
            logo: base.logo || null,
            firma: base.firma || null,
            formato,
            numeracion: formato === 'nisira'
                ? { formato: 'serie', serie: row.serie || '0001', digitos: 7 }
                : (base.numeracion || { formato: 'anio' })
        };
    }

    /** Plantillas disponibles para una empresa. */
    function plantillasDe(emp) {
        return Object.values(TEMPLATES).filter(t =>
            t.empresa === emp.codigo || (t.empresa === '*' && emp.formato === 'nisira'));
    }

    return { EMPRESAS, TEMPLATES, PROVEEDOR_AUTOFILL, getEmpresa, normalizarEmpresa, plantillasDe };
});
