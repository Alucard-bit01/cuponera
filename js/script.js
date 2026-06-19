/**
 * script.js — Cuponera Digital · Fundación Hogar Salud A.C.
 *
 * Módulos:
 *  1. Router de vistas (SPA sin recarga de página)
 *  2. Lógica de registro por correo electrónico
 *  3. Persistencia en localStorage (estado de sesión simbólico)
 *  4. Interacción "Mostrar Código" con modal
 *  5. Botón "Cerrar sesión"
 */

'use strict';



/* ============================================================
   CONSTANTES Y REFERENCIAS AL DOM
   ============================================================ */
const STORAGE_KEY = 'fhs_user_email'; // clave en localStorage

/** Todas las vistas registradas en el HTML */
const VISTAS = {
  inicio:         document.getElementById('view-inicio'),
  categorias:     document.getElementById('view-categorias'),
  'cupones-dia':  document.getElementById('view-cupones-dia'),
  'quienes-somos':document.getElementById('view-quienes-somos'),
  'mi-cuenta':    document.getElementById('view-mi-cuenta'),
};

/** Links de navegación */
const navLinks        = document.querySelectorAll('.nav-link[data-view]');
/** Botón "Mi Cuenta" en el navbar */
const navMiCuenta     = document.getElementById('nav-mi-cuenta');
/** Formulario de registro */
const registroForm    = document.getElementById('registro-form');
const inputEmail      = document.getElementById('input-email');
const emailError      = document.getElementById('email-error');
const registroBanner  = document.getElementById('registro-section');
/** Perfil en Mi Cuenta */
const perfilEmail     = document.getElementById('perfil-email');
const perfilNombre    = document.getElementById('perfil-nombre');
/** Modal de código */
const modalOverlay    = document.getElementById('modal-codigo');
const modalCodeVal    = document.getElementById('modal-code-val');
const modalCerrar     = document.getElementById('modal-cerrar');
/** Botón cerrar sesión */
const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');


/* ============================================================
   1. ROUTER DE VISTAS
   ─────────────────────────────────────────────────────────────
   Muestra solo la vista correspondiente a data-view="X".
   Actualiza el estado "activo" en el navbar.
   Protege "mi-cuenta": si no hay usuario registrado, redirige
   al formulario de registro en la vista de inicio.
   ============================================================ */

/**
 * Navega a una vista por nombre.
 * @param {string} nombre - clave de VISTAS
 * @param {boolean} [forzar=false] - saltar comprobación de acceso
 */
