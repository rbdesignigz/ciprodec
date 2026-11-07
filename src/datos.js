/* CIPRODEC – capa de datos compartida (web pública, panel y área de clientes).
   Tres modos:
   - "firebase": si src/config.js tiene la configuración de Firebase. Lee y escribe en Firestore.
   - "json":     sin Firebase. Lee los archivos de data/ (solo lectura).
   - "demo":     agregando ?demo a la dirección. Todo queda guardado solo en este navegador; sirve para probar el panel. */
const CFG = window.CIPRODEC_CONFIG || {};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const params = new URLSearchParams(location.search);
export const modo = params.has('demo') ? 'demo' : (CFG.firebase ? 'firebase' : 'json');
export const ROLES = {
  admin: 'Administrador',
  editor: 'Empleado – contenidos',
  inmobiliaria: 'Inmobiliaria',
  cliente: 'Cliente'
};
export const PERMISOS = {
  admin: ['noticias', 'obras', 'precios', 'propiedades', 'clientes', 'usuarios', 'ajustes'],
  editor: ['noticias', 'obras', 'precios', 'clientes'],
  inmobiliaria: ['propiedades'],
  cliente: []
};
const PUBLICAS = ['noticias', 'propiedades', 'obras', 'ediciones', 'fuentes', 'ajustes'];

/* ---------- utilidades ---------- */
export function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
}
export function nuevoId(base) { return slug(base) + '-' + Date.now().toString(36).slice(-5); }
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fechaTxt(f) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(f || '')) return '';
  const p = f.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0];
}
export function okUrl(u) { u = String(u || ''); return /^(https?:\/\/|\.\/|\/|img\/|data:image\/)/i.test(u) ? u : ''; }
function ordenar(arr) {
  return arr.map((x, i) => [x, i]).sort((a, b) => {
    const oa = typeof a[0].orden === 'number' ? a[0].orden : a[1];
    const ob = typeof b[0].orden === 'number' ? b[0].orden : b[1];
    return oa - ob;
  }).map(x => x[0]);
}
const limpio = o => JSON.parse(JSON.stringify(o));

/* ---------- respaldo JSON (archivos de data/) ---------- */
let jsonCache = null;
async function cargarJson() {
  if (jsonCache) return jsonCache;
  const get = f => fetch('./data/' + f + '?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  const [n, p, o, pr] = await Promise.all([get('noticias.json'), get('propiedades.json'), get('obras.json'), get('precios.json')]);
  const conOrden = arr => (arr || []).map((x, i) => Object.assign({ orden: i }, x));
  jsonCache = {
    noticias: conOrden(n.noticias),
    propiedades: conOrden(p.propiedades),
    obras: conOrden(o.obras),
    ediciones: conOrden(pr.ediciones),
    fuentes: conOrden((pr.fuentes || []).map(f => Object.assign({ id: f.id || slug(f.pais + '-' + f.nombre) }, f))),
    ajustes: [{ id: 'general', whatsappInmobiliaria: p.whatsapp || '', avisoPrecios: pr.aviso || '' }],
    usuarios: [], obrasClientes: [], fotos: [], fotosPrivadas: []
  };
  return jsonCache;
}
export { cargarJson as contenidoInicial };

/* ---------- modo demo (guardado en este navegador) ---------- */
const DEMO_KEY = 'ciprodec-demo-v1';
let demoMem = null;
async function demoDb() {
  if (demoMem) return demoMem;
  try { const s = localStorage.getItem(DEMO_KEY); if (s) demoMem = JSON.parse(s); } catch (e) { }
  if (!demoMem) demoMem = limpio(await cargarJson());
  return demoMem;
}
function demoGuardar() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoMem)); } catch (e) { } }
export function demoReiniciar() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { } demoMem = null; }

/* ---------- Firebase ---------- */
let fb = null;
async function firebase() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  const a = app.initializeApp(CFG.firebase);
  fb = { app: a, A: auth, F: fs, auth: auth.getAuth(a), db: fs.getFirestore(a) };
  return fb;
}

