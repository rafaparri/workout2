"""Colorea cada peso según el resultado marcado (en la lista y en la tarjeta grande):
  no lo hice → rojo · 1-2 → naranja · 3-4 → azul · 5 → verde fosforito.
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_colores.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2RateMark' in h:
    raise SystemExit('La app original ya tiene los colores por resultado.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

CODE = """<style>
/* Colores por resultado: no hecho rojo · 1-2 naranja · 3-4 azul · 5 verde fosforito */
.set-chips .chip.wo2-rate.wo2-roff{ background:#e5484d !important; border:2px solid #e5484d !important; color:#fff !important; }
.set-chips .chip.wo2-rate.wo2-rlow{ background:#f28c28 !important; border:2px solid #f28c28 !important; color:#1a1206 !important; }
.set-chips .chip.wo2-rate.wo2-rmid{ background:#2f6fe4 !important; border:2px solid #2f6fe4 !important; color:#fff !important; }
.set-chips .chip.wo2-rate.wo2-rtop{ background:#39ff14 !important; border:2px solid #39ff14 !important; color:#041a00 !important; }
.set-chips .chip.wo2-rate.wo2-roff b, .set-chips .chip.wo2-rate.wo2-rmid b{ color:#fff !important; }
.set-chips .chip.wo2-rate.wo2-rlow b{ color:#1a1206 !important; }
.set-chips .chip.wo2-rate.wo2-rtop b{ color:#041a00 !important; }
.set-chips .chip.wo2-rate .wo2-chipoff{ color:inherit !important; opacity:.95; }
.fc-card.wo2-rate{ box-shadow:inset 0 0 0 6px var(--wo2-rc) !important; border-radius:18px; }
.fc-card.wo2-roff{ --wo2-rc:#e5484d; } .fc-card.wo2-rlow{ --wo2-rc:#f28c28; }
.fc-card.wo2-rmid{ --wo2-rc:#2f6fe4; } .fc-card.wo2-rtop{ --wo2-rc:#39ff14; }
</style>
<script>
function wo2RateMark(node, rating, off){
  const c = off ? 'wo2-roff' : rating >= 5 ? 'wo2-rtop' : rating >= 3 ? 'wo2-rmid' : rating >= 1 ? 'wo2-rlow' : '';
  if (!c) return;
  node.classList.add('wo2-rate', c);
}
</script>
</head>"""
patch("</head>", CODE)
patch("    wo2ChipOff(chip, plan, day, idx, si);\n",
      "    wo2ChipOff(chip, plan, day, idx, si);\n    wo2RateMark(chip, rating, wo2SetOff(checkKey(plan,day,idx,si)));\n")
patch("    wo2SetOffButton(card, plan, day, exIdx, cardIdx, s);\n",
      "    wo2SetOffButton(card, plan, day, exIdx, cardIdx, s);\n    wo2RateMark(card, status, wo2SetOff(key));\n")

# Mismos colores en los botones de valoración y en los análisis
patch("  { value:1, icon:'😫', color:'#c14a3a' }, // muy mal\n  { value:2, icon:'😞', color:'#d9793f' }, // mal\n  { value:3, icon:'😐', color:'#c99a2e' }, // regular\n  { value:4, icon:'🙂', color:'#5a8fb0' }, // bien\n  { value:5, icon:'💪', color:'#2f7dc4' }  // muy bien",
      "  { value:1, icon:'😫', color:'#e8702a' }, // muy mal\n  { value:2, icon:'😞', color:'#f28c28' }, // mal\n  { value:3, icon:'😐', color:'#2f6fe4' }, // regular\n  { value:4, icon:'🙂', color:'#4a86f0' }, // bien\n  { value:5, icon:'💪', color:'#39ff14' }  // muy bien")

open(p_out, 'w', encoding='utf-8').write(h)
print('Colores por resultado:', p_out)
