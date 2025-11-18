# 🚀 INICIO RÁPIDO

## ⚡ 3 Pasos para Empezar

### 1️⃣ Instalar Node.js (solo la primera vez)

Si aún no tienes Node.js:
- Ve a: https://nodejs.org/
- Descarga la versión **LTS** (recomendada)
- Instala siguiendo el asistente
- Reinicia tu computadora

### 2️⃣ Instalar el Sistema (solo la primera vez)

**Opción A - Doble Clic (Windows):**
- Haz doble clic en `INICIAR.bat`
- Instalará todo automáticamente

**Opción B - Manual:**
```bash
# Abre la terminal en esta carpeta y ejecuta:
npm install
```

### 3️⃣ Iniciar el Sistema

**Windows:**
- Doble clic en `INICIAR.bat`

**macOS/Linux o Manual:**
```bash
npm start
```

Abre tu navegador en: **http://localhost:3000**

---

## 📝 Uso Básico

### Generar tu Primera Orden de Compra

1. **Selecciona un Template**
   - Haz clic en una de las tarjetas de template
   - Por ejemplo: "Orden de Compra - Importación"

2. **Completa el Formulario**
   - Número de OC (ej: 000123)
   - Fecha (ej: 10 de Noviembre de 2025)
   - Proveedor, RUC, dirección
   - Agrega items haciendo clic en "Agregar Item"

3. **Genera el PDF**
   - Haz clic en "Generar PDF"
   - Se descargará automáticamente

---

## 🎨 Personalizar un Template

### Agregar/Modificar Campos

1. Ve a "Editor de Templates"
2. Edita un template existente o crea uno nuevo
3. Los campos se definen en el comentario de CONFIG:

```javascript
<%# CONFIG: {
  "displayName": "Mi Template",
  "fields": [
    {
      "name": "mi_campo",
      "label": "Mi Campo",
      "type": "text",
      "required": true
    }
  ]
} %>
```

### Tipos de Campo:

- `"type": "text"` - Texto simple
- `"type": "textarea"` - Texto largo
- `"type": "number"` - Números
- `"type": "date"` - Fechas
- `"type": "select"` - Lista desplegable
  ```javascript
  {
    "name": "moneda",
    "type": "select",
    "options": ["USD", "S/.", "EUR"]
  }
  ```
- `"type": "array"` - Para tablas de items
  ```javascript
  {
    "name": "items",
    "type": "array",
    "fields": [
      {"name": "cantidad", "type": "number"},
      {"name": "descripcion", "type": "text"}
    ]
  }
  ```

---

## 💡 Tips Rápidos

### Usar Variables en el HTML

```html
<!-- Mostrar un valor -->
<p>Cliente: <%= cliente %></p>

<!-- Formatear moneda -->
<p>Total: <%= formatCurrency(total, 'S/.') %></p>

<!-- Formatear fecha -->
<p>Fecha: <%= moment(fecha).format('DD/MM/YYYY') %></p>
```

### Hacer Cálculos

```javascript
<% 
let total = 0;
items.forEach(item => {
  total += item.cantidad * item.precio;
});
%>

<p>Total: <%= formatCurrency(total, 'S/.') %></p>
```

### Agregar Tablas

```html
<table>
  <thead>
    <tr>
      <th>Producto</th>
      <th>Cantidad</th>
      <th>Precio</th>
    </tr>
  </thead>
  <tbody>
    <% items.forEach(item => { %>
    <tr>
      <td><%= item.producto %></td>
      <td><%= item.cantidad %></td>
      <td><%= formatCurrency(item.precio, 'S/.') %></td>
    </tr>
    <% }); %>
  </tbody>
</table>
```

---

## ❓ Problemas Comunes

### "No se puede iniciar el servidor"
- Verifica que Node.js esté instalado: `node --version`
- Asegúrate de estar en la carpeta correcta
- Ejecuta: `npm install` de nuevo

### "El PDF no se genera"
- Revisa que todos los campos obligatorios estén llenos
- Mira la consola del navegador (presiona F12)
- Revisa los logs en la terminal

### "No veo mis templates"
- Asegúrate de que el archivo termine en `.ejs`
- Verifica que esté en la carpeta `templates/`
- Recarga la página (F5)

### Cambiar el Puerto

Si el puerto 3000 está ocupado, edita `server/app.js`:
```javascript
const PORT = 3001; // Cambia a otro puerto
```

---

## 🆘 Necesitas Ayuda?

1. Lee el `README.md` completo
2. Verifica la consola del navegador (F12)
3. Mira los mensajes en la terminal

---

## 📂 Archivos Importantes

```
INICIAR.bat          ← Doble clic para iniciar (Windows)
README.md            ← Documentación completa
server/app.js        ← Servidor (aquí cambias el puerto)
public/index.html    ← Interfaz web
templates/           ← Tus templates aquí
generated/           ← PDFs generados se guardan aquí
```

---

## ✅ Checklist de Instalación

- [ ] Node.js instalado
- [ ] Ejecuté `npm install` o doble clic en `INICIAR.bat`
- [ ] Abrí http://localhost:3000
- [ ] Generé mi primera orden de compra
- [ ] Revisé el historial de PDFs
- [ ] Exploré el editor de templates

---

**¡Listo para usar!** 🎉

Si todo funciona correctamente, ya puedes empezar a generar órdenes de compra profesionales.

Para uso avanzado, consulta el `README.md` completo.