/* ---------- lectura / escritura ---------- */
export async function listar(col, filtro) {
  if (modo === 'firebase') {
    const { F, db } = await firebase();
    let q = F.collection(db, col);
    if (filtro) q = F.query(q, F.where(filtro[0], filtro[1], filtro[2]));
    const snap = await F.getDocs(q);
    return ordenar(snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
  }
  const db = modo === 'demo' ? await demoDb() : await cargarJson();
  let arr = (db[col] || []).slice();
  if (filtro && filtro[1] === 'array-contains') arr = arr.filter(x => (x[filtro[0]] || []).includes(filtro[2]));
  return ordenar(arr);
}
export async function obtener(col, id) {
  if (modo === 'firebase') {
    const { F, db } = await firebase();
    const d = await F.getDoc(F.doc(db, col, id));
    return d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
  }
  const arr = await listar(col);
  return arr.find(x => x.id === id) || null;
}
export async function guardar(col, item) {
  if (!item.id) throw new Error('Falta el id');
  const datos = limpio(item); delete datos.id;
  datos.actualizado = new Date().toISOString();
  if (modo === 'firebase') {
    const { F, db } = await firebase();
    await F.setDoc(F.doc(db, col, item.id), datos);
    return;
  }
  if (modo !== 'demo') throw new Error('Sin Firebase configurado la web es solo de lectura. Usá el modo demostración para probar.');
  const db = await demoDb(); db[col] = db[col] || [];
  const i = db[col].findIndex(x => x.id === item.id);
  const nuevo = Object.assign({ id: item.id }, datos);
  if (i >= 0) db[col][i] = nuevo; else db[col].push(nuevo);
  demoGuardar();
}
export async function borrar(col, id) {
  if (modo === 'firebase') {
    const { F, db } = await firebase();
    await F.deleteDoc(F.doc(db, col, id)); return;
  }
  if (modo !== 'demo') throw new Error('Solo lectura');
  const db = await demoDb(); db[col] = (db[col] || []).filter(x => x.id !== id); demoGuardar();
}

/* ---------- fotos ----------
   Las fotos subidas desde el panel se guardan en Firestore (colección "fotos", pública,
   o "fotosPrivadas" para las obras de clientes) y se referencian como "foto:ID" / "fotop:ID".
   Las fotos que ya estaban en el repositorio siguen siendo rutas normales (./img/...). */
const cacheFotos = {};
export async function fotoUrl(ref) {
  ref = String(ref || '');
  const m = ref.match(/^(foto|fotop):(.+)$/);
  if (!m) return okUrl(ref);
  if (cacheFotos[ref]) return cacheFotos[ref];
  const d = await obtener(m[1] === 'foto' ? 'fotos' : 'fotosPrivadas', m[2]).catch(() => null);
  return (cacheFotos[ref] = d && d.data ? d.data : '');
}
export async function subirFoto(dataUrl, privada, clientes) {
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const item = { id, data: dataUrl };
  if (privada) item.clientes = clientes || [];
  await guardar(privada ? 'fotosPrivadas' : 'fotos', item);
  cacheFotos[(privada ? 'fotop:' : 'foto:') + id] = dataUrl;
  return (privada ? 'fotop:' : 'foto:') + id;
}
export function achicarImagen(file, max = 1400, calidad = 0.8) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('No se pudo leer la imagen'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Formato de imagen no válido'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', calidad));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- usuarios y sesión ---------- */
function esSuper(email) { return !!CFG.superadmin && email === String(CFG.superadmin).toLowerCase(); }
async function perfilDe(email) {
  if (esSuper(email)) return { id: email, email, nombre: 'Administrador principal', rol: 'admin', activo: true, principal: true };
  const p = await obtener('usuarios', email).catch(() => null);
  return p && p.activo !== false ? p : null;
}
/* cb({usuario, perfil, motivo}) – motivo: 'sin-sesion' | 'no-autorizado' | 'sin-verificar' | 'ok' */
export async function alCambiarSesion(cb) {
  if (modo === 'firebase') {
    const { A, auth } = await firebase();
    A.onAuthStateChanged(auth, async u => {
      if (!u) return cb({ motivo: 'sin-sesion' });
      const email = (u.email || '').toLowerCase();
      const google = (u.providerData || []).some(p => p.providerId === 'google.com');
      if (!u.emailVerified && !google) return cb({ usuario: u, motivo: 'sin-verificar' });
      const perfil = await perfilDe(email);
      cb(perfil ? { usuario: u, perfil, motivo: 'ok' } : { usuario: u, motivo: 'no-autorizado' });
    });
    return;
  }
  let s = null; try { s = JSON.parse(sessionStorage.getItem('ciprodec-demo-sesion') || 'null'); } catch (e) { }
  if (modo !== 'demo' || !s) return cb({ motivo: 'sin-sesion' });
  cb({ usuario: { email: s.email }, perfil: s, motivo: 'ok' });
}
export async function entrarGoogle() {
  const { A, auth } = await firebase();
  await A.signInWithPopup(auth, new A.GoogleAuthProvider());
}
export async function entrarEmail(email, clave) {
  const { A, auth } = await firebase();
  await A.signInWithEmailAndPassword(auth, email.trim(), clave);
}
export async function registrarEmail(email, clave) {
  const { A, auth } = await firebase();
  const r = await A.createUserWithEmailAndPassword(auth, email.trim(), clave);
  await A.sendEmailVerification(r.user);
}
export async function reenviarVerificacion() {
  const { A, auth } = await firebase();
  if (auth.currentUser) await A.sendEmailVerification(auth.currentUser);
}
export async function recuperarClave(email) {
  const { A, auth } = await firebase();
  await A.sendPasswordResetEmail(auth, email.trim());
}
export async function salir() {
  if (modo === 'firebase') { const { A, auth } = await firebase(); await A.signOut(auth); return; }
  try { sessionStorage.removeItem('ciprodec-demo-sesion'); } catch (e) { }
}
/* solo modo demo: entrar eligiendo un rol, para recorrer el panel */
export async function entrarDemo(email, rol) {
  const s = { id: email, email, nombre: 'Demo', rol, activo: true };
  try { sessionStorage.setItem('ciprodec-demo-sesion', JSON.stringify(s)); } catch (e) { }
}
export function mensajeError(e) {
  const c = (e && e.code) || '';
  const t = {
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/user-not-found': 'No hay una cuenta con ese email. Usá "Crear contraseña".',
    'auth/email-already-in-use': 'Ese email ya tiene cuenta: ingresá o recuperá la contraseña.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'permission-denied': 'No tenés permiso para esta acción.',
    'unavailable': 'Sin conexión con el servidor. Probá de nuevo.'
  };
  return t[c] || (e && e.message) || 'Ocurrió un error.';
}
export const esPublica = col => PUBLICAS.includes(col);
