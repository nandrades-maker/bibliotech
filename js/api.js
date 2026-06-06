/* ─────────────────────────────────────────
   BiblioTechc — api.js
   Fiel a la documentación README.md
   Base URL: https://moviles1.onrender.com

   ENDPOINTS EXACTOS (del README):
   Libros:   GET  /api/libros/obtenerlibros
             GET  /api/libros/buscar/:isbn
             GET  /api/libros/buscart/:titulo
             POST /api/libros/insertar/
             PUT  /api/libros/modificar/:id
             DEL  /api/libros/eliminar/:id

   Usuarios: GET  /api/usuarios/obtenerusuarios
             GET  /api/usuarios/buscarusuario/:id
             GET  /api/usuarios/buscartelefono/:telefono
             GET  /api/usuarios/buscarcorreo/:correo
             POST /api/usuarios/crear
             PUT  /api/usuarios/modificar/:id
             DEL  /api/usuarios/eliminar/:id

   Login:    POST /api/login/crear
             POST /api/login/autenticar
             PUT  /api/login/modificar/:usuario
             DEL  /api/login/eliminar/:usuario

   Préstamos:GET  /api/prestamos/obtener
             GET  /api/prestamos/buscar/:id
             POST /api/prestamos/crear
             DEL  /api/prestamos/eliminar/:id
───────────────────────────────────────── */

const API_BASE = 'https://moviles1.onrender.com';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (netErr) {
    throw new Error('Sin conexión con el servidor');
  }

  const text = await res.text();

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { msg = JSON.parse(text)?.message || text || msg; } catch (_) { msg = text || msg; }
    throw new Error(msg);
  }

  try { return JSON.parse(text); } catch (_) { return text; }
}

const Libros = {
  getAll()             { return request('/api/libros/obtenerlibros'); },
  getByIsbn(isbn)      { return request(`/api/libros/buscar/${isbn}`); },
  searchByTitle(titulo){ return request(`/api/libros/buscart/${encodeURIComponent(titulo)}`); },
  create(data)         { return request('/api/libros/insertar/', { method: 'POST', body: data }); },
  update(id, data)     { return request(`/api/libros/modificar/${id}`, { method: 'PUT', body: data }); },
  delete(id)           { return request(`/api/libros/eliminar/${id}`, { method: 'DELETE' }); },
};

const Usuarios = {
  getAll()          { return request('/api/usuarios/obtenerusuarios'); },
  getById(id)       { return request(`/api/usuarios/buscarusuario/${id}`); },
  getByPhone(tel)   { return request(`/api/usuarios/buscartelefono/${tel}`); },
  getByEmail(correo){ return request(`/api/usuarios/buscarcorreo/${encodeURIComponent(correo)}`); },
  create(data)      { return request('/api/usuarios/crear', { method: 'POST', body: data }); },
  update(id, data)  { return request(`/api/usuarios/modificar/${id}`, { method: 'PUT', body: data }); },
  delete(id)        { return request(`/api/usuarios/eliminar/${id}`, { method: 'DELETE' }); },
};

const Login = {
  create(data)                { return request('/api/login/crear', { method: 'POST', body: data }); },
  authenticate(data)          { return request('/api/login/autenticar', { method: 'POST', body: data }); },
  changePassword(usuario, pwd){ return request(`/api/login/modificar/${usuario}`, { method: 'PUT', body: { password: pwd } }); },
  delete(usuario)             { return request(`/api/login/eliminar/${usuario}`, { method: 'DELETE' }); },
};

const Prestamos = {
  getAll()    { return request('/api/prestamos/obtener'); },
  getById(id) { return request(`/api/prestamos/buscar/${id}`); },
  create(data){ return request('/api/prestamos/crear', { method: 'POST', body: data }); },
  delete(id)  { return request(`/api/prestamos/eliminar/${id}`, { method: 'DELETE' }); },
};

window.API = { Libros, Usuarios, Login, Prestamos };