// ===== WorkOut 2.0 · Servidor del análisis de técnica con IA =====
// Se publica como «Worker» de Cloudflare (gratuito). Guarda la clave de la IA
// fuera de la app: la app le manda los fotogramas del levantamiento y él
// pregunta a Claude y devuelve el análisis.
//
// Ajustes del Worker (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (Secret)  clave de la API de Anthropic. Nunca en la app.
//   MODEL              (Text, opcional)  modelo; por defecto claude-sonnet-5-5
//   FIREBASE_PROJECT   (Text, opcional)  por defecto workout2-75512
//   ALLOWED_ORIGINS    (Text, opcional)  por defecto https://rafaparri.github.io
//
// Solo atiende a usuarios con sesión iniciada en WorkOut 2.0 (comprueba el
// «token» de Firebase de cada petición), así nadie más puede gastar la clave.

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const DEFAULT_PROJECT = 'workout2-75512';
const DEFAULT_ORIGINS = 'https://rafaparri.github.io';
const MAX_FRAMES = 14;
const MAX_FRAME_CHARS = 700000;      // ~500 KB por fotograma
const PER_USER_PER_HOUR = 30;        // freno sencillo por usuario

const SYSTEM = `Eres un entrenador de halterofilia con mucha experiencia (nivel nacional e internacional) que revisa la técnica de sus atletas a partir de fotogramas de vídeo.
Recibirás fotogramas en orden temporal de UNA serie, con el segundo del vídeo de cada uno, y datos del ejercicio (nombre, kilos, repeticiones).
Analiza solo lo que de verdad se ve en las imágenes. Fíjate, según el ejercicio, en: posición de salida (pies, espalda, hombros respecto a la barra), primer tirón, paso por las rodillas y transición, extensión final (cadera, rodillas, tobillos), trayectoria de la barra respecto al cuerpo, brazos (si tiran antes de tiempo), recepción (profundidad, estabilidad, posición de la barra, codos en la cargada, bloqueo en arrancada y jerk), pies en la recepción y recuperación.
Los fotogramas son sueltos: no puedes medir la velocidad ni ver todo el movimiento. Si algo no se aprecia (ángulo, distancia, fotogramas que no coinciden con el levantamiento), dilo con naturalidad en lugar de inventarlo.
Responde en español de España, para el atleta, con este formato y en texto plano (sin markdown, sin asteriscos ni almohadillas):
Lo que está bien:
- (1 o 2 puntos)
A mejorar (por orden de importancia):
- (máximo 3 puntos; cada uno con qué se ve, en qué momento y por qué importa)
Consigna para la próxima serie: (una sola frase corta, tipo indicación de entrenador)
Si procede, termina con una línea "Nota:" sobre lo que no se ha podido valorar. Máximo 170 palabras en total.`;

