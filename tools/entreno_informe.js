// ===== Cronómetro del entreno + informe semanal por tablas =====
// Tiempos: state.wo2x.times['planId|día'] = { end, ex: { idx: { start, end, auto } } }
//  · Cada movimiento tiene «▶ Iniciar». El entreno empieza con el primer movimiento
//    iniciado y termina al resolver (marcar o «no hecho») la última serie del día.
//  · Si se marca una serie sin haber pulsado «Iniciar», el movimiento se inicia solo.

function wo2Times(){ const x = wo2X(); if (!x.times || typeof x.times !== 'object') x.times = {}; return x.times; }
function wo2TDay(plan, d, create){
  const t = wo2Times(), k = plan.id + '|' + d;
  if (!t[k] && create) t[k] = { end:null, ex:{} };
  if (t[k] && !t[k].ex) t[k].ex = {};
  return t[k] || null;
}
function wo2ExIdxList(plan, d){
  const out = []; (plan.days[d] || []).forEach((e, i)=>{ if (e.type === 'exercise') out.push(i); }); return out;
}
function wo2SetResolved(plan, d, i, si){
  const k = checkKey(plan, d, i, si);
  return !!(state.checks[k] || wo2SetOff(k));
}
function wo2ExResolved(plan, d, i){
  const e = plan.days[d][i]; if (!e || !e.sets || !e.sets.length) return false;
  return e.sets.every((s, si)=> wo2SetResolved(plan, d, i, si));
}
function wo2ExTouched(plan, d, i){
  const e = plan.days[d][i]; if (!e || !e.sets) return false;
  return e.sets.some((s, si)=> wo2SetResolved(plan, d, i, si));
}
function wo2ExStart(plan, d, i){
  if (!wo2CanEdit()) return;
  const t = wo2TDay(plan, d, true);
  t.ex[i] = { start: Date.now() };
  wo2Save(); render();
}
function wo2ExReset(plan, d, i){
  if (!wo2CanEdit()) return;
  if (!confirm('¿Volver a poner a cero el tiempo de este movimiento?')) return;
  const t = wo2TDay(plan, d, false); if (!t) return;
  delete t.ex[i]; t.end = null;
  wo2Save(); render();
}
// Se ejecuta antes de cada guardado: inicia solo lo que se marcó sin «Iniciar»
// y cierra movimientos y entreno cuando está todo resuelto.
function wo2TimeSync(){
  if (!state || !state.plans) return;
  const plan = state.plans.find(p=> p.id === state.activePlanId); if (!plan) return;
  const days = new Set();
  if (state.activeDay) days.add(state.activeDay);
  if (state.activeDay) wo2MovedInto(plan, state.activeDay).forEach(s=> days.add(s));
  if (state.flashcard && state.flashcard.day) days.add(state.flashcard.day);
  const now = Date.now();
  days.forEach(d=>{
    const idxs = wo2ExIdxList(plan, d); if (!idxs.length) return;
    idxs.forEach(i=>{
      const sk = plan.id + '|' + d + '|' + i, cnt = wo2ResolvedCount(plan, d, i), prev = WO2T_SNAP[sk];
      WO2T_SNAP[sk] = cnt;
      let t = wo2TDay(plan, d, false);
      // Se marcó la primera serie sin haber pulsado «Iniciar»: empieza ahora
      if (prev === 0 && cnt > 0 && !(t && t.ex[i] && t.ex[i].start)){ t = wo2TDay(plan, d, true); t.ex[i] = { start: now, auto: true }; }
      const cur = t && t.ex[i];
      if (!cur || !cur.start) return;
      if (wo2ExResolved(plan, d, i)){ if (!cur.end) cur.end = now; }
      else if (cur.end) delete cur.end;
    });
    const t = wo2TDay(plan, d, false); if (!t) return;
    const started = Object.values(t.ex || {}).some(x=> x && x.start);
    const all = idxs.every(i=> wo2ExResolved(plan, d, i));
    if (all && started){ if (!t.end) t.end = now; } else t.end = null;
  });
}
// Series resueltas de cada movimiento la última vez que se vio en pantalla
var WO2T_SNAP = {};
function wo2ResolvedCount(plan, d, i){
  const e = plan.days[d][i]; if (!e || !e.sets) return 0;
  return e.sets.filter((s, si)=> wo2SetResolved(plan, d, i, si)).length;
}
// Se engancha al guardado cuando la app ya ha cargado (persistUserData se define después)
function wo2HookPersist(){
  if (typeof persistUserData !== 'function' || persistUserData.wo2t) return;
  const orig = persistUserData;
  persistUserData = function(){ try{ wo2TimeSync(); }catch(e){} return orig.apply(this, arguments); };
  persistUserData.wo2t = true;
}
document.addEventListener('DOMContentLoaded', wo2HookPersist);

