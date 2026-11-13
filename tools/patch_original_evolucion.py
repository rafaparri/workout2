"""Gráficas de evolución en la app (informe semanal en pantalla y pantalla Análisis):
peso máximo HECHO (marcado), semanas ordenadas por fecha, variantes por separado
y lista de comprobación (semana, fecha, peso, día y serie). Mismo cálculo que el PDF.
Uso: python3 patch_original_evolucion.py original.html salida.html
"""
import sys
p_in, p_out = sys.argv[1], sys.argv[2]
h = open(p_in, encoding='utf-8').read()
if 'function wo2WeekMovementCharts' in h:
    raise SystemExit('La app original ya tiene las gráficas de evolución nuevas.')
def patch(old, new, count=1):
    global h
    n = h.count(old); assert n == count, ('NO ENCAJA', old[:140], n); h = h.replace(old, new)

JS = r"""<script>
// ===== Evolución por movimiento en pantalla (mismo cálculo que el PDF) =====
function wo2WeekMovementCharts(plan){
  if (typeof wo2Evolution !== 'function' || !plan) return [];
  return wo2Evolution(plan, wo2WeekData(plan)).map(mc=>({ name: mc.name,
    points: mc.points.map(p=>({ label: p.label, date: p.date, maxKg: p.kg, current: p.current, src: p.src, ratings: p.avg != null ? [p.avg] : [] })) }));
}
function wo2SparkSVG(points){
  const width = 300, height = 130, padX = 20, top = 22, bottom = 34;
  const kgs = points.map(p=> p.maxKg), mn = Math.min(...kgs), mx = Math.max(...kgs), rg = (mx - mn) || 1;
  const stepX = points.length > 1 ? (width - 2*padX) / (points.length - 1) : 0;
  const cs = points.map((p, i)=>({ x: points.length > 1 ? padX + i*stepX : width/2, y: height - bottom - ((p.maxKg - mn) / rg) * (height - top - bottom), p }));
  const path = cs.map((c, i)=> (i ? 'L' : 'M') + c.x.toFixed(1) + ',' + c.y.toFixed(1)).join(' ');
  const col = (p)=>{ const r = p.ratings && p.ratings.length ? p.ratings[0] : null; const info = r != null ? ratingInfo(Math.round(r)) : null; return info ? info.color : '#8892a0'; };
  const dots = cs.map(c=> '<circle cx="'+c.x.toFixed(1)+'" cy="'+c.y.toFixed(1)+'" r="'+(c.p.current ? 6 : 4.5)+'" fill="'+col(c.p)+'" stroke="#fff" stroke-width="1.5"/>' +
    '<text x="'+c.x.toFixed(1)+'" y="'+(c.y - 9).toFixed(1)+'" font-size="12" font-weight="700" fill="currentColor" text-anchor="middle" font-family="IBM Plex Mono, monospace">'+c.p.maxKg+'</text>' +
    '<text x="'+c.x.toFixed(1)+'" y="'+(height - 18)+'" font-size="11" font-weight="'+(c.p.current ? 700 : 400)+'" fill="currentColor" opacity="'+(c.p.current ? 1 : .65)+'" text-anchor="middle" font-family="IBM Plex Mono, monospace">'+c.p.label+'</text>' +
    '<text x="'+c.x.toFixed(1)+'" y="'+(height - 4)+'" font-size="9.5" fill="currentColor" opacity=".55" text-anchor="middle" font-family="IBM Plex Mono, monospace">'+(c.p.date || '')+'</text>').join('');
  return '<svg width="100%" height="'+height+'" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="xMidYMid meet" style="color:var(--chalk);overflow:visible">' +
    '<path d="'+path+'" fill="none" stroke="#3f6f9f" stroke-width="2.5"/>' + dots + '</svg>';
}
function wo2SparkList(points){
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:8px;border-top:1px solid var(--surface-3);padding-top:8px;display:grid;grid-template-columns:auto auto 1fr;gap:4px 12px;font-size:15px;line-height:1.35;color:var(--chalk);';
  points.slice().reverse().forEach(p=>{
    const a = document.createElement('div'); a.textContent = p.label + ' · ' + (p.date || '');
    const b = document.createElement('div'); b.textContent = p.maxKg + ' kg'; b.style.fontWeight = '800';
    const c = document.createElement('div'); c.textContent = p.src ? p.src.day + ' · ' + p.src.sr + (p.src.r ? ' · ' + p.src.r + '/5' : '') : '';
    c.style.color = 'var(--muted-2)';
    if (p.current){ a.style.fontWeight = '800'; }
    box.appendChild(a); box.appendChild(b); box.appendChild(c);
  });
  return box;
}
</script>
</head>"""
patch("</head>", JS)