function cors(origin, env){
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s=> s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(obj, status, headers){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type':'application/json; charset=utf-8' }, headers) });
}

// ---------- Comprobación del token de Firebase ----------
let KEYS = null, KEYS_EXP = 0;
async function googleKeys(){
  if (KEYS && Date.now() < KEYS_EXP) return KEYS;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('No se han podido leer las claves de Google');
  const j = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '');
  KEYS = j.keys || []; KEYS_EXP = Date.now() + (m ? Number(m[1]) * 1000 : 3600000);
  return KEYS;
}
function b64urlBytes(s){
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlJson(s){ return JSON.parse(new TextDecoder().decode(b64urlBytes(s))); }
async function verifyFirebaseToken(token, project){
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('token');
  const head = b64urlJson(parts[0]), pay = b64urlJson(parts[1]);
  if (head.alg !== 'RS256') throw new Error('token');
  const now = Math.floor(Date.now() / 1000);
  if (pay.aud !== project || pay.iss !== 'https://securetoken.google.com/' + project) throw new Error('token');
  if (!pay.sub || pay.exp < now - 60 || pay.iat > now + 300) throw new Error('token');
  const jwk = (await googleKeys()).find(k=> k.kid === head.kid);
  if (!jwk) throw new Error('token');
  const key = await crypto.subtle.importKey('jwk', jwk, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('token');
  return pay.sub;
}

// Freno sencillo por usuario (en memoria; se reinicia solo)
const HITS = new Map();
function tooMany(uid){
  const h = Math.floor(Date.now() / 3600000), k = uid + '|' + h;
  const n = (HITS.get(k) || 0) + 1; HITS.set(k, n);
  if (HITS.size > 5000) HITS.clear();
  return n > PER_USER_PER_HOUR;
}

function clip(s, n){ return String(s == null ? '' : s).slice(0, n); }

export default {
  async fetch(req, env){
    const origin = req.headers.get('Origin') || '';
    const ch = cors(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers: ch });
    const url = new URL(req.url);
    if (req.method === 'GET') return json({ ok:true, servicio:'WorkOut 2.0 · análisis de técnica', modelo: env.MODEL || DEFAULT_MODEL, clave: !!env.ANTHROPIC_API_KEY }, 200, ch);
    if (req.method !== 'POST' || !/\/analizar\/?$/.test(url.pathname)) return json({ error:'Ruta no válida' }, 404, ch);
    if (!env.ANTHROPIC_API_KEY) return json({ error:'Falta la clave de la IA en el servidor (ANTHROPIC_API_KEY).' }, 500, ch);

    let uid;
    try{
      const auth = req.headers.get('Authorization') || '';
      uid = await verifyFirebaseToken(auth.replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT || DEFAULT_PROJECT);
    }catch(e){ return json({ error:'Sesión no válida. Cierra y vuelve a abrir la app.' }, 401, ch); }
    if (tooMany(uid)) return json({ error:'Demasiados análisis seguidos. Espera un rato.' }, 429, ch);

    let body;
    try{ body = await req.json(); }catch(e){ return json({ error:'Petición mal formada' }, 400, ch); }
    const frames = Array.isArray(body.frames) ? body.frames.slice(0, MAX_FRAMES) : [];
    if (!frames.length) return json({ error:'No llegan fotogramas del vídeo.' }, 400, ch);
    const c = body.context || {};

    const content = [{ type:'text', text:
      'Ejercicio: ' + clip(c.exercise, 120) + '\n' +
      (c.label ? 'Serie grabada: ' + clip(c.label, 160) + '\n' : '') +
      (c.sets ? 'Programado ese día: ' + clip(c.sets, 300) + '\n' : '') +
      (c.note ? 'Nota del atleta: ' + clip(c.note, 300) + '\n' : '') +
      (c.athlete ? 'Atleta: ' + clip(c.athlete, 120) + '\n' : '') +
      'Duración del vídeo: ' + (Number(c.duration) ? Number(c.duration).toFixed(1) + ' s' : 'desconocida') +
      '. Fotogramas centrados en el tramo con más movimiento: ' + frames.length + '.' }];
    for (const f of frames){
      const data = String(f && f.data || '');
      if (!data || data.length > MAX_FRAME_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) continue;
      content.push({ type:'text', text: 'Segundo ' + (Number(f.t) || 0).toFixed(1) + ':' });
      content.push({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data } });
    }
    if (content.length < 3) return json({ error:'Los fotogramas no son válidos.' }, 400, ch);
    content.push({ type:'text', text:'Haz el análisis siguiendo el formato indicado.' });

    const model = env.MODEL || DEFAULT_MODEL;
    let r;
    try{
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 900, system: SYSTEM, messages:[{ role:'user', content }] })
      });
    }catch(e){ return json({ error:'No se ha podido contactar con la IA.' }, 502, ch); }
    const out = await r.json().catch(()=> ({}));
    if (!r.ok){
      const msg = out && out.error && out.error.message || ('código ' + r.status);
      return json({ error:'La IA ha respondido con un error: ' + msg }, 502, ch);
    }
    const text = (out.content || []).filter(b=> b.type === 'text').map(b=> b.text).join('\n').trim();
    return json({ text: text || 'No se ha podido analizar el vídeo.', model, usage: out.usage || null }, 200, ch);
  }
};
