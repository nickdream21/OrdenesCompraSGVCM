// ============================================================
// CONFIGURACIÓN DE FORMULARIOS (cliente)
// ============================================================
// Define los campos de cada tipo de OC para CONSTRUIR EL FORMULARIO.
// El PDF lo sigue generando la plantilla EJS correspondiente en el
// servidor (idéntico al actual). El campo "Número de OC" ya NO se pide:
// se asigna automáticamente (correlativo por empresa y año).
//
// Campos especiales:
//   source: 'obra'      -> select poblado desde la tabla `obras`
//   source: 'proveedor' -> select con búsqueda desde `proveedores` (autocompleta)
//   autofill: 'columna'  -> se rellena solo al elegir el proveedor
//   validate: 'ruc'|'dni'|'email'|'phone' -> validación extra
// ============================================================

window.OC_EMPRESAS = [
    {
        codigo: 'viviana',
        nombre: 'Servicios Generales VIVIANA',
        tipo: 'E.I.R.L.',
        ruc: '20483851171',
        icon: 'fa-truck',
        color: '#2563eb'
    },
    {
        codigo: 'camafra',
        nombre: 'CAMAFRA MOTORS',
        tipo: 'S.A.C.',
        ruc: '20529940395',
        icon: 'fa-hard-hat',
        color: '#ff6600'
    }
];

// Mapa: campo del formulario -> columna en la tabla `proveedores`
window.PROVEEDOR_AUTOFILL = {
    proveedor_direccion: 'direccion',
    proveedor_ruc: 'ruc',
    proveedor_cuenta_corriente: 'cuenta_corriente',
    proveedor_contacto: 'contacto',
    proveedor_telefono: 'telefono',
    proveedor_correo: 'correo'
};

const CONDICIONES_PAGO = ['CONTADO', 'CREDITO A 30 DIAS', 'CREDITO A 60 DIAS', 'CREDITO A 90 DIAS'];

const ITEMS_FIELD = (monedaLabel) => ({
    name: 'items', label: 'Items de la Orden', type: 'array', required: true, itemLabel: 'Item',
    fields: [
        { name: 'cantidad', label: 'Cantidad', type: 'number', required: true, step: '0.01' },
        { name: 'unidad', label: 'Unidad', type: 'text', required: true, placeholder: 'GLN, m³, Und, etc.' },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: true, rows: 2 },
        { name: 'precio_unitario', label: `Precio Unitario (${monedaLabel})`, type: 'number', required: true, step: '0.01' }
    ]
});

window.OC_TEMPLATES = {
    // ----------------------------------------------------------
    viviana_nacional: {
        name: 'viviana_nacional',
        displayName: 'VIVIANA - Nacional (Soles)',
        description: 'Orden de compra nacional con IGV',
        empresa: 'viviana',
        moneda: 'S/.',
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
    // ----------------------------------------------------------
    viviana_importacion: {
        name: 'viviana_importacion',
        displayName: 'VIVIANA - Importación (USD)',
        description: 'Orden de compra internacional sin IGV',
        empresa: 'viviana',
        moneda: 'USD',
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
    // ----------------------------------------------------------
    camafra_nacional: {
        name: 'camafra_nacional',
        displayName: 'CAMAFRA - Nacional (Soles)',
        description: 'Orden de compra nacional con IGV',
        empresa: 'camafra',
        moneda: 'S/.',
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
    }
};
