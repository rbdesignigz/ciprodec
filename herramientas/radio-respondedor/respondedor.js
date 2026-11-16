/* CIPRODEC Radio – Respondedor de saludos con personajes.
 *
 * Lee los saludos que mandan los oyentes desde ciprodec.com (colección radioChat de Firebase)
 * y los contesta como el personaje que está "al aire" según la hora (ver personajes.json).
 *
 * - No necesita instalar nada más que Node.js (https://nodejs.org, versión LTS).
 * - Usa la llave privada de Firebase (archivo ciprodec-c-firebase-adminsdk-*.json) que esté
 *   en esta carpeta o en la carpeta de arriba (el Escritorio). Esa llave NO se comparte con nadie.
 * - Si en config.json se pone una clave de la API de Claude (anthropicApiKey), los personajes
 *   responden con inteligencia artificial; si no, usan las frases de personajes.json.
 *
 * Se inicia con iniciar.bat. Para cortarlo: cerrar la ventana o Ctrl+C.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const PROYECTO = 'ciprodec-c';
const COL = 'radioChat';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;
const ESTADO = path.join(DIR, 'estado.json');
const LOG = path.join(DIR, 'respondedor.log');

/* ---------- utilidades ---------- */
function log(...a) {
  const linea = new Date().toLocaleString('es-PY') + '  ' + a.join(' ');
  console.log(linea);
  try { fs.appendFileSync(LOG, linea + '\n'); } catch (e) { }
}
function leerJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
const azar = arr => arr[Math.floor(Math.random() * arr.length)];

const CONFIG = Object.assign({
  cadaSegundos: 8,          // cada cuánto revisa si hay saludos nuevos
  demoraMin: 4,             // segundos mínimos antes de responder (para que parezca natural)
  demoraMax: 12,
  responderUltimosMinutos: 30, // al arrancar, responde saludos sin contestar de los últimos N minutos
  anthropicApiKey: '',
  modeloIA: 'claude-haiku-5-5',
  whatsapp: '+595 986 573190'
}, leerJSON(path.join(DIR, 'config.json'), {}));
if (process.env.ANTHROPIC_API_KEY && !CONFIG.anthropicApiKey) CONFIG.anthropicApiKey = process.env.ANTHROPIC_API_KEY;

/* ---------- llave de Firebase ---------- */
function buscarLlave() {
  const lugares = [DIR, path.dirname(DIR)];
  let mejor = null;
  for (const d of lugares) {
    let nombres = [];
    try { nombres = fs.readdirSync(d); } catch (e) { continue; }
    for (const n of nombres) {
      if (!/^ciprodec-c-firebase-adminsdk-.*\.json$/i.test(n)) continue;
      const f = path.join(d, n), t = fs.statSync(f).mtimeMs;
      if (!mejor || (d === DIR && path.dirname(mejor.f) !== DIR) || (path.dirname(mejor.f) === d && t > mejor.t)) mejor = { f, t };
    }
  }
  if (!mejor) throw new Error('No encontré la llave de Firebase (ciprodec-c-firebase-adminsdk-....json). Ponela en esta carpeta.');
  const k = JSON.parse(fs.readFileSync(mejor.f, 'utf8'));
  if (!k.private_key || !k.client_email) throw new Error('El archivo de la llave no es válido: ' + path.basename(mejor.f));
  log('Llave de Firebase:', path.basename(mejor.f));
  return k;
}

