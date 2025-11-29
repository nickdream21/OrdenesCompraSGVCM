@echo off
chcp 65001 >nul
echo ================================================================================
echo CONECTAR AL RESPALDO CON CREDENCIALES
echo ================================================================================
echo.
echo Este script conectará al equipo 192.168.0.171 con credenciales
echo.
echo OPCIÓN 1: Mapear con credenciales guardadas
echo ========================================
echo.

set /p usuario="Ingresa el nombre de usuario del equipo 192.168.0.171 (o presiona ENTER para 'Todos'): "
if "%usuario%"=="" set usuario=

if "%usuario%"=="" (
    echo.
    echo Intentando conectar sin credenciales...
    net use \\192.168.0.171\OC_Respaldo
) else (
    echo.
    echo Ingresa la contraseña del usuario %usuario%
    net use \\192.168.0.171\OC_Respaldo /user:%usuario%
)

echo.
echo ========================================
if %errorlevel% equ 0 (
    echo [✓] Conexión exitosa!
    echo.
    echo Probando acceso...
    dir \\192.168.0.171\OC_Respaldo
    echo.
    echo Probando escritura...
    echo test > \\192.168.0.171\OC_Respaldo\test.txt 2>nul
    if %errorlevel% equ 0 (
        echo [✓] Permisos de escritura OK
        del \\192.168.0.171\OC_Respaldo\test.txt 2>nul
        echo.
        echo ========================================
        echo TODO LISTO - Puedes iniciar el servidor
        echo ========================================
        echo.
        echo Ejecuta: npm start
    ) else (
        echo [✗] No se puede escribir - Revisa permisos
    )
) else (
    echo [✗] Error al conectar
    echo.
    echo POSIBLES PROBLEMAS:
    echo.
    echo 1. El recurso compartido se llama diferente a "OC_Respaldo"
    echo    Verifica el nombre exacto en el equipo 192.168.0.171
    echo    Debe ser exactamente: OC_Respaldo
    echo.
    echo 2. El usuario/contraseña son incorrectos
    echo.
    echo 3. La carpeta no está compartida correctamente
    echo.
    echo ALTERNATIVA: Mapear como unidad de red Z:
    echo ========================================
    echo.
    set /p mapear="¿Quieres intentar mapear como unidad Z:? (S/N): "
    if /i "%mapear%"=="S" (
        echo.
        if "%usuario%"=="" (
            net use Z: \\192.168.0.171\OC_Respaldo /persistent:yes
        ) else (
            net use Z: \\192.168.0.171\OC_Respaldo /user:%usuario% /persistent:yes
        )

        if %errorlevel% equ 0 (
            echo.
            echo [✓] Unidad Z: mapeada correctamente
            echo.
            echo IMPORTANTE: Edita server\config.js y cambia:
            echo     SHARED_FOLDER: 'Z:\\'
            echo.
        )
    )
)

echo.
echo ========================================
pause
