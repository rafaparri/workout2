/* ---- Pesos anotados desde la app Nutrición ----
   Si tu nutricionista te pesa en Nutrición, el peso queda en users/{uid}/bodyLog
   (by:'nutricion'). Al abrir WorkOut, esos pesos pasan a tu historial de
   Peso y tensión y se borran de ese buzón, así no se repiten. */
async function wo2MergeNutriWeights(u){
  if (WO2.coachView || !WO2.uid || !u) return;
  try{ wo2ScheduleProfilePush(); }catch(e){} // publica también los días movidos
  try{
    const snap = await db.collection('users').doc(WO2.uid).collection('bodyLog').where('by','==','nutricion').get();
    if (snap.empty) return;
    if (!u.metrics) u.metrics = [];
    snap.docs.forEach(d=>{
      const x = d.data(), ts = new Date(d.id).getTime();
      if (typeof x.kg === 'number' && isFinite(ts) && !u.metrics.some(m=> m.date === ts && m.peso === x.kg)){
        u.metrics.push({ date: ts, peso: x.kg, sistolica: null, diastolica: null, origen: 'nutricion' });
      }
    });
    u.metrics.sort((a,b)=> a.date - b.date);
    await Promise.all(snap.docs.map(d=> d.ref.delete()));
    saveUsersAsync(users); wo2ScheduleProfilePush(); render();
  }catch(e){ /* sin permiso o sin conexión: se reintenta la próxima vez */ }
}

