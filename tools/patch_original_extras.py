"""Añade a la app original (mi-plan-halterofilia.html) las funciones:
  1) día no entrenado con motivo, 2) pesos/series/repes no hechos con motivo,
  3) pasar el entreno de un día a otro, 4) tabla de códigos con zoom.
WorkOut 2.0 las hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_extras.py original.html salida.html
"""
import sys, os, re
p_in, p_out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
h = open(p_in, encoding='utf-8').read()
if 'function wo2DayTools' in h:
    raise SystemExit('La app original ya tiene estas funciones.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

EXTRAS_JS = open(os.path.join(here, 'entreno_extras.js'), encoding='utf-8').read()
EXTRAS_CSS = open(os.path.join(here, 'entreno_extras.css'), encoding='utf-8').read()

# --- Guardado: los extras van con el resto de datos del deportista (wo2x) ---
patch("return { plans:p.plans||[], checks:p.checks||{}, notes:p.notes||{}, seriesProgress:p.seriesProgress||{} }; })() : { plans:[], checks:{}, notes:{}, seriesProgress:{} };",
      "return { plans:p.plans||[], checks:p.checks||{}, notes:p.notes||{}, seriesProgress:p.seriesProgress||{}, wo2x:p.wo2x||{} }; })() : { plans:[], checks:{}, notes:{}, seriesProgress:{}, wo2x:{} };")
patch("    const empty = { plans:[], checks:{}, notes:{}, seriesProgress:{} };",
      "    const empty = { plans:[], checks:{}, notes:{}, seriesProgress:{}, wo2x:{} };")
patch("  saveUserDataAsync(activeUserId, { plans: state.plans, checks: state.checks, notes: state.notes, seriesProgress: state.seriesProgress });",
      "  saveUserDataAsync(activeUserId, { plans: state.plans, checks: state.checks, notes: state.notes, seriesProgress: state.seriesProgress, wo2x: state.wo2x || {} });")
patch("seriesProgress: (data&&data.seriesProgress)||{} };",
      "seriesProgress: (data&&data.seriesProgress)||{}, wo2x: (data&&data.wo2x)||{} };")
patch("state.notes = d.notes; state.seriesProgress = d.seriesProgress;",
      "state.notes = d.notes; state.seriesProgress = d.seriesProgress; state.wo2x = d.wo2x || {};")
# Al cambiar de deportista / arrancar
n = len(re.findall(r"\n(\s*)state\.seriesProgress = data\.seriesProgress \|\| \{\};", h))
assert n == 3, ('cargas', n)
h = re.sub(r"\n(\s*)state\.seriesProgress = data\.seriesProgress \|\| \{\};",
           lambda m: "\n" + m.group(1) + "state.seriesProgress = data.seriesProgress || {};\n" + m.group(1) + "state.wo2x = data.wo2x || {};", h)

# --- Interfaz ---
# Un día vale si tiene entreno traspasado aunque no tenga el suyo
patch("  if (!state.activeDay || !activePlan.days[state.activeDay]){",
      "  if (!state.activeDay || (!activePlan.days[state.activeDay] && !wo2MovedInto(activePlan, state.activeDay).length)){")
# Marca en el botón de cada día
patch("    } else {\n      plate.textContent = '+';\n    }\n",
      "    } else {\n      plate.textContent = '+';\n    }\n    wo2PlateMark(plan, d, plate);\n")
# Pesos no hechos cuentan como resueltos
patch("      if (state.checks[checkKey(plan,day,exIdx,setIdx)]) checkedSets++;",
      "      if (state.checks[checkKey(plan,day,exIdx,setIdx)] || wo2SetOff(checkKey(plan,day,exIdx,setIdx))) checkedSets++;")
# Botones del día, día traspasado y entreno traspasado aquí
patch("  } else {\n    if (entries.length === 0){",
      "  } else {\n    wo2DayTools(section, plan, state.activeDay);\n    if (entries.length === 0 && !wo2MovedInto(plan, state.activeDay).length){")
patch("    entries.forEach((entry, idx)=>{\n      if (entry.type === 'rest'){",
      "    (wo2DayHidden(plan, state.activeDay) ? [] : entries).forEach((entry, idx)=>{\n      if (entry.type === 'rest'){")
patch("      section.appendChild(renderExerciseCard(plan, state.activeDay, entry, idx));\n    });\n  }\n",
      "      section.appendChild(renderExerciseCard(plan, state.activeDay, entry, idx));\n    });\n    wo2MovedBlock(section, plan, state.activeDay);\n  }\n")
# Peso no hecho: en la lista y en la tarjeta
patch("    chip.onclick = (e)=>{ e.stopPropagation(); openFlashcards(day, idx, si); };\n    chips.appendChild(chip);",
      "    chip.onclick = (e)=>{ e.stopPropagation(); openFlashcards(day, idx, si); };\n    wo2ChipOff(chip, plan, day, idx, si);\n    chips.appendChild(chip);")
patch("    card.appendChild(markRow);\n\n    const stopBtn",
      "    card.appendChild(markRow);\n    wo2SetOffButton(card, plan, day, exIdx, cardIdx, s);\n\n    const stopBtn")
# Tabla de códigos
patch("  actions.appendChild(menuBtn);\n  top.appendChild(actions);\n  wrap.appendChild(top);\n",
      "  actions.appendChild(menuBtn);\n  const codesBtn = el('button','tb-btn','📖 Códigos');\n  codesBtn.onclick = ()=> wo2ShowCodes();\n  actions.appendChild(codesBtn);\n  top.appendChild(actions);\n  wrap.appendChild(top);\n")

# Código y estilos
patch("</head>", "<style>\n" + EXTRAS_CSS + "\n</style>\n<script>\n" + EXTRAS_JS + "\n</script>\n</head>")

open(p_out, 'w', encoding='utf-8').write(h)
print('Extras añadidos:', p_out)
