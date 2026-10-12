// WorkOut 2.0 · Competiciones en la app del atleta (lo inserta build_entreno.py).
// Lee sus fichas de competición en  WO2.base/competitions/{compId}  y las
// muestra en el menú «Competiciones» y en el día que compite dentro de su semana.
var WO2_COMPS = { list: [], loaded: false, loading: false };
function wo2LoadComps(force){
  if (!window.WO2C || typeof WO2 === 'undefined' || !WO2.base) return;
  if (WO2_COMPS.loading || (WO2_COMPS.loaded && !force)) return;
  WO2_COMPS.loading = true;
  WO2.base.collection('competitions').get().then(s=>{
    WO2_COMPS.list = s.docs.map(d=> Object.assign({ id:d.id }, d.data()));
    WO2_COMPS.loaded = true; WO2_COMPS.loading = false;
    render();
  }).catch(e=>{ console.warn('competiciones', e); WO2_COMPS.loaded = true; WO2_COMPS.loading = false; });
}
// Competiciones de ese día de la semana (según las fechas de la semana)
function wo2CompsOn(plan, d){
  wo2LoadComps();
  const x = wo2DayDate(plan, d); if (!x) return [];
  const iso = WO2C.iso(x);
  return WO2_COMPS.list.filter(c=> (c.day || c.startDate) === iso);
}
function wo2CompSummaryCard(c, onOpen){
  const card = el('div','ex-card');
  card.style.cssText = 'border:2px solid var(--gold,var(--t-accent)) !important;cursor:pointer;';
  const t = WO2C.total(c.results), g = c.goals || {};
  const when = WO2C.when(c);
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">' +
      '<div style="min-width:0;"><div style="font-size:14px;font-weight:800;letter-spacing:.12em;color:var(--t-accent2);">🏆 ' + (when === 'today' ? 'HOY COMPITES' : when === 'next' ? 'COMPETICIÓN' : 'COMPETICIÓN') + '</div>' +
      '<div class="ex-name" style="margin-top:4px;">' + WO2C.esc(c.name || 'Competición') + '</div>' +
      '<div class="ex-sub" style="margin-top:4px;">' + WO2C.esc([WO2C.fmt(c.day || c.startDate, { weekday:'long', day:'numeric', month:'long' }), c.place, c.category].filter(Boolean).join(' · ')) + '</div></div>' +
      (t !== null ? '<div style="text-align:right;flex-shrink:0;"><div style="font-family:ArchivoBlack,sans-serif;font-size:28px;color:var(--t-accent2);">' + t + ' kg</div><div class="ex-sub">total</div></div>' : '') +
    '</div>' +
    '<div style="font-size:16px;color:var(--muted);margin-top:10px;">Objetivo: arrancada <b style="color:var(--chalk)">' + (g.sn || '—') + '</b> · 2T <b style="color:var(--chalk)">' + (g.cj || '—') + '</b> · total <b style="color:var(--chalk)">' + (g.total || '—') + '</b></div>' +
    '<div style="margin-top:12px;"><span style="display:inline-flex;align-items:center;min-height:48px;padding:0 16px;border-radius:12px;background:var(--t-accent);color:var(--t-ink);font-weight:800;font-size:16px;">' + (WO2C.hasResults(c.results) ? 'Ver resultados' : 'Anotar resultados') + ' ›</span></div>';
  card.onclick = onOpen;
  return card;
}
function wo2CompDayBlock(section, plan, d){
  wo2CompsOn(plan, d).forEach(c=>{
    section.appendChild(wo2CompSummaryCard(c, ()=>{ state.showComps = true; state.compOpen = c.id; render(); }));
  });
}
function wo2RenderCompsScreen(){
  wo2LoadComps();
  const wrap = el('div','app');
  const top = el('div','topbar');
  const row = el('div','topbar-row');
  const left = el('div');
  const open = state.compOpen ? WO2_COMPS.list.find(c=> c.id === state.compOpen) : null;
  left.appendChild(el('div','athlete-name', open ? (open.name || 'Competición') : 'Competiciones'));
  left.appendChild(el('div','meta-line', open ? WO2C.range(open.startDate, open.endDate) + (open.place ? ' · ' + open.place : '') : 'Tu calendario, objetivos y resultados'));
  row.appendChild(left);
  const closeBtn = el('button','tb-btn', open ? '‹ Volver' : '✕ Cerrar');
  closeBtn.onclick = ()=>{ if (state.compOpen){ state.compOpen = null; } else { state.showComps = false; } render(); };
  row.appendChild(closeBtn);
  top.appendChild(row);
  wrap.appendChild(top);
  const section = el('div','day-section');
  section.style.paddingTop = '18px';
  wrap.appendChild(section);

  if (!WO2_COMPS.loaded){ section.appendChild(el('div','empty-day','Cargando…')); return wrap; }

  if (open){
    const info = el('div','ex-card');
    info.innerHTML = '<div class="ex-sub" style="font-size:15px;">Compites el</div>' +
      '<div class="ex-name" style="margin:2px 0 6px;">' + WO2C.esc(WO2C.fmt(open.day || open.startDate)) + '</div>' +
      (open.category ? '<div style="font-size:16px;color:var(--muted);">Categoría: <b style="color:var(--chalk)">' + WO2C.esc(open.category) + '</b></div>' : '') +
      (open.notes ? '<div style="white-space:pre-wrap;margin-top:12px;background:var(--surface-2);border-radius:12px;padding:12px;font-size:16px;line-height:1.5;">' + WO2C.esc(open.notes) + '</div>' : '');
    section.appendChild(info);
    const box = el('div'); section.appendChild(box);
    const coach = !!WO2.coachView;
    WO2C.renderEditor(box, open, {
      coach,
      onSave: async (ne)=>{
        const u = getActiveUser();
        const by = { name: coach ? 'Entrenador' : ((u && u.name) || 'Atleta'), role: coach ? 'coach' : 'athlete', uid: (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null };
        const upd = coach ? { goals: ne.goals, plan: ne.plan, results: ne.results, updatedBy: by, updatedAt: Date.now() }
                          : { results: ne.results, updatedBy: by, updatedAt: Date.now() };
        await WO2.base.collection('competitions').doc(open.id).update(upd);
        Object.assign(open, upd);
      },
      rmOf: async (code)=>{ const u = getActiveUser(); return WO2C.rmFromProfile(u && u.rms, code); },
      onNewRm: async (code, kg, dayIso)=>{
        const u = getActiveUser(); if (!u) return;
        if (!u.rms) u.rms = {};
        if (!u.rms[code]) u.rms[code] = [];
        u.rms[code].push({ value: kg, date: WO2C.date(dayIso).getTime() });
        u.rms[code].sort((a,b)=> a.date - b.date);
        if (WO2.coachView){
          await WO2.base.collection('progress').doc('profile').set({ rms: u.rms, updatedAt: Date.now() }, { merge:true });
        } else {
          wo2ScheduleProfilePush();
        }
      }
    });
    return wrap;
  }

  const t = WO2C.today();
  const next = WO2_COMPS.list.filter(c=> (c.day || c.startDate) >= t).sort((a,b)=> (a.day||a.startDate) < (b.day||b.startDate) ? -1 : 1);
  const past = WO2_COMPS.list.filter(c=> (c.day || c.startDate) < t).sort((a,b)=> (a.day||a.startDate) > (b.day||b.startDate) ? -1 : 1);
  function group(title, list, emptyText){
    const h = el('div','day-heading'); h.appendChild(el('h2', null, title)); section.appendChild(h);
    if (!list.length){ section.appendChild(el('div','empty-day', emptyText)); return; }
    list.forEach(c=> section.appendChild(wo2CompSummaryCard(c, ()=>{ state.compOpen = c.id; render(); })));
  }
  group('Próximas', next, 'No tienes competiciones próximas.');
  if (past.length) group('Pasadas', past, '');
  return wrap;
}
