// categorias-oficiales.js — Categorías oficiales de halterofilia (edad y peso corporal).
// Fuentes: IWF (Reglamento técnico), IMWA (reglas máster 2025-2026), RFEH.
// Cuando cambie algo: actualizar las listas y añadir una entrada en CHANGES
// (la app avisa al entrenador de los cambios que todavía no ha visto).
(function(){
  const C = window.WO2CAT = {};
  C.ACTUALIZADO = '13 de octubre de 2026';
  C.VIGENTE_DESDE = '1 de agosto de 2026';

  // Grupos de edad
  C.GROUPS = [
    { id:'u15', label:'Sub-15', w:'youth15' },
    { id:'u17', label:'Sub-17', w:'youth17' },
    { id:'u20', label:'Júnior (Sub-20)', w:'senior' },
    { id:'u23', label:'Sub-23', w:'senior' },
    { id:'abs', label:'Absoluto', w:'senior' }
  ];
  [35,40,45,50,55,60,65,70,75,80,85,90].forEach(a=> C.GROUPS.push({ id:'m'+a, master:a, label:'Máster ' + a + (a === 90 ? '+' : ''), w:'senior' }));

  // Categorías de peso vigentes (desde el 1 de agosto de 2026)
  C.WEIGHTS = {
    senior:  { M:['60','65','70','75','85','95','110','+110'], F:['49','53','57','61','69','77','86','+86'] },
    youth17: { M:['55','60','65','70','75','85','95','+95'],   F:['45','49','53','57','61','69','77','+77'] },
    youth15: { M:['51','55','60','65','70','75','85','+85'],   F:['41','45','49','53','57','61','69','+69'] }
  };

  // Historial de cambios (lo más reciente, primero)
  C.CHANGES = [
    { id:'2026-08-pesos', date:'1 de agosto de 2026',
      title:'Nuevas categorías de peso',
      text:'La IWF ha cambiado las categorías de peso (también para máster, júnior y sub-23). ' +
           'Hombres: 71→70, 79→75, 88→85 y 94→95 kg (se mantienen 60, 65, 110 y +110). ' +
           'Mujeres: 48→49, 58→57 y 63→61 kg (se mantienen 53, 69, 77, 86 y +86). ' +
           'También cambian las de sub-17 y sub-15. Revisa la categoría de tus atletas en las próximas competiciones.' }
  ];

  // Texto que se guarda: «Máster M50 · 95 kg», «Máster W50 · 61 kg», «Absoluto · 95 kg»
  C.label = function(sex, groupId, w){
    const g = C.GROUPS.find(x=> x.id === groupId); if (!g) return '';
    const name = g.master ? 'Máster ' + (sex === 'F' ? 'W' : 'M') + g.master + (g.master === 90 ? '+' : '') : g.label;
    return name + (w ? ' · ' + w + ' kg' : '');
  };
  // Intenta leer un texto ya guardado
  C.parse = function(t){
    t = String(t || '');
    const out = { sex:null, group:null, w:null };
    const m = t.match(/M[áa]ster\s*([MW])\s*(\d{2})/i);
    if (m){ out.sex = m[1].toUpperCase() === 'W' ? 'F' : 'M'; out.group = 'm' + m[2]; }
    else if (/sub-?15/i.test(t)) out.group = 'u15';
    else if (/sub-?17/i.test(t)) out.group = 'u17';
    else if (/j[úu]nior|sub-?20/i.test(t)) out.group = 'u20';
    else if (/sub-?23/i.test(t)) out.group = 'u23';
    else if (/absolut|s[ée]nior/i.test(t)) out.group = 'abs';
    const k = t.match(/(\+?\d{2,3})\s*kg/i); if (k) out.w = k[1];
    return out;
  };
  C.weightsFor = function(sex, groupId){
    const g = C.GROUPS.find(x=> x.id === groupId);
    return g && sex ? C.WEIGHTS[g.w][sex] : [];
  };
  // ¿Usa un peso que ya no existe?
  C.outdated = function(t){
    const p = C.parse(t);
    if (!p.w) return false;
    const all = p.group && p.sex ? C.weightsFor(p.sex, p.group)
      : [].concat(...Object.values(C.WEIGHTS).map(x=> x.M.concat(x.F)));
    return all.indexOf(p.w) < 0;
  };

  // Selector de categoría (sexo + grupo de edad + peso). Devuelve { get() }.
  C.picker = function(box, current){
    const p = C.parse(current);
    if (!p.sex && p.w){ if (C.WEIGHTS.senior.F.indexOf(p.w) >= 0 && C.WEIGHTS.senior.M.indexOf(p.w) < 0) p.sex = 'F'; }
    box.innerHTML = '';
    box.classList.add('catPick');
    const mk = (lbl, opts, val)=>{
      const d = document.createElement('div');
      const l = document.createElement('label'); l.textContent = lbl;
      const s = document.createElement('select');
      s.innerHTML = '<option value="">—</option>' + opts.map(([v,t])=> '<option value="' + v + '"' + (v === val ? ' selected' : '') + '>' + t + '</option>').join('');
      d.appendChild(l); d.appendChild(s); box.appendChild(d);
      return s;
    };
    const sSex = mk('Sexo', [['M','Masculino'],['F','Femenino']], p.sex || '');
    const sGrp = mk('Edad', C.GROUPS.map(g=> [g.id, g.label]), p.group || '');
    const sW = mk('Peso', [], '');
    const warn = document.createElement('div'); warn.className = 'catWarn'; box.appendChild(warn);
    const fillW = (keep)=>{
      const list = C.weightsFor(sSex.value, sGrp.value);
      sW.innerHTML = '<option value="">—</option>' + list.map(w=> '<option value="' + w + '"' + (w === keep ? ' selected' : '') + '>' + w + ' kg</option>').join('');
      sW.disabled = !list.length;
    };
    fillW(p.w);
    const oldTxt = current && C.outdated(current) ? current : '';
    const upd = ()=>{ warn.textContent = (oldTxt && !sW.value) ? '⚠ «' + oldTxt + '» era una categoría antigua (cambiaron el ' + C.VIGENTE_DESDE + '). Elige el peso nuevo.' : ''; };
    sSex.onchange = ()=>{ fillW(sW.value); upd(); };
    sGrp.onchange = ()=>{ fillW(sW.value); upd(); };
    sW.onchange = upd; upd();
    return {
      get: ()=> (sGrp.value ? C.label(sSex.value, sGrp.value, sW.value) : (oldTxt || '')),
      reset: ()=>{ sGrp.value = ''; sW.value = ''; fillW(''); }
    };
  };
})();
