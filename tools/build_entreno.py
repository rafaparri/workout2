#!/usr/bin/env python3
"""
Genera entreno.html (la app del atleta de WorkOut 2.0) a partir de la app
original mi-plan-halterofilia.html, para que ambas sean siempre la misma app.

Cada vez que se mejore la app original, basta con volver a ejecutar este
script: copia la app original entera y le aplica unos pocos cambios:
  - Usa el Firebase de WorkOut 2.0 y la cuenta del atleta (no el código de
    sincronización ni la lista local de deportistas).
  - La programación la pone el entrenador: el atleta no puede subir, borrar,
    renombrar ni editar semanas, ejercicios o pesos.
  - Muestra arriba la franja con el logo del club + "con tecnología de RPT".

Si algún parche deja de encajar (porque la app original ha cambiado en ese
punto), el script se detiene y dice cuál, en vez de generar algo roto.

Uso: python3 build_entreno.py original.html entreno.html
"""
import sys

src_path, out_path = sys.argv[1], sys.argv[2]
html = open(src_path, encoding='utf-8').read()


def patch(old, new, count=1):
    global html
    n = html.count(old)
    if n != count:
        raise SystemExit('PARCHE QUE NO ENCAJA (%d coincidencias, se esperaban %d):\n%s' % (n, count, old[:200]))
    html = html.replace(old, new)


# ---------- Cabecera: título, Firebase Auth, configuración de WorkOut 2.0 ----------
patch('<title>Mi Plan · Halterofilia</title>', '<title>WorkOut 2.0 · Mi entreno</title>')
patch('<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>',
      '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>\n'
      '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>\n'
      '<script src="firebase-init.js"></script>\n'
      '<script src="branding.js"></script>')
# La configuración del Firebase original no se usa aquí (evita el choque de nombres)
patch('const firebaseConfig = {\n  apiKey: "AIzaSyAZsCxPgTvFddB5IhDe6hqWtkycykMXAKw"',
      'const firebaseConfig_ORIGINAL = {\n  apiKey: "AIzaSyAZsCxPgTvFddB5IhDe6hqWtkycykMXAKw"')
patch('    firebase.initializeApp(firebaseConfig);\n    fbDb = firebase.firestore();',
      '    fbDb = db; // WorkOut 2.0: ya inicializado en firebase-init.js')

# Franja de marca (logo del club + RPT) encima de la app
patch('<body>\n<div id="root"></div>', '<body>\n<div id="brandStripContainer"></div>\n<div id="root"></div>')

# ---------- El atleta no edita la programación ----------
patch("<script>\n/* ============== EXERCISE DICTIONARY",
      "<script>\nconst WO2_ATHLETE = true; // WorkOut 2.0: app del atleta\n/* ============== EXERCISE DICTIONARY")

# Pantalla del día: sin "Editar a mano", sin "Añadir entreno a mano", sin datos de depuración
patch('    heading.appendChild(manualEditBtn);', '    if (!WO2_ATHLETE) heading.appendChild(manualEditBtn);')
patch('      emptyWrap.appendChild(addManualBtn);', '      if (!WO2_ATHLETE) emptyWrap.appendChild(addManualBtn);')
patch('  wrap.appendChild(dbgToggle);', '  if (!WO2_ATHLETE) wrap.appendChild(dbgToggle);')
# Tarjeta de ejercicio: sin papelera
patch("  delBtn.onclick = (e)=>{ e.stopPropagation(); state.confirmDeleteExercise = entryKey; render(); };\n  top.appendChild(delBtn);",
      "  delBtn.onclick = (e)=>{ e.stopPropagation(); state.confirmDeleteExercise = entryKey; render(); };\n  if (!WO2_ATHLETE) top.appendChild(delBtn);")
