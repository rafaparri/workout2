// ===== WorkOut 2.0 · Análisis de técnica con IA =====
// 1) Al subir un vídeo a Drive, el móvil saca ~10 fotogramas del tramo con más
//    movimiento (el levantamiento) y los guarda en el propio móvil.
// 2) «🔎 Analizar técnica con IA» los manda al servidor de la IA (WO2_IA_URL),
//    que guarda la clave a salvo, y el análisis queda en progress/videos para
//    que lo vea el entrenador y salga en los informes.
// Si los fotogramas no están en el móvil, se descarga el vídeo de Drive.
var WO2IA = { busy:{}, err:{} };
function wo2IAReady(){ return !!window.WO2_IA_URL; }

// ---------- Fotogramas guardados en el móvil ----------
function wo2IAdb(){
  return new Promise((res, rej)=>{
    const r = indexedDB.open('wo2ia', 1);
    r.onupgradeneeded = ()=>{ r.result.createObjectStore('frames', { keyPath:'id' }); };
    r.onsuccess = ()=> res(r.result); r.onerror = ()=> rej(r.error);
  });
}
async function wo2IAStore(mode, fn){
  const db = await wo2IAdb();
  return new Promise((res, rej)=>{
    const tx = db.transaction('frames', mode); const req = fn(tx.objectStore('frames'));
    tx.oncomplete = ()=> res(req && req.result); tx.onerror = ()=> rej(tx.error);
  });
}
async function wo2IAGetSaved(id){ try{ return await wo2IAStore('readonly', st=> st.get(id)); }catch(e){ return null; } }
async function wo2IASave(id, pack){ try{ await wo2IAStore('readwrite', st=> st.put(Object.assign({ id }, pack))); }catch(e){} }

