# 🚀 FunnyVault — Guía de Setup (Node.js + Render)

> Sin Apps Script. Sin pagos. 100% gratis con cuenta personal de Google.

---

## Resumen del Stack

```
Frontend (HTML/CSS/JS)
      ↓ POST /api/upload
Backend (Node.js + Express) ← desplegado en Render
      ├── Google Drive API   (guarda la imagen)
      ├── Google Sheets API  (registra en el Sheet)
      └── Gmail SMTP         (envía correos via Nodemailer)
```

---

## PASO 1 — Crear cuenta de servicio de Google (10 min)

Esta es la clave que permite que el servidor acceda a Drive y Sheets sin que tú estés logueado.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo → llámalo `FunnyVault`
3. En el menú lateral: **APIs y Servicios → Biblioteca**
4. Activa estas 2 APIs (búscalas por nombre):
   - ✅ **Google Drive API**
   - ✅ **Google Sheets API**
5. Ve a **APIs y Servicios → Credenciales**
6. Haz clic en **+ Crear credenciales → Cuenta de servicio**
   - Nombre: `funnyvault-server`
   - Haz clic en **Crear y continuar** (omite los pasos opcionales)
7. En la lista de cuentas de servicio, haz clic en la que acabas de crear
8. Ve a la pestaña **Claves → Agregar clave → Crear clave nueva → JSON**
9. Se descargará un archivo `.json` — **guárdalo bien, es tu llave**

> ⚠️ El email de la cuenta de servicio se verá así:
> `funnyvault-server@funnyvault-xxxx.iam.gserviceaccount.com`

---

## PASO 2 — Crear el Google Sheet y compartirlo

1. Ve a [sheets.new](https://sheets.new) → crea una hoja nueva
2. Nómbrala `FunnyVault`
3. **¡Importante!** Comparte la hoja con el email de tu cuenta de servicio:
   - Botón **Compartir** (arriba a la derecha)
   - Pega el email: `funnyvault-server@funnyvault-xxxx.iam.gserviceaccount.com`
   - Rol: **Editor**
   - Desactiva notificaciones → **Listo**
4. Copia el **ID del Sheet** de la URL:
   ```
   https://docs.google.com/spreadsheets/d/ ← ESTE_ES_EL_ID → /edit
   ```

---

## PASO 3 — Configurar Gmail con contraseña de aplicación

1. Ve a tu cuenta de Gmail personal (la que envíará los correos)
2. Activa la **verificación en 2 pasos**: [myaccount.google.com/security](https://myaccount.google.com/security)
3. Ve a **Contraseñas de aplicaciones**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Selecciona:
   - App: `Correo`
   - Dispositivo: `Otro` → escribe `FunnyVault`
5. Copia la contraseña de 16 caracteres que te da (ej: `xxxx xxxx xxxx xxxx`)

---

## PASO 4 — Subir a GitHub

1. Instala Git desde [git-scm.com](https://git-scm.com/download/win)
2. Abre PowerShell en la carpeta del proyecto:
```powershell
cd "C:\Users\Desktop-0296\Desktop\funny-images-platform"
git init
git add .
git commit -m "feat: FunnyVault initial commit"
```
3. Crea un repo en [github.com/new](https://github.com/new) → llámalo `funnyvault`
4. Sigue las instrucciones de GitHub para conectar y hacer push

---

## PASO 5 — Desplegar en Render

1. Ve a [render.com](https://render.com) → **New → Web Service**
2. Conecta tu repo de GitHub (`funnyvault`)
3. Configura:
   | Campo | Valor |
   |---|---|
   | **Root Directory** | `server` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

4. En **Environment Variables**, agrega estas variables:

   | Variable | Valor |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | Todo el contenido del archivo `.json` descargado (en una línea) |
   | `GOOGLE_SHEET_ID` | El ID de tu Sheet del Paso 2 |
   | `SHEET_NAME` | `Submissions` |
   | `DRIVE_FOLDER_NAME` | `FunnyVault - Imágenes` |
   | `GMAIL_USER` | Tu correo Gmail |
   | `GMAIL_APP_PASSWORD` | La contraseña de aplicación del Paso 3 |
   | `ADMIN_KEY` | Una clave secreta (invéntate algo fuerte) |
   | `MIN_RATING` | `7` |

5. Haz clic en **Deploy** → espera ~2 minutos

6. Render te dará una URL como: `https://funnyvault-api.onrender.com`

---

## PASO 6 — ¡Probar!

### Verificar que el servidor está online:
```
https://funnyvault-api.onrender.com/health
```
Deberías ver: `{"status":"ok","service":"FunnyVault API 😂"}`

### Subir imagen de prueba:
- Abre el frontend → llena el formulario → sube una imagen
- Verifica en el Google Sheet que aparece la fila
- Verifica en Google Drive que la imagen está en la carpeta `FunnyVault - Imágenes`

### Calificar una imagen (como admin):
```bash
curl -X POST https://funnyvault-api.onrender.com/api/rate \
  -H "Content-Type: application/json" \
  -d '{"rowId":"FV-1234567890","rating":8,"adminKey":"tu_clave_aqui"}'
```
O usa [Postman](https://postman.com) / [Hoppscotch](https://hoppscotch.io) con:
- **POST** `https://funnyvault-api.onrender.com/api/rate`
- **Body JSON**:
```json
{
  "rowId": "FV-XXXXXXXX",
  "rating": 8,
  "adminKey": "tu_clave_secreta"
}
```

---

## Estructura Final del Proyecto

```
funny-images-platform/
├── index.html           ← Frontend principal
├── style.css            ← Estilos premium
├── app.js               ← Lógica frontend
├── render.yaml          ← Config de despliegue Render
├── .gitignore           ← Excluye secrets y node_modules
├── Code.gs              ← (ya no se usa, referencia)
├── setup_guide.md       ← Esta guía
└── server/
    ├── index.js         ← Backend Express (API)
    ├── package.json     ← Dependencias Node.js
    └── .env.example     ← Plantilla de variables de entorno
```

---

## Flujo completo

```
👤 Usuario sube imagen en el frontend
      ↓ POST /api/upload (multipart/form-data)
🖥️  Servidor Express (Render)
      ├── Guarda imagen en 📁 Google Drive
      ├── Registra en 📊 Google Sheets (estado: Pendiente)
      └── Responde ✅ al frontend

👨‍💼 Admin abre el Google Sheet
      └── Encuentra el ID de la fila (ej: FV-1234567890)
            ↓ POST /api/rate (con adminKey)
🖥️  Servidor Express
      ├── Busca la fila por ID
      ├── Actualiza calificación y estado en el Sheet
      └── Si rating >= 7 → 📧 Envía correo al usuario via Gmail
```

---

*FunnyVault 😂 — Sin Apps Script, sin dramas.*