function wo2Dur(ms){
  if (ms == null || ms < 0) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'menos de 1 min';
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? (h + ' h ' + String(mm).padStart(2,'0') + ' min') : (mm + ' min');
}
function wo2Clock(ms){
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + ':' + String(m).padStart(2,'0') : m) + ':' + String(ss).padStart(2,'0');
}
function wo2Hm(ts){ return new Date(ts).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }); }
// Duración del entreno de un día: { start, end, ms, running }
function wo2DayDuration(plan, d){
  const t = wo2TDay(plan, d, false); if (!t) return null;
  const starts = Object.values(t.ex || {}).map(x=> x && x.start).filter(Boolean);
  if (!starts.length) return null;
  const start = Math.min.apply(null, starts);
  if (t.end) return { start, end: t.end, ms: t.end - start, running: false };
  return { start, end: null, ms: Date.now() - start, running: true };
}
function wo2ExDuration(plan, d, i){
  const t = wo2TDay(plan, d, false); const x = t && t.ex && t.ex[i];
  if (!x || !x.start) return null;
  return { start: x.start, end: x.end || null, ms: (x.end || Date.now()) - x.start, running: !x.end, auto: !!x.auto };
}

// ---------- En pantalla ----------
function wo2ExTimerRow(card, plan, d, i){
  const sk = plan.id + '|' + d + '|' + i;
  if (WO2T_SNAP[sk] === undefined) WO2T_SNAP[sk] = wo2ResolvedCount(plan, d, i);
  const ex = wo2ExDuration(plan, d, i);
  const row = document.createElement('div');
  row.className = 'wo2-extimer';
  row.onclick = (e)=> e.stopPropagation();
  if (!ex){
    if (!wo2CanEdit()) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wo2-exstart';
    b.textContent = '▶ Iniciar movimiento';
    b.onclick = (e)=>{ e.stopPropagation(); wo2ExStart(plan, d, i); };
    row.appendChild(b);
  } else {
    const s = document.createElement('span');
    if (ex.running){ s.className = 'wo2-exrun'; s.dataset.wo2tStart = ex.start; s.textContent = '⏱ En curso · ' + wo2Clock(ex.ms); }
    else { s.className = 'wo2-exdone'; s.textContent = '✓ Hecho en ' + wo2Dur(ex.ms) + ' (' + wo2Hm(ex.start) + ' → ' + wo2Hm(ex.end) + ')'; }
    row.appendChild(s);
    if (wo2CanEdit()){
      const r = document.createElement('button'); r.type = 'button'; r.className = 'wo2-exreset'; r.textContent = '↺';
      r.setAttribute('aria-label', 'Poner a cero el tiempo de este movimiento');
      r.onclick = (e)=>{ e.stopPropagation(); wo2ExReset(plan, d, i); };
      row.appendChild(r);
    }
  }
  card.appendChild(row);
}
function wo2DayTimer(section, plan, d){
  const dd = wo2DayDuration(plan, d);
  const box = document.createElement('div'); box.className = 'wo2-daytimer';
  if (!dd){
    if (!wo2CanEdit() || !wo2ExIdxList(plan, d).length) return;
    box.classList.add('idle');
    box.textContent = '⏱ Pulsa «▶ Iniciar movimiento» en el primer ejercicio para cronometrar el entreno.';
  } else if (dd.running){
    box.innerHTML = '⏱ Entreno en curso · <b data-wo2t-start="' + dd.start + '">' + wo2Clock(dd.ms) + '</b> <span>(desde las ' + wo2Hm(dd.start) + ')</span>';
  } else {
    box.classList.add('done');
    box.innerHTML = '⏱ Entreno completado en <b>' + wo2Dur(dd.ms) + '</b> <span>(' + wo2Hm(dd.start) + ' → ' + wo2Hm(dd.end) + ')</span>';
  }
  section.appendChild(box);
}
setInterval(()=>{
  document.querySelectorAll('[data-wo2t-start]').forEach(n=>{
    const ms = Date.now() - Number(n.dataset.wo2tStart);
    n.textContent = (n.classList.contains('wo2-exrun') ? '⏱ En curso · ' : '') + wo2Clock(ms);
  });
}, 1000);

