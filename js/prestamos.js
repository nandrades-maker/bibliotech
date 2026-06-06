/* ─────────────────────────────────────────
   BiblioTechc — prestamos.js
   CRUD — usa data-id + delegación de eventos
   Body crear: { usuario, libro_isbn, fechaPrestamo }
   Delete: /api/prestamos/eliminar/:id
───────────────────────────────────────── */

let allPrestamos = [];
let allLibros    = [];
let allUsuarios  = [];
let filtered     = [];
let currentPage  = 1;
const PER_PAGE   = 12;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  await loadAll();
});

async function loadAll(){
  try{
    const [p, l, u] = await Promise.all([
      API.Prestamos.getAll(),
      API.Libros.getAll(),
      API.Usuarios.getAll(),
    ]);
    allPrestamos = Array.isArray(p) ? p : [];
    allLibros    = Array.isArray(l) ? l : [];
    allUsuarios  = Array.isArray(u) ? u : [];

    if(allPrestamos.length>0) console.log('[Prestamos] Estructura ejemplo:', JSON.stringify(allPrestamos[0]));

    renderStats();
    populateSelects();
    applyFilters();
  }catch(err){
    Toast.error('Error al cargar datos', err.message);
  }
}

function renderStats(){
  const today = new Date().toISOString().split('T')[0];
  const hoy   = allPrestamos.filter(p=>p.fechaPrestamo?.startsWith(today)).length;
  const unique = new Set(allPrestamos.map(p=>p.libro_isbn)).size;
  animCounter('stat-total', allPrestamos.length);
  animCounter('stat-hoy', hoy);
  animCounter('stat-libros-prestados', unique);
}

function animCounter(id, target){
  const el=document.getElementById(id); if(!el) return;
  const dur=600, start=performance.now();
  const step=now=>{ const p=Math.min((now-start)/dur,1); el.textContent=Math.round(p*target); if(p<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function populateSelects(){
  const selU = document.getElementById('f-usuario');
  while(selU.options.length>1) selU.remove(1);
  allUsuarios.forEach(u=>{
    const o=document.createElement('option');
    o.value=u.id;
    o.textContent=`${u.nombre||u.id} (${u.tipo_usuario||'N/A'})`;
    selU.appendChild(o);
  });

  const selL = document.getElementById('f-isbn');
  while(selL.options.length>1) selL.remove(1);
  allLibros.forEach(l=>{
    const o=document.createElement('option');
    o.value=l.isbn;
    const disp=l.cantidad_disponible>0?`✅ ${l.cantidad_disponible} disp.`:'❌ Agotado';
    o.textContent=`${l.titulo||l.isbn} — ISBN ${l.isbn} (${disp})`;
    if(l.cantidad_disponible===0) o.disabled=true;
    selL.appendChild(o);
  });
}

function applyFilters(){
  const q=document.getElementById('filter-input').value.toLowerCase().trim();
  filtered=allPrestamos.filter(p=>
    !q ||
    (p.usuario||'').toLowerCase().includes(q) ||
    String(p.libro_isbn||'').includes(q) ||
    (p.id||'').toLowerCase().includes(q)
  );
  document.getElementById('prestamos-count').textContent=
    `${filtered.length} préstamo${filtered.length!==1?'s':''}`;
  currentPage=1;
  render();
}

function render(){
  const page  = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const q     = document.getElementById('filter-input').value.trim();
  const tbody = document.getElementById('prestamos-tbody');

  const libroMap   = Object.fromEntries(allLibros.map(l=>[String(l.isbn), l]));
  const usuarioMap = Object.fromEntries(allUsuarios.map(u=>[u.id, u]));

  if(!page.length){
    tbody.innerHTML=`<tr><td colspan="5"><div class="table-empty">
      <div class="table-empty__icon">🔖</div>
      <p class="table-empty__msg">No hay préstamos que mostrar</p>
    </div></td></tr>`;
    buildPagination('pagination-prestamos',0,1,PER_PAGE,()=>{});
    return;
  }

  tbody.innerHTML=page.map(p=>{
    const libro   = libroMap[String(p.libro_isbn)];
    const usuario = usuarioMap[p.usuario];
    const id      = p.id||'';

    const tituloCell = libro
      ? `<span class="cell-primary">${highlight(libro.titulo,q)}</span><br><span class="cell-mono">ISBN ${p.libro_isbn}</span>`
      : `<span class="cell-mono">${highlight(String(p.libro_isbn||'—'),q)}</span>`;

    const usuarioCell = usuario
      ? highlight(usuario.nombre,q)
      : `<span class="cell-mono" style="font-size:0.7rem">${highlight(p.usuario||'—',q)}</span>`;

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
    p=>{ currentPage=p; render(); });
}

function delegateTableEvents(){
  document.getElementById('prestamos-tbody').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const row = btn.closest('[data-id]');
    const id  = row?.dataset.id;
    if(!id){ Toast.error('ID no encontrado','El préstamo no tiene un ID válido'); return; }
    if(btn.dataset.action==='eliminar') deletePrestamo(id);
  });
}

async function savePrestamo(){
  const selUsuario = document.getElementById('f-usuario').value;
  const manualId   = document.getElementById('f-usuario-id').value.trim();
  const usuarioId  = manualId || selUsuario;
  const isbn       = document.getElementById('f-isbn').value;
  const fecha      = document.getElementById('f-fecha').value;

  if(!usuarioId){ Toast.warning('Falta el usuario','Selecciona o ingresa un usuario'); return; }
  if(!isbn)     { Toast.warning('Falta el libro','Selecciona un libro');              return; }
  if(!fecha)    { Toast.warning('Falta la fecha','Ingresa la fecha del préstamo');    return; }

  // Según README: { usuario, libro_isbn, fechaPrestamo }
  const data = {
    usuario:       usuarioId,
    libro_isbn:    Number(isbn),
    fechaPrestamo: new Date(fecha+'T12:00:00').toISOString(),
  };

  const btn=document.getElementById('save-form');
  btn.classList.add('btn--loading'); btn.disabled=true;
  try{
    await API.Prestamos.create(data);
    Toast.success('Préstamo registrado');
    Modal.close('modal-form');
    document.getElementById('f-usuario').value='';
    document.getElementById('f-usuario-id').value='';
    document.getElementById('f-isbn').value='';
    await loadAll();
  }catch(err){
    Toast.error('Error al registrar',err.message);
  }finally{
    btn.classList.remove('btn--loading'); btn.disabled=false;
  }
}

async function deletePrestamo(id){
  if(!id){ Toast.error('Error','ID inválido'); return; }
  const ok=await Confirm.show({
    title:'¿Devolver libro?',
    msg:'Se eliminará el registro de este préstamo.',
    danger:true,
  });
  if(!ok) return;
  try{
    await API.Prestamos.delete(id);
    Toast.success('Préstamo eliminado','El libro ha sido devuelto');
    await loadAll();
  }catch(err){
    Toast.error('Error al eliminar',err.message);
  }
}

function bindEvents(){
  let t;
  document.getElementById('filter-input').addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(applyFilters,300); });
  document.getElementById('btn-nuevo-prestamo').addEventListener('click',()=>Modal.open('modal-form'));
  document.getElementById('save-form').addEventListener('click', savePrestamo);
  document.getElementById('cancel-form').addEventListener('click',()=>Modal.close('modal-form'));
  document.getElementById('close-form').addEventListener('click', ()=>Modal.close('modal-form'));
  document.getElementById('modal-form').addEventListener('click',function(e){if(e.target===this)Modal.close('modal-form');});
  delegateTableEvents();
}