/* ---- Versión y recarga forzada ---- */
function wo2VersionTexto(){
  const v = String(window.WO2_VERSION || '');
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  return m ? (m[3]+'/'+m[2]+'/'+m[1]+' '+m[4]+':'+m[5]) : 'desconocida';
}
function wo2RecargarApp(){
  // Pide la página otra vez saltándose la caché del navegador; los datos
  // (planes, pesos, progreso) se vuelven a leer de la base de datos.
  try{ const u = new URL(location.href); u.searchParams.set('r', Date.now()); location.replace(u.toString()); }
  catch(e){ location.reload(); }
}

