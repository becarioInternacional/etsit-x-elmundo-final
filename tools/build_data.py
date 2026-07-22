#!/usr/bin/env python3
"""
build_data.py — Convierte el Excel de oferta de plazas en los datos que consume la web.

Uso:
    python tools/build_data.py [ruta_al_excel.xlsx]
    (por defecto usa data/Oferta_de_plazas_2026-27_web_OI.xlsx)

Genera:
    data/oferta.json    (JSON legible, para inspección)
    assets/data.js      (const OFERTA = [...]; — lo que cargan index.html y country.html)

Requiere: pandas, openpyxl
"""
import sys, os, json, re
import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_DEFECTO = os.path.join(BASE, 'data', 'Oferta_de_plazas_2026-27_web_OI.xlsx')

PAIS_FIX = {'Francia': 'FR', 'Hungría': 'HU', 'Italia': 'IT', 'Polonia': 'PL', 'Rumanía': 'RO',
            'Serbia': 'RS', 'Turquía': 'TR', 'Rep Dom': 'DO', 'FR y US': 'FR', 'UK': 'GB'}

ISO_NOMBRE = {'AR': 'Argentina', 'AT': 'Austria', 'AU': 'Australia', 'BE': 'Bélgica', 'BG': 'Bulgaria',
              'BR': 'Brasil', 'CA': 'Canadá', 'CH': 'Suiza', 'CL': 'Chile', 'CN': 'China', 'CO': 'Colombia',
              'CZ': 'Chequia', 'DE': 'Alemania', 'DK': 'Dinamarca', 'DO': 'República Dominicana',
              'EC': 'Ecuador', 'ES': 'España', 'FI': 'Finlandia', 'FR': 'Francia', 'GB': 'Reino Unido',
              'GR': 'Grecia', 'HR': 'Croacia', 'HU': 'Hungría', 'IE': 'Irlanda', 'IT': 'Italia',
              'JP': 'Japón', 'MK': 'Macedonia del Norte', 'MX': 'México', 'MY': 'Malasia',
              'NL': 'Países Bajos', 'NO': 'Noruega', 'PA': 'Panamá', 'PE': 'Perú', 'PL': 'Polonia',
              'PR': 'Puerto Rico', 'PT': 'Portugal', 'RO': 'Rumanía', 'RS': 'Serbia', 'SE': 'Suecia',
              'SI': 'Eslovenia', 'TR': 'Turquía', 'TW': 'Taiwán', 'US': 'Estados Unidos', 'UY': 'Uruguay'}

# ISO2 -> id numérico ISO 3166-1 usado por el TopoJSON de world-atlas
ISO_NUM = {'AR': '032', 'AT': '040', 'AU': '036', 'BE': '056', 'BG': '100', 'BR': '076', 'CA': '124',
           'CH': '756', 'CL': '152', 'CN': '156', 'CO': '170', 'CZ': '203', 'DE': '276', 'DK': '208',
           'DO': '214', 'EC': '218', 'ES': '724', 'FI': '246', 'FR': '250', 'GB': '826', 'GR': '300',
           'HR': '191', 'HU': '348', 'IE': '372', 'IT': '380', 'JP': '392', 'MK': '807', 'MX': '484',
           'MY': '458', 'NL': '528', 'NO': '578', 'PA': '591', 'PE': '604', 'PL': '616', 'PR': '630',
           'PT': '620', 'RO': '642', 'RS': '688', 'SE': '752', 'SI': '705', 'TR': '792', 'TW': '158',
           'US': '840', 'UY': '858'}

PROGRAMA_NOMBRE = {'ER': 'Erasmus+', 'AB': 'Acuerdo bilateral', 'MS': 'Magalhães-SMILE', 'SICUE': 'SICUE',
                   'ER/EIT HEALTH': 'Erasmus+ / EIT Health', 'MS/AB': 'Magalhães / Bilateral',
                   'AB/ER': 'Bilateral / Erasmus+'}

IDIOMA_MAPA = {'INGLÉS': 'Inglés', 'INGLES': 'Inglés', 'IELTS': 'Inglés', 'TOEFL': 'Inglés',
               'CAE': 'Inglés', 'CPE': 'Inglés', 'ALEMÁN': 'Alemán', 'ALEMAN': 'Alemán',
               'FRANCÉS': 'Francés', 'FRANCES': 'Francés', 'DELF': 'Francés',
               'HOLANDÉS': 'Neerlandés', 'HOLANDES': 'Neerlandés',
               'PORTUGUES': 'Portugués', 'PORTUGUÉS': 'Portugués', 'ITALIANO': 'Italiano',
               'ESPAÑOL': 'Español', 'CHECO': 'Checo', 'SUECO': 'Sueco', 'NORUEGO': 'Noruego',
               'DANÉS': 'Danés', 'DANES': 'Danés', 'POLACO': 'Polaco', 'JAPONÉS': 'Japonés',
               'JAPONES': 'Japonés', 'CHINO': 'Chino', 'TURCO': 'Turco', 'GRIEGO': 'Griego',
               'FINÉS': 'Finés', 'CROATA': 'Croata', 'HÚNGARO': 'Húngaro'}

