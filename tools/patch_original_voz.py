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
const WO2VOZ = { buf:{}, loading:false };
function wo2VozCtx(){
  try{ if (navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){}
  if (!restAudioCtx) restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (restAudioCtx.state === 'suspended') restAudioCtx.resume();
  return restAudioCtx;
}
// Se llama al empezar un descanso (tras un toque): desbloquea el sonido y carga los audios
function wo2VozInit(){
  let ctx; try{ ctx = wo2VozCtx(); }catch(e){ return; }
  if (WO2VOZ.loading) return;
  WO2VOZ.loading = true;
  ['30','10','5','4','3','2','1','fin'].forEach(k=>{
    fetch('voz/' + k + '.mp3?v=1').then(r=> r.ok ? r.arrayBuffer() : Promise.reject())
      .then(ab=> new Promise((res, rej)=> ctx.decodeAudioData(ab, res, rej)))
      .then(b=>{ WO2VOZ.buf[k] = b; }).catch(()=>{});
  });
}
// Devuelve true si ha podido sonar la voz grabada
function wo2VozPlay(what){
  const k = what === 'end' ? 'fin' : what === 's30' ? '30' : what === 's10' ? '10' : String(what);
  const b = WO2VOZ.buf[k];
  if (!b) return false;
  try{
    const ctx = wo2VozCtx();
    const src = ctx.createBufferSource(); src.buffer = b;
    const g = ctx.createGain(); g.gain.value = 1;
    src.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + 0.02);
    return true;
  }catch(e){ return false; }
}
</script>
</head>"""
patch("</head>", JS)
patch("    speakText(say || String(what));", "    if (!wo2VozPlay(what)) speakText(say || String(what));")
patch("function startRestTimer(entry, kg, kind){\n", "function startRestTimer(entry, kg, kind){\n  try{ wo2VozInit(); }catch(e){}\n")

open(p_out, 'w', encoding='utf-8').write(h)
print('Voz grabada:', p_out)
