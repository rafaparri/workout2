// ===== WorkOut 2.0 · Vídeos de las series en Google Drive =====
// Cada vídeo grabado (o añadido) se guarda primero en el móvil, en una cola,
// y se sube al Google Drive del atleta (carpeta «WorkOut 2.0»), compartido
// por enlace. El enlace queda en  progress/videos  para que el entrenador lo
// vea en la app y salga en los informes PDF.
// Permiso pedido: drive.file (la app solo ve los archivos que ella crea).
var WO2D = { token:null, exp:0, client:null, busy:false, pending:0, progress:null, msg:'', folder:null };
var wo2ReportCtx = null;

function wo2DriveReady(){ return !!(window.WO2_GOOGLE_CLIENT_ID); }

// ---------- Cola en el móvil (IndexedDB) ----------
function wo2IDB(){
  return new Promise((res, rej)=>{
    const r = indexedDB.open('wo2drive', 1);
    r.onupgradeneeded = ()=>{ r.result.createObjectStore('pending', { keyPath:'id' }); };
    r.onsuccess = ()=> res(r.result); r.onerror = ()=> rej(r.error);
  });
}
async function wo2IDBDo(mode, fn){
  const db = await wo2IDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction('pending', mode); const st = tx.objectStore('pending');
    const out = fn(st);
    tx.oncomplete = ()=> res(out && out.result !== undefined ? out.result : out);
    tx.onerror = ()=> rej(tx.error);
  });
}
async function wo2PendingList(){ try{ return await wo2IDBDo('readonly', st=> st.getAll()) || []; }catch(e){ return []; } }

async function wo2DriveQueue(file, meta){
  if (typeof WO2 === 'undefined' || !WO2.base || WO2.coachView) return;
  meta = meta || {};
  const item = {
    id: 'q' + Date.now() + Math.random().toString(36).slice(2,6),
    blob: file, name: file.name || ('serie-' + Date.now() + '.mp4'), mime: file.type || 'video/mp4',
    planId: meta.planId || state.activePlanId || null,
    day: meta.day != null ? meta.day : (state.activeDay || null),
    exIdx: meta.exIdx != null ? meta.exIdx : null,
    label: meta.label || '', createdAt: Date.now()
  };
  try{ await wo2IDBDo('readwrite', st=> st.put(item)); }
  catch(e){ wo2DriveMsg('No se ha podido guardar el vídeo para subirlo: ' + (e.message || e)); return; }
  wo2DriveKick(false);
}

// ---------- Permiso de Google (token de acceso) ----------
function wo2TokenValid(){ return WO2D.token && Date.now() < WO2D.exp - 60000; }
// Permiso de Google sin ventana emergente: la app va a la página de Google y
// vuelve sola con el permiso (así funciona en el iPhone con la app instalada).
// Los vídeos pendientes no se pierden: esperan en la cola del móvil.
function wo2DriveLogin(){
  if (!wo2DriveReady()) return;
  const st = Math.random().toString(36).slice(2);
  try{ sessionStorage.setItem('wo2_gstate', st); localStorage.setItem('wo2_gstate', st); }catch(e){}
  let ok = false; try{ ok = localStorage.getItem('wo2_gdrive_ok') === '1'; }catch(e){}
  const q = new URLSearchParams({
    client_id: window.WO2_GOOGLE_CLIENT_ID,
    redirect_uri: location.origin + location.pathname,
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.file',
    include_granted_scopes: 'true',
    state: st
  });
  if (!ok) q.set('prompt', 'consent');
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
}
function wo2GetToken(){
  if (wo2TokenValid()) return Promise.resolve(WO2D.token);
  return Promise.reject(new Error('Hay que dar permiso a Google Drive.'));
}
// Vuelta de Google: el permiso llega en la dirección (#access_token=…)
(function(){
  const h = location.hash || '';
  if (h.indexOf('access_token=') < 0 && h.indexOf('error=') < 0) return;
  const p = new URLSearchParams(h.slice(1));
  let st = null; try{ st = sessionStorage.getItem('wo2_gstate') || localStorage.getItem('wo2_gstate'); }catch(e){}
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  if (p.get('error')){ WO2D.msg = p.get('error') === 'access_denied' ? 'No se dio permiso a Google Drive. Pulsa «Subir ahora» para intentarlo de nuevo.' : 'Google respondió: ' + p.get('error'); return; }
  if (st && p.get('state') !== st){ WO2D.msg = 'La respuesta de Google no coincide. Inténtalo de nuevo.'; return; }
  WO2D.token = p.get('access_token');
  WO2D.exp = Date.now() + (Number(p.get('expires_in')) || 3600) * 1000;
  try{ sessionStorage.setItem('wo2_gtok', JSON.stringify({ t:WO2D.token, e:WO2D.exp })); localStorage.setItem('wo2_gdrive_ok', '1'); localStorage.removeItem('wo2_gstate'); }catch(e){}
})();
try{ const s = JSON.parse(sessionStorage.getItem('wo2_gtok') || 'null'); if (s && s.e > Date.now()){ WO2D.token = s.t; WO2D.exp = s.e; } }catch(e){}

