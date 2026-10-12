// WorkOut 2.0 · Extras de la app del atleta (lo inserta build_entreno.py):
//  1) Marcar un día como NO entrenado, con motivo.
//  2) Marcar un peso (series/repeticiones) como NO hecho, con motivo.
//  3) Pasar el entreno de un día a otro.
//  4) Tabla de códigos de movimientos en ventana emergente con zoom.
// Se guarda en progress/main → wo2x = { dayOff, setOff, moves }.
var WO2_REASONS = ['Molestia o dolor', 'Cansancio', 'Enfermedad', 'Falta de tiempo', 'Trabajo / estudios', 'Peso demasiado alto', 'Técnica', 'Otro'];

function wo2X(){
  if (!state.wo2x || typeof state.wo2x !== 'object') state.wo2x = {};
  ['dayOff','setOff','moves'].forEach(k=>{ if (!state.wo2x[k] || typeof state.wo2x[k] !== 'object') state.wo2x[k] = {}; });
  return state.wo2x;
}
function wo2Save(){ try{ persistUserData(); }catch(e){} if (typeof wo2ScheduleProgressPush === 'function') wo2ScheduleProgressPush(); }
function wo2CanEdit(){ return !(typeof WO2 !== 'undefined' && WO2.coachView); }
function wo2DayOff(plan, d){ return wo2X().dayOff[plan.id + '|' + d] || null; }
function wo2MovedTo(plan, d){ return wo2X().moves[plan.id + '|' + d] || null; }
function wo2MovedInto(plan, d){
  const m = wo2X().moves, out = [];
  DAY_ORDER.forEach(src=>{ if (m[plan.id + '|' + src] === d && (plan.days[src] || []).some(e=>e.type==='exercise')) out.push(src); });
  return out;
}
function wo2DayHidden(plan, d){ return !!wo2MovedTo(plan, d); }
function wo2SetOff(key){ return wo2X().setOff[key] || null; }
function wo2Esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// ---------- Ventana emergente genérica ----------
function wo2Modal(title, build){
  const bg = document.createElement('div');
  bg.className = 'wo2-modal-bg';
  const box = document.createElement('div');
  box.className = 'wo2-modal';
  const head = document.createElement('div');
  head.className = 'wo2-modal-head';
  head.innerHTML = '<div class="wo2-modal-title">' + wo2Esc(title) + '</div>';
  const x = document.createElement('button'); x.className = 'wo2-modal-x'; x.setAttribute('aria-label','Cerrar'); x.textContent = '✕';
  const close = ()=>{ bg.remove(); if (bg._onClose) bg._onClose(); };
  x.onclick = close;
  head.appendChild(x);
  box.appendChild(head);
  const body = document.createElement('div'); body.className = 'wo2-modal-body';
  box.appendChild(body);
  bg.appendChild(box);
  bg.addEventListener('click', e=>{ if (e.target === bg) close(); });
  document.body.appendChild(bg);
  build(body, close, bg);
  return bg;
}
// Selector de motivo (chips + texto libre)
function wo2ReasonPicker(body, initial){
  const lbl = document.createElement('div'); lbl.className = 'wo2-lbl'; lbl.textContent = 'Motivo';
  body.appendChild(lbl);
  const chips = document.createElement('div'); chips.className = 'wo2-chips';
  let picked = initial && WO2_REASONS.includes(initial.reason) ? initial.reason : null;
  WO2_REASONS.forEach(r=>{
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wo2-chip' + (picked === r ? ' on' : ''); b.textContent = r;
    b.onclick = ()=>{ picked = (picked === r) ? null : r; chips.querySelectorAll('.wo2-chip').forEach(c=> c.classList.toggle('on', c.textContent === picked)); };
    chips.appendChild(b);
  });
  body.appendChild(chips);
  const ta = document.createElement('textarea'); ta.className = 'wo2-ta'; ta.placeholder = 'Explícalo si quieres (opcional)…';
  ta.value = (initial && initial.text) || '';
  body.appendChild(ta);
  return ()=> ({ reason: picked, text: ta.value.trim() });
}
function wo2ReasonText(o){ return [o && o.reason, o && o.text].filter(Boolean).join(' · ') || 'sin motivo'; }

