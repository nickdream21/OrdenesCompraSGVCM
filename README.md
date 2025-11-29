# 🚀 Sistema Web de Órdenes de Compra

Sistema profesional para generar órdenes de compra en PDF con interfaz web moderna y personalizable.

## ✨ Características

- ✅ **Interfaz Web Profesional** - Diseño moderno y fácil de usar
- ✅ **Múltiples Templates** - Soporta diferentes tipos de órdenes de compra
- ✅ **Campos Personalizables** - Agrega o modifica campos según tus necesidades
- ✅ **Generación de PDFs** - PDFs de alta calidad con Puppeteer
- ✅ **Editor de Templates** - Crea y edita templates directamente desde la web
- ✅ **Historial de PDFs** - Gestiona y descarga PDFs generados previamente
- ✅ **Respaldo Automático en Red** - Guarda PDFs local + carpeta compartida en red
- ✅ **100% Local** - Funciona completamente en tu máquina

## 📋 Requisitos Previos

- **Node.js** versión 16 o superior
- **NPM** (incluido con Node.js)
- **Windows 10/11, macOS o Linux**

## 🛠️ Instalación

### 1. Instalar Node.js

Si no tienes Node.js instalado:

**Windows:**
- Descarga desde: https://nodejs.org/
- Instala la versión LTS (recomendada)
- Verifica la instalación abriendo CMD y ejecutando:
```bash
node --version
npm --version
```

**macOS/Linux:**
```bash
# Usando nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

### 2. Instalar el Sistema

```bash
# Navega a la carpeta del proyecto
cd oc-web-system

# Instala las dependencias
npm install
```

Esto instalará:
- Express (servidor web)
- Puppeteer (generación de PDFs)
- EJS (motor de templates)
- Body-parser (procesamiento de datos)
- Moment (manejo de fechas)

## ⚙️ Configuración de Respaldo Automático en Red

El sistema incluye **guardado automático dual**: cada PDF se guarda localmente en el servidor Y en una carpeta compartida en red como respaldo.

**Escenarios soportados:**
1. **Servidor + Equipo de Respaldo Separado** (recomendado) - Ver `CONFIGURACION_RAPIDA.md`
2. **Servidor con carpeta compartida local** - Configuración simple

---

### Configuración Rápida

Edita el archivo `server/config.js` con la ruta de tu carpeta de respaldo:

```javascript
module.exports = {
    PORT: 3000,

    // IP del equipo de respaldo (diferente al servidor)
    SHARED_FOLDER: '\\\\192.168.1.50\\OC_Respaldo',  // ⬅️ AJUSTA ESTA IP

    USE_COMPANY_SUBFOLDERS: true,  // Crea subcarpetas por empresa
    USE_DATE_SUBFOLDERS: false     // Crea subcarpetas por año/mes
};
```

**Ejemplos de rutas válidas:**

```javascript
// Equipo de respaldo separado (RECOMENDADO)
SHARED_FOLDER: '\\\\192.168.1.50\\OC_Respaldo'

// Carpeta local en el mismo servidor
SHARED_FOLDER: 'C:\\Respaldos\\OC'

// Servidor de red por nombre
SHARED_FOLDER: '\\\\SERVIDOR-BACKUP\\OC'

// Desactivar respaldo en red
SHARED_FOLDER: null
```

**Documentación completa:**
- **Configuración paso a paso**: Ver `CONFIGURACION_RAPIDA.md`
- **Guía detallada con solución de problemas**: Ver `CONFIGURACION_RED.md`

### Cómo Funciona el Respaldo Dual

Cuando generas un PDF:

1. Se guarda **localmente** en el servidor: `generated/OC_XXX.pdf`
2. Se guarda **automáticamente** en la carpeta compartida: `\\IP\carpeta\empresa\OC_XXX.pdf`
3. El usuario **descarga** el PDF en su navegador

**Ventajas:**
- Si falla el respaldo en red, el PDF local se mantiene
- Copias automáticas en otro equipo para seguridad
- Organización automática por empresa/fecha

### Verificar que Funciona

Después de generar un PDF, la consola mostrará:

```
📄 PDF guardado localmente en: C:\...\generated\OC_000190.pdf
✅ PDF guardado en carpeta compartida: \\192.168.1.50\OC_Respaldo\viviana\OC_000190.pdf
```

Si ves ambos mensajes: **el respaldo funciona correctamente**.

**El usuario NO verá ninguna notificación** - el guardado en red es completamente transparente.

## 🚀 Uso

### Iniciar el Servidor

```bash
npm start
```

Verás este mensaje:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🚀 SISTEMA DE ÓRDENES DE COMPRA INICIADO             ║
║                                                           ║
║     🌐 Servidor corriendo en: http://localhost:3000      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Abrir en el Navegador

Abre tu navegador y ve a: **http://localhost:3000**

## 📖 Guía de Uso

### 1. Generar una Orden de Compra

1. Ve a la pestaña **"Generar OC"**
2. Selecciona un template (ej: "Orden de Compra - Importación")
3. Completa el formulario con los datos
4. Para agregar items:
   - Haz clic en "Agregar Item"
   - Completa: cantidad, unidad, descripción, precio
   - Agrega más items si necesitas
5. Haz clic en **"Generar PDF"**
6. El PDF se descargará automáticamente

### 2. Ver Historial de PDFs

1. Ve a la pestaña **"Historial"**
2. Verás todos los PDFs generados
3. Haz clic en "Descargar" para obtener cualquier PDF

### 3. Crear un Nuevo Template

1. Ve a la pestaña **"Editor de Templates"**
2. Ingresa un nombre (sin espacios, usa guiones bajos)
3. Escribe tu template HTML usando sintaxis EJS
4. Agrega configuración de campos (ver ejemplo abajo)
5. Haz clic en **"Guardar Template"**

#### Ejemplo de Template Básico:

```html
<%# CONFIG: {
  "displayName": "Mi Orden Simple",
  "description": "Template personalizado",
  "fields": [
    {"name": "numero", "label": "Número de OC", "type": "text", "required": true},
    {"name": "fecha", "label": "Fecha", "type": "date", "required": true},
    {"name": "cliente", "label": "Cliente", "type": "text", "required": true},
    {"name": "total", "label": "Total", "type": "number", "required": true}
  ]
} %>

