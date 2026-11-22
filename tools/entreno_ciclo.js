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


/* ---- Relación entre fases y resultados del entreno ----
   Con cada día entrenado (fecha real) se mira en qué fase estaba y cómo salió:
   valoración media de las series, RPE del día, series sin hacer y sensación.
   Se compara cada fase con la media de la atleta. Es una relación observada en
   sus datos, no una causa demostrada: hacen falta varios ciclos para fiarse. */
const WO2CY_PHASES = [
  { key:'menstrual', label:'Menstrual', icon:'🔴' }, { key:'folicular', label:'Folicular', icon:'🌱' },
  { key:'ovulacion', label:'Ovulación', icon:'🌕' }, { key:'lutea', label:'Lútea', icon:'🌙' }
];
function wo2cyDateStr(v){
  const t = typeof v === 'number' ? v : Date.parse(v); if (!isFinite(t)) return null;
  const d = new Date(t); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function wo2cyCycleOf(c, ds){
  const past = (c.starts||[]).slice().sort().filter(x=> x <= ds); return past.length ? past[past.length-1] : null;
}
// Un registro por día entrenado con fecha conocida
function wo2cyHistory(c){
  const out = [], today = wo2cyTodayStr();
  (state.plans||[]).forEach(plan=>{
    if (!plan.dayDates) return;
    Object.keys(plan.days||{}).forEach(d=>{
      const ds = wo2cyDateStr(plan.dayDates[d]); if (!ds || ds > today) return;
      const ph = wo2cyPhase(c, ds); if (!ph || !WO2CY_PHASES.some(x=> x.key === ph.key)) return;
      const rs = []; let tot = 0, off = 0;
      (plan.days[d]||[]).forEach((e, i)=>{
        if (!e || e.type !== 'exercise') return;
        (e.sets||[]).forEach((st, si)=>{
          const k = checkKey(plan, d, i, si); tot++;
          if (typeof wo2SetOff === 'function' && wo2SetOff(k)){ off++; return; }
          const r = normalizeCheck(state.checks[k]); if (r) rs.push(r);
        });
      });
      const dayOff = typeof wo2DayOff === 'function' && wo2DayOff(plan, d);
      if (!rs.length && !off && !dayOff) return;
      let n = {}; try{ n = normalizeNote(state.notes[noteKey(plan, d)]) || {}; }catch(e){}
      out.push({ ds, phase: ph.key, cycle: wo2cyCycleOf(c, ds),
        avg: rs.length ? rs.reduce((a,b)=>a+b,0)/rs.length : null,
        offPct: tot ? off/tot : 0, rpe: n.rpe != null && n.rpe !== '' ? Number(n.rpe) : null,
        bad: n.feeling === 'mal', dayOff: !!dayOff });
    });
  });
  return out.sort((a,b)=> a.ds < b.ds ? -1 : 1);
}
function wo2cyStats(rows){
  const m = (arr)=> arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  return { days: rows.length, cycles: new Set(rows.map(r=> r.cycle)).size,
    avg: m(rows.filter(r=> r.avg != null).map(r=> r.avg)), rpe: m(rows.filter(r=> r.rpe != null).map(r=> r.rpe)),
    offPct: m(rows.map(r=> r.offPct)) || 0, bad: rows.filter(r=> r.bad || r.dayOff).length };
}
// Comparación de una fase con la media: 'baja', 'alta', 'normal' o null (pocos datos)
function wo2cyVerdict(ps, base){
  if (!ps || ps.days < 2 || base.days < 6) return null;
  let score = 0;
  if (ps.avg != null && base.avg != null) score += (ps.avg - base.avg) / 0.3;
  if (ps.rpe != null && base.rpe != null) score -= (ps.rpe - base.rpe) / 0.7;
  score -= (ps.offPct - base.offPct) / 0.08;
  if (score <= -1) return 'baja'; if (score >= 1) return 'alta'; return 'normal';
}
const wo2cyF1 = (x)=> x == null ? '—' : x.toFixed(1).replace('.', ',');
function wo2cyDetail(ps, base){
  const t = [];
  if (ps.avg != null) t.push('valoración ' + wo2cyF1(ps.avg) + (base.avg != null ? ' (tu media ' + wo2cyF1(base.avg) + ')' : ''));
  if (ps.rpe != null) t.push('RPE ' + wo2cyF1(ps.rpe) + (base.rpe != null ? ' (media ' + wo2cyF1(base.rpe) + ')' : ''));
  if (ps.offPct > 0 || base.offPct > 0) t.push(Math.round(ps.offPct*100) + '% de series sin hacer (media ' + Math.round(base.offPct*100) + '%)');
  return t.join(', ');
}
// Mensaje para la fase actual
function wo2cyInsight(c, ph){
  if (!ph || !WO2CY_PHASES.some(x=> x.key === ph.key)) return null;
  const H = wo2cyHistory(c), base = wo2cyStats(H);
  const curCycle = wo2cyCycleOf(c, wo2cyTodayStr());
  const prevRows = H.filter(r=> r.phase === ph.key && r.cycle !== curCycle);
  const name = (WO2CY_PHASES.find(x=> x.key === ph.key) || {}).label.toUpperCase();
  if (!prevRows.length || base.days < 6){
    return { level:'info', text:'FASE ' + name + ': aún no hay datos suficientes para relacionarla con tus entrenos (' + H.length + ' días registrados con fecha). Se irá afinando con cada ciclo.' };
  }
  const ps = wo2cyStats(prevRows), v = wo2cyVerdict(ps, base);
  const norma = ps.cycles >= 2 ? 'COMO NORMA (' + ps.cycles + ' ciclos)' : 'EN EL CICLO ANTERIOR';
  const det = wo2cyDetail(ps, base);
  if (v === 'baja') return { level:'baja', text:'FASE ' + name + ': OJO. ' + norma + ' ES UNA FASE DE MENOR RENDIMIENTO: ' + det + '. Valora ajustar intensidad, volumen o descansos.' };
  if (v === 'alta') return { level:'alta', text:'FASE ' + name + ': BUENA FASE. ' + norma + ' RINDES MEJOR DE LO HABITUAL: ' + det + '. Buen momento para apretar si el plan lo pide.' };
  if (v === 'normal') return { level:'normal', text:'FASE ' + name + ': ' + norma + ' rindes como de costumbre (' + det + ').' };
  return { level:'info', text:'FASE ' + name + ': pocos días registrados en esta fase todavía (' + ps.days + '). Se irá afinando con cada ciclo.' };
}
function wo2cyInsightHtml(ins){
  if (!ins) return '';
  const col = ins.level === 'baja' ? 'var(--red,#e5484d)' : ins.level === 'alta' ? 'var(--green,#3fb26f)' : 'var(--muted)';
  return '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--surface-3);font-size:15px;line-height:1.45;color:' + col + ';font-weight:' + (ins.level === 'baja' || ins.level === 'alta' ? 800 : 600) + ';">' +
    (ins.level === 'baja' ? '⚠️ ' : ins.level === 'alta' ? '💪 ' : '📊 ') + ins.text + '</div>' +
    '<div style="font-size:13px;color:var(--muted);margin-top:4px;">Relación observada en tus datos, no una causa demostrada.</div>';
}
// Tabla «Tu rendimiento por fase» para la ventana del ciclo
function wo2cyTableHtml(c){
  const H = wo2cyHistory(c), base = wo2cyStats(H);
  if (!H.length) return '<p style="color:var(--muted);font-size:15px;">Aún no hay entrenos con fecha dentro de tus ciclos registrados. Registra fechas de inicio de periodos pasados para analizar también entrenos anteriores.</p>';
  let h = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:15px;">' +
    '<tr style="color:var(--muted);text-align:left;"><th style="padding:6px 4px;">Fase</th><th>Días</th><th>Valor.</th><th>RPE</th><th>Sin hacer</th><th></th></tr>';
  WO2CY_PHASES.forEach(P=>{
    const rows = H.filter(r=> r.phase === P.key); if (!rows.length) return;
    const ps = wo2cyStats(rows), v = wo2cyVerdict(ps, base);
    const tag = v === 'baja' ? '<b style="color:var(--red,#e5484d)">↓ peor</b>' : v === 'alta' ? '<b style="color:var(--green,#3fb26f)">↑ mejor</b>' : v === 'normal' ? '= normal' : '<span style="color:var(--muted)">pocos datos</span>';
    h += '<tr style="border-top:1px solid var(--surface-3);"><td style="padding:8px 4px;">' + P.icon + ' ' + P.label + '</td><td>' + ps.days + '</td><td>' + wo2cyF1(ps.avg) + '</td><td>' + wo2cyF1(ps.rpe) + '</td><td>' + Math.round(ps.offPct*100) + '%</td><td>' + tag + '</td></tr>';
  });
  h += '<tr style="border-top:2px solid var(--surface-3);font-weight:800;"><td style="padding:8px 4px;">Tu media</td><td>' + base.days + '</td><td>' + wo2cyF1(base.avg) + '</td><td>' + wo2cyF1(base.rpe) + '</td><td>' + Math.round(base.offPct*100) + '%</td><td></td></tr></table></div>' +
    '<p style="color:var(--muted);font-size:14px;">Valoración de 1 a 5 (media de tus series), RPE del día y porcentaje de series marcadas como «no hecho». Es una relación observada en tus datos, no una causa demostrada: con 2–3 ciclos registrados empieza a ser fiable.</p>';
  return h;
}

function wo2CicloChip(){
  if (WO2.coachView || !WO2.base) return null;
  if (!wo2CicloData){ wo2CicloCargar(); return null; }
  const ph = wo2cyPhase(wo2CicloData);
  if (!ph) return null;
  const d = el('div');
  d.style.cssText = 'display:flex;gap:12px;align-items:center;background:var(--surface-2);border:1px solid var(--surface-3);border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:16px;line-height:1.4;color:var(--chalk);';
  let ins = null; try{ ins = wo2cyInsight(wo2CicloData, ph); }catch(e){}
  d.style.alignItems = 'flex-start';
  d.innerHTML = '<span style="font-size:28px;">' + ph.icon + '</span><div><b>' + ph.label + ' · día ' + ph.day + '</b><br><span style="color:var(--muted);font-size:15px;">' + ph.tip + '</span>' + wo2cyInsightHtml(ins) + '</div>';
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
        '<h3 style="' + css.h + '">Tu rendimiento por fase</h3>' + (function(){ try{ return wo2cyInsightHtml(wo2cyInsight(c, ph)) + wo2cyTableHtml(c); }catch(e){ return ''; } })() +
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
