/* ─────────────────────────────────────────
   BiblioTechc — perfil.js
   Perfil del usuario, cambio de contraseña
   y eliminación de cuenta
───────────────────────────────────────── */

let currentUsuario = null;
const ROLE_BADGE = {
  'Admin': 'badge--gold', 'admin': 'badge--gold',
  'estudiante': 'badge--blue', 'docente': 'badge--green', 'visitante': 'badge--gray',
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  await loadPerfil();
});

async function loadPerfil() {
  const usuario = Auth.getUsuario();

  // Intentar cargar datos del usuario desde la API por correo o buscarlo en la lista
  try {
    const todos = await API.Usuarios.getAll();
    // Buscar por nombre de usuario (campo 'usuario' del login corresponde a nombre o correo)
    currentUsuario = todos.find(u =>
      u.nombre?.toLowerCase() === usuario.toLowerCase() ||
      u.correo?.toLowerCase()  === usuario.toLowerCase()
    ) || todos[0]; // Fallback al primero si no hay match

    if (currentUsuario) renderPerfil(currentUsuario);
    else renderFallback(usuario);
  } catch (err) {
    renderFallback(usuario);
    Toast.warning('No se pudo cargar el perfil', err.message);
  }
}

function renderPerfil(u) {
  const initial = (u.nombre || 'U').charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('profile-name').textContent   = u.nombre || '—';
  document.getElementById('profile-correo').textContent = u.correo || '—';

  const badgesEl = document.getElementById('profile-badges');
  badgesEl.innerHTML = `<span class="badge ${ROLE_BADGE[u.tipo_usuario] || 'badge--gray'}">${u.tipo_usuario || '—'}</span>`;

  document.getElementById('info-nombre').textContent   = u.nombre || '—';
  document.getElementById('info-correo').textContent   = u.correo || '—';
  document.getElementById('info-telefono').textContent = u.telefono || '—';
  document.getElementById('info-direccion').textContent= u.direccion || '—';
  document.getElementById('info-rol').innerHTML        = `<span class="badge ${ROLE_BADGE[u.tipo_usuario] || 'badge--gray'}">${u.tipo_usuario || '—'}</span>`;
  document.getElementById('info-fecha').textContent    = formatDate(u.fecha_registro);

  // Llenar form de edición
  document.getElementById('edit-usuario-id').value = u._id;
  document.getElementById('edit-nombre').value     = u.nombre || '';
  document.getElementById('edit-correo').value     = u.correo || '';
  document.getElementById('edit-telefono').value   = u.telefono || '';
  document.getElementById('edit-direccion').value  = u.direccion || '';
}

function renderFallback(usuario) {
  document.getElementById('profile-avatar').textContent = usuario.charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent   = usuario;
  document.getElementById('profile-correo').textContent = 'Sin datos disponibles';
  document.getElementById('profile-badges').innerHTML   = `<span class="badge badge--gold">Admin</span>`;
  ['info-nombre','info-correo','info-telefono','info-direccion','info-fecha'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
}

/* ── Editar info ── */
function toggleEditInfo(show) {
  document.getElementById('info-view').classList.toggle('hidden', show);
  document.getElementById('info-form').classList.toggle('hidden', !show);
  document.getElementById('btn-edit-info').textContent = show ? 'Cancelar' : 'Editar';
}

async function saveEditInfo() {
  const id = document.getElementById('edit-usuario-id').value;
  if (!id) { Toast.warning('Sin ID', 'No se puede editar sin ID de usuario'); return; }

  const data = {
    nombre:       document.getElementById('edit-nombre').value.trim(),
    correo:       document.getElementById('edit-correo').value.trim(),
    telefono:     document.getElementById('edit-telefono').value.trim(),
    direccion:    document.getElementById('edit-direccion').value.trim(),
    tipo_usuario: currentUsuario?.tipo_usuario || 'Admin',
    fecha_registro: currentUsuario?.fecha_registro || new Date().toISOString(),
  };

  const btn = document.getElementById('save-edit-info');
  btn.classList.add('btn--loading'); btn.disabled = true;

  try {
    await API.Usuarios.update(id, data);
    Toast.success('Perfil actualizado');
    await loadPerfil();
    toggleEditInfo(false);
  } catch (err) {
    Toast.error('Error al actualizar', err.message);
  } finally {
    btn.classList.remove('btn--loading'); btn.disabled = false;
  }
}

/* ── Cambiar contraseña ── */
async function changePassword(e) {
  e.preventDefault();
  const nueva     = document.getElementById('pw-nueva').value;
  const confirmar = document.getElementById('pw-confirmar').value;
  const usuario   = Auth.getUsuario();

  if (nueva.length < 6) {
    Toast.warning('Contraseña muy corta', 'Mínimo 6 caracteres');
    document.getElementById('pw-nueva').classList.add('error');
    return;
  }
  if (nueva !== confirmar) {
    Toast.warning('No coinciden', 'Las contraseñas no son iguales');
    document.getElementById('pw-confirmar').classList.add('error');
    document.getElementById('pw-match-error').style.display = 'block';
    return;
  }

  document.getElementById('pw-nueva').classList.remove('error');
  document.getElementById('pw-confirmar').classList.remove('error');
  document.getElementById('pw-match-error').style.display = 'none';

  const btn = document.getElementById('btn-change-pw');
  btn.classList.add('btn--loading'); btn.disabled = true;

  try {
    await API.Login.changePassword(usuario, nueva);
    Toast.success('Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente');
    document.getElementById('pw-form').reset();
  } catch (err) {
    Toast.error('Error al cambiar contraseña', err.message);
  } finally {
    btn.classList.remove('btn--loading'); btn.disabled = false;
  }
}

/* ── Eliminar cuenta ── */
async function deleteAccount() {
  const ok = await Confirm.show({
    title: '¿Eliminar cuenta?',
    msg:   'Se eliminarán tus credenciales de acceso. Esta acción no se puede deshacer.',
    danger: true,
  });
  if (!ok) return;

  const usuario = Auth.getUsuario();
  try {
    await API.Login.delete(usuario);
    Toast.success('Cuenta eliminada', 'Redirigiendo al login…');
    setTimeout(() => Auth.logout(), 1800);
  } catch (err) {
    Toast.error('Error al eliminar cuenta', err.message);
  }
}

/* ── Eventos ── */
function bindEvents() {
  document.getElementById('btn-edit-info').addEventListener('click', () => {
    const visible = !document.getElementById('info-form').classList.contains('hidden');
    toggleEditInfo(!visible);
  });
  document.getElementById('cancel-edit-info').addEventListener('click', () => toggleEditInfo(false));
  document.getElementById('save-edit-info').addEventListener('click', saveEditInfo);

  document.getElementById('pw-form').addEventListener('submit', changePassword);

  // Toggle mostrar contraseña
  document.getElementById('toggle-nueva').addEventListener('click', () => {
    const inp = document.getElementById('pw-nueva');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-delete-account').addEventListener('click', deleteAccount);

  // Limpiar errores en inputs
  ['pw-nueva','pw-confirmar'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      document.getElementById(id).classList.remove('error');
    });
  });
}
