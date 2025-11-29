# 🌐 Configuración de Red Local para la Empresa

Este documento explica cómo configurar el sistema para funcionar en red local con carpetas compartidas.

## 📋 Escenarios de Uso

### Escenario 1: Servidor con Respaldo en Equipo Separado (RECOMENDADO)

- **Equipo Principal (Servidor)**: Con IP fija donde corre el servidor Node.js
  - Los PDFs se guardan localmente en el equipo
  - IP fija ejemplo: `192.168.1.100`

- **Equipo de Respaldo**: Equipo separado con IP fija para almacenamiento
  - Los PDFs se replican automáticamente aquí como respaldo
  - IP fija ejemplo: `192.168.1.50`

- **Usuarios**: Acceden vía navegador a la IP del servidor principal

### Escenario 2: Servidor Compartido (Simple)

- **Servidor**: Un equipo central con IP fija donde corre el servidor Node.js
- **Usuarios**: Múltiples equipos que acceden vía navegador a la IP del servidor
- **Almacenamiento**: Los PDFs se guardan localmente y en carpeta compartida del mismo equipo

## 🖥️ CONFIGURACIÓN PARA ESCENARIO 1: Servidor + Equipo de Respaldo Separado

### Paso 1: Configurar Equipo Principal (Servidor)

#### 1.1 Asignar IP Fija al Equipo Principal

**En Windows:**
1. Ve a: `Panel de Control → Redes e Internet → Centro de redes → Cambiar configuración del adaptador`
2. Clic derecho en tu adaptador de red → `Propiedades`
3. Selecciona `Protocolo de Internet versión 4 (TCP/IPv4)` → `Propiedades`
4. Marca `Usar la siguiente dirección IP`:
   - **IP**: `192.168.1.100` (ejemplo - ajusta según tu red)
   - **Máscara**: `255.255.255.0`
   - **Puerta de enlace**: `192.168.1.1` (tu router)
   - **DNS preferido**: `8.8.8.8`

5. Clic en **Aceptar** y cierra todo

#### 1.2 Instalar el Sistema en el Equipo Principal

El sistema ya está instalado aquí. Los PDFs se guardarán localmente en:
```
C:\Users\NICK\Downloads\oc-web-system\oc-web-system\generated\
```

### Paso 2: Configurar Equipo de Respaldo

#### 2.1 Asignar IP Fija al Equipo de Respaldo

**En Windows (en el equipo de respaldo):**
1. Ve a: `Panel de Control → Redes e Internet → Centro de redes → Cambiar configuración del adaptador`
2. Clic derecho en tu adaptador de red → `Propiedades`
3. Selecciona `Protocolo de Internet versión 4 (TCP/IPv4)` → `Propiedades`
4. Marca `Usar la siguiente dirección IP`:
   - **IP**: `192.168.1.50` (ejemplo - diferente del servidor)
   - **Máscara**: `255.255.255.0`
   - **Puerta de enlace**: `192.168.1.1` (tu router)
   - **DNS preferido**: `8.8.8.8`

5. Clic en **Aceptar** y cierra todo

#### 2.2 Crear Carpeta Compartida en el Equipo de Respaldo

1. **Crear la carpeta** donde se guardarán los PDFs de respaldo:
   ```
   C:\OC_Respaldo
   ```

2. Clic derecho en la carpeta → `Propiedades`

3. Pestaña **`Compartir`** → `Uso compartido avanzado`

4. Marca **`Compartir esta carpeta`**
   - **Nombre del recurso compartido**: `OC_Respaldo` (importante, anótalo)
   - Clic en **`Permisos`**
   - Agrega **`Todos`** con permisos de **Control total**
   - Clic en **`Aplicar`** y **`Aceptar`**

5. Pestaña **`Seguridad`** → `Editar`
   - Agrega **`Todos`** (si no está)
   - Marca los permisos: **Modificar** y **Escribir**
   - Clic en **`Aplicar`** y **`Aceptar`**

6. Ahora la ruta compartida del equipo de respaldo será:
   ```
   \\192.168.1.50\OC_Respaldo
   ```

#### 2.3 Verificar Conectividad Entre Equipos

**Desde el Equipo Principal (donde está el servidor):**

1. Abre CMD o PowerShell

2. Prueba conectividad:
   ```cmd
   ping 192.168.1.50
   ```
   Deberías ver: `Respuesta desde 192.168.1.50: bytes=32 tiempo<1ms TTL=128`

