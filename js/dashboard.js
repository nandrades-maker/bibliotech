/* ─────────────────────────────────────────
   BiblioTechc — dashboard.js
   Estadísticas, gráficos y actividad reciente
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  initSidebar();

  document.getElementById('last-updated').textContent =
    'Actualizado: ' + new Date().toLocaleTimeString('es-CO');

  try {
    const [libros, usuarios, prestamos] = await Promise.all([
      API.Libros.getAll(),
      API.Usuarios.getAll(),
      API.Prestamos.getAll(),
    ]);

    renderStats(libros, usuarios, prestamos);
    renderCharts(libros, prestamos);
    renderRecentLoans(prestamos, libros, usuarios);
    renderTopLibros(prestamos, libros);
  } catch (err) {
    Toast.error('Error al cargar datos', err.message);
  }
});

/* ── Stats ── */
function renderStats(libros, usuarios, prestamos) {
  const totalDisponibles = libros.reduce((s, l) => s + (l.cantidad_disponible || 0), 0);

  animCounter('stat-libros',    libros.length);
  animCounter('stat-usuarios',  usuarios.length);
  animCounter('stat-prestamos', prestamos.length);
  animCounter('stat-disponibles', totalDisponibles);

  document.getElementById('stat-libros-delta').textContent    = `${libros.length} títulos en catálogo`;
  document.getElementById('stat-usuarios-delta').textContent  = `${usuarios.length} cuentas activas`;
  document.getElementById('stat-prestamos-delta').textContent = `${prestamos.length} en curso`;
  document.getElementById('stat-disp-delta').textContent      = `de ${libros.reduce((s,l)=>s+(l.cantidad_total||0),0)} totales`;
}

function animCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 800, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(p * target).toLocaleString('es-CO');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Charts ── */
function renderCharts(libros, prestamos) {
  const gold  = 'rgba(200,169,110,0.8)';
  const blue  = 'rgba(78,142,247,0.8)';
  const green = 'rgba(62,207,142,0.8)';
  const red   = 'rgba(240,96,96,0.8)';
  const amber = 'rgba(245,166,35,0.8)';
  const textColor = '#a8a39a';
  const gridColor = 'rgba(255,255,255,0.05)';

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  // Disponibilidad doughnut
  const totalDisp   = libros.reduce((s, l) => s + (l.cantidad_disponible || 0), 0);
  const totalPrest  = libros.reduce((s, l) => s + ((l.cantidad_total || 0) - (l.cantidad_disponible || 0)), 0);

  new Chart(document.getElementById('chart-disponibilidad'), {
    type: 'doughnut',
    data: {
      labels: ['Disponibles', 'Prestados'],
      datasets: [{ data: [totalDisp, totalPrest], backgroundColor: [green, amber], borderWidth: 0, hoverOffset: 6 }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 } },
      },
    },
  });

  // Categorías bar
  const catMap = {};
  libros.forEach(l => {
    const cat = l.categoria || 'Sin categoría';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const sortedCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const colors = [gold, blue, green, red, amber, 'rgba(168,163,154,0.8)'];

  new Chart(document.getElementById('chart-categorias'), {
    type: 'bar',
    data: {
      labels: sortedCats.map(([k]) => k),
      datasets: [{
        label: 'Libros',
        data: sortedCats.map(([,v]) => v),
        backgroundColor: sortedCats.map((_, i) => colors[i % colors.length]),
        borderRadius: 6,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { precision: 0 } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ── Préstamos recientes ── */
function renderRecentLoans(prestamos, libros, usuarios) {
  const container = document.getElementById('recent-loans-table');
  const recent = [...prestamos].reverse().slice(0, 10);

  if (!recent.length) {
    container.innerHTML = `<div class="table-empty"><div class="table-empty__icon">🔖</div><p class="table-empty__msg">Sin préstamos registrados</p></div>`;
    return;
  }

  const libroMap   = Object.fromEntries(libros.map(l  => [l.isbn, l]));
 
  const rows = recent.map(p => {
    const libro   = libroMap[p.libro_isbn];
    const usuario = usuarios.map(u => [u.id, u])[0][1].nombre;

    return `
      <tr>
        <td class="cell-primary">${libro ? libro.titulo : p.libro_isbn}</td>
        <td>${usuario }</td>
        <td>${formatDate(p.fechaPrestamo)}</td>
        <td><span class="badge badge--amber"><span class="dot"></span>Activo</span></td>
        <td class="cell-mono">${p.id}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Libro</th><th>Usuario</th><th>Fecha</th><th>Estado</th><th>ID</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── Top libros ── */
function renderTopLibros(prestamos, libros) {
  const container = document.getElementById('top-libros');
  const libroMap = Object.fromEntries(libros.map(l => [l.isbn, l]));

  const freq = {};
  prestamos.forEach(p => { freq[p.libro_isbn] = (freq[p.libro_isbn] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);

  if (!sorted.length) {
    container.innerHTML = `<p class="text-dim" style="text-align:center;padding:var(--sp-8)">Sin datos</p>`;
    return;
  }

  const max = sorted[0][1];
  container.innerHTML = sorted.map(([isbn, count], i) => {
    const libro = libroMap[isbn];
    const pct   = Math.round((count / max) * 100);
    return `
      <div style="display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--clr-border-line)">
        <span style="font-family:var(--ff-display);font-size:var(--fs-xl);font-weight:900;color:var(--clr-text-3);min-width:28px">${i+1}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-sm);font-weight:500;color:var(--clr-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${libro ? libro.titulo : `ISBN ${isbn}`}
          </div>
          <div style="font-size:var(--fs-xs);color:var(--clr-text-3)">${libro ? libro.autor : ''}</div>
          <div style="margin-top:6px;height:4px;background:var(--clr-bg-4);border-radius:9999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--clr-accent);border-radius:9999px;transition:width 0.8s ease"></div>
          </div>
        </div>
        <span style="font-size:var(--fs-sm);font-weight:600;color:var(--clr-accent)">${count}</span>
      </div>`;
  }).join('');
}