# Tarjetas grandes: "Editar", "Borrar" y "+ Nuevo peso" SÍ se mantienen.
# El atleta apunta lo que realmente hizo; se guarda como su versión de la
# semana (progress/plan_*), sin tocar la programación del entrenador.
# Lista de semanas: sin "+ Nueva semana", renombrar ni borrar
patch("  newBtn.onclick = ()=>{ state.showHistory=false; state.confirmDeleteId=null; state.activePlanId=null; state.error=null; render(); };\n  sheet.appendChild(newBtn);",
      "  newBtn.onclick = ()=>{ state.showHistory=false; state.confirmDeleteId=null; state.activePlanId=null; state.error=null; render(); };\n  if (!WO2_ATHLETE) sheet.appendChild(newBtn);")
patch("      btns.appendChild(delBtn);\n      item.appendChild(btns);",
      "      btns.appendChild(delBtn);\n      if (!WO2_ATHLETE) item.appendChild(btns);")
# Perfil: sin "Cambiar deportista"
patch('  actions.appendChild(userBtn);', '  if (!WO2_ATHLETE) actions.appendChild(userBtn);')
# Menú: fuera "Nuevo plan", "Deportista", "Sincronizar" y "Copia de seguridad"; dentro "Salir"
patch("  sheet.appendChild(menuItem('📄', '+ Nuevo plan',", "  if (!WO2_ATHLETE) sheet.appendChild(menuItem('📄', '+ Nuevo plan',")
patch("  sheet.appendChild(menuItem('👤', 'Deportista: '", "  if (!WO2_ATHLETE) sheet.appendChild(menuItem('👤', 'Deportista: '")
patch("  sheet.appendChild(menuItem(syncStatus==='on'", "  if (!WO2_ATHLETE) sheet.appendChild(menuItem(syncStatus==='on'")
patch("  sheet.appendChild(menuItem('💾', 'Exportar copia de seguridad', async ()=>{",
      "  if (WO2.coachView) sheet.appendChild(menuItem('⬅️', 'Volver a la ficha del atleta', ()=>{ window.location.href = 'ficha-atleta.html?athlete=' + encodeURIComponent(WO2.viewedUid); }));\n"
      "  if (WO2_ATHLETE && !WO2.coachView && WO2.isCoach) sheet.appendChild(menuItem('📋', 'Panel de entrenador', ()=>{ window.location.href = 'entrenador.html'; }));\n"
      "  if (WO2_ATHLETE && !WO2.coachView) sheet.appendChild(menuItem('🚪', 'Salir', ()=>{ wo2SignOut(); }));\n"
      "  if (!WO2_ATHLETE) sheet.appendChild(menuItem('💾', 'Exportar copia de seguridad', async ()=>{")

# Informes del día y de la semana: bloque "Comentarios del entrenador"
patch("  const subject = 'Entreno ' + DAY_NAMES[r.day] + (r.data.week!==null?' · Semana '+r.data.week:'') + ' — ' + r.data.athlete;\n"
      "  sheet.appendChild(reportActionsRow(subject, dayReportPlainText(r.data, r.memo.text), ()=> generateDayReportPDF(r.data, r.memo.text)));",
      "  sheet.appendChild(wo2CoachCommentBlock(r.planId + '|' + r.day));\n"
      "  const subject = 'Entreno ' + DAY_NAMES[r.day] + (r.data.week!==null?' · Semana '+r.data.week:'') + ' — ' + r.data.athlete;\n"
      "  const wo2DayMemo = wo2MemoWithComments(r.memo.text, r.planId + '|' + r.day);\n"
      "  sheet.appendChild(reportActionsRow(subject, dayReportPlainText(r.data, wo2DayMemo), ()=> generateDayReportPDF(r.data, wo2DayMemo)));")
