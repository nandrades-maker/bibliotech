/* ─────────────────────────────────────────
   BiblioTechc — crear-acceso.js

   POST /api/login/crear
   Body: { usuario, password, id_user }
     - usuario  → _id en colección login
     - password → contraseña
     - id_user  → _id del usuario en colección usuarios
───────────────────────────────────────── */

let admins = [];
let adminSeleccionado = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  initSidebar();
  bindEvents();
  await cargarAdmins();
});

/* ── Cargar admins ── */
async function cargarAdmins() {
  try {
    const todos = await API.Usuarios.getAll();
    admins = Array.isArray(todos)
      ? todos.filter(u =>
          (u.tipo_usuario || '').toLowerCase() === 'admin'
        )
      : [];

    document.getElementById('loading-admins').classList.add('hidden');

    if (admins.length === 0) {
      document.getElementById('no-admins').classList.remove('hidden');
      return;
    }

    // Llenar select — sin opción vacía inicial para evitar confusión
    const sel = document.getElementById('select-admin');

    // Quitar la opción placeholder
    sel.innerHTML = '';

    admins.forEach(u => {
      const opt = document.createElement('option');
      opt.value       = u.id;
      opt.textContent = `${u.nombre}  —  ${u.correo || 'sin correo'}`;
      sel.appendChild(opt);
    });

    document.getElementById('form-container').classList.remove('hidden');

    // Auto-seleccionar el primero y disparar el preview
    sel.value = admins[0].id;
    seleccionarAdmin(admins[0].id);

  } catch (err) {
    document.getElementById('loading-admins').classList.add('hidden');
    Toast.error('Error al cargar usuarios', err.message);
  }
}

/* ── Función central: actualiza adminSeleccionado y el preview ── */
function seleccionarAdmin(id) {
  const preview    = document.getElementById('admin-preview');
  const resumenBox = document.getElementById('resumen-box');

  if (!id) {
    adminSeleccionado = null;
    preview.classList.add('hidden');
    resumenBox.classList.add('hidden');
    return;
  }

  adminSeleccionado = admins.find(u => u.id === id) || null;
  if (!adminSeleccionado) {
    preview.classList.add('hidden');
    return;
  }

  // Mostrar preview
  const initials = (adminSeleccionado.nombre || '?')
    .split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

  document.getElementById('preview-avatar').textContent = initials;
  document.getElementById('preview-nombre').textContent = adminSeleccionado.nombre || '—';
  document.getElementById('preview-correo').textContent = adminSeleccionado.correo  || 'Sin correo';
  document.getElementById('preview-id').textContent     = `id: ${adminSeleccionado.id}`;
  preview.classList.remove('hidden');

  actualizarResumen();
}

/* ── Resumen en vivo ── */
function actualizarResumen() {
  const usuario = document.getElementById('f-usuario').value.trim();
  const resumen = document.getElementById('resumen-box');

  if (adminSeleccionado && usuario) {
    document.getElementById('resumen-nombre').textContent  = adminSeleccionado.nombre;
    document.getElementById('resumen-usuario').textContent = usuario;
    resumen.classList.remove('hidden');
  } else {
    resumen.classList.add('hidden');
  }
}

/* ── Validación ── */
function validar() {
  let ok = true;

  if (!adminSeleccionado) {
    Toast.warning('Falta seleccionar', 'Selecciona un administrador de la lista');
    ok = false;
  }

  const usuarioEl  = document.getElementById('f-usuario');
  const usuarioVal = usuarioEl.value.trim();
  const errU       = document.getElementById('err-usuario');

  if (!usuarioVal) {
    usuarioEl.classList.add('error');
    errU.textContent     = 'El nombre de usuario es requerido';
    errU.style.display   = 'block';
    ok = false;
  } else if (/\s/.test(usuarioVal)) {
    usuarioEl.classList.add('error');
    errU.textContent     = 'No se permiten espacios';
    errU.style.display   = 'block';
    ok = false;
  } else {
    usuarioEl.classList.remove('error');
    errU.style.display   = 'none';
  }

  const pwEl  = document.getElementById('f-password');
  const pwVal = pwEl.value;
  const errPw = document.getElementById('err-password');

  if (!pwVal || pwVal.length < 6) {
    pwEl.classList.add('error');
    errPw.style.display = 'block';
    ok = false;
  } else {
    pwEl.classList.remove('error');
    errPw.style.display = 'none';
  }

  const cfEl  = document.getElementById('f-confirm');
  const cfVal = cfEl.value;
  const errCf = document.getElementById('err-confirm');

  if (cfVal !== pwVal) {
    cfEl.classList.add('error');
    errCf.style.display = 'block';
    ok = false;
  } else {
    cfEl.classList.remove('error');
    errCf.style.display = 'none';
  }

  return ok;
}

/* ── Crear acceso ── */
async function crearAcceso() {
  if (!validar()) return;

  const body = {
    usuario:  document.getElementById('f-usuario').value.trim(),
    password: document.getElementById('f-password').value,
    id_user:  adminSeleccionado.id,
  };

  const btn = document.getElementById('btn-crear-acceso');
  btn.classList.add('btn--loading'); btn.disabled = true;

  try {
    await API.Login.create(body);
    Toast.success('Acceso creado', `"${body.usuario}" ya puede iniciar sesión`);
    setTimeout(() => { window.location.href = 'usuarios.html'; }, 1600);
  } catch (err) {
    let msg = err.message;
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('exist')) {
      msg = `El usuario "${body.usuario}" ya existe. Elige otro nombre.`;
    }
    Toast.error('Error al crear acceso', msg);
    btn.classList.remove('btn--loading'); btn.disabled = false;
  }
}

/* ── Eventos ── */
function bindEvents() {
  // Select: cuando el usuario cambia manualmente
  document.getElementById('select-admin')
    .addEventListener('change', e => seleccionarAdmin(e.target.value));

  // Input usuario: actualizar resumen y limpiar error
  document.getElementById('f-usuario').addEventListener('input', () => {
    document.getElementById('f-usuario').classList.remove('error');
    document.getElementById('err-usuario').style.display = 'none';
    actualizarResumen();
  });

  document.getElementById('f-password').addEventListener('input', () => {
    document.getElementById('f-password').classList.remove('error');
    document.getElementById('err-password').style.display = 'none';
  });

  document.getElementById('f-confirm').addEventListener('input', () => {
    document.getElementById('f-confirm').classList.remove('error');
    document.getElementById('err-confirm').style.display = 'none';
  });

  // Toggle contraseña
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const inp = document.getElementById('f-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    document.getElementById('toggle-pw').textContent = inp.type === 'password' ? '👁' : '🙈';
  });

  document.getElementById('btn-crear-acceso').addEventListener('click', crearAcceso);

  document.getElementById('acceso-form').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); crearAcceso(); }
  });
}