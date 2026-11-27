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

  /* ---- Días de periodo (como Control del Ciclo del iPhone) ----
     c.days = { 'AAAA-MM-DD': 'ligero' | 'medio' | 'abundante' }. Los inicios de
     periodo (c.starts) se deducen de los días: un día es inicio si los 2 días
     anteriores no tienen periodo. Se conservan inicios antiguos sin días. */
  function wo2cyAddDays(str, n){ const t = (wo2cyDayNum(str) + n) * 86400000; const d = new Date(t); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); }
  function wo2cyRuns(c){
    const ds = Object.keys(c.days||{}).sort(), runs = [];
    ds.forEach(d=>{ const last = runs[runs.length-1];
      if (last && wo2cyDayNum(d) - wo2cyDayNum(last[last.length-1]) <= 2) last.push(d); else runs.push([d]); });
    return runs;
  }
  function wo2cyDerivedStarts(c){
    const fromDays = wo2cyRuns(c).map(r=> r[0]);
    const base = Array.isArray(c.legacyStarts) ? c.legacyStarts : (c.starts||[]);
    const legacy = base.filter(s=> !fromDays.some(f=> Math.abs(wo2cyDayNum(f) - wo2cyDayNum(s)) <= 3));
    return Array.from(new Set(fromDays.concat(legacy))).sort();
  }
  function wo2cyPeriodLen(c){
    const runs = wo2cyRuns(c).filter(r=> r.length >= 2).slice(-6);
    if (runs.length){ const m = runs.map(r=> wo2cyDayNum(r[r.length-1]) - wo2cyDayNum(r[0]) + 1); return Math.round(m.reduce((a,b)=>a+b,0)/m.length); }
    return Math.min(10, Math.max(2, Number(c.periodLength)||5));
  }
  // Predicciones: inicio del próximo periodo, días de periodo previstos y ventana fértil
  function wo2cyPredict(c){
    const st = (c.starts||[]).slice().sort(); if (!st.length) return null;
    const L = wo2cyEffectiveLength(c), P = wo2cyPeriodLen(c), last = st[st.length-1];
    const out = { L, P, last, period:{}, fertile:{} };
    const today = wo2cyTodayStr();
    // Resto del periodo en curso (empezó hace menos de P días)
    for (let i = 0; i < P; i++){ const d = wo2cyAddDays(last, i); if (d > today && !(c.days||{})[d]) out.period[d] = true; }
    // ventana fértil del ciclo actual y de los 2 siguientes; periodo previsto de los 2 siguientes
    for (let k = 0; k <= 2; k++){
      const s = wo2cyAddDays(last, L * k), next = wo2cyAddDays(last, L * (k + 1));
      const ov = wo2cyAddDays(next, -14);
      for (let i = -5; i <= 0; i++){ const d = wo2cyAddDays(ov, i); if (d >= today || k > 0) out.fertile[d] = true; }
      if (k < 2) for (let i = 0; i < P; i++){ const d = wo2cyAddDays(next, i); if (d > today) out.period[d] = true; }
      if (!out.nextStart && next > today) out.nextStart = next;
    }
    out.fertileStart = Object.keys(out.fertile).sort().find(d=> d >= today) || null;
    return out;
  }
  /* Estimación orientativa (no médica). Devuelve null si no hay datos. */
  function wo2cyPhase(c, todayStr){
    if (!c || !c.enabled || !(c.starts||[]).length) return null;
    const st = c.starts.slice().sort();
    const t = wo2cyDayNum(todayStr || wo2cyTodayStr());
    const past = st.filter(x=>wo2cyDayNum(x)<=t);
    if (!past.length) return null;
    const L = wo2cyEffectiveLength(c);
    const P = wo2cyPeriodLen(c);
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

/* ---- Pantalla «Control del ciclo» (al estilo de la app del iPhone) ---- */
const WO2CY_RED = '#ff6347', WO2CY_BLUE = '#7cc8f5';
const WO2CY_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const WO2CY_MESC = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
const WO2CY_LET = ['D','L','M','X','J','V','S'];
function wo2cyDate(str){ const a = str.split('-').map(Number); return new Date(a[0], a[1]-1, a[2]); }
function wo2cyLargo(str){ const d = wo2cyDate(str); return d.getDate() + ' de ' + WO2CY_MES[d.getMonth()]; }
function wo2cyCorto(str){ const d = wo2cyDate(str); return d.getDate() + ' ' + WO2CY_MESC[d.getMonth()]; }
function wo2cyDot(kind, size){
  const s = size || 46;
  if (kind === 'p') return '<span style="display:inline-block;width:'+s+'px;height:'+s+'px;border-radius:50%;background:'+WO2CY_RED+';"></span>';
  if (kind === 'pp') return '<span style="display:inline-block;width:'+s+'px;height:'+s+'px;border-radius:50%;background:repeating-linear-gradient(135deg,'+WO2CY_RED+' 0 3px,#ffc2b5 3px 6px);"></span>';
  if (kind === 'f') return '<span style="display:inline-block;width:'+s+'px;height:'+s+'px;border-radius:50%;background:repeating-linear-gradient(135deg,'+WO2CY_BLUE+' 0 3px,#d6eefc 3px 6px);"></span>';
  return '<span style="display:inline-block;width:'+s+'px;height:'+s+'px;"></span>';
}
function wo2cyKind(c, pr, d){
  if ((c.days||{})[d]) return 'p';
  if (pr && pr.period[d]) return 'pp';
  if (pr && pr.fertile[d]) return 'f';
  return '';
}
function wo2cyScreenHtml(c, sel){
  const today = wo2cyTodayStr(), pr = wo2cyPredict(c), ph = wo2cyPhase(c);
  const card = 'background:var(--surface);border:1px solid var(--surface-3);border-radius:22px;padding:16px;margin:0 0 16px;';
  let h = '<div style="text-align:center;font-size:24px;font-weight:800;margin:4px 0 10px;">' + (sel === today ? 'hoy, ' : '') + wo2cyLargo(sel) + '</div>';
  // Tira de días (30 atrás, 45 adelante)
  h += '<div id="cyStrip" style="display:flex;gap:8px;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;">';
  for (let i = -30; i <= 45; i++){
    const d = wo2cyAddDays(today, i), dt = wo2cyDate(d), isSel = d === sel, isT = d === today;
    const k = wo2cyKind(c, pr, d);
    h += '<button data-cyday="' + d + '" style="flex:none;width:62px;border:none;background:none;padding:0;cursor:pointer;color:var(--chalk);scroll-snap-align:center;">' +
      '<div style="height:16px;font-size:14px;line-height:16px;">' + (isT ? '▼' : '') + '</div>' +
      '<div style="margin:2px auto 8px;width:34px;height:34px;border-radius:50%;line-height:34px;font-weight:800;font-size:16px;' + (isSel ? 'background:var(--chalk);color:var(--bg);' : 'color:' + (d > today ? 'var(--muted)' : 'var(--chalk)') + ';') + '">' + WO2CY_LET[dt.getDay()] + '</div>' +
      '<div style="width:58px;height:' + (isSel ? 92 : 80) + 'px;margin:0 auto;border-radius:30px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;' + (isSel ? 'box-shadow:0 0 0 2px var(--surface-3);' : '') + '">' + wo2cyDot(k, isSel ? 50 : 40) + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-top:4px;">' + dt.getDate() + '</div></button>';
  }
  h += '</div>';
  // Registro del día
  const flow = (c.days||{})[sel];
  const fl = { ligero:'Ligero', medio:'Medio', abundante:'Abundante' };
  h += '<div style="' + card + '"><div style="font-size:24px;font-weight:800;margin-bottom:8px;">Registro</div>' +
    '<div style="color:' + WO2CY_RED + ';font-weight:700;font-size:16px;margin:4px 0 8px;">● Sangrado</div>' +
    '<button id="cyPeriodo" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:#ffe9e5;color:#222;border:none;border-radius:18px;padding:18px;font-size:19px;cursor:pointer;">' +
      '<span>Periodo</span><span style="color:' + WO2CY_RED + ';font-weight:700;">' + (flow ? fl[flow] || 'Sí' : 'Flujo') + '</span></button>' +
    '<div id="cyFlow" style="display:' + (flow ? 'flex' : 'none') + ';gap:8px;flex-wrap:wrap;margin-top:10px;">' +
      [['no','Sin sangrado'],['ligero','Ligero'],['medio','Medio'],['abundante','Abundante']].map(([v,t])=>{
        const on = (v === 'no' && !flow) || v === flow;
        return '<button data-cyflow="' + v + '" style="flex:1 1 40%;min-height:52px;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;border:2px solid ' + (on ? WO2CY_RED : 'var(--surface-3)') + ';background:' + (on ? WO2CY_RED : 'transparent') + ';color:' + (on ? '#fff' : 'var(--chalk)') + ';">' + t + '</button>';
      }).join('') + '</div>' +
    (sel > today ? '<p style="color:var(--muted);font-size:15px;margin:10px 0 0;">Este día aún no ha llegado: solo se ve la previsión.</p>' : '<p style="color:var(--muted);font-size:15px;margin:10px 0 0;">Toca «Periodo» y elige el flujo. Marca cada día que lo tengas; el primero de cada tanda cuenta como inicio.</p>') +
    '</div>';
  // Fase actual y relación con el rendimiento
  if (ph) h += '<div style="' + card + 'display:flex;gap:12px;align-items:flex-start;"><span style="font-size:30px;">' + ph.icon + '</span><div><b>' + ph.label + ' · día ' + ph.day + '</b><br><span style="color:var(--muted);font-size:15px;">' + ph.tip + '</span>' + (function(){ try{ return wo2cyInsightHtml(wo2cyInsight(c, ph)); }catch(e){ return ''; } })() + '</div></div>';
  // Estimación del periodo fértil
  if (pr && pr.fertileStart){
    const mon = wo2cyAddDays(today, -((wo2cyDate(today).getDay() + 6) % 7));
    h += '<div style="' + card + '"><div style="color:#7a6cf0;font-weight:700;font-size:16px;">✦ Estimación del periodo fértil</div>' +
      '<div style="font-size:22px;font-weight:800;margin:6px 0 12px;">Tu periodo fértil puede empezar el ' + wo2cyLargo(pr.fertileStart) + '.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;font-size:16px;color:var(--muted);border-bottom:1px solid var(--surface-3);padding-bottom:6px;">' + ['lun','mar','mié','jue','vie','sáb','dom'].map(x=>'<div>'+x+'</div>').join('') + '</div>';
    const endW = Math.max(3, Math.ceil((wo2cyDayNum(pr.fertileStart) - wo2cyDayNum(mon) + 7) / 7));
    let prevM = -1;
    for (let w = 0; w < Math.min(endW, 6); w++){
      h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;margin-top:8px;">';
      for (let i = 0; i < 7; i++){
        const d = wo2cyAddDays(mon, w*7 + i), dt = wo2cyDate(d), k = wo2cyKind(c, pr, d);
        const mlab = dt.getMonth() !== prevM && (i === 0 || dt.getDate() === 1) ? WO2CY_MESC[dt.getMonth()].toUpperCase() : '';
        if (mlab) prevM = dt.getMonth();
        const bg = d === today ? 'background:var(--chalk);color:var(--bg);' : k === 'p' ? 'background:' + WO2CY_RED + ';color:#fff;' : k === 'pp' ? 'background:repeating-linear-gradient(135deg,' + WO2CY_RED + ' 0 3px,#ffc2b5 3px 6px);color:#222;' : k === 'f' ? 'background:repeating-linear-gradient(135deg,' + WO2CY_BLUE + ' 0 3px,#d6eefc 3px 6px);color:#111;' : '';
        h += '<div><div style="font-size:12px;color:var(--muted);height:14px;">' + mlab + '</div><div style="margin:2px auto 0;width:42px;height:42px;line-height:42px;border-radius:50%;font-size:18px;font-weight:' + (k ? 800 : 500) + ';' + bg + '">' + dt.getDate() + '</div></div>';
      }
      h += '</div>';
    }
    h += '<p style="color:var(--muted);font-size:14px;margin:12px 0 0;">Las estimaciones pueden variar y no se deben utilizar como método anticonceptivo. Rojo rayado = periodo previsto · azul rayado = periodo fértil estimado.</p></div>';
  }
  // Tus ciclos
  h += '<div style="font-size:26px;font-weight:800;margin:20px 0 10px;">Tus ciclos</div><div style="' + card + '"><div style="color:#7a6cf0;font-weight:700;font-size:17px;margin-bottom:6px;">Historial de ciclos</div>';
  const st = (c.starts||[]).slice().sort();
  if (!st.length) h += '<p style="color:var(--muted);">Aún no hay periodos registrados. Toca un día en la tira de arriba y marca «Periodo».</p>';
  const runs = wo2cyRuns(c);
  for (let i = st.length - 1, n = 0; i >= 0 && n < 12; i--, n++){
    const s = st[i], e = i < st.length - 1 ? wo2cyAddDays(st[i+1], -1) : today;
    const len = wo2cyDayNum(e) - wo2cyDayNum(s) + 1;
    const run = runs.find(r=> r[0] === s);
    const pLen = run ? wo2cyDayNum(run[run.length-1]) - wo2cyDayNum(s) + 1 : null;
    const cur = i === st.length - 1;
    const ovEnd = i < st.length - 1 ? wo2cyAddDays(st[i+1], -14) : null;
    let dots = '';
    for (let k = 0; k < Math.min(len, 45); k++){
      const d = wo2cyAddDays(s, k), isP = (c.days||{})[d] || (!run && k < wo2cyPeriodLen(c));
      const isF = ovEnd && d >= wo2cyAddDays(ovEnd, -5) && d <= ovEnd;
      dots += '<span style="flex:none;width:20px;height:' + (isF ? 30 : 30) + 'px;border-radius:10px;background:' + (isF ? WO2CY_BLUE : 'var(--surface-2)') + ';display:flex;align-items:center;justify-content:center;">' + (isP ? '<span style="width:14px;height:14px;border-radius:50%;background:' + WO2CY_RED + ';"></span>' : '') + '</span>';
    }
    h += '<div style="border-top:' + (n ? '1px solid var(--surface-3)' : 'none') + ';padding:14px 0;">' +
      '<div style="font-size:19px;">' + (cur ? '<b>Ciclo actual:</b> Comenzó el ' + wo2cyCorto(s) + ' (' + len + (len === 1 ? ' día' : ' días') + ')' : '<b>' + len + ' días:</b> ' + wo2cyCorto(s) + ' – ' + wo2cyCorto(e)) + '</div>' +
      '<div style="color:var(--muted);font-size:17px;margin:2px 0 8px;">' + (pLen ? 'Periodo de ' + pLen + (pLen === 1 ? ' día' : ' días') : 'Inicio registrado sin días marcados') + '</div>' +
      '<div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;">' + dots + '</div></div>';
  }
  h += '</div>';
  // Ajustes, rendimiento por fase, compartir y borrar
  const inp = 'width:100%;box-sizing:border-box;font-size:18px;padding:11px;border:2px solid var(--surface-3);border-radius:10px;background:var(--surface);color:var(--chalk);';
  const btn = 'display:block;width:100%;background:var(--surface);border:2px solid var(--surface-3);color:var(--chalk);font-weight:700;font-size:16px;padding:14px 0;border-radius:12px;cursor:pointer;margin:0 0 12px;';
  h += '<details style="' + card + '"><summary style="font-size:19px;font-weight:800;cursor:pointer;">Ajustes de la previsión</summary>' +
    '<p style="color:var(--muted);font-size:15px;">Con 3 o más periodos registrados se usa la media de tus ciclos reales (ahora: ciclo de ' + wo2cyEffectiveLength(c) + ' días, periodo de ' + wo2cyPeriodLen(c) + ').</p>' +
    '<label style="display:block;font-weight:700;margin:10px 0 4px;">Duración habitual del ciclo (días)</label><input type="number" id="cyLen" min="21" max="40" value="' + (Number(c.cycleLength)||28) + '" style="' + inp + '">' +
    '<label style="display:block;font-weight:700;margin:10px 0 4px;">Duración habitual del periodo (días)</label><input type="number" id="cyPer" min="2" max="10" value="' + (Number(c.periodLength)||5) + '" style="' + inp + 'margin-bottom:10px;">' +
    '<button id="cySaveLens" style="' + btn + '">Guardar</button></details>';
  h += '<div style="font-size:22px;font-weight:800;margin:20px 0 10px;">Tu rendimiento por fase</div>' + (function(){ try{ return wo2cyTableHtml(c); }catch(e){ return ''; } })();
  h += '<hr style="border:none;border-top:1px solid var(--surface-3);margin:18px 0;">' +
    '<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;"><input type="checkbox" id="cyShare" style="width:24px;height:24px;flex:none;"' + (c.sharedWithCoach ? ' checked' : '') + '> Compartir con mi entrenador</label>' +
    '<p style="color:var(--muted);font-size:15px;">Si lo activas, tu entrenador verá tu fase actual y tus últimas fechas. Puedes quitarlo cuando quieras.</p>' +
    '<button id="cyDelete" style="' + btn + 'color:var(--red);border-color:var(--red);">Borrar todos mis datos del ciclo</button>' +
    '<p style="color:var(--muted);font-size:14px;">Estimación orientativa. No sustituye consejo médico.</p>';
  return h;
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
  let sel = wo2cyTodayStr();
  const pintar = (keep)=>{
    const y = ov.scrollTop;
    const c = wo2CicloData || Object.assign({}, WO2_CICLO_DEFAULT);
    setTimeout(()=>{ if (keep) ov.scrollTop = y; }, 0);
    let h = '<button id="cyBack" style="' + css.btn + '">← Volver</button><h2 style="' + css.h + 'text-align:center;">Control del ciclo</h2>';
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
      box.innerHTML = h + wo2cyScreenHtml(c, sel);
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
    // Tira de días: tocar un día lo selecciona
    box.querySelectorAll('[data-cyday]').forEach(b=> b.onclick = ()=>{ sel = b.getAttribute('data-cyday'); pintar(true); });
    const strip = q('cyStrip');
    if (strip){ const cur = strip.querySelector('[data-cyday="' + sel + '"]'); if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2; }
    // Registro del día seleccionado
    box.querySelectorAll('[data-cyflow]').forEach(b=> b.onclick = ()=>{
      if (sel > wo2cyTodayStr()){ alert('Solo se pueden registrar días de hoy o anteriores.'); return; }
      const v = b.getAttribute('data-cyflow');
      const days = Object.assign({}, c.days || {});
      if (v === 'no') delete days[sel]; else days[sel] = v;
      // Inicios antiguos (registrados sin días): se conservan, salvo el que se quite aquí
      let legacy = Array.isArray(c.legacyStarts) ? c.legacyStarts.slice() : (c.starts||[]).slice();
      if (v === 'no') legacy = legacy.filter(x=> x !== sel);
      const nc = Object.assign({}, c, { days, legacyStarts: legacy });
      const starts = wo2cyDerivedStarts(nc);
      guardar({ days, legacyStarts: starts.filter(x=> legacy.includes(x)), starts });
    });
    const per = q('cyPeriodo'); if (per) per.onclick = ()=>{ const f = q('cyFlow'); f.style.display = f.style.display === 'none' ? 'flex' : 'none'; };
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
    try{ await wo2CicloGuardar(patch); pintar(true); }
    catch(e){ alert('No se pudo guardar: ' + (e.message||e)); }
  };
  if (!wo2CicloData){
    box.textContent = 'Cargando…';
    wo2CicloRef().get().then(s=>{ wo2CicloData = s.exists ? Object.assign({}, WO2_CICLO_DEFAULT, s.data()) : Object.assign({}, WO2_CICLO_DEFAULT); pintar(); })
      .catch(e=>{ box.textContent = 'No se pudo cargar: ' + (e.message||e); });
  } else pintar();
}
