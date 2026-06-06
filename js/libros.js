/* ─────────────────────────────────────────
   BiblioTechc — libros.js
   CRUD completo — usa data-id + delegación
   de eventos (sin onclick inline con IDs)
───────────────────────────────────────── */

const BOOK_SEEDS = ['a1b','c2d','e3f','g4h','i5j','k6l','m7n','o8p','q9r','s0t'];

function getBookImage(categoria, isbn) {
  const seed = isbn ? String(isbn).slice(-3) : BOOK_SEEDS[Math.abs(hashStr(categoria||'')) % 10];
  return `https://picsum.photos/seed/btc${seed}/400/220`;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

let allLibros   = [];
let filtered    = [];
let currentPage = 1;
const PER_PAGE  = 9;
let viewMode    = 'grid';
let sortCol     = '';
let sortDir     = 1;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  await loadLibros();
});

async function loadLibros() {
  showSkeleton();
  try {
    const data = await API.Libros.getAll();
    allLibros = Array.isArray(data) ? data : [];
    // Log para debug: ver estructura real del primer elemento
    if (allLibros.length > 0) {
      console.log('[Libros] Ejemplo de estructura:', JSON.stringify(allLibros[0]));
    }
    populateCategoryFilter();
    applyFilters();
  } catch (err) {
    Toast.error('Error al cargar libros', err.message);
    allLibros = [];
    applyFilters();
  }
}

function showSkeleton() {
  document.getElementById('libros-grid').innerHTML = Array(6).fill(
    `<div class="skeleton" style="height:220px;border-radius:var(--r-lg)"></div>`
  ).join('');
}

function populateCategoryFilter() {
  const cats = [...new Set(allLibros.map(l => l.categoria).filter(Boolean))].sort();
  const sel  = document.getElementById('filter-cat');
  while (sel.options.length > 1) sel.remove(1);
  cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
}