# Informe semanal en pantalla
patch("  const movementCharts = weekMovementCharts();\n  state.weekReport = { planId: plan.id, perDay, status, watchPatterns, keywordPatterns, movementCharts, memo: { loading:false, text: summary, error:null } };",
      "  const movementCharts = (typeof wo2WeekMovementCharts === 'function') ? wo2WeekMovementCharts(plan) : weekMovementCharts();\n"
      "  const memoTxt = (typeof wo2WeekReading === 'function') ? wo2WeekReading(wo2WeekData(plan)) : summary;\n"
      "  state.weekReport = { planId: plan.id, perDay, status, watchPatterns, keywordPatterns, movementCharts, memo: { loading:false, text: memoTxt, error:null } };")
patch("    const chartsTitle = el('div', null, 'MÁXIMOS ACUMULADOS POR MOVIMIENTO');",
      "    const chartsTitle = el('div', null, 'EVOLUCIÓN DE CADA MOVIMIENTO · peso máximo hecho cada semana');")
patch("      const lastKg = mc.points[mc.points.length-1].maxKg;\n      const kgEl = el('div', null, lastKg+'kg');",
      "      const lastKg = mc.points[mc.points.length-1].maxKg;\n      const kgEl = el('div', null, 'máx ' + Math.max(...mc.points.map(p=>p.maxKg)) + ' kg');")
patch("      svgWrap.innerHTML = sparklineSVG(mc.points);\n      card.appendChild(svgWrap);\n      sheet.appendChild(card);",
      "      svgWrap.innerHTML = mc.points[0] && mc.points[0].date !== undefined ? wo2SparkSVG(mc.points) : sparklineSVG(mc.points);\n      card.appendChild(svgWrap);\n"
      "      if (mc.points[0] && mc.points[0].date !== undefined) card.appendChild(wo2SparkList(mc.points));\n      sheet.appendChild(card);")

# Pantalla Análisis: peso hecho y orden por fecha
patch("""  const plansSorted = [...state.plans].filter(p=>!p.needsReview).sort((a,b)=>{
    const wa = typeof a.meta.week === 'number' ? a.meta.week : null;
    const wb = typeof b.meta.week === 'number' ? b.meta.week : null;
    if (wa!==null && wb!==null && wa!==wb) return wa-wb;
    return a.uploadedAt - b.uploadedAt;
  });""", """  const plansSorted = [...state.plans].filter(p=>!p.needsReview).sort((a,b)=>{
    if (typeof wo2PlanTime === 'function'){ const d = wo2PlanTime(a) - wo2PlanTime(b); if (d) return d; }
    const wa = typeof a.meta.week === 'number' ? a.meta.week : null;
    const wb = typeof b.meta.week === 'number' ? b.meta.week : null;
    if (wa!==null && wb!==null && wa!==wb) return wa-wb;
    return a.uploadedAt - b.uploadedAt;
  });""")
patch("""          if (s.kg!==null && s.kg!==undefined) perCodeThisPlan[entry.code].kgs.push(s.kg);""",
      """          if (s.kg!==null && s.kg!==undefined && (typeof wo2SetDone !== 'function' || wo2SetDone(plan, day, exIdx, si).series > 0)) perCodeThisPlan[entry.code].kgs.push(s.kg);""")
open(p_out, 'w', encoding='utf-8').write(h)
print('Evolución en pantalla:', p_out)
