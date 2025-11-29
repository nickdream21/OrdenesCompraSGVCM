// ============================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================

module.exports = {
    // Puerto del servidor
    PORT: 3000,

    // Carpeta compartida en red donde se guardarán los PDFs automáticamente
    //
    // CONFIGURACIÓN ACTUAL:
    // - Equipo de respaldo: 192.168.0.171
    // - Carpeta local en ese equipo: D:\OC_Respaldo
    // - Nombre del recurso compartido: OC_Respaldo
    //
    // IMPORTANTE: En el equipo 192.168.0.171 debes:
    // 1. Compartir la carpeta D:\OC_Respaldo con el nombre "OC_Respaldo"
    // 2. Dar permisos de Lectura/Escritura a "Todos" o al usuario específico
    // 3. Configurar permisos de Seguridad (Modificar)
    //
    // Para verificar desde este equipo, ejecuta en CMD:
    //   ping 192.168.0.171
    //   dir \\192.168.0.171\OC_Respaldo
    //   echo test > \\192.168.0.171\OC_Respaldo\test.txt
    //
    SHARED_FOLDER: '\\\\192.168.0.171\\OC_Respaldo',

    // Si quieres usar una subcarpeta por empresa (viviana, camafra, etc.)
    USE_COMPANY_SUBFOLDERS: true,

    // Si quieres organizar por fecha (año/mes)
    USE_DATE_SUBFOLDERS: false
};