3. Prueba acceso a la carpeta compartida:
   ```cmd
   dir \\192.168.1.50\OC_Respaldo
   ```
   Deberías ver el contenido de la carpeta (aunque esté vacía)

4. Prueba escribir un archivo:
   ```cmd
   echo test > \\192.168.1.50\OC_Respaldo\test.txt
   ```
   Si no hay errores, todo está configurado correctamente

5. Borra el archivo de prueba:
   ```cmd
   del \\192.168.1.50\OC_Respaldo\test.txt
   ```

### Paso 3: Configurar el Sistema para Usar el Respaldo

**En el Equipo Principal (donde está el servidor):**

Abre el archivo `server/config.js` y configura la ruta del equipo de respaldo:

```javascript
module.exports = {
    // Puerto del servidor
    PORT: 3000,

    // Ruta de red compartida DEL EQUIPO DE RESPALDO
    // IMPORTANTE: Usa la IP del equipo de respaldo (NO del servidor)
    SHARED_FOLDER: '\\\\192.168.1.50\\OC_Respaldo',

    // Crear subcarpetas por empresa (viviana, camafra)
    USE_COMPANY_SUBFOLDERS: true,

    // Crear subcarpetas por fecha (año/mes)
    USE_DATE_SUBFOLDERS: false
};
```

**Ajusta los valores según tu configuración:**
- **`192.168.1.50`**: Cambia por la IP real de tu equipo de respaldo
- **`OC_Respaldo`**: Cambia por el nombre que le diste al recurso compartido

**Opciones de organización en el equipo de respaldo:**

**Opción 1 - Solo por empresa (RECOMENDADO):**
```javascript
USE_COMPANY_SUBFOLDERS: true,
USE_DATE_SUBFOLDERS: false
```
Resultado en `\\192.168.1.50\OC_Respaldo\`:
```
\\192.168.1.50\OC_Respaldo\
├── viviana\
│   └── OC_000190.pdf
└── camafra\
    └── OC_000731.pdf
```

**Opción 2 - Por empresa y fecha:**
```javascript
USE_COMPANY_SUBFOLDERS: true,
USE_DATE_SUBFOLDERS: true
```
Resultado en `\\192.168.1.50\OC_Respaldo\`:
```
\\192.168.1.50\OC_Respaldo\
├── viviana\
│   └── 2025\
│       └── 01\
│           └── OC_000190.pdf
└── camafra\
    └── 2025\
        └── 01\
            └── OC_000731.pdf
