# ETSIT x ElMundo 🌍

Mapa interactivo de la oferta de plazas de movilidad internacional de la **ETSIT-UPM**
(Erasmus+, acuerdos bilaterales, Magalhães-SMILE, SICUE y EIT Health).

Versión fusionada: diseño y explorador con 5 filtros + mapa coropleta D3 (sin CDN,
librerías vendorizadas) + ficha por país (`country.html`) + workflow de GitHub Actions
que reconstruye los datos desde el Excel en cada push.

## Estructura

```
etsit-por-el-mundo/
├── index.html                  # Portada: mapa + explorador con filtros
├── country.html                # Ficha de país (?country=XX)
├── assets/
│   ├── app.css                 # Estilos de toda la web
│   ├── app.js                  # Mapa, filtros y tabla
│   ├── country.js              # Lógica de la ficha de país
│   ├── data.js                 # ← Datos de la oferta (GENERADO, no editar)
│   ├── world.js                # TopoJSON mundial embebido (GENERADO)
│   └── vendor/
│       ├── d3.min.js           # D3 v7 en local — sin depender de CDN
│       └── topojson-client.min.js
├── data/
│   ├── Oferta_de_plazas_2026-27_web_OI.xlsx   # ← Fuente de la verdad
│   └── oferta.json             # Mismo dataset en JSON legible (GENERADO)
├── tools/
│   └── build_data.py           # Excel → data.js + oferta.json
└── .github/workflows/deploy.yml # Rebuild de datos + deploy a Pages en cada push
```

**Por qué es robusto:**
- Los datos van **embebidos** en `assets/data.js` y `assets/world.js` en lugar de
  cargarse con `fetch` → funciona igual con doble clic en local que en GitHub Pages,
  sin CORS ni rutas rotas.
- D3 y topojson-client están **vendorizados** en `assets/vendor/` → si un CDN está
  caído o bloqueado, la web sigue funcionando.
- Si aun así el mapa fallara, los **filtros y la tabla funcionan igualmente** (van en
  un bloque independiente con try/catch) y se muestra un aviso en lugar del mapa.
- La consola del navegador (F12) registra cada paso con el prefijo `[ETSIT]` para
  diagnosticar problemas.

## Filtros del explorador

País · Ciudad (dependiente del país) · Idioma/CERT (normalizado desde la columna
`CERT`) · Titulación (derivada de las columnas `GITST`/`GIB`/`GISD`/`MASTER` = SI) ·
Área de estudios (clasificada en 4 áreas canónicas) · Buscador libre.

Cada fila se expande con «+» para ver duración, beca, certificado de idioma original,
área original y observaciones.

## Actualizar los datos

Edita `data/Oferta_de_plazas_2026-27_web_OI.xlsx` y haz push: el workflow reconstruye
`data.js` y despliega automáticamente. Para hacerlo en local:

```bash
pip install pandas openpyxl        # solo la primera vez
python tools/build_data.py         # o pásale otra ruta de Excel como argumento
```

El script normaliza países (`UK → GB`, `Rep Dom → DO`, `FR y US → FR`…), extrae
idiomas de `CERT`, deriva titulaciones de las columnas SI/NO y avisa por consola si
aparece un país nuevo sin mapeo (añádelo a `ISO_NOMBRE` e `ISO_NUM`) o filas con
plazas no numéricas.

## Publicar en GitHub Pages

**Opción A — con el workflow (recomendada):**
1. Sube todo a la rama `main` del repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push reconstruye los datos desde el Excel y despliega.

**Opción B — sin Actions:** genera `data.js` en local con el script, súbelo, y en
**Settings → Pages** elige **Deploy from a branch → main /(root)**. La web es 100 %
estática y no necesita build.

## Créditos

- Mapa base: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, dominio público).
- Renderizado: [D3.js](https://d3js.org/) + [topojson-client](https://github.com/topojson/topojson-client).
