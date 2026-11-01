"""Botón «▶ Iniciar movimiento» (y el tiempo en curso) también en la tarjeta grande.
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_fctimer.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'wo2-fctimer' in h:
    raise SystemExit('La tarjeta grande ya tiene el botón Iniciar movimiento.')
def patch(old, new, count=1):
    global h
    n = h.count(old); assert n == count, ('NO ENCAJA', old[:140], n); h = h.replace(old, new)
patch("</head>", "<style>.fc-card .wo2-extimer.wo2-fctimer{ width:100%; margin:0 0 4px; }\n.fc-card .wo2-fctimer .wo2-exstart{ min-height:56px; font-size:19px; }\n.fc-card .wo2-fctimer .wo2-exrun, .fc-card .wo2-fctimer .wo2-exdone{ text-align:center; }</style>\n</head>")
patch("    card.appendChild(el('div','fc-kg', kgDisplayText(s)));\n",
      "    wo2ExTimerRow(card, plan, day, exIdx);\n    if (card.lastChild && card.lastChild.classList && card.lastChild.classList.contains('wo2-extimer')) card.lastChild.classList.add('wo2-fctimer');\n"
      "    card.appendChild(el('div','fc-kg', kgDisplayText(s)));\n")
open(p_out, 'w', encoding='utf-8').write(h)
print('Iniciar movimiento en la tarjeta:', p_out)