```

**Opción 3 - Sin organización:**
```javascript
USE_COMPANY_SUBFOLDERS: false,
USE_DATE_SUBFOLDERS: false
```
Resultado en `\\192.168.1.50\OC_Respaldo\`:
```
\\192.168.1.50\OC_Respaldo\
├── OC_000190.pdf
├── OC_000731.pdf
└── OC_000732.pdf
```

## 🚀 Paso 4: Iniciar y Probar el Sistema

### 4.1 Iniciar el Servidor

**En el Equipo Principal (192.168.1.100):**

1. Abre CMD o PowerShell en la carpeta del proyecto:
   ```
   C:\Users\NICK\Downloads\oc-web-system\oc-web-system
   ```

2. Ejecuta:
   ```bash
   npm start
   ```

3. Deberías ver algo como:
   ```
   🚀 SISTEMA DE ÓRDENES DE COMPRA INICIADO
   🌐 Servidor corriendo en: http://localhost:3000
   📁 Templates: C:\Users\NICK\...\templates
   📄 PDFs locales: C:\Users\NICK\...\generated
   🌐 Carpeta compartida: ✅ Activa: \\192.168.1.50\OC_Respaldo

   👉 Abre tu navegador en http://localhost:3000
   ```

### 4.2 Generar un PDF de Prueba

1. En el mismo equipo (servidor), abre el navegador y ve a:
   ```
   http://localhost:3000
   ```

2. Selecciona un template (ejemplo: "Viviana - Nacional")

3. Completa los datos del formulario

4. Haz clic en "Generar PDF"

5. El PDF se descargará en tu navegador

### 4.3 Verificar Guardado Dual

**Revisa la consola del servidor**, deberías ver:
```
📄 PDF guardado localmente en: C:\Users\NICK\...\generated\OC_000190.pdf
✅ PDF guardado en carpeta compartida: \\192.168.1.50\OC_Respaldo\viviana\OC_000190.pdf
```

**Verifica físicamente los archivos:**

1. **Local** (en el servidor):
   ```
   C:\Users\NICK\Downloads\oc-web-system\oc-web-system\generated\OC_000190.pdf
   ```

2. **Red** (en el equipo de respaldo):
   - Desde el servidor, abre: `\\192.168.1.50\OC_Respaldo\viviana\OC_000190.pdf`
   - Desde el equipo de respaldo: `C:\OC_Respaldo\viviana\OC_000190.pdf`

Si ves el PDF en ambos lugares: **¡CONFIGURACIÓN EXITOSA!**

### 4.4 Acceso desde Otros Equipos (Opcional)

Si otros usuarios quieren acceder al sistema desde sus equipos:

1. Los usuarios abren su navegador y van a:
   ```
   http://192.168.1.100:3000
   ```
   (Usa la IP del servidor, NO `localhost`)

2. Pueden generar PDFs desde cualquier equipo

3. Los PDFs se guardarán SIEMPRE en ambos lugares (local del servidor + respaldo)

---

## 🔄 RESUMEN: Flujo de Guardado de PDFs

Cuando se genera un PDF:

1. **Usuario** genera PDF desde el navegador
2. **Servidor** (192.168.1.100) procesa y guarda:
   - ✅ Copia LOCAL en: `C:\Users\NICK\...\generated\`
   - ✅ Copia RESPALDO en: `\\192.168.1.50\OC_Respaldo\`
3. **Usuario** descarga el PDF en su navegador
4. **Equipo de respaldo** (192.168.1.50) tiene copia automática

**IMPORTANTE:** Si falla el guardado en red, el sistema sigue funcionando con la copia local.

## 🔧 Solución de Problemas

### ❌ Error: "Carpeta compartida no encontrada"

**Problema:** En la consola del servidor aparece: `⚠️ Carpeta compartida no encontrada: \\192.168.1.50\OC_Respaldo`

**Solución paso a paso:**

1. **Verifica conectividad de red:**
   ```cmd
   ping 192.168.1.50
   ```
   Si falla: revisa que ambos equipos estén conectados a la misma red

2. **Prueba acceso a la carpeta desde el servidor:**
   ```cmd
   dir \\192.168.1.50\OC_Respaldo
   ```
   Si falla: revisa el Paso 2.2 (Crear Carpeta Compartida)

3. **Verifica que el recurso compartido existe:**
   Desde el equipo de respaldo, abre CMD y ejecuta:
   ```cmd
   net share
   ```
   Deberías ver `OC_Respaldo` en la lista

4. **Verifica la ruta en `config.js`:**
   ```javascript
   SHARED_FOLDER: '\\\\192.168.1.50\\OC_Respaldo',  // Doble backslash
   ```

### ❌ Error: "Acceso denegado" al escribir en red

**Problema:** `Error al guardar en carpeta compartida: Acceso denegado`

**Solución:**

1. **Verifica permisos de "Compartir":**
   - Equipo de respaldo → Clic derecho en carpeta → Propiedades → Compartir
   - "Todos" debe tener permisos de **Lectura/Escritura**

2. **Verifica permisos de "Seguridad":**
   - Propiedades → Seguridad → Editar
   - "Todos" debe tener **Modificar** activado

3. **Mapea la unidad con credenciales (si es necesario):**
   Desde el servidor:
   ```cmd
   net use Z: \\192.168.1.50\OC_Respaldo /user:NOMBRE_USUARIO contraseña /persistent:yes
   ```
   Luego en `config.js`:
   ```javascript
   SHARED_FOLDER: 'Z:\\',
   ```

### ❌ Los PDFs se guardan localmente pero NO en red

**Problema:** El PDF se descarga bien pero no aparece en `\\192.168.1.50\OC_Respaldo\`

**Solución:**

1. **Revisa la consola del servidor** para ver el error específico

2. **Prueba escribir manualmente:**
   ```cmd
   echo test > \\192.168.1.50\OC_Respaldo\test.txt
   ```
   Si falla: hay un problema de permisos o conectividad

3. **Verifica el firewall del equipo de respaldo:**
   - Debe permitir "Compartir archivos e impresoras"

### ❌ No puedo hacer ping entre equipos

**Problema:** `ping 192.168.1.50` da timeout o "Destino inaccesible"

**Solución:**

1. **Verifica que ambos equipos estén en la misma red local**
   - Deben tener IPs del mismo rango (ejemplo: 192.168.1.x)

2. **Desactiva temporalmente el firewall** en ambos equipos para probar
   - Si funciona, el problema es el firewall
   - Vuelve a activarlo y configura excepciones

3. **Habilita "Compartir archivos e impresoras" en firewall:**
   - Panel de Control → Firewall de Windows → Configuración avanzada
   - Reglas de entrada → Busca "Compartir archivos e impresoras"
   - Habilita todas las reglas relevantes

### ❌ Puerto 3000 ocupado

**Problema:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solución:**

Opción 1 - Cambiar puerto en `server/config.js`:
```javascript
PORT: 3001,  // Usa otro puerto
```

Opción 2 - Cerrar el proceso que usa el puerto:
```cmd
netstat -ano | findstr :3000
taskkill /PID [número_PID] /F
```

### ❌ Firewall bloquea acceso desde otros equipos

**Problema:** Desde otro equipo no puedo acceder a `http://192.168.1.100:3000`

