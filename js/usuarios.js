/* ─────────────────────────────────────────
   BiblioTechc — usuarios.js
   CRUD — usa data-id + delegación de eventos
   Body de modificar incluye fecha_registro
   (requerido por la API según README)
───────────────────────────────────────── */

let allUsuarios = [];
let filtered    = [];
let currentPage = 1;
const PER_PAGE  = 12;

const ROLE_BADGE = {
  'Admin':'badge--gold','admin':'badge--gold',
  'estudiante':'badge--blue','docente':'badge--green','visitante':'badge--gray',
};

function avatarInitials(n){ return (n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function avatarColor(n){
  const c=['var(--clr-accent)','var(--clr-blue)','var(--clr-green)','var(--clr-amber)','var(--clr-red)'];
  let h=0; for(const ch of (n||'')) h=(h*31+ch.charCodeAt(0))|0;
  return c[Math.abs(h)%c.length];
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  await loadUsuarios();
});

async function loadUsuarios(){
  document.getElementById('usuarios-tbody').innerHTML=
    `<tr><td colspan="6"><div style="padding:var(--sp-8);text-align:center"><div class="spinner"></div></div></td></tr>`;
  try{
    const data = await API.Usuarios.getAll();
    allUsuarios = Array.isArray(data) ? data : [];
    if(allUsuarios.length>0) //console.log('[Usuarios] Estructura ejemplo:', JSON.stringify(allUsuarios[0]));
    applyFilters();
  }catch(err){
    Toast.error('Error al cargar usuarios', err.message);
    allUsuarios=[];
    applyFilters();
  }
}

function applyFilters(){
  const q    = document.getElementById('filter-input').value.toLowerCase().trim();
  const tipo = document.getElementById('filter-tipo').value;
  filtered = allUsuarios.filter(u=>{
    const mQ = !q||((u.nombre||'').toLowerCase().includes(q)||(u.correo||'').toLowerCase().includes(q)||(u.telefono||'').includes(q));
    const mT = !tipo || u.tipo_usuario===tipo;
    return mQ && mT;
  });
  document.getElementById('usuarios-count').textContent=`${filtered.length} usuario${filtered.length!==1?'s':''}`;
  currentPage=1;
  render();
}

function render(){
  const q     = document.getElementById('filter-input').value.trim();
  const page  = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const tbody = document.getElementById('usuarios-tbody');

  if(!page.length){
    tbody.innerHTML=`<tr><td colspan="6"><div class="table-empty">
      <div class="table-empty__icon">👥</div>
      <p class="table-empty__msg">No se encontraron usuarios</p>
    </div></td></tr>`;
    buildPagination('pagination-usuarios',0,1,PER_PAGE,()=>{});
    return;
  }

  tbody.innerHTML = page.map(u=>{
    const bc  = ROLE_BADGE[u.tipo_usuario]||'badge--gray';
    const ini = avatarInitials(u.nombre);
    const col = avatarColor(u.nombre);
    const id  = u.id||'';
    return `
      <tr data-id="${id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.3);
              border:1px solid ${col};display:flex;align-items:center;justify-content:center;
              font-size:0.7rem;font-weight:700;color:${col};flex-shrink:0;
              font-family:var(--ff-display)">${ini}</div>
            <span class="cell-primary">${highlight(u.nombre||'—',q)}</span>
          </div>
        </td>
        <td>${highlight(u.correo||'—',q)}</td>
        <td>${highlight(u.telefono||'—',q)}</td>
        <td><span class="badge ${bc}">${u.tipo_usuario||'—'}</span></td>
        <td>${formatDate(u.fecha_registro)}</td>
        <td class="cell-actions">
          <button class="btn btn--ghost btn--sm" data-action="ver">Ver</button>
          <button class="btn btn--ghost btn--sm" data-action="editar">Editar</button>
          <button class="btn btn--danger btn--sm" data-action="eliminar">🗑</button>
        </td>
      </tr>`;
  }).join('');

  buildPagination('pagination-usuarios', filtered.length, currentPage, PER_PAGE, p=>{ currentPage=p; render(); });
}

function delegateTableEvents(){
  document.getElementById('usuarios-tbody').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const row = btn.closest('[data-id]');
    const id  = row?.dataset.id;
    if(!id){ Toast.error('ID no encontrado','El usuario no tiene un ID válido'); return; }
    const action = btn.dataset.action;
    if(action==='ver')      openDetalle(id);
    else if(action==='editar')   openEdit(id);
    else if(action==='eliminar') deleteUsuario(id);
  });
}

