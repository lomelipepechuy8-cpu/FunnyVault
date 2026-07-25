/* ============================================================
   FunnyVault — app.js
   Lógica de frontend: multi-step form, drag & drop,
   conversión base64, envío al Google Apps Script.
   ============================================================ */

// ─── CONFIGURACIÓN ────────────────────────────────────────────
// Google Apps Script desplegado
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1zR_0BFXREQI6xIY7hVz2XQlg_4gWhm_jwPzVmH83Q5AdbORdKYVjnXZbsQKCOB34/exec';
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ─── ESTADO ───────────────────────────────────────────────────
const state = {
  currentStep: 1,
  name: '',
  email: '',
  file: null,
  fileDataUrl: null,
};

// ─── ELEMENTOS DOM ────────────────────────────────────────────
const els = {
  form: document.getElementById('upload-form'),
  // Steps
  step1: document.getElementById('step-1'),
  step2: document.getElementById('step-2'),
  step3: document.getElementById('step-3'),
  stepDiv1: document.querySelectorAll('.step-divider')[0],
  stepDiv2: document.querySelectorAll('.step-divider')[1],
  // Form steps
  formStep1: document.getElementById('form-step-1'),
  formStep2: document.getElementById('form-step-2'),
  formStep3: document.getElementById('form-step-3'),
  // Fields
  inputName: document.getElementById('input-name'),
  inputEmail: document.getElementById('input-email'),
  errorName: document.getElementById('error-name'),
  errorEmail: document.getElementById('error-email'),
  errorImage: document.getElementById('error-image'),
  // Buttons step 1
  btnNext1: document.getElementById('btn-next-1'),
  // Buttons step 2
  btnBack1: document.getElementById('btn-back-1'),
  btnNext2: document.getElementById('btn-next-2'),
  btnSelectFile: document.getElementById('btn-select-file'),
  btnRemoveImage: document.getElementById('btn-remove-image'),
  // Buttons step 3
  btnBack2: document.getElementById('btn-back-2'),
  btnSubmit: document.getElementById('btn-submit'),
  btnText: document.querySelector('.btn-text'),
  btnSpinner: document.getElementById('submit-spinner'),
  // Drop zone
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  dropDefault: document.getElementById('drop-default'),
  dropPreview: document.getElementById('drop-preview'),
  previewImg: document.getElementById('preview-img'),
  previewName: document.getElementById('preview-name'),
  // Summary
  summaryImg: document.getElementById('summary-img'),
  summaryName: document.getElementById('summary-name'),
  summaryEmail: document.getElementById('summary-email'),
  summaryFile: document.getElementById('summary-file'),
  // States
  uploadCard: document.getElementById('upload-card'),
  successState: document.getElementById('success-state'),
  errorState: document.getElementById('error-state'),
  successEmailDisplay: document.getElementById('success-email-display'),
  successMeta: document.getElementById('success-meta'),
  errorMsgText: document.getElementById('error-msg-text'),
  // Final buttons
  btnUploadAnother: document.getElementById('btn-upload-another'),
  btnRetry: document.getElementById('btn-retry'),
};

// ─── INICIALIZACIÓN ───────────────────────────────────────────
function init() {
  spawnParticles();
  attachEventListeners();
}