patch("  const subject = 'Informe semanal' + (plan.meta && plan.meta.week!=null ? ' · Semana '+plan.meta.week : '') + ' — ' + getActiveUser().name;\n"
      "  sheet.appendChild(reportActionsRow(\n"
      "    subject,\n"
      "    weekReportPlainText(plan, r.perDay, r.memo.text, r.status, r.watchPatterns, r.keywordPatterns, r.movementCharts),\n"
      "    ()=> generateWeekReportPDF(plan, r.perDay, r.memo.text, r.status, r.watchPatterns, r.keywordPatterns, r.movementCharts)\n"
      "  ));",
      "  sheet.appendChild(wo2CoachCommentBlock(plan.id + '|semana'));\n"
      "  const subject = 'Informe semanal' + (plan.meta && plan.meta.week!=null ? ' · Semana '+plan.meta.week : '') + ' — ' + getActiveUser().name;\n"
      "  const wo2WeekMemo = wo2MemoWithComments(r.memo.text, plan.id + '|semana');\n"
      "  sheet.appendChild(reportActionsRow(\n"
      "    subject,\n"
      "    weekReportPlainText(plan, r.perDay, wo2WeekMemo, r.status, r.watchPatterns, r.keywordPatterns, r.movementCharts),\n"
      "    ()=> generateWeekReportPDF(plan, r.perDay, wo2WeekMemo, r.status, r.watchPatterns, r.keywordPatterns, r.movementCharts)\n"
      "  ));")

# Comentarios del entrenador visibles en la app: semana, día y ejercicio
patch("  wrap.appendChild(top);\n\n  // plate row", "  wrap.appendChild(top);\n  if (WO2_ATHLETE) wo2CoachNoteBanner(wrap, plan.id + '|semana', 'Comentario de tu entrenador sobre la semana');\n\n  // plate row")
patch("  section.appendChild(heading);\n\n  if (state.manualEditDay === state.activeDay){",
      "  section.appendChild(heading);\n  if (WO2_ATHLETE) wo2CoachNoteBanner(section, plan.id + '|' + state.activeDay, 'Tu entrenador sobre este día');\n\n  if (state.manualEditDay === state.activeDay){")
patch("  card.appendChild(chips);", "  card.appendChild(chips);\n  if (WO2_ATHLETE) wo2CoachNoteBanner(card, plan.id + '|' + day + '|' + idx, 'Tu entrenador');")

