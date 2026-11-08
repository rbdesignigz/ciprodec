/* CIPRODEC – configuración del sitio.
   1) Pegá acá la configuración web de Firebase (Consola Firebase > Configuración del proyecto > Tus apps > Web).
      Mientras quede en null, la web funciona igual leyendo los archivos de la carpeta data/ (solo lectura).
   2) superadmin: el email del administrador principal. Tiene que ser el MISMO que figura en firestore.rules.
      Este usuario siempre puede entrar al panel y dar de alta a los demás. */
window.CIPRODEC_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCKi2qRinJKDhMS2TbiMjhcJA9_81b10qc",
    authDomain: "ciprodec-c.firebaseapp.com",
    projectId: "ciprodec-c",
    storageBucket: "ciprodec-c.firebasestorage.app",
    messagingSenderId: "10308836558",
    appId: "1:10308836558:web:674564a753195c087b849f",
    measurementId: "G-L6ZDQG9LZC"
  },
  superadmin: "pablo.da.ber@gmail.com",
  whatsapp: "595986573190"
};
