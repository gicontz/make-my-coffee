import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        espresso: {
          50:  '#FAF6F1',
          100: '#F5E6D3',
          200: '#E8C9A0',
          300: '#D4A96A',
          400: '#C8860A',
          500: '#A86E08',
          600: '#8B5E0A',
          700: '#5C3317',
          800: '#2C1810',
          900: '#1C0A00',
        },
      },
    },
  },
  plugins: [],
}

export default config
