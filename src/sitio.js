/* CIPRODEC – comportamiento común: idioma ES/PT, menú en celular y visor de fotos. */
(function(){
  var root=document.documentElement, btns=document.querySelectorAll('.lang button');
  function set(l){root.setAttribute('data-lang',l);root.setAttribute('lang',l==='pt'?'pt-BR':'es');
    btns.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.set===l))});
    try{localStorage.setItem('ciprodec-lang',l)}catch(e){}}
  btns.forEach(function(b){b.addEventListener('click',function(){set(b.dataset.set)})});
  var saved=null;try{saved=localStorage.getItem('ciprodec-lang')}catch(e){}
  if(saved==='pt'||saved==='es'){set(saved)}
  else if((navigator.language||'').toLowerCase().indexOf('pt')===0){set('pt')}

  var head=document.querySelector('header.top'), mb=document.querySelector('.menu-btn');
  if(head&&mb){
    mb.addEventListener('click',function(){var a=head.classList.toggle('abierto');mb.setAttribute('aria-expanded',String(a));});
    head.querySelectorAll('nav.links a').forEach(function(a){a.addEventListener('click',function(){head.classList.remove('abierto');mb.setAttribute('aria-expanded','false');});});
  }
  /* conservar ?demo al navegar entre páginas del sitio */
  if(/[?&]demo\b/.test(location.search)){
    document.querySelectorAll('a[href^="./"]').forEach(function(a){
      var h=a.getAttribute('href'), i=h.indexOf('#'), base=i<0?h:h.slice(0,i), hash=i<0?'':h.slice(i);
      if(/\.html$|\/$/.test(base)) a.setAttribute('href',base+(base.indexOf('?')<0?'?':'&')+'demo'+hash);
    });
    var b=document.createElement('div');b.className='demo-banda';
    b.textContent='Modo demostración: los cambios se guardan solo en este navegador.';
    document.body.insertBefore(b,document.body.firstChild);
  }

  /* visor de fotos: window.CipVisor.abrir(['url',...], 'título') */
  var lb=document.getElementById('lb');
  if(lb){
    var img=document.getElementById('lbImg'),cap=document.getElementById('lbCap'),fotos=[],tit='',idx=0,last=null;
    function show(){img.src=fotos[idx];img.alt=tit+' – foto '+(idx+1);cap.textContent=tit+' · '+(idx+1)+' / '+fotos.length;
      document.getElementById('lbP').hidden=document.getElementById('lbN').hidden=fotos.length<2;}
    function close(){lb.classList.remove('open');if(last)last.focus();}
    function move(d){idx=(idx+d+fotos.length)%fotos.length;show();}
    document.getElementById('lbX').onclick=close;document.getElementById('lbP').onclick=function(){move(-1)};document.getElementById('lbN').onclick=function(){move(1)};
    lb.addEventListener('click',function(e){if(e.target===lb)close();});
    document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);});
    window.CipVisor={abrir:function(f,t,i){fotos=(f||[]).filter(Boolean);if(!fotos.length)return;tit=t||'';idx=i||0;last=document.activeElement;show();lb.classList.add('open');document.getElementById('lbX').focus();}};
  }
})();

/* CIPRODEC Radio: barra fija arriba en todas las páginas (menos radio.html).
   Si src/config.js tiene radioStream (URL de audio del stream), el botón reproduce directo en la barra
   y muestra el tema que está sonando. Si no, abre el reproductor oficial de streamcasthd. */
