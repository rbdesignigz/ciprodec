/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {

      animation:{
        blob: 'blob 7s infinite',
      },

      keyframes:{
        blob:{
          '0%':{
            transform:'transtale(0px,0px) scale(1)',
        },
        '33%':{
          transform:'transtale(20px,-50px) scale(1.2)',
        },
        '66%':{
          transform:'transtale(20px,20px) scale(0.8)',
        },
        '100%':{
          transform:'transtale(0px,0px) scale(1)',
        },
      },
    },
  },
  plugins: [],
}
}



