# Instrucciones para Tu Configuración Específica

## Tu Configuración

- **Equipo Servidor (este equipo)**: Donde corre el sistema
- **Equipo Respaldo**: IP `192.168.0.171` con carpeta `D:\OC_Respaldo`

---

## Estado Actual

✅ **Configuración del sistema**: Completada
- Archivo `server/config.js` configurado con: `\\192.168.0.171\OC_Respaldo`
- Subcarpetas por empresa: Activadas (viviana/, camafra/)

✅ **Conectividad de red**: OK
- El ping a 192.168.0.171 funciona correctamente
- Ambos equipos están en la misma red (192.168.0.x)

✅ **Carpeta creada**: OK
- La carpeta D:\OC_Respaldo existe en el equipo 192.168.0.171

⚠️ **Carpeta compartida**: PENDIENTE
- Necesitas compartir D:\OC_Respaldo siguiendo los pasos de abajo

---

## Pasos que DEBES hacer en el equipo 192.168.0.171

### Paso 1: ✅ Carpeta Creada

Ya está hecha. Tienes la carpeta en:
```
D:\OC_Respaldo
```

### Paso 2: Compartir la Carpeta

1. **Clic derecho** en `D:\OC_Respaldo`

2. **Propiedades**

3. Pestaña **"Compartir"** → Click en **"Uso compartido avanzado"**

4. Marca la casilla **"Compartir esta carpeta"**

5. **IMPORTANTE**: Verifica que el nombre sea exactamente:
   ```
   OC_Respaldo
   ```
   (Sin espacios, sin guiones bajos, exactamente así)

6. Click en **"Permisos"**

7. Agrega **"Todos"** con los siguientes permisos:
   - ✅ Control total
   - ✅ Cambiar
   - ✅ Leer

8. Click en **"Aplicar"** y luego **"Aceptar"**

### Paso 3: Configurar Permisos de Seguridad

1. Aún en **Propiedades** de la carpeta

2. Pestaña **"Seguridad"** → Click en **"Editar"**

3. Click en **"Agregar"**

4. Escribe: `Todos`

5. Click en **"Comprobar nombres"** → **"Aceptar"**

6. Con "Todos" seleccionado, marca los permisos:
   - ✅ Modificar
   - ✅ Lectura y ejecución
   - ✅ Mostrar el contenido de la carpeta
   - ✅ Lectura
   - ✅ Escritura

7. Click en **"Aplicar"** → **"Aceptar"**

### Paso 4: Verificar el Firewall

1. En el equipo 192.168.0.171, abre:
   ```
   Panel de Control → Firewall de Windows → Configuración avanzada
   ```

2. En **"Reglas de entrada"**, busca:
   ```
   Compartir archivos e impresoras
   ```

3. Asegúrate de que las reglas estén **HABILITADAS** (icono verde)

---

## Verificar que Todo Funciona

### Desde ESTE equipo (el servidor):

1. **Ejecuta el script de verificación:**
   - Doble click en: `verificar_conexion.bat`
   - El script te dirá si todo está bien o qué falta

2. **Verificación manual en CMD:**
   ```cmd
   # Ver la carpeta compartida
   dir \\192.168.0.171\OC_Respaldo

   # Crear archivo de prueba
   echo test > \\192.168.0.171\OC_Respaldo\test.txt

   # Listar para verificar
   dir \\192.168.0.171\OC_Respaldo

   # Borrar archivo de prueba
   del \\192.168.0.171\OC_Respaldo\test.txt
   ```

Si todos estos comandos funcionan: **¡Estás listo!**

---

## Iniciar el Sistema

Una vez que la carpeta compartida funcione:

```cmd
npm start
```

Deberías ver en la consola:
```
🌐 Carpeta compartida: ✅ Activa: \\192.168.0.171\OC_Respaldo
```

---

## Probar con un PDF Real

1. Abre el navegador: `http://localhost:3000`

2. Genera un PDF de prueba (ejemplo: template Viviana - Nacional)

3. Revisa la consola del servidor, debe mostrar:
   ```
   📄 PDF guardado localmente en: C:\Users\NICK\...\generated\OC_XXXX.pdf
   ✅ PDF guardado en carpeta compartida: \\192.168.0.171\OC_Respaldo\viviana\OC_XXXX.pdf
   ```

4. **Verifica físicamente:**
   - En este equipo: `C:\Users\NICK\Downloads\oc-web-system\oc-web-system\generated\`
   - En el equipo 192.168.0.171: `C:\OC_Respaldo\viviana\`

Si el PDF aparece en ambos lugares: **¡Todo funciona perfectamente!**

---

## Estructura Final

Cuando generes PDFs, se organizarán así:

**En el equipo de respaldo (192.168.0.171):**
```
D:\OC_Respaldo\
├── viviana\
│   ├── OC_000190.pdf
│   ├── OC_000191.pdf
│   └── OC_000192.pdf
└── camafra\
    ├── OC_000731.pdf
    └── OC_000732.pdf
```

**En este equipo (servidor):**
```
C:\Users\NICK\Downloads\oc-web-system\oc-web-system\generated\
├── OC_000190.pdf
├── OC_000191.pdf
├── OC_000192.pdf
├── OC_000731.pdf
└── OC_000732.pdf
```

---

## Solución de Problemas Comunes

### Error: "Carpeta compartida no encontrada"

**Causa:** La carpeta no está compartida o el nombre es incorrecto

**Solución:**
- Verifica que en el equipo 192.168.0.171 la carpeta esté compartida
- El nombre debe ser EXACTAMENTE: `OC_Respaldo` (sensible a mayúsculas)
- Ejecuta: `net share` en el equipo 192.168.0.171 para ver recursos compartidos

### Error: "Acceso denegado"

**Causa:** Faltan permisos de escritura

**Solución:**
- Revisa los permisos de "Compartir" (Paso 2)
- Revisa los permisos de "Seguridad" (Paso 3)
- Asegúrate de que "Todos" tenga permisos de Modificar

### El PDF se guarda local pero NO en red

**Causa:** Problema de red o permisos

**Solución:**
1. Ejecuta `verificar_conexion.bat` para diagnosticar
2. Revisa la consola del servidor para ver el error específico
3. Verifica el firewall del equipo 192.168.0.171

---

## Comandos Útiles

**Ver recursos compartidos del equipo de respaldo:**
```cmd
net view \\192.168.0.171
```

**Ver tu IP actual:**
```cmd
ipconfig
```

**Probar conectividad:**
```cmd
ping 192.168.0.171
```

**Mapear como unidad de red (alternativa):**
```cmd
net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
```

Luego en `server/config.js` puedes usar:
```javascript
SHARED_FOLDER: 'Z:\\',
```

---

## Ayuda Adicional

Si después de seguir todos los pasos aún no funciona:

1. Ejecuta `verificar_conexion.bat` y copia el resultado
2. Revisa los logs del servidor en la consola
3. Verifica que ambos equipos estén en la misma red (192.168.0.x)
4. Considera usar `net use` para mapear la unidad con credenciales

---

**Última actualización:** 2025-01-20
**Tu configuración:** 192.168.0.171 → C:\OC_Respaldo
