/* CIPRODEC – configuración del sitio.
   1) Pegá acá la configuración web de Firebase (Consola Firebase > Configuración del proyecto > Tus apps > Web).
      Mientras quede en null, la web funciona igual leyendo los archivos de la carpeta data/ (solo lectura).
   2) superadmin: el email del administrador principal. Tiene que ser el MISMO que figura en firestore.rules.
      Este usuario siempre puede entrar al panel y dar de alta a los demás. */
window.CIPRODEC_CONFIG = {
  firebase: null,
  /* Ejemplo:
  firebase: {
    apiKey: "AIza...",
    authDomain: "ciprodec-web.firebaseapp.com",
    projectId: "ciprodec-web",
    appId: "1:123456789:web:abc123"
  }, */
  superadmin: "",
  whatsapp: "595986573190"
};
