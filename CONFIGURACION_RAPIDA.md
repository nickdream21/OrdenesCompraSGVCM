# Configuración Rápida - Respaldo en Red

## Tu Escenario

- **Equipo 1 (Servidor)**: IP fija donde corre el sistema + PDFs locales
- **Equipo 2 (Respaldo)**: IP fija donde se guardan copias automáticas

---

## Paso 1: Configurar Equipo de Respaldo

### En el Equipo 2 (Respaldo):

1. **Asignar IP fija** (ejemplo: `192.168.1.50`)
   - Panel de Control → Redes → Propiedades del adaptador → IPv4
   - IP: `192.168.1.50` (ajusta según tu red)
   - Máscara: `255.255.255.0`

2. **Crear carpeta:**
   ```
   C:\OC_Respaldo
   ```

3. **Compartir carpeta:**
   - Clic derecho → Propiedades → Compartir
   - Compartir con "Todos" → Lectura/Escritura
   - Seguridad → Agregar "Todos" → Modificar ✓

4. **Nombre compartido:**
   ```
   \\192.168.1.50\OC_Respaldo
   ```

---

## Paso 2: Configurar Servidor

### En el Equipo 1 (Servidor):

1. **Asignar IP fija** (ejemplo: `192.168.1.100`)

2. **Probar conexión:**
   ```cmd
   ping 192.168.1.50
   dir \\192.168.1.50\OC_Respaldo
   echo test > \\192.168.1.50\OC_Respaldo\test.txt
   ```

3. **Editar `server/config.js`:**
   ```javascript
   module.exports = {
       PORT: 3000,
       SHARED_FOLDER: '\\\\192.168.1.50\\OC_Respaldo',  // IP del equipo de respaldo
       USE_COMPANY_SUBFOLDERS: true,
       USE_DATE_SUBFOLDERS: false
   };
   ```

4. **Iniciar sistema:**
   ```cmd
   npm start
   ```

5. **Verificar mensaje:**
   ```
   🌐 Carpeta compartida: ✅ Activa: \\192.168.1.50\OC_Respaldo
   ```

---

## Paso 3: Probar

1. Abre `http://localhost:3000`
2. Genera un PDF de prueba
3. Verifica que aparezca en:
   - **Local**: `C:\Users\NICK\...\generated\OC_XXX.pdf`
   - **Respaldo**: `\\192.168.1.50\OC_Respaldo\viviana\OC_XXX.pdf`

---

## Si algo falla:

**Error: "Carpeta compartida no encontrada"**
- Verifica: `dir \\192.168.1.50\OC_Respaldo` desde el servidor
- Revisa permisos de compartir en el equipo de respaldo

**Error: "Acceso denegado"**
- Revisa permisos de Seguridad (Modificar) en la carpeta
- Mapea unidad: `net use Z: \\192.168.1.50\OC_Respaldo /persistent:yes`

**No hace ping**
- Ambos equipos deben estar en la misma red
- Desactiva firewall temporalmente para probar

---

**Documentación completa:** Ver `CONFIGURACION_RED.md`
