# Guía de despliegue — Órdenes de Compra en la web (gratis)

El sistema ahora corre en la web con **Vercel** (frontend + función que genera el PDF)
y **Supabase** (base de datos, login y archivo de PDF). El PDF sale **idéntico** al
del sistema local porque la función reutiliza las mismas plantillas `templates/*.ejs`.

Sigue estos pasos **una sola vez**.

---

## 1) Crear el proyecto en Supabase (base de datos)

1. Entra a https://supabase.com y crea una cuenta gratis → **New project**.
   - Anota la contraseña de la base de datos (no se usará a diario).
2. Cuando el proyecto esté listo, ve a **SQL Editor → New query**, pega TODO el
   contenido de `supabase/schema.sql` y pulsa **Run**.
   - Esto crea las tablas (`obras`, `proveedores`, `correlativos`, `ordenes`),
     la función del correlativo, las políticas de seguridad y el bucket de PDF.
3. Crea el **usuario compartido** (la "contraseña del equipo"):
   - **Authentication → Users → Add user**.
   - Pon un correo (ej. `equipo@tuempresa.com`) y una contraseña.
   - Marca **Auto Confirm User** y guarda.
4. Copia tus credenciales en **Settings → API**:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (¡secreta! solo va en Vercel, nunca en el código)

---

## 2) Conectar el frontend con Supabase

Edita el archivo **`public/js/supabase-config.js`** y pega tu URL y tu *anon key*:

```js
window.SUPABASE_CONFIG = {
    url: 'https://xxxx.supabase.co',
    anonKey: 'eyJ... (anon public)'
};
```

> La *anon key* es pública por diseño: la seguridad la dan el login compartido y las
> políticas RLS. **Nunca** pongas aquí la `service_role`.

---

## 3) Subir el código a GitHub

Si aún no está en GitHub:

```bash
git add .
git commit -m "Versión web (Vercel + Supabase)"
git push
```

---

## 4) Desplegar en Vercel

1. Entra a https://vercel.com con tu cuenta de GitHub → **Add New → Project**.
2. Importa este repositorio. Framework: **Other** (déjalo por defecto).
3. En **Environment Variables** agrega (Production y Preview):
   - `SUPABASE_URL` = tu Project URL
   - `SUPABASE_SERVICE_ROLE` = tu *service_role* key
4. **Deploy**. Al terminar tendrás un link público (ej. `https://tu-proyecto.vercel.app`)
   que funciona en PC y celular. Ese es el link que compartes con el equipo.

---

## 5) Cargar datos iniciales

Entra al link, inicia sesión con el correo/clave del paso 1.3, y:

- En **Obras**: agrega las obras hábiles de cada empresa (VIVIANA / CAMAFRA).
- En **Proveedores**: agrega tus proveedores frecuentes (razón social, RUC, dirección, etc.).
  También puedes crearlos sobre la marcha desde el formulario de la OC ("➕ Nuevo proveedor").

### Correlativo inicial
El número de OC es automático por empresa y año, con formato `AAAA-NNNNNN`
(ej. `2026-000001`). Para 2026 empieza en `000001`. Si quieres **continuar desde otro
número**, ejecuta en el SQL Editor de Supabase (ejemplo, para que el próximo sea 000190):

```sql
update public.correlativos set ultimo_numero = 189 where empresa = 'viviana' and anio = 2026;
```

---

## Cómo se usa el día a día

1. **Generar**: elige empresa → tipo de orden → completa los datos
   (la obra y el proveedor se eligen de una lista; el proveedor autocompleta RUC,
   dirección, etc.). El número se asigna solo. **Generar OC** descarga el PDF y lo
   archiva en el Historial.
2. **Vista previa**: muestra el PDF sin consumir un número (sale como "BORRADOR").
3. **Historial**: lista todas las OC generadas; puedes volver a descargar el PDF.

---

## Notas técnicas

- El PDF lo genera `api/generate-pdf.js` con `puppeteer-core` + `@sparticuz/chromium`,
  reutilizando `templates/*.ejs` (idéntico al sistema local).
- El servidor antiguo en `server/` queda solo como referencia/uso local; **no** se usa
  en la nube. La carpeta de respaldo en red (`\\192.168.0.171\...`) se reemplaza por el
  archivo central en Supabase Storage.
- Si el PDF fallara en Vercel por incompatibilidad de Chromium, ajusta las versiones de
  `puppeteer-core` y `@sparticuz/chromium` en `package.json` siguiendo la tabla de
  compatibilidad del README de `@sparticuz/chromium`.
