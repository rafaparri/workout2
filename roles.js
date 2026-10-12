// roles.js — Cambiar de perfil sin volver a entrar.
// Si la persona tiene más de un perfil (administración, entrenador, atleta),
// aparece un botón «⇄ Perfil» con los perfiles que tiene; el actual va marcado.
(function(){
  if (typeof auth === 'undefined' || typeof db === 'undefined') return;
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const params = new URLSearchParams(location.search);
  const current =
    page === 'superadmin.html' ? 'admin' :
    (page === 'entreno.html' && !params.get('athlete')) || page === 'atleta.html' ? 'athlete' :
    'coach';
  const ROLES = {
    admin:   { icon:'🛡️', label:'Administración', href:'superadmin.html' },
    coach:   { icon:'📋', label:'Entrenador',     href:'entrenador.html' },
    athlete: { icon:'🏋️', label:'Atleta',         href:'entreno.html' }
  };
  let mine = [];

  function css(){
    if (document.getElementById('wo2RolesCss')) return;
    const s = document.createElement('style'); s.id = 'wo2RolesCss';
    s.textContent = `
    .wo2-role-btn{ display:inline-flex; align-items:center; gap:6px; min-height:40px; padding:0 12px; border-radius:999px; border:1.5px solid var(--t-edge,#3a352b); background:var(--t-surface,#17161a); color:var(--t-text,#f4f1ea); font:800 15px Archivo,system-ui,sans-serif; cursor:pointer; white-space:nowrap; width:auto; margin:0; }
    @media (max-width:520px){ .wo2-role-btn .t{ display:none; } .wo2-role-btn{ padding:0 10px; min-height:44px; } }
    .wo2-role-row{ display:flex; justify-content:flex-end; margin:0 0 12px; }
    .wo2-role-bg{ position:fixed; inset:0; z-index:9500; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; padding:80px 14px 14px; }
    .wo2-role-menu{ width:100%; max-width:380px; background:var(--t-surface,#17161a); color:var(--t-text,#f4f1ea); border:1px solid var(--t-line,#2e2a22); border-radius:20px; padding:16px; display:flex; flex-direction:column; gap:8px; font-family:Archivo,system-ui,sans-serif; box-shadow:0 18px 40px rgba(0,0,0,.45); }
    .wo2-role-menu h2{ margin:0 0 4px; font:400 20px ArchivoBlack,Archivo,sans-serif; }
    .wo2-role-menu p{ margin:0 0 6px; font-size:15px; color:var(--t-muted2,#8f887a); }
    .wo2-role-opt{ display:flex; align-items:center; gap:14px; min-height:60px; padding:0 16px; border-radius:14px; border:2px solid var(--t-edge,#3a352b); background:transparent; color:var(--t-text,#f4f1ea); font:800 18px Archivo,sans-serif; text-decoration:none; cursor:pointer; }
    .wo2-role-opt .i{ font-size:24px; }
    .wo2-role-opt.on{ border-color:var(--t-accent,#c99a2e); background:var(--t-accent-soft,#2a2316); }
    .wo2-role-opt .here{ margin-left:auto; font-size:14px; font-weight:700; color:var(--t-accent2,#e0b453); }
    .wo2-role-close{ min-height:48px; border-radius:14px; border:none; background:var(--t-surface2,#1d1b20); color:var(--t-text,#f4f1ea); font:700 16px Archivo,sans-serif; cursor:pointer; margin-top:4px; }
    `;
    document.head.appendChild(s);
  }

  function openMenu(){
    const bg = document.createElement('div'); bg.className = 'wo2-role-bg';
    const m = document.createElement('div'); m.className = 'wo2-role-menu'; m.setAttribute('role','dialog'); m.setAttribute('aria-label','Cambiar de perfil');
    m.innerHTML = '<h2>Cambiar de perfil</h2><p>Entras con la misma cuenta, sin volver a escribir la contraseña.</p>';
    mine.forEach(r=>{
      const a = document.createElement('a'); a.className = 'wo2-role-opt' + (r === current ? ' on' : ''); a.href = ROLES[r].href;
      a.innerHTML = '<span class="i" aria-hidden="true">' + ROLES[r].icon + '</span><span>' + ROLES[r].label + '</span>' + (r === current ? '<span class="here">estás aquí</span>' : '');
      if (r === current) a.onclick = (e)=>{ e.preventDefault(); bg.remove(); };
      m.appendChild(a);
    });
    const c = document.createElement('button'); c.className = 'wo2-role-close'; c.textContent = 'Cerrar'; c.onclick = ()=> bg.remove();
    m.appendChild(c);
    bg.appendChild(m);
    bg.addEventListener('click', e=>{ if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
  }

  function button(){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wo2-role-btn';
    b.innerHTML = '<span aria-hidden="true">⇄</span><span aria-hidden="true">' + ROLES[current].icon + '</span><span class="t">' + ROLES[current].label + '</span>';
    b.setAttribute('aria-label', 'Cambiar de perfil (ahora: ' + ROLES[current].label + ')');
    b.onclick = (e)=>{ e.stopPropagation(); openMenu(); };
    return b;
  }

  // Lo coloca en la franja superior; si la página no la tiene, en su cabecera
  // o al principio del contenido. Se vuelve a poner si la franja se redibuja.
  function place(){
    if (mine.length < 2) return;
    css();
    const strip = document.querySelector('#brandStripContainer .brandStrip');
    if (strip){
      if (strip.querySelector('.wo2-role-btn')) return;
      const b = button();
      const pw = strip.querySelector('.poweredBy');
      strip.insertBefore(b, pw || null);
      if (pw) pw.style.marginLeft = '8px';
      b.style.marginLeft = 'auto';
      return;
    }
    if (document.querySelector('.wo2-role-btn')) return;
    const so = document.querySelector('header .hin #signoutBtn');
    if (so){ so.parentNode.insertBefore(button(), so); so.parentNode.style.gap = '10px'; return; }
    const wrap = document.querySelector('.wrap') || document.body;
    const row = document.createElement('div'); row.className = 'wo2-role-row'; row.appendChild(button());
    wrap.insertBefore(row, wrap.firstChild);
  }

  async function grants(user){
    const g = db.collection('users').doc(user.uid).collection('roleGrants');
    const get = (id)=> g.doc(id).get().then(s=> s.exists ? s.data() : null).catch(()=> null);
    const [sa, ad, co, at] = await Promise.all([get('superadmin'), get('admin'), get('coach'), get('athlete')]);
    let adminOk = !!sa;
    if (!adminOk && ad){
      try{ const a = await db.collection('admins').doc(user.uid).get(); adminOk = a.exists && a.data().blocked !== true; }catch(e){}
    }
    const out = [];
    if (adminOk) out.push('admin');
    if (co) out.push('coach');
    if (at) out.push('athlete');
    return out;
  }

  auth.onAuthStateChanged(async (user)=>{
    if (!user) return;
    try{ mine = await grants(user); }catch(e){ mine = []; }
    if (!mine.includes(current)) mine.push(current);
    const order = ['admin','coach','athlete'];
    mine = order.filter(r=> mine.includes(r));
    place();
    const c = document.getElementById('brandStripContainer');
    if (c && window.MutationObserver) new MutationObserver(place).observe(c, { childList:true, subtree:true });
  });
})();