// ---------- Sacar fotogramas del vídeo ----------
// Primero mira 24 miniaturas para localizar el tramo con más movimiento y
// luego saca 10 fotogramas nítidos repartidos por ese tramo.
function wo2IAFrames(blob){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
    document.body.appendChild(v);
    let over = false;
    const end = (fn, arg)=>{ if (over) return; over = true; clearTimeout(guard); try{ v.pause(); v.removeAttribute('src'); v.load(); }catch(e){} v.remove(); URL.revokeObjectURL(url); fn(arg); };
    const guard = setTimeout(()=> end(reject, new Error('el vídeo tarda demasiado en leerse')), 90000);
    v.onerror = ()=> end(reject, new Error('este móvil no puede leer el archivo de vídeo'));
    const seek = (t)=> new Promise((res)=>{
      let done = false;
      const fin = ()=>{ if (done) return; done = true; v.removeEventListener('seeked', fin); setTimeout(res, 60); };
      v.addEventListener('seeked', fin); setTimeout(fin, 4000);
      try{ v.currentTime = t; }catch(e){ fin(); }
    });
    async function run(dur){
      try{
        const W = v.videoWidth, H = v.videoHeight;
        if (!W || !H) throw new Error('no se ve la imagen del vídeo');
        let t0 = 0, t1 = dur;
        if (dur > 6){
          // Pasada rápida: movimiento entre miniaturas
          const N = 24, sw = 48, sh = Math.max(16, Math.round(48 * H / W));
          const c = document.createElement('canvas'); c.width = sw; c.height = sh;
          const x = c.getContext('2d', { willReadFrequently:true });
          const times = [], grays = [];
          for (let i = 0; i < N; i++) times.push(dur * (i + 0.5) / N);
          for (const t of times){
            await seek(t);
            x.drawImage(v, 0, 0, sw, sh);
            const d = x.getImageData(0, 0, sw, sh).data, g = new Float32Array(sw * sh);
            for (let p = 0, q = 0; p < d.length; p += 4, q++) g[q] = d[p] * 0.3 + d[p+1] * 0.59 + d[p+2] * 0.11;
            grays.push(g);
          }
          const mo = [];
          for (let i = 0; i < N - 1; i++){ let s = 0; const a = grays[i], b = grays[i+1]; for (let q = 0; q < a.length; q++) s += Math.abs(a[q] - b[q]); mo.push(s / a.length); }
          // Ventana de ~5 s (mín. 4 tramos, máx. la mitad del vídeo) con más movimiento
          const step = dur / N;
          const L = Math.max(4, Math.min(Math.round(N / 2), Math.round(5 / step)));
          let best = 0, bi = 0;
          for (let i = 0; i + L <= mo.length; i++){ let s = 0; for (let k = i; k < i + L; k++) s += mo[k]; if (s > best){ best = s; bi = i; } }
          t0 = Math.max(0, times[bi] - step * 0.5);
          t1 = Math.min(dur, times[Math.min(N - 1, bi + L)] + step * 0.5);
        }
        // Pasada buena: 10 fotogramas a ~768 px
        const K = 10, sc = Math.min(1, 768 / Math.max(W, H));
        const c2 = document.createElement('canvas'); c2.width = Math.round(W * sc); c2.height = Math.round(H * sc);
        const x2 = c2.getContext('2d');
        const out = [];
        for (let i = 0; i < K; i++){
          const t = Math.min(dur - 0.05, t0 + (t1 - t0) * (i + 0.5) / K);
          await seek(t);
          x2.drawImage(v, 0, 0, c2.width, c2.height);
          out.push({ t: Math.round(t * 10) / 10, data: c2.toDataURL('image/jpeg', 0.72).split(',')[1] });
        }
        end(resolve, { frames: out, duration: dur });
      }catch(e){ end(reject, e); }
    }
    v.addEventListener('loadedmetadata', ()=>{
      const d = v.duration;
      if (isFinite(d) && d > 0){ run(d); return; }
      // iPhone: a veces la duración llega tarde; se fuerza saltando al final
      const onDur = ()=>{ if (isFinite(v.duration) && v.duration > 0){ v.removeEventListener('durationchange', onDur); run(v.duration); } };
      v.addEventListener('durationchange', onDur);
      try{ v.currentTime = 1e7; }catch(e){}
    });
    v.src = url; try{ v.load(); }catch(e){}
  });
}
// Se llama al subir un vídeo (todavía está entero en el móvil)
async function wo2IAPrepare(driveId, blob){
  // Siempre: sirven para el análisis con el servidor o con la app de Claude
  if (!driveId || !blob) return;
  try{ const p = await wo2IAFrames(blob); await wo2IASave(driveId, p); }catch(e){}
}

// ---------- Contexto del ejercicio para la IA ----------
function wo2IAContext(v){
  const plan = (state.plans || []).find(p=> p.id === v.planId);
  const e = plan && plan.days && plan.days[v.day] && v.exIdx != null ? plan.days[v.day][v.exIdx] : null;
  let sets = '', note = '';
  if (e && e.sets){
    sets = e.sets.map(s=> kgDisplayText(s) + ' ' + (s.series || '?') + 'x' + repDisplayText(s)).join(', ');
    try{ note = normalizeNote(state.notes[noteKey(plan, v.day, v.exIdx)]).text || ''; }catch(err){}
  }
  let athlete = ''; try{ athlete = getActiveUser().name || ''; }catch(err){}
  return { exercise: e ? (e.name || ('Código ' + e.code)) : (v.label || 'Levantamiento de halterofilia'), label: v.label || '', sets, note, athlete };
}

