# Solución: "Carpeta compartida no encontrada"

## El Problema

```
⚠️  Carpeta compartida no encontrada: \\192.168.0.171\OC_Respaldo
```

Este error significa que Windows no puede acceder a la carpeta compartida, aunque esté configurada.

---

## Soluciones Posibles

### SOLUCIÓN 1: Verificar el Nombre del Recurso Compartido (MÁS COMÚN)

El nombre del recurso compartido **debe ser exactamente** `OC_Respaldo`.

**EN EL EQUIPO 192.168.0.171:**

1. Abre CMD o PowerShell
2. Ejecuta:
   ```cmd
   net share
   ```
3. Busca en la lista el nombre del recurso compartido

**Deberías ver algo como:**
```
Nombre de recurso  OC_Respaldo
Ruta               D:\OC_Respaldo
Comentario
```

**Si el nombre es diferente** (por ejemplo: `OC Respaldo` con espacio, o `D$`):
- Opción A: Renombra el recurso compartido a `OC_Respaldo`
- Opción B: Actualiza `server/config.js` con el nombre correcto

---

### SOLUCIÓN 2: Habilitar Acceso de Red sin Contraseña

**EN EL EQUIPO 192.168.0.171:**

1. Abre: `Panel de Control → Redes e Internet → Centro de redes y recursos compartidos`

2. Click en `Cambiar configuración de uso compartido avanzado`

3. En **"Todas las redes"**, busca:
   ```
   Uso compartido con protección por contraseña
   ```

4. Selecciona: **"Desactivar el uso compartido con protección por contraseña"**

5. Click en **"Guardar cambios"**

Esto permite el acceso sin credenciales.

---

### SOLUCIÓN 3: Conectar con Credenciales

Si prefieres mantener la seguridad con contraseña:

**EN ESTE EQUIPO (el servidor):**

1. Ejecuta el script:
   ```cmd
   conectar_respaldo.bat
   ```

2. Ingresa el usuario y contraseña del equipo 192.168.0.171

3. El script conectará y probará el acceso

---

### SOLUCIÓN 4: Mapear como Unidad de Red

Esta es la solución más confiable:

**EN ESTE EQUIPO (el servidor):**

1. Abre CMD como Administrador

2. Ejecuta:
   ```cmd
   net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
   ```

   Si pide credenciales:
   ```cmd
   net use Z: \\192.168.0.171\OC_Respaldo /user:NOMBRE_USUARIO contraseña /persistent:yes
   ```

3. Verifica que funcione:
   ```cmd
   dir Z:
   echo test > Z:\test.txt
   del Z:\test.txt
   ```

4. **Edita `server/config.js`:**
   ```javascript
   SHARED_FOLDER: 'Z:\\',
   ```

5. Reinicia el servidor: `npm start`

---

### SOLUCIÓN 5: Verificar Firewall

**EN EL EQUIPO 192.168.0.171:**

1. Abre: `Panel de Control → Firewall de Windows → Permitir una aplicación`

2. Busca y habilita:
   ```
   ✓ Compartir archivos e impresoras (Privado)
   ✓ Compartir archivos e impresoras (Público)
   ```

3. Si no está habilitado, marca las casillas

---

### SOLUCIÓN 6: Usar la IP Correcta del Equipo de Respaldo

A veces la IP puede haber cambiado.

**EN EL EQUIPO 192.168.0.171:**

1. Abre CMD
2. Ejecuta:
   ```cmd
   ipconfig
   ```
3. Verifica la IP en "Dirección IPv4"

**Si la IP es diferente a 192.168.0.171:**

Actualiza `server/config.js` con la IP correcta.

---

## Diagnóstico Rápido

Ejecuta estos comandos **DESDE ESTE EQUIPO (servidor)** en CMD:

```cmd
# 1. Verificar conectividad
ping 192.168.0.171

# 2. Ver recursos compartidos (puede fallar con "Acceso denegado" si hay contraseña)
net view \\192.168.0.171

# 3. Intentar acceso directo
dir \\192.168.0.171\OC_Respaldo

# 4. Ver conexiones actuales
net use
```

---

## Verificación en el Equipo de Respaldo

**EN EL EQUIPO 192.168.0.171, ejecuta:**

```cmd
# Ver recursos compartidos de este equipo
net share

# Ver permisos de la carpeta
icacls D:\OC_Respaldo

# Verificar que la carpeta existe
dir D:\OC_Respaldo
```

**Deberías ver:**
```
net share → OC_Respaldo    D:\OC_Respaldo
```

---

## Checklist de Configuración

**EN EL EQUIPO 192.168.0.171:**

- [ ] Carpeta `D:\OC_Respaldo` existe
- [ ] Carpeta está compartida
- [ ] Nombre del recurso es exactamente: `OC_Respaldo`
- [ ] Permisos de "Compartir": Todos → Control total
- [ ] Permisos de "Seguridad": Todos → Modificar
- [ ] Firewall permite "Compartir archivos e impresoras"
- [ ] (Opcional) Protección por contraseña desactivada

**EN ESTE EQUIPO (servidor):**

- [ ] Puede hacer ping a 192.168.0.171
- [ ] `server/config.js` tiene la ruta correcta
- [ ] (Si usa credenciales) Conexión establecida con `net use`

---

## Configuración Recomendada Final

La más confiable es mapear como unidad:

1. **Mapear unidad Z:**
   ```cmd
   net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
   ```

2. **Actualizar `server/config.js`:**
   ```javascript
   module.exports = {
       PORT: 3000,
       SHARED_FOLDER: 'Z:\\',
       USE_COMPANY_SUBFOLDERS: true,
       USE_DATE_SUBFOLDERS: false
   };
   ```

3. **Iniciar servidor:**
   ```cmd
   npm start
   ```

Deberías ver:
```
✅ PDF guardado en carpeta compartida: Z:\viviana\OC_XXX.pdf
```

---

## Si Nada Funciona

**Alternativa temporal:** Usar una carpeta local

En `server/config.js`:
```javascript
SHARED_FOLDER: 'C:\\Respaldos\\OC',  // Carpeta local
```

Luego configuras un respaldo manual o sincronización de esta carpeta a 192.168.0.171.

---

## Contacto

Si sigues con problemas:
1. Ejecuta `net share` en 192.168.0.171 y copia el resultado
2. Ejecuta `net view \\192.168.0.171` en este equipo
3. Revisa los logs del servidor para más detalles
