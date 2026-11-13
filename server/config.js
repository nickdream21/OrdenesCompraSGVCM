// ============================================================
// CONFIGURACIÓN DEL SERVIDOR LOCAL
// ============================================================
module.exports = {
    PORT: process.env.PORT || 3000,

    // Carpeta compartida en red donde se copia cada PDF generado
    // (estructura: <carpeta>/<empresa>/<año>/<mes>/OC_xxx.pdf).
    // Déjala en '' para desactivarla. También se puede definir con
    // la variable de entorno SHARED_FOLDER en el archivo .env
    SHARED_FOLDER: '\\\\192.168.0.171\\OC_Respaldo'
};
