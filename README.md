# Sistema Web de Órdenes de Compra — SGV/CM

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Deploy](https://img.shields.io/badge/deploy-Vercel-black)
![DB](https://img.shields.io/badge/database-Supabase-3ecf8e)

Aplicación web mobile-first para la generación, numeración automática y archivo de **Órdenes de Compra** en PDF para las empresas **Servicios Generales VIVIANA E.I.R.L.** y **CAMAFRA MOTORS S.A.C.** Cada orden queda guardada en la nube (Supabase Storage), en una carpeta de red local y registrada en el historial con el nombre del usuario que la generó.

---

## Tabla de contenidos

1. [Características](#características)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Esquema de base de datos](#esquema-de-base-de-datos)
6. [Estructura de almacenamiento PDF](#estructura-de-almacenamiento-pdf)
7. [Puesta en marcha local](#puesta-en-marcha-local)
8. [Variables de entorno](#variables-de-entorno)
9. [Despliegue en Vercel](#despliegue-en-vercel)
10. [Configuración de Supabase](#configuración-de-supabase)
11. [Gestión de usuarios](#gestión-de-usuarios)
12. [Plantillas EJS](#plantillas-ejs)
13. [Carpeta de red compartida](#carpeta-de-red-compartida)

---

## Características

- **Multi-empresa** — Soporte simultáneo para VIVIANA y CAMAFRA con correlativos independientes por empresa y año.
- **Numeración automática y atómica** — La función `siguiente_correlativo` en PostgreSQL garantiza que dos usuarios nunca obtengan el mismo número aunque generen una OC al mismo tiempo.
- **Generación de PDF** — Renderiza plantillas EJS a HTML y las convierte a PDF con Puppeteer/Chromium. El PDF se descarga automáticamente en el navegador.
- **Vista previa** — Permite previsualizar el PDF sin consumir correlativo ni guardar el registro.
- **Historial completo** — Registro de todas las órdenes generadas con empresa, fecha, proveedor, total, moneda y quién la generó.
- **Trazabilidad por usuario** — Cada usuario tiene su propia cuenta. El nombre y email del creador se guardan en cada orden.
- **Autocompletado de proveedor** — Al seleccionar un proveedor, el formulario rellena automáticamente dirección, RUC, cuenta corriente, contacto, teléfono y correo.
- **Selector de obra mejorado** — Componente custom (bottom-sheet en móvil, dropdown en desktop) con búsqueda en tiempo real. Permite textos largos sin truncar.
- **Gestión de obras y proveedores** — CRUD completo desde la misma app, sin necesidad de tocar la base de datos directamente.
- **Campos opcionales configurables** — Cada plantilla puede definir campos que el usuario activa manualmente (lugar de carga, vehículo, cotización, cuentas corrientes, etc.).
- **Diseño mobile-first** — Navegación por bottom-nav, formularios optimizados para pantallas pequeñas, tablas que colapsan en tarjetas.
- **Respaldo dual** — Los PDFs se suben a Supabase Storage y, si hay conectividad, también se copian a una carpeta de red local.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 · Vanilla JavaScript (sin frameworks) |
| Servidor local (dev) | Node.js · Express 4 |
| Servidor producción | Vercel Serverless Functions |
| Base de datos | Supabase (PostgreSQL 15) |
| Autenticación | Supabase Auth (email + contraseña por usuario) |
| Almacenamiento cloud | Supabase Storage |
| Generación de PDF | Puppeteer Core + @sparticuz/chromium |
| Plantillas | EJS 3 |
| Fechas | Moment.js |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  Navegador (cliente)                 │
│  index.html · app.js · config.js · supabaseClient.js│
│         obras.js · proveedores.js · historial.js    │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
  ┌───────────────┐ ┌─────────────┐ ┌─────────────────┐
  │  Supabase     │ │  Vercel     │ │  Supabase       │
  │  Auth         │ │  Serverless │ │  Storage        │
  │  (sesión JWT) │ │  Function   │ │  (bucket PDF)   │
  └───────────────┘ │ /api/       │ └────────┬────────┘
                    │ generate-   │          │
  ┌───────────────┐ │ pdf.js      │          │ PDF
  │  Supabase DB  │◄──────┤                  │
  │  PostgreSQL   │  lee/ │                  ▼
  │  obras        │  escri│         ┌──────────────────┐
  │  proveedores  │  be   │         │  ordenes-pdf/    │
  │  correlativos │       │         │  viviana/2026/01/│
  │  ordenes      │       │         │  camafra/2026/01/│
  └───────────────┘       │         └──────────────────┘
                          │
          ┌───────────────┘
          │ (solo desarrollo local)
          ▼
  ┌───────────────────────────────┐
  │  Express · server/app.js      │
  │  \\192.168.0.171\OC_Respaldo  │
  │  (carpeta de red local)       │
  └───────────────────────────────┘
```

**Flujo de generación de una OC:**

1. El usuario se autentica — Supabase Auth devuelve un JWT.
2. Completa el formulario (empresa, tipo de OC, obra, proveedor, items, etc.).
3. El cliente envía `POST /api/generate-pdf` con el JWT en el header `Authorization`.
4. La función serverless verifica el JWT y obtiene el nombre del usuario desde `user_metadata`.
5. Llama a `siguiente_correlativo(empresa, año)` — operación atómica en PostgreSQL.
6. Renderiza la plantilla EJS → HTML → PDF con Puppeteer.
7. Sube el PDF a Supabase Storage en `{empresa}/{año}/{mes}/{numero_oc}.pdf`.
8. Inserta el registro en la tabla `ordenes` (incluyendo `creado_por_nombre` y `creado_por_email`).
9. Devuelve el PDF al navegador para su descarga inmediata.

---

## Estructura del proyecto

```
OrdenesCompraSGVCM/
│
├── api/
│   └── generate-pdf.js          # Función serverless (producción Vercel)
│
├── public/                      # Archivos estáticos servidos al navegador
│   ├── index.html               # SPA única — login + app completa
│   ├── css/
│   │   └── styles.css           # Estilos mobile-first (custom select, etc.)
│   ├── js/
│   │   ├── app.js               # Lógica principal: navegación, formulario, PDF
│   │   ├── config.js            # Definición de empresas, templates y campos
│   │   ├── historial.js         # Vista historial + descarga de OC
│   │   ├── obras.js             # CRUD de obras
│   │   ├── proveedores.js       # CRUD de proveedores
│   │   ├── supabaseClient.js    # Cliente Supabase + funciones de auth/datos
│   │   └── supabase-config.js   # URL y anon key (NO commitear — ver .gitignore)
│   └── images/
│       ├── logo-viviana.png
│       └── logo-camafra.png
│
├── server/                      # Servidor Express (desarrollo local)
│   ├── app.js
│   ├── config.js                # Puerto, carpeta de red, subfolders
│   ├── controllers/
│   │   ├── pdfController.js
│   │   └── templateController.js
│   ├── routes/
│   │   └── apiRoutes.js
│   └── services/
│       └── pdfService.js        # Puppeteer local + copia a carpeta de red
│
├── supabase/
│   └── schema.sql               # DDL completo: tablas, índices, RLS, Storage
│
├── templates/                   # Plantillas EJS para cada tipo de OC
│   ├── viviana_nacional.ejs     # OC nacional con IGV (S/.)
│   ├── viviana_importacion.ejs  # OC importación sin IGV (USD)
│   └── camafra_nacional.ejs     # OC nacional con IGV (S/.)
│
├── generated/                   # PDFs generados localmente (gitignored)
├── package.json
└── vercel.json                  # Config Vercel: memoria 2GB, timeout 60s
```

---

## Esquema de base de datos

### `obras`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint (auto) | PK |
| `empresa` | text | `viviana` o `camafra` |
| `nombre` | text | Nombre completo de la obra |
| `direccion` | text | Dirección (opcional) |
| `activo` | boolean | Soft-delete |
| `created_at` | timestamptz | Fecha de creación |

### `proveedores`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint (auto) | PK |
| `razon_social` | text | Nombre del proveedor |
| `ruc` | text | RUC (único, opcional) |
| `direccion` | text | |
| `cuenta_corriente` | text | Datos bancarios |
| `contacto` | text | Nombre de contacto |
| `telefono` | text | |
| `correo` | text | |
| `activo` | boolean | Soft-delete |

### `correlativos`
| Columna | Tipo | Descripción |
|---|---|---|
| `empresa` | text | PK parcial |
| `anio` | int | PK parcial |
| `ultimo_numero` | int | Último correlativo reservado |

La función `siguiente_correlativo(p_empresa, p_anio)` realiza un `INSERT ... ON CONFLICT DO UPDATE` atómico, garantizando números únicos bajo concurrencia.

### `ordenes`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint (auto) | PK |
| `empresa` | text | `viviana` o `camafra` |
| `numero_oc` | text | Ej: `2026-000042` (único por empresa) |
| `anio` | int | Año de la OC |
| `correlativo` | int | Número secuencial |
| `template` | text | Nombre de la plantilla EJS usada |
| `proveedor_razon_social` | text | |
| `obra` | text | |
| `fecha` | date | Fecha de la OC |
| `total` | numeric(14,2) | Total calculado |
| `moneda` | text | `S/.` o `USD` |
| `pdf_path` | text | Ruta en Supabase Storage |
| `creado_por_email` | text | Email del usuario que la generó |
| `creado_por_nombre` | text | Nombre del usuario que la generó |
| `created_at` | timestamptz | Fecha de inserción |

> Todas las tablas tienen Row Level Security (RLS) habilitado. Solo usuarios autenticados pueden leer/escribir. La función serverless usa la `service_role` key y omite RLS.

### Migración de columnas de trazabilidad

Si ya ejecutaste el `schema.sql` inicial, añade las columnas de usuario con:

```sql
ALTER TABLE ordenes
ADD COLUMN IF NOT EXISTS creado_por_email text,
ADD COLUMN IF NOT EXISTS creado_por_nombre text;
```

---

## Estructura de almacenamiento PDF

Los PDFs se almacenan en el bucket privado `ordenes-pdf` de Supabase Storage:

```
ordenes-pdf/
└── {empresa}/
    └── {año}/
        └── {mes}/                   ← 01, 02 ... 12
            └── {numero_oc}.pdf      ← 2026-000001.pdf
```

Ejemplo real:

```
ordenes-pdf/
├── viviana/
│   └── 2026/
│       ├── 01/
│       │   ├── 2026-000001.pdf
│       │   └── 2026-000002.pdf
│       └── 02/
│           └── 2026-000003.pdf
└── camafra/
    └── 2026/
        └── 01/
            └── 2026-000001.pdf      ← correlativo independiente de viviana
```

El mes se extrae de la **fecha de la OC** (campo `fecha` del formulario), no del reloj del servidor. Los correlativos son compartidos por todos los usuarios de la misma empresa en el mismo año — sin importar quién genera la orden.

---

## Puesta en marcha local

### Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Cuenta en [Supabase](https://supabase.com) (plan gratuito es suficiente)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/nickdream21/OrdenesCompraSGVCM.git
cd OrdenesCompraSGVCM
npm install
```

### 2. Configurar Supabase

1. Crea un nuevo proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y ejecuta.
3. Ejecuta la migración de trazabilidad de usuario:
   ```sql
   ALTER TABLE ordenes
   ADD COLUMN IF NOT EXISTS creado_por_email text,
   ADD COLUMN IF NOT EXISTS creado_por_nombre text;
   ```
4. Copia la **URL del proyecto** y la **anon key** desde **Settings → API**.

### 3. Crear `supabase-config.js`

Crea el archivo `public/js/supabase-config.js` (está en `.gitignore`, nunca se sube al repo):

```javascript
window.SUPABASE_CONFIG = {
    url: 'https://XXXXXXXXXXXX.supabase.co',
    anonKey: 'eyJhbGci...'
};
```

### 4. Iniciar

```bash
npm run dev   # nodemon con recarga automática
# o
npm start     # node directo
```

La app queda disponible en `http://localhost:3000`.

---

## Variables de entorno

### Vercel (producción)

Configúralas en **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE` | Service Role key — tiene permisos totales, omite RLS |

> La `service_role` key **nunca** debe exponerse en el frontend ni subirse al repositorio.

### Frontend (cliente)

Se configuran en `public/js/supabase-config.js` (ignorado por git):

```javascript
window.SUPABASE_CONFIG = {
    url: 'https://XXXXXXXXXXXX.supabase.co',
    anonKey: 'eyJhbGci...'   // anon key — pública, pero RLS restringe el acceso
};
```

---

## Despliegue en Vercel

```bash
npm i -g vercel
vercel --prod
```

O conecta el repositorio directamente desde el [dashboard de Vercel](https://vercel.com/new). La configuración ya está en `vercel.json`:

```json
{
  "outputDirectory": "public",
  "functions": {
    "api/generate-pdf.js": {
      "memory": 2048,
      "maxDuration": 60,
      "includeFiles": "{templates/**,public/images/**}"
    }
  }
}
```

Se asignan **2 GB de memoria** y **60 s de timeout** porque Puppeteer/Chromium los necesita para renderizar correctamente en el entorno serverless.

---

## Configuración de Supabase

### Row Level Security

Todas las tablas tienen RLS habilitado. Las políticas actuales permiten cualquier operación a usuarios autenticados. La función serverless usa `service_role` y nunca está sujeta a RLS.

### Bucket de Storage

El bucket `ordenes-pdf` es **privado**. Los PDFs se sirven mediante URLs firmadas válidas por 120 segundos, generadas al momento en que el usuario hace clic en descargar desde el historial.

### Crear usuarios

1. Ve a **Supabase Dashboard → Authentication → Users → Add user**.
2. Ingresa el email corporativo individual y una contraseña.
3. Opcional — si ya conoces el nombre de la persona, configúralo directamente en `raw_user_meta_data` para que no se le pida al entrar:
   ```json
   { "nombre": "Juan Pérez" }
   ```

---

## Gestión de usuarios

El sistema usa **cuentas individuales** — una cuenta por persona, no compartida por área. Esto permite:

- Registrar quién generó cada OC (`creado_por_nombre` / `creado_por_email` en `ordenes`).
- Mostrar la columna **"Generado por"** en el historial de la app.
- Mostrar el nombre del usuario activo en el encabezado.

### Primer login

Si el usuario no tiene nombre en su perfil, la app muestra un modal solicitándolo al iniciar sesión. El nombre se guarda en `user_metadata` y no vuelve a pedirse.

### Flujo de autenticación

```
Login (email + contraseña)
    └─► Supabase Auth devuelve JWT
            └─► App lee user_metadata.nombre
                    └─► Se muestra en el header
                            └─► Cada OC registra nombre + email del creador
```

---

## Plantillas EJS

Las plantillas están en `/templates/` y se renderizan en el servidor. Variables disponibles:

| Variable | Descripción |
|---|---|
| `numero_oc` | Número asignado automáticamente (ej: `2026-000042`) |
| `fecha` | Fecha de la OC |
| `empresa` | Código de empresa (`viviana` / `camafra`) |
| `obra` | Nombre de la obra |
| `proveedor_razon_social` | Razón social del proveedor |
| `proveedor_direccion` | Dirección del proveedor |
| `proveedor_ruc` | RUC del proveedor |
| `items` | Array `[{ cantidad, unidad, descripcion, precio_unitario }]` |
| `condiciones_pago` | Condiciones de pago |
| `lugar_entrega` | Lugar de entrega |
| `logoViviana` | Logo VIVIANA en base64 |
| `logoCamafra` | Logo CAMAFRA en base64 |
| `formatCurrency(val, moneda)` | Formatea número a moneda |
| `formatNumber(val, decimales)` | Formatea número con separadores de miles |
| `moment` | Instancia de Moment.js (locale `es`) |

### Plantillas disponibles

| Archivo | Empresa | Moneda | IGV |
|---|---|---|---|
| `viviana_nacional.ejs` | VIVIANA | S/. | Incluido (18%) |
| `viviana_importacion.ejs` | VIVIANA | USD | No incluido |
| `camafra_nacional.ejs` | CAMAFRA | S/. | Incluido (18%) |

Para agregar una nueva plantilla: crea el archivo `.ejs` en `/templates/` y registra el template en `public/js/config.js` dentro de `window.OC_TEMPLATES`.

---

## Carpeta de red compartida

En desarrollo local, los PDFs también se copian a una carpeta de red. Se configura en `server/config.js`:

```javascript
module.exports = {
    PORT: 3000,
    SHARED_FOLDER: '\\\\192.168.0.171\\OC_Respaldo',
    USE_COMPANY_SUBFOLDERS: true,   // subcarpeta por empresa
    USE_DATE_SUBFOLDERS: true       // subcarpeta por año/mes
};
```

Estructura resultante:

```
OC_Respaldo/
├── viviana/
│   └── 2026/
│       ├── 01/
│       │   └── OC_2026-000001.pdf
│       └── 02/
│           └── OC_2026-000002.pdf
└── camafra/
    └── 2026/
        └── 01/
            └── OC_2026-000001.pdf
```

> Si la carpeta de red no está disponible, el PDF se genera y descarga igualmente. El error de copia se registra solo en consola y no interrumpe el flujo.

---

## .gitignore recomendado

```gitignore
node_modules/
generated/
public/js/supabase-config.js
.env
.env.local
*.pdf
```

---

## Licencia

MIT — ver archivo `LICENSE` para detalles.
