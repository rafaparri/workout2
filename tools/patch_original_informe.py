"""Cronómetro del entreno (botón «Iniciar» por movimiento; fin al resolver la última
serie) e informe semanal por tablas (día → movimiento → peso), con sensación
general y tonelaje por movimiento. La duración sale también en el informe diario.
WorkOut 2.0 lo hereda al regenerar entreno.html con build_entreno.py.
Uso: python3 patch_original_informe.py original.html salida.html
"""
import sys, os
p_in, p_out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
h = open(p_in, encoding='utf-8').read()
if 'function wo2WeekPDF' in h:
    raise SystemExit('La app original ya tiene el informe semanal nuevo.')

def patch(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, ('NO ENCAJA', old[:140], n)
    h = h.replace(old, new)

JS = open(os.path.join(here, 'entreno_informe.js'), encoding='utf-8').read()
CSS = """
.wo2-extimer{ display:flex; gap:8px; align-items:center; margin-top:12px; }
.wo2-exstart{ flex:1; min-height:50px; border-radius:12px; border:2px solid var(--t-accent,#2f7dc4); background:transparent; color:var(--t-accent,#2f7dc4); font-weight:800; font-size:17px; cursor:pointer; }
.wo2-exrun{ flex:1; font-weight:800; font-size:17px; color:var(--t-accent,#2f7dc4); font-variant-numeric:tabular-nums; }
.wo2-exdone{ flex:1; font-weight:700; font-size:15px; color:var(--t-good-fg,#2e7d4f); }
.wo2-exreset{ min-width:44px; min-height:44px; border-radius:10px; border:1.5px solid var(--t-edge,#c9ccd2); background:transparent; color:inherit; font-size:18px; cursor:pointer; }
.wo2-daytimer{ margin:8px 0 12px; padding:12px 14px; border-radius:14px; background:var(--t-accent-soft,#eef4fb); border:1.5px solid var(--t-accent,#2f7dc4); font-size:17px; font-weight:700; color:var(--t-text,inherit); }
.wo2-daytimer b{ font-variant-numeric:tabular-nums; }
.wo2-daytimer span{ font-weight:500; opacity:.8; }
.wo2-daytimer.idle{ font-weight:600; font-size:15px; opacity:.85; border-style:dashed; }
.wo2-daytimer.done{ border-color:var(--t-good,#3fb26f); }
"""
patch("</head>", "<style>" + CSS + "</style>\n<script>\n" + JS + "\n</script>\n</head>")

# En pantalla: cronómetro del día y botón por movimiento
patch("    wo2DayTools(section, plan, state.activeDay);\n",
      "    wo2DayTools(section, plan, state.activeDay);\n    wo2DayTimer(section, plan, state.activeDay);\n")
patch("  card.appendChild(chips);\n", "  card.appendChild(chips);\n  wo2ExTimerRow(card, plan, day, idx);\n")
# Informe diario: duración
patch("  data.status = dayStatus(data);\n", "  wo2TimeDecorate(plan, day, data);\n  data.status = dayStatus(data);\n")
patch("  metricBlock(marginX+colW, 'Sensación', stripEmojiForPDF(feelingLabel(data.feeling)) || '—');\n",
      "  metricBlock(marginX+colW, 'Sensación', stripEmojiForPDF(feelingLabel(data.feeling)) || '—');\n"
      "  metricBlock(marginX+colW*2, 'Duración', data.durationTxt || 'Sin cronometrar');\n"
      "  if (data.durationRange){ doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(120,120,120); doc.text(data.durationRange.replace('→','-'), marginX+colW*2, y+10.5); }\n")
patch("  lines.push('Tonelaje: ' + data.tonnageKg + ' kg');\n",
      "  lines.push('Tonelaje: ' + data.tonnageKg + ' kg');\n  lines.push('Duración del entreno: ' + (data.durationTxt ? data.durationTxt + (data.durationRange ? ' (' + data.durationRange + ')' : '') : 'sin cronometrar'));\n")
# Informe semanal: nuevo formato por tablas
patch("function generateWeekReportPDF(plan, perDay, memoText, status, watchPatterns, keywordPatterns, movementCharts){\n",
      "function generateWeekReportPDF(plan, perDay, memoText, status, watchPatterns, keywordPatterns, movementCharts){\n  return wo2WeekPDF(plan, memoText);\n")
patch("function weekReportPlainText(plan, perDay, memoText, status, watchPatterns, keywordPatterns, movementCharts){\n",
      "function weekReportPlainText(plan, perDay, memoText, status, watchPatterns, keywordPatterns, movementCharts){\n  return wo2WeekText(plan, memoText);\n")

open(p_out, 'w', encoding='utf-8').write(h)
print('Informe y cronómetro:', p_out)
