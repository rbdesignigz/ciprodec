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
  $('lConst').textContent = constr.nombre || '';
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
    '<div class="pc-kpi main"><span>Costo total de la obra</span><b>Gs ' + gs(r.total) + '</b></div>' +
    '<div class="pc-kpi"><span>Materiales</span><b>Gs ' + gs(r.mat) + '</b></div>' +
    '<div class="pc-kpi"><span>Mano de obra</span><b>Gs ' + gs(r.mo) + '</b></div>' +
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
function bloque(items, titulo) {
  if (!items.length) return '';
  return '<div class="pc-sec"><h4>' + titulo + '</h4>' + items.map(filaItem).join('') + '</div>';
}
function pintarRubros() {
  const r = kpis(), abiertos = new Set([...document.querySelectorAll('#tabRubros details[open]')].map(d => d.dataset.r));
  $('tabRubros').innerHTML = (pres.rubros || []).map(rb => {
    const x = r.rub[rb] || { mat: 0, mo: 0, falta: 0 }, its = (pres.items || []).filter(i => i.rubro === rb);
    if (!its.length) return '';
    return '<details class="pc-rub" data-r="' + esc(rb) + '"' + (abiertos.has(rb) ? ' open' : '') + '><summary><span class="pc-rn">' + esc(rb) + '</span>' +
      '<span class="pc-rv"><span><small>Materiales</small>Gs <i data-s="mat">' + gs(x.mat) + '</i></span><span><small>Mano de obra</small>Gs <i data-s="mo">' + gs(x.mo) + '</i></span>' +
      '<span class="pc-rt"><small>Total</small>Gs <i data-s="tot">' + gs(x.mat + x.mo) + '</i></span></span>' +
      '<span class="pc-rf" data-s="falta">' + (x.falta ? 'Faltan ' + x.falta : '✓ completo') + '</span></summary>' +
      bloque(its.filter(i => i.tipo === 'mat'), 'Materiales') + bloque(its.filter(i => i.tipo === 'mo'), 'Mano de obra') + '</details>';
  }).join('');
}
function pintarFalta() {
  kpis();
  const falta = (pres.items || []).filter(it => calc(it).estado !== 'ok');
  if (!falta.length) { $('tabFalta').innerHTML = '<div class="aviso ok">¡Está todo cargado! El presupuesto está completo.</div>'; return; }
  let h = '<p class="pc-nota">Cargá acá lo que falta: cada precio que escribís se guarda en el presupuesto general. Lo cargado queda en verde hasta que cambies de pestaña.</p>';
  for (const rb of pres.rubros || []) {
    const its = falta.filter(i => i.rubro === rb);
    if (its.length) h += '<div class="pc-sec"><h4>' + esc(rb) + '</h4>' + its.map(filaItem).join('') + '</div>';
  }
  $('tabFalta').innerHTML = h;
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
  $('tabRubros').hidden = t !== 'rubros'; $('tabFalta').hidden = t !== 'falta'; $('tabAjustes').hidden = t !== 'ajustes';
  if (t === 'rubros') pintarRubros(); else if (t === 'falta') pintarFalta(); else { kpis(); pintarAjustes(); }
}

/* actualizar en el lugar después de cargar un valor, sin perder el foco */
function refrescar(id) {
  const r = kpis();
  document.querySelectorAll('.pc-it[data-id="' + CSS.escape(id) + '"]').forEach(el => {
    const it = pres.items.find(x => x.id === id), c = calc(it);
    el.querySelector('[data-o="tot"]').textContent = 'Gs ' + gs(c.total);
    el.querySelector('[data-o="chip"]').innerHTML = chip(c.estado);
    el.querySelector('[data-o="pu"]').textContent = esNum(c.precio) ? 'Gs ' + gs(c.precio) + '/' + (it.unid || 'u') + (c.prov ? ' · ' + c.prov : '') : '';
    el.classList.toggle('pc-listo', c.estado === 'ok');
  });
  document.querySelectorAll('#tabRubros details').forEach(d => {
    const x = r.rub[d.dataset.r]; if (!x) return;
    d.querySelector('[data-s="mat"]').textContent = gs(x.mat); d.querySelector('[data-s="mo"]').textContent = gs(x.mo);
    d.querySelector('[data-s="tot"]').textContent = gs(x.mat + x.mo);
    d.querySelector('[data-s="falta"]').textContent = x.falta ? 'Faltan ' + x.falta : '✓ completo';
  });
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
