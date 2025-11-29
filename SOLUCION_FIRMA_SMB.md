# SOLUCIÓN: Error de Firma SMB

## El Problema

```
No puedes acceder a esta carpeta compartida porque el equipo está configurado
para requerir la firma SMB. Estas directivas ayudan a proteger el equipo de
dispositivos malintencionados o no seguros en la red.
```

Este es un problema de **políticas de seguridad SMB** entre Windows 11 y versiones anteriores de Windows, o diferentes configuraciones de seguridad.

---

## SOLUCIÓN 1: Habilitar firma SMB en el CLIENTE (Este equipo - RECOMENDADO)

### EN ESTE EQUIPO (el servidor donde corre Node.js):

**Opción A: Usando Editor de Directivas de Grupo (si tienes Windows Pro/Enterprise)**

1. Presiona `Windows + R`
2. Escribe: `gpedit.msc`
3. Enter

4. Navega a:
   ```
   Configuración del equipo
   └── Configuración de Windows
       └── Configuración de seguridad
           └── Directivas locales
               └── Opciones de seguridad
   ```

5. Busca la política:
   ```
   Cliente de redes de Microsoft: Firmar digitalmente las comunicaciones (siempre)
   ```

6. Doble click → Selecciona **"Habilitado"**

7. Click en Aplicar → Aceptar

8. Busca también:
   ```
   Cliente de redes de Microsoft: Firmar digitalmente las comunicaciones (si el servidor lo permite)
   ```

9. Doble click → Selecciona **"Habilitado"**

10. Click en Aplicar → Aceptar

11. Cierra todo y **reinicia el equipo**

---

**Opción B: Usando PowerShell como Administrador (Si no tienes gpedit.msc - Windows Home)**

1. Clic derecho en Inicio → **Windows PowerShell (Administrador)**

2. Ejecuta estos comandos:

```powershell
# Habilitar firma SMB en el cliente
Set-SmbClientConfiguration -RequireSecuritySignature $True -Force

# Verificar configuración
Get-SmbClientConfiguration | Select RequireSecuritySignature
```

3. **Reinicia el equipo** (importante)

Después de reiniciar, prueba:
```cmd
dir \\192.168.0.171\OC_Respaldo
```

---

## SOLUCIÓN 2: Deshabilitar requisito de firma SMB en el SERVIDOR (192.168.0.171)

### EN EL EQUIPO 192.168.0.171 (PRACTICANTES-PC):

**⚠️ ADVERTENCIA:** Esto reduce la seguridad, pero está bien en una red local privada.

**Opción A: Usando Editor de Directivas de Grupo**

1. Presiona `Windows + R`
2. Escribe: `gpedit.msc`
3. Enter

4. Navega a:
   ```
   Configuración del equipo
   └── Configuración de Windows
       └── Configuración de seguridad
           └── Directivas locales
               └── Opciones de seguridad
   ```

5. Busca la política:
   ```
   Servidor de red de Microsoft: Firmar digitalmente las comunicaciones (siempre)
   ```

6. Doble click → Selecciona **"Deshabilitado"**

7. Click en Aplicar → Aceptar

8. **Reinicia el equipo** (importante)

---

**Opción B: Usando PowerShell como Administrador**

1. Abre PowerShell como Administrador en el equipo 192.168.0.171

2. Ejecuta:

```powershell
# Deshabilitar requisito de firma SMB en el servidor
Set-SmbServerConfiguration -RequireSecuritySignature $False -Force

# Verificar configuración
Get-SmbServerConfiguration | Select RequireSecuritySignature
```

3. **Reinicia el equipo**

---

## SOLUCIÓN 3: Mapear con Credenciales (ALTERNATIVA MÁS RÁPIDA)

Si no quieres reiniciar ni cambiar políticas:

### EN ESTE EQUIPO (servidor):

1. Abre CMD como **Administrador**

2. Ejecuta:

```cmd
net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
```

Si pide credenciales, usa el nombre de usuario del equipo 192.168.0.171 (aunque no tenga contraseña, deja la contraseña en blanco).

3. Actualiza `server/config.js`:

```javascript
SHARED_FOLDER: 'Z:\\',
```

4. Reinicia el servidor: `npm start`

---

## SOLUCIÓN 4: Usar SMBv1 (NO RECOMENDADO - Solo como último recurso)

⚠️ **SMBv1 tiene vulnerabilidades de seguridad conocidas. Úsalo solo en entornos aislados.**

### EN EL EQUIPO 192.168.0.171:

1. Abre PowerShell como Administrador

2. Ejecuta:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
```

3. Reinicia

---

## RECOMENDACIÓN

**Usa SOLUCIÓN 2 (Opción B - PowerShell)** en el equipo 192.168.0.171:

Es la más rápida y no requiere navegar por menús:

```powershell
# En el equipo 192.168.0.171, abre PowerShell como Admin y ejecuta:
Set-SmbServerConfiguration -RequireSecuritySignature $False -Force
```

Luego reinicia el equipo 192.168.0.171 y prueba de nuevo.

---

## VERIFICACIÓN

Después de aplicar cualquier solución, desde ESTE equipo ejecuta:

```cmd
# Ver recursos compartidos
net view \\192.168.0.171

# Acceder a la carpeta
dir \\192.168.0.171\OC_Respaldo

# Probar escritura
echo test > \\192.168.0.171\OC_Respaldo\test.txt
del \\192.168.0.171\OC_Respaldo\test.txt
```

Si todos funcionan, reinicia el servidor Node.js:
```cmd
npm start
```

---

## ¿Qué solución elegir?

| Solución | Velocidad | Seguridad | Requiere Reinicio |
|----------|-----------|-----------|-------------------|
| Sol. 1   | Media     | Alta      | Sí (este equipo)  |
| Sol. 2   | Rápida    | Media     | Sí (equipo 192.168.0.171) |
| Sol. 3   | Muy rápida| Alta      | No                |
| Sol. 4   | Media     | Baja      | Sí                |

**Para red local privada:** Usa **SOLUCIÓN 2 o 3**
**Para red corporativa:** Usa **SOLUCIÓN 1**

---

## Script rápido para SOLUCIÓN 2

Copia esto en un archivo `deshabilitar_firma_smb.bat` en el equipo 192.168.0.171:

```batch
@echo off
echo Deshabilitando requisito de firma SMB...
powershell -Command "Set-SmbServerConfiguration -RequireSecuritySignature $False -Force"
echo.
echo Listo! Ahora reinicia el equipo.
pause
```

Ejecuta como Administrador → Reinicia → Listo
