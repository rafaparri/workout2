import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
def patch(old, new):
    global h
    assert h.count(old)==1, ('NO ENCAJA', old[:120], h.count(old))
    h = h.replace(old, new)

# 1) Colores de los pesos cambiados / añadidos respecto a lo programado
patch("function ratingInfo(value){ return SET_RATING_LEVELS.find(l=>l.value===value) || null; }",
"""function ratingInfo(value){ return SET_RATING_LEVELS.find(l=>l.value===value) || null; }

// Pesos que no son exactamente lo programado: cambiados (menos peso/repes
// por dolor, lesión o cansancio, o al revés) en naranja, y añadidos (por
// verse muy bien) en verde. Así se distinguen de un vistazo.
const SET_CHANGE_STYLES = {
  edited: { bg:'#fde9da', border:'#e07b39', label:'✏️ Cambiado respecto a lo programado' },
  added:  { bg:'#dff3e5', border:'#2e9a52', label:'➕ Añadido a lo programado' }
};
function setChangeStyle(s){
  if (!s) return null;
  if (s.added) return SET_CHANGE_STYLES.added;
  if (s.edited) return SET_CHANGE_STYLES.edited;
  return null;
}
function setChangeDetail(s){
  if (s && s.edited && !s.added && s.original){
    const o = s.original;
    return 'Programado: ' + kgDisplayText(o) + ' · ' + (o.series||'?') + '×' + repDisplayText(o);
  }
  return '';
}""")

# 2) Al editar un peso, guardar lo programado la primera vez (para poder mostrarlo)
patch("""        if (isNaN(newKg) || newKg<=0) return;
        const repsInfo = parseRepsCell(repVal);""",
"""        if (isNaN(newKg) || newKg<=0) return;
        if (!s.original && !s.added){
          s.original = { kg: s.kg, series: s.series ?? null, reps: s.reps ?? null, repsParts: s.repsParts || null, repsRaw: s.repsRaw || null };
        }
        const repsInfo = parseRepsCell(repVal);""")
patch("""        s.edited = true;
        persistUserData();
        state.flashcard.editingSet = false;""",
"""        s.edited = true;
        // Si se deja igual que lo programado, deja de contar como cambiado
        if (s.original && s.original.kg === s.kg && (s.original.series ?? null) === (s.series ?? null) && (s.original.reps ?? null) === (s.reps ?? null)){
          delete s.original; delete s.edited;
        }
        persistUserData();
        state.flashcard.editingSet = false;""")

# 3) Los pesos nuevos quedan marcados como añadidos
patch("        entry.sets.push({ kg:nw.kg, series:nw.series??null, reps:nw.reps??null });",
      "        entry.sets.push({ kg:nw.kg, series:nw.series??null, reps:nw.reps??null, added:true });")

# 4) Chips de la tarjeta de ejercicio con su color
patch("(s.optional ? ' 🔓' : '') + (s.edited ? ' ✏️' : '');",
"""(s.optional ? ' 🔓' : '') + (s.added ? ' ➕' : (s.edited ? ' ✏️' : ''));
    const chg = setChangeStyle(s);
    if (chg){
      chip.style.background = chg.bg;
      chip.style.borderTopColor = chg.border; chip.style.borderRightColor = chg.border; chip.style.borderBottomColor = chg.border;
      if (!rinfo) chip.style.borderLeftColor = chg.border;
      chip.style.borderWidth = '2px'; if (rinfo) chip.style.borderLeftWidth = '5px';
    }""")

# 5) Tarjeta grande con su color y explicación
patch("    const card = el('div','fc-card'+dirClass);\n\n    if (state.flashcard.editingSet){",
"""    const card = el('div','fc-card'+dirClass);
    const cardChg = setChangeStyle(s);
    if (cardChg){
      card.style.background = cardChg.bg;
      card.style.border = '4px solid ' + cardChg.border;
      card.style.borderRadius = '18px';
    }

    if (state.flashcard.editingSet){""")
patch("""    if (s.edited){
      const editedBadge = el('div', null, '✏️ Modificado a mano');
      editedBadge.style.cssText = 'font-family:Inter,sans-serif;font-size:16px;font-weight:600;color:var(--yellow-deep);text-align:center;';
      card.appendChild(editedBadge);
    }""",
"""    if (cardChg){
      const editedBadge = el('div', null, cardChg.label);
      editedBadge.style.cssText = 'font-family:Inter,sans-serif;font-size:18px;font-weight:700;color:#fff;background:' + cardChg.border + ';padding:8px 14px;border-radius:10px;text-align:center;';
      card.appendChild(editedBadge);
      const detail = setChangeDetail(s);
      if (detail){
        const d = el('div', null, detail);
        d.style.cssText = 'font-family:IBM Plex Mono,monospace;font-size:17px;font-weight:600;color:var(--chalk);text-align:center;margin-top:-12px;';
        card.appendChild(d);
      }
    }""")
open(p_out,'w',encoding='utf-8').write(h)
print('ok')
