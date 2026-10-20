// ===== Sonido junto a la música y grabación de vídeo dentro de la app =====
// 1) Los pitidos y avisos suenan por encima de la música en lugar de pararla
//    (iPhone con iOS 16.4 o posterior: navigator.audioSession).
// 2) «Grabar aquí»: graba la serie con la cámara sin salir de la app, así la
//    cuenta atrás sigue en pantalla y sonando mientras se graba.
function wo2SetAudioMode(type){
  try{ if (navigator.audioSession) navigator.audioSession.type = type; }catch(e){}
}
wo2SetAudioMode('ambient');

const WO2REC = { stream:null, rec:null, chunks:[], mime:'', facing:'environment', mic:false, ctx:null, tick:null, el:null, blob:null, url:null };
try{ WO2REC.mic = localStorage.getItem('wo2_rec_mic') === '1'; }catch(e){}

function wo2RecSupported(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
function wo2RecMime(){
  const opts = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  for (const m of opts){ try{ if (MediaRecorder.isTypeSupported(m)) return m; }catch(e){} }
  return '';
}

function wo2RecCss(){
  if (document.getElementById('wo2RecCss')) return;
  const s = document.createElement('style'); s.id = 'wo2RecCss';
  s.textContent = `
  .wo2-rec{ position:fixed; inset:0; z-index:9800; background:#000; color:#fff; display:flex; flex-direction:column; font-family:Archivo,Inter,system-ui,sans-serif; }
  .wo2-rec video{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; }
  .wo2-rec .top{ position:relative; z-index:2; display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:calc(12px + env(safe-area-inset-top,0px)) 14px 0; }
  .wo2-rec .bot{ position:relative; z-index:2; margin-top:auto; display:flex; flex-direction:column; gap:12px; align-items:center; padding:0 14px calc(18px + env(safe-area-inset-bottom,0px)); }
  .wo2-rec .chip{ background:rgba(0,0,0,.55); border-radius:14px; padding:8px 12px; font-size:15px; font-weight:700; }
  .wo2-rec .timer{ background:rgba(0,0,0,.6); border-radius:18px; padding:8px 16px; text-align:center; }
  .wo2-rec .timer .l{ font-size:13px; font-weight:800; letter-spacing:.12em; opacity:.85; }
  .wo2-rec .timer .t{ font-size:44px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1.05; }
  .wo2-rec .timer.done{ background:rgba(63,178,111,.85); }
  .wo2-rec .row{ display:flex; gap:12px; align-items:center; justify-content:center; flex-wrap:wrap; }
  .wo2-rec button{ border:none; cursor:pointer; font:800 16px Archivo,Inter,system-ui,sans-serif; color:#fff; background:rgba(255,255,255,.18); border-radius:999px; min-height:52px; padding:0 18px; }
  .wo2-rec .big{ width:84px; height:84px; min-height:84px; padding:0; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 5px rgba(255,255,255,.35); }
  .wo2-rec .big i{ display:block; width:62px; height:62px; border-radius:50%; background:#e5484d; transition:all .2s; }
  .wo2-rec .big.on i{ width:32px; height:32px; border-radius:7px; }
  .wo2-rec .dot{ display:inline-block; width:10px; height:10px; border-radius:50%; background:#e5484d; margin-right:6px; animation:wo2blink 1s infinite; }
  @keyframes wo2blink{ 50%{ opacity:.2; } }
  .wo2-rec .msg{ background:rgba(0,0,0,.6); border-radius:12px; padding:10px 14px; font-size:15px; max-width:420px; text-align:center; line-height:1.4; }
  .wo2-rec .save{ background:#34d1c4; color:#06201d; }
  `;
  document.head.appendChild(s);
}

async function wo2RecStartCamera(){
  wo2RecStopCamera();
  const v = WO2REC.el && WO2REC.el.querySelector('video');
  try{
    WO2REC.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: WO2REC.facing, width:{ ideal:1280 }, height:{ ideal:720 } },
      audio: WO2REC.mic
    });
  }catch(e){
    wo2RecMsg('No se ha podido abrir la cámara. Revisa que la app tenga permiso para usarla (Ajustes del móvil) y vuelve a intentarlo.');
    return false;
  }
  if (v){ v.srcObject = WO2REC.stream; v.muted = true; v.setAttribute('playsinline',''); try{ await v.play(); }catch(e){} }
  // Con el micrófono activo, el iPhone pasa a «grabar y reproducir»: se pide el altavoz igualmente
  wo2SetAudioMode(WO2REC.mic ? 'play-and-record' : 'ambient');
  return true;
}
function wo2RecStopCamera(){
  try{ if (WO2REC.stream) WO2REC.stream.getTracks().forEach(t=> t.stop()); }catch(e){}
  WO2REC.stream = null;
  wo2SetAudioMode('ambient');
}
function wo2RecMsg(t){
  const m = WO2REC.el && WO2REC.el.querySelector('.msg');
  if (m){ m.textContent = t || ''; m.style.display = t ? '' : 'none'; }
}
function wo2RecTimerUpdate(){
  const box = WO2REC.el && WO2REC.el.querySelector('.timer'); if (!box) return;
  const rt = (typeof state !== 'undefined') ? state.restTimer : null;
  if (!rt){ box.style.display = 'none'; return; }
  box.style.display = '';
  const rem = Math.max(0, Math.ceil((rt.endsAt - Date.now())/1000));
  box.classList.toggle('done', rem <= 0);
  box.querySelector('.l').textContent = rem <= 0 ? 'DESCANSO TERMINADO' : 'DESCANSO';
  box.querySelector('.t').textContent = rem <= 0 ? '¡Vamos!' : (Math.floor(rem/60) + ':' + String(rem%60).padStart(2,'0'));
}

