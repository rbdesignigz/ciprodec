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
