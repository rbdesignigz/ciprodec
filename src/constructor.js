/* CIPRODEC – Portal de constructores (constructor.html).
   La constructora entra con un código (id del documento en "constructores") sin cuenta.
   Cada presupuesto vive en "presupuestos/{id}" con un id aleatorio que solo figura en su constructora.
   El personal de CIPRODEC (admin/editor con sesión iniciada en cliente.html) crea constructoras y presupuestos.
   Las reglas de Firestore (firestore.rules) permiten a quien tiene el código leer y cambiar solo precios y ajustes. */
import * as D from './datos.js';

const $ = id => document.getElementById(id), esc = D.esc;
const LS = 'ciprodec-constructor';
const fmt = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 });
const gs = n => (n == null || isNaN(n)) ? '—' : fmt.format(Math.round(n));
/* ---------- moneda de visualización (Gs, US$, R$) ---------- */
const SIM = { GS: 'Gs', USD: 'US$', BRL: 'R$' };
let mon = (() => { try { return localStorage.getItem('ciprodec-moneda') || 'GS'; } catch (e) { return 'GS'; } })();
function cot(m) { const p = (pres && pres.parametros) || {}; const v = Number(m === 'USD' ? p.cotUSD : m === 'BRL' ? p.cotBRL : 1); return v > 0 ? v : 0; }
function monAct() { return mon !== 'GS' && cot(mon) ? mon : 'GS'; }
const fmtD = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });
function enMon(n, m) { if (n == null || isNaN(n)) return '—'; m = m || monAct(); if (m === 'GS') return gs(n); const v = n / cot(m); return fmtD.format(Math.round(v)); }
const mn = n => enMon(n);
const M = n => SIM[monAct()] + ' ' + enMon(n);
const esNum = v => typeof v === 'number' && isFinite(v);
const params = new URLSearchParams(location.search);

let codigo = null, constr = null, pres = null, staff = false, timer = null, guardando = false;

