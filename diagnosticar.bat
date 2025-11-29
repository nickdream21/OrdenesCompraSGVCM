@echo off
chcp 65001 >nul
cls
echo ================================================================================
echo DIAGNÓSTICO DE CONEXIÓN AL RESPALDO
echo ================================================================================
echo.
echo Equipo de respaldo: 192.168.0.171
echo Recurso esperado: \\192.168.0.171\OC_Respaldo
echo.
echo ================================================================================
echo.

echo [PASO 1] Verificando conectividad de red...
echo.
ping -n 2 192.168.0.171 | find "bytes=" >nul
if %errorlevel% equ 0 (
    echo [✓] Ping OK - El equipo responde
) else (
    echo [✗] Ping FALLO - El equipo no responde
    echo     Verifica que 192.168.0.171 esté encendido y en la red
    goto fin
)
echo.
echo ================================================================================
echo.

echo [PASO 2] Intentando listar recursos compartidos...
echo.
echo Ejecutando: net view \\192.168.0.171
echo.

net view \\192.168.0.171 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [✓] Recursos compartidos visibles
    echo.
    echo IMPORTANTE: Copia el nombre EXACTO del recurso compartido que aparece arriba
    echo y úsalo en server/config.js
) else (
    echo [✗] No se pueden ver recursos (Error: Acceso denegado o sin recursos)
    echo.
    echo Esto puede significar:
    echo 1. El equipo requiere autenticación (usuario/contraseña)
    echo 2. No hay recursos compartidos configurados
    echo 3. El firewall está bloqueando
)
echo.
echo ================================================================================
echo.

echo [PASO 3] Intentando acceso directo a \\192.168.0.171\OC_Respaldo...
echo.

dir \\192.168.0.171\OC_Respaldo >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] ACCESO EXITOSO!
    echo.
    dir \\192.168.0.171\OC_Respaldo
    echo.
    echo [PASO 4] Probando permisos de escritura...
    echo test > \\192.168.0.171\OC_Respaldo\test_diagnostico.txt 2>nul
    if %errorlevel% equ 0 (
        echo [✓] ESCRITURA OK - Todo funciona!
        del \\192.168.0.171\OC_Respaldo\test_diagnostico.txt 2>nul
        echo.
        echo ========================================
        echo TODO ESTÁ BIEN CONFIGURADO
        echo ========================================
        echo.
        echo El problema puede ser:
        echo 1. Node.js necesita permisos de administrador
        echo 2. Reinicia el servidor: npm start
    ) else (
        echo [✗] No se puede escribir
        echo.
        echo SOLUCIÓN en 192.168.0.171:
        echo - Propiedades de D:\OC_Respaldo
        echo - Seguridad → "Todos" → Modificar ✓
    )
) else (
    echo [✗] NO SE PUEDE ACCEDER
    echo.
    echo ========================================
    echo PROBLEMA DETECTADO
    echo ========================================
    echo.
    echo El recurso \\192.168.0.171\OC_Respaldo no es accesible
    echo.
    echo POSIBLES CAUSAS:
    echo.
    echo 1. EL NOMBRE DEL RECURSO ES DIFERENTE
    echo    - Puede ser "D$" o "OC Respaldo" (con espacio) o algo más
    echo    - Revisa el resultado del PASO 2 arriba
    echo.
    echo 2. LA CARPETA NO ESTÁ COMPARTIDA
    echo    EN el equipo 192.168.0.171, ejecuta:
    echo        net share
    echo    Debe aparecer: OC_Respaldo
    echo.
    echo 3. REQUIERE CREDENCIALES
    echo    Ejecuta: conectar_respaldo.bat
    echo.
    echo ========================================
    echo SOLUCIÓN RECOMENDADA: Mapear unidad Z:
    echo ========================================
    echo.
    set /p mapear="¿Intentar mapear como unidad Z:? (S/N): "
    if /i "%mapear%"=="S" (
        echo.
        echo Ingresa usuario del equipo 192.168.0.171 (o presiona ENTER para sin usuario):
        set /p user="> "

        if "%user%"=="" (
            echo.
            echo Intentando sin credenciales...
            net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
        ) else (
            echo.
            echo Intentando con usuario %user%...
            net use Z: \\192.168.0.171\OC_Respaldo /user:%user% /persistent:yes
        )

        if %errorlevel% equ 0 (
            echo.
            echo [✓] Unidad Z: mapeada!
            echo.
            dir Z:
            echo.
            echo ========================================
            echo AHORA EDITA server\config.js:
            echo ========================================
            echo.
            echo Cambia esta línea:
            echo     SHARED_FOLDER: '\\\\192.168.0.171\\OC_Respaldo',
            echo.
            echo Por esta:
            echo     SHARED_FOLDER: 'Z:\\',
            echo.
            echo Luego reinicia: npm start
            echo ========================================
        ) else (
            echo [✗] Error al mapear unidad
            echo.
            echo Revisa:
            echo 1. El nombre del recurso compartido
            echo 2. Usuario/contraseña correctos
            echo 3. Que la carpeta esté compartida
        )
    )
)

:fin
echo.
echo ================================================================================
echo.
echo COMANDOS ÚTILES PARA EL EQUIPO 192.168.0.171:
echo.
echo Ver recursos compartidos:
echo     net share
echo.
echo Compartir la carpeta (si no está):
echo     net share OC_Respaldo=D:\OC_Respaldo /grant:todos,full
echo.
echo ================================================================================
echo.
pause