// ─── PARTÍCULAS DE FONDO ──────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('particles');
  const count = 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --dur: ${Math.random() * 10 + 8}s;
      --delay: ${Math.random() * 8}s;
    `;
    container.appendChild(p);
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {
  // Step navigation
  els.btnNext1.addEventListener('click', handleNext1);
  els.btnNext2.addEventListener('click', handleNext2);
  els.btnBack1.addEventListener('click', () => goToStep(1));
  els.btnBack2.addEventListener('click', () => goToStep(2));

  // File selection
  els.btnSelectFile.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-remove') && !state.file) els.fileInput.click();
  });
  els.dropZone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.file) {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener('change', () => handleFileSelected(els.fileInput.files[0]));
  els.btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  // Drag & drop
  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  // Form submit
  els.form.addEventListener('submit', handleSubmit);

  // Post-states
  els.btnUploadAnother.addEventListener('click', resetAll);
  els.btnRetry.addEventListener('click', resetAll);

  // Live validation
  els.inputName.addEventListener('input', () => clearFieldError('name'));
  els.inputEmail.addEventListener('input', () => clearFieldError('email'));
}

// ─── VALIDACIÓN ───────────────────────────────────────────────
function validateStep1() {
  let valid = true;
  const name = els.inputName.value.trim();
  const email = els.inputEmail.value.trim();

  if (!name) {
    setFieldError('name', 'Por favor ingresa tu nombre');
    valid = false;
  } else if (name.length < 2) {
    setFieldError('name', 'El nombre debe tener al menos 2 caracteres');
    valid = false;
  } else {
    clearFieldError('name');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    setFieldError('email', 'Por favor ingresa tu correo electrónico');
    valid = false;
  } else if (!emailRegex.test(email)) {
    setFieldError('email', 'Ingresa un correo electrónico válido');
    valid = false;
  } else {
    clearFieldError('email');
  }

  return valid;
}

function setFieldError(field, msg) {
  const inputEl = field === 'name' ? els.inputName : els.inputEmail;
  const errEl = field === 'name' ? els.errorName : els.errorEmail;
  inputEl.classList.add('has-error');
  errEl.textContent = msg;
}

function clearFieldError(field) {
  const inputEl = field === 'name' ? els.inputName : els.inputEmail;
  const errEl = field === 'name' ? els.errorName : els.errorEmail;
  inputEl.classList.remove('has-error');
  errEl.textContent = '';
}

// ─── NAVEGACIÓN ENTRE PASOS ───────────────────────────────────
function handleNext1() {
  if (!validateStep1()) return;
  state.name = els.inputName.value.trim();
  state.email = els.inputEmail.value.trim();
  goToStep(2);
}

function handleNext2() {
  if (!state.file) {
    els.errorImage.textContent = 'Por favor selecciona una imagen antes de continuar';
    return;
  }
  els.errorImage.textContent = '';
  fillSummary();
  goToStep(3);
}

function goToStep(step) {
  state.currentStep = step;

  // Toggle form steps
  els.formStep1.classList.toggle('hidden', step !== 1);
  els.formStep2.classList.toggle('hidden', step !== 2);
  els.formStep3.classList.toggle('hidden', step !== 3);

  // Update step indicators
  updateStepIndicator(step);

  // Scroll to top of card
  els.uploadCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateStepIndicator(current) {
  [1, 2, 3].forEach((n) => {
    const el = document.getElementById(`step-${n}`);
    el.classList.remove('active', 'done');
    if (n === current) el.classList.add('active');
    else if (n < current) el.classList.add('done');
  });

  [els.stepDiv1, els.stepDiv2].forEach((div, i) => {
    if (div) div.classList.toggle('done', current > i + 1);
  });
}

// ─── MANEJO DE ARCHIVOS ───────────────────────────────────────
function handleFileSelected(file) {
  if (!file) return;

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    els.errorImage.textContent = 'Formato no válido. Usa JPG, PNG, GIF o WebP.';
    return;
  }

  // Validate size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    els.errorImage.textContent = `La imagen es demasiado grande (${sizeMB.toFixed(1)} MB). Máximo ${MAX_FILE_SIZE_MB} MB.`;
    return;
  }

  els.errorImage.textContent = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    state.file = file;
    state.fileDataUrl = e.target.result;
    showPreview(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function showPreview(dataUrl, name) {
  els.previewImg.src = dataUrl;
  els.previewName.textContent = name;
  els.dropDefault.classList.add('hidden');
  els.dropPreview.classList.remove('hidden');
}

function clearImage() {
  state.file = null;
  state.fileDataUrl = null;
  els.fileInput.value = '';
  els.previewImg.src = '';
  els.previewName.textContent = '';
  els.dropDefault.classList.remove('hidden');
  els.dropPreview.classList.add('hidden');
}

// ─── LLENAR RESUMEN ───────────────────────────────────────────
function fillSummary() {
  els.summaryImg.src = state.fileDataUrl;
  els.summaryName.textContent = state.name;
  els.summaryEmail.textContent = state.email;
  const fileName = state.file.name;
  els.summaryFile.textContent = fileName.length > 30 ? fileName.substring(0, 28) + '...' : fileName;
}

// ─── ENVÍO AL BACKEND ─────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  setLoadingState(true);

  // Convertir imagen a base64 para Apps Script
  const base64Data = state.fileDataUrl.split(',')[1];

  const payload = {
    name        : state.name,
    email       : state.email,
    fileName    : state.file.name,
    mimeType    : state.file.type,
    imageBase64 : base64Data,
  };

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method  : 'POST',
      // Apps Script requiere text/plain para evitar CORS preflight
      headers : { 'Content-Type': 'text/plain' },
      body    : JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(result);
    } else {
      showError(result.message || 'Hubo un error al procesar tu imagen.');
    }
  } catch (err) {
    console.error('Error al enviar:', err);
    showError('No se pudo conectar con el servidor. Intenta de nuevo.');
  } finally {
    setLoadingState(false);
  }
}

// ─── ESTADO DE CARGA ──────────────────────────────────────────
function setLoadingState(loading) {
  els.btnSubmit.disabled = loading;
  els.btnText.classList.toggle('hidden', loading);
  els.btnSpinner.classList.toggle('hidden', !loading);
}

// ─── MOSTRAR ÉXITO ────────────────────────────────────────────
function showSuccess(result) {
  // Ocultar todo el formulario, mostrar estado de éxito
  els.formStep3.classList.add('hidden');
  const stepsEl = document.querySelector('.steps');
  if (stepsEl) stepsEl.style.display = 'none';
  hideFormSteps();

  els.successEmailDisplay.textContent = state.email;
  els.successMeta.innerHTML = `
    📅 Enviado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}
    ${result.rowId ? `&nbsp;·&nbsp; ID: <strong>${result.rowId}</strong>` : ''}
  `;
  els.successState.classList.remove('hidden');
}

// ─── MOSTRAR ERROR ────────────────────────────────────────────
function showError(message) {
  hideFormSteps();
  els.errorMsgText.textContent = message;
  els.errorState.classList.remove('hidden');
}

function hideFormSteps() {
  const stepsEl = els.uploadCard.querySelector('.steps');
  if (stepsEl) stepsEl.style.display = 'none';
  els.form.classList.add('hidden');
}

// ─── REINICIAR TODO ───────────────────────────────────────────
function resetAll() {
  // Reset state
  state.currentStep = 1;
  state.name = '';
  state.email = '';
  state.file = null;
  state.fileDataUrl = null;

  // Reset form fields
  els.inputName.value = '';
  els.inputEmail.value = '';
  clearImage();
  clearFieldError('name');
  clearFieldError('email');
  els.errorImage.textContent = '';

  // Show form again
  const stepsEl = els.uploadCard.querySelector('.steps');
  if (stepsEl) stepsEl.style.display = '';
  els.form.classList.remove('hidden');
  els.successState.classList.add('hidden');
  els.errorState.classList.add('hidden');

  goToStep(1);
  setLoadingState(false);
}

// ─── INICIO ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