function openDetalle(id){
  console.log('ID detalle', id);
  const u = allUsuarios.find(x=>x.id===id);
  if(!u){ Toast.error('No encontrado',`ID: ${id}`); return; }
  const col = avatarColor(u.nombre);
  document.getElementById('detalle-nombre').textContent = u.nombre||'—';
  document.getElementById('detalle-body').innerHTML=`
    <div style="text-align:center;padding:var(--sp-4) 0 var(--sp-6)">
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(0,0,0,0.3);
        border:2px solid ${col};display:flex;align-items:center;justify-content:center;
        font-size:1.5rem;font-weight:900;color:${col};font-family:var(--ff-display);
        margin:0 auto var(--sp-3)">${avatarInitials(u.nombre)}</div>
      <span class="badge ${ROLE_BADGE[u.tipo_usuario]||'badge--gray'}">${u.tipo_usuario||'—'}</span>
    </div>
    <div class="detail-row"><span class="detail-row__label">Correo</span><span class="detail-row__value">${u.correo||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Teléfono</span><span class="detail-row__value">${u.telefono||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Dirección</span><span class="detail-row__value">${u.direccion||'—'}</span></div>
    <div class="detail-row"><span class="detail-row__label">Registro</span><span class="detail-row__value">${formatDate(u.fecha_registro)}</span></div>
    <div class="detail-row"><span class="detail-row__label">ID</span><span class="detail-row__value cell-mono" style="font-size:0.7rem">${u.id}</span></div>
  `;
  Modal.open('modal-detalle');
}

function openNuevo(){
  clearForm();
  document.getElementById('form-title').textContent='Nuevo usuario';
  document.getElementById('usuario-id').value='';
  Modal.open('modal-form');
}

function openEdit(id){
  const u = allUsuarios.find(x=>x.id===id);
  if(!u){ Toast.error('No encontrado',`ID: ${id}`); return; }
  clearForm();
  document.getElementById('form-title').textContent = 'Editar usuario';
  document.getElementById('usuario-id').value   = u.id;
  document.getElementById('f-nombre').value     = u.nombre||'';
  document.getElementById('f-correo').value     = u.correo||'';
  document.getElementById('f-telefono').value   = u.telefono||'';
  document.getElementById('f-tipo').value       = u.tipo_usuario||'';
  document.getElementById('f-direccion').value  = u.direccion||'';
  Modal.open('modal-form');
}

function clearForm(){
  document.getElementById('usuario-form').reset();
  clearFormErrors(document.getElementById('usuario-form'));
}

async function saveUsuario(){
  const form = document.getElementById('usuario-form');
  if(!validateForm(form)){ Toast.warning('Revisa los campos','Hay campos requeridos vacíos'); return; }
  const id = document.getElementById('usuario-id').value;

  // El README exige fecha_registro en el body tanto para crear como para modificar
  const usuarioExistente = id ? allUsuarios.find(x=>x._id===id) : null;
  const data = {
    nombre:         document.getElementById('f-nombre').value.trim(),
    correo:         document.getElementById('f-correo').value.trim(),
    telefono:       document.getElementById('f-telefono').value.trim(),
    tipo_usuario:   document.getElementById('f-tipo').value,
    direccion:      document.getElementById('f-direccion').value.trim(),
    fecha_registro: usuarioExistente?.fecha_registro || new Date().toISOString(),
  };

  const btn = document.getElementById('save-form');
  btn.classList.add('btn--loading'); btn.disabled=true;
  try{
    if(id){ await API.Usuarios.update(id,data); Toast.success('Usuario actualizado',data.nombre); }
    else  { await API.Usuarios.create(data);    Toast.success('Usuario creado',data.nombre); }
    Modal.close('modal-form');
    await loadUsuarios();
  }catch(err){
    Toast.error('Error al guardar',err.message);
  }finally{
    btn.classList.remove('btn--loading'); btn.disabled=false;
  }
}

async function deleteUsuario(id){
  if(!id){ Toast.error('Error','ID inválido para eliminar'); return; }
  const u  = allUsuarios.find(x=>x._id===id);
  const ok = await Confirm.show({
    title:'¿Eliminar usuario?',
    msg:`Se eliminará a "${u?.nombre||id}" permanentemente.`,
    danger:true,
  });
  if(!ok) return;
  try{
    await API.Usuarios.delete(id);
    Toast.success('Usuario eliminado');
    await loadUsuarios();
  }catch(err){
    Toast.error('Error al eliminar',err.message);
  }
}

function bindEvents(){
  document.getElementById('filter-input').addEventListener('input', debounce(applyFilters,300));
  document.getElementById('filter-tipo').addEventListener('change', applyFilters);
  document.getElementById('btn-nuevo-usuario').addEventListener('click', openNuevo);
  document.getElementById('save-form').addEventListener('click', saveUsuario);
  document.getElementById('cancel-form').addEventListener('click', ()=>Modal.close('modal-form'));
  document.getElementById('close-form').addEventListener('click',  ()=>Modal.close('modal-form'));
  document.getElementById('close-detalle').addEventListener('click', ()=>Modal.close('modal-detalle'));
  ['modal-form','modal-detalle'].forEach(mid=>{
    document.getElementById(mid).addEventListener('click',function(e){if(e.target===this)Modal.close(mid);});
  });
  delegateTableEvents();
}

function debounce(fn,ms){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }