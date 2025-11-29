# SOLUCIÓN: Equipo sin contraseña bloqueando acceso compartido

## El Problema

El equipo **PRACTICANTES-PC** (192.168.0.171) **no tiene contraseña de usuario**.

Windows, por seguridad, **bloquea el acceso compartido de red** a equipos sin contraseña, aunque la carpeta esté compartida correctamente.

Por eso obtienes: `⚠️ Carpeta compartida no encontrada`

---

## SOLUCIÓN 1: Desactivar protección por contraseña (RECOMENDADO - MÁS RÁPIDO)

### EN EL EQUIPO 192.168.0.171 (PRACTICANTES-PC):

**Paso 1: Abrir configuración de uso compartido**

1. Presiona `Windows + R`
2. Escribe: `control.exe /name Microsoft.NetworkAndSharingCenter`
3. Enter

**Paso 2: Cambiar configuración**

1. En el menú izquierdo, click: **"Cambiar configuración de uso compartido avanzado"**

2. Expande cada sección y configura:

   **a) Perfil Privado:**
   - ✓ Activar la detección de redes
   - ✓ Activar el uso compartido de archivos e impresoras
   - ✓ Permitir que Windows administre las conexiones del grupo en el hogar (si aparece)

   **b) Perfil Público (o Invitado):**
   - ✓ Activar la detección de redes
   - ✓ Activar el uso compartido de archivos e impresoras

   **c) Todas las redes:**
   - ✓ Activar el uso compartido para que los usuarios puedan leer y escribir...
   - **IMPORTANTE:** ✓ **Desactivar el uso compartido con protección por contraseña**
   - ✓ Usar cifrado de 128 bits

3. Click en **"Guardar cambios"**

**Paso 3: Verificar el nombre del recurso compartido**

1. Abre CMD en el equipo PRACTICANTES-PC
2. Ejecuta:
   ```cmd
   net share
   ```
3. Busca `OC_Respaldo` en la lista

Si NO aparece, créalo:
```cmd
net share OC_Respaldo=D:\OC_Respaldo /grant:todos,full
```

---

## SOLUCIÓN 2: Crear una contraseña para el usuario (ALTERNATIVA)

Si prefieres mantener la seguridad con contraseña:

### EN EL EQUIPO 192.168.0.171 (PRACTICANTES-PC):

1. Abre CMD como Administrador
2. Ejecuta:
   ```cmd
   net user
   ```
   (Verás el nombre del usuario actual)

3. Asigna una contraseña:
   ```cmd
   net user NOMBRE_USUARIO nuevacontraseña
   ```

### EN ESTE EQUIPO (servidor):

Conecta con credenciales:
```cmd
net use \\192.168.0.171\OC_Respaldo /user:PRACTICANTES-PC\NOMBRE_USUARIO nuevacontraseña /persistent:yes
```

O mapea como unidad:
```cmd
net use Z: \\192.168.0.171\OC_Respaldo /user:PRACTICANTES-PC\NOMBRE_USUARIO nuevacontraseña /persistent:yes
```

Luego actualiza `server/config.js`:
```javascript
SHARED_FOLDER: 'Z:\\',
```

---

## VERIFICACIÓN

### Después de aplicar SOLUCIÓN 1, desde ESTE equipo ejecuta:

```cmd
# 1. Ver recursos compartidos (debería funcionar ahora)
net view \\192.168.0.171

# 2. Acceder a la carpeta
dir \\192.168.0.171\OC_Respaldo

# 3. Probar escritura
echo test > \\192.168.0.171\OC_Respaldo\test.txt
del \\192.168.0.171\OC_Respaldo\test.txt
```

Si todos funcionan: **¡Listo!**

Reinicia el servidor:
```cmd
npm start
```

Deberías ver:
```
✅ PDF guardado en carpeta compartida: \\192.168.0.171\OC_Respaldo\viviana\OC_XXX.pdf
```

---

## RESUMEN RÁPIDO

**El problema:** Windows bloquea carpetas compartidas de equipos sin contraseña

**La solución más rápida:**
1. En PRACTICANTES-PC → Panel de Control → Redes
2. Cambiar configuración de uso compartido avanzado
3. Todas las redes → **Desactivar protección por contraseña**
4. Guardar cambios
5. Reiniciar el servidor: `npm start`

---

## Si persiste el problema

Ejecuta el script: `diagnosticar.bat`

O alternativamente, mapea como unidad Z: (ver SOLUCIÓN 2)

---

**Tiempo estimado:** 2-3 minutos
**Dificultad:** Fácil
**Recomendación:** SOLUCIÓN 1 (más rápido y funciona perfectamente en red local privada)