// ---------- Analizar ----------
async function wo2IAAnalyze(v){
  if (!wo2IAReady() || WO2IA.busy[v.id]) return;
  WO2IA.err[v.id] = ''; WO2IA.busy[v.id] = 'Preparando el vídeo…'; try{ render(); }catch(e){}
  try{
    let pack = await wo2IAGetSaved(v.id);
    if (!pack || !pack.frames || !pack.frames.length){
      // No está en este móvil: se descarga de Google Drive
      if (!wo2TokenValid()){
        WO2IA.busy[v.id] = '';
        if (confirm('Para analizar este vídeo hay que leerlo de tu Google Drive.\n\nPulsa Aceptar, da permiso y, al volver a la app, pulsa otra vez «Analizar técnica con IA».')) wo2DriveLogin();
        try{ render(); }catch(e){}
        return;
      }
      WO2IA.busy[v.id] = 'Descargando el vídeo de Drive…'; try{ render(); }catch(e){}
      const r = await wo2Api('https://www.googleapis.com/drive/v3/files/' + v.id + '?alt=media');
      const blob = await r.blob();
      WO2IA.busy[v.id] = 'Sacando fotogramas…'; try{ render(); }catch(e){}
      pack = await wo2IAFrames(blob);
      await wo2IASave(v.id, pack);
    }
    WO2IA.busy[v.id] = 'La IA está mirando el levantamiento…'; try{ render(); }catch(e){}
    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    if (!user) throw new Error('no hay sesión iniciada');
    const idt = await user.getIdToken();
    const ctx = Object.assign(wo2IAContext(v), { duration: pack.duration });
    const r = await fetch(String(window.WO2_IA_URL).replace(/\/$/, '') + '/analizar', {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + idt },
      body: JSON.stringify({ frames: pack.frames, context: ctx })
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok || !j.text) throw new Error(j.error || ('el servidor respondió ' + r.status));
    const list = (WO2.videos || []).map(x=> x.id === v.id ? Object.assign({}, x, { analysis:{ text: j.text, at: Date.now(), model: j.model || '' } }) : x);
    WO2.videos = list;
    await WO2.base.collection('progress').doc('videos').set({ list, updatedAt: Date.now() }, { merge:true });
    WO2IA.busy[v.id] = '';
  }catch(e){
    WO2IA.busy[v.id] = '';
    WO2IA.err[v.id] = 'No se ha podido analizar: ' + (e.message || e);
  }
  try{ render(); }catch(e){}
}

// ---------- En la tarjeta del ejercicio ----------
function wo2IABlock(v){
  const wrap = document.createElement('div');
  wrap.onclick = (e)=> e.stopPropagation();
  const a = v.analysis;
  if (a && a.text){
    const box = document.createElement('details');
    box.open = !WO2.coachView ? false : true;
    box.style.cssText = 'border:1.5px solid var(--t-edge,#33435a);border-radius:12px;padding:10px 14px;background:var(--t-surface-2,rgba(255,255,255,.03));';
    const sm = document.createElement('summary');
    sm.textContent = '🔎 Análisis de técnica (IA) · ' + new Date(a.at || Date.now()).toLocaleDateString('es-ES', { day:'numeric', month:'short' });
    sm.style.cssText = 'cursor:pointer;font-weight:800;font-size:16px;color:var(--t-accent,#34d1c4);';
    const tx = document.createElement('div');
    tx.textContent = a.text;
    tx.style.cssText = 'white-space:pre-wrap;font-size:16px;line-height:1.5;margin-top:10px;color:var(--t-text,inherit);';
    box.appendChild(sm); box.appendChild(tx);
    wrap.appendChild(box);
  }
  if (!WO2.coachView && wo2IAReady()){
    const busy = WO2IA.busy[v.id];
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = busy ? '⏳ ' + busy : (a && a.text ? '↻ Volver a analizar con IA' : '🔎 Analizar técnica con IA');
    b.disabled = !!busy;
    b.style.cssText = 'width:100%;margin-top:' + (a && a.text ? '8px' : '0') + ';min-height:50px;border-radius:12px;border:1.5px solid var(--t-accent,#34d1c4);background:transparent;color:var(--t-accent,#34d1c4);font-weight:800;font-size:16px;cursor:pointer;';
    b.onclick = (e)=>{ e.stopPropagation(); wo2IAAnalyze(v); };
    wrap.appendChild(b);
    if (WO2IA.err[v.id]){
      const er = document.createElement('div'); er.textContent = WO2IA.err[v.id];
      er.style.cssText = 'margin-top:6px;font-size:15px;color:var(--t-bad-fg,#f08a8b);';
      wrap.appendChild(er);
    }
  }
  return wrap.childNodes.length ? wrap : null;
}


