const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          bg: '#050505',       // Darker, richer black
          card: '#121214',     // Subtle off-black
          surface: '#1E1E22',  // Lighter surface
          accent: '#FF3B00',   // Sharper International Orange
          'accent-glow': '#FF3B0040',
          muted: '#71717A',
          white: '#EDEDED'
        }
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(180deg, rgba(30, 30, 34, 0.7) 0%, rgba(18, 18, 20, 0.4) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 59, 0, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
