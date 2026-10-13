// calendario-oficial.js — Calendario oficial de competiciones (júnior, absoluto y máster).
// Lo usa competiciones.html: el entrenador elige una y la añade a las de su club.
// Fuentes: calendario unificado de la RFEH (fedehalter.org), Comité Español de
// Halterofilia Máster (halterofiliamasters.es), EWF e IWF.
// Para actualizarlo basta con añadir o cambiar filas de la lista.
//   cats: 'junior', 'sub23', 'absoluto', 'master'
//   sex:  'FM' (femenino y masculino), 'F' o 'M'
//   scope: 'es' (España) o 'int' (internacional)
window.WO2_OFICIAL_ACTUALIZADO = '13 de octubre de 2026';
window.WO2_OFICIAL = [
  { id:'2026-eu-jun-u23', name:'Campeonato de Europa Júnior y Sub-23', place:'Durrës (Albania)', startDate:'2026-10-12', endDate:'2026-10-19', scope:'int', org:'EWF', cats:['junior','sub23'], sex:'FM' },
  { id:'2026-gp-gandia', name:'Gran Prix Internacional Femenino · Trofeo Ciudad de Gandía', place:'Gandía (Valencia)', startDate:'2026-10-16', endDate:'2026-10-18', scope:'es', org:'RFEH', cats:['absoluto'], sex:'F' },
  { id:'2026-mundo-abs', name:'Campeonato del Mundo Absoluto', place:'Chengdú (China)', startDate:'2026-10-28', endDate:'2026-11-10', scope:'int', org:'IWF', cats:['absoluto'], sex:'FM' },
  { id:'2026-med-masters', name:'Mediterranean Masters Open', place:'Portugal', startDate:'2026-10-29', endDate:'2026-11-01', scope:'int', org:'Máster', cats:['master'], sex:'FM' },
  { id:'2026-liga-4', name:'IV Jornada Liga de Clubes / Playoff', place:'Sedes autonómicas', startDate:'2026-11-01', endDate:'2026-11-02', scope:'es', org:'RFEH', cats:['absoluto'], sex:'FM' },
  { id:'2026-esp-junior', name:'LV Campeonato de España Júnior y por Federaciones', place:'Ourense (Galicia)', startDate:'2026-11-14', endDate:'2026-11-16', scope:'es', org:'RFEH', cats:['junior'], sex:'FM' },
  { id:'2026-copa-rey-reina', name:'Copa S.M. el Rey y Copa S.M. la Reina', place:'Zarautz (Gipuzkoa)', startDate:'2026-11-28', endDate:'2026-11-30', scope:'es', org:'RFEH', cats:['absoluto'], sex:'FM' },
  { id:'2027-open-potsdam', name:'6.º Open Internacional de Halterofilia Máster de Alemania', place:'Potsdam (Alemania)', startDate:'2027-01-29', endDate:'2027-01-31', scope:'int', org:'Máster', cats:['master'], sex:'FM' },
  { id:'2027-eu-abs', name:'Campeonato de Europa Absoluto', place:'Antalya (Turquía)', startDate:'2027-04-11', endDate:'2027-04-18', scope:'int', org:'EWF', cats:['absoluto'], sex:'FM' },
  { id:'2027-wmg-kansai', name:'World Masters Games 2027 Kansai · Halterofilia', place:'Naruto, Tokushima (Japón)', startDate:'2027-05-17', endDate:'2027-05-25', scope:'int', org:'Máster', cats:['master'], sex:'FM' },
  { id:'2027-eu-masters', name:'Campeonato de Europa Máster', place:'Laukaa (Finlandia)', startDate:'2027-08-04', endDate:'2027-08-13', scope:'int', org:'Máster', cats:['master'], sex:'FM' },
  { id:'2028-mundo-masters', name:'Campeonato del Mundo Máster', place:'Corbera de Llobregat (Barcelona)', startDate:'2028-07-27', endDate:'2028-08-05', scope:'int', org:'Máster', cats:['master'], sex:'FM', note:'Fechas por confirmar' }
];
