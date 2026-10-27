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
  if (!wo2IAReady() || !driveId || !blob) return;
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
