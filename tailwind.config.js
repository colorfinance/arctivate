const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables (see globals.css) so the whole app can flip
        // between dark (default) and light via a `.light` class on <html>.
        // white/black are overridden too, so literal text-white / bg-black/…
        // utilities across the app respond to the theme automatically.
        white: 'rgb(var(--c-white) / <alpha-value>)',
        black: 'rgb(var(--c-black) / <alpha-value>)',
        arc: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          card: 'rgb(var(--c-card) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          accent: 'rgb(var(--c-accent) / <alpha-value>)',
          'accent-glow': '#00D4AA40',
          cyan: 'rgb(var(--c-cyan) / <alpha-value>)',
          'cyan-glow': '#06B6D440',
          teal: 'rgb(var(--c-teal) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)',
          white: 'rgb(var(--c-fg) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(180deg, rgb(var(--c-surface) / 0.7) 0%, rgb(var(--c-card) / 0.4) 100%)',
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
