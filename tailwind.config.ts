import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3ee',
          100: '#fde4d3',
          200: '#fbc5a5',
          300: '#f89e6d',
          400: '#f47033',
          500: '#f1500f',
          600: '#e23605',
          700: '#bb2506',
          800: '#951f0d',
          900: '#781c0e',
          950: '#410b04',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
