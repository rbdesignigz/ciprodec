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