// ---------- Informe diario: duración ----------
function wo2TimeDecorate(plan, d, data){
  const dd = wo2DayDuration(plan, d);
  data.durationTxt = dd ? (dd.running ? 'En curso (' + wo2Dur(dd.ms) + ')' : wo2Dur(dd.ms)) : null;
  data.durationRange = dd ? (wo2Hm(dd.start) + ' → ' + (dd.end ? wo2Hm(dd.end) : 'en curso')) : '';
  const idxs = wo2ExIdxList(plan, d);
  (data.exLines || []).forEach((l, n)=>{
    const ex = idxs[n] != null ? wo2ExDuration(plan, d, idxs[n]) : null;
    if (ex && !ex.running) l.name += ' (' + wo2Dur(ex.ms) + ')';
  });
}

// ---------- Datos de la semana ----------
const WO2_RATING_TXT = { 1:'Muy mal', 2:'Mal', 3:'Regular', 4:'Bien', 5:'Muy bien' };
function wo2RepsNum(s){
  if (s.repsParts && s.repsParts.length) return s.repsParts.reduce((a,b)=> a + (Number(b)||0), 0);
  const raw = s.reps != null ? s.reps : s.repsRaw;
  if (raw == null) return 0;
  return String(raw).split('+').reduce((a,b)=> a + (parseFloat(String(b).replace(',', '.')) || 0), 0);
}
// Series, repeticiones y kilos realmente hechos de un peso (lo marcado; «no hecho» descuenta)
function wo2SetDone(plan, d, i, si){
  const e = plan.days[d][i], s = e.sets[si], k = checkKey(plan, d, i, si);
  const r = normalizeCheck(state.checks[k]), off = wo2SetOff(k);
  let series = Number(s.series) || 1, reps = wo2RepsNum(s);
  if (off){
    if (off.mode === 'series') series = Math.max(0, series - (Number(off.series) || 0));
    else if (off.mode === 'reps') reps = Number(off.reps) || 0;
    else { series = 0; }
  } else if (r === null) series = 0;
  const kg = Number(s.kg) || 0;
  let ton = kg * series * reps, totReps = series * reps;
  if (s.cluster && series > 0){
    const c = s.cluster, cs = Number(c.series) || 1, cr = wo2RepsNum(c);
    ton += (Number(c.kg) || 0) * cs * cr; totReps += cs * cr;
  }
  return { series, reps: totReps, ton };
}
function wo2ExName(e){
  const n = e.name || (typeof DICT !== 'undefined' && DICT[e.code]) || ('Código ' + e.code);
  return (typeof wo2WithCode === 'function' && (e.name || DICT[e.code])) ? wo2WithCode(n, e) : n;
}
function wo2SetResultTxt(plan, d, i, si){
  const k = checkKey(plan, d, i, si), off = wo2SetOff(k);
  if (off) return (typeof wo2OffLabel === 'function' ? wo2OffLabel(off) : 'No hecho') + ' — ' + wo2ReasonText(off);
  const r = normalizeCheck(state.checks[k]);
  return r ? (WO2_RATING_TXT[r] + ' (' + r + '/5)') : 'Sin marcar';
}
function wo2WeekData(plan){
  const days = [], byMove = {};
  let sTot = 0, sDone = 0, ton = 0, ratings = [], rpes = [], timeMs = 0, trained = 0, planned = 0;
  DAY_ORDER.forEach(d=>{
    const own = wo2ExIdxList(plan, d);
    const moved = wo2MovedTo(plan, d);
    const off = wo2DayOff(plan, d);
    const into = wo2MovedInto(plan, d);
    if (!own.length && !into.length) return;
    if (own.length) planned++;
    const blocks = [];
    const srcs = (moved ? [] : [d]).concat(into);
    srcs.forEach(sd=>{
      wo2ExIdxList(plan, sd).forEach(i=>{
        const e = plan.days[sd][i];
        const rows = e.sets.map((s, si)=>{
          sTot++;
          const res = wo2SetResolved(plan, sd, i, si);
          if (res) sDone++;
          const r = normalizeCheck(state.checks[checkKey(plan, sd, i, si)]);
          if (r) ratings.push(r);
          const dn = wo2SetDone(plan, sd, i, si);
          ton += dn.ton;
          const key = e.code != null ? 'c' + e.code : 'n' + (e.name || '');
          if (!byMove[key]) byMove[key] = { name: wo2ExName(e), series:0, reps:0, ton:0 };
          byMove[key].series += dn.series; byMove[key].reps += dn.reps; byMove[key].ton += dn.ton;
          return { kg: kgDisplayText(s), sr: (s.series || '?') + ' × ' + repDisplayText(s) + (s.cluster ? ' + ' + kgDisplayText(s.cluster) + ' × ' + (s.cluster.series||'?') + ' × ' + repDisplayText(s.cluster) : ''), res: wo2SetResultTxt(plan, sd, i, si), rating: r, off: !!wo2SetOff(checkKey(plan, sd, i, si)) };
        });
        const note = normalizeNote(state.notes[noteKey(plan, sd, i)]).text;
        const ex = wo2ExDuration(plan, sd, i);
        blocks.push({ name: wo2ExName(e), rows, note, dur: ex && !ex.running ? wo2Dur(ex.ms) : '', from: sd !== d ? sd : null });
      });
    });
    const n = normalizeNote(state.notes[noteKey(plan, d)]);
    const dd = wo2DayDuration(plan, d);
    if (dd && !dd.running) timeMs += dd.ms;
    if (n.rpe != null) rpes.push(n.rpe);
    const anyDone = blocks.some(b=> b.rows.some(r=> r.rating || r.off));
    if (anyDone) trained++;
    const ms = plan.dayDates && plan.dayDates[d];
    let dateStr = '';
    if (ms) dateStr = new Date(ms).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
    else if (typeof wo2DayDate === 'function'){ const x = wo2DayDate(plan, d); if (x) dateStr = x.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); }
    const vids = (typeof WO2 !== 'undefined' && WO2.videos) ? WO2.videos.filter(v=> v.planId === plan.id && srcs.indexOf(v.day) >= 0) : [];
    days.push({ d, name: DAY_NAMES[d], dateStr, blocks, off, movedTo: moved, note: n.text, rpe: n.rpe, feeling: n.feeling, dur: dd, vids });
  });
  const moves = Object.values(byMove).filter(m=> m.series > 0).sort((a,b)=> b.ton - a.ton);
  const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0) / ratings.length : null;
  const avgRpe = rpes.length ? rpes.reduce((a,b)=>a+b,0) / rpes.length : null;
  return { days, moves, sTot, sDone, ton: Math.round(ton), avg, avgRpe, timeMs, trained, planned };
}
function wo2VideoLink(v, title){
  if (typeof wo2VideoPage === 'function') return wo2VideoPage(v, title);
  return v.link;
}