**Solución:**

1. **Agregar regla de firewall en el servidor:**
   - Windows Defender Firewall → Configuración avanzada
   - Reglas de entrada → Nueva regla
   - Puerto → TCP → Puerto específico: `3000`
   - Permitir la conexión → Siguiente → Siguiente
   - Nombre: "Sistema OC - Puerto 3000"

2. **O temporalmente desactiva el firewall para probar:**
   ```cmd
   netsh advfirewall set allprofiles state off
   ```
   (Vuelve a activarlo después de probar)

## 📊 Arquitectura del Sistema (Escenario 1)

```
┌──────────────────────────────────────────────────────────────────┐
│                           RED LOCAL                              │
│                         192.168.1.x/24                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────┐    ┌──────────────────────┐   │
│  │   EQUIPO PRINCIPAL          │    │   EQUIPO RESPALDO    │   │
│  │   (SERVIDOR)                │    │   192.168.1.50       │   │
│  │   192.168.1.100             │    │                      │   │
│  │                             │    │  📁 C:\OC_Respaldo\  │   │
│  │  ⚙️ Node.js Server (3000)   │──┐ │  ├── viviana\        │   │
│  │  📁 C:\...\generated\       │  │ │  │   └── OC_XXX.pdf │   │
│  │  ├── OC_XXX.pdf ✅ LOCAL    │  │ │  └── camafra\        │   │
│  │  └── OC_YYY.pdf             │  │ │      └── OC_YYY.pdf │   │
│  │                             │  │ │                      │   │
│  │  Cuando se genera un PDF:   │  │ │  ✅ RESPALDO         │   │
│  │  1. Guarda LOCAL ✅         │  │ │  (Automático)        │   │
│  │  2. Guarda RESPALDO ✅──────┼──┘ │                      │   │
│  │  3. Envía al usuario 📤     │    │  Compartida como:    │   │
│  └──────────▲──────────────────┘    │  \\192.168.1.50\    │   │
│             │                       │  OC_Respaldo         │   │
│             │                       └──────────────────────┘   │
│             │                                                  │
│  ┌──────────┴──────────┐         ┌────────────────────┐      │
│  │   USUARIO 1         │         │   USUARIO 2        │      │
│  │   192.168.1.101     │         │   192.168.1.102    │      │
│  │   Navegador Chrome  │         │   Navegador Edge   │      │
│  │                     │         │                    │      │
│  │  http://192.168.1.100:3000   │                    │      │
│  │  Genera PDF ────────┘         │                    │      │
│  │  Descarga ✅                  │                    │      │
│  └───────────────────────────────┴────────────────────┘      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Flujo de guardado:

1. **Usuario** accede desde navegador → `http://192.168.1.100:3000`
2. **Genera PDF** → Click en "Generar PDF"
3. **Servidor** (192.168.1.100):
   - ✅ Guarda en LOCAL: `C:\...\generated\OC_XXX.pdf`
   - ✅ Guarda en RED: `\\192.168.1.50\OC_Respaldo\empresa\OC_XXX.pdf`
4. **Usuario** descarga el PDF automáticamente
5. **Equipo de respaldo** (192.168.1.50) tiene copia inmediata

## 🔐 Seguridad

1. **Permisos de carpeta compartida**: Da acceso solo a usuarios autorizados
2. **Firewall**: Permite solo el puerto 3000 y solo desde tu red local
3. **Sin autenticación**: El sistema no tiene login. Si necesitas autenticación, considera:
   - Usar autenticación de Windows en la carpeta compartida
   - Agregar un sistema de login en el frontend
   - Usar VPN para acceso remoto

