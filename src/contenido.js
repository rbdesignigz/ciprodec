// Contenido editable de ciprodec.com
// Las noticias y las propiedades se leen de data/noticias.json y data/propiedades.json.
// Esos archivos se editan desde /admin.html (o a mano en GitHub).
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|\.\/|\/|img\/)/i.test(u) ? u : '';
  }
  function cargar(ruta) {
    return fetch(ruta + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo leer ' + ruta);
      return r.json();
    });
  }
  function irAlAncla() {
    if (location.hash.length > 1) {
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  }

  // ---------- Noticias ----------
  var listaNoticias = document.getElementById('lista-noticias');
  if (listaNoticias) {
    cargar('./data/noticias.json').then(function (data) {
      var items = (data.noticias || []).filter(function (n) { return n.visible !== false; });
      if (!items.length) { listaNoticias.innerHTML = '<p class="text-gray-600 text-center">Todavía no hay noticias publicadas.</p>'; return; }
      listaNoticias.innerHTML = items.map(function (n, i) {
        var parrafos = String(n.contenido || '').split(/\n\s*\n/).map(function (p) {
          var t = esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
          return t ? '<p>' + t + '</p>' : '';
        }).join('');
        var img = safeUrl(n.imagen);
        var meta = esc(n.categoria || '') + (n.fecha ? ' · ' + esc(n.fecha) : '');
        return '<article id="' + esc(n.id) + '" class="bg-white shadow-sm rounded-lg overflow-hidden' + (i ? ' mt-8' : '') + '">' +
          (img ? '<figure><img src="' + esc(img) + '" alt="' + esc(n.alt || n.titulo) + '" class="w-full block object-cover max-h-[60vh]" /></figure>' : '') +
          '<div class="p-6"><h3 class="text-xl font-semibold text-gray-900 mb-2">' + esc(n.titulo) + '</h3>' +
          '<div class="flex justify-between items-center mb-4"><div><p class="text-sm text-gray-500">' + meta + '</p></div>' +
          '<div><button type="button" class="hover:text-red-600 focus:outline-none" data-share="' + esc(n.id) + '"><i class="fa-solid fa-share"></i> compartir</button></div></div>' +
          '<div class="text-gray-700 leading-relaxed space-y-4">' + parrafos + '</div></div></article>';
      }).join('');
      listaNoticias.addEventListener('click', function (e) {
        var b = e.target.closest('[data-share]');
        if (!b) return;
        var n = items.find(function (x) { return x.id === b.getAttribute('data-share'); });
        var url = location.origin + location.pathname + '#' + encodeURIComponent(n.id);
        if (navigator.share) {
          navigator.share({ title: n.titulo, text: n.titulo, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () { b.innerHTML = '<i class="fa-solid fa-check"></i> enlace copiado'; });
        }
      });
      irAlAncla();
    }).catch(function () {
      listaNoticias.innerHTML = '<p class="text-gray-600 text-center">No se pudieron cargar las noticias.</p>';
    });
  }

  // ---------- Inmobiliaria ----------
  var listaProps = document.getElementById('lista-propiedades');
  if (listaProps) {
    cargar('./data/propiedades.json').then(function (data) {
      var wa = String(data.whatsapp || '').replace(/\D/g, '');
      var items = (data.propiedades || []).filter(function (p) { return p.visible !== false; });
      if (typeof galleryData === 'object' && galleryData) {
        Object.keys(galleryData).forEach(function (k) { delete galleryData[k]; });
      }
      if (!items.length) { listaProps.innerHTML = '<p class="text-gray-600">No hay propiedades publicadas en este momento.</p>'; return; }
      listaProps.innerHTML = items.map(function (p, i) {
        var n = i + 1;
        var fotos = (p.fotos || []).map(safeUrl).filter(Boolean);
        if (typeof galleryData === 'object' && galleryData) galleryData[n] = fotos;
        var portada = fotos[0] || '';
        var msg = 'Buenos días, me comunico desde la web ciprodec.com, estoy interesado en la propiedad "' + (p.titulo || '') + '". Agradecería que se ponga en contacto conmigo lo antes posible.';
        var link = wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg) : '#';
        var mapa = safeUrl(p.mapa);
        var ubic = '<i class="fa-solid fa-location-dot"></i> ' + esc(p.ubicacion);
        return '<div id="' + esc(p.id) + '" class="bg-white rounded-lg shadow-md overflow-hidden">' +
          '<div class="gallery-container" role="button" tabindex="0" aria-label="Ver fotos de ' + esc(p.titulo) + '" onclick="openGallery(' + n + ')" style="background-image: url(\'' + esc(portada) + '\')"></div>' +
          '<div class="p-3"><h2 class="text-2xl font-bold mb-2">' + esc(p.titulo) + '</h2>' +
          '<p class="text-gray-600 mb-2">' + (mapa ? '<a href="' + esc(mapa) + '" class="hover:text-red-500">' + ubic + '</a>' : ubic) + '</p>' +
          '<div class="grid grid-cols-2 gap-4 mb-4 text-sm"><div>' +
          '<p><span class="text-sm"><i class="fa-regular fa-map"></i> Terreno:</span> <strong>' + esc(p.terreno || '-') + '</strong></p>' +
          '<p><span class="text-sm"><i class="fa-solid fa-house-chimney"></i> Construido:</span> <strong>' + esc(p.construido || '-') + '</strong></p></div><div>' +
          '<p><span class="text-sm"><i class="fa-solid fa-bed"></i> Habitaciones:</span> <strong>' + esc(p.habitaciones || '-') + '</strong></p>' +
          '<p><span class="text-sm"><i class="fa-solid fa-shower"></i> Baños:</span> <strong>' + esc(p.banos || '-') + '</strong></p></div></div>' +
          '<p class="mb-4"><span class="text-sm"><i class="fa-solid fa-coins"></i> Condición:</span> <strong>' + esc(p.condicion || '') + '</strong></p>' +
          '<div class="flex justify-between items-center"><p class="text-2xl font-bold text-black">' + esc(p.precio || '') + '</p>' +
          '<a href="' + esc(link) + '" class="bg-black text-white px-4 py-2 rounded hover:bg-slate-900 transition text-sm/6 font-semibold">Contacto</a></div></div></div>';
      }).join('');
      listaProps.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('gallery-container')) { e.preventDefault(); e.target.click(); }
      });
      irAlAncla();
    }).catch(function () {
      listaProps.innerHTML = '<p class="text-gray-600">No se pudieron cargar las propiedades.</p>';
    });
  }
})();
