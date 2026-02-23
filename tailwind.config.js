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
          bg: '#030808',          // Deep dark with subtle teal undertone
          card: '#0A1414',        // Dark card with teal tint
          surface: '#132020',     // Surface with depth
          accent: '#00D4AA',      // Vibrant teal - primary accent
          'accent-glow': '#00D4AA40',
          cyan: '#06B6D4',        // Cyan for secondary accents
          'cyan-glow': '#06B6D440',
          teal: '#14B8A6',        // Teal for tertiary
          muted: '#5E7D7D',       // Teal-tinted muted
          white: '#E8F0EF'        // Warm off-white
        }
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(180deg, rgba(19, 32, 32, 0.7) 0%, rgba(10, 20, 20, 0.4) 100%)',
        'accent-gradient': 'linear-gradient(135deg, #00D4AA 0%, #06B6D4 100%)',
        'accent-gradient-r': 'linear-gradient(to right, #00D4AA, #06B6D4)',
        'card-gradient': 'linear-gradient(180deg, rgba(0, 212, 170, 0.05) 0%, rgba(6, 182, 212, 0.02) 100%)',
        'hero-glow': 'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 212, 170, 0.15)',
        'glow-lg': '0 0 40px rgba(0, 212, 170, 0.2)',
        'glow-accent': '0 4px 30px rgba(0, 212, 170, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'in': 'fadeIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      }
    },
  },
  plugins: [],
}
