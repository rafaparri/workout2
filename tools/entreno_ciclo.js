/* ---- Ciclo menstrual (opcional, privado por defecto) ----
   Datos de salud: solo la atleta los lee; su entrenador solo si ella lo comparte.
   Guardado en clubs/{club}/athletes/{uid}/cycle/main. Estimación orientativa, no médica. */
let wo2CicloData = null, wo2CicloLoading = false;
const WO2_CICLO_DEFAULT = { enabled:false, starts:[], cycleLength:28, periodLength:5, sharedWithCoach:false };
function wo2CicloRef(){ return WO2.base.collection('cycle').doc('main'); }
function wo2CicloCargar(){
  if (wo2CicloLoading || wo2CicloData || WO2.coachView || !WO2.base) return;
  wo2CicloLoading = true;
  wo2CicloRef().get().then(snap=>{
    wo2CicloData = snap.exists ? Object.assign({}, WO2_CICLO_DEFAULT, snap.data()) : Object.assign({}, WO2_CICLO_DEFAULT);
    if (wo2CicloData.enabled) render();
  }).catch(()=>{ wo2CicloData = Object.assign({}, WO2_CICLO_DEFAULT); });
}
async function wo2CicloGuardar(patch){
  wo2CicloData = Object.assign({}, wo2CicloData || WO2_CICLO_DEFAULT, patch, { updatedAt: Date.now() });
  await wo2CicloRef().set(wo2CicloData);
}
  function wo2cyTodayStr(){
    const d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function wo2cyDayNum(str){ const a=str.split('-').map(Number); return Math.round(Date.UTC(a[0],a[1]-1,a[2])/86400000); }
  function wo2cyFmt(str){ const a=str.split('-'); return a[2]+'/'+a[1]+'/'+a[0]; }
  function wo2cyEffectiveLength(c){
    const st = (c.starts||[]).slice().sort();
    if (st.length >= 3){
      const diffs = [];
      for (let i=Math.max(1, st.length-6); i<st.length; i++) diffs.push(wo2cyDayNum(st[i])-wo2cyDayNum(st[i-1]));
      const ok = diffs.filter(d=>d>=21 && d<=40);
      if (ok.length) return Math.round(ok.reduce((a,b)=>a+b,0)/ok.length);
    }
    return Math.min(40, Math.max(21, Number(c.cycleLength)||28));
  }
  /* Estimación orientativa (no médica). Devuelve null si no hay datos. */
  function wo2cyPhase(c, todayStr){
    if (!c || !c.enabled || !(c.starts||[]).length) return null;
    const st = c.starts.slice().sort();
    const t = wo2cyDayNum(todayStr || wo2cyTodayStr());
    const past = st.filter(x=>wo2cyDayNum(x)<=t);
    if (!past.length) return null;
    const L = wo2cyEffectiveLength(c);
    const P = Math.min(10, Math.max(2, Number(c.periodLength)||5));
    const day = t - wo2cyDayNum(past[past.length-1]) + 1;
    if (day > L + 7) return { day, L, key:'sin-datos', label:'Sin datos recientes', icon:'❔', tip:'Registra el inicio de tu último periodo para actualizar la estimación.' };
    const ov = L - 14;
    if (day <= P) return { day, L, key:'menstrual', label:'Menstrual', icon:'🔴', tip:'Escucha a tu cuerpo: si la energía es baja, puedes bajar la intensidad.' };
    if (day < ov-1) return { day, L, key:'folicular', label:'Folicular', icon:'🌱', tip:'Suele ser una fase de buena energía para trabajo de intensidad.' };
    if (day <= ov+1) return { day, L, key:'ovulacion', label:'Ovulación (estimada)', icon:'🌕', tip:'Calienta bien y cuida la técnica y las articulaciones.' };
    if (day <= L) return { day, L, key:'lutea', label:'Lútea', icon:'🌙', tip:'Puede haber más fatiga o calor; adapta descansos y volumen si lo necesitas.' };
    return { day, L, key:'retraso', label:'Posible retraso', icon:'⏳', tip:'Tu ciclo va más largo que la media. Registra el inicio cuando llegue.' };
  }

function wo2CicloChip(){
  if (WO2.coachView || !WO2.base) return null;
  if (!wo2CicloData){ wo2CicloCargar(); return null; }
  const ph = wo2cyPhase(wo2CicloData);
  if (!ph) return null;
  const d = el('div');
  d.style.cssText = 'display:flex;gap:12px;align-items:center;background:var(--surface-2);border:1px solid var(--surface-3);border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:16px;line-height:1.4;color:var(--chalk);';
  d.innerHTML = '<span style="font-size:28px;">' + ph.icon + '</span><div><b>' + ph.label + ' · día ' + ph.day + '</b><br><span style="color:var(--muted);font-size:15px;">' + ph.tip + '</span></div>';
  return d;
}
function wo2CicloAbrir(){
  if (!WO2.base || WO2.coachView) return;
  const old = document.getElementById('wo2CicloOv'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'wo2CicloOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;color:var(--chalk);';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:560px;margin:0 auto;padding:18px 16px 40px;font-size:17px;line-height:1.5;';
  ov.appendChild(box); document.body.appendChild(ov);
  const cerrar = ()=>{ ov.remove(); render(); };
  const css = {
    h:'font-family:ArchivoBlack,sans-serif;font-size:21px;margin:8px 0 12px;',
    btn:'display:block;width:100%;background:var(--surface);border:2px solid var(--surface-3);color:var(--chalk);font-family:ArchivoBlack,sans-serif;font-weight:700;font-size:16px;padding:14px 0;border-radius:12px;cursor:pointer;margin:0 0 12px;',
    inp:'width:100%;box-sizing:border-box;font-size:18px;padding:11px;border:2px solid var(--surface-3);border-radius:10px;background:var(--surface);color:var(--chalk);',
    lbl:'display:block;font-size:16px;font-weight:700;margin:12px 0 4px;',
    note:'color:var(--muted);font-size:15px;margin:8px 0;'
  };
  const pintar = ()=>{
    const c = wo2CicloData || Object.assign({}, WO2_CICLO_DEFAULT);
    let h = '<button id="cyBack" style="' + css.btn + '">← Volver</button><h2 style="' + css.h + '">🗓️ Seguimiento del ciclo</h2>';
    if (!c.enabled){
      h += '<p>Función <b>opcional</b> para relacionar tu ciclo con tu rendimiento. Son datos de salud, por eso:</p>' +
        '<ul><li>Solo los ves tú. Tu entrenador <b>no</b> los ve salvo que tú se lo permitas.</li>' +
        '<li>El administrador de la plataforma nunca tiene acceso.</li>' +
        '<li>Puedes desactivarlo y borrar todo cuando quieras.</li>' +
        '<li>Las fases son una estimación orientativa, <b>no un dato médico</b>.</li></ul>' +
        '<label style="display:flex;gap:10px;align-items:flex-start;margin:16px 0;"><input type="checkbox" id="cyConsent" style="width:24px;height:24px;flex:none;"> Entiendo y consiento guardar estos datos de forma privada.</label>' +
        '<button id="cyActivate" style="' + css.btn + '">Activar</button>';
      box.innerHTML = h;
    } else {
      const ph = wo2cyPhase(c);
      const starts = (c.starts||[]).slice().sort().reverse();
      h += (ph ? '<div style="display:flex;gap:12px;align-items:center;background:var(--surface-2);border:1px solid var(--surface-3);border-radius:12px;padding:12px 14px;margin-bottom:12px;"><span style="font-size:30px;">' + ph.icon + '</span><div><b>' + ph.label + ' · día ' + ph.day + '</b><br><span style="color:var(--muted);font-size:15px;">' + ph.tip + '</span></div></div>'
               : '<p>Aún no hay datos. Indica el primer día de tu último periodo.</p>') +
        '<p style="' + css.note + '">Estimación orientativa. No sustituye consejo médico.</p>' +
        '<button id="cyToday" style="' + css.btn + '">Ha empezado hoy</button>' +
        '<label style="' + css.lbl + '">Primer día de un periodo (otra fecha)</label>' +
        '<input type="date" id="cyDate" max="' + wo2cyTodayStr() + '" style="' + css.inp + 'margin-bottom:10px;">' +
        '<button id="cyAdd" style="' + css.btn + '">Añadir esa fecha</button>' +
        '<label style="' + css.lbl + '">Duración del ciclo (días)</label><input type="number" id="cyLen" min="21" max="40" value="' + (Number(c.cycleLength)||28) + '" style="' + css.inp + '">' +
        '<label style="' + css.lbl + '">Duración del periodo (días)</label><input type="number" id="cyPer" min="2" max="10" value="' + (Number(c.periodLength)||5) + '" style="' + css.inp + 'margin-bottom:10px;">' +
        '<button id="cySaveLens" style="' + css.btn + '">Guardar duraciones</button>' +
        '<p style="' + css.note + '">Con 3 o más registros se usa la media de tus ciclos reales.</p>' +
        '<h3 style="' + css.h + '">Historial</h3><div id="cyHist"></div>' +
        '<hr style="border:none;border-top:1px solid var(--surface-3);margin:18px 0;">' +
        '<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;"><input type="checkbox" id="cyShare" style="width:24px;height:24px;flex:none;"' + (c.sharedWithCoach ? ' checked' : '') + '> Compartir con mi entrenador</label>' +
        '<p style="' + css.note + '">Si lo activas, tu entrenador verá tu fase actual y tus últimas fechas. Puedes quitarlo cuando quieras.</p>' +
        '<button id="cyDelete" style="' + css.btn + 'color:var(--red);border-color:var(--red);">Borrar todos mis datos del ciclo</button>';
      box.innerHTML = h;
      const hist = box.querySelector('#cyHist');
      if (!starts.length) hist.textContent = 'Sin registros.';
      starts.forEach(d=>{
        const r = document.createElement('div');
        r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--surface-3);padding:8px 0;font-size:18px;';
        r.innerHTML = '<span>' + wo2cyFmt(d) + '</span>';
        const b = document.createElement('button'); b.textContent = 'Quitar';
        b.style.cssText = 'background:none;border:1px solid var(--surface-3);color:var(--muted);font-size:15px;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;';
        b.onclick = ()=> guardar({ starts: c.starts.filter(x=>x!==d) });
        r.appendChild(b); hist.appendChild(r);
      });
    }
    box.querySelector('#cyBack').onclick = cerrar;
    const q = id => box.querySelector('#' + id);
    if (!c.enabled){
      q('cyActivate').onclick = ()=>{
        if (!q('cyConsent').checked){ alert('Marca la casilla de consentimiento para activar.'); return; }
        guardar({ enabled:true, consentAt:Date.now() });
      };
      return;
    }
    const addStart = d=>{
      if (!d || d > wo2cyTodayStr()){ alert('Elige una fecha válida (no futura).'); return; }
      guardar({ starts: Array.from(new Set((c.starts||[]).concat([d]))).sort() });
    };
    q('cyToday').onclick = ()=> addStart(wo2cyTodayStr());
    q('cyAdd').onclick = ()=> addStart(q('cyDate').value);
    q('cySaveLens').onclick = ()=>{
      const L = Math.round(Number(q('cyLen').value)), P = Math.round(Number(q('cyPer').value));
      if (!(L>=21 && L<=40) || !(P>=2 && P<=10)){ alert('Ciclo entre 21 y 40 días; periodo entre 2 y 10.'); return; }
      guardar({ cycleLength:L, periodLength:P });
    };
    q('cyShare').onchange = async ev=>{
      try{ await wo2CicloGuardar({ sharedWithCoach: ev.target.checked }); }
      catch(e){ alert('Error: ' + (e.message||e)); ev.target.checked = !ev.target.checked; }
    };
    q('cyDelete').onclick = async ()=>{
      if (!confirm('Se borrarán TODOS tus datos del ciclo y se desactivará la función. ¿Seguro?')) return;
      try{ await wo2CicloRef().delete(); wo2CicloData = Object.assign({}, WO2_CICLO_DEFAULT); pintar(); }
      catch(e){ alert('Error: ' + (e.message||e)); }
    };
  };
  const guardar = async patch=>{
    try{ await wo2CicloGuardar(patch); pintar(); }
    catch(e){ alert('No se pudo guardar: ' + (e.message||e)); }
  };
  if (!wo2CicloData){
    box.textContent = 'Cargando…';
    wo2CicloRef().get().then(s=>{ wo2CicloData = s.exists ? Object.assign({}, WO2_CICLO_DEFAULT, s.data()) : Object.assign({}, WO2_CICLO_DEFAULT); pintar(); })
      .catch(e=>{ box.textContent = 'No se pudo cargar: ' + (e.message||e); });
  } else pintar();
}
