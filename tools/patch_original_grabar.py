"""Sonidos que no paran la música y grabación de vídeo dentro de la app
(la cuenta atrás sigue sonando y visible mientras se graba).
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_grabar.py original.html salida.html
"""
import sys, os
p_in, p_out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
h = open(p_in, encoding='utf-8').read()
if 'function wo2OpenRecorder' in h:
    raise SystemExit('La app original ya tiene la grabación dentro de la app.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

JS = open(os.path.join(here, 'entreno_grabar.js'), encoding='utf-8').read()
patch("</head>", "<script>\n" + JS + "\n</script>\n</head>")

# Tarjeta grande de cada peso: botón «Grabar esta serie»
patch("    wo2RateMark(card, status, wo2SetOff(key));\n",
      "    wo2RateMark(card, status, wo2SetOff(key));\n    wo2RecButton(card, day, exIdx, entry, s);\n")
# Vídeos del ejercicio: «Grabar aquí» junto a «+ Añadir vídeo»
patch("  addVideoLabel.appendChild(videoInput);\n  videoHeading.appendChild(addVideoLabel);\n",
      "  addVideoLabel.appendChild(videoInput);\n"
      "  if (wo2RecSupported()){\n"
      "    const recHere = el('button', null, '🎥 Grabar aquí');\n"
      "    recHere.style.cssText = addVideoLabel.style.cssText;\n"
      "    recHere.onclick = (e)=>{ e.stopPropagation(); wo2OpenRecorder({ day, idx, label: entry.name || ('Código ' + entry.code) }); };\n"
      "    const vBtns = el('div'); vBtns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;';\n"
      "    vBtns.appendChild(recHere); vBtns.appendChild(addVideoLabel);\n"
      "    videoHeading.appendChild(vBtns);\n"
      "  } else {\n"
      "    videoHeading.appendChild(addVideoLabel);\n"
      "  }\n")
# Barra del descanso: botón de cámara
patch("  muteBtn.onclick = ()=> toggleRestTimerMute();\n  btns.appendChild(muteBtn);\n",
      "  muteBtn.onclick = ()=> toggleRestTimerMute();\n  btns.appendChild(muteBtn);\n"
      "  if (wo2RecSupported()){\n"
      "    const camBtn = el('button', null, '🎥');\n"
      "    camBtn.title = 'Grabar la serie sin salir de la app';\n"
      "    camBtn.setAttribute('aria-label', 'Grabar la serie sin salir de la app');\n"
      "    camBtn.style.cssText = muteBtn.style.cssText;\n"
      "    camBtn.onclick = ()=> wo2OpenRecorder(null);\n"
      "    btns.appendChild(camBtn);\n"
      "  }\n")

open(p_out, 'w', encoding='utf-8').write(h)
print('Grabación dentro de la app:', p_out)