// ===== Análisis gratis con la app de Claude (vídeos del día) =====
// 1) «Preparar»: una imagen por vídeo (10 fotogramas + datos) y el texto de la
//    pregunta. 2) «Compartir con Claude». 3) «Pegar análisis»: la respuesta se
//    reparte sola a cada vídeo (### VÍDEO 1, ### VÍDEO 2…) y queda guardada.
var WO2CL = { busy:'', err:'', pack:null, key:'' };
function wo2CLKey(plan, d){ return plan.id + '|' + d; }
function wo2CLVideos(plan, d){ return (WO2.videos || []).filter(v=> v.planId === plan.id && v.day === d).sort((a,b)=> (a.createdAt||0) - (b.createdAt||0)); }
function wo2CLWeak(){ try{ return localStorage.getItem('wo2_cl_weak') || ''; }catch(e){ return ''; } }
function wo2CLSetWeak(t){ try{ localStorage.setItem('wo2_cl_weak', t); }catch(e){} }
async function wo2CLFramesFor(v){
  let pack = await wo2IAGetSaved(v.id);
  if (pack && pack.frames && pack.frames.length) return pack;
  if (!wo2TokenValid()) throw new Error('NEED_DRIVE');
  const r = await wo2Api('https://www.googleapis.com/drive/v3/files/' + v.id + '?alt=media');
  pack = await wo2IAFrames(await r.blob());
  await wo2IASave(v.id, pack);
  return pack;
}
// Hoja de contactos: 5 columnas × 2 filas, con cabecera y el segundo de cada fotograma
function wo2CLSheet(pack, title, n){
  return new Promise((resolve)=>{
    const imgs = pack.frames.map(f=>{ const im = new Image(); im.src = 'data:image/jpeg;base64,' + f.data; return im; });
    let left = imgs.length;
    const go = ()=>{
      const W0 = imgs[0].naturalWidth || 768, H0 = imgs[0].naturalHeight || 432;
      const cols = 5, rows = Math.ceil(imgs.length / cols), cw = 320, ch = Math.round(cw * H0 / W0), head = 70, lab = 26;
      const c = document.createElement('canvas'); c.width = cols * cw; c.height = head + rows * (ch + lab);
      const x = c.getContext('2d');
      x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.font = 'bold 30px Arial'; x.fillText('VÍDEO ' + n + ' · ' + title, 14, 44);
      imgs.forEach((im, i)=>{
        const cx = (i % cols) * cw, cy = head + Math.floor(i / cols) * (ch + lab);
        try{ x.drawImage(im, cx, cy, cw, ch); }catch(e){}
        x.fillStyle = '#ffd966'; x.font = 'bold 20px Arial';
        x.fillText((i + 1) + ' · ' + String(pack.frames[i].t).replace('.', ',') + ' s', cx + 8, cy + ch + 20);
      });
      c.toBlob(b=> resolve(b), 'image/jpeg', 0.85);
    };
    imgs.forEach(im=>{ im.onload = im.onerror = ()=>{ if (--left === 0) go(); }; });
  });
}
function wo2CLPrompt(items){
  const weak = wo2CLWeak().trim();
  let t = 'Eres un entrenador de halterofilia con mucha experiencia. Te paso ' + items.length + (items.length === 1 ? ' imagen' : ' imágenes') +
    ': cada una tiene 10 fotogramas en orden de UNA serie (de izquierda a derecha y de arriba abajo, con el segundo del vídeo debajo de cada uno).\n';
  if (weak) t += '\nMis puntos débiles conocidos: ' + weak + '\n';
  t += '\n';
  items.forEach((it, i)=>{ t += 'VÍDEO ' + (i + 1) + ': ' + it.exercise + (it.label ? ' — ' + it.label : '') + (it.sets ? ' (programado: ' + it.sets + ')' : '') + (it.note ? '. Nota mía: ' + it.note : '') + '\n'; });
  t += '\nAnaliza solo lo que se ve en los fotogramas (no puedes ver la velocidad; si algo no se aprecia, dilo).' +
    ' Responde en español, en texto plano, separando cada vídeo EXACTAMENTE con una línea «### VÍDEO N» y con este formato:\n' +
    '### VÍDEO 1\nLo que está bien:\n- …\nA mejorar (por orden de importancia):\n- … (máximo 3; qué se ve, en qué fotograma y por qué importa)\nConsigna para la próxima serie: …\n' +
    '\nMáximo 150 palabras por vídeo.' +
    '\n\nEntrégame la respuesta como un DOCUMENTO de texto descargable llamado «analisis-videos.txt» (si no puedes crear archivos, escríbela en texto plano). No añadas nada fuera de las secciones «### VÍDEO N».';
  return t;
}
async function wo2CLPrepare(plan, d){
  const vids = wo2CLVideos(plan, d); if (!vids.length) return;
  WO2CL.err = ''; WO2CL.pack = null; WO2CL.key = wo2CLKey(plan, d);
  try{
    const files = [], items = [];
    for (let i = 0; i < vids.length; i++){
      const v = vids[i];
      WO2CL.busy = 'Preparando vídeo ' + (i + 1) + ' de ' + vids.length + '…'; render();
      const pack = await wo2CLFramesFor(v);
      const ctx = wo2IAContext(v);
      const blob = await wo2CLSheet(pack, (v.label || ctx.exercise), i + 1);
      files.push(new File([blob], 'video-' + (i + 1) + '.jpg', { type:'image/jpeg' }));
      items.push(ctx);
    }
    WO2CL.pack = { files, text: wo2CLPrompt(items), ids: vids.map(v=> v.id) };
    try{ localStorage.setItem('wo2_cl_order_' + WO2CL.key, JSON.stringify(WO2CL.pack.ids)); localStorage.setItem('wo2_cl_pending', JSON.stringify({ planId: plan.id, day: d, at: Date.now() })); }catch(e){}
    WO2CL.busy = '';
  }catch(e){
    WO2CL.busy = '';
    if (e && e.message === 'NEED_DRIVE'){
      if (confirm('Algún vídeo no tiene los fotogramas en este móvil y hay que leerlo de tu Google Drive.\n\nPulsa Aceptar, da permiso y, al volver, pulsa otra vez «Preparar».')) wo2DriveLogin();
    } else WO2CL.err = 'No se ha podido preparar: ' + (e.message || e);
  }
  render();
}
async function wo2CLShare(){
  const P = WO2CL.pack; if (!P) return;
  try{ await navigator.clipboard.writeText(P.text); }catch(e){}
  try{
    if (navigator.canShare && navigator.canShare({ files: P.files, text: P.text })){ await navigator.share({ files: P.files, text: P.text }); return; }
    if (navigator.canShare && navigator.canShare({ files: P.files })){
      alert('El texto de la pregunta ya está copiado. Ahora elige Claude (o «Guardar imágenes») para mandar las fotos y, en Claude, pega el texto.');
      await navigator.share({ files: P.files }); return;
    }
  }catch(e){ if (e && e.name === 'AbortError') return; }
  // Sin menú de compartir (ordenador): descarga las imágenes; el texto ya está copiado
  P.files.forEach(f=>{ const u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(u), 4000); });
  alert('Imágenes descargadas y texto copiado. Abre Claude, adjunta las imágenes y pega el texto.');
}
async function wo2CLPaste(plan, d, typed){
  let txt = typed;
  if (txt == null){ try{ txt = await navigator.clipboard.readText(); }catch(e){ txt = ''; } }
  txt = String(txt || '').trim();
  if (!txt){ WO2CL.err = 'No hay nada copiado. Copia la respuesta de Claude o pégala en el recuadro.'; WO2CL.showBox = true; render(); return; }
  const key = wo2CLKey(plan, d);
  let ids = (WO2CL.pack && WO2CL.key === key) ? WO2CL.pack.ids : null;
  if (!ids){ try{ ids = JSON.parse(localStorage.getItem('wo2_cl_order_' + key) || 'null'); }catch(e){} }
  if (!ids) ids = wo2CLVideos(plan, d).map(v=> v.id);
  const parts = {};
  const re = /#{0,3}\s*V[IÍ]DEO\s*(\d+)\s*:?\s*\n/gi; let m, marks = [];
  while ((m = re.exec(txt))) marks.push({ n: Number(m[1]), at: m.index, end: re.lastIndex });
  if (marks.length){ marks.forEach((mk, i)=>{ parts[mk.n] = txt.slice(mk.end, i + 1 < marks.length ? marks[i+1].at : txt.length).trim(); }); }
  else if (ids.length === 1) parts[1] = txt;
  else { WO2CL.err = 'No encuentro las marcas «### VÍDEO 1», «### VÍDEO 2»… en el texto. Pide a Claude que respete ese formato.'; render(); return; }
  let n = 0;
  const list = (WO2.videos || []).map(v=>{
    const i = ids.indexOf(v.id); const t = i >= 0 ? parts[i + 1] : null;
    if (!t) return v; n++;
    return Object.assign({}, v, { analysis:{ text: t, at: Date.now(), model: 'Claude (app)' } });
  });
  if (!n){ WO2CL.err = 'El texto no corresponde a los vídeos de este día.'; render(); return; }
  WO2.videos = list;
  try{ await WO2.base.collection('progress').doc('videos').set({ list, updatedAt: Date.now() }, { merge:true }); WO2CL.err = ''; WO2CL.ok = n + (n === 1 ? ' análisis guardado' : ' análisis guardados') + '. Lo verás en cada ejercicio y en los informes.'; WO2CL.showBox = false; }
  catch(e){ WO2CL.err = 'No se ha podido guardar: ' + (e.message || e); }
  render();
}
function wo2IADayBox(plan, d){
  if (WO2.coachView) return null;
  const vids = wo2CLVideos(plan, d); if (!vids.length) return null;
  const done = vids.filter(v=> v.analysis && v.analysis.text).length;
  const key = wo2CLKey(plan, d), ready = WO2CL.pack && WO2CL.key === key;
  const box = document.createElement('div');
  box.style.cssText = 'border:1.5px solid var(--surface-3);border-radius:14px;padding:12px 14px;margin:0 0 14px;background:var(--surface);color:var(--chalk);font-size:16px;';
  const t = document.createElement('div'); t.style.cssText = 'font-weight:800;font-size:17px;margin-bottom:8px;';
  t.textContent = '🔎 Analizar vídeos de hoy con Claude · ' + vids.length + (vids.length === 1 ? ' vídeo' : ' vídeos') + (done ? ' (' + done + ' analizado' + (done === 1 ? ')' : 's)') : '');
  box.appendChild(t);
  const mk = (txt, fn, main)=>{ const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
    b.style.cssText = 'width:100%;min-height:52px;margin-top:8px;border-radius:12px;font-weight:800;font-size:16px;cursor:pointer;border:1.5px solid var(--gold,#c99a2e);' + (main ? 'background:var(--gold,#c99a2e);color:#111;' : 'background:transparent;color:var(--chalk);');
    b.onclick = (e)=>{ e.stopPropagation(); fn(); }; return b; };
  if (WO2CL.busy){ const w = document.createElement('div'); w.textContent = '⏳ ' + WO2CL.busy; w.style.margin = '6px 0'; box.appendChild(w); }
  else {
    box.appendChild(mk(ready ? '1 · Preparado ✓ (volver a preparar)' : '1 · Preparar imágenes y pregunta', ()=> wo2CLPrepare(plan, d), !ready));
    if (ready) box.appendChild(mk('2 · Compartir con Claude', ()=> wo2CLShare(), true));
    box.appendChild(mk((ready ? '3' : '2') + ' · Pegar el análisis de Claude', ()=> wo2CLPaste(plan, d), false));
    box.appendChild(mk('… o cargar el archivo de Claude (analisis-videos.txt)', ()=>{
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.txt,.md,text/plain,text/markdown';
      fi.onchange = async ()=>{ const f = fi.files && fi.files[0]; if (!f) return; try{ wo2CLPaste(plan, d, await f.text()); }catch(e){ WO2CL.err = 'No se ha podido leer el archivo.'; render(); } };
      fi.click();
    }, false));
  }
  if (WO2CL.showBox){
    const ta = document.createElement('textarea'); ta.placeholder = 'Pega aquí la respuesta de Claude';
    ta.style.cssText = 'width:100%;box-sizing:border-box;min-height:140px;margin-top:8px;font-size:16px;padding:10px;border-radius:10px;border:1.5px solid var(--surface-3);background:var(--surface-2);color:var(--chalk);';
    box.appendChild(ta); box.appendChild(mk('Guardar el análisis', ()=> wo2CLPaste(plan, d, ta.value), true));
  }
  if (WO2CL.err){ const e = document.createElement('div'); e.textContent = WO2CL.err; e.style.cssText = 'color:var(--red,#e5484d);margin-top:8px;'; box.appendChild(e); }
  if (WO2CL.ok){ const o = document.createElement('div'); o.textContent = '✓ ' + WO2CL.ok; o.style.cssText = 'color:var(--green,#3fb26f);margin-top:8px;font-weight:700;'; box.appendChild(o); setTimeout(()=>{ WO2CL.ok = ''; }, 8000); }
  // Puntos débiles que se añaden a la pregunta
  const det = document.createElement('details'); det.style.marginTop = '10px';
  const sm = document.createElement('summary'); sm.textContent = 'Tus puntos débiles (se incluyen en la pregunta)'; sm.style.cssText = 'cursor:pointer;color:var(--muted);font-size:15px;';
  const wk = document.createElement('textarea'); wk.value = wo2CLWeak();
  wk.placeholder = 'Ej.: en la arrancada me levanto antes de estabilizar la barra; en el jerk tiro de hombros y el dip se va adelante.';
  wk.style.cssText = 'width:100%;box-sizing:border-box;min-height:80px;margin-top:6px;font-size:16px;padding:10px;border-radius:10px;border:1.5px solid var(--surface-3);background:var(--surface-2);color:var(--chalk);';
  wk.onchange = ()=> wo2CLSetWeak(wk.value);
  det.appendChild(sm); det.appendChild(wk); box.appendChild(det);
  return box;
}

