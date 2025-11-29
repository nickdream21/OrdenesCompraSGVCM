@echo off
echo ================================================================================
echo SOLUCION FIRMA SMB - EJECUTAR EN EQUIPO 192.168.0.171 (PRACTICANTES-PC)
echo ================================================================================
echo.
echo Este script deshabilitara el requisito de firma SMB en este equipo
echo para permitir el acceso desde el servidor.
echo.
echo IMPORTANTE: Ejecuta este archivo como ADMINISTRADOR
echo.
pause
echo.

echo Verificando permisos de administrador...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Necesitas ejecutar este script como Administrador
    echo.
    echo Clic derecho en el archivo -^> Ejecutar como administrador
    echo.
    pause
    exit /b 1
)

echo [OK] Ejecutando como Administrador
echo.
echo ================================================================================
echo.

echo [PASO 1] Deshabilitando requisito de firma SMB en el servidor...
echo.

powershell -Command "Set-SmbServerConfiguration -RequireSecuritySignature $False -Force" 2>nul
if %errorlevel% equ 0 (
    echo [OK] Firma SMB deshabilitada correctamente
) else (
    echo [ERROR] No se pudo cambiar la configuracion
    echo Intentando metodo alternativo...

    reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanManServer\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Configuracion cambiada via registro
    ) else (
        echo [ERROR] No se pudo cambiar. Requiere intervencion manual.
    )
)

echo.
echo [PASO 2] Verificando configuracion de uso compartido...
echo.

echo Recursos compartidos actuales:
net share
echo.

net share | findstr /C:"OC_Respaldo" >nul
if %errorlevel% equ 0 (
    echo [OK] OC_Respaldo esta compartido
) else (
    echo [!] OC_Respaldo no encontrado, creandolo...
    net share OC_Respaldo=D:\OC_Respaldo /grant:todos,full
    if %errorlevel% equ 0 (
        echo [OK] Recurso compartido creado
    ) else (
        echo [ERROR] No se pudo crear el recurso compartido
    )
)

echo.
echo [PASO 3] Verificando permisos de la carpeta...
echo.

if exist "D:\OC_Respaldo\" (
    echo [OK] La carpeta D:\OC_Respaldo existe

    echo Asignando permisos de escritura...
    icacls "D:\OC_Respaldo" /grant Todos:(OI)(CI)F /T >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Permisos asignados correctamente
    )
) else (
    echo [ERROR] La carpeta D:\OC_Respaldo NO existe
    echo Creandola...
    mkdir "D:\OC_Respaldo"
    if %errorlevel% equ 0 (
        echo [OK] Carpeta creada
        icacls "D:\OC_Respaldo" /grant Todos:(OI)(CI)F /T >nul 2>&1
    )
)

echo.
echo ================================================================================
echo CONFIGURACION COMPLETADA
echo ================================================================================
echo.
echo Cambios realizados:
echo 1. Requisito de firma SMB: DESHABILITADO
echo 2. Carpeta D:\OC_Respaldo: COMPARTIDA como "OC_Respaldo"
echo 3. Permisos: Todos tienen acceso completo
echo.
echo ================================================================================
echo IMPORTANTE: REINICIA ESTE EQUIPO AHORA
echo ================================================================================
echo.
echo Despues de reiniciar, ve al servidor y ejecuta:
echo     dir \\192.168.0.171\OC_Respaldo
echo.
echo Si funciona, ejecuta:
echo     npm start
echo.
echo ================================================================================
echo.

set /p reiniciar="¿Reiniciar ahora? (S/N): "
if /i "%reiniciar%"=="S" (
    echo.
    echo Reiniciando en 5 segundos...
    timeout /t 5
    shutdown /r /t 0
) else (
    echo.
    echo Recuerda reiniciar manualmente para que los cambios surtan efecto.
    echo.
    pause
)