<!DOCTYPE html>
<html>
<head>
    <title>OC <%= numero %></title>
    <style>
        body { font-family: Arial; padding: 20px; }
        h1 { color: #2563eb; }
    </style>
</head>
<body>
    <h1>Orden de Compra Nº <%= numero %></h1>
    <p><strong>Fecha:</strong> <%= fecha %></p>
    <p><strong>Cliente:</strong> <%= cliente %></p>
    <p><strong>Total:</strong> <%= formatCurrency(total, 'S/.') %></p>
</body>
</html>
```

### 4. Gestionar Templates

1. Ve a la pestaña **"Templates"**
2. Verás todos los templates disponibles
3. Opciones:
   - **Editar** - Modifica el template
   - **Eliminar** - Borra el template

## 🎨 Personalización de Campos

### Tipos de Campos Disponibles:

```javascript
// Texto simple
{"name": "nombre", "label": "Nombre", "type": "text", "required": true}

// Área de texto
{"name": "descripcion", "label": "Descripción", "type": "textarea"}

// Número
{"name": "cantidad", "label": "Cantidad", "type": "number", "step": "0.01"}

// Fecha
{"name": "fecha", "label": "Fecha", "type": "date"}

// Selección
{"name": "moneda", "label": "Moneda", "type": "select", "options": ["USD", "S/.", "EUR"]}

// Array de items (para tablas)
{
  "name": "items",
  "label": "Items",
  "type": "array",
  "itemLabel": "Item",
  "fields": [
    {"name": "cantidad", "label": "Cantidad", "type": "number"},
    {"name": "descripcion", "label": "Descripción", "type": "text"}
  ]
}
```

## 📁 Estructura del Proyecto

```
oc-web-system/
├── server/
│   └── app.js              # Servidor Express principal
├── public/
│   ├── index.html          # Interfaz web
│   ├── css/
│   │   └── styles.css      # Estilos
│   └── js/
│       └── app.js          # Lógica del frontend
├── templates/              # Templates EJS
│   ├── orden_importacion.ejs
│   └── orden_local_igv.ejs
├── generated/              # PDFs generados
├── package.json
└── README.md
```

## 🔧 Solución de Problemas

### El servidor no inicia

```bash
# Verifica que Node.js esté instalado
node --version

# Reinstala las dependencias
rm -rf node_modules
npm install
```

### Error al generar PDF

- Asegúrate de tener suficiente espacio en disco
- Verifica que Puppeteer se haya instalado correctamente
- En Windows, puede necesitar instalar Visual C++ Redistributable

### El template no se muestra

- Verifica que el archivo tenga extensión `.ejs`
- Revisa que la configuración JSON en el comentario sea válida
- Mira la consola del navegador (F12) para errores

### Puerto 3000 ocupado

Cambia el puerto en `server/app.js`:
```javascript
const PORT = 3001; // Cambia a otro puerto
```

## 💡 Funciones Disponibles en Templates

### Formateo de Números:
```javascript
<%= formatCurrency(1234.56, 'S/.') %>
// Resultado: S/. 1,234.56

<%= formatNumber(1234.567, 2) %>
// Resultado: 1,234.57
```

### Manejo de Fechas:
```javascript
<%= moment(fecha).format('DD/MM/YYYY') %>
<%= moment().format('DD de MMMM de YYYY') %>
```

### Lógica Condicional:
```javascript
<% if (condicion) { %>
  <p>Mostrar si es verdadero</p>
<% } %>

<% items.forEach(item => { %>
  <tr>
    <td><%= item.nombre %></td>
  </tr>
<% }); %>
```

## 🌟 Características Avanzadas

### Cálculos Automáticos

En tus templates puedes hacer cálculos:
```javascript
<% 
let subtotal = 0;
items.forEach(item => {
  const total = item.cantidad * item.precio;
  subtotal += total;
});
const igv = subtotal * 0.18;
const total = subtotal + igv;
%>

<p>Subtotal: <%= formatCurrency(subtotal, 'S/.') %></p>
<p>IGV: <%= formatCurrency(igv, 'S/.') %></p>
<p>Total: <%= formatCurrency(total, 'S/.') %></p>
```

### Estilos CSS Personalizados

Puedes incluir CSS completo en tu template:
```html
<style>
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th {
    background-color: #4a5568;
    color: white;
    padding: 10px;
  }
</style>
```

## 📝 API Endpoints

Si quieres integrar con otros sistemas:

### GET /api/templates
Obtiene todos los templates disponibles

### POST /api/generate-pdf
Genera un PDF
```json
{
  "template": "orden_importacion",
  "data": { /* datos del formulario */ },
  "filename": "OC_000123.pdf"
}
```

### GET /api/generated
Lista todos los PDFs generados

### GET /api/download/:filename
Descarga un PDF específico

## 🤝 Soporte

Para problemas o preguntas:
1. Revisa esta documentación
2. Verifica la consola del navegador (F12)
3. Revisa los logs del servidor en la terminal

## 📄 Licencia

MIT - Uso libre para proyectos personales y comerciales

---

**¡Listo para usar!** 🎉

Abre http://localhost:3000 y empieza a generar tus órdenes de compra profesionales.