// ===== Análisis que llega en la dirección: …entreno.html#ia=<texto> (atajo de iPhone) =====
(function(){
  let tries = 0;
  const run = ()=>{
    const h = location.hash || '';
    if (h.indexOf('#ia=') !== 0) return;
    if (typeof state === 'undefined' || !state.plans || !state.plans.length || !WO2 || !WO2.base || !Array.isArray(WO2.videos)){
      if (++tries < 40) setTimeout(run, 500); return;
    }
    let txt = ''; try{ txt = decodeURIComponent(h.slice(4)); }catch(e){ txt = h.slice(4); }
    history.replaceState(null, '', location.pathname + location.search);
    let pend = null; try{ pend = JSON.parse(localStorage.getItem('wo2_cl_pending') || 'null'); }catch(e){}
    const plan = pend && state.plans.find(p=> p.id === pend.planId);
    if (!plan){ alert('Ha llegado un análisis, pero no sé de qué día es. Abre el día y pulsa «Pegar el análisis».'); return; }
    state.activePlanId = plan.id; state.activeDay = pend.day; WO2CL.showBox = false;
    wo2CLPaste(plan, pend.day, txt);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(run, 800)); else setTimeout(run, 800);
  window.addEventListener('hashchange', ()=>{ tries = 0; run(); });
})();