/* ---------- números ---------- */
function leerPrecio(s) {
  const t = String(s || '').replace(/[^\d]/g, '');
  return t ? parseInt(t, 10) : null;
}
function leerCant(s) {
  let t = String(s || '').trim();
  if (!t) return null;
  t = t.replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

/* ---------- cálculo ---------- */
function par() { return Object.assign({ jornalOficial: 200000, jornalAyudante: 120000, jornalCapataz: 250000, cargas: 0 }, pres.parametros || {}); }
function refMO(it) {
  const p = par(), k = 1 + (esNum(p.cargas) ? p.cargas : 0) / 100;
  if (it.capataz) return Math.round(p.jornalCapataz * k);
  if (!esNum(it.hhOf) || !esNum(it.hhAy)) return null;
  return Math.round((it.hhOf * p.jornalOficial + it.hhAy * p.jornalAyudante) / 8 * k);
}
function calc(it) {
  if (it.tipo === 'mat') {
    const ps = (it.p || []).filter(esNum);
    const precio = ps.length ? Math.min(...ps) : (esNum(it.ref) ? it.ref : null);
    const estado = !esNum(it.cant) ? 'cant' : ps.length ? 'ok' : esNum(it.ref) ? 'ref' : 'sin';
    let prov = '';
    if (ps.length) prov = nombresProv()[(it.p || []).indexOf(Math.min(...ps))] || '';
    return { precio, estado, prov, total: esNum(it.cant) && esNum(precio) ? it.cant * precio : 0 };
  }
  const r = refMO(it);
  const precio = esNum(it.pb) ? it.pb : r;
  const estado = !esNum(it.cant) ? 'cant' : esNum(it.pb) ? 'ok' : esNum(r) ? 'ref' : 'sin';
  return { precio, ref: r, estado, total: esNum(it.cant) && esNum(precio) ? it.cant * precio : 0 };
}
function nombresProv() { const p = pres.proveedores || []; return [0, 1, 2].map(i => p[i] || 'Proveedor ' + (i + 1)); }
function resumen(p) {
  const prev = pres; pres = p;
  const r = { mat: 0, mo: 0, falta: 0, n: 0, rub: {} };
  for (const it of p.items || []) {
    const c = calc(it), k = it.rubro;
    const x = r.rub[k] || (r.rub[k] = { mat: 0, mo: 0, falta: 0 });
    if (it.tipo === 'mat') { r.mat += c.total; x.mat += c.total; } else { r.mo += c.total; x.mo += c.total; }
    if (c.estado !== 'ok') { r.falta++; x.falta++; }
    r.n++;
  }
  r.total = r.mat + r.mo;
  pres = prev;
  return r;
}
const ESTADOS = { ok: ['Cargado', 'ok'], ref: ['Falta · usa ref.', 'ref'], sin: ['Falta precio', 'sin'], cant: ['Falta cantidad', 'sin'] };

/* ---------- vistas ---------- */
function ver(v) {
  ['vCodigo', 'vLista', 'vPres'].forEach(x => $(x).hidden = x !== v);
  const ph = document.querySelector('.pagehead'); if (ph) ph.hidden = v === 'vPres';
  window.scrollTo(0, 0);
}
function msg(el, t, tipo) { const m = $(el); m.hidden = !t; m.className = 'aviso ' + (tipo || 'info'); m.textContent = t || ''; }

async function entrar(c, recordar) {
  c = String(c || '').trim().toUpperCase();
  if (!c) return;
  msg('msgCodigo', '');
  let d = null;
  try { d = await D.obtener('constructores', c); } catch (e) { msg('msgCodigo', D.mensajeError(e), 'err'); ver('vCodigo'); return false; }
  if (!d) { msg('msgCodigo', 'El código no es válido. Revisalo o pedilo a CIPRODEC por WhatsApp.', 'err'); ver('vCodigo'); return false; }
  codigo = c; constr = d;
  if (recordar) { try { localStorage.setItem(LS, c); } catch (e) { } }
  await pintarLista();
  return true;
}

async function pintarLista() {
  $('lConst').textContent = (constr.perfil && constr.perfil.nombre) || constr.nombre || '';
  const box = $('lPres'); ver('vLista');
  const lista = constr.presupuestos || [];
  if (!lista.length) { box.innerHTML = '<div class="aviso info">Todavía no hay presupuestos cargados para tu empresa. CIPRODEC te avisa cuando esté el primero.</div>'; return; }
  box.innerHTML = '<p class="vacio">Cargando…</p>';
  const docs = await Promise.all(lista.map(x => D.obtener('presupuestos', x.id).catch(() => null)));
  box.innerHTML = lista.map((x, i) => {
    const p = docs[i];
    if (!p) return '';
    const r = resumen(p), av = r.n ? Math.round((r.n - r.falta) / r.n * 100) : 0;
    return '<button type="button" class="pc-card" data-id="' + esc(x.id) + '">' +
      '<span class="eyebrow">' + esc(p.cliente || '') + '</span><b>' + esc(p.obra || x.obra || 'Presupuesto') + '</b>' +
      '<span class="pc-big">Gs ' + gs(r.total) + '</span>' +
      '<span class="pc-bar"><i style="width:' + av + '%"></i></span><span class="pc-sm">' + av + '% cargado · faltan ' + r.falta + ' ítems</span></button>';
  }).join('') || '<div class="aviso info">No se encontraron los presupuestos.</div>';
}

async function abrir(id) {
  let p = null;
  try { p = await D.obtener('presupuestos', id); } catch (e) { alert(D.mensajeError(e)); return; }
  if (!p) { alert('No se encontró el presupuesto.'); return; }
  pres = p;
  $('pObra').textContent = p.obra || '';
  $('pCliente').textContent = [p.constructora, p.cliente ? 'Cliente: ' + p.cliente : ''].filter(Boolean).join(' · ');
  estadoGuardado(p.actualizado ? 'Actualizado ' + cuando(p.actualizado) : '');
  ver('vPres'); tab('rubros');
  history.replaceState(null, '', location.pathname + '?' + (D.modo === 'demo' ? 'demo&' : '') + 'p=' + encodeURIComponent(id));
}
function cuando(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-PY') + ' ' + d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }); }

/* ---------- presupuesto ---------- */
function kpis() {
  const r = resumen(pres), av = r.n ? Math.round((r.n - r.falta) / r.n * 100) : 0;
  $('pKpis').innerHTML =
    barraMoneda() +
    '<div class="pc-kpi main"><span>Costo total de la obra</span><b>' + M(r.total) + '</b>' + equivalencias(r.total) + '</div>' +
    '<div class="pc-kpi"><span>Materiales</span><b>' + M(r.mat) + '</b></div>' +
    '<div class="pc-kpi"><span>Mano de obra</span><b>' + M(r.mo) + '</b></div>' +
    '<div class="pc-kpi"><span>Cargado</span><b>' + av + '%</b><span class="pc-bar"><i style="width:' + av + '%"></i></span><span class="pc-sm">Faltan ' + r.falta + ' de ' + r.n + '</span></div>';
  $('tFalta').textContent = r.falta ? '(' + r.falta + ')' : '';
  return r;
}
function chip(e) { const x = ESTADOS[e]; return '<span class="pc-chip ' + x[1] + '">' + x[0] + '</span>'; }
function filaItem(it) {
  const c = calc(it), cantTxt = esNum(it.cant) ? fmt1.format(it.cant) + ' ' + esc(it.unid || '') : '';
  const cantIn = !esNum(it.cant) || staff;
  let h = '<div class="pc-it" data-id="' + esc(it.id) + '"><div class="pc-d"><b>' + esc(it.desc) + '</b>' +
    (it.esp ? '<span class="pc-sm">' + esc(it.esp) + '</span>' : '') +
    (it.tipo !== 'mat' && esNum(it.hhOf) ? '<span class="pc-sm pc-hh">Rendimiento por ' + esc(it.unid || 'u') + ': oficial ' + fmt1.format(it.hhOf) + ' h + ayudante ' + fmt1.format(it.hhAy) + ' h' +
      (esNum(it.cant) ? '<br>Horas totales: ' + fmt.format(it.cant * it.hhOf) + ' h oficial · ' + fmt.format(it.cant * it.hhAy) + ' h ayudante' : '') + '</span>' : '') +
    (cantIn ? '<label class="pc-in pc-cant">Cantidad (' + esc(it.unid || '') + ')<input data-f="cant" inputmode="decimal" value="' + (esNum(it.cant) ? fmt1.format(it.cant) : '') + '" placeholder="cargar"></label>'
      : '<span class="pc-sm">Cantidad: ' + cantTxt + '</span>') +
    (it.nota ? '<span class="pc-sm pc-nt">' + esc(it.nota) + '</span>' : '') + '</div><div class="pc-ps">';
  if (it.tipo === 'mat') {
    const np = nombresProv();
    h += [0, 1, 2].map(i => '<label class="pc-in">' + esc(np[i]) + '<input data-f="p' + i + '" inputmode="numeric" value="' + (esNum((it.p || [])[i]) ? fmt.format(it.p[i]) : '') + '" placeholder="Gs/' + esc(it.unid || 'u') + '"></label>').join('');
    if (esNum(it.ref)) h += '<span class="pc-sm">Ref. CIPRODEC: Gs ' + gs(it.ref) + '</span>';
  } else {
    h += '<label class="pc-in">Precio Bronce Gs/' + esc(it.unid || 'u') + '<input data-f="pb" inputmode="numeric" value="' + (esNum(it.pb) ? fmt.format(it.pb) : '') + '" placeholder="cargar"></label>';
    if (esNum(c.ref)) h += '<span class="pc-sm">Ref. CIPRODEC: Gs ' + gs(c.ref) + '/' + esc(it.unid || 'u') + '</span>';
  }
  h += '</div><div class="pc-t"><span class="pc-sm" data-o="pu">' + (esNum(c.precio) ? 'Gs ' + gs(c.precio) + '/' + esc(it.unid || 'u') + (c.prov ? ' · ' + esc(c.prov) : '') : '') + '</span><b data-o="tot">Gs ' + gs(c.total) + '</b><span data-o="chip">' + chip(c.estado) + '</span></div></div>';
  return h;
}
/* ---------- vista por rubro: rubro > ítems con columnas Material / Mano de obra / Total ---------- */
let abierto = null; /* 'cod|mat' o 'cod|mo' */
const rubAbiertos = new Set();
const actDe = it => it.act || it.rubro;
function actividades() {
  if (Array.isArray(pres.actividades) && pres.actividades.length) return pres.actividades;
  const vistos = {}, out = [];
  for (const it of pres.items || []) { const c = actDe(it); if (!vistos[c]) { vistos[c] = 1; out.push({ cod: c, rubro: it.rubro, desc: it.tipo === 'mo' ? it.desc : it.rubro }); } }
  return out;
}
function sumas() {
  const A = {}, R = {}, T = { mat: 0, mo: 0 };
  for (const it of pres.items || []) {
    const c = calc(it), k = actDe(it), t = it.tipo === 'mat' ? 'mat' : 'mo';
    const a = A[k] || (A[k] = { mat: 0, mo: 0, fmat: 0, fmo: 0, nmat: 0, nmo: 0 });
    const r = R[it.rubro] || (R[it.rubro] = { mat: 0, mo: 0, falta: 0 });
    a[t] += c.total; a['n' + t]++; r[t] += c.total; T[t] += c.total;
    if (c.estado !== 'ok') { a['f' + t]++; r.falta++; }
  }
  return { A, R, T };
}
function celda(cod, t, a) {
  const n = a ? a['n' + t] : 0;
  if (!n) return '<span class="pc-cell vacia"><small>' + (t === 'mat' ? 'Material' : 'Mano de obra') + '</small>—</span>';
  const f = a['f' + t], ab = abierto === cod + '|' + t;
  return '<button type="button" class="pc-cell' + (ab ? ' abierta' : '') + '" data-open="' + esc(cod) + '|' + t + '" aria-expanded="' + ab + '">' +
    '<small>' + (t === 'mat' ? 'Material' : 'Mano de obra') + '</small><span><b data-as="' + esc(cod) + '|' + t + '">' + M(a[t]) + '</b> <i class="pc-flecha">' + (ab ? '▴' : '▾') + '</i></span>' +
    '<em class="pc-falta" data-af="' + esc(cod) + '|' + t + '">' + (f ? 'falta ' + f : '') + '</em></button>';
}
function detalle(cod, t) {
  const its = (pres.items || []).filter(i => actDe(i) === cod && (t === 'mat' ? i.tipo === 'mat' : i.tipo !== 'mat'));
  const act = actividades().find(x => x.cod === cod) || { desc: cod };
  return '<div class="pc-dettit">' + (t === 'mat' ? 'Materiales' : 'Mano de obra') + ' · ' + esc(act.desc) +
    '<button type="button" class="pc-cerrar" data-open="' + esc(cod) + '|' + t + '">Cerrar ✕</button></div>' + its.map(filaItem).join('');
}
function pintarRubros() {
  kpis();
  const S = sumas();
  let h = '<div class="pc-tools"><span class="pc-sm">Tocá un rubro para ver sus ítems.</span><span><button type="button" class="pc-lnk" data-todos="1">Abrir todos</button> · <button type="button" class="pc-lnk" data-todos="0">Cerrar todos</button></span></div>' +
    '<div class="pc-tabla"><div class="pc-th"><span>Rubro / ítem</span><span>Material</span><span>Mano de obra</span><span>Total</span></div>';
  for (const rb of pres.rubros || []) {
    const acts = actividades().filter(a => a.rubro === rb);
    if (!acts.length) continue;
    const r = S.R[rb] || { mat: 0, mo: 0, falta: 0 };
    const rab = rubAbiertos.has(rb);
    h += '<div class="pc-rrow pc-rclick' + (rab ? ' abierto' : '') + '" data-rub="' + esc(rb) + '" role="button" tabindex="0" aria-expanded="' + rab + '"><span class="pc-rn"><i class="pc-chev">' + (rab ? '▾' : '▸') + '</i>' + esc(rb) + '<em class="pc-falta" data-rf="' + esc(rb) + '">' + (r.falta ? 'faltan ' + r.falta : '✓') + '</em></span>' +
      '<span><small>Material</small>' + SIM[monAct()] + ' <i data-rs="' + esc(rb) + '|mat">' + mn(r.mat) + '</i></span><span><small>Mano de obra</small>' + SIM[monAct()] + ' <i data-rs="' + esc(rb) + '|mo">' + mn(r.mo) + '</i></span>' +
      '<span class="pc-tot"><small>Total rubro</small><span>' + SIM[monAct()] + ' <i data-rs="' + esc(rb) + '|tot">' + mn(r.mat + r.mo) + '</i></span></span></div>';
    if (!rab) continue;
    for (const a of acts) {
      const x = S.A[a.cod];
      const ab = abierto && abierto.split('|')[0] === a.cod;
      h += '<div class="pc-arow" data-act="' + esc(a.cod) + '"><span class="pc-an"><small>' + esc(a.cod) + '</small> ' + esc(a.desc) + '</span>' +
        celda(a.cod, 'mat', x) + celda(a.cod, 'mo', x) +
        '<span class="pc-tot"><small>Total</small><b data-as="' + esc(a.cod) + '|tot">' + M(x ? x.mat + x.mo : 0) + '</b></span></div>' +
        '<div class="pc-det" data-det="' + esc(a.cod) + '"' + (ab ? '' : ' hidden') + '>' + (ab ? detalle(a.cod, abierto.split('|')[1]) : '') + '</div>';
    }
  }
  h += '<div class="pc-rrow pc-gran"><span class="pc-rn">Total de la obra</span><span><small>Material</small>' + SIM[monAct()] + ' <i data-rs="*|mat">' + mn(S.T.mat) + '</i></span><span><small>Mano de obra</small>' + SIM[monAct()] + ' <i data-rs="*|mo">' + mn(S.T.mo) + '</i></span><span class="pc-tot"><small>Total</small><span>' + SIM[monAct()] + ' <i data-rs="*|tot">' + mn(S.T.mat + S.T.mo) + '</i></span></span></div></div>';
  $('tabRubros').innerHTML = h;
}
function toggleRubro(rb) {
  if (rubAbiertos.has(rb)) { rubAbiertos.delete(rb); if (abierto && (actividades().find(a => a.cod === abierto.split('|')[0]) || {}).rubro === rb) abierto = null; }
  else rubAbiertos.add(rb);
  pintarRubros();
}
$('tabRubros').addEventListener('keydown', e => { const r = e.target.closest('[data-rub]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRubro(r.dataset.rub); } });
$('tabRubros').addEventListener('click', e => {
  const t = e.target.closest('[data-todos]');
  if (t) { if (t.dataset.todos === '1') (pres.rubros || []).forEach(r => rubAbiertos.add(r)); else { rubAbiertos.clear(); abierto = null; } pintarRubros(); return; }
  const r = e.target.closest('[data-rub]'); if (r) { toggleRubro(r.dataset.rub); return; }
  const b = e.target.closest('[data-open]'); if (!b) return;
  const k = b.dataset.open, cod = k.split('|')[0];
  abierto = abierto === k ? null : k;
  pintarRubros();
  const fila = document.querySelector('.pc-arow[data-act="' + CSS.escape(cod) + '"]');
  if (fila && abierto) { const y = fila.getBoundingClientRect().top + window.scrollY - 140; if (fila.getBoundingClientRect().top < 120) window.scrollTo(0, y); }
});
function actualizarSumas() {
  const S = sumas();
  document.querySelectorAll('[data-as]').forEach(el => {
    const [c, t] = el.dataset.as.split('|'), x = S.A[c] || { mat: 0, mo: 0 };
    el.textContent = M(t === 'tot' ? x.mat + x.mo : x[t]);
  });
  document.querySelectorAll('[data-af]').forEach(el => { const [c, t] = el.dataset.af.split('|'), x = S.A[c]; el.textContent = x && x['f' + t] ? 'falta ' + x['f' + t] : ''; });
  document.querySelectorAll('[data-rs]').forEach(el => {
    const [r, t] = el.dataset.rs.split('|'), x = r === '*' ? S.T : (S.R[r] || { mat: 0, mo: 0 });
    el.textContent = mn(t === 'tot' ? x.mat + x.mo : x[t]);
  });
  document.querySelectorAll('[data-rf]').forEach(el => { const x = S.R[el.dataset.rf]; el.textContent = x && x.falta ? 'faltan ' + x.falta : '✓'; });
}
function pintarFalta() {
  kpis();
  const falta = (pres.items || []).filter(it => calc(it).estado !== 'ok');
  if (!falta.length) { $('tabFalta').innerHTML = '<div class="aviso ok">¡Está todo cargado! El presupuesto está completo.</div>'; return; }
  const porRub = (pres.rubros || []).map(rb => [rb, falta.filter(i => i.rubro === rb)]).filter(x => x[1].length);
  let h = '<div class="pc-fresumen"><b>Resumen de lo que falta</b>' + porRub.map(([rb, its], i) => {
      const m = its.filter(x => x.tipo === 'mat').length, w = its.length - m;
      return '<a href="#" data-ir="fr' + i + '"><span>' + esc(rb) + '</span><em>' + [m ? m + ' material' + (m > 1 ? 'es' : '') : '', w ? w + ' mano de obra' : ''].filter(Boolean).join(' · ') + '</em></a>';
    }).join('') + '</div>' +
    '<p class="pc-nota">Cargá acá lo que falta: cada precio que escribís se guarda en el presupuesto general. Lo cargado queda en verde hasta que cambies de pestaña.</p>';
  porRub.forEach(([rb, its], i) => { h += '<div class="pc-sec" id="fr' + i + '"><h4>' + esc(rb) + '</h4>' + its.map(filaItem).join('') + '</div>'; });
  $('tabFalta').innerHTML = h;
}
$('tabFalta').addEventListener('click', e => {
  const a = e.target.closest('[data-ir]'); if (!a) return; e.preventDefault();
  const el = $(a.dataset.ir); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140);
});
const COLORES = ['#2F6FD0', '#E8A33A', '#2E9E5B', '#8E44AD', '#17A2B8', '#C2185B', '#8D6E63', '#C9B000', '#FF7043', '#5D6D7E', '#26A69A', '#AB47BC'];
function torta(vals, colores, titulo, total, nombres) {
  const T = vals.reduce((x, y) => x + y, 0), R = 90, C = 100;
  let ang = -Math.PI / 2, h = '';
  if (!T) h = '<circle cx="100" cy="100" r="90" fill="#EEE"/>';
  else vals.forEach((v, i) => {
    if (!v) return;
    const f = v / T;
    if (f >= 0.9999) { h += '<circle cx="100" cy="100" r="90" fill="' + colores[i] + '"/>'; return; }
    const a2 = ang + f * 2 * Math.PI, x1 = C + R * Math.cos(ang), y1 = C + R * Math.sin(ang), x2 = C + R * Math.cos(a2), y2 = C + R * Math.sin(a2);
    h += '<path d="M100 100L' + x1.toFixed(2) + ' ' + y1.toFixed(2) + 'A90 90 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + 'Z" fill="' + colores[i] + '" stroke="#fff" stroke-width="2"/>';
    if (f >= 0.06) { const am = (ang + a2) / 2; h += '<text x="' + (C + 58 * Math.cos(am)).toFixed(1) + '" y="' + (C + 58 * Math.sin(am)).toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" class="pc-ptxt">' + (nombres ? '<tspan x="' + (C + 58 * Math.cos(am)).toFixed(1) + '" dy="-0.6em">' + nombres[i] + '</tspan><tspan x="' + (C + 58 * Math.cos(am)).toFixed(1) + '" dy="1.2em">' + Math.round(f * 100) + '%</tspan>' : Math.round(f * 100) + '%') + '</text>'; }
    ang = a2;
  });
  return '<figure class="pc-pie"><figcaption>' + titulo + '</figcaption><svg viewBox="0 0 200 200" role="img" aria-label="' + titulo + '">' + h + '</svg><div class="pc-sm">Total ' + M(total) + '</div></figure>';
}
function pintarEstad() {
  const S = sumas(), T = S.T.mat + S.T.mo || 1;
  const pc = (v, t) => t ? fmt1.format(Math.round(v / t * 1000) / 10) + '%' : '—';
  const barra = (v, t, cls) => '<span class="pc-ebar ' + (cls || '') + '"><i style="width:' + (t ? Math.min(100, v / t * 100) : 0) + '%"></i></span>';
  const rubs = (pres.rubros || []).filter(rb => actividades().some(a => a.rubro === rb));
  const col = rubs.map((_, i) => COLORES[i % COLORES.length]);
  const R = rubs.map(rb => S.R[rb] || { mat: 0, mo: 0 });
  let h = '<div class="pc-sec"><h4>Composición de la obra</h4><div class="pc-pies">' +
    torta([S.T.mat, S.T.mo], ['#2F3439', '#E8262B'], 'Material y mano de obra', S.T.mat + S.T.mo, ['Material', 'Mano de obra']) +
    '<div class="pc-leg2"><div><i style="background:#2F3439"></i><b>Material</b> ' + pc(S.T.mat, T) + '<span class="pc-sm">' + M(S.T.mat) + '</span></div>' +
    '<div><i style="background:#E8262B"></i><b>Mano de obra</b> ' + pc(S.T.mo, T) + '<span class="pc-sm">' + M(S.T.mo) + '</span></div></div></div></div>';
  const maxT = Math.max(1, ...R.map(r => r.mat + r.mo));
  h += '<div class="pc-sec"><h4>Peso de cada rubro en la obra</h4><div class="pc-leg"><span><i class="m"></i>Material</span><span><i class="w"></i>Mano de obra</span></div><div class="pc-barras">' +
    rubs.map((rb, i) => {
      const r = R[i], t = r.mat + r.mo;
      return '<div class="pc-bf"><div class="pc-bl"><b>' + esc(rb) + '</b><span><b>' + pc(t, T) + '</b> de la obra · ' + M(t) + '</span></div>' +
        '<div class="pc-bt"><span class="pc-bb" style="width:' + (t / maxT * 100) + '%">' +
        (r.mat ? '<span class="m" style="width:' + (r.mat / (t || 1) * 100) + '%">' + (r.mat / maxT > 0.18 ? 'Material ' + pc(r.mat, t) : '') + '</span>' : '') +
        (r.mo ? '<span class="w" style="width:' + (r.mo / (t || 1) * 100) + '%">' + (r.mo / maxT > 0.18 ? 'M. de obra ' + pc(r.mo, t) : '') + '</span>' : '') +
        '</span>' + (t ? '' : '<span class="pc-sm">sin precios cargados</span>') + '</div>' +
        (t ? '<div class="pc-bd"><span><i class="m"></i>Material ' + M(r.mat) + ' (' + pc(r.mat, t) + ')</span><span><i class="w"></i>Mano de obra ' + M(r.mo) + ' (' + pc(r.mo, t) + ')</span></div>' : '') +
        '<div class="pc-sm">Del total de la obra: ' + pc(r.mat, S.T.mat) + ' del material y ' + pc(r.mo, S.T.mo) + ' de la mano de obra</div></div>';
    }).join('') + '</div></div>';
  h += '<div class="pc-sec"><h4>Detalle por rubro (orden del presupuesto)</h4><div class="pc-etabla"><div class="pc-eh"><span>Rubro</span><span>Total</span><span>% de la obra</span><span>% del material</span><span>% de la mano de obra</span><span>Material / M. de obra del rubro</span></div>';
  rubs.forEach((rb, i) => {
    const r = R[i], t = r.mat + r.mo;
    h += '<div class="pc-er"><span class="pc-ern">' + esc(rb) + '</span><span class="pc-num"><small>Total</small>' + M(t) + '</span>' +
      '<span><small>% de la obra</small><b>' + pc(t, T) + '</b>' + barra(t, T) + '</span>' +
      '<span><small>% del material</small>' + pc(r.mat, S.T.mat) + barra(r.mat, S.T.mat, 'm') + '</span>' +
      '<span><small>% de la mano de obra</small>' + pc(r.mo, S.T.mo) + barra(r.mo, S.T.mo, 'w') + '</span>' +
      '<span><small>Material / M. de obra</small>' + (t ? '<span class="pc-comp chica"><span class="m" style="width:' + (r.mat / t * 100) + '%"></span><span class="w" style="width:' + (r.mo / t * 100) + '%"></span></span><span class="pc-sm">' + pc(r.mat, t) + ' / ' + pc(r.mo, t) + '</span>' : '<span class="pc-sm">sin precios cargados</span>') + '</span></div>';
  });
  h += '</div><p class="pc-nota">Los porcentajes se recalculan solos cada vez que se cargan precios. Los ítems que todavía no tienen precio no suman.</p></div>';
  $('tabEstad').innerHTML = h;
}
function pintarAjustes() {
  const p = par(), np = nombresProv();
  const campo = (k, lab, v, suf) => '<label class="pc-in">' + lab + '<input data-aj="' + k + '" inputmode="numeric" value="' + (esNum(v) ? fmt.format(v) : '') + '">' + (suf ? '<small>' + suf + '</small>' : '') + '</label>';
  $('tabAjustes').innerHTML = '<div class="pc-sec"><h4>Jornales para la mano de obra de referencia (Gs por día de 8 h)</h4><div class="pc-aj">' +
    campo('jornalOficial', 'Oficial', p.jornalOficial) + campo('jornalAyudante', 'Ayudante', p.jornalAyudante) + campo('jornalCapataz', 'Capataz', p.jornalCapataz) + campo('cargas', 'Cargas sociales (%)', p.cargas, 'aguinaldo, vacaciones, IPS') +
    '</div><p class="pc-nota">La mano de obra de referencia sale de las horas hombre del cómputo de CIPRODEC por estos jornales. Donde cargues tu propio precio por unidad, se usa el tuyo.</p></div>' +
    '<div class="pc-sec"><h4>Proveedores de materiales</h4><div class="pc-aj">' +
    np.map((n, i) => '<label class="pc-in">Proveedor ' + (i + 1) + '<input data-pv="' + i + '" value="' + esc(n) + '"></label>').join('') +
    '</div><p class="pc-nota">Se puede cargar el precio de hasta tres proveedores por material: el presupuesto usa siempre el más barato.</p></div>';
}
function tab(t) {
  document.querySelectorAll('.pc-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $('tabRubros').hidden = t !== 'rubros'; $('tabFalta').hidden = t !== 'falta'; $('tabEstad').hidden = t !== 'estad'; $('tabExport').hidden = t !== 'export'; $('tabAjustes').hidden = t !== 'ajustes';
  if (t === 'rubros') pintarRubros(); else if (t === 'falta') pintarFalta(); else if (t === 'estad') { kpis(); pintarEstad(); } else if (t === 'export') { kpis(); pintarExport(); } else { kpis(); pintarAjustes(); }
}

/* actualizar en el lugar después de cargar un valor, sin perder el foco */
function refrescar(id) {
  kpis();
  document.querySelectorAll('.pc-it[data-id="' + CSS.escape(id) + '"]').forEach(el => {
    const it = pres.items.find(x => x.id === id), c = calc(it);
    el.querySelector('[data-o="tot"]').textContent = 'Gs ' + gs(c.total);
    el.querySelector('[data-o="chip"]').innerHTML = chip(c.estado);
    el.querySelector('[data-o="pu"]').textContent = esNum(c.precio) ? 'Gs ' + gs(c.precio) + '/' + (it.unid || 'u') + (c.prov ? ' · ' + c.prov : '') : '';
    el.classList.toggle('pc-listo', c.estado === 'ok');
  });
  actualizarSumas();
}

/* ---------- guardar ---------- */
function estadoGuardado(t, err) { const g = $('pGuardado'); g.textContent = t || ''; g.classList.toggle('err', !!err); }
function programarGuardado() {
  estadoGuardado('Guardando…');
  clearTimeout(timer); timer = setTimeout(guardarYa, 900);
}
async function guardarYa() {
  clearTimeout(timer); timer = null; guardando = true;
  try {
    pres.actualizadoPor = staff ? 'CIPRODEC' : (constr && constr.nombre) || 'Constructora';
    await D.guardar('presupuestos', pres);
    pres.actualizado = new Date().toISOString();
    estadoGuardado('✓ Guardado ' + cuando(pres.actualizado));
  } catch (e) { estadoGuardado('No se pudo guardar: ' + D.mensajeError(e), true); }
  guardando = false;
}
window.addEventListener('beforeunload', e => { if (timer) { guardarYa(); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !pres || timer || guardando || $('vPres').hidden) return;
  const p = await D.obtener('presupuestos', pres.id).catch(() => null);
  if (p && p.actualizado && p.actualizado !== pres.actualizado) {
    pres = p; const t = document.querySelector('.pc-tabs [aria-selected="true"]'); tab(t ? t.dataset.tab : 'rubros');
    estadoGuardado('Actualizado ' + cuando(p.actualizado));
  }
});

$('vPres').addEventListener('change', e => {
  const inp = e.target;
  if (inp.dataset.f) {
    const id = inp.closest('.pc-it').dataset.id, it = pres.items.find(x => x.id === id), f = inp.dataset.f;
    if (f === 'cant') { it.cant = leerCant(inp.value); inp.value = esNum(it.cant) ? fmt1.format(it.cant) : ''; }
    else if (f === 'pb') { it.pb = leerPrecio(inp.value); inp.value = esNum(it.pb) ? fmt.format(it.pb) : ''; it.fecha = new Date().toISOString().slice(0, 10); }
    else { const i = +f.slice(1); it.p = it.p || [null, null, null]; it.p[i] = leerPrecio(inp.value); inp.value = esNum(it.p[i]) ? fmt.format(it.p[i]) : ''; it.fecha = new Date().toISOString().slice(0, 10); }
    refrescar(id); programarGuardado();
  } else if (inp.dataset.aj) {
    pres.parametros = par(); pres.parametros[inp.dataset.aj] = leerPrecio(inp.value) || 0;
    inp.value = fmt.format(pres.parametros[inp.dataset.aj]); kpis(); programarGuardado();
  } else if (inp.dataset.pv != null) {
    pres.proveedores = nombresProv(); pres.proveedores[+inp.dataset.pv] = inp.value.trim() || 'Proveedor ' + (+inp.dataset.pv + 1); programarGuardado();
  }
});
$('vPres').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });
document.querySelector('.pc-tabs').onclick = e => { const b = e.target.closest('button[data-tab]'); if (b) tab(b.dataset.tab); };

/* ---------- CSV ---------- */
$('bCsv').onclick = () => {
  const np = nombresProv(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const n = v => esNum(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
  const L = [['Tipo', 'Rubro', 'Descripción', 'Unidad', 'Cantidad', np[0], np[1], np[2], 'Precio Bronce (MO)', 'Precio ref. CIPRODEC', 'Precio usado', 'Total Gs', 'Estado'].map(q).join(';')];
  for (const it of pres.items || []) {
    const c = calc(it), p = it.p || [];
    L.push([it.tipo === 'mat' ? 'Material' : 'Mano de obra', it.rubro, it.desc, it.unid, n(it.cant), n(p[0]), n(p[1]), n(p[2]), n(it.pb), n(it.tipo === 'mat' ? it.ref : c.ref), n(c.precio), n(c.total), ESTADOS[c.estado][0]].map(q).join(';'));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = D.slug(pres.obra || 'presupuesto') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};


/* ---------- datos de la empresa (logo y datos para imprimir) ---------- */
let logoNuevo;
function perfil() { return Object.assign({ nombre: constr ? constr.nombre : '' }, (constr && constr.perfil) || {}); }
function llenarDatos() {
  const p = perfil();
  $('dNombre').value = p.nombre || ''; $('dRuc').value = p.ruc || ''; $('dTel').value = p.tel || ''; $('dEmail').value = p.email || '';
  $('dDir').value = p.dir || ''; $('dResp').value = p.resp || ''; $('dCond').value = p.condiciones || '';
  logoNuevo = p.logo || ''; mostrarLogo(); $('dMsg').textContent = '';
}
function mostrarLogo() { $('dLogoImg').hidden = !logoNuevo; $('dLogoImg').src = logoNuevo || ''; $('dLogoQuitar').hidden = !logoNuevo; }
function achicarLogo(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('No se pudo leer la imagen'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Formato de imagen no válido'));
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.88));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
$('bDatos').onclick = () => { const f = $('fDatos'); f.hidden = !f.hidden; if (!f.hidden) { llenarDatos(); f.scrollIntoView({ block: 'start' }); } };
$('dCancelar').onclick = () => { $('fDatos').hidden = true; };
$('dLogo').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { logoNuevo = await achicarLogo(f); mostrarLogo(); } catch (er) { $('dMsg').textContent = er.message; } e.target.value = ''; };
$('dLogoQuitar').onclick = () => { logoNuevo = ''; mostrarLogo(); };
$('fDatos').onsubmit = async e => {
  e.preventDefault(); $('dMsg').textContent = 'Guardando…'; $('dMsg').classList.remove('err');
  constr.perfil = { nombre: $('dNombre').value.trim(), ruc: $('dRuc').value.trim(), tel: $('dTel').value.trim(), email: $('dEmail').value.trim(),
    dir: $('dDir').value.trim(), resp: $('dResp').value.trim(), condiciones: $('dCond').value.trim(), logo: logoNuevo || '' };
  try { await D.guardar('constructores', Object.assign({}, constr, { id: codigo })); $('dMsg').textContent = '✓ Guardado'; }
  catch (er) { $('dMsg').textContent = 'No se pudo guardar: ' + D.mensajeError(er); $('dMsg').classList.add('err'); }
};

/* ---------- imprimir el presupuesto con los datos de la constructora ---------- */
function cierre() { return Object.assign({ fecha: new Date().toISOString().slice(0, 10), validez: 15, gg: 0, ben: 0, iva: 10, incluir: true, detalle: 'resumen', numero: '', obs: '' }, pres.cierre || {}); }
function cliente() { return Object.assign({ nombre: pres.cliente || '', contacto: '' }, pres.clienteDatos || {}); }
function pintarExport() {
  const c = cierre(), cl = cliente(), r = resumen(pres), sinB = (pres.items || []).filter(it => calc(it).estado !== 'ok').length;
  const pf = perfil();
  $('tabExport').innerHTML =
    (sinB ? '<div class="aviso info" style="margin-bottom:12px">Hay <b>' + sinB + ' ítems</b> sin precio propio: en el presupuesto impreso salen con el precio de referencia (o en cero si no tienen). Revisalos en "Falta cargar" antes de entregar.</div>' : '') +
    (!pf.logo || !pf.ruc ? '<div class="aviso info" style="margin-bottom:12px">Para que el presupuesto salga con tu logo y tus datos, completalos en <b>Datos de mi empresa</b> (en "Mis presupuestos").</div>' : '') +
    '<div class="pc-sec"><h4>Cliente y presupuesto</h4><div class="pc-aj">' +
    '<label class="pc-in pc-txt">Cliente<input data-cl="nombre" value="' + esc(cl.nombre) + '"></label>' +
    '<label class="pc-in pc-txt">Dirección / teléfono del cliente<input data-cl="contacto" value="' + esc(cl.contacto) + '"></label>' +
    '<label class="pc-in pc-txt">N° de presupuesto<input data-ci="numero" value="' + esc(c.numero) + '"></label>' +
    '<label class="pc-in pc-txt">Fecha<input data-ci="fecha" type="date" value="' + esc(c.fecha) + '"></label>' +
    '<label class="pc-in">Validez (días)<input data-ci="validez" inputmode="numeric" value="' + esc(c.validez) + '"></label></div></div>' +
    '<div class="pc-sec"><h4>Gastos, beneficio e IVA</h4><div class="pc-aj">' +
    '<label class="pc-in">Gastos generales (%)<input data-ci="gg" inputmode="decimal" value="' + esc(c.gg) + '"></label>' +
    '<label class="pc-in">Beneficio (%)<input data-ci="ben" inputmode="decimal" value="' + esc(c.ben) + '"></label>' +
    '<label class="pc-in">IVA (%)<input data-ci="iva" inputmode="decimal" value="' + esc(c.iva) + '"></label></div>' +
    '<label class="pc-check" style="margin-top:10px"><input type="checkbox" data-ci="incluir"' + (c.incluir ? ' checked' : '') + '> Incluir gastos generales y beneficio dentro de los precios de cada rubro (el cliente no los ve por separado)</label></div>' +
    '<div class="pc-sec"><h4>Qué se imprime</h4><div class="pc-aj">' +
    '<label class="pc-in pc-txt">Nivel de detalle<select data-ci="detalle"><option value="resumen"' + (c.detalle === 'resumen' ? ' selected' : '') + '>Resumen por rubro (material, mano de obra y total)</option><option value="items"' + (c.detalle === 'items' ? ' selected' : '') + '>Por rubro e ítem</option><option value="completo"' + (c.detalle === 'completo' ? ' selected' : '') + '>Completo (con cada material y la mano de obra)</option></select></label></div>' +
    '<label class="pc-in pc-txt" style="margin-top:8px">Observaciones para este cliente<textarea data-ci="obs" rows="3">' + esc(c.obs) + '</textarea></label></div>' +
    '<div class="pc-sec"><h4>Moneda en el impreso</h4><label class="pc-check"><input type="checkbox" data-ci="equiv"' + (c.equiv ? ' checked' : '') + '> Mostrar el total también en dólares y reales (con la cotización cargada arriba)</label></div>' +
    '<div class="pc-sec"><p class="pc-nota">Total a presupuestar: <b>Gs ' + gs(totalesCierre(r, c).total) + '</b> (costo directo Gs ' + gs(r.total) + ')' + equivalencias(totalesCierre(r, c).total) + '</p>' +
    '<button type="button" class="btn red" id="bImprimir">Ver e imprimir / guardar PDF</button></div>';
  $('bImprimir').onclick = imprimir;
}
function numIn(v) { const n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) ? n : 0; }
function totalesCierre(r, c) {
  const cd = r.total, gg = cd * numIn(c.gg) / 100, ben = cd * numIn(c.ben) / 100, sub = cd + gg + ben, iva = sub * numIn(c.iva) / 100;
  return { cd, gg, ben, sub, iva, total: sub + iva, k: cd ? sub / cd : 1 };
}
$('tabExport').addEventListener('change', e => {
  const i = e.target;
  if (i.dataset.cl) { pres.clienteDatos = cliente(); pres.clienteDatos[i.dataset.cl] = i.value.trim(); }
  else if (i.dataset.ci) { pres.cierre = cierre(); pres.cierre[i.dataset.ci] = i.type === 'checkbox' ? i.checked : i.value; }
  else return;
  programarGuardado(); pintarExport();
});
function imprimir() {
  const c = cierre(), cl = cliente(), pf = perfil(), S = sumas(), r = resumen(pres), tc = totalesCierre(r, c), k = c.incluir ? tc.k : 1;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha.split('-').reverse().join('/') : '';
  const datos = [pf.ruc ? 'RUC ' + esc(pf.ruc) : '', esc(pf.dir || ''), esc(pf.tel || ''), esc(pf.email || '')].filter(Boolean).join(' · ');
  let h = '<div class="pr-doc"><header class="pr-head">' + (pf.logo ? '<img src="' + pf.logo + '" alt="">' : '') +
    '<div><div class="pr-emp">' + esc(pf.nombre || '') + '</div><div class="pr-dat">' + datos + '</div></div>' +
    '<div class="pr-num"><b>PRESUPUESTO</b>' + (c.numero ? '<span>N° ' + esc(c.numero) + '</span>' : '') + (fecha ? '<span>Fecha: ' + fecha + '</span>' : '') + '</div></header>' +
    '<div class="pr-cli"><div><small>Cliente</small><b>' + esc(cl.nombre || '—') + '</b>' + (cl.contacto ? '<span>' + esc(cl.contacto) + '</span>' : '') + '</div>' +
    '<div><small>Obra</small><b>' + esc(pres.obra || '') + '</b></div></div>';
  h += '<table class="pr-t"><thead><tr><th>Rubro / ítem</th>' + (c.detalle === 'completo' ? '<th>Cantidad</th><th>P. unitario</th>' : '') + '<th>Material</th><th>Mano de obra</th><th>Total Gs</th></tr></thead><tbody>';
  const cols = c.detalle === 'completo' ? 6 : 4, nm = v => gs(v * k);
  for (const rb of pres.rubros || []) {
    const x = S.R[rb]; if (!x || !(x.mat + x.mo)) continue;
    h += '<tr class="pr-rub"><td' + (c.detalle === 'completo' ? ' colspan="3"' : '') + '>' + esc(rb) + '</td><td>' + nm(x.mat) + '</td><td>' + nm(x.mo) + '</td><td>' + nm(x.mat + x.mo) + '</td></tr>';
    if (c.detalle === 'resumen') continue;
    for (const a of actividades().filter(a => a.rubro === rb)) {
      const y = S.A[a.cod]; if (!y || !(y.mat + y.mo)) continue;
      h += '<tr class="pr-act"><td' + (c.detalle === 'completo' ? ' colspan="3"' : '') + '>' + esc(a.cod) + ' ' + esc(a.desc) + '</td><td>' + nm(y.mat) + '</td><td>' + nm(y.mo) + '</td><td>' + nm(y.mat + y.mo) + '</td></tr>';
      if (c.detalle !== 'completo') continue;
      for (const it of (pres.items || []).filter(i => actDe(i) === a.cod)) {
        const z = calc(it); if (!z.total) continue;
        h += '<tr class="pr-it"><td>' + esc(it.desc) + '</td><td>' + fmt1.format(it.cant) + ' ' + esc(it.unid || '') + '</td><td>' + gs(z.precio * k) + '</td>' +
          (it.tipo === 'mat' ? '<td>' + gs(z.total * k) + '</td><td></td>' : '<td></td><td>' + gs(z.total * k) + '</td>') + '<td></td></tr>';
      }
    }
  }
  h += '</tbody></table><table class="pr-tot">';
  if (c.incluir) h += '<tr><td>Subtotal</td><td>Gs ' + gs(tc.sub) + '</td></tr>';
  else {
    h += '<tr><td>Costo directo</td><td>Gs ' + gs(tc.cd) + '</td></tr>';
    if (tc.gg) h += '<tr><td>Gastos generales (' + esc(c.gg) + '%)</td><td>Gs ' + gs(tc.gg) + '</td></tr>';
    if (tc.ben) h += '<tr><td>Beneficio (' + esc(c.ben) + '%)</td><td>Gs ' + gs(tc.ben) + '</td></tr>';
    if (tc.gg || tc.ben) h += '<tr><td>Subtotal</td><td>Gs ' + gs(tc.sub) + '</td></tr>';
  }
  if (tc.iva) h += '<tr><td>IVA (' + esc(c.iva) + '%)</td><td>Gs ' + gs(tc.iva) + '</td></tr>';
  h += '<tr class="pr-gran"><td>TOTAL</td><td>Gs ' + gs(tc.total) + '</td></tr>';
  if (c.equiv) for (const m of ['USD', 'BRL']) if (cot(m)) h += '<tr class="pr-eq"><td>Equivalente en ' + (m === 'USD' ? 'dólares' : 'reales') + '</td><td>' + SIM[m] + ' ' + enMon(tc.total, m) + '</td></tr>';
  h += '</table>';
  if (c.equiv && (cot('USD') || cot('BRL'))) h += '<p class="pr-cot">Cotización usada: ' + ['USD', 'BRL'].filter(m => cot(m)).map(m => '1 ' + SIM[m] + ' = Gs ' + gs(cot(m))).join(' · ') + '. Los montos en otra moneda son de referencia; el presupuesto se expresa en guaraníes.</p>';
  const notas = [c.validez ? 'Presupuesto válido por ' + esc(c.validez) + ' días.' : '', esc(c.obs || ''), esc(pf.condiciones || '')].filter(Boolean);
  if (notas.length) h += '<div class="pr-notas">' + notas.map(n => '<p>' + n.replace(/\n/g, '<br>') + '</p>').join('') + '</div>';
  h += '<div class="pr-firma"><div><span></span>' + esc(pf.resp || pf.nombre || '') + '<small>' + esc(pf.nombre || '') + '</small></div><div><span></span>Conforme cliente<small>' + esc(cl.nombre || '') + '</small></div></div>' +
    '<footer class="pr-pie">' + esc(pf.nombre || '') + (datos ? ' · ' + datos : '') + '</footer></div>';
  $('printArea').innerHTML = h;
  const t = document.title; document.title = 'Presupuesto ' + (cl.nombre || pres.obra || '');
  setTimeout(() => { window.print(); document.title = t; }, 150);
}

/* ---------- barra de moneda y cotización ---------- */
function equivalencias(n) {
  const ot = ['GS', 'USD', 'BRL'].filter(m => m !== monAct() && cot(m));
  return ot.length && cot('USD') + cot('BRL') > 2 ? '<span class="pc-eq">' + ot.map(m => '≈ ' + SIM[m] + ' ' + enMon(n, m)).join(' · ') + '</span>' : '';
}
function barraMoneda() {
  const p = pres.parametros || {}, v = k => esNum(p[k]) ? fmt.format(p[k]) : '';
  return '<div class="pc-mon"><div class="pc-monb" role="group" aria-label="Ver montos en">' +
    ['GS', 'USD', 'BRL'].map(m => '<button type="button" data-mon="' + m + '" aria-pressed="' + (monAct() === m) + '">' + (m === 'GS' ? 'Gs Guaraníes' : m === 'USD' ? 'US$ Dólares' : 'R$ Reales') + '</button>').join('') + '</div>' +
    '<div class="pc-cots"><label class="pc-cot">1 US$ = Gs <input data-cot="cotUSD" inputmode="numeric" value="' + v('cotUSD') + '" placeholder="7.300"></label>' +
    '<label class="pc-cot">1 R$ = Gs <input data-cot="cotBRL" inputmode="numeric" value="' + v('cotBRL') + '" placeholder="1.350"></label>' +
    '<button type="button" class="pc-lnk" data-cothoy>Traer cotización de hoy</button></div>' +
    '<span class="pc-sm" data-cotmsg>' + (p.cotFecha ? 'Cotización cargada el ' + esc(p.cotFecha) + '. Tocá el número para cambiarla.' : 'Cargá la cotización para ver los montos en dólares o reales.') + '</span></div>';
}
function setCot(k, val) {
  pres.parametros = Object.assign({}, pres.parametros); pres.parametros[k] = val;
  pres.parametros.cotFecha = new Date().toLocaleDateString('es-PY');
}
async function cotizacionHoy() {
  const msg = document.querySelector('[data-cotmsg]'); if (msg) msg.textContent = 'Buscando la cotización…';
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD'), j = await r.json();
    const pyg = j && j.rates && j.rates.PYG, brl = j && j.rates && j.rates.BRL;
    if (!pyg || !brl) throw new Error('sin datos');
    setCot('cotUSD', Math.round(pyg)); setCot('cotBRL', Math.round(pyg / brl));
    programarGuardado(); refrescarMoneda();
    const m2 = document.querySelector('[data-cotmsg]'); if (m2) m2.textContent = 'Cotización de referencia de hoy (mercado internacional). Si el cambio de la casa es otro, escribilo encima.';
  } catch (e) { const m3 = document.querySelector('[data-cotmsg]'); if (m3) m3.textContent = 'No se pudo traer la cotización. Escribila a mano.'; }
}
function refrescarMoneda() {
  const t = document.querySelector('.pc-tabs [aria-selected="true"]');
  tab((t && t.dataset.tab) || 'rubros');
}
$('pKpis').addEventListener('click', e => {
  const b = e.target.closest('[data-mon]');
  if (b) {
    if (b.dataset.mon !== 'GS' && !cot(b.dataset.mon)) {
      const i = document.querySelector('[data-cot="' + (b.dataset.mon === 'USD' ? 'cotUSD' : 'cotBRL') + '"]');
      if (i) { i.focus(); i.classList.add('pc-pide'); }
      const m = document.querySelector('[data-cotmsg]'); if (m) m.textContent = 'Primero cargá la cotización (o tocá "Traer cotización de hoy").';
      return;
    }
    mon = b.dataset.mon; try { localStorage.setItem('ciprodec-moneda', mon); } catch (er) {}
    refrescarMoneda(); return;
  }
  if (e.target.closest('[data-cothoy]')) cotizacionHoy();
});
$('pKpis').addEventListener('change', e => {
  const i = e.target.closest('[data-cot]'); if (!i) return;
  const n = parseFloat(String(i.value).replace(/\./g, '').replace(',', '.'));
  setCot(i.dataset.cot, n > 0 ? n : null); programarGuardado(); refrescarMoneda();
});

/* ---------- navegación ---------- */
$('fCodigo').onsubmit = async e => { e.preventDefault(); await entrar($('codigo').value, $('recordar').checked); };
$('lPres').onclick = e => { const b = e.target.closest('.pc-card'); if (b) abrir(b.dataset.id); };
$('bVolver').onclick = async () => { if (timer) await guardarYa(); history.replaceState(null, '', location.pathname + (D.modo === 'demo' ? '?demo' : '')); if (constr) pintarLista(); else ver('vCodigo'); };
$('bSalir').onclick = () => { try { localStorage.removeItem(LS); } catch (e) { } codigo = constr = pres = null; $('codigo').value = ''; history.replaceState(null, '', location.pathname + (D.modo === 'demo' ? '?demo' : '')); ver('vCodigo'); };

/* ---------- administración (personal de CIPRODEC) ---------- */
function aleatorio(n, abc) { const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a].map(x => abc[x % abc.length]).join(''); }
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function linkCodigo(c) { return location.origin + location.pathname + '?c=' + encodeURIComponent(c) + (D.modo === 'demo' ? '&demo' : ''); }
async function pintarAdmin() {
  $('vAdmin').hidden = false;
  let lista = [];
  try { lista = await D.listar('constructores'); } catch (e) { msg('msgAdmin', D.mensajeError(e), 'err'); return; }
  $('npConst').innerHTML = lista.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('') || '<option value="">(primero creá una constructora)</option>';
  $('aLista').innerHTML = '<h3 style="margin:18px 0 8px">Constructoras</h3>' + (lista.map(c => {
    const wa = 'https://wa.me/?text=' + encodeURIComponent('Hola, te paso el acceso al portal de presupuestos de CIPRODEC: ' + linkCodigo(c.id) + ' (código ' + c.id + '). Lo podés guardar en la pantalla de inicio del celular.');
    return '<div class="pc-acard"><div><b>' + esc(c.nombre) + '</b><div class="pc-sm">Código: <span class="mono">' + esc(c.id) + '</span></div>' +
      (c.presupuestos || []).map(p => '<div class="pc-sm">• ' + esc(p.obra) + (p.cliente ? ' (' + esc(p.cliente) + ')' : '') +
        ' <button type="button" class="pc-lnk" data-abrir="' + esc(c.id) + '|' + esc(p.id) + '">abrir</button> <button type="button" class="pc-lnk" data-borrar="' + esc(c.id) + '|' + esc(p.id) + '">borrar</button></div>').join('') +
      '</div><div class="pc-aact"><a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Enviar por WhatsApp</a><button type="button" class="btn" data-copiar="' + esc(linkCodigo(c.id)) + '">Copiar link</button></div></div>';
  }).join('') || '<p class="vacio">Todavía no hay constructoras.</p>');
}
$('aLista').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.copiar) { try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = '✓ Copiado'; } catch (er) { prompt('Copiá el link:', b.dataset.copiar); } return; }
  if (b.dataset.abrir) { const [c, p] = b.dataset.abrir.split('|'); if (await entrar(c, false)) abrir(p); return; }
  if (b.dataset.borrar) {
    const [c, p] = b.dataset.borrar.split('|');
    if (!confirm('¿Borrar este presupuesto? No se puede deshacer.')) return;
    try {
      const cd = await D.obtener('constructores', c);
      cd.presupuestos = (cd.presupuestos || []).filter(x => x.id !== p);
      await D.guardar('constructores', cd); await D.borrar('presupuestos', p); pintarAdmin();
    } catch (er) { msg('msgAdmin', D.mensajeError(er), 'err'); }
  }
};
$('fNuevaConst').onsubmit = async e => {
  e.preventDefault(); const nombre = $('ncNombre').value.trim(); if (!nombre) return;
  const base = D.slug(nombre.replace(/^constructora\s+/i, '')).split('-')[0].toUpperCase().slice(0, 10) || 'CONST';
  const id = base + '-' + aleatorio(8, ABC);
  try { await D.guardar('constructores', { id, nombre, presupuestos: [], creado: new Date().toISOString() }); msg('msgAdmin', 'Constructora creada. Código: ' + id, 'ok'); $('ncNombre').value = ''; pintarAdmin(); }
  catch (er) { msg('msgAdmin', D.mensajeError(er), 'err'); }
};
$('fNuevoPres').onsubmit = async e => {
  e.preventDefault(); msg('msgAdmin', '');
  const cId = $('npConst').value, f = $('npArchivo').files[0];
  if (!cId || !f) { msg('msgAdmin', 'Elegí la constructora y el archivo del cómputo.', 'err'); return; }
  let datos;
  try { datos = JSON.parse(await f.text()); } catch (er) { msg('msgAdmin', 'El archivo no es un JSON válido.', 'err'); return; }
  if (datos.formato !== 'ciprodec-presupuesto-1' || !Array.isArray(datos.items)) { msg('msgAdmin', 'El archivo no es un cómputo de CIPRODEC (formato desconocido).', 'err'); return; }
  try {
    const cd = await D.obtener('constructores', cId);
    const id = 'p' + aleatorio(20, 'abcdefghijkmnpqrstuvwxyz23456789');
    const p = { id, codigo: cId, constructora: cd.nombre, obra: $('npObra').value.trim() || datos.obra || 'Presupuesto', cliente: $('npCliente').value.trim() || datos.cliente || '',
      rubros: datos.rubros, proveedores: datos.proveedores, parametros: datos.parametros, items: datos.items, creado: new Date().toISOString() };
    await D.guardar('presupuestos', p);
    cd.presupuestos = (cd.presupuestos || []).concat([{ id, obra: p.obra, cliente: p.cliente }]);
    await D.guardar('constructores', cd);
    msg('msgAdmin', 'Presupuesto creado para ' + cd.nombre + '.', 'ok'); e.target.reset(); pintarAdmin();
  } catch (er) { msg('msgAdmin', D.mensajeError(er), 'err'); }
};

/* ---------- inicio ---------- */
(async () => {
  if (D.modo === 'json') { msg('msgCodigo', 'El portal todavía no está habilitado: falta configurar Firebase. Para probar, agregá ?demo a la dirección.', 'info'); ver('vCodigo'); return; }
  if (D.modo === 'demo') { staff = true; pintarAdmin(); }
  else D.alCambiarSesion(s => { if (s.motivo === 'ok' && ['admin', 'editor'].includes(s.perfil.rol)) { staff = true; pintarAdmin(); } });
  let c = params.get('c'), recordar = true;
  if (!c) { try { c = localStorage.getItem(LS); } catch (e) { } }
  if (c && await entrar(c, recordar)) {
    if (params.get('p') && (constr.presupuestos || []).some(x => x.id === params.get('p'))) abrir(params.get('p'));
    else if ((constr.presupuestos || []).length === 1 && params.get('c')) abrir(constr.presupuestos[0].id);
  } else ver('vCodigo');
  if (params.get('c')) history.replaceState(null, '', location.pathname + (D.modo === 'demo' ? '?demo' : ''));
})();
