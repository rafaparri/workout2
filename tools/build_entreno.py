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
# Tarjetas grandes: sin "Editar", "Borrar" ni "+ Nuevo peso"
patch('    secondaryRow.appendChild(editSetBtn);', '    if (!WO2_ATHLETE) secondaryRow.appendChild(editSetBtn);')
patch('      secondaryRow.appendChild(delSetBtn);', '      if (!WO2_ATHLETE) secondaryRow.appendChild(delSetBtn);')
patch('      btnRow.appendChild(addBtn); btnRow.appendChild(doneBtn);',
      '      if (!WO2_ATHLETE) btnRow.appendChild(addBtn); btnRow.appendChild(doneBtn);')
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
      "  if (WO2_ATHLETE) sheet.appendChild(menuItem('🚪', 'Salir', ()=>{ wo2SignOut(); }));\n"
      "  if (!WO2_ATHLETE) sheet.appendChild(menuItem('💾', 'Exportar copia de seguridad', async ()=>{")

# ---------- Arranque: cuenta del atleta + datos de WorkOut 2.0 ----------
ADAPTER = r'''
/* ===================== WorkOut 2.0: datos del atleta ===================== */
// La programación (plans) la escribe el entrenador y aquí solo se lee.
// Lo que hace el atleta (marcas, notas, series, fechas reales) va a
// progress/main, y su perfil (objetivos, RM, medidas) a progress/profile.
const WO2 = { uid:null, clubId:null, base:null, progressTimer:null, profileTimer:null };

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
  }catch(e){ wo2SaveError(e); }
}
function wo2ScheduleProfilePush(){
  if (!WO2.base) return;
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
      const grantSnap = await db.collection('users').doc(user.uid).collection('roleGrants').doc('athlete').get();
      if (!grantSnap.exists){ window.location.replace('atleta.html'); return; }
      WO2.uid = user.uid;
      WO2.clubId = grantSnap.data().clubId;
      WO2.base = db.collection('clubs').doc(WO2.clubId).collection('athletes').doc(user.uid);

      const [clubSnap, athSnap, idSnap] = await Promise.all([
        db.collection('clubs').doc(WO2.clubId).get().catch(()=>null),
        WO2.base.get(),
        db.collection('users').doc(user.uid).get().catch(()=>null)
      ]);
      const club = (clubSnap && clubSnap.exists) ? clubSnap.data() : {};
      const ath = athSnap.exists ? athSnap.data() : {};
      if (club.blocked || ath.blocked){ window.location.replace('atleta.html'); return; }
      strip.innerHTML = '';
      strip.appendChild(renderBrandStrip(club.logoUrl, club.name));

      const [plansSnap, mainSnap, profSnap] = await Promise.all([
        WO2.base.collection('plans').get(),
        WO2.base.collection('progress').doc('main').get(),
        WO2.base.collection('progress').doc('profile').get()
      ]);
      const main = mainSnap.exists ? mainSnap.data() : {};
      const prof = profSnap.exists ? profSnap.data() : {};
      const dayDates = main.dayDates || {};
      const plans = plansSnap.docs.map(d=>{
        const p = d.data();
        if (!p.id) p.id = d.id;
        if (!p.meta) p.meta = { week:null, jornada:null };
        if (!p.days) p.days = {};
        if (!p.uploadedAt) p.uploadedAt = 0;
        p.needsReview = false; // la revisión de lo leído del Excel la hace el entrenador
        if (dayDates[p.id]) p.dayDates = dayDates[p.id];
        return p;
      });

      const identity = (idSnap && idSnap.exists) ? idSnap.data() : {};
      const name = ath.name || identity.name || user.email;
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