async function wo2Api(url, opts){
  opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + WO2D.token }, opts.headers || {});
  const r = await fetch(url, opts);
  if (r.status === 401){ WO2D.token = null; try{ sessionStorage.removeItem('wo2_gtok'); }catch(e){} throw new Error('El permiso de Google Drive ha caducado. Pulsa «Subir ahora».'); }
  if (!r.ok){ let d = ''; try{ const j = await r.json(); d = j.error && j.error.message; }catch(e){} throw new Error('Google Drive respondió ' + r.status + (d ? ': ' + d : '')); }
  return r;
}
async function wo2Folder(){
  let id = null; try{ id = localStorage.getItem('wo2_gfolder'); }catch(e){}
  if (id){
    try{ const r = await wo2Api('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,trashed'); const j = await r.json(); if (!j.trashed) return id; }catch(e){}
  }
  const q = encodeURIComponent("name='WorkOut 2.0' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const r = await wo2Api('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)');
  const j = await r.json();
  if (j.files && j.files.length) id = j.files[0].id;
  else {
    const c = await wo2Api('https://www.googleapis.com/drive/v3/files?fields=id', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name:'WorkOut 2.0', mimeType:'application/vnd.google-apps.folder' }) });
    id = (await c.json()).id;
  }
  try{ localStorage.setItem('wo2_gfolder', id); }catch(e){}
  return id;
}
function wo2PutWithProgress(url, blob, mime, onp){
  return new Promise((res, rej)=>{
    const x = new XMLHttpRequest();
    x.open('PUT', url); x.setRequestHeader('Content-Type', mime);
    x.upload.onprogress = (e)=>{ if (e.lengthComputable) onp(e.loaded / e.total); };
    x.onload = ()=> (x.status >= 200 && x.status < 300) ? res(JSON.parse(x.responseText || '{}')) : rej(new Error('La subida falló (' + x.status + ').'));
    x.onerror = ()=> rej(new Error('Sin conexión durante la subida.'));
    x.send(blob);
  });
}
async function wo2UploadOne(item){
  const folder = await wo2Folder();
  const init = await wo2Api('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
    method:'POST',
    headers:{ 'Content-Type':'application/json; charset=UTF-8', 'X-Upload-Content-Type': item.mime },
    body: JSON.stringify({ name: item.name, parents:[folder], description: 'WorkOut 2.0 · ' + (item.label || 'serie') })
  });
  const loc = init.headers.get('Location');
  if (!loc) throw new Error('Google Drive no ha aceptado la subida.');
  const meta = await wo2PutWithProgress(loc, item.blob, item.mime, (p)=>{ WO2D.progress = p; wo2DriveBadge(); });
  // Compartido por enlace (solo lectura) para que lo vea el entrenador
  await wo2Api('https://www.googleapis.com/drive/v3/files/' + meta.id + '/permissions', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ role:'reader', type:'anyone' }) });
  let link = meta.webViewLink;
  if (!link){ const g = await wo2Api('https://www.googleapis.com/drive/v3/files/' + meta.id + '?fields=webViewLink'); link = (await g.json()).webViewLink; }
  const entry = { id: meta.id, link, name: item.name, planId: item.planId, day: item.day, exIdx: item.exIdx, label: item.label, createdAt: item.createdAt };
  WO2.videos = (WO2.videos || []).concat([entry]);
  await WO2.base.collection('progress').doc('videos').set({ list: WO2.videos, updatedAt: Date.now() }, { merge:true });
}

async function wo2DriveKick(fromTap){
  if (WO2D.busy) return;
  const list = await wo2PendingList();
  WO2D.pending = list.length;
  if (!list.length){ wo2DriveBadge(); return; }
  if (!wo2DriveReady()){ WO2D.msg = 'Vídeos guardados en el móvil. La subida a Google Drive aún no está activada.'; wo2DriveBadge(); return; }
  if (!wo2TokenValid() && !fromTap){ WO2D.msg = ''; wo2DriveBadge(); return; }   // hace falta un toque para pedir permiso
  if (!wo2TokenValid()){ wo2DriveLogin(); return; }
  WO2D.busy = true; WO2D.msg = '';
  try{
    await wo2GetToken();
    for (const item of list){
      WO2D.progress = 0; wo2DriveBadge();
      await wo2UploadOne(item);
      await wo2IDBDo('readwrite', st=> st.delete(item.id));
      WO2D.pending--;
    }
    WO2D.msg = '✓ Vídeo' + (list.length > 1 ? 's' : '') + ' subido' + (list.length > 1 ? 's' : '') + ' a Google Drive';
    setTimeout(()=>{ if (WO2D.msg.indexOf('✓') === 0){ WO2D.msg = ''; wo2DriveBadge(); } }, 4000);
    try{ render(); }catch(e){}
  }catch(e){
    WO2D.msg = e.message || String(e);
  }finally{
    WO2D.busy = false; WO2D.progress = null; wo2DriveBadge();
  }
}

// ---------- Aviso flotante: pendientes / subiendo / subido ----------
function wo2DriveBadge(){
  let b = document.getElementById('wo2DriveBadge');
  const show = WO2D.busy || WO2D.pending > 0 || WO2D.msg;
  if (!show){ if (b) b.remove(); return; }
  if (!b){
    b = document.createElement('div'); b.id = 'wo2DriveBadge'; b.setAttribute('role','status');
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9900;max-width:min(94vw,520px);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;background:#161d27;color:#e8eef4;border:1.5px solid #33435a;border-radius:18px;padding:10px 14px;font:700 16px Archivo,Inter,system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.45);';
    document.body.appendChild(b);
  }
  // Con la cámara abierta, el aviso va arriba para no tapar los botones
  const rec = !!document.querySelector('.wo2-rec');
  b.style.bottom = rec ? 'auto' : 'calc(16px + env(safe-area-inset-bottom,0px))';
  b.style.top = rec ? 'calc(70px + env(safe-area-inset-top,0px))' : 'auto';
  b.innerHTML = '';
  const t = document.createElement('span');
  if (WO2D.busy) t.textContent = '☁️ Subiendo vídeo a Drive… ' + (WO2D.progress != null ? Math.round(WO2D.progress*100) + '%' : '');
  else if (WO2D.msg) t.textContent = WO2D.msg;
  else t.textContent = '☁️ ' + WO2D.pending + ' vídeo' + (WO2D.pending > 1 ? 's' : '') + ' por subir a Drive';
  b.appendChild(t);
  if (!WO2D.busy && WO2D.pending > 0 && wo2DriveReady()){
    const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Subir ahora';
    go.style.cssText = 'border:none;border-radius:999px;background:#34d1c4;color:#06201d;font:800 15px Archivo,Inter,sans-serif;min-height:40px;padding:0 14px;cursor:pointer;';
    go.onclick = ()=> wo2DriveKick(true);
    b.appendChild(go);
  }
  if (!WO2D.busy){
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label','Ocultar');
    x.style.cssText = 'border:none;background:transparent;color:#8494a6;font:800 16px sans-serif;min-height:40px;min-width:32px;cursor:pointer;';
    x.onclick = ()=>{ WO2D.msg = ''; WO2D.pending = 0; b.remove(); };
    b.appendChild(x);
  }
}

// Página propia que reproduce el archivo original (sin esperar a que Drive lo procese)
function wo2VideoPage(v, title){
  const d = new Date(v.createdAt || Date.now());
  const q = new URLSearchParams({ id: v.id, t: title || v.label || 'Vídeo de la serie', d: d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) });
  return new URL('video.html', location.href).href.split('?')[0] + '?' + q.toString();
}
// ---------- Lista de vídeos subidos en la tarjeta del ejercicio ----------
function wo2DriveVideosFor(planId, day, exIdx){
  return (typeof WO2 !== 'undefined' && WO2.videos || []).filter(v=> v.planId === planId && v.day === day && (exIdx == null || v.exIdx === exIdx || v.exIdx == null));
}
function wo2DriveCardList(section, plan, day, idx){
  const list = wo2DriveVideosFor(plan.id, day, null).filter(v=> v.exIdx === idx || (v.exIdx == null && idx === 0));
  if (!list.length) return;
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:0 0 12px;';
  list.forEach(v=>{
    const a = document.createElement('a'); a.href = wo2VideoPage(v); a.target = '_blank'; a.rel = 'noopener';
    const d = new Date(v.createdAt || Date.now());
    a.textContent = '▶ Ver vídeo · ' + d.toLocaleDateString('es-ES', { day:'numeric', month:'short' }) + ' ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) + (v.label ? ' · ' + v.label : '');
    a.style.cssText = 'display:block;padding:12px 14px;border-radius:12px;border:1.5px solid var(--t-edge,#33435a);color:var(--t-accent,#34d1c4);font-weight:800;font-size:16px;text-decoration:none;';
    a.onclick = (e)=> e.stopPropagation();
    if (WO2.coachView){ box.appendChild(a); return; }
    // El atleta puede borrar sus vídeos (de la app y de su Google Drive)
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;align-items:stretch;';
    a.style.flex = '1'; a.style.minWidth = '0';
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '🗑';
    del.setAttribute('aria-label', 'Borrar este vídeo');
    del.style.cssText = 'min-width:52px;border-radius:12px;border:1.5px solid var(--t-bad-edge,#7a2f30);background:transparent;color:var(--t-bad-fg,#f08a8b);font-size:20px;cursor:pointer;';
    del.onclick = (e)=>{ e.stopPropagation(); wo2DriveDelete(v); };
    row.appendChild(a); row.appendChild(del);
    box.appendChild(row);
  });
  section.appendChild(box);
}
// Borrar un vídeo: se quita de la app al momento y se borra de Google Drive
// (si el permiso de Google ha caducado, se borra la próxima vez que haya permiso).
async function wo2DriveDelete(v){
  if (!confirm('¿Borrar este vídeo?\n\nSe quitará de la app, del informe y de tu Google Drive. No se puede deshacer.')) return;
  WO2.videos = (WO2.videos || []).filter(x=> x.id !== v.id);
  try{ await WO2.base.collection('progress').doc('videos').set({ list: WO2.videos, updatedAt: Date.now() }, { merge:true }); }
  catch(e){ WO2D.msg = 'No se ha podido borrar: ' + (e.message || e.code); wo2DriveBadge(); return; }
  try{ render(); }catch(e){}
  wo2DrivePendingDeletes(v.id);
  wo2DriveFlushDeletes();
}
function wo2DrivePendingDeletes(addId){
  let l = []; try{ l = JSON.parse(localStorage.getItem('wo2_gdel') || '[]'); }catch(e){}
  if (addId && l.indexOf(addId) < 0){ l.push(addId); try{ localStorage.setItem('wo2_gdel', JSON.stringify(l)); }catch(e){} }
  return l;
}
async function wo2DriveFlushDeletes(){
  if (!wo2TokenValid()) return;
  const l = wo2DrivePendingDeletes();
  const left = [];
  for (const id of l){
    try{
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id, { method:'DELETE', headers:{ Authorization: 'Bearer ' + WO2D.token } });
      if (!(r.ok || r.status === 404)) left.push(id);
    }catch(e){ left.push(id); }
  }
  try{ localStorage.setItem('wo2_gdel', JSON.stringify(left)); }catch(e){}
  if (!left.length && l.length){ WO2D.msg = '✓ Vídeo borrado'; wo2DriveBadge(); setTimeout(()=>{ if (WO2D.msg === '✓ Vídeo borrado'){ WO2D.msg = ''; wo2DriveBadge(); } }, 3000); }
}

// ---------- Vídeos en los informes PDF ----------
function wo2VideosForPdf(){
  const c = wo2ReportCtx; if (!c || typeof WO2 === 'undefined') return [];
  const plan = (state.plans || []).find(p=> p.id === c.planId);
  return (WO2.videos || []).filter(v=> v.planId === c.planId && (!c.day || v.day === c.day)).map(v=>{
    const entry = plan && plan.days && plan.days[v.day] && v.exIdx != null ? plan.days[v.day][v.exIdx] : null;
    const name = entry ? (entry.name || ('Código ' + entry.code)) : (v.label || 'Serie');
    const dn = (typeof DAY_NAMES !== 'undefined' && DAY_NAMES[v.day]) || v.day || '';
    const d = new Date(v.createdAt || Date.now());
    return { text: (c.day ? '' : dn + ' · ') + name + ' · ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }), link: wo2VideoPage(v, name) };
  });
}

document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible'){ wo2DriveKick(false); wo2DriveFlushDeletes(); } });
setTimeout(()=> wo2DriveFlushDeletes(), 5000);
setTimeout(()=> wo2DriveKick(false), 4000);
