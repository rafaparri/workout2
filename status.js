// status.js — estado de cada atleta para el panel del entrenador y su ficha.
//
// Programación:
//   "Subida"    → hay una semana subida que el atleta todavía no ha terminado.
//   "Pendiente" → no hay ninguna semana, o el atleta ya ha entrenado todos los
//                 días de la última: toca subirle la siguiente.
// Resultados (de la última semana):
//   "Pendientes" → el atleta todavía no ha marcado nada.
//   "Subidos"    → ha marcado entrenos y el entrenador aún no los ha revisado
//                  (o ha marcado más después de la última revisión).
//   "Revisados"  → el entrenador los ha revisado y no hay nada nuevo después.
const WO2_DAY_ORDER = ['L','M','X','J','V','S','D'];

async function computeAthleteStatus(athleteRef, a){
  const [plansSnap, mainSnap] = await Promise.all([
    athleteRef.collection('plans').get(),
    athleteRef.collection('progress').doc('main').get()
  ]);
  const plans = plansSnap.docs.map(d=>{ const p = d.data(); if (!p.id) p.id = d.id; return p; })
    .sort((x,y)=>(x.uploadedAt||0)-(y.uploadedAt||0));
  const latest = plans.length ? plans[plans.length-1] : null;
  const main = mainSnap.exists ? mainSnap.data() : {};
  const weekLabel = latest ? ((latest.meta && latest.meta.week!=null) ? ('Semana ' + latest.meta.week) : 'Última semana') : '';

  let program;
  if (!latest){
    program = { key:'pending', text:'Pendiente', detail:'Sin semanas subidas' };
  } else {
    const days = latest.days || {};
    const trainingDays = WO2_DAY_ORDER.filter(d=>(days[d]||[]).some(e=>e.type==='exercise'));
    const dates = (main.dayDates && main.dayDates[latest.id]) || {};
    const done = trainingDays.length > 0 && trainingDays.every(d=>!!dates[d]);
    program = done
      ? { key:'pending', text:'Pendiente', detail: weekLabel + ' terminada' }
      : { key:'ok', text:'Subida', detail: weekLabel };
  }

  let results;
  const checks = main.checks || {};
  const hasMarks = latest && Object.keys(checks).some(k=>k.indexOf(latest.id + '|') === 0);
  if (!hasMarks){
    results = { key:'pending', text:'Pendientes', detail: latest ? 'Sin entrenos marcados' : '' };
  } else if (a.reviewedAt && a.reviewedAt >= (main.updatedAt || 0)){
    results = { key:'ok', text:'Revisados', detail: 'Revisado el ' + new Date(a.reviewedAt).toLocaleDateString('es-ES') };
  } else {
    results = { key:'new', text:'Subidos', detail:'Sin revisar' };
  }
  return { program, results, latest, lastActivity: main.updatedAt || null };
}

// Píldora de estado con color
function statusPill(label, st){
  const colors = {
    ok:      { bg:'#e2eefa', fg:'#22609c', dot:'#2f7dc4' },
    new:     { bg:'#fdf1d8', fg:'#8a6512', dot:'#c99a2e' },
    pending: { bg:'#eceae2', fg:'#5a5e68', dot:'#8892a0' },
    bad:     { bg:'#f8e1dd', fg:'#9c3427', dot:'#c14a3a' }
  };
  const c = colors[st.key] || colors.pending;
  return '<span class="pill" style="background:' + c.bg + ';color:' + c.fg + ';">' +
         '<span class="pdot" style="background:' + c.dot + ';"></span>' +
         '<span class="plabel">' + label + ':</span> <b>' + st.text + '</b></span>';
}
