/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'landscape-mobile': {
          'raw': '(max-width: 900px) and (orientation: landscape)'
        },
      },
    },
  },
  plugins: [],
};
