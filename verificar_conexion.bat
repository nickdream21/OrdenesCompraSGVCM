@echo off
chcp 65001 >nul
echo ========================================
echo VERIFICACIÓN DE CONEXIÓN AL RESPALDO
echo ========================================
echo.
echo Configuración actual:
echo - Equipo de respaldo: 192.168.0.171
echo - Carpeta en respaldo: D:\OC_Respaldo
echo - Recurso compartido: \\192.168.0.171\OC_Respaldo
echo.
echo ========================================
echo.

echo [PASO 1] Probando conectividad de red...
ping -n 2 192.168.0.171 | findstr /C:"bytes=" >nul
if %errorlevel% equ 0 (
    echo [✓] Ping exitoso - Equipo accesible
) else (
    echo [✗] Error de ping - Equipo no accesible
    echo     Verifica que ambos equipos estén en la misma red
    goto fin
)
echo.

echo [PASO 2] Intentando listar recursos compartidos...
net view \\192.168.0.171 >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Recursos compartidos accesibles
    echo.
    echo Recursos disponibles:
    net view \\192.168.0.171
) else (
    echo [✗] No se pueden listar recursos (Error de autenticación)
    echo     Esto es normal si hay credenciales configuradas
)
echo.

echo [PASO 3] Verificando acceso a \\192.168.0.171\OC_Respaldo...
dir \\192.168.0.171\OC_Respaldo >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Carpeta compartida accesible
    echo.
    dir \\192.168.0.171\OC_Respaldo
    echo.

    echo [PASO 4] Probando permisos de escritura...
    echo test_conexion > \\192.168.0.171\OC_Respaldo\test.txt 2>nul
    if %errorlevel% equ 0 (
        echo [✓] Permisos de escritura OK
        del \\192.168.0.171\OC_Respaldo\test.txt 2>nul
        echo.
        echo ========================================
        echo [✓✓✓] TODO CONFIGURADO CORRECTAMENTE
        echo ========================================
        echo.
        echo El sistema está listo para usar.
        echo Ejecuta: npm start
    ) else (
        echo [✗] No se puede escribir
        echo.
        echo SOLUCIÓN en el equipo 192.168.0.171:
        echo - Propiedades de D:\OC_Respaldo
        echo - Compartir → Permisos → "Todos" con Control total
        echo - Seguridad → "Todos" con Modificar
    )
) else (
    echo [✗] No se puede acceder a la carpeta compartida
    echo.
    echo ========================================
    echo INSTRUCCIONES PARA CONFIGURAR
    echo ========================================
    echo.
    echo EN EL EQUIPO 192.168.0.171:
    echo.
    echo 1. Abrir Explorador de archivos
    echo    Ir a: D:\OC_Respaldo
    echo.
    echo 2. Clic derecho en OC_Respaldo → Propiedades
    echo.
    echo 3. Pestaña COMPARTIR:
    echo    - Click "Uso compartido avanzado"
    echo    - Marcar "Compartir esta carpeta"
    echo    - Nombre del recurso: OC_Respaldo
    echo    - Click "Permisos"
    echo    - Agregar "Todos"
    echo    - Permisos: Control total ✓
    echo    - Click Aplicar
    echo.
    echo 4. Pestaña SEGURIDAD:
    echo    - Click "Editar"
    echo    - Click "Agregar"
    echo    - Escribir: Todos
    echo    - Click "Comprobar nombres"
    echo    - Click Aceptar
    echo    - Marcar: Modificar ✓
    echo    - Click Aplicar
    echo.
    echo 5. Click Aceptar en todo
    echo.
    echo 6. Ejecutar este script nuevamente
    echo.
)

:fin
echo.
echo ========================================
pause
