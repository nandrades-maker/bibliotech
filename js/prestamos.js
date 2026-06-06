/* ─────────────────────────────────────────
   BiblioTechc — prestamos.js
───────────────────────────────────────── */

let allPrestamos = [];
let allLibros    = [];
let allUsuarios  = [];
let filtered     = [];
let currentPage  = 1;
const PER_PAGE   = 12;

let usuarioSeleccionado = null;
let libroSeleccionado   = null;

/* Flags para evitar que el blur cierre el dropdown antes del click */
let usuarioDropdownFocus = false;
let libroDropdownFocus   = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  await loadAll();
});

/* ════════════════════════ CARGA ════════════════════════ */
async function loadAll() {
  try {
    const [p, l, u] = await Promise.all([
      API.Prestamos.getAll(),
      API.Libros.getAll(),
      API.Usuarios.getAll(),
    ]);
    allPrestamos = Array.isArray(p) ? p : [];
    allLibros    = Array.isArray(l) ? l : [];
    allUsuarios  = Array.isArray(u) ? u : [];
    renderStats();
    applyFilters();
  } catch (err) {
    Toast.error('Error al cargar datos', err.message);
  }
}

/* ════════════════════════ STATS ════════════════════════ */
function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  animCounter('stat-total',            allPrestamos.length);
  animCounter('stat-hoy',              allPrestamos.filter(p => p.fechaPrestamo?.startsWith(today)).length);
  animCounter('stat-libros-prestados', new Set(allPrestamos.map(p => p.libro_isbn)).size);
}
function animCounter(id, target) {
  const el = document.getElementById(id); if (!el) return;
  const dur = 600, start = performance.now();
  const step = now => {
    const t = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(t * target);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ════════════════════════ TABLA ════════════════════════ */
function applyFilters() {
  const q = document.getElementById('filter-input').value.toLowerCase().trim();
  filtered = allPrestamos.filter(p =>
    !q ||
    (p.usuario || '').toLowerCase().includes(q) ||
    String(p.libro_isbn || '').includes(q) ||
    (p._id || '').toLowerCase().includes(q)
  );
  document.getElementById('prestamos-count').textContent =
    `${filtered.length} préstamo${filtered.length !== 1 ? 's' : ''}`;
  currentPage = 1;
  render();
}

function render() {
  const page  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const q     = document.getElementById('filter-input').value.trim();
  const tbody = document.getElementById('prestamos-tbody');
  const libroMap   = Object.fromEntries(allLibros.map(l  => [String(l.isbn), l]));
  const usuarioMap = Object.fromEntries(allUsuarios.map(u => [u._id, u]));

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty">
      <div class="table-empty__icon">🔖</div>
      <p class="table-empty__msg">No hay préstamos que mostrar</p>
    </div></td></tr>`;
    buildPagination('pagination-prestamos', 0, 1, PER_PAGE, () => {});
    return;
  }

  tbody.innerHTML = page.map(p => {
    const libro   = libroMap[String(p.libro_isbn)];
    const usuario = usuarioMap[p.usuario];
    const id      = p.id || '';
  
    const tituloCell = libro
      ? `<span class="cell-primary">${highlight(libro.titulo, q)}</span><br><span class="cell-mono">ISBN ${p.libro_isbn}</span>`
      : `<span class="cell-mono">${highlight(String(p.libro_isbn || '—'), q)}</span>`;
    const usuarioCell = usuario
      ? highlight(usuario.nombre, q)
      : `<span class="cell-mono" style="font-size:0.7rem">${highlight(p.usuario || '—', q)}</span>`;
    return `
      <tr data-id="${id}">
        <td>${tituloCell}</td>
        <td>${usuarioCell}</td>
        <td>${formatDate(p.fechaPrestamo)}</td>
        <td><span class="badge badge--amber"><span class="dot"></span>Activo</span></td>
        <td class="cell-actions">
          <button class="btn btn--danger btn--sm" data-action="eliminar">Devolver 🗑</button>
        </td>
      </tr>`;
  }).join('');

  buildPagination('pagination-prestamos', filtered.length, currentPage, PER_PAGE,
    p => { currentPage = p; render(); });
}

function delegateTableEvents() {
  document.getElementById('prestamos-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('[data-id]')?.dataset.id;
    if (!id) { Toast.error('ID no encontrado'); return; }
    if (btn.dataset.action === 'eliminar') deletePrestamo(id);
  });
}

/* ════════════════════════
   BÚSQUEDA USUARIO
   — usa el cache local para texto libre
   — llama API para correo y teléfono
════════════════════════ */
async function buscarUsuario(query) {
  const q         = query.trim();
  const resultBox = document.getElementById('usuario-results');

  if (q.length < 2) {
    ocultarDropdown('usuario');
    return;
  }

  resultBox.innerHTML = `<div class="search-result-item loading">🔄 Buscando…</div>`;
  mostrarDropdown('usuario');

  try {
    let resultados = [];
    const esNumero = /^\d+$/.test(q);
    const esCorreo = q.includes('@');

    if (esNumero) {
      /* Teléfono → endpoint exacto */
      const r = await API.Usuarios.getByPhone(q);
      resultados = normalizar(r);
    } else if (esCorreo) {
      /* Correo → endpoint exacto */
      const r = await API.Usuarios.getByEmail(q);
      resultados = normalizar(r);
    } else {
      /* Texto libre → filtrar cache local (nombre + correo) sin depender de la API */
      resultados = allUsuarios.filter(u =>
        (u.nombre  || '').toLowerCase().includes(q.toLowerCase()) ||
        (u.correo  || '').toLowerCase().includes(q.toLowerCase()) ||
        (u.telefono|| '').includes(q)
      );
    }

    renderUsuarioResults(resultados);
  } catch (_) {
    /* Fallback siempre al cache local */
    const local = allUsuarios.filter(u =>
      (u.nombre  || '').toLowerCase().includes(q.toLowerCase()) ||
      (u.correo  || '').toLowerCase().includes(q.toLowerCase()) ||
      (u.telefono|| '').includes(q)
    );
    renderUsuarioResults(local);
  }
}

function renderUsuarioResults(lista) {
  const resultBox = document.getElementById('usuario-results');
  if (!lista.length) {
    resultBox.innerHTML = `<div class="search-result-item empty">Sin resultados</div>`;
    return;
  }
  resultBox.innerHTML = lista.slice(0, 8).map(u => `
    <div class="search-result-item" data-uid="${u.id}">
      <span class="sri-name">${u.nombre || '—'}</span>
      <span class="sri-meta">${u.correo || u.telefono || u.id}</span>
      <span class="badge badge--${(u.tipo_usuario||'').toLowerCase() === 'admin' ? 'gold':'blue'} sri-badge">
        ${u.tipo_usuario || '—'}
      </span>
    </div>`).join('');

  /* ── Click en item de usuario ──
     mousedown en vez de click: se dispara ANTES del blur del input,
     evitando que el dropdown desaparezca antes de procesar la selección */
  resultBox.querySelectorAll('.search-result-item[data-uid]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault(); // evita que el input pierda foco antes del mousedown
      const u = lista.find(x => x.id === el.dataset.uid);
      if (!u) return;
      usuarioSeleccionado = u;
      document.getElementById('usuario-search').value = u.nombre;
      ocultarDropdown('usuario');
      actualizarChipUsuario();
    });
  });
}

function actualizarChipUsuario() {
  const chip = document.getElementById('usuario-chip');
  if (!usuarioSeleccionado) { chip.classList.add('hidden'); return; }
  chip.classList.remove('hidden');
  document.getElementById('chip-usuario-nombre').textContent  = usuarioSeleccionado.nombre || '—';
  document.getElementById('chip-usuario-detalle').textContent =
    usuarioSeleccionado.correo || usuarioSeleccionado.telefono || usuarioSeleccionado.id;
}

/* ════════════════════════
   BÚSQUEDA LIBRO
   — ISBN exacto por API
   — Título: busca en cache local (case-insensitive) + llama API
════════════════════════ */
async function buscarLibro(query) {
  const q         = query.trim();
  const resultBox = document.getElementById('libro-results');

  if (q.length < 1) {
    ocultarDropdown('libro');
    return;
  }

  resultBox.innerHTML = `<div class="search-result-item loading">🔄 Buscando…</div>`;
  mostrarDropdown('libro');

  try {
    let resultados = [];
    const esIsbn = /^\d+$/.test(q);

    if (esIsbn) {
      /* ISBN — primero buscar en cache local (parcial) */
      const local = allLibros.filter(l => String(l.isbn).includes(q));
      if (local.length) {
        resultados = local;
      } else {
        /* Si no está en cache, consultar API con el ISBN completo */
        const r = await API.Libros.getByIsbn(q);
        resultados = normalizar(r, 'isbn');
      }
    } else {
      /* Título — búsqueda case-insensitive en cache local primero */
      const localPorTitulo = allLibros.filter(l =>
        (l.titulo || '').toLowerCase().includes(q.toLowerCase())
      );

      if (localPorTitulo.length) {
        resultados = localPorTitulo;
      } else {
        /* Si no hay en cache, llamar a la API de búsqueda por título */
        const r = await API.Libros.searchByTitle(q);
        resultados = normalizar(r, 'isbn');
      }
    }

    renderLibroResults(resultados);
  } catch (_) {
    /* Fallback: filtrar cache local siempre en lowercase */
    const local = allLibros.filter(l =>
      (l.titulo || '').toLowerCase().includes(q.toLowerCase()) ||
      String(l.isbn || '').includes(q)
    );
    renderLibroResults(local);
  }
}

function renderLibroResults(lista) {
  const resultBox = document.getElementById('libro-results');
  if (!lista.length) {
    resultBox.innerHTML = `<div class="search-result-item empty">Sin resultados</div>`;
    return;
  }
  resultBox.innerHTML = lista.slice(0, 8).map(l => {
    const agotado = l.cantidad_disponible === 0;
    const disp    = agotado
      ? `<span style="color:var(--clr-red)">❌ Agotado</span>`
      : `<span style="color:var(--clr-green)">✅ ${l.cantidad_disponible} disp.</span>`;
    return `
      <div class="search-result-item${agotado ? ' disabled' : ''}" data-lisbn="${l.isbn}">
        <span class="sri-name">${l.titulo || '—'}</span>
        <span class="sri-meta">ISBN ${l.isbn}${l.autor ? ' · ' + l.autor : ''}</span>
        <span class="sri-badge">${disp}</span>
      </div>`;
  }).join('');

  resultBox.querySelectorAll('.search-result-item[data-lisbn]:not(.disabled)').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const l = lista.find(x => String(x.isbn) === el.dataset.lisbn);
      if (!l) return;
      libroSeleccionado = l;
      document.getElementById('libro-search').value = `${l.titulo} (ISBN ${l.isbn})`;
      ocultarDropdown('libro');
      actualizarChipLibro();
    });
  });
}

function actualizarChipLibro() {
  const chip = document.getElementById('libro-chip');
  if (!libroSeleccionado) { chip.classList.add('hidden'); return; }
  chip.classList.remove('hidden');
  document.getElementById('chip-libro-titulo').textContent  = libroSeleccionado.titulo || '—';
  document.getElementById('chip-libro-detalle').textContent =
    `ISBN ${libroSeleccionado.isbn} · ${libroSeleccionado.cantidad_disponible} disponibles`;
}

/* ════════════════════════
   HELPERS DROPDOWN
════════════════════════ */
function mostrarDropdown(tipo) {
  document.getElementById(`${tipo}-results`).classList.remove('hidden');
}
function ocultarDropdown(tipo) {
  document.getElementById(`${tipo}-results`).innerHTML = '';
  document.getElementById(`${tipo}-results`).classList.add('hidden');
}

/** Normaliza respuesta de la API a array siempre */
function normalizar(r, campoId) {
  if (!r) return [];
  if (Array.isArray(r)) return r;
  /* objeto único */
  const campo = campoId || '_id';
  if (r[campo] !== undefined || r._id) return [r];
  return [];
}

/* ════════════════════════
   GUARDAR PRÉSTAMO
════════════════════════ */
async function savePrestamo() {
  const fecha = document.getElementById('f-fecha').value;

  if (!usuarioSeleccionado) {
    Toast.warning('Falta el usuario', 'Busca y selecciona un usuario');
    document.getElementById('usuario-search').focus();
    return;
  }
  if (!libroSeleccionado) {
    Toast.warning('Falta el libro', 'Busca y selecciona un libro');
    document.getElementById('libro-search').focus();
    return;
  }
  if (!fecha) {
    Toast.warning('Falta la fecha', 'Ingresa la fecha del préstamo');
    return;
  }
  if (libroSeleccionado.cantidad_disponible === 0) {
    Toast.error('Libro agotado', 'No hay ejemplares disponibles');
    return;
  }

  const data = {
    usuario:       usuarioSeleccionado.id,
    libro_isbn:    Number(libroSeleccionado.isbn),
    fechaPrestamo: new Date(fecha + 'T12:00:00').toISOString(),
  };

  const btn = document.getElementById('save-form');
  btn.classList.add('btn--loading'); btn.disabled = true;
  try {
    await API.Prestamos.create(data);

    /* Descontar disponibilidad del libro */
    const libroActual = allLibros.find(l => String(l.isbn) === String(libroSeleccionado.isbn));
    if (libroActual && libroActual.id) {
      const nuevaDisp = Math.max(0, (libroActual.cantidad_disponible ?? 1) - 1);
      await API.Libros.update(libroActual.id, {
        ...libroActual,
        cantidad_disponible: nuevaDisp,
      });
    }

    Toast.success('Préstamo registrado',
      `${libroSeleccionado.titulo} → ${usuarioSeleccionado.nombre}`);
    Modal.close('modal-form');
    resetModal();
    await loadAll();
  } catch (err) {
    Toast.error('Error al registrar', err.message);
  } finally {
    btn.classList.remove('btn--loading'); btn.disabled = false;
  }
}

function resetModal() {
  usuarioSeleccionado = null;
  libroSeleccionado   = null;
  document.getElementById('usuario-search').value = '';
  document.getElementById('libro-search').value   = '';
  ocultarDropdown('usuario');
  ocultarDropdown('libro');
  document.getElementById('usuario-chip').classList.add('hidden');
  document.getElementById('libro-chip').classList.add('hidden');
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
}

/* ════════════════════════
   ELIMINAR PRÉSTAMO
════════════════════════ */
async function deletePrestamo(id) {
  if (!id) { Toast.error('Error', 'ID inválido'); return; }
  const ok = await Confirm.show({
    title: '¿Devolver libro?',
    msg:   'Se eliminará el registro de este préstamo.',
    danger: true,
  });
  if (!ok) return;
  try {
    /* Obtener el préstamo para saber qué libro devolver */
    const prestamo = allPrestamos.find(p => (p.id || p._id) === id);

    await API.Prestamos.delete(id);

    /* Restituir disponibilidad del libro */
    if (prestamo?.libro_isbn) {
      const libroActual = allLibros.find(l => String(l.isbn) === String(prestamo.libro_isbn));
      if (libroActual && libroActual.id) {
        const nuevaDisp = Math.min(
          libroActual.cantidad_total ?? libroActual.cantidad_disponible + 1,
          (libroActual.cantidad_disponible ?? 0) + 1
        );
        await API.Libros.update(libroActual.id, {
          ...libroActual,
          cantidad_disponible: nuevaDisp,
        });
      }
    }

    Toast.success('Préstamo eliminado', 'El libro ha sido devuelto');
    await loadAll();
  } catch (err) {
    Toast.error('Error al eliminar', err.message);
  }
}

/* ════════════════════════
   EVENTOS
════════════════════════ */
function bindEvents() {
  /* Tabla */
  let tf;
  document.getElementById('filter-input').addEventListener('input', () => {
    clearTimeout(tf); tf = setTimeout(applyFilters, 300);
  });
  delegateTableEvents();

  /* Modal abrir/cerrar */
  document.getElementById('btn-nuevo-prestamo').addEventListener('click', () => {
    resetModal(); Modal.open('modal-form');
  });
  document.getElementById('save-form').addEventListener('click', savePrestamo);
  document.getElementById('cancel-form').addEventListener('click', () => Modal.close('modal-form'));
  document.getElementById('close-form').addEventListener('click',  () => Modal.close('modal-form'));
  document.getElementById('modal-form').addEventListener('click', function(e) {
    if (e.target === this) Modal.close('modal-form');
  });

  /* ── Input usuario ── */
  let tu;
  const usuarioInput = document.getElementById('usuario-search');
  usuarioInput.addEventListener('input', e => {
    /* Si el usuario ya está seleccionado y edita el campo, limpiar la selección */
    if (usuarioSeleccionado && e.target.value !== usuarioSeleccionado.nombre) {
      usuarioSeleccionado = null;
      actualizarChipUsuario();
    }
    clearTimeout(tu);
    tu = setTimeout(() => buscarUsuario(e.target.value), 300);
  });
  usuarioInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') ocultarDropdown('usuario');
  });
  /* blur: ocultar dropdown solo si el mouse NO está sobre el dropdown */
  usuarioInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!usuarioDropdownFocus) ocultarDropdown('usuario');
    }, 150);
  });
  document.getElementById('usuario-results').addEventListener('mouseenter', () => { usuarioDropdownFocus = true; });
  document.getElementById('usuario-results').addEventListener('mouseleave', () => { usuarioDropdownFocus = false; });

  document.getElementById('clear-usuario').addEventListener('click', () => {
    usuarioSeleccionado = null;
    usuarioInput.value  = '';
    ocultarDropdown('usuario');
    actualizarChipUsuario();
    usuarioInput.focus();
  });

  /* ── Input libro ── */
  let tl;
  const libroInput = document.getElementById('libro-search');
  libroInput.addEventListener('input', e => {
    if (libroSeleccionado) {
      libroSeleccionado = null;
      actualizarChipLibro();
    }
    clearTimeout(tl);
    tl = setTimeout(() => buscarLibro(e.target.value), 300);
  });
  libroInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') ocultarDropdown('libro');
  });
  libroInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!libroDropdownFocus) ocultarDropdown('libro');
    }, 150);
  });
  document.getElementById('libro-results').addEventListener('mouseenter', () => { libroDropdownFocus = true; });
  document.getElementById('libro-results').addEventListener('mouseleave', () => { libroDropdownFocus = false; });

  document.getElementById('clear-libro').addEventListener('click', () => {
    libroSeleccionado  = null;
    libroInput.value   = '';
    ocultarDropdown('libro');
    actualizarChipLibro();
    libroInput.focus();
  });
}