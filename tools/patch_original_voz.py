"""Cuenta atrás con voz grabada (ElevenLabs) en lugar de la voz del móvil.
Los audios (voz/30.mp3, 10, 5, 4, 3, 2, 1, fin) suenan con el mismo sistema que
los pitidos, que en el iPhone puede mezclarse con la música en lugar de pararla.
Si un audio no ha cargado, se usa la voz del móvil como antes.
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_voz.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2VozPlay' in h:
    raise SystemExit('La app original ya tiene la voz grabada.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

JS = r"""<script>
// ===== Cuenta atrás con voz grabada =====
// Se reproduce con un elemento de audio normal (más fiable en el iPhone con
// otra app sonando, como Spotify). Los audios se «desbloquean» al empezar un
// descanso, que siempre viene de un toque. Si no pueden sonar, voz del móvil.
const WO2VOZ = { el:{}, ready:{}, loading:false, last:'' };
function wo2VozInit(){
  try{ if (navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){}
  ['30','10','5','4','3','2','1','fin'].forEach(k=>{
    let a = WO2VOZ.el[k];
    if (!a){
      a = new Audio('voz/' + k + '.mp3?v=1');
      a.preload = 'auto'; a.setAttribute('playsinline', '');
      WO2VOZ.el[k] = a;
    }
    if (WO2VOZ.ready[k]) return;
    // Desbloqueo: se reproduce en silencio y se para al momento (dentro del toque)
    try{
      a.muted = true;
      const pr = a.play();
      const done = ()=>{ try{ a.pause(); a.currentTime = 0; }catch(e){} a.muted = false; };
      if (pr && pr.then) pr.then(()=>{ done(); WO2VOZ.ready[k] = true; }).catch(()=>{ a.muted = false; });
      else { done(); WO2VOZ.ready[k] = true; }
    }catch(e){ a.muted = false; }
  });
}
// Devuelve true si ha empezado a sonar la voz grabada
function wo2VozPlay(what, fallbackText){
  const k = what === 'end' ? 'fin' : what === 's30' ? '30' : what === 's10' ? '10' : String(what);
  const a = WO2VOZ.el[k];
  if (!a || !WO2VOZ.ready[k]) return false;
  try{
    a.muted = false; a.volume = 1; a.currentTime = 0;
    const pr = a.play();
    if (pr && pr.catch) pr.catch((e)=>{ WO2VOZ.last = 'error ' + (e && e.name); if (fallbackText) speakText(fallbackText); });
    WO2VOZ.last = 'ok ' + k;
    return true;
  }catch(e){ WO2VOZ.last = 'error ' + e; return false; }
}
</script>
</head>"""
patch("</head>", JS)
patch("    speakText(say || String(what));", "    if (!wo2VozPlay(what, say || String(what))) speakText(say || String(what));")
patch("function startRestTimer(entry, kg, kind){\n", "function startRestTimer(entry, kg, kind){\n  try{ wo2VozInit(); }catch(e){}\n")

open(p_out, 'w', encoding='utf-8').write(h)
print('Voz grabada:', p_out)
