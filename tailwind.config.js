/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          magenta: '#D81B60',
          magentaHover: '#AD1457',
          vinho: '#4A041C',
          vinhoEscuro: '#2D0210',
          preto: '#0F0F12',
          cinzaEscuro: '#1E1E24',
          cinzaMedio: '#71717A',
          cinzaClaro: '#F4F4F6',
        }
      },
      fontFamily: {
        sans: ['Bahnschrift', 'Barlow Condensed', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