// ---------- Texto (copiar / compartir) ----------
function wo2WeekText(plan, memoText){
  const W = wo2WeekData(plan), L = [];
  const wk = plan.meta && plan.meta.week != null ? 'Semana ' + plan.meta.week : 'Programación semanal';
  L.push('INFORME SEMANAL — ' + wk);
  L.push('Atleta: ' + getActiveUser().name);
  L.push('Días entrenados: ' + W.trained + '/' + W.planned + ' · Series hechas: ' + W.sDone + '/' + W.sTot + ' · Tonelaje: ' + W.ton + ' kg' + (W.timeMs ? ' · Tiempo total: ' + wo2Dur(W.timeMs) : ''));
  W.days.forEach(D=>{
    L.push('');
    L.push('=== ' + D.name.toUpperCase() + (D.dateStr ? ' · ' + D.dateStr : '') + (D.dur ? ' · Duración: ' + (D.dur.running ? 'en curso' : wo2Dur(D.dur.ms) + ' (' + wo2Hm(D.dur.start) + '–' + wo2Hm(D.dur.end) + ')') : '') + ' ===');
    if (D.movedTo){ L.push('Entreno pasado al ' + DAY_NAMES[D.movedTo] + '.'); return; }
    if (D.off) L.push('NO ENTRENADO — ' + wo2ReasonText(D.off));
    D.blocks.forEach(b=>{
      L.push('• ' + b.name + (b.from ? ' [traído del ' + DAY_NAMES[b.from] + ']' : '') + (b.dur ? ' — ' + b.dur : ''));
      b.rows.forEach(r=> L.push('    ' + r.kg + '  ' + r.sr + '  →  ' + r.res));
      if (b.note) L.push('    Nota: ' + b.note);
    });
    const bits = [];
    if (D.rpe != null) bits.push('RPE ' + D.rpe + '/10');
    if (D.feeling) bits.push('Sensación: ' + stripEmojiForPDF(feelingLabel(D.feeling)));
    if (bits.length) L.push(bits.join(' · '));
    if (D.note) L.push('Nota del día: ' + D.note);
    D.vids.forEach(v=> L.push('Vídeo: ' + wo2VideoLink(v, v.label) ));
  });
  L.push('');
  L.push('SENSACIÓN GENERAL DE LA SEMANA');
  L.push('Valoración media de los pesos: ' + (W.avg != null ? W.avg.toFixed(1) + '/5 (' + WO2_RATING_TXT[Math.round(W.avg)] + ')' : 'sin datos') + (W.avgRpe != null ? ' · RPE medio: ' + W.avgRpe.toFixed(1) + '/10' : ''));
  if (plan.weekComment) L.push('Comentario del atleta: ' + plan.weekComment);
  L.push('');
  L.push('TONELAJE POR MOVIMIENTO');
  W.moves.forEach(m=> L.push('- ' + m.name + ': ' + Math.round(m.ton) + ' kg (' + m.series + ' series, ' + m.reps + ' repeticiones)'));
  L.push('TOTAL: ' + W.ton + ' kg');
  if (memoText){ L.push(''); L.push('LECTURA DEL ENTRENADOR:'); L.push(memoText); }
  return L.join('\n');
}

