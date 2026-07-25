// ============================================================
//  FunnyVault — Code.gs (Google Apps Script)
//  Pega este código en: script.google.com
// ============================================================

// ──────────────────────────────────────────────
//  CONFIGURACIÓN — Edita estos valores
// ──────────────────────────────────────────────
const CONFIG = {
  // Nombre de la hoja de cálculo (el tab dentro del Sheet)
  SHEET_NAME: 'Submissions',

  // Nombre de la carpeta en Google Drive donde se guardan las imágenes
  DRIVE_FOLDER_NAME: 'FunnyVault - Imágenes',

  // Calificación mínima para enviar el correo de notificación (1-10)
  MIN_RATING_TO_NOTIFY: 7,

  // Columnas del Google Sheet (índice base 1)
  COL: {
    ID:             1,   // A
    NAME:           2,   // B
    EMAIL:          3,   // C
    DRIVE_URL:      4,   // D
    FILE_NAME:      5,   // E
    DATE:           6,   // F
    RATING:         7,   // G
    STATUS:         8,   // H
    EMAIL_SENT:     9,   // I
  },
};

// ──────────────────────────────────────────────
//  doPost — Punto de entrada del Web App
//  Recibe la imagen en base64 + metadatos
// ──────────────────────────────────────────────
function doPost(e) {
  try {
    // Parsear payload JSON
    const data = JSON.parse(e.postData.contents);
    const { name, email, fileName, mimeType, imageBase64 } = data;

    // Validaciones básicas
    if (!name || !email || !imageBase64 || !mimeType) {
      return buildResponse(false, 'Faltan campos obligatorios.');
    }

    // 1. Subir imagen a Google Drive
    const driveUrl = saveImageToDrive(imageBase64, mimeType, fileName, name);

    // 2. Registrar en Google Sheets
    const rowId = appendToSheet(name, email, driveUrl, fileName);

    // 3. Respuesta de éxito al frontend
    return buildResponse(true, '¡Imagen recibida correctamente!', {
      driveUrl,
      rowId,
    });

  } catch (err) {
    Logger.log('Error en doPost: ' + err.toString());
    return buildResponse(false, 'Error interno del servidor: ' + err.message);
  }
}

// ──────────────────────────────────────────────
//  doGet — Para verificar que el script funciona
// ──────────────────────────────────────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'FunnyVault API online 😂' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────
//  saveImageToDrive — Guarda la imagen en Drive
// ──────────────────────────────────────────────
function saveImageToDrive(base64Data, mimeType, originalFileName, submitterName) {
  // Obtener o crear carpeta
  const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);

  // Decodificar base64
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    originalFileName || 'imagen.jpg'
  );

  // Crear archivo en Drive
  const file = folder.createFile(blob);

  // Hacer el archivo accesible con link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

// ──────────────────────────────────────────────
//  getOrCreateFolder — Obtiene/crea carpeta Drive
// ──────────────────────────────────────────────
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ──────────────────────────────────────────────
//  appendToSheet — Agrega fila al Google Sheet
// ──────────────────────────────────────────────
function appendToSheet(name, email, driveUrl, fileName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    createSheetHeaders(sheet);
  }

  // Generar ID único
  const rowId = 'FV-' + Date.now();
  const now = new Date();

  // Añadir fila
  sheet.appendRow([
    rowId,                          // A: ID
    name,                           // B: Nombre
    email,                          // C: Email
    driveUrl,                       // D: URL Drive
    fileName,                       // E: Nombre archivo
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), // F: Fecha
    '',                             // G: Calificación (la pone el admin)
    '⏳ Pendiente',                 // H: Estado
    'No',                           // I: Correo enviado
  ]);

  return rowId;
}

// ──────────────────────────────────────────────
//  createSheetHeaders — Crea encabezados
// ──────────────────────────────────────────────
function createSheetHeaders(sheet) {
  const headers = ['ID', 'Nombre', 'Email', 'URL Drive', 'Archivo', 'Fecha Envío', 'Calificación', 'Estado', 'Correo Enviado'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Estilos para encabezados
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a1a2e');
  headerRange.setFontColor('#a855f7');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);

  // Congelar primera fila
  sheet.setFrozenRows(1);

  // Ajustar anchos de columna
  sheet.setColumnWidth(1, 140);  // ID
  sheet.setColumnWidth(2, 150);  // Nombre
  sheet.setColumnWidth(3, 200);  // Email
  sheet.setColumnWidth(4, 300);  // URL Drive
  sheet.setColumnWidth(5, 180);  // Archivo
  sheet.setColumnWidth(6, 160);  // Fecha
  sheet.setColumnWidth(7, 100);  // Calificación
  sheet.setColumnWidth(8, 120);  // Estado
  sheet.setColumnWidth(9, 120);  // Correo enviado
}