function irA(nombre, forzar = false) {

  /* Protección de ruta "mi-cuenta" */
  if (nombre === 'mi-cuenta' && !estaRegistrado() && !forzar) {
    // Llevar a inicio y hacer scroll hasta el formulario de registro
    irA('inicio');
    setTimeout(() => {
      const sec = document.getElementById('registro-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (inputEmail) inputEmail.focus();
    }, 80);
    return;
  }

  /* Ocultar todas las vistas */
  Object.values(VISTAS).forEach(v => {
    if (v) v.classList.remove('view--active');
  });

  /* Mostrar la vista solicitada */
  const vista = VISTAS[nombre];
  if (vista) {
    vista.classList.add('view--active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Actualizar estado activo en navbar */
  navLinks.forEach(link => {
    link.classList.toggle('is-active', link.dataset.view === nombre);
    link.setAttribute('aria-current', link.dataset.view === nombre ? 'page' : false);
  });
}

/** Inicializar listeners de todos los links [data-view] del documento */
function initRouter() {
  document.body.addEventListener('click', function (e) {
    const el = e.target.closest('[data-view]');
    if (!el) return;
    e.preventDefault();
    irA(el.dataset.view);
  });
}


/* ============================================================
   2. GESTIÓN DE ESTADO DE REGISTRO
   ─────────────────────────────────────────────────────────────
   Usa localStorage para persistir el correo entre sesiones.
   No maneja contraseñas ni roles de servidor.
   ============================================================ */

/** @returns {string|null} El correo guardado o null */
function getEmailGuardado() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @returns {boolean} */
function estaRegistrado() {
  return !!getEmailGuardado();
}

/**
 * Guarda el correo y actualiza la UI para desbloquear "Mi Cuenta".
 * @param {string} email
 */
function registrarUsuario(email) {
  try {
    localStorage.setItem(STORAGE_KEY, email);
  } catch {
    /* localStorage no disponible: continuar con lógica en memoria */
  }

  actualizarUIRegistrado(email);
}

/** Elimina la sesión simbólica y revierte la UI al estado público. */
function cerrarSesion() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* silent */ }

  actualizarUIPublica();
  irA('inicio');
}

/**
 * Sincroniza la UI al estado "usuario registrado".
 * @param {string} email
 */
function actualizarUIRegistrado(email) {

  /* Mostrar y habilitar el botón "Mi Cuenta" en navbar */
  navMiCuenta.style.display  = '';
  navMiCuenta.removeAttribute('aria-hidden');

  /* Actualizar datos en la vista Mi Cuenta */
  if (perfilEmail) perfilEmail.textContent = email;
  if (perfilNombre) perfilNombre.textContent = 'Usuario General';

  /* Ocultar el banner de registro (ya se registró) */
  if (registroBanner) registroBanner.style.display = 'none';
}

/** Revierte la UI al estado público (sin cuenta). */
function actualizarUIPublica() {
  navMiCuenta.style.display  = 'none';
  navMiCuenta.setAttribute('aria-hidden', 'true');
  if (registroBanner) registroBanner.style.display = '';
  if (perfilEmail)  perfilEmail.textContent  = '—';
  if (perfilNombre) perfilNombre.textContent = 'Usuario General';
}

/**
 * Al cargar la página, comprueba si ya hay un correo en localStorage
 * y restaura el estado de la sesión sin pedir el formulario de nuevo.
 */
function restaurarSesion() {
  const email = getEmailGuardado();
  if (email) {
    actualizarUIRegistrado(email);
  } else {
    actualizarUIPublica();
  }
}


/* ============================================================
   3. VALIDACIÓN Y ENVÍO DEL FORMULARIO DE REGISTRO
   ============================================================ */

/** Valida una dirección de correo con expresión regular básica. */
function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function initFormularioRegistro() {
  if (!registroForm) return;

  registroForm.addEventListener('submit', function (e) {
    e.preventDefault();
    limpiarError();

    const email = inputEmail.value.trim();

    /* Validación */
    if (!email) {
      mostrarError('Por favor ingresa tu correo electrónico.');
      inputEmail.focus();
      return;
    }
    if (!esEmailValido(email)) {
      mostrarError('Ingresa un correo válido (ejemplo: tucorreo@gmail.com).');
      inputEmail.focus();
      return;
    }

    /* Registro exitoso */
    registrarUsuario(email);

    /* Feedback visual en el botón antes de redirigir */
    const btnReg = document.getElementById('btn-registrar');
    if (btnReg) {
      btnReg.textContent = '✔ ¡Listo! Accediendo a tu cuenta…';
      btnReg.disabled    = true;
      btnReg.style.background = '#22A55A';
    }

    /* Redirigir a "Mi Cuenta" tras breve pausa */
    setTimeout(() => {
      irA('mi-cuenta', true);
      if (btnReg) {
        btnReg.disabled = false;
        btnReg.style.background = '';
      }
    }, 900);
  });
}

function mostrarError(msg) {
  if (emailError) {
    emailError.textContent = msg;
    emailError.setAttribute('role', 'alert');
  }
  if (inputEmail) inputEmail.classList.add('has-error');
}

function limpiarError() {
  if (emailError) emailError.textContent = '';
  if (inputEmail) inputEmail.classList.remove('has-error');
}


/* ============================================================
   4. MODAL "MOSTRAR CÓDIGO"
   ─────────────────────────────────────────────────────────────
   Abre un modal de pantalla completa con el código del cupón.
   Soporta cierre por botón, clic en el overlay y tecla Escape.
   ============================================================ */

/**
 * Función global llamada desde el HTML inline onclick.
 * @param {HTMLElement} btn - el botón que disparó el evento
 */
window.mostrarCodigo = function (btn) {
  const codigo = btn.dataset.codigo || '—';
  if (modalCodeVal) modalCodeVal.textContent = codigo;
  if (modalOverlay) {
    modalOverlay.removeAttribute('hidden');
    // Enfocar el modal para accesibilidad
    const firstFocusable = modalOverlay.querySelector('button');
    if (firstFocusable) firstFocusable.focus();
    document.body.style.overflow = 'hidden'; // evitar scroll del fondo
  }
};

function cerrarModal() {
  if (modalOverlay) {
    modalOverlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

function initModal() {
  if (modalCerrar) modalCerrar.addEventListener('click', cerrarModal);

  /* Clic en el overlay (fuera del modal) cierra */
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) cerrarModal();
    });
  }

  /* Tecla Escape cierra el modal */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOverlay && !modalOverlay.hasAttribute('hidden')) {
      cerrarModal();
    }
  });
}