# Titulaciones derivadas de las columnas SI/NO del Excel
COLS_TITULACION = [('GITST', 'GITST'), ('GIB', 'GIB'), ('GISD', 'GISD'), ('MASTER', 'MÁSTER')]


def norm_pais(v):
    return PAIS_FIX.get(str(v).strip(), str(v).strip())


def parse_idiomas(cert):
    if pd.isna(cert):
        return []
    t = str(cert).upper()
    found = []
    for k, v in IDIOMA_MAPA.items():
        if k in t and v not in found:
            found.append(v)
    if not found and t.strip() not in ('-', ''):
        found.append('Otro / ver certificado')
    return found


def parse_titulaciones(row):
    out = []
    for col, label in COLS_TITULACION:
        val = row.get(col)
        if pd.notna(val) and str(val).strip().upper() == 'SI':
            out.append(label)
    return out


def parse_areas(a):
    if pd.isna(a):
        return []
    t = str(a)
    out = []
    if re.search(r'Electricity and Energy', t, re.I):
        out.append('Ing. Eléctrica (Electricidad y Energía)')
    if re.search(r'Electronics and Automation', t, re.I):
        out.append('Ing. Electrónica y Automática')
    elif re.search(r'Electrical Engineering', t, re.I) and not out:
        out.append('Ing. Electrónica y Automática')
    if re.search(r'Computer ?Science|ICT', t, re.I):
        out.append('Informática / TIC')
    if re.search(r'Biomedical', t, re.I):
        out.append('Ing. Biomédica')
    return out


def clean(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def main():
    excel = sys.argv[1] if len(sys.argv) > 1 else EXCEL_DEFECTO
    df = pd.read_excel(excel)
    df = df[df['UNIVERSIDAD'].notna()].copy()
    df = df[df['PAÍS'].notna() & (df['PAÍS'].astype(str).str.strip() != 'País')]

    rows = []
    for _, r in df.iterrows():
        iso = norm_pais(r['PAÍS'])
        rows.append({
            'universidad': clean(r['UNIVERSIDAD']),
            'nombreCorto': clean(r.get('Nombre Uni corto para app')),
            'ciudad': clean(r['CIUDAD']) or '—',
            'pais': iso,
            'paisNombre': ISO_NOMBRE.get(iso, iso),
            'paisNum': ISO_NUM.get(iso),
            'codigoErasmus': clean(r['CÓDIGO ERASMUS']),
            'programa': PROGRAMA_NOMBRE.get(clean(r['PROGRAMA']) or '', clean(r['PROGRAMA'])),
            'plazas': to_int(r['PLAZAS']),
            'meses': clean(r.get('MES')),
            'beca': clean(r.get('Posibilidad de beca?')),
            'idiomas': parse_idiomas(r['CERT']),
            'certOriginal': clean(r['CERT']),
            'titulaciones': parse_titulaciones(r),
            'areas': parse_areas(r['Area de Estudios']),
            'areaOriginal': clean(r['Area de Estudios']),
            'observaciones': clean(r['OBSERVACIONES']),
        })

    os.makedirs(os.path.join(BASE, 'data'), exist_ok=True)
    with open(os.path.join(BASE, 'data', 'oferta.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BASE, 'assets', 'data.js'), 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/build_data.py a partir del Excel de oferta de plazas — no editar a mano\n')
        f.write('const OFERTA = ')
        json.dump(rows, f, ensure_ascii=False)
        f.write(';\n')

    sin_num = sorted(set(x['pais'] for x in rows if not x['paisNum']))
    sin_plazas = [x['universidad'] for x in rows if x['plazas'] is None]
    print(f'✓ {len(rows)} destinos · {sum(x["plazas"] or 0 for x in rows)} plazas · '
          f'{len(set(x["pais"] for x in rows))} países · {len(set(x["universidad"] for x in rows))} universidades')
    if sin_num:
        print(f'⚠ Países sin mapeo en el mapa (añádelos a ISO_NUM): {sin_num}')
    if sin_plazas:
        print(f'⚠ Filas sin nº de plazas válido (revisa el Excel): {sin_plazas}')


if __name__ == '__main__':
    main()
