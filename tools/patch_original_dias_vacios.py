"""Permite abrir cualquier día de la semana aunque no tenga entreno programado
(antes, al tocar un día vacío, la app volvía al primer día con entreno).
Uso: python3 patch_original_dias_vacios.py original.html salida.html"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
old = "  if (!state.activeDay || (!activePlan.days[state.activeDay] && !wo2MovedInto(activePlan, state.activeDay).length)){"
new = "  if (!state.activeDay || DAY_ORDER.indexOf(state.activeDay) < 0){"
assert h.count(old) == 1, 'NO ENCAJA'
h = h.replace(old, new)
open(p_out, 'w', encoding='utf-8').write(h)
print('Días vacíos accesibles:', p_out)
