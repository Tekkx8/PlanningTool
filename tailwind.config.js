/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#0A1F44',
        'app-black': 'rgba(0, 0, 0, 0.9)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      height: {
        'panel': 'calc(100vh - 16rem)',
        'dashboard': 'calc(100vh - 8rem)',
      },
      container: {
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1920px',
        },
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
      gridTemplateColumns: {
        '24': 'repeat(24, minmax(0, 1fr))',
        'cards': 'repeat(auto-fit, minmax(300px, 1fr))',
        'dashboard': 'repeat(auto-fit, minmax(400px, 1fr))',
      },
      maxWidth: {
        '8xl': '1920px',
      },
      screens: {
        '2xl': '1920px',
      },
      minHeight: {
        'card': '200px',
        'panel': '400px',
      },
    },
  },
  plugins: [],
};