# ---------- Arranque: cuenta del atleta + datos de WorkOut 2.0 ----------
ADAPTER = r'''
/* ===================== WorkOut 2.0: datos del atleta ===================== */
// La programación (plans) la escribe el entrenador y aquí solo se lee.
// Lo que hace el atleta (marcas, notas, series, fechas reales) va a
// progress/main, y su perfil (objetivos, RM, medidas) a progress/profile.
// Si el atleta cambia, borra o añade pesos, su versión de esa semana se
// guarda aparte en progress/plan_<id>; la del entrenador no se toca.
const WO2 = { uid:null, clubId:null, base:null, progressTimer:null, profileTimer:null, isCoach:false,
              coachView:false, viewedUid:null, coachComments:{},
              coachDays:{}, pushedOverride:{} };
function wo2OverrideDocId(planId){ return 'plan_' + String(planId).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,140); }
// Solo se guardan los ejercicios que el atleta ha cambiado ("L|0": ejercicio);
// el resto sigue saliendo de la programación del entrenador, así que si el
// entrenador corrige otro ejercicio, el atleta ve la corrección.
function wo2DiffChanges(coachDays, athleteDays){
  const changes = {};
  Object.keys(athleteDays || {}).forEach(day=>{
    (athleteDays[day] || []).forEach((entry, idx)=>{
      const coachEntry = (coachDays[day] || [])[idx];
      if (JSON.stringify(entry) !== JSON.stringify(coachEntry)) changes[day + '|' + idx] = entry;
    });
  });
  return changes;
}
function wo2ApplyChanges(days, changes){
  Object.keys(changes || {}).forEach(k=>{
    const sep = k.indexOf('|');
    const day = k.slice(0, sep), idx = parseInt(k.slice(sep+1), 10);
    if (days[day] && idx < days[day].length) days[day][idx] = changes[k];
  });
  return days;
}

function wo2SignOut(){
  try{ dismissRestTimer(); }catch(e){}
  auth.signOut().then(()=> window.location.replace('atleta.html'));
}

function wo2ScheduleProgressPush(){
  if (!WO2.base) return;
  clearTimeout(WO2.progressTimer);
  WO2.progressTimer = setTimeout(wo2PushProgressNow, 700);
}
async function wo2PushProgressNow(){
  if (WO2.coachView) return; // vista del entrenador: solo lectura
  const dayDates = {};
  state.plans.forEach(p=>{ if (p.dayDates) dayDates[p.id] = p.dayDates; });
  try{
    await WO2.base.collection('progress').doc('main').set({
      checks: state.checks || {},
      notes: state.notes || {},
      seriesProgress: state.seriesProgress || {},
      dayDates,
      updatedAt: Date.now()
    });
    for (const p of state.plans){
      if (WO2.coachDays[p.id] === undefined) continue;
      const changes = wo2DiffChanges(JSON.parse(WO2.coachDays[p.id]), p.days || {});
      const cur = Object.keys(changes).length ? JSON.stringify(changes) : null;
      const pushed = WO2.pushedOverride[p.id] || null;
      if (cur === pushed) continue;
      const ref = WO2.base.collection('progress').doc(wo2OverrideDocId(p.id));
      if (cur){ await ref.set({ planId: p.id, changes, updatedAt: Date.now() }); }
      else { await ref.delete(); }
      WO2.pushedOverride[p.id] = cur;
    }
  }catch(e){ wo2SaveError(e); }
}
function wo2ScheduleProfilePush(){
  if (!WO2.base || WO2.coachView) return;
  clearTimeout(WO2.profileTimer);
  WO2.profileTimer = setTimeout(async ()=>{
    const u = getActiveUser();
    if (!u) return;
    try{
      await WO2.base.collection('progress').doc('profile').set({
        objetivos: u.objetivos || null, rms: u.rms || {}, metrics: u.metrics || [], updatedAt: Date.now()
      });
    }catch(e){ wo2SaveError(e); }
  }, 700);
}
// --- Comentarios del entrenador en los informes ---
function wo2MemoWithComments(memo, key){
  const c = (WO2.coachComments[key] || '').trim();
  if (!c) return memo;
  return (memo ? memo + '\n\n' : '') + 'COMENTARIOS DEL ENTRENADOR:\n' + c;
}
function wo2CoachCommentBlock(key){
  const wrap = el('div');
  wrap.style.cssText = 'margin-top:18px;padding:16px;border-radius:12px;background:#fdf6e3;border:2px solid var(--yellow-deep);';
  const title = el('div', null, '💬 COMENTARIOS DEL ENTRENADOR');
  title.style.cssText = 'font-family:Oswald,sans-serif;font-weight:700;font-size:16px;color:var(--chalk);letter-spacing:.03em;margin-bottom:10px;';
  wrap.appendChild(title);
  const current = WO2.coachComments[key] || '';
  if (WO2.coachView){
    const ta = document.createElement('textarea');
    ta.value = current;
    ta.placeholder = 'Escribe aquí tus comentarios para el atleta…';
    ta.style.cssText = 'width:100%;min-height:120px;box-sizing:border-box;border:1.5px solid var(--surface-3);border-radius:10px;padding:12px;font-family:Inter,sans-serif;font-size:17px;line-height:1.5;color:var(--chalk);background:#fff;';
    wrap.appendChild(ta);
    const btn = el('button','mark-btn ok selected','Guardar comentario');
    btn.style.cssText += 'width:100%;margin-top:10px;font-size:17px;';
    const msg = el('div');
    msg.style.cssText = 'font-size:15px;margin-top:8px;text-align:center;';
    btn.onclick = async ()=>{
      const text = ta.value.trim();
      btn.disabled = true;
      try{
        await WO2.base.collection('coachNotes').doc('comments').set({ comments: { [key]: text }, updatedAt: Date.now() }, { merge: true });
        WO2.coachComments[key] = text;
        msg.textContent = 'Comentario guardado. El atleta lo verá en su informe.';
        msg.style.color = 'var(--ok)';
      }catch(e){
        msg.textContent = 'No se ha podido guardar (' + (e.message || e.code) + ').';
        msg.style.color = 'var(--red)';
      }
      btn.disabled = false;
    };
    wrap.appendChild(btn); wrap.appendChild(msg);
  } else {
    const txt = el('div', null, current || 'Tu entrenador todavía no ha escrito comentarios en este informe.');
    txt.style.cssText = 'font-size:17px;line-height:1.6;white-space:pre-wrap;color:' + (current ? 'var(--chalk)' : 'var(--muted)') + ';';
    wrap.appendChild(txt);
  }
  return wrap;
}
function wo2CoachNoteBanner(parent, key, label){
  const text = (WO2.coachComments[key] || '').trim();
  if (!text) return;
  const b = el('div');
  b.style.cssText = 'margin:10px 0 12px;padding:12px 14px;border-radius:12px;background:#fdf6e3;border-left:5px solid var(--yellow-deep);font-family:Inter,sans-serif;';
  b.onclick = (e)=> e.stopPropagation();
  const l = el('div', null, '💬 ' + label);
  l.style.cssText = 'font-size:13.5px;font-weight:700;color:#8a6512;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px;';
  const t = el('div'); t.textContent = text;
  t.style.cssText = 'font-size:17px;line-height:1.5;color:var(--chalk);white-space:pre-wrap;';
  b.appendChild(l); b.appendChild(t);
  parent.appendChild(b);
}
function wo2Toast(text){
  let t = document.getElementById('wo2Toast');
  if (!t){
    t = document.createElement('div');
    t.id = 'wo2Toast';
    t.style.cssText = 'position:fixed;left:12px;right:12px;bottom:14px;z-index:900;background:#20242e;color:#fff;padding:14px 16px;border-radius:12px;font-family:Inter,sans-serif;font-size:16px;font-weight:600;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = text;
  clearTimeout(t._h); t._h = setTimeout(()=>{ if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}
function wo2CoachBanner(name){
  const b = document.createElement('div');
  b.style.cssText = 'background:#fdf6e3;border-bottom:2px solid var(--yellow-deep);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-family:Inter,sans-serif;font-size:15.5px;color:var(--chalk);';
  b.innerHTML = '<span>👁 <b>Vista del entrenador</b> · entreno de <b></b> · solo lectura</span>';
  b.querySelectorAll('b')[1].textContent = name;
  const back = document.createElement('a');
  back.textContent = '← Volver a la ficha';
  back.href = 'ficha-atleta.html?athlete=' + encodeURIComponent(WO2.viewedUid);
  back.style.cssText = 'font-weight:700;color:var(--chalk);';
  b.appendChild(back);
  return b;
}

function wo2SaveError(e){
  console.error('WorkOut 2.0: no se pudo guardar', e);
  let bar = document.getElementById('wo2SaveError');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'wo2SaveError';
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:900;background:#c14a3a;color:#fff;padding:14px 16px;border-radius:12px;font-family:Inter,sans-serif;font-size:15px;font-weight:600;text-align:center;';
    document.body.appendChild(bar);
  }
  bar.textContent = 'No se ha podido guardar el último cambio. Revisa la conexión; si sigue pasando, avisa a tu entrenador.';
  setTimeout(()=>{ if (bar.parentNode) bar.parentNode.removeChild(bar); }, 7000);
}

// Sustituye el almacenamiento y la sincronización de la app original
saveUsersAsync = function(){ wo2ScheduleProfilePush(); return Promise.resolve(); };
saveActiveUserIdAsync = function(){ return Promise.resolve(); };
saveUserDataAsync = function(userId, data){ userDataCache[userId] = data; wo2ScheduleProgressPush(); return Promise.resolve(); };
loadUserDataAsync = async function(userId){ return userDataCache[userId] || { plans:[], checks:{}, notes:{}, seriesProgress:{} }; };
deleteUserDataAsync = function(){ return Promise.resolve(); };
prefetchAllUserData = function(){};
startSync = async function(){};
stopSync = function(){};
scheduleRosterPush = function(){};
scheduleUserPush = function(){};

// Sin semanas todavía: en vez de la pantalla de subir archivo, un aviso
renderUpload = function(){
  const wrap = el('div');
  wrap.style.cssText = 'min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:30px 22px;text-align:center;background:var(--bg);';
  const t = el('div', null, 'Todavía no tienes ninguna semana');
  t.style.cssText = "font-family:Oswald,sans-serif;font-weight:700;font-size:24px;text-transform:uppercase;color:var(--chalk);";
  const p = el('div', null, 'Cuando tu entrenador te suba la programación, aparecerá aquí.');
  p.style.cssText = 'font-family:Inter,sans-serif;font-size:17px;color:var(--muted);max-width:340px;line-height:1.4;';
  const prof = el('button','tb-btn','🎯 Mi perfil');
  prof.style.cssText += 'font-size:16px;padding:12px 22px;';
  prof.onclick = ()=>{ state.showProfile = true; render(); };
  const out = el('button','tb-btn','🚪 Salir');
  out.style.cssText += 'font-size:16px;padding:12px 22px;';
  out.onclick = ()=> wo2SignOut();
  wrap.appendChild(t); wrap.appendChild(p); wrap.appendChild(prof); wrap.appendChild(out);
  return wrap;
};

function wo2ShowBootError(msg){
  root.innerHTML = '';
  const wrap = el('div');
  wrap.style.cssText = 'min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:30px 22px;text-align:center;font-family:Inter,sans-serif;';
  const t = el('div', null, msg);
  t.style.cssText = 'font-size:17px;color:var(--chalk);max-width:360px;line-height:1.4;';
  const retry = el('button','tb-btn','Reintentar');
  retry.onclick = ()=> window.location.reload();
  const out = el('button','tb-btn','Salir');
  out.onclick = ()=> wo2SignOut();
  wrap.appendChild(t); wrap.appendChild(retry); wrap.appendChild(out);
  root.appendChild(wrap);
}

(function wo2Boot(){
  root.innerHTML = '';
  root.appendChild(renderBootLoading());
  const strip = document.getElementById('brandStripContainer');
  strip.appendChild(renderBrandStrip(null, null));

  let started = false;
  auth.onAuthStateChanged(async (user)=>{
    if (started) return;
    started = true;
    if (!user){ window.location.replace('atleta.html'); return; }
    try{
      const viewAthlete = new URLSearchParams(window.location.search).get('athlete');
      if (viewAthlete && viewAthlete !== user.uid){
        // Vista del entrenador: entreno e informes de uno de sus atletas
        const cg = await db.collection('users').doc(user.uid).collection('roleGrants').doc('coach').get();
        if (!cg.exists){ window.location.replace('entrenador.html'); return; }
        WO2.coachView = true;
        WO2.isCoach = true;
        WO2.viewedUid = viewAthlete;
        WO2.uid = viewAthlete;
        WO2.clubId = cg.data().clubId;
        WO2.base = db.collection('clubs').doc(WO2.clubId).collection('athletes').doc(viewAthlete);
        openFlashcards = function(){ wo2Toast('Vista del entrenador: aquí solo se consulta; el atleta es quien marca sus series.'); };
      } else {
        const grantSnap = await db.collection('users').doc(user.uid).collection('roleGrants').doc('athlete').get();
        if (!grantSnap.exists){ window.location.replace('atleta.html'); return; }
        WO2.uid = user.uid;
        WO2.clubId = grantSnap.data().clubId;
        WO2.base = db.collection('clubs').doc(WO2.clubId).collection('athletes').doc(user.uid);
      }

      db.collection('users').doc(user.uid).collection('roleGrants').doc('coach').get()
        .then(c=>{ WO2.isCoach = c.exists; }).catch(()=>{});
      const [clubSnap, athSnap, idSnap, notesSnap] = await Promise.all([
        db.collection('clubs').doc(WO2.clubId).get().catch(()=>null),
        WO2.base.get(),
        WO2.coachView ? Promise.resolve(null) : db.collection('users').doc(user.uid).get().catch(()=>null),
        WO2.base.collection('coachNotes').doc('comments').get().catch(()=>null)
      ]);
      const club = (clubSnap && clubSnap.exists) ? clubSnap.data() : {};
      if (WO2.coachView && !athSnap.exists){ wo2ShowBootError('Este atleta no pertenece a tu club.'); return; }
      const ath = athSnap.exists ? athSnap.data() : {};
      if (!WO2.coachView && (club.blocked || ath.blocked)){ window.location.replace('atleta.html'); return; }
      WO2.coachComments = (notesSnap && notesSnap.exists && notesSnap.data().comments) || {};
      strip.innerHTML = '';
      strip.appendChild(renderBrandStrip(club.logoUrl, club.name));
      if (WO2.coachView) strip.appendChild(wo2CoachBanner(ath.name || ath.email || 'atleta'));

      const [plansSnap, progSnap] = await Promise.all([
        WO2.base.collection('plans').get(),
        WO2.base.collection('progress').get()
      ]);
      const progDocs = {};
      progSnap.docs.forEach(d=>{ progDocs[d.id] = d.data(); });
      const main = progDocs['main'] || {};
      const prof = progDocs['profile'] || {};
      const dayDates = main.dayDates || {};
      const plans = plansSnap.docs.map(d=>{
        const p = d.data();
        if (!p.id) p.id = d.id;
        if (!p.meta) p.meta = { week:null, jornada:null };
        if (!p.days) p.days = {};
        if (!p.uploadedAt) p.uploadedAt = 0;
        p.needsReview = false; // la revisión de lo leído del Excel la hace el entrenador
        if (dayDates[p.id]) p.dayDates = dayDates[p.id];
        WO2.coachDays[p.id] = JSON.stringify(p.days);
        const ov = progDocs[wo2OverrideDocId(p.id)];
        if (ov){
          // (formato antiguo de prueba: semana entera → se convierte a cambios)
          const changes = ov.changes || (ov.days ? wo2DiffChanges(p.days, ov.days) : {});
          wo2ApplyChanges(p.days, changes);
          WO2.pushedOverride[p.id] = ov.changes ? JSON.stringify(ov.changes) : '__old_format__';
        }
        return p;
      });

      const identity = (idSnap && idSnap.exists) ? idSnap.data() : {};
      const name = ath.name || identity.name || ath.email || user.email;
      const u = makeUser(name);
      u.id = user.uid;
      if (prof.objetivos) u.objetivos = prof.objetivos;
      if (prof.rms) u.rms = prof.rms;
      if (prof.metrics) u.metrics = prof.metrics;
      users = [u];
      activeUserId = u.id;

      state.plans = plans;
      state.checks = main.checks || {};
      state.notes = main.notes || {};
      state.seriesProgress = main.seriesProgress || {};
      userDataCache[u.id] = { plans: state.plans, checks: state.checks, notes: state.notes, seriesProgress: state.seriesProgress };
      const sorted = [...state.plans].sort((a,b)=>a.uploadedAt-b.uploadedAt);
      state.activePlanId = sorted.length ? sorted[sorted.length-1].id : null;
      state.reviewDismissed = true;

      try{ preferredVoiceURI = await storageGet(PREFERRED_VOICE_KEY); }catch(e){ preferredVoiceURI = null; }
      try{ restTimerMuted = (await storageGet(REST_TIMER_MUTED_KEY)) === '1'; }catch(e){ restTimerMuted = false; }

      render();
    }catch(e){
      console.error(e);
      wo2ShowBootError('No se han podido cargar tus datos (' + (e.message || e.code || e) + ').');
    }
  });
})();
'''
patch('\ninitApp();\n</script>', '\n' + ADAPTER + '\n</script>')

open(out_path, 'w', encoding='utf-8').write(html)
print('entreno.html generado:', len(html), 'bytes')