/* ---------- token de acceso (JWT firmado con la llave) ---------- */
let LLAVE = null, token = null, tokenVence = 0;
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function obtenerToken() {
  if (token && Date.now() < tokenVence - 60000) return token;
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({ iss: LLAVE.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const firma = crypto.createSign('RSA-SHA256').update(cab + '.' + cuerpo).sign(LLAVE.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + cab + '.' + cuerpo + '.' + b64u(firma)
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google no aceptó la llave: ' + (j.error_description || j.error || r.status));
  token = j.access_token; tokenVence = Date.now() + (j.expires_in || 3600) * 1000;
  return token;
}
async function api(url, opciones = {}) {
  const r = await fetch(url, Object.assign({}, opciones, {
    headers: Object.assign({ Authorization: 'Bearer ' + await obtenerToken(), 'Content-Type': 'application/json' }, opciones.headers || {})
  }));
  const txt = await r.text();
  if (!r.ok) throw new Error('Firestore ' + r.status + ': ' + txt.slice(0, 300));
  return txt ? JSON.parse(txt) : {};
}

/* ---------- leer y escribir mensajes ---------- */
function campo(v) {
  if (!v) return '';
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('integerValue' in v) return Number(v.integerValue);
  return '';
}
async function saludosDesde(desdeISO) {
  const q = { structuredQuery: {
    from: [{ collectionId: COL }],
    where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN', value: { timestampValue: desdeISO } } },
    orderBy: [{ field: { fieldPath: 'ts' }, direction: 'ASCENDING' }],
    limit: 30 } };
  const filas = await api(BASE + ':runQuery', { method: 'POST', body: JSON.stringify(q) });
  return filas.filter(f => f.document).map(f => {
    const d = f.document.fields || {};
    return { id: f.document.name.split('/').pop(), tipo: campo(d.tipo), nombre: campo(d.nombre), ciudad: campo(d.ciudad),
      texto: campo(d.texto), ts: campo(d.ts) };
  });
}
async function publicarRespuesta(autor, texto) {
  /* ts con la hora del servidor, igual que los saludos de la web */
  await api(BASE.replace('/documents', '/documents:commit'), { method: 'POST', body: JSON.stringify({ writes: [{
    update: { name: `projects/${PROYECTO}/databases/(default)/documents/${COL}/${crypto.randomBytes(10).toString('hex')}`,
      fields: { tipo: { stringValue: 'radio' }, autor: { stringValue: autor.slice(0, 40) }, texto: { stringValue: texto.slice(0, 400) } } },
    updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }]
  }] }) });
}

/* ---------- personajes ---------- */
function personajes() { return leerJSON(path.join(DIR, 'personajes.json'), { personajes: [] }).personajes || []; }
function alAire(ahora = new Date()) {
  const h = ahora.getHours() + ahora.getMinutes() / 60, dia = ahora.getDay(); // 0 = domingo
  const lista = personajes();
  const enHora = p => (p.dias || [0, 1, 2, 3, 4, 5, 6]).includes(dia) &&
    (p.desde <= p.hasta ? h >= p.desde && h < p.hasta : h >= p.desde || h < p.hasta);
  return lista.find(enHora) || lista[0] || { nombre: 'CIPRODEC Radio', frases: { saludo: ['¡Gracias por escribir, {nombre}!'] } };
}
const FEAS = /\b(put[ao]s?|mierda|pelotud[oa]|boludo|idiota|tarad[oa]|forro|concha|verga|caralho|porra|merda)\b/i;
const ESPORTU = /\b(obrigad|você|voce|olá|ola\b|bom dia|boa tarde|boa noite|abraço|muito|legal|rádio)\b/i;
function tipoDeMensaje(t) {
  const s = (t || '').toLowerCase();
  if (/\b(tema|canci[oó]n|m[uú]sica|pas[aá]|pon[eé]|quiero escuchar|pedido|toc[aá]|polca|guarania|chamam[eé]|m[uú]sica)\b/.test(s)) return 'pedido';
  if (/\b(obra|presupuesto|constru|plano|casa|edific|c[aá]lculo|estructura|terreno|arquitect|ingenier|bim|revit|suelo|cotiz)/.test(s)) return 'servicios';
  return 'saludo';
}
function momento(d = new Date()) { const h = d.getHours(); return h < 12 ? 'buen día' : h < 19 ? 'buenas tardes' : 'buenas noches'; }
function rellenar(f, m) {
  return f.replace(/\{nombre\}/g, m.nombre || 'amigo').replace(/\{ciudad\}/g, m.ciudad || 'la Triple Frontera')
    .replace(/\{momento\}/g, momento()).replace(/\{whatsapp\}/g, CONFIG.whatsapp)
    .replace(/\{desde\}/g, m.ciudad ? ' desde ' + m.ciudad : '');
}
function respuestaFrases(p, m) {
  const k = tipoDeMensaje(m.texto), fr = p.frases || {};
  const pt = ESPORTU.test(m.texto) && fr.portugues && fr.portugues.length;
  const t = rellenar(azar(pt ? fr.portugues : (fr[k] && fr[k].length ? fr[k] : fr.saludo)), m);
  return pt ? t.replace(/ desde /g, ' de ') : t;
}
async function respuestaIA(p, m) {
  const sistema = `Sos ${p.nombre}, conductor/a virtual de CIPRODEC Radio, la radio online de CIPRODEC (Centro Integral de Profesionales de la Construcción, Hernandarias, Paraguay, Triple Frontera). ${p.personalidad || ''}
Respondé al saludo de un oyente en el chat de la radio. Reglas:
- Máximo 2 oraciones y 280 caracteres. Tono cálido, cercano, rioplatense/paraguayo (vos). Si el oyente escribe en portugués, respondé en portugués.
- Saludá por el nombre y, si dice la ciudad, mencionala.
- Si pide un tema, decile que lo anotás para la lista (no prometas horario exacto).
- Si pregunta por obras, planos, cálculo, presupuestos o servicios, invitalo a escribir al WhatsApp de CIPRODEC ${CONFIG.whatsapp}.
- No inventes datos, precios, noticias ni promesas. No hables de política ni religión. No digas que sos una IA salvo que te lo pregunten directamente; si te lo preguntan, decí la verdad: que sos la conducción virtual de la radio.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': CONFIG.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.modeloIA, max_tokens: 200, system: sistema,
      messages: [{ role: 'user', content: `Oyente: ${m.nombre || 'anónimo'}${m.ciudad ? ' (' + m.ciudad + ')' : ''}\nMensaje: ${m.texto}` }] })
  });
  const j = await r.json();
  const t = j && j.content && j.content[0] && j.content[0].text;
  if (!t) throw new Error('IA sin respuesta: ' + JSON.stringify(j).slice(0, 200));
  return t.trim().replace(/^["“]|["”]$/g, '');
}

/* ---------- ciclo principal ---------- */
let estado = leerJSON(ESTADO, {});
const respondidos = new Set(estado.respondidos || []);
function guardarEstado() {
  estado.respondidos = [...respondidos].slice(-300);
  try { fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2)); } catch (e) { log('No pude guardar estado:', e.message); }
}

async function revisar() {
  const desde = estado.ultimoTs || new Date(Date.now() - CONFIG.responderUltimosMinutos * 60000).toISOString();
  const msgs = await saludosDesde(desde);
  if (!msgs.length) return;
  /* si ya hay una respuesta de la radio después de un saludo, ese saludo se considera respondido (por ejemplo, a mano) */
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    estado.ultimoTs = m.ts;
    if (m.tipo !== 'oyente' || respondidos.has(m.id)) continue;
    if (FEAS.test((m.texto || '') + ' ' + (m.nombre || ''))) { log('Ignorado (lenguaje):', m.nombre, '-', m.texto); respondidos.add(m.id); continue; }
    const p = alAire();
    let texto;
    if (CONFIG.anthropicApiKey) {
      try { texto = await respuestaIA(p, m); } catch (e) { log('IA no disponible, uso frases:', e.message); }
    }
    if (!texto) texto = respuestaFrases(p, m);
    await esperar((CONFIG.demoraMin + Math.random() * (CONFIG.demoraMax - CONFIG.demoraMin)) * 1000);
    await publicarRespuesta(p.nombre, texto);
    respondidos.add(m.id);
    log(`${m.nombre}${m.ciudad ? ' (' + m.ciudad + ')' : ''}: ${m.texto}`);
    log(`   → ${p.nombre}: ${texto}`);
    guardarEstado();
  }
  guardarEstado();
}

async function main() {
  console.log('==============================================');
  console.log('  CIPRODEC Radio - Respondedor de saludos');
  console.log('  Dejá esta ventana abierta. Para cortar: cerrala.');
  console.log('==============================================');
  LLAVE = buscarLlave();
  await obtenerToken();
  const p = alAire();
  log('Conectado a Firebase. Al aire ahora:', p.nombre, CONFIG.anthropicApiKey ? '(con IA)' : '(con frases)');
  let errores = 0;
  for (;;) {
    try { await revisar(); errores = 0; }
    catch (e) { errores++; log('Error:', e.message); if (errores > 5) await esperar(60000); }
    await esperar(CONFIG.cadaSegundos * 1000);
  }
}

if (require.main === module) main().catch(e => { log('No se pudo iniciar:', e.message); process.exitCode = 1; });
module.exports = { alAire, respuestaFrases, tipoDeMensaje, rellenar, buscarLlave, saludosDesde, publicarRespuesta, _set: o => Object.assign(CONFIG, o) };