## 📝 Checklist de Configuración (Escenario 1: Servidor + Respaldo)

### Equipo Principal (Servidor - 192.168.1.100):
- [ ] IP fija asignada (ej: 192.168.1.100)
- [ ] Sistema instalado en `C:\Users\NICK\Downloads\oc-web-system\oc-web-system`
- [ ] Node.js instalado
- [ ] `server/config.js` configurado con IP del equipo de respaldo
- [ ] Firewall permite puerto 3000 (para acceso de clientes)
- [ ] Puede hacer ping al equipo de respaldo: `ping 192.168.1.50`
- [ ] Puede acceder a carpeta compartida: `dir \\192.168.1.50\OC_Respaldo`

### Equipo de Respaldo (192.168.1.50):
- [ ] IP fija asignada (ej: 192.168.1.50)
- [ ] Carpeta `C:\OC_Respaldo` creada
- [ ] Carpeta compartida como `OC_Respaldo`
- [ ] Permisos de "Compartir" configurados (Lectura/Escritura)
- [ ] Permisos de "Seguridad" configurados (Modificar)
- [ ] Firewall permite "Compartir archivos e impresoras"
- [ ] Puede hacer ping al servidor: `ping 192.168.1.100`

### Pruebas:
- [ ] Servidor inicia correctamente con `npm start`
- [ ] Consola muestra: `✅ Activa: \\192.168.1.50\OC_Respaldo`
- [ ] PDF de prueba se genera correctamente
- [ ] PDF aparece en `C:\...\generated\` (servidor)
- [ ] PDF aparece en `C:\OC_Respaldo\empresa\` (respaldo)
- [ ] Subcarpetas por empresa se crean automáticamente

### Acceso de Usuarios (Opcional):
- [ ] Otros equipos pueden acceder a `http://192.168.1.100:3000`
- [ ] Firewall del servidor permite puerto 3000
- [ ] Usuarios pueden generar PDFs desde sus navegadores

## 🎯 Recomendaciones

### Para el Equipo Principal (Servidor):
1. **Debe estar siempre encendido** durante horario de trabajo
2. **Configurar inicio automático del sistema:**
   - Crear archivo `.bat` con `npm start`
   - Agregarlo al inicio de Windows o usar `pm2` (gestor de procesos)
3. **Revisar logs** periódicamente para detectar errores

### Para el Equipo de Respaldo:
1. **También debe estar encendido** para que funcione el respaldo
2. **Configurar backups adicionales** de `C:\OC_Respaldo` a disco externo o nube
3. **Verificar espacio en disco** periódicamente

### General:
1. **Conexión de red estable** entre ambos equipos (usar cable ethernet si es posible)
2. **Switch dedicado** si tienes varios equipos en la red
3. **Documentar las IPs** usadas y compartir con el equipo
4. **Capacitar a usuarios** sobre cómo usar el sistema
5. **Plan de contingencia** si el equipo de respaldo está apagado

---

## 🆘 Soporte y Ayuda

**Si algo no funciona:**
1. Revisa la sección "Solución de Problemas" de este documento
2. Revisa los logs del servidor en la consola donde ejecutaste `npm start`
3. Verifica los pasos de configuración uno por uno

**Logs del servidor muestran:**
- ✅ PDFs guardados correctamente
- ⚠️ Advertencias si falla el respaldo (pero el sistema sigue funcionando)
- ❌ Errores críticos que detienen el servidor

---

## 📋 Comandos Útiles de Diagnóstico

**Desde el Equipo Principal (Servidor):**
```cmd
# Ver IP actual
ipconfig

# Probar conectividad con equipo de respaldo
ping 192.168.1.50

# Ver carpeta compartida del respaldo
dir \\192.168.1.50\OC_Respaldo

# Probar escribir en carpeta compartida
echo test > \\192.168.1.50\OC_Respaldo\test.txt

# Ver qué está usando el puerto 3000
netstat -ano | findstr :3000

# Ver recursos compartidos disponibles en la red
net view \\192.168.1.50
```

**Desde el Equipo de Respaldo:**
```cmd
# Ver IP actual
ipconfig

# Ver recursos compartidos de este equipo
net share

# Probar conectividad con servidor
ping 192.168.1.100

# Ver contenido de la carpeta de respaldo
dir C:\OC_Respaldo
```

---

**Última actualización:** 2025-01-20
**Documento creado para:** Sistema Web de Órdenes de Compra
**Versión:** 1.0