/* ============================================================
   5. BOTÓN CERRAR SESIÓN
   ============================================================ */
function initCerrarSesion() {
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', function () {
      if (confirm('¿Deseas cerrar sesión y salir de tu cuenta?')) {
        cerrarSesion();
      }
    });
  }
}


/* ============================================================
   6. FUNCIÓN AUXILIAR — "Obtener Cupón" en vista pública
   ─────────────────────────────────────────────────────────────
   Si el usuario no está registrado, lo lleva al formulario.
   ============================================================ */
window.solicitarAcceso = function () {
  if (estaRegistrado()) {
    irA('mi-cuenta', true);
  } else {
    irA('inicio');
    setTimeout(() => {
      if (registroBanner) registroBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (inputEmail) inputEmail.focus();
    }, 80);
  }
};


/* ============================================================
   7. FILTRADO DE CUPONES POR CIUDAD
   ─────────────────────────────────────────────────────────────
   Al cambiar la ciudad en el selector, filtra los cupones.
   ============================================================ */

// Estado global para filtros
let filtroActualCiudad = '';
let filtroActualCategoria = '';

/**
 * Filtra los cupones según la ciudad y categoría seleccionadas.
 */
function aplicarFiltros() {
  const couponsGrid = document.getElementById('coupons-grid');
  if (!couponsGrid) return;

  const cupones = couponsGrid.querySelectorAll('.coupon-card');

  cupones.forEach(coupon => {
    const couponCity = coupon.dataset.city || '';
    const couponCategory = coupon.dataset.category || '';
    
    let mostrar = true;

    // Aplicar filtro de ciudad
    if (filtroActualCiudad && couponCity !== filtroActualCiudad) {
      mostrar = false;
    }

    // Aplicar filtro de categoría
    if (filtroActualCategoria && couponCategory !== filtroActualCategoria) {
      mostrar = false;
    }

    coupon.style.display = mostrar ? '' : 'none';
  });
}

/**
 * Filtra los cupones según la ciudad seleccionada.
 * @param {string} ciudad - código de ciudad (sma, dh, gto) o vacío
 */
function filtrarCuponesPorCiudad(ciudad) {
  filtroActualCiudad = ciudad;
  aplicarFiltros();
}

/**
 * Filtra los cupones según la categoría seleccionada.
 * @param {string} categoria - código de categoría o vacío
 */
function filtrarCuponesPorCategoria(categoria) {
  filtroActualCategoria = categoria;
  aplicarFiltros();
}

/**
 * Inicializa el selector de ciudad.
 */
function initSelectorCiudad() {
  const citySelect = document.querySelector('.navbar__city-select');
  if (!citySelect) return;

  citySelect.addEventListener('change', function (e) {
    const ciudadSeleccionada = e.target.value;
    filtrarCuponesPorCiudad(ciudadSeleccionada);
  });
}

/**
 * Inicializa el filtrado de categorías (tarjetas clickeables).
 */
function initFiltroCategoria() {
  const catCards = document.querySelectorAll('.cat-card[data-category]');
  
  catCards.forEach(card => {
    card.addEventListener('click', function (e) {
      const categoria = this.dataset.category;
      
      // Toggle: si está activa, desactivar; si no, activar
      if (filtroActualCategoria === categoria) {
        filtrarCuponesPorCategoria('');
        this.classList.remove('is-active');
      } else {
        filtrarCuponesPorCategoria(categoria);
        
        // Remover is-active de todas las categorías
        catCards.forEach(c => c.classList.remove('is-active'));
        // Agregar is-active a la categoría seleccionada
        this.classList.add('is-active');
      }
    });

    // Accesibilidad: permitir activar con Enter o Space
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  initRouter();           // 1. Navegación entre vistas
  restaurarSesion();      // 2. Recuperar estado de localStorage
  initFormularioRegistro(); // 3. Formulario de registro
  initModal();            // 4. Modal de código
  initCerrarSesion();     // 5. Cerrar sesión
  initSelectorCiudad();   // 6. Filtrado de cupones por ciudad
  initFiltroCategoria();  // 7. Filtrado de cupones por categoría

  /* Vista inicial: "inicio" */
  irA('inicio');
});
