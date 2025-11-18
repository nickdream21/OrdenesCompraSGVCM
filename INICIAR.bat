@echo off
echo ================================================================
echo    SISTEMA DE ORDENES DE COMPRA - INICIO
echo ================================================================
echo.

REM Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado!
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    echo Descarga la version LTS ^(recomendada^)
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado: 
node --version
echo.

REM Verificar si node_modules existe
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias por primera vez...
    echo Esto puede tomar unos minutos...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Error al instalar dependencias
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas correctamente
    echo.
)

echo ================================================================
echo    INICIANDO SERVIDOR...
echo ================================================================
echo.
echo El navegador se abrira automaticamente en unos segundos
echo.
echo Para detener el servidor, presiona Ctrl+C
echo.
echo ================================================================

REM Esperar 2 segundos y abrir el navegador
timeout /t 2 /nobreak >nul
start http://localhost:3000

REM Iniciar el servidor
npm start