function wo2OpenRecorder(ctx){
  if (!wo2RecSupported()){
    try{ wo2Toast ? wo2Toast('Este navegador no permite grabar desde la app. Usa «+ Añadir vídeo».') : null; }catch(e){}
    return;
  }
  wo2RecCss();
  WO2REC.ctx = ctx || null;
  const o = document.createElement('div'); o.className = 'wo2-rec'; o.setAttribute('role','dialog'); o.setAttribute('aria-label','Grabar vídeo');
  o.innerHTML = '<video playsinline muted autoplay></video>' +
    '<div class="top"><div class="chip lbl"></div><div class="timer"><div class="l">DESCANSO</div><div class="t">0:00</div></div></div>' +
    '<div class="bot"><div class="msg" style="display:none"></div>' +
    '<div class="row"><button type="button" class="flip" aria-label="Cambiar de cámara">⟲ Cámara</button>' +
    '<button type="button" class="big" aria-label="Empezar a grabar"><i></i></button>' +
    '<button type="button" class="mic"></button></div>' +
    '<div class="row"><button type="button" class="close">✕ Cerrar</button></div></div>';
  document.body.appendChild(o);
  WO2REC.el = o;
  const lbl = o.querySelector('.lbl');
  lbl.textContent = (ctx && ctx.label) ? ctx.label : 'Grabar serie';
  const micBtn = o.querySelector('.mic');
  const setMic = ()=>{ micBtn.textContent = WO2REC.mic ? '🎙️ Con sonido' : '🔇 Sin sonido'; };
  setMic();
  micBtn.onclick = async ()=>{
    if (WO2REC.rec) return;
    WO2REC.mic = !WO2REC.mic; setMic();
    try{ localStorage.setItem('wo2_rec_mic', WO2REC.mic ? '1' : '0'); }catch(e){}
    await wo2RecStartCamera();
    wo2RecMsg(WO2REC.mic ? 'Con sonido, el iPhone puede bajar el volumen de los avisos mientras grabas.' : '');
  };
  o.querySelector('.flip').onclick = async ()=>{
    if (WO2REC.rec) return;
    WO2REC.facing = WO2REC.facing === 'environment' ? 'user' : 'environment';
    await wo2RecStartCamera();
  };
  o.querySelector('.close').onclick = ()=> wo2CloseRecorder();
  o.querySelector('.big').onclick = ()=> WO2REC.rec ? wo2RecStop() : wo2RecStart();
  WO2REC.tick = setInterval(wo2RecTimerUpdate, 500);
  wo2RecTimerUpdate();
  try{ if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l=>{ WO2REC.lock = l; }).catch(()=>{}); }catch(e){}
  wo2RecStartCamera();
}

