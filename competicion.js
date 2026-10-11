// competicion.js — Calendario de competiciones de WorkOut 2.0.
// Lo usan el panel del entrenador (competiciones.html) y la app del atleta
// (entreno.html). Cada atleta apuntado tiene su "ficha de competición" en
//   clubs/{club}/athletes/{uid}/competitions/{compId}
// con una copia de los datos de la competición, su día, categoría,
// objetivos, intentos planificados y resultados.
//   results.sn / results.cj = 3 intentos { kg, st }  (st: 'ok' válido, 'no' nulo, null sin hacer)
(function(){
  const W = {};

  W.iso = function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  W.today = function(){ return W.iso(new Date()); };
  W.date = function(iso){ return iso ? new Date(iso + 'T12:00:00') : null; };
  W.fmt = function(iso, opts){
    if (!iso) return '';
    return W.date(iso).toLocaleDateString('es-ES', opts || { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  };
  W.range = function(a, b){
    if (!a) return '';
    if (!b || b === a) return W.fmt(a, { day:'numeric', month:'short', year:'numeric' });
    return W.fmt(a, { day:'numeric', month:'short' }) + ' – ' + W.fmt(b, { day:'numeric', month:'short', year:'numeric' });
  };
  W.num = function(v){ if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };

  W.emptyResults = function(){ return { sn:[{kg:null,st:null},{kg:null,st:null},{kg:null,st:null}], cj:[{kg:null,st:null},{kg:null,st:null},{kg:null,st:null}], bw:null, place:null }; };
  W.best = function(arr){ let b = null; (arr || []).forEach(a=>{ if (a && a.st === 'ok' && a.kg && (b === null || a.kg > b)) b = a.kg; }); return b; };
  W.allNull = function(arr){ return (arr || []).length === 3 && arr.every(a=> a && a.st === 'no'); };
  W.total = function(r){
    if (!r) return null;
    const s = W.best(r.sn), c = W.best(r.cj);
    return (s !== null && c !== null) ? s + c : null;
  };
  W.hasResults = function(r){ return !!r && [].concat(r.sn || [], r.cj || []).some(a=> a && a.st); };
  // Estado: 'next' (todavía no ha llegado), 'today', 'past'
  W.when = function(e){ const t = W.today(); const d = e.day || e.startDate; return d > t ? 'next' : (d === t ? 'today' : 'past'); };

  // ---------- Estilos (se inyectan una vez) ----------
  function css(){
    if (document.getElementById('wo2CompCss')) return;
    const s = document.createElement('style'); s.id = 'wo2CompCss';
    s.textContent = `
    .wc{ display:flex; flex-direction:column; gap:16px; font-family:Archivo,system-ui,sans-serif; color:var(--chalk,#f4f1ea); }
    .wc-box{ background:var(--surface-2,#1d1b20); border:1px solid #2e2a22; border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:12px; }
    .wc-h{ font-size:14px; font-weight:800; letter-spacing:.12em; color:var(--muted-2,#8f887a); text-transform:uppercase; }
    .wc-lift{ font-family:ArchivoBlack,sans-serif; font-size:20px; display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
    .wc-lift small{ font-family:Archivo,sans-serif; font-size:15px; font-weight:700; color:var(--muted-2,#8f887a); }
    .wc-grid3{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
    .wc-field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
    .wc-field span{ font-size:13.5px; font-weight:700; color:var(--muted-2,#8f887a); }
    .wc input{ width:100%; min-height:50px; box-sizing:border-box; border-radius:12px; border:1.5px solid #3a352b; background:#121114; color:var(--chalk,#f4f1ea); font:800 20px Archivo,sans-serif; padding:0 10px; text-align:center; margin:0; }
    .wc input[disabled]{ opacity:.9; border-style:dashed; }
    .wc-att{ display:grid; grid-template-columns:56px minmax(0,1fr) auto; gap:8px; align-items:center; }
    .wc-att .n{ font-size:14px; font-weight:800; color:var(--muted-2,#8f887a); }
    .wc-tg{ display:flex; gap:6px; }
    .wc-tg button{ min-height:50px; min-width:0; padding:0 12px; border-radius:12px; font:800 16px Archivo,sans-serif; cursor:pointer; background:transparent !important; color:var(--chalk,#f4f1ea) !important; border:2px solid #3a352b !important; width:auto; margin:0; }
    .wc-tg button.ok.on{ background:#3f9a62 !important; border-color:#3f9a62 !important; color:#fff !important; }
    .wc-tg button.no.on{ background:#b5503f !important; border-color:#b5503f !important; color:#fff !important; }
    .wc-att.st-ok input{ border-color:#3f9a62; } .wc-att.st-no input{ border-color:#b5503f; text-decoration:line-through; color:#f08a7c; }
    .wc-tot{ display:flex; align-items:center; justify-content:space-between; gap:12px; background:#2a2316; border:1px solid #5a4719; border-radius:16px; padding:16px; }
    .wc-tot b{ white-space:nowrap; font-family:ArchivoBlack,sans-serif; font-weight:400; font-size:40px; color:#e0b453; line-height:1; }
    .wc-tot span{ font-size:16px; color:#e0b453; font-weight:700; }
    .wc-goal{ font-size:15px; color:var(--muted,#bdb6a6); }
    .wc-save{ min-height:56px; border:none; border-radius:14px; background:#c99a2e !important; color:#0c0c0e !important; font:800 18px Archivo,sans-serif; cursor:pointer; width:100%; margin:0; }
    .wc-msg{ font-size:15px; min-height:1em; }
    .wc-msg.ok{ color:#7fd19a; } .wc-msg.err{ color:#f08a7c; }
    .wc-by{ font-size:14px; color:var(--muted-2,#8f887a); }
    .wc-badge{ display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:5px 12px; font-size:14px; font-weight:800; background:#2a2316; color:#e0b453; }
    @media (max-width:420px){ .wc-att{ grid-template-columns:44px minmax(0,1fr) auto; } .wc-tg button{ padding:0 9px; font-size:15px; } }
    `;
    document.head.appendChild(s);
  }
  W.css = css;

  function h(tag, attrs, html){
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k=>{ if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  W.esc = esc;

  // Editor de una ficha de competición.
  // opts.coach: true → puede cambiar objetivos e intentos planificados.
  // opts.onSave(entry, changes) → guarda; devuelve una promesa.
  // opts.rmOf(code) → RM actual (número o null). opts.onNewRm(code, kg, dayIso) → guarda el nuevo RM.
  W.renderEditor = function(container, entry, opts){
    css();
    opts = opts || {};
    const e = JSON.parse(JSON.stringify(entry || {}));
    e.goals = e.goals || {}; e.plan = e.plan || { sn:[null,null,null], cj:[null,null,null] };
    e.results = e.results || W.emptyResults();
    ['sn','cj'].forEach(k=>{
      if (!Array.isArray(e.plan[k])) e.plan[k] = [null,null,null];
      if (!Array.isArray(e.results[k])) e.results[k] = W.emptyResults()[k];
    });
    const root = h('div', { class:'wc' });
    container.innerHTML = ''; container.appendChild(root);

    // --- Objetivos ---
    const g = h('div', { class:'wc-box' });
    g.appendChild(h('div', { class:'wc-h' }, 'Objetivos'));
    const gGrid = h('div', { class:'wc-grid3' });
    const goalIn = {};
    [['sn','Arrancada'],['cj','Dos tiempos'],['total','Total']].forEach(([k, lbl])=>{
      const f = h('label', { class:'wc-field' });
      f.appendChild(h('span', null, lbl + ' (kg)'));
      const i = h('input', { type:'text', inputmode:'decimal', placeholder:'—' });
      i.value = e.goals[k] != null ? e.goals[k] : '';
      if (!opts.coach) i.disabled = true;
      i.oninput = ()=>{
        e.goals[k] = W.num(i.value);
        if (k !== 'total' && opts.coach && !goalIn.total.dataset.touched){
          const s = e.goals.sn, c = e.goals.cj;
          e.goals.total = (s && c) ? s + c : e.goals.total;
          goalIn.total.value = e.goals.total != null ? e.goals.total : '';
        }
        if (k === 'total') i.dataset.touched = '1';
      };
      goalIn[k] = i; f.appendChild(i); gGrid.appendChild(f);
    });
    g.appendChild(gGrid);
    root.appendChild(g);

    // --- Movimientos: intentos planificados y resultados ---
    const attRows = { sn:[], cj:[] };
    function lift(k, title, code){
      const box = h('div', { class:'wc-box' });
      const head = h('div', { class:'wc-lift' }, esc(title) + ' <small>(' + code + ')</small>');
      const bestEl = h('small'); head.appendChild(bestEl);
      box.appendChild(head);
      if (opts.coach){
        box.appendChild(h('div', { class:'wc-h' }, 'Intentos planificados'));
        const pg = h('div', { class:'wc-grid3' });
        [0,1,2].forEach(i=>{
          const f = h('label', { class:'wc-field' });
          f.appendChild(h('span', null, (i+1) + 'º intento'));
          const inp = h('input', { type:'text', inputmode:'decimal', placeholder:'kg' });
          inp.value = e.plan[k][i] != null ? e.plan[k][i] : '';
          inp.oninput = ()=>{
            e.plan[k][i] = W.num(inp.value);
            const r = attRows[k][i];
            if (r && !e.results[k][i].st){ r.input.placeholder = e.plan[k][i] != null ? String(e.plan[k][i]) : 'kg'; }
          };
          f.appendChild(inp); pg.appendChild(f);
        });
        box.appendChild(pg);
      } else if (e.plan[k].some(x=>x != null)){
        box.appendChild(h('div', { class:'wc-goal' }, 'Planificado: ' + e.plan[k].map(x=> x != null ? x + ' kg' : '—').join(' · ')));
      }
      box.appendChild(h('div', { class:'wc-h' }, 'Resultado'));
      [0,1,2].forEach(i=>{
        const a = e.results[k][i];
        const row = h('div', { class:'wc-att' });
        row.appendChild(h('span', { class:'n' }, (i+1) + 'º'));
        const inp = h('input', { type:'text', inputmode:'decimal', 'aria-label': title + ' intento ' + (i+1) + ' (kg)' });
        inp.placeholder = e.plan[k][i] != null ? String(e.plan[k][i]) : 'kg';
        inp.value = a.kg != null ? a.kg : '';
        inp.oninput = ()=>{ a.kg = W.num(inp.value); refresh(); };
        row.appendChild(inp);
        const tg = h('div', { class:'wc-tg' });
        const bOk = h('button', { type:'button', class:'ok' }, 'Válido');
        const bNo = h('button', { type:'button', class:'no' }, 'Nulo');
        function set(st){
          a.st = (a.st === st) ? null : st;
          if (a.st && a.kg == null && e.plan[k][i] != null){ a.kg = e.plan[k][i]; inp.value = a.kg; }
          refresh();
        }
        bOk.onclick = ()=> set('ok'); bNo.onclick = ()=> set('no');
        tg.appendChild(bOk); tg.appendChild(bNo); row.appendChild(tg);
        box.appendChild(row);
        attRows[k].push({ row, input:inp, bOk, bNo, a });
      });
      root.appendChild(box);
      return bestEl;
    }
    const bestSn = lift('sn', 'Arrancada', 1);
    const bestCj = lift('cj', 'Dos tiempos', 10);

    // --- Peso corporal y puesto ---
    const ex = h('div', { class:'wc-box' });
    const exGrid = h('div', { class:'wc-grid3' });
    exGrid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
    const fBw = h('label', { class:'wc-field' }); fBw.appendChild(h('span', null, 'Peso corporal (kg)'));
    const iBw = h('input', { type:'text', inputmode:'decimal', placeholder:'—' }); iBw.value = e.results.bw != null ? e.results.bw : '';
    iBw.oninput = ()=>{ e.results.bw = W.num(iBw.value); }; fBw.appendChild(iBw);
    const fPl = h('label', { class:'wc-field' }); fPl.appendChild(h('span', null, 'Puesto'));
    const iPl = h('input', { type:'text', inputmode:'numeric', placeholder:'—' }); iPl.value = e.results.place != null ? e.results.place : '';
    iPl.oninput = ()=>{ e.results.place = W.num(iPl.value); }; fPl.appendChild(iPl);
    exGrid.appendChild(fBw); exGrid.appendChild(fPl); ex.appendChild(exGrid);
    root.appendChild(ex);

    // --- Total ---
    const tot = h('div', { class:'wc-tot' });
    const totL = h('div'); const totR = h('div', { class:'wc-goal' });
    tot.appendChild(totL); tot.appendChild(totR);
    root.appendChild(tot);

    const save = h('button', { type:'button', class:'wc-save' }, 'Guardar resultados');
    const msg = h('div', { class:'wc-msg' });
    root.appendChild(save); root.appendChild(msg);
    if (e.updatedBy){
      root.appendChild(h('div', { class:'wc-by' }, 'Última anotación: ' + esc(e.updatedBy.name || '') + ' (' + esc(e.updatedBy.role === 'coach' ? 'entrenador' : 'atleta') + ')' +
        (e.updatedAt ? ' · ' + new Date(e.updatedAt).toLocaleString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '')));
    }

    function refresh(){
      ['sn','cj'].forEach(k=> attRows[k].forEach(r=>{
        r.row.className = 'wc-att' + (r.a.st ? ' st-' + r.a.st : '');
        r.bOk.classList.toggle('on', r.a.st === 'ok'); r.bNo.classList.toggle('on', r.a.st === 'no');
      }));
      const s = W.best(e.results.sn), c = W.best(e.results.cj);
      bestSn.textContent = s !== null ? 'Mejor: ' + s + ' kg' : (W.allNull(e.results.sn) ? '3 nulos' : '');
      bestCj.textContent = c !== null ? 'Mejor: ' + c + ' kg' : (W.allNull(e.results.cj) ? '3 nulos' : '');
      const t = W.total(e.results);
      if (t !== null) totL.innerHTML = '<span>Total</span><br><b>' + t + ' kg</b>';
      else if (W.allNull(e.results.sn) || W.allNull(e.results.cj)) totL.innerHTML = '<span>Total</span><br><b style="font-size:26px;">Sin total</b>';
      else totL.innerHTML = '<span>Total</span><br><b>—</b>';
      totR.textContent = e.goals.total ? ('Objetivo: ' + e.goals.total + ' kg' + (t !== null ? (t >= e.goals.total ? ' · ¡conseguido!' : ' · faltan ' + Math.round((e.goals.total - t)*10)/10 + ' kg') : '')) : '';
    }
    refresh();

    save.onclick = async ()=>{
      msg.textContent = 'Guardando…'; msg.className = 'wc-msg';
      save.disabled = true;
      try{
        await opts.onSave(e);
        msg.textContent = 'Guardado.'; msg.className = 'wc-msg ok';
        // ¿Nuevo récord?
        if (opts.rmOf && opts.onNewRm){
          for (const [code, k, name] of [[1,'sn','arrancada'],[10,'cj','dos tiempos']]){
            const b = W.best(e.results[k]);
            if (b === null) continue;
            const cur = await opts.rmOf(code);
            if (cur === null || b > cur){
              const q = opts.coach ? '¿Guardarlo como nuevo RM en el perfil del atleta?' : '¿Guardarlo como tu nuevo RM?';
              if (confirm('¡Nuevo récord de ' + name + ': ' + b + ' kg!' + (cur !== null ? ' (antes ' + cur + ' kg)' : '') + '\n\n' + q)){
                await opts.onNewRm(code, b, e.day || e.startDate);
                msg.textContent = 'Guardado. Nuevo RM de ' + name + ': ' + b + ' kg.';
              }
            }
          }
        }
      }catch(err){
        msg.textContent = 'No se ha podido guardar: ' + (err.message || err.code || err); msg.className = 'wc-msg err';
      }finally{ save.disabled = false; }
    };
    return e;
  };

  // Mejor RM guardado en el perfil del atleta (rms[code] = [{value, date}])
  W.rmFromProfile = function(rms, code){
    const arr = (rms && rms[code]) || [];
    let m = null; arr.forEach(x=>{ if (x && x.value != null && (m === null || x.value > m)) m = x.value; });
    return m;
  };

  window.WO2C = W;
})();
