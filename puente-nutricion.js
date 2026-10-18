/* puente-nutricion.js
 * Botón "Abrir en Nutrición": envía a la app RPT Nutrición los datos de la
 * semana (nombre e intensidad de cada día) dentro del propio enlace.
 * No sube nada a ningún servidor ni toca la base de datos.
 * Las dos apps siguen siendo independientes.
 */
(function(){
  var NUTRICION_URL = 'https://rafaparri.github.io/-rpt-nutricion-stlite/';
  var DIAS = ['L','M','X','J','V','S','D'];

  // Carga de trabajo de un día: suma de series x repeticiones (x kg si hay).
  function cargaDia(entries){
    var t = 0;
    (entries || []).forEach(function(e){
      (e.sets || []).forEach(function(s){
        var series = Number(s.series) || 1, reps = Number(s.reps) || 1, kg = Number(s.kg) || 0;
        t += series * reps * (kg > 0 ? kg : 10);
      });
    });
    return t;
  }

  // Alta = cerca del día más duro; Descanso = sin ejercicios; Media = el resto.
  function intensidades(plan){
    var cargas = {}, max = 0;
    DIAS.forEach(function(d){
      cargas[d] = cargaDia(plan && plan.days && plan.days[d]);
      if (cargas[d] > max) max = cargas[d];
    });
    var res = {};
    DIAS.forEach(function(d){
      res[d] = cargas[d] <= 0 ? 'D' : (cargas[d] >= 0.7 * max ? 'A' : 'M');
    });
    return res;
  }

  function b64url(obj){
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = ''; bytes.forEach(function(b){ bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  window.PuenteNutricion = {
    enlace: function(nombre, plan){
      var datos = { v:1, n:String(nombre || '').slice(0,60), i:intensidades(plan) };
      return NUTRICION_URL + '?wo=' + b64url(datos);
    },
    abrir: function(nombre, plan){
      window.open(this.enlace(nombre, plan), '_blank', 'noopener');
    }
  };
})();