function wo2RecStart(){
  if (!WO2REC.stream) return;
  WO2REC.mime = wo2RecMime();
  WO2REC.chunks = [];
  try{
    WO2REC.rec = WO2REC.mime ? new MediaRecorder(WO2REC.stream, { mimeType: WO2REC.mime }) : new MediaRecorder(WO2REC.stream);
  }catch(e){ wo2RecMsg('No se ha podido empezar a grabar.'); WO2REC.rec = null; return; }
  WO2REC.rec.ondataavailable = (e)=>{ if (e.data && e.data.size) WO2REC.chunks.push(e.data); };
  WO2REC.rec.onstop = wo2RecDone;
  WO2REC.rec.start(1000);
  const big = WO2REC.el.querySelector('.big'); big.classList.add('on'); big.setAttribute('aria-label','Parar la grabación');
  WO2REC.el.querySelector('.lbl').innerHTML = '<span class="dot"></span>Grabando';
  WO2REC.el.querySelector('.flip').disabled = true; WO2REC.el.querySelector('.mic').disabled = true;
  wo2RecMsg('');
}
function wo2RecStop(){
  try{ if (WO2REC.rec && WO2REC.rec.state !== 'inactive') WO2REC.rec.stop(); }catch(e){}
}
function wo2RecDone(){
  const type = (WO2REC.rec && WO2REC.rec.mimeType) || WO2REC.mime || 'video/mp4';
  WO2REC.rec = null;
  const blob = new Blob(WO2REC.chunks, { type });
  WO2REC.chunks = [];
  const ext = /mp4/.test(type) ? 'mp4' : 'webm';
  const d = new Date();
  const name = 'serie-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + String(d.getHours()).padStart(2,'0') + String(d.getMinutes()).padStart(2,'0') + String(d.getSeconds()).padStart(2,'0') + '.' + ext;
  const file = new File([blob], name, { type });
  const url = URL.createObjectURL(blob);
  // Se añade a los vídeos del ejercicio (si se abrió desde uno)
  try{
    const c = WO2REC.ctx;
    if (c && c.day != null && c.idx != null && typeof state !== 'undefined' && state.exerciseVideos){
      const k = c.day + '|' + c.idx;
      if (!state.exerciseVideos[k]) state.exerciseVideos[k] = [];
      state.exerciseVideos[k].push({ id:'v'+Date.now(), name, url, analysis:null, formatWarning:false });
    }
  }catch(e){}
  const o = WO2REC.el; if (!o) return;
  const big = o.querySelector('.big'); big.classList.remove('on'); big.setAttribute('aria-label','Empezar a grabar');
  o.querySelector('.flip').disabled = false; o.querySelector('.mic').disabled = false;
  o.querySelector('.lbl').textContent = 'Vídeo listo';
  const row = o.querySelectorAll('.row')[1];
  row.querySelectorAll('.save').forEach(b=> b.remove());
  const save = document.createElement('button'); save.type = 'button'; save.className = 'save'; save.textContent = '⬇ Guardar en el móvil';
  save.onclick = async ()=>{
    try{
      if (navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:name }); return; }
    }catch(e){ if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };
  row.insertBefore(save, row.firstChild);
  wo2RecMsg((WO2REC.ctx && WO2REC.ctx.day != null) ? 'Guardado en los vídeos del ejercicio. Pulsa «Guardar en el móvil» y elige «Guardar vídeo» para tenerlo en Fotos.' : 'Pulsa «Guardar en el móvil» y elige «Guardar vídeo» para tenerlo en Fotos.');
}
function wo2CloseRecorder(){
  if (WO2REC.rec){ try{ WO2REC.rec.onstop = null; WO2REC.rec.stop(); }catch(e){} WO2REC.rec = null; }
  wo2RecStopCamera();
  clearInterval(WO2REC.tick); WO2REC.tick = null;
  try{ if (WO2REC.lock) WO2REC.lock.release(); }catch(e){}
  if (WO2REC.el){ WO2REC.el.remove(); WO2REC.el = null; }
  try{ render(); }catch(e){}
}
// Botón «Grabar» para la tarjeta grande de cada peso
function wo2RecButton(card, day, idx, entry, s){
  if (!wo2RecSupported()) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'wo2-recbtn'; b.textContent = '🎥 Grabar esta serie';
  b.style.cssText = 'width:100%;margin-top:10px;background:transparent;border:2px solid var(--surface-3,#33435a);color:inherit;font-weight:800;font-size:18px;padding:14px 0;border-radius:12px;cursor:pointer;';
  const name = entry ? (entry.name || ((typeof DICT !== 'undefined' && DICT[entry.code]) || '')) : '';
  b.onclick = (e)=>{ e.stopPropagation(); wo2OpenRecorder({ day, idx, label: (name ? name + ' · ' : '') + (s && s.kg != null ? s.kg + ' kg' : 'Grabar serie') }); };
  card.appendChild(b);
}
// Si la app vuelve a primer plano con la cámara abierta, se reabre la cámara
document.addEventListener('visibilitychange', ()=>{
  if (document.visibilityState === 'visible'){
    wo2SetAudioMode(WO2REC.stream && WO2REC.mic ? 'play-and-record' : 'ambient');
    if (WO2REC.el && !WO2REC.rec) wo2RecStartCamera();
  }
});
