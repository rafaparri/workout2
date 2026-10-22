"""«Modo música»: los avisos del descanso suenan solo con pitidos (sin voz),
para no cortar la música del móvil. En el iPhone, la voz de la web siempre
para la música y no la reanuda; los pitidos sí pueden sonar por encima.
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_musica.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2Cue' in h:
    raise SystemExit('La app original ya tiene el modo música.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

JS = r"""<script>
// ===== Modo música: avisos solo con pitidos, sin voz =====
let wo2MusicMode = false;   // siempre voz grabada (el botón Voz/Música se quitó)
function wo2ToggleMusic(){
  wo2MusicMode = !wo2MusicMode;
  try{ localStorage.setItem('wo2_music_mode', wo2MusicMode ? '1' : '0'); }catch(e){}
  try{ if (navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){}
  if (wo2MusicMode){ try{ if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }catch(e){} }
  render();
}
function wo2Beeps(n, freq, gap, dur){
  for (let i = 0; i < n; i++) setTimeout(()=> playBeep(freq, dur), i * gap);
}
// Aviso del descanso: con voz (normal) o con pitidos (modo música)
function wo2Cue(what){
  if (restTimerMuted) return;
  if (!wo2MusicMode){
    const say = { end:'Descanso terminado', s30:'Treinta segundos', s10:'Diez segundos' }[what];
    speakText(say || String(what));
    return;
  }
  if (what === 'end') wo2Beeps(3, 1046, 260, 0.22);
  else if (what === 's30') wo2Beeps(2, 660, 260, 0.16);
  else if (what === 's10') wo2Beeps(3, 784, 220, 0.14);
  else wo2Beeps(1, 880, 0, 0.12);   // 5, 4, 3, 2, 1
}
</script>
</head>"""
patch("</head>", JS)

patch("      playHorn();\n      speakText('Descanso terminado');", "      playHorn();\n      wo2Cue('end');")
patch("    if (!restTimerMuted) speakText('Treinta segundos');", "    wo2Cue('s30');")
patch("    if (!restTimerMuted) speakText('Diez segundos');", "    wo2Cue('s10');")
patch("    if (!restTimerMuted) speakText('5');", "    wo2Cue(5);")
patch("    if (!restTimerMuted) speakText(String(remaining));", "    wo2Cue(remaining);")
# En modo música, la bocina de 30/10/5 s se sustituye por los pitidos (más suaves)
patch("    rt.thirtyBeeped = true;\n    playHorn();", "    rt.thirtyBeeped = true;\n    if (!wo2MusicMode) playHorn();")
patch("    rt.tenBeeped = true;\n    playHorn();", "    rt.tenBeeped = true;\n    if (!wo2MusicMode) playHorn();")
patch("    rt.lastSpokenSecond = 5;\n    playHorn();", "    rt.lastSpokenSecond = 5;\n    if (!wo2MusicMode) playHorn();")

# Los botones de la barra pasan a otra línea si no caben
patch("  btns.style.cssText = 'display:flex;gap:8px;align-items:center;';",
      "  btns.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';")

open(p_out, 'w', encoding='utf-8').write(h)
print('Modo música:', p_out)
