"""Pone entre paréntesis, junto al nombre de cada movimiento, el código o códigos
que vienen en la tabla de origen (p. ej. «Arr. lenta + Sentadilla de arrancada (9+53)»).
Uso: python3 patch_original_codigos.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2WithCode' in h:
    raise SystemExit('La app original ya tiene los códigos junto al nombre.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

FN = """<script>
// Códigos de la tabla de origen junto al nombre: «Nombre (9+53)»
function wo2CodeLabel(entry){
  if (!entry) return '';
  if (entry.parts && entry.parts.length) return entry.parts.map(p=> p.code).filter(c=> c !== null && c !== undefined).join('+');
  return (entry.code !== null && entry.code !== undefined) ? String(entry.code) : '';
}
function wo2WithCode(name, entry){
  const c = wo2CodeLabel(entry);
  return c ? name + ' (' + c + ')' : name;
}
</script>
</head>"""
patch("</head>", FN)

# Tarjeta de cada ejercicio del día
patch("  info.appendChild(el('div','ex-name' + (entry.name?'':' unknown'), nameText));",
      "  info.appendChild(el('div','ex-name' + (entry.name?'':' unknown'), entry.name ? wo2WithCode(nameText, entry) : nameText));")
# Tarjeta de cada peso (la que se abre al tocarlo)
patch("  titleWrap.appendChild(el('div','fc-name', entry.name || ('Código '+entry.code)));",
      "  titleWrap.appendChild(el('div','fc-name', entry.name ? wo2WithCode(entry.name, entry) : ('Código '+entry.code)));")
# Análisis por ejercicio
patch("    info.appendChild(el('div','ex-name', data.name || ('Código '+code)));",
      "    info.appendChild(el('div','ex-name', data.name ? data.name + ' (' + code + ')' : ('Código '+code)));")
# Récords (RM) por ejercicio
patch("    info.appendChild(el('div','ex-name', DICT[code] || ('Código '+code)));",
      "    info.appendChild(el('div','ex-name', DICT[code] ? DICT[code] + ' (' + code + ')' : ('Código '+code)));")

open(p_out, 'w', encoding='utf-8').write(h)
print('Códigos junto al nombre:', p_out)
