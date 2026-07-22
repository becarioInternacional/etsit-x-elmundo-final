/* ============================================================
   ETSIT x ElMundo — assets/app.js
   Requiere: assets/vendor/d3.min.js, assets/vendor/topojson-client.min.js,
             WORLD_TOPO (world.js), OFERTA (data.js)
   Diseñado para degradar con elegancia: si el mapa falla,
   los filtros y la tabla siguen funcionando.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Comprobación de datos ----------
  if (typeof OFERTA === 'undefined' || !Array.isArray(OFERTA) || !OFERTA.length) {
    console.error('[ETSIT] OFERTA no está definido. ¿Se ha generado assets/data.js con tools/build_data.py?');
    var body = document.getElementById('resultBody');
    if (body) {
      body.innerHTML = '<tr><td colspan="9" style="padding:24px;text-align:center;color:#c0392b">' +
        'No se han podido cargar los datos (assets/data.js). Ejecuta <code>python tools/build_data.py</code> y recarga.</td></tr>';
    }
    return;
  }
  console.log('[ETSIT] Datos cargados:', OFERTA.length, 'destinos');

  // ---------- Estado de filtros ----------
  const state = { pais: '', ciudad: '', idioma: '', titulacion: '', area: '', q: '' };

  // ---------- Estadísticas de cabecera ----------
  const totalPlazas = OFERTA.reduce((s, d) => s + (d.plazas || 0), 0);
  const paisesSet = new Set(OFERTA.map(d => d.pais));
  const unisSet = new Set(OFERTA.map(d => d.universidad));
  animateNumber(document.getElementById('statPlazas'), totalPlazas);
  animateNumber(document.getElementById('statPaises'), paisesSet.size);
  animateNumber(document.getElementById('statUnis'), unisSet.size);

  function animateNumber(el, target) {
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = target; return; }
    const dur = 900, t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // ---------- Agregados por país ----------
  const byNum = new Map(); // paisNum -> { iso, nombre, plazas, unis:Set, ciudades:Set }
  OFERTA.forEach(d => {
    if (!d.paisNum) return;
    if (!byNum.has(d.paisNum)) {
      byNum.set(d.paisNum, { iso: d.pais, nombre: d.paisNombre, plazas: 0, unis: new Set(), ciudades: new Set() });
    }
    const agg = byNum.get(d.paisNum);
    agg.plazas += d.plazas || 0;
    agg.unis.add(d.universidad);
    if (d.ciudad && d.ciudad !== '—') agg.ciudades.add(d.ciudad);
  });

  // ============================================================
  //  MAPA — en try/catch: si algo falla, el explorador sigue vivo
  // ============================================================
  try {
    initMap();
  } catch (err) {
    console.error('[ETSIT] Error inicializando el mapa:', err);
    const fb = document.getElementById('mapFallback');
    if (fb) fb.hidden = false;
  }

  function initMap() {
    if (typeof d3 === 'undefined') throw new Error('d3 no está cargado (assets/vendor/d3.min.js)');
    if (typeof topojson === 'undefined') throw new Error('topojson-client no está cargado');
    if (typeof WORLD_TOPO === 'undefined') throw new Error('WORLD_TOPO no está definido (assets/world.js)');

    const tooltip = document.getElementById('tooltip');
    const mapEl = document.getElementById('map');
    const W = 980, H = 520;

    const countries = topojson
      .feature(WORLD_TOPO, WORLD_TOPO.objects.countries)
      .features.filter(f => f.id !== '010'); // sin Antártida

    const projection = d3.geoNaturalEarth1();
    projection.fitSize([W, H], { type: 'FeatureCollection', features: countries });
    const path = d3.geoPath(projection);

    const maxPlazas = d3.max([...byNum.values()], d => d.plazas) || 1;
    const color = d3.scaleSequential(
      d3.interpolateRgbBasis(['#b9d2f4', '#1f5edc', '#123d9c'])
    ).domain([0, Math.sqrt(maxPlazas)]);

    const svg = d3.select(mapEl).append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img')
      .attr('aria-label', 'Mapa mundial con la oferta de plazas por país');

    const g = svg.append('g');

    const paths = g.selectAll('path')
      .data(countries)
      .join('path')
      .attr('d', path)
      .attr('class', d => byNum.has(d.id) ? 'country country--offer' : 'country')
      .attr('fill', d => byNum.has(d.id) ? color(Math.sqrt(byNum.get(d.id).plazas)) : 'var(--no-data)')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.5)
      .attr('tabindex', d => byNum.has(d.id) ? 0 : null)
      .attr('aria-label', d => {
        const a = byNum.get(d.id);
        return a ? `${a.nombre}: ${a.plazas} plazas en ${a.unis.size} universidades. Pulsa Intro para ver su ficha.` : null;
      });

    paths.on('mousemove', (event, d) => {
        const a = byNum.get(d.id);
        if (!a) { tooltip.hidden = true; return; }
        tooltip.innerHTML =
          `<h3>${a.nombre}</h3>` +
          `<div class="tt-line"><strong>${a.plazas}</strong> plazas · <strong>${a.unis.size}</strong> universidad${a.unis.size === 1 ? '' : 'es'}</div>` +
          (a.ciudades.size ? `<div class="tt-line">${[...a.ciudades].slice(0, 4).join(' · ')}${a.ciudades.size > 4 ? ' · …' : ''}</div>` : '') +
          `<span class="tt-cta">Clic para ver la ficha del país →</span>`;
        tooltip.hidden = false;
        const pad = 14;
        let x = event.clientX + pad, y = event.clientY + pad;
        const r = tooltip.getBoundingClientRect();
        if (x + r.width > window.innerWidth - 8) x = event.clientX - r.width - pad;
        if (y + r.height > window.innerHeight - 8) y = event.clientY - r.height - pad;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      })
      .on('mouseleave', () => { tooltip.hidden = true; })
      .on('click', (event, d) => goToCountry(d.id))
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goToCountry(d.id);
        }
      });

    console.log('[ETSIT] Mapa inicializado —', byNum.size, 'países con oferta');
  }

  function goToCountry(num) {
    const a = byNum.get(num);
    if (!a) return;
    window.location.href = 'country.html?country=' + encodeURIComponent(a.iso);
  }

  // ============================================================
  //  FILTROS Y TABLA
  // ============================================================
  const $pais = document.getElementById('fPais');
  const $ciudad = document.getElementById('fCiudad');
  const $idioma = document.getElementById('fIdioma');
  const $titulacion = document.getElementById('fTitulacion');
  const $area = document.getElementById('fArea');
  const $search = document.getElementById('fSearch');

  const paisesOrdenados = [...new Map(OFERTA.map(d => [d.pais, d.paisNombre]))]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));
  fillSelect($pais, paisesOrdenados.map(([iso, nombre]) => ({ value: iso, label: `${nombre} (${iso})` })));

  fillSelect($idioma, uniqueFlat(OFERTA, 'idiomas').map(v => ({ value: v, label: v })));
  fillSelect($titulacion, uniqueFlat(OFERTA, 'titulaciones').map(v => ({ value: v, label: v })));
  fillSelect($area, uniqueFlat(OFERTA, 'areas').map(v => ({ value: v, label: v })));
  fillCiudades();

  function uniqueFlat(data, key) {
    return [...new Set(data.flatMap(d => d[key] || []))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function fillSelect(sel, options) {
    const first = sel.firstElementChild;
    sel.innerHTML = '';
    sel.appendChild(first);
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
  }

  function fillCiudades() {
    const pool = state.pais ? OFERTA.filter(d => d.pais === state.pais) : OFERTA;
    const ciudades = [...new Set(pool.map(d => d.ciudad).filter(c => c && c !== '—'))]
      .sort((a, b) => a.localeCompare(b, 'es'));
    fillSelect($ciudad, ciudades.map(c => ({ value: c, label: c })));
    $ciudad.value = state.ciudad;
    if ($ciudad.value !== state.ciudad) { state.ciudad = ''; }
  }

  function syncControls() {
    $pais.value = state.pais;
    fillCiudades();
    $idioma.value = state.idioma;
    $titulacion.value = state.titulacion;
    $area.value = state.area;
    $search.value = state.q;
  }

  const $body = document.getElementById('resultBody');
  const $count = document.getElementById('resultCount');
  const $empty = document.getElementById('emptyMsg');

  function applyFilters() {
    const q = state.q.trim().toLowerCase();
    const rows = OFERTA.filter(d =>
      (!state.pais || d.pais === state.pais) &&
      (!state.ciudad || d.ciudad === state.ciudad) &&
      (!state.idioma || (d.idiomas || []).includes(state.idioma)) &&
      (!state.titulacion || (d.titulaciones || []).includes(state.titulacion)) &&
      (!state.area || (d.areas || []).includes(state.area)) &&
      (!q ||
        (d.universidad || '').toLowerCase().includes(q) ||
        (d.nombreCorto || '').toLowerCase().includes(q) ||
        (d.ciudad || '').toLowerCase().includes(q) ||
        (d.paisNombre || '').toLowerCase().includes(q) ||
        (d.codigoErasmus || '').toLowerCase().includes(q))
    );
    render(rows);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(rows) {
    $count.textContent = rows.length;
    $empty.hidden = rows.length > 0;
    const html = rows.map((d, i) => {
      const idiomas = (d.idiomas || []).length
        ? d.idiomas.map(x => `<span class="mini-chip">${esc(x)}</span>`).join('')
        : '<span class="mini-chip">Sin requisito indicado</span>';
      const tit = (d.titulaciones || []).length
        ? d.titulaciones.map(x => `<span class="mini-chip">${esc(x)}</span>`).join('')
        : '—';
      const hasDetail = d.observaciones || d.certOriginal || d.areaOriginal || d.meses || d.beca;
      return `
      <tr class="row-main">
        <td><span class="uni-name">${esc(d.universidad)}</span>${d.nombreCorto ? `<span class="uni-alias">${esc(d.nombreCorto)}</span>` : ''}</td>
        <td>${esc(d.ciudad)}</td>
        <td><a class="pais-link" href="country.html?country=${encodeURIComponent(d.pais)}">${esc(d.paisNombre)}</a><span class="pais-tag">${esc(d.pais)}</span></td>
        <td>${d.codigoErasmus ? `<span class="code">${esc(d.codigoErasmus)}</span>` : '—'}</td>
        <td style="text-align:center"><span class="plazas-chip">${d.plazas != null ? d.plazas : '–'}</span></td>
        <td>${d.programa ? `<span class="prog-chip">${esc(d.programa)}</span>` : '—'}</td>
        <td>${tit}</td>
        <td>${idiomas}</td>
        <td>${hasDetail ? `<button class="row-toggle" type="button" aria-expanded="false" aria-controls="det-${i}" title="Ver detalles">+</button>` : ''}</td>
      </tr>
      ${hasDetail ? `
      <tr class="row-detail" id="det-${i}" hidden>
        <td colspan="9">
          <div class="detail-grid">
            <div>
              ${d.meses ? `<h4>Duración</h4><p>${esc(d.meses)} meses</p>` : ''}
              ${d.beca ? `<h4>Posibilidad de beca</h4><p>${esc(d.beca)}</p>` : ''}
              ${d.areaOriginal ? `<h4>Área de estudios (original)</h4><p>${esc(d.areaOriginal)}</p>` : ''}
            </div>
            <div>
              ${d.certOriginal && d.certOriginal !== '-' ? `<h4>Certificado de idioma</h4><p>${esc(d.certOriginal)}</p>` : ''}
              ${d.observaciones ? `<h4>Observaciones</h4><p>${esc(d.observaciones)}</p>` : ''}
            </div>
          </div>
        </td>
      </tr>` : ''}`;
    }).join('');
    $body.innerHTML = html;
  }

  // Delegación: expandir/plegar detalles
  $body.addEventListener('click', e => {
    const btn = e.target.closest('.row-toggle');
    if (!btn) return;
    const det = document.getElementById(btn.getAttribute('aria-controls'));
    const open = det.hidden;
    det.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });

  // Eventos de filtros
  $pais.addEventListener('change', () => { state.pais = $pais.value; state.ciudad = ''; fillCiudades(); applyFilters(); });
  $ciudad.addEventListener('change', () => { state.ciudad = $ciudad.value; applyFilters(); });
  $idioma.addEventListener('change', () => { state.idioma = $idioma.value; applyFilters(); });
  $titulacion.addEventListener('change', () => { state.titulacion = $titulacion.value; applyFilters(); });
  $area.addEventListener('change', () => { state.area = $area.value; applyFilters(); });
  $search.addEventListener('input', () => { state.q = $search.value; applyFilters(); });
  document.getElementById('btnClear').addEventListener('click', () => {
    state.pais = state.ciudad = state.idioma = state.titulacion = state.area = state.q = '';
    syncControls();
    applyFilters();
  });

  // Si venimos con ?country=XX en la URL, preseleccionar el país
  const urlPais = new URLSearchParams(window.location.search).get('country');
  if (urlPais && paisesSet.has(urlPais)) {
    state.pais = urlPais;
    syncControls();
  }

  // Primer render
  applyFilters();
  console.log('[ETSIT] ✓ Explorador inicializado');
})();
