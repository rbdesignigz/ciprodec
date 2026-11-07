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