// ---------- 1 y 3: herramientas del día ----------
function wo2DayTools(section, plan, d){
  const off = wo2DayOff(plan, d), to = wo2MovedTo(plan, d), into = wo2MovedInto(plan, d);
  const hasEx = (plan.days[d] || []).some(e=>e.type==='exercise');
  if (to){
    const b = document.createElement('div'); b.className = 'wo2-banner moved';
    b.innerHTML = '<div class="wo2-banner-t">↪ Este entreno se ha pasado al ' + wo2Esc(DAY_NAMES[to].toLowerCase()) + '</div>';
    if (wo2CanEdit()){
      const row = document.createElement('div'); row.className = 'wo2-banner-btns';
      const go = document.createElement('button'); go.textContent = 'Ir al ' + DAY_NAMES[to].toLowerCase(); go.onclick = ()=>{ state.activeDay = to; render(); };
      const undo = document.createElement('button'); undo.textContent = 'Deshacer'; undo.onclick = ()=>{ delete wo2X().moves[plan.id + '|' + d]; wo2Save(); render(); };
      row.appendChild(go); row.appendChild(undo); b.appendChild(row);
    }
    section.appendChild(b);
    return;
  }
  if (off){
    const b = document.createElement('div'); b.className = 'wo2-banner off';
    b.innerHTML = '<div class="wo2-banner-t">🚫 Día no entrenado</div><div class="wo2-banner-r">' + wo2Esc(wo2ReasonText(off)) + '</div>';
    if (wo2CanEdit()){
      const row = document.createElement('div'); row.className = 'wo2-banner-btns';
      const ed = document.createElement('button'); ed.textContent = 'Cambiar motivo'; ed.onclick = ()=> wo2AskDayOff(plan, d);
      const undo = document.createElement('button'); undo.textContent = 'Sí entrené'; undo.onclick = ()=>{ delete wo2X().dayOff[plan.id + '|' + d]; wo2Save(); render(); };
      row.appendChild(ed); row.appendChild(undo); b.appendChild(row);
    }
    section.appendChild(b);
    section.classList.add('wo2-dim');
  }
  if (!wo2CanEdit() || off || !(hasEx || into.length)) return;
  const tools = document.createElement('div'); tools.className = 'wo2-daytools';
  const b1 = document.createElement('button'); b1.textContent = '🚫 No entrené este día'; b1.onclick = ()=> wo2AskDayOff(plan, d);
  tools.appendChild(b1);
  if (hasEx){
    const b2 = document.createElement('button'); b2.textContent = '↪ Pasar a otro día'; b2.onclick = ()=> wo2AskMove(plan, d);
    tools.appendChild(b2);
  }
  section.appendChild(tools);
}
function wo2AskDayOff(plan, d){
  const key = plan.id + '|' + d;
  wo2Modal('No entrené el ' + DAY_NAMES[d].toLowerCase(), (body, close)=>{
    const get = wo2ReasonPicker(body, wo2X().dayOff[key]);
    const save = document.createElement('button'); save.className = 'wo2-save'; save.textContent = 'Guardar';
    save.onclick = ()=>{ const r = get(); wo2X().dayOff[key] = Object.assign({ at: Date.now() }, r); wo2Save(); close(); render(); };
    body.appendChild(save);
  });
}
function wo2AskMove(plan, d){
  wo2Modal('Pasar el entreno del ' + DAY_NAMES[d].toLowerCase(), (body, close)=>{
    const p = document.createElement('div'); p.className = 'wo2-lbl'; p.textContent = '¿A qué día lo pasas?'; body.appendChild(p);
    const grid = document.createElement('div'); grid.className = 'wo2-days';
    DAY_ORDER.filter(x=> x !== d).forEach(x=>{
      const b = document.createElement('button'); b.type = 'button';
      const busy = (plan.days[x] || []).some(e=>e.type==='exercise');
      const dt = (typeof wo2DayDate === 'function') ? wo2DayDate(plan, x) : null;
      b.innerHTML = '<b>' + DAY_NAMES[x] + (dt ? ' ' + dt.getDate() : '') + '</b><span>' + (busy ? 'ya tiene entreno: se suman' : 'libre') + '</span>';
      b.onclick = ()=>{
        const m = wo2X().moves;
        m[plan.id + '|' + d] = x;
        // Si el día de destino estaba pasado a este, se deshace (no tiene sentido el ida y vuelta)
        if (m[plan.id + '|' + x] === d) delete m[plan.id + '|' + x];
        delete wo2X().dayOff[plan.id + '|' + d];
        wo2Save(); close(); state.activeDay = x; render();
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);
  });
}
// Sesiones traspasadas a este día
function wo2MovedBlock(section, plan, d){
  wo2MovedInto(plan, d).forEach(src=>{
    const h = document.createElement('div'); h.className = 'wo2-banner moved in';
    h.innerHTML = '<div class="wo2-banner-t">↪ Entreno del ' + wo2Esc(DAY_NAMES[src].toLowerCase()) + ' (traspasado aquí)</div>';
    section.appendChild(h);
    (plan.days[src] || []).forEach((entry, idx)=>{
      if (entry.type !== 'exercise') return;
      section.appendChild(renderExerciseCard(plan, src, entry, idx));
    });
  });
}
// Marca en el botón del día
function wo2PlateMark(plan, d, plate){
  if (wo2MovedTo(plan, d)){ plate.classList.add('plate-moved'); plate.textContent = '↪'; return; }
  if (wo2DayOff(plan, d)){ plate.classList.add('plate-off'); plate.textContent = '✕'; return; }
  if (wo2MovedInto(plan, d).length){
    plate.classList.add('plate-in');
    if (!plan.days[d]){ plate.classList.remove('plate-empty'); plate.textContent = d; }
  }
}

// ---------- 2: pesos no hechos ----------
function wo2ChipOff(chip, plan, day, exIdx, si){
  const o = wo2SetOff(checkKey(plan, day, exIdx, si));
  if (!o) return;
  chip.classList.add('off');
  const t = document.createElement('div'); t.className = 'wo2-chipoff';
  t.textContent = '✕ ' + wo2OffLabel(o) + ' — ' + wo2ReasonText(o);
  chip.appendChild(t);
}
function wo2OffLabel(o){
  if (!o || o.mode === 'all') return 'No hecho';
  if (o.mode === 'series') return o.series + ' serie' + (o.series == 1 ? '' : 's') + ' sin hacer';
  if (o.mode === 'reps') return 'Menos repeticiones: ' + o.reps + ' por serie';
  return 'No hecho';
}
function wo2SetOffButton(card, plan, day, exIdx, si, s){
  if (!wo2CanEdit()) {
    const o0 = wo2SetOff(checkKey(plan, day, exIdx, si));
    if (o0){ const n = document.createElement('div'); n.className = 'wo2-chipoff big'; n.textContent = '✕ ' + wo2OffLabel(o0) + ' — ' + wo2ReasonText(o0); card.appendChild(n); }
    return;
  }
  const key = checkKey(plan, day, exIdx, si);
  const o = wo2SetOff(key);
  if (o){
    const n = document.createElement('div'); n.className = 'wo2-chipoff big'; n.textContent = '✕ ' + wo2OffLabel(o) + ' — ' + wo2ReasonText(o);
    card.appendChild(n);
  }
  const b = document.createElement('button'); b.className = 'wo2-notdone'; b.type = 'button';
  b.textContent = o ? '✏️ Cambiar «no hecho»' : '✕ No lo hice / no completo';
  b.onclick = (e)=>{ e.stopPropagation(); wo2AskSetOff(plan, day, exIdx, si, s); };
  card.appendChild(b);
}
function wo2AskSetOff(plan, day, exIdx, si, s){
  const key = checkKey(plan, day, exIdx, si);
  const cur = wo2SetOff(key) || {};
  const nSeries = Number(s.series) || 1;
  const repsTxt = (typeof repDisplayText === 'function') ? repDisplayText(s) : (s.reps || '');
  wo2Modal(kgDisplayText(s) + ' · ' + nSeries + '×' + repsTxt, (body, close)=>{
    const l = document.createElement('div'); l.className = 'wo2-lbl'; l.textContent = '¿Qué no hiciste?'; body.appendChild(l);
    let mode = cur.mode || 'all';
    const opts = document.createElement('div'); opts.className = 'wo2-opts';
    const mk = (m, html)=>{ const b = document.createElement('button'); b.type = 'button'; b.className = 'wo2-opt' + (mode === m ? ' on' : ''); b.dataset.m = m; b.innerHTML = html; b.onclick = ()=>{ mode = m; opts.querySelectorAll('.wo2-opt').forEach(x=> x.classList.toggle('on', x.dataset.m === mode)); }; opts.appendChild(b); return b; };
    mk('all', '<b>Nada de este peso</b><span>' + (nSeries === 1 ? 'No hice la serie' : 'Ninguna de las ' + nSeries + ' series') + '</span>');
    const bS = mk('series', '<b>Algunas series</b><span>Series sin hacer: </span>');
    const inS = document.createElement('input'); inS.type = 'number'; inS.min = 1; inS.max = nSeries; inS.inputMode = 'numeric'; inS.value = cur.series || 1; inS.className = 'wo2-num';
    inS.onclick = (e)=>{ e.stopPropagation(); mode = 'series'; opts.querySelectorAll('.wo2-opt').forEach(x=> x.classList.toggle('on', x.dataset.m === mode)); };
    bS.querySelector('span').appendChild(inS);
    const bR = mk('reps', '<b>Menos repeticiones</b><span>Hice por serie: </span>');
    const inR = document.createElement('input'); inR.type = 'text'; inR.inputMode = 'numeric'; inR.value = cur.reps || ''; inR.placeholder = String(repsTxt); inR.className = 'wo2-num';
    inR.onclick = (e)=>{ e.stopPropagation(); mode = 'reps'; opts.querySelectorAll('.wo2-opt').forEach(x=> x.classList.toggle('on', x.dataset.m === mode)); };
    bR.querySelector('span').appendChild(inR);
    body.appendChild(opts);
    const get = wo2ReasonPicker(body, cur);
    const save = document.createElement('button'); save.className = 'wo2-save'; save.textContent = 'Guardar';
    save.onclick = ()=>{
      const r = get();
      const o = Object.assign({ mode, at: Date.now() }, r);
      if (mode === 'series') o.series = Math.max(1, Math.min(nSeries, parseInt(inS.value, 10) || 1));
      if (mode === 'reps') o.reps = inR.value.trim() || '0';
      wo2X().setOff[key] = o;
      try{ recordDayDate(plan, day); }catch(e){}
      wo2Save(); close(); render();
    };
    body.appendChild(save);
    if (wo2SetOff(key)){
      const del = document.createElement('button'); del.className = 'wo2-link'; del.textContent = 'Quitar «no hecho» (sí lo hice)';
      del.onclick = ()=>{ delete wo2X().setOff[key]; wo2Save(); close(); render(); };
      body.appendChild(del);
    }
  });
}

// ---------- 4: tabla de códigos ----------
function wo2ShowCodes(){
  const meta = document.querySelector('meta[name=viewport]');
  const oldVp = meta ? meta.getAttribute('content') : null;
  if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
  let size = 18;
  const bg = wo2Modal('Códigos de movimientos', (body)=>{
    const bar = document.createElement('div'); bar.className = 'wo2-codebar';
    const q = document.createElement('input'); q.type = 'search'; q.placeholder = 'Buscar por número o nombre'; q.className = 'wo2-search'; q.setAttribute('aria-label', 'Buscar código');
    const minus = document.createElement('button'); minus.textContent = 'A−'; minus.setAttribute('aria-label','Letra más pequeña');
    const plus = document.createElement('button'); plus.textContent = 'A+'; plus.setAttribute('aria-label','Letra más grande');
    bar.appendChild(q); bar.appendChild(minus); bar.appendChild(plus);
    body.appendChild(bar);
    const list = document.createElement('div'); list.className = 'wo2-codes';
    body.appendChild(list);
    const codes = Object.keys(DICT).map(Number).sort((a,b)=>a-b);
    function draw(){
      const t = q.value.trim().toLowerCase();
      list.style.fontSize = size + 'px';
      list.innerHTML = codes.filter(c=> !t || String(c) === t || String(c).startsWith(t) || DICT[c].toLowerCase().includes(t))
        .map(c=> '<div class="wo2-code"><b>' + c + '</b><span>' + wo2Esc(DICT[c]) + '</span></div>').join('') || '<div class="wo2-lbl">Ningún código coincide.</div>';
    }
    q.oninput = draw;
    minus.onclick = ()=>{ size = Math.max(14, size - 3); draw(); };
    plus.onclick = ()=>{ size = Math.min(44, size + 3); draw(); };
    draw();
  });
  bg.classList.add('codes');
  bg._onClose = ()=>{ if (meta && oldVp) meta.setAttribute('content', oldVp); };
}
