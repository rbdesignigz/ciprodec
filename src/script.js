// const caja = document.querySelector("#caja");
// const texto = document.querySelector("#texto");


// caja.addEventListener("click", cambiarcolor);


// function cambiarcolor(){
//   caja.classList.toggle("bg-orange-200");
//   caja.classList.toggle("bg-gray-500");
//   texto.classList.toggle("font-light");
//   console.log("click");
// }


//Animar Menú
const mobilemenu = document.querySelector("#mobilemenu");

function closeMenuu(){
    mobilemenu.classList.toggle("hidden");
    console.log('close menú');
}

function openMenuu(){
    mobilemenu.classList.toggle("hidden");
    console.log('abrió menú');
}
//fin animar menú


//Galería de imágenes

 // Datos de las galerías (imágenes para cada propiedad)
        const galleryData = {
            1: [
                "./img/inmobiliaria/ven0001/Imagen1.jpg",
                "./img/inmobiliaria/ven0001/Imagen2.jpg",
                "./img/inmobiliaria/ven0001/Imagen3.jpg",
                "./img/inmobiliaria/ven0001/Imagen4.jpg",
                "./img/inmobiliaria/ven0001/Imagen5.jpg",
                "./img/inmobiliaria/ven0001/Imagen6.jpg",
            ],
            2: [
                "./img/inmobiliaria/ven0002/Imagen7.jpg",
                "./img/inmobiliaria/ven0002/Imagen8.jpg",
                "./img/inmobiliaria/ven0002/Imagen9.jpg",
                "./img/inmobiliaria/ven0002/Imagen10.jpg",

            ],
            3: [
                "./img/inmobiliaria/ven0003/Imagen11.jpg",
                "./img/inmobiliaria/ven0003/Imagen12.jpg",
                "./img/inmobiliaria/ven0003/Imagen13.jpg",
                "./img/inmobiliaria/ven0003/Imagen14.jpg",
            ],
            4: [
                "./img/inmobiliaria/ven0004/01.jpeg",
                "./img/inmobiliaria/ven0004/02.jpeg",
                "./img/inmobiliaria/ven0004/03.jpeg",
                
            ],
            5: [
                "./img/inmobiliaria/ven0005/01.jpeg",
                "./img/inmobiliaria/ven0005/02.jpeg",
                
                
            ],
            6: [
                "./img/inmobiliaria/ven0006/01.jpeg",
                "./img/inmobiliaria/ven0006/02.jpeg",
                "./img/inmobiliaria/ven0006/03.jpeg",
                "./img/inmobiliaria/ven0006/04.jpeg",
                "./img/inmobiliaria/ven0006/05.jpeg",
                
            ]
        };
        
        let currentGallery = 1;
        let currentSlide = 0;
        
        function openGallery(galleryId) {
            currentGallery = galleryId;
            currentSlide = 0;
            
            const modal = document.getElementById('gallery-modal');
            const carouselImages = document.getElementById('carousel-images');
            const carouselIndicators = document.getElementById('carousel-indicators');
            
            // Limpiar contenido previo
            carouselImages.innerHTML = '';
            carouselIndicators.innerHTML = '';
            
            // Agregar imágenes al carrusel
            galleryData[galleryId].forEach((imageUrl, index) => {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = `Imagen ${index + 1} de la propiedad`;
                img.classList.add('carousel-image');
                if (index === 0) img.classList.add('active');
                carouselImages.appendChild(img);
                
                // Agregar indicadores
                const indicator = document.createElement('div');
                indicator.classList.add('indicator');
                if (index === 0) indicator.classList.add('active');
                indicator.onclick = () => goToSlide(index);
                carouselIndicators.appendChild(indicator);
            });
            
            // Mostrar el modal
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevenir scroll en el fondo
        }
        
        function closeGallery() {
            const modal = document.getElementById('gallery-modal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restaurar scroll
        }
        
        function changeSlide(direction) {
            const slides = document.querySelectorAll('.carousel-image');
            const indicators = document.querySelectorAll('.indicator');
            
            // Remover clase activa de la diapositiva actual
            slides[currentSlide].classList.remove('active');
            indicators[currentSlide].classList.remove('active');
            
            // Calcular nueva diapositiva
            currentSlide = (currentSlide + direction + slides.length) % slides.length;
            
            // Agregar clase activa a la nueva diapositiva
            slides[currentSlide].classList.add('active');
            indicators[currentSlide].classList.add('active');
        }
        
        function goToSlide(slideIndex) {
            const slides = document.querySelectorAll('.carousel-image');
            const indicators = document.querySelectorAll('.indicator');
            
            // Remover clase activa de la diapositiva actual
            slides[currentSlide].classList.remove('active');
            indicators[currentSlide].classList.remove('active');
            
            // Establecer nueva diapositiva
            currentSlide = slideIndex;
            
            // Agregar clase activa a la nueva diapositiva
            slides[currentSlide].classList.add('active');
            indicators[currentSlide].classList.add('active');
        }
        
        // Cerrar galería con la tecla Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeGallery();
            }
        });

//fin galería de imágenes


//share blog

            document.getElementById('shareButton').addEventListener('click', async () => {
              // 1. Verificar soporte del navegador
              if (navigator.share) {
                try {
                  // 2. Definir los datos a compartir
                  await navigator.share({
                    title: 'Seguridad e Higiene', // Título que se compartirá
                    text: 'Iguazú será sede de la primera jornada internacional sobre seguridad e higiene laboral', // Descripción/texto
                    url: 'https://ciprodec.com/blog.html#seghiglab' // La URL del producto que quieres compartir
                  });
                  console.log('Contenido compartido con éxito.');
                } catch (error) {
                  // Manejar errores (ej. el usuario canceló la acción de compartir)
                  console.error('Error al compartir:', error);
                }
              } else {
                // 3. Fallback (para navegadores que no soportan la API)
                alert('Tu navegador no soporta la función de compartir nativa. Copia el siguiente enlace: https://ciprodec.com/blog.html#seghiglab');
                // Alternativamente, puedes mostrar tu propio modal de compartir personalizado aquí.
              }
            });