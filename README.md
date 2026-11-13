# Sistema Web de Órdenes de Compra y Servicio — SGV / CM / ECN

Aplicación web (mobile-first) para generar, numerar y archivar **Órdenes de Compra (OC)** y **Órdenes de Servicio (OS)** en PDF para:

| Empresa | Documentos | Formato | Numeración |
|---|---|---|---|
| Servicios Generales VIVIANA E.I.R.L. | OC nacional (S/) · OC importación (USD) | Propio | `2026-000001` (reinicia cada año) |
| CAMAFRA MOTORS S.A.C. | OC nacional (S/) | Propio | `2026-000001` (reinicia cada año) |
| **Edificaciones & Construcciones del Norte E.I.R.L.** | **OC y OS** | **Réplica del formato NISIRA** | `0001 - 0000001` (continua, separada OC/OS) |

Stack: HTML/CSS/JS sin frameworks · Vercel Serverless (Node 20+) · Supabase (Postgres + Auth + Storage) · EJS + Puppeteer/Chromium.

---

## Arquitectura

```
Navegador ── login (Supabase Auth) ──► Supabase
   │                                      ▲
   │ POST /api/generate-pdf (JWT)         │ service_role
   ▼                                      │
Vercel Function ── valida plantilla (public/js/config.js)
                ── calcula importes (lib/calculo.js)
                ── reserva correlativo (RPC atómica)
                ── EJS → PDF (lib/pdf.js)
                ── sube a Storage + registra en `ordenes`
                └─► devuelve el PDF
Vercel Cron (diario) ── /api/keepalive ── evita que Supabase se pause
```

* **Fuente única de verdad:** `public/js/config.js` define empresas, plantillas y campos. Lo usan el navegador (para dibujar el formulario) **y** el servidor (para validar, numerar y calcular). Para agregar una empresa o plantilla se edita solo ese archivo + la plantilla `.ejs`.
* **El mismo código en Vercel y en local:** `server/app.js` monta la misma función `api/generate-pdf.js`.

```
api/generate-pdf.js     Genera OC/OS (función serverless)
api/keepalive.js        Ping diario a la BD (Vercel Cron)
lib/calculo.js          Valor venta, IGV, total y monto en letras
lib/pdf.js              Render EJS → PDF (Chromium serverless o Chrome local)
templates/nisira.ejs    Formato NISIRA (Edificaciones OC + OS)
templates/*_*.ejs       Formatos VIVIANA / CAMAFRA
assets/fonts/           Tinos/Arimo/Cousine (OFL) = métricas de Times/Arial/Courier
public/                 Frontend estático
supabase/schema.sql     Tablas, funciones, RLS y bucket
test/                   npm test
```

---

## Puesta en marcha (proyecto Supabase NUEVO)

> El proyecto Supabase anterior (`tayygenvbyxhohouhhof`) fue **eliminado** por inactividad del plan gratuito, junto con sus usuarios. Hay que crear uno nuevo.

1. **Crear proyecto** en <https://supabase.com> (plan Free, región `South America (São Paulo)`).
2. **SQL Editor → New query** → pegar `supabase/schema.sql` → **Run**.
   *Para continuar una numeración existente*, edita en el SQL los `ultimo_numero` iniciales (la siguiente orden será ese número + 1).
3. **Authentication → URL Configuration**: *Site URL* = la URL de Vercel (p. ej. `https://ordenes-compra-sgvcm.vercel.app`). Es a donde lleva el enlace de “¿Olvidaste tu contraseña?”.
4. **Authentication → Users → Add user** (uno por persona, *Auto Confirm*). Opcional: en *User metadata* `{ "nombre": "Nombre Apellido" }`; si no, la app lo pide en el primer ingreso. Ese nombre sale en el PDF como **Elaboración**.
5. **Settings → API**: copiar
   * `Project URL` y `anon / publishable key` → `public/js/supabase-config.js` (son públicas por diseño; la seguridad la da RLS).
   * `service_role` (secreta) → solo en Vercel.
6. **Vercel → Settings → Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | URL del proyecto |
   | `SUPABASE_SERVICE_ROLE` | service_role key |
   | `CRON_SECRET` | cualquier texto largo aleatorio (protege `/api/keepalive`) |

   Luego **Redeploy**.
