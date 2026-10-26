"""Ejercicios combinados (p. ej. 12+29): al editar un peso o añadir uno nuevo
sale una casilla de repeticiones por cada movimiento del combo (2 cargadas + 1 jerk).
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_combo.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2ComboBox' in h:
    raise SystemExit('La app original ya tiene las repes por movimiento en los combos.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

JS = r"""<style>
.wo2-combo{ margin:16px auto 0; padding:12px 14px; border:1.5px solid var(--surface-3); border-radius:14px; display:flex; flex-direction:column; gap:10px; max-width:380px; }
.wo2-combo-title{ font-size:16px; font-weight:700; color:var(--muted-2); text-transform:uppercase; letter-spacing:.03em; text-align:center; }
.wo2-combo-row{ display:flex; align-items:center; gap:12px; }
.wo2-combo-row .fc-field-input{ width:78px; flex-shrink:0; }
.wo2-combo-name{ font-size:18px; font-weight:700; color:var(--chalk); line-height:1.25; text-align:left; }
</style>
<script>
// ===== Combos: repeticiones de cada movimiento por separado =====
function wo2IsCombo(entry){ return !!(entry && entry.parts && entry.parts.length > 1); }
function wo2ComboName(p){ return (DICT[p.code] || ('Código ' + p.code)) + (p.modifier ? ' (' + p.modifier + ')' : ''); }
// Caja con una casilla por movimiento. vals = repes iniciales; onInput(i, valor) opcional
function wo2ComboBox(entry, vals, onInput){
  const box = el('div','wo2-combo');
  box.appendChild(el('div','wo2-combo-title','Repes de cada movimiento'));
  entry.parts.forEach((p, i)=>{
    const row = el('div','wo2-combo-row');
    const inp = document.createElement('input');
    inp.type = 'text'; inp.inputMode = 'numeric'; inp.className = 'fc-field-input wo2-combo-inp';
    const v = vals && vals[i];
    inp.value = v === null || v === undefined ? '' : v;
    inp.setAttribute('aria-label', 'Repeticiones de ' + wo2ComboName(p));
    if (onInput) inp.addEventListener('input', ()=> onInput(i, inp.value.trim()));
    row.appendChild(inp);
    row.appendChild(el('div','wo2-combo-name', wo2ComboName(p)));
    box.appendChild(row);
  });
  return box;
}
// Texto de repes ("2+1") a partir de las casillas del combo; null si alguna está vacía
function wo2ComboText(scope){
  const ins = Array.from((scope || document).querySelectorAll('.wo2-combo-inp'));
  if (!ins.length) return null;
  const vals = ins.map(i=> i.value.trim());
  if (vals.every(v=> v === '')) return '';
  return vals.map(v=> v === '' ? '0' : v).join('+');
}
</script>
</head>"""
patch("</head>", JS)

# --- Editar este peso ---
patch("      form.appendChild(mkField('Repes','reps',78, repsVal, 'text'));\n      card.appendChild(form);\n",
      "      if (!wo2IsCombo(entry)) form.appendChild(mkField('Repes','reps',78, repsVal, 'text'));\n      card.appendChild(form);\n"
      "      if (wo2IsCombo(entry)) card.appendChild(wo2ComboBox(entry, s.repsParts || (entry.parts.length && s.reps != null ? [s.reps] : null)));\n")
patch("        const repVal = document.getElementById('edit-set-reps').value.trim();\n",
      "        const repVal = wo2IsCombo(entry) ? (wo2ComboText(card) ?? '') : document.getElementById('edit-set-reps').value.trim();\n")

# --- Nuevo peso ---
patch("        state.newWeightDraft = { kg:last.kg, series:last.series, reps:last.reps };\n",
      "        state.newWeightDraft = { kg:last.kg, series:last.series, reps:last.reps, repsParts: last.repsParts ? last.repsParts.slice() : null };\n")
patch("      form.appendChild(mk('Repes','reps',78));\n      card.appendChild(form);\n",
      "      if (!wo2IsCombo(entry)) form.appendChild(mk('Repes','reps',78));\n      card.appendChild(form);\n"
      "      if (wo2IsCombo(entry)) card.appendChild(wo2ComboBox(entry, state.newWeightDraft.repsParts, (i, v)=>{\n"
      "        const d = state.newWeightDraft;\n"
      "        if (!d.repsParts) d.repsParts = entry.parts.map(()=> null);\n"
      "        d.repsParts[i] = v === '' ? null : Number(v.replace(',','.'));\n"
      "      }));\n")
patch("        entry.sets.push({ kg:nw.kg, series:nw.series??null, reps:nw.reps??null, added:true });\n",
      "        const ns = { kg:nw.kg, series:nw.series??null, reps:nw.reps??null, added:true };\n"
      "        if (wo2IsCombo(entry)){\n"
      "          const info = parseRepsCell(wo2ComboText(card) || '');\n"
      "          ns.reps = info.total; ns.repsParts = info.parts;\n"
      "        }\n"
      "        entry.sets.push(ns);\n")

open(p_out, 'w', encoding='utf-8').write(h)
print('Repes por movimiento en combos:', p_out)