(function(){
  if (/radio\.html$/.test(location.pathname)) return;
  var head = document.querySelector('header.top'); if (!head) return;
  var CFG = window.CIPRODEC_CONFIG || {}, URLS = [].concat(CFG.radioStream || []).filter(Boolean), STREAM = URLS[0] || '', PANEL = CFG.radioPanel || 8856, iu = 0;
  var pt = function(){ return document.documentElement.getAttribute('data-lang') === 'pt'; };
  var bar = document.createElement('div'); bar.className = 'radio-bar';
  bar.innerHTML =
    '<div class="wrap rb-fila">' +
      '<span class="rb-vivo"><i></i><span class="es">EN VIVO</span><span class="pt">AO VIVO</span></span>' +
      '<b class="rb-nombre">CIPRODEC Radio</b>' +
      '<span class="rb-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
      '<span class="rb-txt"><span class="es">Música mientras recorrés la web</span><span class="pt">Música enquanto você navega</span></span>' +
      (STREAM ? '<input class="rb-vol" type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Volumen">' : '') +
      '<button type="button" class="rb-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="rb-ico" d="M8 5v14l11-7z" fill="currentColor"/></svg><span class="rb-l"></span></button>' +
    '</div>' + (STREAM ? '' : '<div class="rb-player"><div class="wrap"></div></div>');
  head.appendChild(bar);
  var btn = bar.querySelector('.rb-btn'), lbl = bar.querySelector('.rb-l'), ico = bar.querySelector('.rb-ico'), txt = bar.querySelector('.rb-txt');
  var PLAY = 'M8 5v14l11-7z', PAUSA = 'M7 5h4v14H7zM13 5h4v14h-4z';

  if (STREAM) {
    /* reproductor directo */
    var audio = new Audio(); audio.preload = 'none'; var cargando = false, tema = '';
    var vol = bar.querySelector('.rb-vol'); audio.volume = +vol.value;
    vol.addEventListener('input', function(){ audio.volume = +vol.value; });
    function pinta(){
      var on = !audio.paused;
      bar.classList.toggle('sonando', on); ico.setAttribute('d', on ? PAUSA : PLAY);
      lbl.textContent = cargando ? (pt() ? 'Conectando…' : 'Conectando…') : on ? (pt() ? 'Pausar' : 'Pausar') : (pt() ? 'Ouvir' : 'Escuchar');
      btn.setAttribute('aria-label', on ? 'Pausar CIPRODEC Radio' : 'Escuchar CIPRODEC Radio');
      if (tema) txt.textContent = (pt() ? 'Tocando: ' : 'Sonando: ') + tema;
    }
    btn.addEventListener('click', function(){
      if (!audio.paused) { audio.pause(); audio.removeAttribute('src'); audio.load(); pinta(); return; }
      /* se reconecta al vivo cada vez (sin cortes viejos en el búfer) */
      iu = 0; conectar();
    });
    function conectar(){
      var u = URLS[iu];
      audio.src = u + (u.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
      cargando = true; pinta();
      audio.play().catch(function(e){ if (e && e.name === 'NotAllowedError') { cargando = false; pinta(); } });
    }
    function fallo(){
      /* probar la siguiente dirección del stream; si no hay más, avisar */
      if (iu < URLS.length - 1) { iu++; conectar(); return; }
      cargando = false; audio.removeAttribute('src');
      txt.textContent = pt() ? 'A rádio não está no ar agora.' : 'La radio no está al aire en este momento.'; pinta();
    }
    audio.addEventListener('playing', function(){ cargando = false; pinta(); });
    audio.addEventListener('pause', pinta);
    audio.addEventListener('error', function(){ if (audio.getAttribute('src')) fallo(); });
    /* tema que está sonando (si el servidor lo permite) */
    function info(){
      fetch('https://server.streamcasthd.com/cp/get_info.php?p=' + PANEL, { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .then(function(d){ var h = (d.title || (d.history && d.history[0]) || '').replace(/<[^>]*>/g, '').replace(/^\d+\.\)\s*/, '').replace(/^\d+\s*-\s*/, '').trim();
          if (h && !/ciprodec solo/i.test(h)) { tema = h; pinta(); } })
        .catch(function(){});
    }
    info(); setInterval(info, 30000);
    pinta(); new MutationObserver(pinta).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return;
  }

  /* sin URL de stream: reproductor oficial de streamcasthd */
  var cont = bar.querySelector('.rb-player .wrap'), cargado = false;
  function texto(){ var ab = bar.classList.contains('abierta');
    btn.setAttribute('aria-label', 'CIPRODEC Radio');
    lbl.textContent = ab ? 'Minimizar' : (cargado ? (pt() ? 'Mostrar player' : 'Mostrar reproductor') : (pt() ? 'Ouvir' : 'Escuchar')); }
  btn.addEventListener('click', function(){
    if (!cargado) {
      var f = document.createElement('iframe');
      f.src = 'https://server.streamcasthd.com/cp/widgets/player/single/?p=' + PANEL;
      f.title = 'Reproductor de CIPRODEC Radio'; f.height = '110'; f.width = '100%'; f.setAttribute('scrolling', 'no');
      f.setAttribute('allow', 'autoplay'); f.style.cssText = 'border:0;display:block';
      cont.appendChild(f); cargado = true; bar.classList.add('sonando');
    }
    var ab = bar.classList.toggle('abierta'); btn.setAttribute('aria-expanded', String(ab)); texto();
  });
  texto(); new MutationObserver(texto).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
})();

/* CIPRODEC Radio – chat de saludos de los oyentes.
   Botón "Saludar" en la barra de la radio que abre un panel flotante. Los mensajes se guardan en
   Firestore (colección radioChat) y los responde el locutor de turno (respondedor en la PC de la radio).
   Sin Firebase o con ?demo en la dirección funciona en modo demostración, solo en este navegador. */
(function(){
  if (/radio\.html$/.test(location.pathname)) return;
  var bar = document.querySelector('.radio-bar .rb-fila'); if (!bar) return;
  var CFG = window.CIPRODEC_CONFIG || {}, SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var DEMO = !CFG.firebase || /[?&]demo\b/.test(location.search);
  var pt = function(){ return document.documentElement.getAttribute('data-lang') === 'pt'; };
  var t = function(es, p){ return pt() ? p : es; };
  var guardado = function(k){ try { return localStorage.getItem('rc_' + k) || ''; } catch(e){ return ''; } };
  var guardar = function(k, v){ try { localStorage.setItem('rc_' + k, v); } catch(e){} };

  var abrir = document.createElement('button'); abrir.type = 'button'; abrir.className = 'rb-chat';
  abrir.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="rb-cl"></span>';
  bar.insertBefore(abrir, bar.querySelector('.rb-vol') || bar.querySelector('.rb-btn'));

  var panel = document.createElement('div'); panel.className = 'rc-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat de CIPRODEC Radio');
  panel.innerHTML =
    '<div class="rc-cab"><div><b>CIPRODEC Radio</b><small class="rc-sub"></small></div>' +
    '<button type="button" class="rc-x" aria-label="Cerrar">×</button></div>' +
    '<ol class="rc-lista" aria-live="polite"></ol>' +
    '<form class="rc-form" novalidate>' +
      '<div class="rc-datos"><input name="nombre" maxlength="30" autocomplete="given-name" required><input name="ciudad" maxlength="30"></div>' +
      '<div class="rc-envia"><input name="texto" maxlength="200" required><button type="submit" aria-label="Enviar">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" fill="currentColor"/></svg></button></div>' +
      '<p class="rc-aviso" role="status"></p>' +
      '<p class="rc-nota"></p>' +
    '</form>';
  document.body.appendChild(panel);
  var lista = panel.querySelector('.rc-lista'), form = panel.querySelector('.rc-form'), aviso = panel.querySelector('.rc-aviso');
  form.nombre.value = guardado('nombre'); form.ciudad.value = guardado('ciudad');

  function textos(){
    abrir.querySelector('.rb-cl').textContent = t('Saludar en vivo', 'Recado ao vivo');
    abrir.setAttribute('aria-label', t('Mandar un saludo a la radio', 'Mandar um recado para a rádio'));
    panel.querySelector('.rc-sub').textContent = t('Saludos en vivo', 'Recados ao vivo');
    form.nombre.placeholder = t('Tu nombre', 'Seu nome');
    form.ciudad.placeholder = t('Ciudad', 'Cidade');
    form.texto.placeholder = t('Mandá tu saludo a la radio', 'Mande seu recado para a rádio');
    panel.querySelector('.rc-nota').textContent = t('Conducción virtual de CIPRODEC Radio. Los saludos se leen al aire.', 'Locução virtual da CIPRODEC Rádio. Os recados são lidos no ar.');
  }
  textos(); new MutationObserver(textos).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

  function hora(d){ return d ? d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : ''; }
  function pinta(msgs){
    lista.textContent = '';
    if (!msgs.length) { var v = document.createElement('li'); v.className = 'rc-vacio';
      v.textContent = t('Sé el primero en saludar a la radio.', 'Seja o primeiro a mandar um recado.'); lista.appendChild(v); }
    msgs.forEach(function(m){
      var li = document.createElement('li'); li.className = m.tipo === 'radio' ? 'rc-m rc-radio' : 'rc-m';
      var q = document.createElement('small');
      q.textContent = m.tipo === 'radio' ? (m.autor || 'CIPRODEC Radio') + ' · ' + hora(m.fecha)
        : m.nombre + (m.ciudad ? ' · ' + m.ciudad : '') + ' · ' + hora(m.fecha);
      var p = document.createElement('p'); p.textContent = m.texto;
      li.appendChild(q); li.appendChild(p); lista.appendChild(li);
    });
    lista.scrollTop = lista.scrollHeight;
  }

  /* ---- almacenamiento: Firestore o demostración ---- */
  var enviar, iniciado = false;
  function iniciar(){
    if (iniciado) return; iniciado = true;
    if (DEMO) {
      var demo = [];
      pinta(demo);
      enviar = function(m){
        demo.push({ nombre: m.nombre, ciudad: m.ciudad, texto: m.texto, tipo: 'oyente', fecha: new Date() }); pinta(demo);
        setTimeout(function(){
          demo.push({ tipo: 'radio', autor: 'Zaha', fecha: new Date(),
            texto: '¡Gracias por escribir, ' + m.nombre + '! En un ratito te saludamos al aire. (respuesta de demostración)' });
          pinta(demo);
        }, 1800);
        return Promise.resolve();
      };
      return;
    }
    var listo = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]).then(function(r){
      var A = r[0], F = r[1];
      var app = A.getApps().length ? A.getApp() : A.initializeApp(CFG.firebase);
      var db = F.getFirestore(app), col = F.collection(db, 'radioChat');
      F.onSnapshot(F.query(col, F.orderBy('ts', 'desc'), F.limit(30)), function(s){
        var msgs = []; s.forEach(function(d){ var x = d.data(); x.fecha = x.ts && x.ts.toDate ? x.ts.toDate() : new Date(); msgs.push(x); });
        pinta(msgs.reverse());
      }, function(){ aviso.textContent = t('El chat no está disponible en este momento.', 'O chat não está disponível agora.'); });
      return { F: F, col: col };
    });
    enviar = function(m){ return listo.then(function(x){
      return x.F.addDoc(x.col, { nombre: m.nombre, ciudad: m.ciudad, texto: m.texto, tipo: 'oyente', ts: x.F.serverTimestamp() });
    }); };
  }

  abrir.addEventListener('click', function(){
    panel.hidden = !panel.hidden; abrir.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { iniciar(); (form.nombre.value ? form.texto : form.nombre).focus(); }
  });
  panel.querySelector('.rc-x').addEventListener('click', function(){ panel.hidden = true; abrir.setAttribute('aria-expanded', 'false'); abrir.focus(); });

  var FEAS = /\b(put[ao]s?|mierda|pelotud[oa]|boludo|idiota|tarad[oa]|forro|concha|verga|caralho|porra|merda)\b/i;
  form.addEventListener('submit', function(e){
    e.preventDefault(); aviso.textContent = '';
    var m = { nombre: form.nombre.value.trim(), ciudad: form.ciudad.value.trim(), texto: form.texto.value.trim() };
    if (!m.nombre) { aviso.textContent = t('Escribí tu nombre.', 'Escreva seu nome.'); form.nombre.focus(); return; }
    if (!m.texto) { aviso.textContent = t('Escribí tu saludo.', 'Escreva seu recado.'); form.texto.focus(); return; }
    if (FEAS.test(m.texto + ' ' + m.nombre)) { aviso.textContent = t('Ese mensaje no se puede publicar.', 'Essa mensagem não pode ser publicada.'); return; }
    var ult = +guardado('ultimo') || 0;
    if (Date.now() - ult < 30000) { aviso.textContent = t('Esperá unos segundos antes de mandar otro saludo.', 'Espere alguns segundos antes de mandar outro recado.'); return; }
    guardar('nombre', m.nombre); guardar('ciudad', m.ciudad);
    var b = form.querySelector('button'); b.disabled = true;
    enviar(m).then(function(){ guardar('ultimo', String(Date.now())); form.texto.value = '';
      aviso.textContent = t('¡Saludo enviado! Atento a la radio.', 'Recado enviado! Fique ligado na rádio.'); })
      .catch(function(){ aviso.textContent = t('No se pudo enviar. Probá de nuevo en un momento.', 'Não foi possível enviar. Tente de novo.'); })
      .then(function(){ b.disabled = false; });
  });
})();
