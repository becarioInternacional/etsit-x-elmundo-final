/* ============================================================
   ETSIT x ElMundo — assets/country.js
   Ficha de país: lee ?country=XX y pinta sus destinos en tarjetas.
   Solo necesita OFERTA (assets/data.js) — sin mapa ni librerías.
   ============================================================ */
(function () {
  'use strict';

  const $name = document.getElementById('countryName');
  const $cities = document.getElementById('countryCities');
  const $cards = document.getElementById('cards');
  const $count = document.getElementById('resultCount');
  const $empty = document.getElementById('emptyMsg');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (typeof OFERTA === 'undefined' || !Array.isArray(OFERTA)) {
    $empty.hidden = false;
    $empty.textContent = 'No se han podido cargar los datos (assets/data.js).';
    return;
  }

  const iso = new URLSearchParams(window.location.search).get('country') || '';
  const rows = OFERTA.filter(d => d.pais === iso);

  if (!rows.length) {
    $name.textContent = 'País no encontrado';
    $empty.hidden = false;
    $count.textContent = '0';
    return;
  }

  const nombre = rows[0].paisNombre;
  document.title = nombre + ' · ETSIT x ElMundo';
  $name.textContent = nombre;

  const plazas = rows.reduce((s, d) => s + (d.plazas || 0), 0);
  const unis = new Set(rows.map(d => d.universidad));
  const ciudades = [...new Set(rows.map(d => d.ciudad).filter(c => c && c !== '—'))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  document.getElementById('cStatPlazas').textContent = plazas;
  document.getElementById('cStatUnis').textContent = unis.size;
  document.getElementById('cStatCiudades').textContent = ciudades.length;
  $cities.textContent = ciudades.join(' · ');
  $count.textContent = rows.length;

  // Ordenar: más plazas primero, luego alfabético
  const ordenadas = rows.slice().sort((a, b) =>
    (b.plazas || 0) - (a.plazas || 0) || a.universidad.localeCompare(b.universidad, 'es'));

  $cards.innerHTML = ordenadas.map(d => {
    const idiomas = (d.idiomas || []).length
      ? d.idiomas.map(x => `<span class="mini-chip">${esc(x)}</span>`).join('')
      : '<span class="mini-chip">Sin requisito indicado</span>';
    const tit = (d.titulaciones || []).map(x => `<span class="mini-chip">${esc(x)}</span>`).join('') || '—';
    return `
    <article class="uni-card">
      <header class="uni-card__head">
        <div>
          <h3>${esc(d.universidad)}</h3>
          <p class="uni-card__meta">
            ${esc(d.ciudad)}
            ${d.codigoErasmus ? ` · <span class="code">${esc(d.codigoErasmus)}</span>` : ''}
          </p>
        </div>
        <span class="plazas-chip plazas-chip--big" title="Plazas">${d.plazas != null ? d.plazas : '–'}</span>
      </header>
      <div class="uni-card__rows">
        ${d.programa ? `<div class="uni-card__row"><h4>Programa</h4><div><span class="prog-chip">${esc(d.programa)}</span>${d.meses ? ` <span class="mini-chip">${esc(d.meses)} meses</span>` : ''}</div></div>` : ''}
        <div class="uni-card__row"><h4>Titulación</h4><div>${tit}</div></div>
        <div class="uni-card__row"><h4>Idioma</h4><div>${idiomas}</div></div>
        ${d.certOriginal && d.certOriginal !== '-' ? `<div class="uni-card__row"><h4>Certificado</h4><p>${esc(d.certOriginal)}</p></div>` : ''}
        ${d.areaOriginal ? `<div class="uni-card__row"><h4>Área de estudios</h4><p>${esc(d.areaOriginal)}</p></div>` : ''}
        ${d.beca ? `<div class="uni-card__row"><h4>Beca</h4><p>${esc(d.beca)}</p></div>` : ''}
        ${d.observaciones ? `<div class="uni-card__row"><h4>Observaciones</h4><p>${esc(d.observaciones)}</p></div>` : ''}
      </div>
    </article>`;
  }).join('');
})();
