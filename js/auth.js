/* ─────────────────────────────────────────
   BiblioTechc — auth.js
   Manejo de sesión, guardias de ruta,
   helpers de UI (toasts, confirmaciones)
───────────────────────────────────────── */

/* ════════════════════════
   SESIÓN
════════════════════════ */
const Auth = {
  key: 'btc_session',

  /** Guardar sesión tras login exitoso */
  save(usuario) {
    sessionStorage.setItem(this.key, JSON.stringify({ usuario, ts: Date.now() }));
  },

  /** Obtener sesión actual */
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.key)); } catch (_) { return null; }
  },

  /** Verificar si hay sesión activa */
  isLoggedIn() { return !!this.get(); },

  /** Obtener nombre de usuario */
  getUsuario() { return this.get()?.usuario || ''; },

  /** Cerrar sesión */
  logout() {
    sessionStorage.removeItem(this.key);
    window.location.href = 'login.html';
  },

  /**
   * Guardia: si no hay sesión, redirigir a login.
   * Llamar al inicio de cada página protegida.
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    // Populate user chip if exists
    const nameEl = document.getElementById('user-name');
    const initEl = document.getElementById('user-initial');
    if (nameEl) nameEl.textContent = this.getUsuario();
    if (initEl) initEl.textContent = this.getUsuario().charAt(0).toUpperCase();
    return true;
  },

  /**
   * Si ya tiene sesión y visita login, redirigir al dashboard.
   */
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) window.location.href = 'dashboard.html';
  },
};

/* ════════════════════════
   TOASTS
════════════════════════ */
const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(type, title, msg = '', duration = 3500) {
    this.init();
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `
      <span class="toast__icon">${icons[type] || 'ℹ'}</span>
      <div class="toast__content">
        <div class="toast__title">${title}</div>
        ${msg ? `<div class="toast__msg">${msg}</div>` : ''}
      </div>
      <button class="toast__close" aria-label="Cerrar">✕</button>
    `;
    t.querySelector('.toast__close').addEventListener('click', () => this._remove(t));
    this.container.appendChild(t);
    setTimeout(() => this._remove(t), duration);
  },

  _remove(el) {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  },

  success(title, msg)  { this.show('success', title, msg); },
  error(title, msg)    { this.show('error',   title, msg); },
  info(title, msg)     { this.show('info',    title, msg); },
  warning(title, msg)  { this.show('warning', title, msg); },
};

/* ════════════════════════
   CONFIRMACIÓN
════════════════════════ */
const Confirm = {
  /**
   * Mostrar diálogo de confirmación.
   * @returns {Promise<boolean>}
   */
  show({ title = '¿Confirmar acción?', msg = '', danger = false } = {}) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop confirm-dialog';
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__icon">${danger ? '🗑️' : '❓'}</div>
            <div class="confirm-dialog__title">${title}</div>
            <p class="confirm-dialog__msg">${msg}</p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--ghost" id="confirm-no">Cancelar</button>
            <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="confirm-yes">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('open'));

      const cleanup = (result) => {
        backdrop.classList.remove('open');
        setTimeout(() => backdrop.remove(), 300);
        resolve(result);
      };

      backdrop.querySelector('#confirm-yes').addEventListener('click', () => cleanup(true));
      backdrop.querySelector('#confirm-no').addEventListener('click',  () => cleanup(false));
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(false); });
    });
  },
};

/* ════════════════════════
   MODALES
════════════════════════ */
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  },
  closeAll() {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  },
};

/* ════════════════════════
   SIDEBAR
════════════════════════ */
function initSidebar() {
  // Toggle en móvil
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  let overlay = null;
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.remove(); overlay = null;
      });
    } else {
      overlay?.remove(); overlay = null;
    }
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

  // Active link
  const currentPage = location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) link.classList.add('active');
  });
}

/* ════════════════════════
   FORMATO DE FECHAS
════════════════════════ */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ════════════════════════
   VALIDACIÓN DE FORMS
════════════════════════ */
function validateForm(formEl) {
  let valid = true;
  formEl.querySelectorAll('[data-required]').forEach(input => {
    const group = input.closest('.form-group');
    if (!input.value.trim()) {
      group?.classList.add('has-error');
      valid = false;
    } else {
      group?.classList.remove('has-error');
    }
  });
  return valid;
}

function clearFormErrors(formEl) {
  formEl.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
}

/* ════════════════════════
   PAGINACIÓN
════════════════════════ */
function buildPagination(containerId, total, page, perPage, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = `
    <button class="pagination__btn" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">‹</button>
  `;
  const range = 2;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - range && i <= page + range)) {
      html += `<button class="pagination__btn ${i === page ? 'active' : ''}" data-p="${i}">${i}</button>`;
    } else if (i === page - range - 1 || i === page + range + 1) {
      html += `<span class="pagination__info">…</span>`;
    }
  }
  html += `<button class="pagination__btn" ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">›</button>`;
  html += `<span class="pagination__info">${(page-1)*perPage+1}–${Math.min(page*perPage, total)} de ${total}</span>`;

  el.innerHTML = html;
  el.querySelectorAll('[data-p]').forEach(btn => {
    btn.addEventListener('click', () => onPage(+btn.dataset.p));
  });
}

/* ════════════════════════
   HIGHLIGHT (búsqueda)
════════════════════════ */
function highlight(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return String(text).replace(re, '<mark style="background:rgba(200,169,110,0.3);color:var(--clr-accent);border-radius:2px;padding:0 2px">$1</mark>');
}

/* Export globals */
window.Auth     = Auth;
window.Toast    = Toast;
window.Confirm  = Confirm;
window.Modal    = Modal;
window.initSidebar  = initSidebar;
window.formatDate   = formatDate;
window.formatDateTime = formatDateTime;
window.validateForm = validateForm;
window.clearFormErrors = clearFormErrors;
window.buildPagination = buildPagination;
window.highlight    = highlight;