7. **Firma del aprobador (opcional):** Storage → bucket `ordenes-pdf` → crear carpeta `_firmas` → subir `firma-edificaciones.png` (PNG con fondo transparente). **No** se sube al repositorio porque es público.

### Datos de la empresa Edificaciones

En `public/js/config.js`, empresa `edificaciones`: completar `ruc`, `direccion`, `telefono` y `aprobador` (nombre que aparece en “Vº Bº Aprobado”).

---

## Formato NISIRA (Edificaciones)

`templates/nisira.ejs` reproduce los PDF de NISIRA (ver ejemplos en `docOriginales/`, que no se publica):

* Cabecera con logo, razón social, dirección, recuadro **RUC / ORDEN DE COMPRA|SERVICIO / 0001 - 0000000** y sello **APROBADO**.
* Datos: proveedor (`RUC - Razón social`), dirección, cta. cte., atención, condiciones de pago, para ser usado en, lugar de entrega, proyecto, fax, fecha, cotización, orden de pedido, fecha de entrega. La OS agrega *Área* y *Pedido Nº*.
* Tabla de ítems con las columnas de NISIRA (OC: ITEM · DESCRIPCIÓN · OBSERVACIONES · CANTIDAD · U.MEDIDA · C. COSTO · P.UNITARIO · TOTAL; OS: ITEM · DESCRIPCION · C.COSTO · OBSERVACIONES · U.M. · CANTIDAD · P.UNITARIO · P.TOTAL). Precio unitario con 4 decimales.
* `Son: CINCO MIL Y 00/100 SOLES`, VALOR VENTA / I.G.V. 18 % / TOTAL en PEN o USD.
* Opción **“Los precios unitarios ya incluyen IGV”**: el sistema desglosa el valor venta como NISIRA y el total cuadra al céntimo.
* Firmas *Elaboración* (usuario que genera) y *Vº Bº Aprobado*, y el recuadro **IMPORTANTE** con la nota SUNAT.

---

## Desarrollo local

```bash
npm install
cp .env.example .env      # completar SUPABASE_URL y SUPABASE_SERVICE_ROLE
npm start                 # http://localhost:3000  (usa el Chrome/Edge instalado)
npm test                  # pruebas de cálculo, catálogo y plantillas
```

Si `server/config.js → SHARED_FOLDER` (o la variable `SHARED_FOLDER`) apunta a una carpeta de red, cada PDF generado desde el servidor local también se copia ahí: `<carpeta>/<empresa>/<año>/<mes>/`.

---

## Base de datos

| Tabla | Uso | Acceso de usuarios (RLS) |
|---|---|---|
| `obras` | Obras/proyectos por empresa | leer y editar |
| `proveedores` | Proveedores (autocompletan el formulario) | leer y editar |
| `ordenes` | Historial (incluye `tipo_doc`, `datos` jsonb y quién la generó) | **solo lectura** |
| `correlativos` | Último número por `empresa + tipo_doc + periodo` | ninguno (solo el servidor) |

Funciones: `siguiente_correlativo()` (reserva atómica) y `liberar_correlativo()` (si el PDF falla, devuelve el número para no dejar huecos). Ambas solo ejecutables por el servidor.

Storage: bucket privado `ordenes-pdf/<empresa>/<OC|OS>/<año>/<mes>/<archivo>.pdf`.

---

## Hosting gratuito: por qué seguir en Vercel + Supabase

Se evaluaron alternativas (Netlify, Render, Cloudflare, Firebase, Neon). Vercel + Supabase sigue siendo la mejor opción gratuita para este sistema porque Vercel ejecuta Chromium (necesario para un PDF idéntico al de NISIRA) y Supabase da base de datos + login + almacenamiento en un solo servicio. El único problema real era que **Supabase Free pausa el proyecto tras 7 días sin uso** y lo puede borrar después; eso se resuelve con el cron diario `/api/keepalive` incluido en `vercel.json`.

Límites aproximados del plan Free (confirmar en supabase.com/pricing, pueden cambiar): 500 MB de base de datos, 1 GB de Storage (≈ 6 000 PDF de 170 KB), 50 000 usuarios activos/mes; correo de recuperación de contraseña limitado a unos pocos por hora (suficiente para un equipo pequeño).
