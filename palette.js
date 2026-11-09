// WorkOut 2.0 — elegir la combinación de colores (se guarda en este móvil).
(function(){
  var KEY = 'wo2_palette';
  var LIST = [
    { id:'cian',    name:'Azul noche y cian', note:'La de siempre', bg:'#0d1117', sf:'#161d27', ac:'#34d1c4', tx:'#e8eef4' },
    { id:'oro',     name:'Negro y oro',       note:'Como el logo',  bg:'#0c0c0e', sf:'#17161a', ac:'#c99a2e', tx:'#f4f1ea' },
    { id:'lima',    name:'Marino y lima',     note:'Deportivo',     bg:'#0b1220', sf:'#152036', ac:'#c4f135', tx:'#eef2f8' },
    { id:'naranja', name:'Grafito y naranja', note:'Potente',       bg:'#121212', sf:'#1e1e1e', ac:'#ff7a1a', tx:'#f2f2f2' },
    { id:'oliva',   name:'Verde oliva',       note:'Sobrio',        bg:'#0f120c', sf:'#1a1f15', ac:'#a3c45a', tx:'#eef1e8' },
    { id:'violeta', name:'Violeta',           note:'Moderno',       bg:'#100d18', sf:'#1c1729', ac:'#a98bff', tx:'#f0edf8' },
    { id:'pista',   name:'Pista clara',       note:'Claro · naranja', bg:'#f3f3f0', sf:'#ffffff', ac:'#c8430c', tx:'#141b2d' },
    { id:'rojo',    name:'Blanco y rojo',     note:'Claro · clásico', bg:'#f6f5f2', sf:'#ffffff', ac:'#c62828', tx:'#1a1a1a' }
  ];
  function get(){ try{ return localStorage.getItem(KEY) || 'cian'; }catch(e){ return 'cian'; } }
  function apply(id){
    var p = LIST.filter(function(x){ return x.id === id; })[0] || LIST[0];
    document.documentElement.setAttribute('data-palette', p.id);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m){ m = document.createElement('meta'); m.name = 'theme-color'; (document.head || document.documentElement).appendChild(m); }
    m.content = p.bg;
  }
  apply(get());
  document.addEventListener('DOMContentLoaded', function(){ apply(get()); });
  window.WO2_PALETTES = LIST;
  window.wo2SetPalette = function(id){ try{ localStorage.setItem(KEY, id); }catch(e){} apply(id); };
  // Ventana para elegir: al tocar una, se ve al momento
  window.wo2PalettePicker = function(){
    var old = document.getElementById('wo2PalPick'); if (old) old.remove();
    var start = get();
    var ov = document.createElement('div'); ov.id = 'wo2PalPick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    var sh = document.createElement('div');
    sh.style.cssText = 'width:100%;max-width:560px;max-height:88vh;overflow:auto;background:var(--t-bg2);color:var(--t-text);border-radius:22px 22px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));font-family:Archivo,system-ui,sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.4);';
    var h = document.createElement('div'); h.textContent = '🎨 Colores de la app';
    h.style.cssText = 'font-size:22px;font-weight:900;margin-bottom:4px;';
    var sub = document.createElement('div'); sub.textContent = 'Toca una para probarla. Se guarda en este móvil.';
    sub.style.cssText = 'font-size:16px;color:var(--t-muted);margin-bottom:14px;';
    sh.appendChild(h); sh.appendChild(sub);
    var grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
    function draw(){
      grid.innerHTML = '';
      var cur = get();
      LIST.forEach(function(p){
        var b = document.createElement('button'); b.type = 'button';
        b.style.cssText = 'text-align:left;cursor:pointer;border-radius:16px;padding:10px;background:' + p.bg + ';border:3px solid ' + (p.id === cur ? p.ac : 'transparent') + ';box-shadow:0 0 0 1px rgba(127,127,127,.35);font-family:inherit;';
        b.innerHTML =
          '<div style="background:' + p.sf + ';border-radius:10px;padding:10px;margin-bottom:8px;">' +
            '<div style="height:10px;width:70%;border-radius:5px;background:' + p.tx + ';opacity:.85;margin-bottom:8px;"></div>' +
            '<div style="height:26px;border-radius:13px;background:' + p.ac + ';"></div>' +
          '</div>' +
          '<div style="color:' + p.tx + ';font-weight:800;font-size:16px;line-height:1.2;">' + (p.id === cur ? '✓ ' : '') + p.name + '</div>' +
          '<div style="color:' + p.tx + ';opacity:.7;font-size:14px;">' + p.note + '</div>';
        b.onclick = function(){ window.wo2SetPalette(p.id); draw(); };
        grid.appendChild(b);
      });
    }
    draw(); sh.appendChild(grid);
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Deshacer';
    cancel.style.cssText = 'flex:1;min-height:54px;border-radius:14px;border:1.5px solid var(--t-edge);background:transparent;color:var(--t-text);font-weight:800;font-size:17px;font-family:inherit;';
    cancel.onclick = function(){ window.wo2SetPalette(start); ov.remove(); };
    var ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Listo';
    ok.style.cssText = 'flex:1;min-height:54px;border-radius:14px;border:0;background:var(--t-accent);color:var(--t-ink);font-weight:900;font-size:17px;font-family:inherit;';
    ok.onclick = function(){ ov.remove(); };
    row.appendChild(cancel); row.appendChild(ok); sh.appendChild(row);
    ov.appendChild(sh);
    ov.onclick = function(e){ if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  };
})();