// ──────────────────────────────────────────────
//  onEdit — TRIGGER: detecta cambio de calificación
//  El admin escribe la calificación en col G
//  → Si >= MIN_RATING_TO_NOTIFY, envía correo
// ──────────────────────────────────────────────
function onEdit(e) {
  const sheet = e.source.getActiveSheet();

  // Solo actuar en la hoja correcta
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  const editedRow = e.range.getRow();
  const editedCol = e.range.getColumn();

  // Solo actuar si se editó la columna de Calificación (G = col 7)
  if (editedCol !== CONFIG.COL.RATING) return;
  if (editedRow <= 1) return; // Ignorar encabezado

  const rating = parseFloat(e.value);

  // Verificar que sea un número válido entre 1 y 10
  if (isNaN(rating) || rating < 1 || rating > 10) {
    SpreadsheetApp.getUi().alert('⚠️ La calificación debe ser un número entre 1 y 10.');
    e.range.clearContent();
    return;
  }

  // Leer datos de la fila
  const rowData = sheet.getRange(editedRow, 1, 1, 9).getValues()[0];
  const name      = rowData[CONFIG.COL.NAME - 1];
  const email     = rowData[CONFIG.COL.EMAIL - 1];
  const driveUrl  = rowData[CONFIG.COL.DRIVE_URL - 1];
  const emailSent = rowData[CONFIG.COL.EMAIL_SENT - 1];

  // No enviar correo dos veces
  if (emailSent === 'Sí') {
    Logger.log('Correo ya enviado para fila ' + editedRow);
    return;
  }

  // Actualizar Estado en el Sheet
  const statusCell = sheet.getRange(editedRow, CONFIG.COL.STATUS);
  if (rating >= CONFIG.MIN_RATING_TO_NOTIFY) {
    statusCell.setValue('✅ Aprobado');
    statusCell.setBackground('#0d2818');
    statusCell.setFontColor('#4ade80');

    // Enviar correo de notificación
    sendRatingEmail(email, name, rating, driveUrl);

    // Marcar como enviado
    sheet.getRange(editedRow, CONFIG.COL.EMAIL_SENT).setValue('Sí');
  } else {
    statusCell.setValue('❌ No aprobado');
    statusCell.setBackground('#2a0a0a');
    statusCell.setFontColor('#f87171');
    sheet.getRange(editedRow, CONFIG.COL.EMAIL_SENT).setValue('N/A');
  }

  // Colorear la fila de calificación
  sheet.getRange(editedRow, CONFIG.COL.RATING)
    .setBackground(rating >= CONFIG.MIN_RATING_TO_NOTIFY ? '#0d2818' : '#2a0a0a')
    .setFontColor(rating >= CONFIG.MIN_RATING_TO_NOTIFY ? '#4ade80' : '#f87171')
    .setFontWeight('bold');
}