// ---------- PDF ----------
function wo2WeekPDF(plan, memoText){
  const W = wo2WeekData(plan);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
  const mX = 14, cW = pageW - mX*2;
  let y = 0;
  const T = (s)=> stripEmojiForPDF(String(s == null ? '' : s));
  function brk(need){ if (y + need > pageH - 14){ doc.addPage(); y = 16; return true; } return false; }

  // Cabecera
  doc.setFillColor(32,36,46); doc.rect(0,0,pageW,34,'F');
  const logoAR = 1035/622, logoH = 18, logoW = logoH*logoAR;
  try{ doc.addImage('data:image/png;base64,' + RPT_LOGO_FIGURE_B64, 'PNG', mX, 8, logoW, logoH); }catch(e){}
  const tx = mX + logoW + 6;
  doc.setTextColor(201,154,46); doc.setFont('helvetica','bold'); doc.setFontSize(17);
  doc.text('INFORME SEMANAL DE ENTRENO', tx, 14);
  doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(230,230,230);
  const wk = plan.meta && plan.meta.week != null ? 'Semana ' + plan.meta.week : 'Programación semanal';
  const firstDate = (W.days.find(D=> D.dateStr) || {}).dateStr, lastDate = (W.days.slice().reverse().find(D=> D.dateStr) || {}).dateStr;
  doc.text(T(wk + (firstDate ? '  ·  ' + firstDate + (lastDate && lastDate !== firstDate ? ' – ' + lastDate : '') : '')), tx, 21);
  doc.text(T('Atleta: ' + getActiveUser().name), tx, 27.5);
  y = 42;

  // Resumen
  const boxes = [
    ['Días entrenados', W.trained + ' de ' + W.planned],
    ['Series hechas', W.sDone + ' de ' + W.sTot + (W.sTot ? ' (' + Math.round(100*W.sDone/W.sTot) + '%)' : '')],
    ['Tonelaje total', W.ton.toLocaleString('es-ES') + ' kg'],
    ['Tiempo de entreno', W.timeMs ? wo2Dur(W.timeMs) : '—'],
    ['Valoración media', W.avg != null ? W.avg.toFixed(1) + '/5' : '—']
  ];
  const bw = cW / boxes.length;
  boxes.forEach((b, n)=>{
    const x = mX + n*bw;
    doc.setFillColor(244,245,247); doc.roundedRect(x + 1, y, bw - 2, 16, 2, 2, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
    doc.text(b[0].toUpperCase(), x + 4, y + 5.5);
    doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(25,25,25);
    doc.text(T(b[1]), x + 4, y + 12.5);
  });
  y += 23;

  // Tabla genérica
  function table(cols, rows, opt){
    opt = opt || {};
    const fs = 8.6, lh = 3.7, pad = 1.8;
    doc.setFontSize(fs);
    function header(){
      doc.setFillColor(32,36,46); doc.rect(mX, y, cW, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
      let x = mX; cols.forEach(c=>{ doc.text(c.t, x + pad, y + 4.8); x += c.w; });
      y += 7; doc.setFontSize(fs);
    }
    header();
    let shade = false, lastGroup = null;
    rows.forEach(r=>{
      if (r.group !== lastGroup){ shade = !shade; lastGroup = r.group; }
      const cells = r.cells.map((v, n)=> doc.splitTextToSize(T(v), cols[n].w - pad*2));
      const lines = Math.max.apply(null, cells.map(c=> c.length || 1));
      const h = lines * lh + pad*1.6;
      if (brk(h)) header();
      if (shade){ doc.setFillColor(248,248,250); doc.rect(mX, y, cW, h, 'F'); }
      doc.setDrawColor(228,228,232); doc.line(mX, y + h, mX + cW, y + h);
      let x = mX;
      cells.forEach((c, n)=>{
        const st = (r.styles && r.styles[n]) || {};
        doc.setFont('helvetica', st.bold ? 'bold' : 'normal');
        doc.setTextColor.apply(doc, st.color || [35,35,35]);
        c.forEach((line, k)=> doc.text(line, x + pad, y + pad + 2.6 + k*lh));
        x += cols[n].w;
      });
      y += h;
    });
    y += 3;
  }
  const RC = { 1:[200,70,40], 2:[214,110,30], 3:[47,111,228], 4:[47,111,228], 5:[80,110,25] };

  // Días
  W.days.forEach(D=>{
    brk(22);
    doc.setFillColor(201,154,46); doc.rect(mX, y, 2.2, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(25,25,25);
    doc.text(T(D.name.toUpperCase() + (D.dateStr ? '  ·  ' + D.dateStr : '')), mX + 5, y + 6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(80,80,80);
    const durTxt = D.dur ? ('Duración: ' + (D.dur.running ? 'en curso' : wo2Dur(D.dur.ms) + '  (' + wo2Hm(D.dur.start) + ' - ' + wo2Hm(D.dur.end) + ')')) : (D.blocks.length && !D.off && !D.movedTo ? 'Duración: sin cronometrar' : '');
    if (durTxt) doc.text(T(durTxt), pageW - mX, y + 6, { align:'right' });
    y += 11;
    if (D.movedTo){
      doc.setFontSize(10); doc.setTextColor(90,90,90);
      doc.text(T('Entreno pasado al ' + DAY_NAMES[D.movedTo] + ' (aparece en ese día).'), mX + 5, y); y += 8; return;
    }
    if (D.off){
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(200,60,60);
      doc.text(T('NO ENTRENADO — ' + wo2ReasonText(D.off)), mX + 5, y); y += 7;
    }
    if (D.blocks.length){
      const cols = [ { t:'MOVIMIENTO', w:52 }, { t:'PESO', w:20 }, { t:'SERIES × REPS', w:30 }, { t:'RESULTADO', w:44 }, { t:'NOTAS', w:cW-146 } ];
      const rows = [];
      D.blocks.forEach((b, bi)=>{
        b.rows.forEach((r, ri)=>{
          rows.push({
            group: bi,
            cells: [ ri === 0 ? b.name + (b.from ? '\n(del ' + DAY_NAMES[b.from] + ')' : '') + (b.dur ? '\nTiempo: ' + b.dur : '') : '', r.kg, r.sr, r.res, ri === 0 ? (b.note || '') : '' ],
            styles: [ { bold:true }, { bold:true }, {}, { color: r.off ? [200,60,60] : (r.rating ? RC[r.rating] : [150,150,150]), bold: !!(r.off || r.rating) }, { color:[90,90,90] } ]
          });
        });
      });
      table(cols, rows);
    }
    const bits = [];
    if (D.rpe != null) bits.push('RPE ' + D.rpe + '/10');
    if (D.feeling) bits.push('Sensación: ' + feelingLabel(D.feeling));
    if (bits.length || D.note){
      doc.setFontSize(9.5); doc.setTextColor(50,50,50);
      if (bits.length){ brk(6); doc.setFont('helvetica','bold'); doc.text(T(bits.join('   ·   ')), mX + 2, y); y += 5; }
      if (D.note){
        doc.setFont('helvetica','normal');
        doc.splitTextToSize(T('Nota del día: ' + D.note), cW - 4).forEach(l=>{ brk(5); doc.text(l, mX + 2, y); y += 4.6; });
      }
    }
    if (D.vids.length){
      doc.setFontSize(9.5);
      D.vids.forEach(v=>{
        brk(6);
        doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50);
        const lbl = T('Vídeo · ' + (v.label || 'serie') + ' · ' + wo2Hm(v.createdAt || Date.now()));
        doc.text(lbl, mX + 2, y);
        doc.setTextColor(30,100,200); doc.setFont('helvetica','bold');
        doc.textWithLink('Ver vídeo', mX + 4 + doc.getTextWidth(lbl), y, { url: wo2VideoLink(v, v.label) });
        y += 5;
      });
    }
    y += 5;
  });

  // Sensación general
  y += 3; brk(30);
  doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(201,154,46);
  doc.text('SENSACIÓN GENERAL DE LA SEMANA', mX, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(35,35,35);
  const sens = [
    'Valoración media de los pesos: ' + (W.avg != null ? W.avg.toFixed(1) + '/5 (' + WO2_RATING_TXT[Math.round(W.avg)] + ')' : 'sin datos'),
    'RPE medio: ' + (W.avgRpe != null ? W.avgRpe.toFixed(1) + '/10' : 'sin registrar'),
    'Sensación por día: ' + (W.days.filter(D=> D.feeling).map(D=> D.name + ' ' + T(feelingLabel(D.feeling))).join(' · ') || 'sin registrar')
  ];
  const offDays = W.days.filter(D=> D.off);
  if (offDays.length) sens.push('Días no entrenados: ' + offDays.map(D=> D.name + ' (' + wo2ReasonText(D.off) + ')').join(' · '));
  if (plan.weekComment) sens.push('Comentario del atleta: ' + plan.weekComment);
  sens.forEach(s=> doc.splitTextToSize(T(s), cW).forEach(l=>{ brk(5.5); doc.text(l, mX, y); y += 5.2; }));
  y += 5;

  // Tonelaje por movimiento
  brk(24);
  doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(201,154,46);
  doc.text('TONELAJE POR MOVIMIENTO', mX, y); y += 5;
  const mrows = W.moves.map((m, n)=>({ group:n, cells:[ m.name, String(m.series), String(m.reps), Math.round(m.ton).toLocaleString('es-ES') + ' kg' ], styles:[ {bold:true}, {}, {}, {bold:true} ] }));
  mrows.push({ group:'t', cells:[ 'TOTAL', String(W.moves.reduce((a,m)=>a+m.series,0)), String(W.moves.reduce((a,m)=>a+m.reps,0)), W.ton.toLocaleString('es-ES') + ' kg' ], styles:[ {bold:true}, {bold:true}, {bold:true}, {bold:true, color:[201,154,46]} ] });
  table([ { t:'MOVIMIENTO', w:90 }, { t:'SERIES', w:28 }, { t:'REPETICIONES', w:32 }, { t:'TONELAJE', w:cW-150 } ], mrows);

  if (memoText){
    y += 6; brk(16);
    doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(201,154,46);
    doc.text('LECTURA DEL ENTRENADOR', mX, y); y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(35,35,35);
    doc.splitTextToSize(T(memoText), cW).forEach(l=>{ brk(5.5); doc.text(l, mX, y); y += 5.2; });
  }

  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++){
    doc.setPage(i); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(160,160,160);
    doc.text('Generado el ' + new Date().toLocaleDateString('es-ES') + '   ·   página ' + i + ' de ' + pc, mX, pageH - 7);
  }
  const fileWeek = (plan.meta && plan.meta.week != null) ? ('semana' + plan.meta.week) : 'programacion';
  doc.save('informe-semanal-' + fileWeek + '.pdf');
}
