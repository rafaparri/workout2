// WorkOut 2.0 — actualización automática.
// Cada página lleva su número de versión (window.WO2_VERSION). Al abrirla, y cada
// vez que se vuelve a la app, se pregunta al servidor cuál es la última versión
// (version.json, sin caché). Si hay una más nueva:
// aparece un aviso con el botón "Actualizar" (no recarga sola, para no cortar
// la conexión de la app ni perder lo que estés escribiendo).
(function(){
  var V = window.WO2_VERSION || '';
  var shown = false;
  function enLogin(){
    // Durante la entrada con enlace de correo no se recarga sola (se gastaría el enlace).
    var q = location.search;
    return q.indexOf('oobCode') >= 0 || q.indexOf('apiKey') >= 0 || q.indexOf('mode=signIn') >= 0;
  }
  function irA(v){
    try{ var u = new URL(location.href); u.searchParams.set('v', v); location.replace(u.toString()); }
    catch(e){ location.reload(); }
  }
  function aviso(v){
    if (shown || !document.body) return; shown = true;
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99999;' +
      'background:var(--t-surface);color:var(--t-text);border:1px solid var(--t-line);border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 17px/1.3 Archivo,system-ui,sans-serif;max-width:560px;margin:0 auto;';
    b.innerHTML = '<span style="flex:1;">✨ Hay una versión nueva de WorkOut 2.0</span>' +
      '<button style="background:var(--t-accent);color:var(--t-ink);border:none;border-radius:12px;padding:12px 16px;font:800 17px Archivo,sans-serif;cursor:pointer;">Actualizar</button>';
    b.querySelector('button').onclick = function(){ irA(v); };
    document.body.appendChild(b);
  }
  function comprobar(alAbrir){
    if (!window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.v || d.v === V) return;
        // Ya no se recarga sola al abrir: recargar justo mientras la app se
        // conecta (sesión y datos) la dejaba atascada en algunos móviles.
        // Se muestra el aviso y se actualiza al pulsar «Actualizar».
        if (document.body) aviso(d.v); else document.addEventListener('DOMContentLoaded', function(){ aviso(d.v); });
      })
      .catch(function(){});
  }
  // Se comprueba un poco después de abrir, cuando la app ya ha cargado.
  window.addEventListener('load', function(){ setTimeout(function(){ comprobar(true); }, 3000); });
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') comprobar(false); });
  window.addEventListener('pageshow', function(e){ if (e.persisted) comprobar(false); });
})();