// ──────────────────────────────────────────────
//  sendRatingEmail — Envía el correo al usuario
// ──────────────────────────────────────────────
function sendRatingEmail(email, name, rating, driveUrl) {
  const subject = `😂 ¡Tu imagen obtuvo ${rating}/10 en FunnyVault!`;

  const starsHtml = getStarsHtml(rating);
  const medal     = getMedalEmoji(rating);
  const rankLabel = getRankLabel(rating);

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>
        body { margin: 0; padding: 0; background: #0b0d14; font-family: 'Segoe UI', Arial, sans-serif; }
        .wrapper { max-width: 580px; margin: 0 auto; padding: 40px 20px; }
        .card {
          background: linear-gradient(135deg, #131525 0%, #1a1030 100%);
          border: 1px solid rgba(168,85,247,0.2);
          border-radius: 20px;
          overflow: hidden;
        }
        .header-bar {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          padding: 32px 40px;
          text-align: center;
        }
        .header-emoji { font-size: 56px; display: block; margin-bottom: 8px; }
        .header-title { font-size: 26px; font-weight: 800; color: #fff; margin: 0; }
        .body { padding: 36px 40px; }
        .greeting { font-size: 22px; font-weight: 700; color: #f0f0f8; margin-bottom: 8px; }
        .intro { font-size: 15px; color: rgba(240,240,248,0.65); line-height: 1.7; margin-bottom: 28px; }
        .rating-box {
          background: rgba(168,85,247,0.1);
          border: 1px solid rgba(168,85,247,0.25);
          border-radius: 16px;
          padding: 28px;
          text-align: center;
          margin-bottom: 28px;
        }
        .rating-medal { font-size: 48px; margin-bottom: 8px; }
        .rating-score {
          font-size: 72px;
          font-weight: 900;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1;
          margin-bottom: 4px;
        }
        .rating-max { font-size: 14px; color: rgba(240,240,248,0.4); margin-bottom: 12px; }
        .rating-stars { font-size: 24px; margin-bottom: 8px; }
        .rating-label {
          display: inline-block;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 5px 16px;
          border-radius: 20px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .cta-btn {
          display: block;
          text-align: center;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: #fff !important;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 28px;
        }
        .footer-note { font-size: 13px; color: rgba(240,240,248,0.35); text-align: center; line-height: 1.6; }
        .footer-note a { color: rgba(168,85,247,0.7); }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header-bar">
            <span class="header-emoji">😂</span>
            <h1 class="header-title">¡Resultado de FunnyVault!</h1>
          </div>
          <div class="body">
            <p class="greeting">¡Hola, ${name}! 👋</p>
            <p class="intro">
              Nuestro equipo de expertos en humor ha revisado tu imagen y aquí está el veredicto oficial. ¡Gracias por participar!
            </p>
            <div class="rating-box">
              <div class="rating-medal">${medal}</div>
              <div class="rating-score">${rating}</div>
              <div class="rating-max">de 10 puntos</div>
              <div class="rating-stars">${starsHtml}</div>
              <span class="rating-label">${rankLabel}</span>
            </div>
            <a href="${driveUrl}" class="cta-btn">
              🖼️ Ver tu imagen en Google Drive
            </a>
            <p class="footer-note">
              Este correo fue generado automáticamente por FunnyVault 😂<br/>
              ¿Quieres intentarlo de nuevo? Visita nuestra plataforma.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody =
    `¡Hola ${name}!\n\n` +
    `Tu imagen en FunnyVault ha sido calificada.\n\n` +
    `⭐ Calificación: ${rating}/10 — ${rankLabel}\n\n` +
    `Ver imagen: ${driveUrl}\n\n` +
    `— Equipo FunnyVault 😂`;

  GmailApp.sendEmail(email, subject, textBody, { htmlBody });
  Logger.log(`Correo enviado a ${email} con calificación ${rating}`);
}

// ──────────────────────────────────────────────
//  Helpers de calificación
// ──────────────────────────────────────────────
function getStarsHtml(rating) {
  const full  = Math.floor(rating);
  const empty = 10 - full;
  return '⭐'.repeat(full) + '☆'.repeat(empty);
}

function getMedalEmoji(rating) {
  if (rating >= 10) return '👑';
  if (rating >= 9)  return '🥇';
  if (rating >= 8)  return '🥈';
  if (rating >= 7)  return '🥉';
  return '😅';
}

function getRankLabel(rating) {
  if (rating >= 10) return '¡LEYENDA DEL HUMOR!';
  if (rating >= 9)  return 'Maestro del Humor';
  if (rating >= 8)  return 'Muy gracioso';
  if (rating >= 7)  return 'Gracioso';
  if (rating >= 5)  return 'Tiene potencial';
  return 'Sigue intentando';
}

// ──────────────────────────────────────────────
//  buildResponse — Construye la respuesta JSON
// ──────────────────────────────────────────────
function buildResponse(success, message, extra) {
  const payload = { success, message, ...extra };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────
//  setupTrigger — Crea el trigger de onEdit
//  Ejecuta esta función UNA VEZ manualmente
// ──────────────────────────────────────────────
function setupTrigger() {
  // Eliminar triggers existentes para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Crear trigger instalable (más confiable que el simple onEdit)
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log('✅ Trigger de onEdit configurado correctamente.');
  SpreadsheetApp.getUi().alert('✅ Trigger configurado. El sistema enviará correos automáticamente al calificar.');
}