function applyFilters() {
  const q   = (document.getElementById('filter-input').value || '').toLowerCase().trim();
  const cat = document.getElementById('filter-cat').value;
  filtered = allLibros.filter(l => {
    const matchQ   = !q || ((l.titulo||'').toLowerCase().includes(q) || (l.autor||'').toLowerCase().includes(q) || String(l.isbn||'').includes(q));
    const matchCat = !cat || l.categoria === cat;
    return matchQ && matchCat;
  });
  if (sortCol) {
    filtered.sort((a,b) => {
      const va = (a[sortCol]||'').toString().toLowerCase();
      const vb = (b[sortCol]||'').toString().toLowerCase();
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
  }
  document.getElementById('libros-count').textContent = `${filtered.length} libro${filtered.length!==1?'s':''}`;
  currentPage = 1;
  render();
}

function render() {
  if (viewMode === 'grid') renderGrid();
  else renderTable();
  buildPagination('pagination-libros', filtered.length, currentPage, PER_PAGE, p => { currentPage=p; render(); });
}

/* ── Grid ── */
function renderGrid() {
  const grid = document.getElementById('libros-grid');
  const page = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const q    = (document.getElementById('filter-input').value||'').trim();

  if (!page.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state__icon">📚</div>
      <h3 class="empty-state__title">Sin resultados</h3>
      <p class="empty-state__sub">No se encontraron libros</p>
      <button class="btn btn--ghost" id="clear-filter-btn">Limpiar filtros</button>
    </div>`;
    document.getElementById('clear-filter-btn')?.addEventListener('click', () => {
      document.getElementById('filter-input').value=''; applyFilters();
    });
    return;
  }

  grid.innerHTML = page.map(libro => {
    const id  = libro.id || '';
    const pct = libro.cantidad_total ? Math.round((libro.cantidad_disponible/libro.cantidad_total)*100) : 0;
    const dc  = pct>60?'':pct>20?'medium':'low';
    const bc  = libro.cantidad_disponible>0?'badge--green':'badge--red';
    const bt  = libro.cantidad_disponible>0?'Disponible':'Agotado';
    return `
      <article class="book-card animate-fade-up" data-id="${id}">
        <img class="book-card__cover" src="${getBookImage(libro.categoria, libro.isbn)}"
          alt="Portada" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
        <div class="book-card__cover-placeholder" style="display:none">📖</div>
        <div class="book-card__body">
          <h3 class="book-card__title">${highlight(libro.titulo||'—', q)}</h3>
          <p class="book-card__author">${highlight(libro.autor||'—', q)}</p>
          <div class="book-card__footer">
            <span class="badge ${bc}"><span class="dot"></span>${bt}</span>
            <span style="font-size:var(--fs-xs);color:var(--clr-text-3)">${libro.cantidad_disponible??'?'}/${libro.cantidad_total??'?'}</span>
          </div>
          <div class="avail-bar" style="margin-top:8px">
            <div class="avail-bar__track"><div class="avail-bar__fill ${dc}" style="width:${pct}%"></div></div>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn btn--ghost btn--sm" style="flex:1" data-action="ver">Ver</button>
            <button class="btn btn--ghost btn--sm" style="flex:1" data-action="editar">Editar</button>
            <button class="btn btn--danger btn--sm btn--icon" data-action="eliminar" aria-label="Eliminar">🗑</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

/* ── Tabla ── */
function renderTable() {
  const q     = (document.getElementById('filter-input').value||'').trim();
  const page  = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const tbody = document.getElementById('libros-tbody');
  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="table-empty__icon">📚</div><p class="table-empty__msg">Sin resultados</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = page.map(l => {
    const id  = l.id || '';
    const pct = l.cantidad_total ? Math.round((l.cantidad_disponible/l.cantidad_total)*100):0;
    const dc  = pct>60?'':pct>20?'medium':'low';
    return `
      <tr data-id="${id}">
        <td class="cell-primary">${highlight(l.titulo||'—',q)}</td>
        <td>${highlight(l.autor||'—',q)}</td>
        <td><span class="badge badge--gray">${l.categoria||'—'}</span></td>
        <td class="cell-mono">${l.isbn||'—'}</td>
        <td>${l.anio_publicacion||'—'}</td>
        <td style="min-width:120px">
          <div class="avail-bar">
            <div class="avail-bar__track"><div class="avail-bar__fill ${dc}" style="width:${pct}%"></div></div>
            <div class="avail-bar__label">${l.cantidad_disponible}/${l.cantidad_total}</div>
          </div>
        </td>
        <td class="cell-actions">
          <button class="btn btn--ghost btn--sm" data-action="ver">Ver</button>
          <button class="btn btn--ghost btn--sm" data-action="editar">Editar</button>
          <button class="btn btn--danger btn--sm" data-action="eliminar">🗑</button>
        </td>
      </tr>`;
  }).join('');
}

/* ── Obtener ID desde el botón pulsado ── */
function getIdFromBtn(btn) {
  const row = btn.closest('[data-id]');
  return row ? row.dataset.id : null;
}

/* ── Delegación de eventos en grid y tabla ── */
function delegateTableEvents() {
  // Grid
  document.getElementById('libros-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = getIdFromBtn(btn);
    if (!id) { Toast.error('ID no encontrado', 'El libro no tiene un ID válido'); return; }
    const action = btn.dataset.action;
    if (action === 'ver')      openDetalle(id);
    else if (action === 'editar')   openEdit(id);
    else if (action === 'eliminar') deleteLibro(id);
  });
  // Tabla
  document.getElementById('libros-tbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = getIdFromBtn(btn);
    if (!id) { Toast.error('ID no encontrado', 'El libro no tiene un ID válido'); return; }
    const action = btn.dataset.action;
    if (action === 'ver')      openDetalle(id);
    else if (action === 'editar')   openEdit(id);
    else if (action === 'eliminar') deleteLibro(id);
  });
}

/* ── Detalle ── */
function openDetalle(id) {
  const l = allLibros.find(x => x.id === id);
  if (!l) { Toast.error('No encontrado', `ID: ${id}`); return; }
  document.getElementById('detalle-titulo').textContent = l.titulo||'—';
  document.getElementById('detalle-body').innerHTML = `
    <img src="${getBookImage(l.categoria, l.isbn)}" alt=""
      style="width:100%;border-radius:var(--r-md);margin-bottom:var(--sp-5);max-height:180px;object-fit:cover" loading="lazy"/>
    <div class="detail-row"><span class="detail-row__label">Autor</span><span class="detail-row__value">${l.autor||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">ISBN</span><span class="detail-row__value cell-mono">${l.isbn||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Categoría</span><span class="detail-row__value"><span class="badge badge--gold">${l.categoria||'—'}</span></span></div>
    <div class="detail-row"><span class="detail-row__label">Editorial</span><span class="detail-row__value">${l.editorial||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Año</span><span class="detail-row__value">${l.anio_publicacion||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Ubicación</span><span class="detail-row__value">${l.ubicacion||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Disponibilidad</span>
      <span class="detail-row__value"><b style="color:var(--clr-green)">${l.cantidad_disponible}</b> de <b>${l.cantidad_total}</b></span></div>
    <div class="detail-row"><span class="detail-row__label">ID interno</span><span class="detail-row__value cell-mono" style="font-size:0.7rem">${l.id}</span></div>
  `;
  Modal.open('modal-detalle');
}

/* ── Crear / Editar ── */
function openNuevo() {
  clearForm();
  document.getElementById('form-title').textContent = 'Nuevo libro';
  Modal.open('modal-form');
}

function openEdit(id) {
  const l = allLibros.find(x => x.id === id);
  if (!l) { Toast.error('No encontrado', `ID: ${id}`); return; }
  clearForm();
  document.getElementById('form-title').textContent    = 'Editar libro';
  document.getElementById('libro-id').value            = l.id;
  document.getElementById('f-titulo').value            = l.titulo||'';
  document.getElementById('f-autor').value             = l.autor||'';
  document.getElementById('f-isbn').value              = l.isbn||'';
  document.getElementById('f-categoria').value         = l.categoria||'';
  document.getElementById('f-editorial').value         = l.editorial||'';
  document.getElementById('f-anio').value              = l.anio_publicacion||'';
  document.getElementById('f-total').value             = l.cantidad_total??'';
  document.getElementById('f-disponible').value        = l.cantidad_disponible??'';
  document.getElementById('f-ubicacion').value         = l.ubicacion||'';
  Modal.open('modal-form');
}

function clearForm() {
  document.getElementById('libro-form').reset();
  clearFormErrors(document.getElementById('libro-form'));
  document.getElementById('libro-id').value = '';
}

async function saveLibro() {
  const form = document.getElementById('libro-form');
  if (!validateForm(form)) { Toast.warning('Revisa los campos', 'Hay campos requeridos vacíos'); return; }
  const id   = document.getElementById('libro-id').value;
  const data = {
    titulo:              document.getElementById('f-titulo').value.trim(),
    autor:               document.getElementById('f-autor').value.trim(),
    isbn:                Number(document.getElementById('f-isbn').value),
    categoria:           document.getElementById('f-categoria').value.trim(),
    editorial:           document.getElementById('f-editorial').value.trim(),
    anio_publicacion:    Number(document.getElementById('f-anio').value)||undefined,
    cantidad_total:      Number(document.getElementById('f-total').value),
    cantidad_disponible: Number(document.getElementById('f-disponible').value),
    ubicacion:           document.getElementById('f-ubicacion').value.trim(),
  };
  const btn = document.getElementById('save-form');
  btn.classList.add('btn--loading'); btn.disabled=true;
  try {
    if (id) { await API.Libros.update(id, data); Toast.success('Libro actualizado', data.titulo); }
    else    { await API.Libros.create(data);      Toast.success('Libro creado', data.titulo); }
    Modal.close('modal-form');
    await loadLibros();
  } catch (err) {
    Toast.error('Error al guardar', err.message);
  } finally {
    btn.classList.remove('btn--loading'); btn.disabled=false;
  }
}

async function deleteLibro(id) {
  const l  = allLibros.find(x => x.id === id);
  if (!id) { Toast.error('Error', 'ID inválido para eliminar'); return; }
  const ok = await Confirm.show({
    title: '¿Eliminar libro?',
    msg: `Se eliminará "${l?.titulo||id}" permanentemente.`,
    danger: true,
  });
  if (!ok) return;
  try {
    await API.Libros.delete(id);
    Toast.success('Libro eliminado');
    await loadLibros();
  } catch (err) {
    Toast.error('Error al eliminar', err.message);
  }
}

/* ── Eventos ── */
function bindEvents() {
  document.getElementById('filter-input').addEventListener('input', debounce(applyFilters,300));
  document.getElementById('filter-cat').addEventListener('change', applyFilters);
  document.getElementById('btn-nuevo-libro').addEventListener('click', openNuevo);
  document.getElementById('save-form').addEventListener('click', saveLibro);
  document.getElementById('cancel-form').addEventListener('click', ()=>Modal.close('modal-form'));
  document.getElementById('close-form').addEventListener('click',  ()=>Modal.close('modal-form'));
  document.getElementById('close-detalle').addEventListener('click', ()=>Modal.close('modal-detalle'));
  ['modal-form','modal-detalle'].forEach(mid => {
    document.getElementById(mid).addEventListener('click', function(e){ if(e.target===this) Modal.close(mid); });
  });
  document.getElementById('view-grid').addEventListener('click', ()=>setView('grid'));
  document.getElementById('view-table').addEventListener('click', ()=>setView('table'));
  document.querySelectorAll('[data-col]').forEach(th => {
    th.addEventListener('click', ()=>{
      if(sortCol===th.dataset.col) sortDir*=-1; else{sortCol=th.dataset.col;sortDir=1;}
      applyFilters();
    });
  });
  // Delegación (se registra una vez, funciona para contenido dinámico)
  delegateTableEvents();
}

function setView(mode) {
  viewMode=mode;
  document.getElementById('libros-grid').classList.toggle('hidden', mode!=='grid');
  document.getElementById('libros-table-view').classList.toggle('hidden', mode!=='table');
  document.getElementById('view-grid').setAttribute('aria-pressed', mode==='grid');
  document.getElementById('view-table').setAttribute('aria-pressed', mode==='table');
  render();
}

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }