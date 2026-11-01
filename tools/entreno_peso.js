/* ---- Peso corporal (dato compartido con la app Nutrición) ----
   Se guarda en users/{uid}/bodyLog/{AAAA-MM-DD}, un registro por día.
   La app Nutrición lee y escribe en el mismo sitio si el atleta se lo ha
   autorizado, así que el último peso es el mismo en las dos apps. */
const weightState = { list:null, error:null, msg:null, msgOk:true, busy:false };
function weightToday(){ return new Date().toLocaleDateString('sv-SE'); }
function weightDate(iso){ const p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
async function weightLoad(){
  weightState.error = null;
  try{
    const snap = await db.collection('users').doc(WO2.uid).collection('bodyLog')
      .orderBy(firebase.firestore.FieldPath.documentId(),'desc').limit(8).get();
    weightState.list = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
  }catch(e){
    weightState.list = [];
    weightState.error = 'No se pudo leer el peso (' + ((e && (e.code || e.message)) || 'error') + ').'; console.error('bodyLog', e);
  }
  if (state.showWeight) render();
}
async function weightSave(raw){
  const kg = parseFloat(String(raw).replace(',','.'));
  if (!(kg>=30 && kg<=250)){ weightState.msg='Escribe un peso entre 30 y 250 kg.'; weightState.msgOk=false; render(); return; }
  weightState.busy = true; render();
  try{
    await db.collection('users').doc(WO2.uid).collection('bodyLog').doc(weightToday())
      .set({ kg: Math.round(kg*10)/10, by:'workout', byUid: WO2.uid, at: firebase.firestore.FieldValue.serverTimestamp() });
    weightState.msg='Guardado.'; weightState.msgOk=true;
    await weightLoad();
  }catch(e){
    weightState.msg='No se pudo guardar (' + ((e && (e.code || e.message)) || 'error') + ').'; weightState.msgOk=false;
  }
  weightState.busy = false; render();
}
function renderWeightSheet(){
  const overlay = el('div','overlay');
  const close = ()=>{ state.showWeight=false; weightState.msg=null; render(); };
  overlay.onclick = (e)=>{ if (e.target===overlay) close(); };
  const sheet = el('div','sheet');
  sheet.appendChild(el('h3','Mi peso'));

  const list = weightState.list;
  const big = el('div', null, !list ? '…' : (list.length ? String(list[0].kg).replace('.',',')+' kg' : 'Sin datos'));
  big.style.cssText = 'font-family:ArchivoBlack,sans-serif;font-size:40px;color:var(--gold-2);';
  sheet.appendChild(big);
  const info = el('div','ex-hint');
  info.style.cssText = 'margin-bottom:12px;';
  if (weightState.error) info.textContent = weightState.error;
  else if (list && list.length) info.textContent = 'Anotado el '+weightDate(list[0].id)+(list[0].by==='nutricion' ? ' por tu nutricionista' : '');
  else if (list) info.textContent = 'Anota tu peso. Tu nutricionista podrá verlo si se lo autorizas.';
  sheet.appendChild(info);

  const row = el('div');
  row.style.cssText = 'display:flex;gap:8px;';
  const input = document.createElement('input');
  input.setAttribute('inputmode','decimal'); input.placeholder = 'kg, por ejemplo 94,5';
  input.style.cssText = 'flex:1;min-width:0;';
  const save = el('button', null, weightState.busy ? 'Guardando…' : 'Guardar');
  save.style.cssText = 'width:auto;padding:0 18px;';
  save.disabled = weightState.busy;
  save.onclick = ()=> weightSave(input.value);
  row.appendChild(input); row.appendChild(save);
  sheet.appendChild(row);

  if (weightState.msg){
    const m = el('div', null, weightState.msg);
    m.style.cssText = 'font-size:14px;margin-top:8px;color:'+(weightState.msgOk ? 'var(--green)' : 'var(--red)')+';';
    sheet.appendChild(m);
  }
  if (list && list.length > 1){
    const h = el('div','ex-hint');
    h.style.cssText = 'margin-top:12px;';
    h.textContent = list.slice(1).map(p=>weightDate(p.id)+': '+String(p.kg).replace('.',',')+' kg').join(' · ');
    sheet.appendChild(h);
  }
  const closeBtn = el('button','sheet-close','Cerrar');
  closeBtn.onclick = close;
  sheet.appendChild(closeBtn);
  overlay.appendChild(sheet);
  return overlay;
}

/* ---- Versión y recarga forzada ---- */
function wo2VersionTexto(){
  const v = String(window.WO2_VERSION || '');
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  return m ? (m[3]+'/'+m[2]+'/'+m[1]+' '+m[4]+':'+m[5]) : 'desconocida';
}
function wo2RecargarApp(){
  // Pide la página otra vez saltándose la caché del navegador; los datos
  // (planes, pesos, progreso) se vuelven a leer de la base de datos.
  try{ const u = new URL(location.href); u.searchParams.set('r', Date.now()); location.replace(u.toString()); }
  catch(e){ location.reload(); }
}

