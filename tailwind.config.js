/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'frita-yellow': '#FFD56B',
        'frita-red': '#FF4040',
        'frita-orange': '#FFB700',
        'frita-cream': '#FFFDF5',
        // --- Restaurando colores originales (Chunky Theme) para la app base ---
        'chunky-primary': '#FF4040', // The login view uses 'primary'
        'chunky-main': '#FF4040', // Admin forms use 'main'
        'chunky-secondary': '#FFB700', // Aliased to frita-orange
        'chunky-dark': '#2D3748', // Text color
        'chunky-light': '#FFD56B', // Added custom yellow bg
        'chunky-bg': '#FFD56B',
      },
      borderRadius: {
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px', // Curvas masivas (casi pill-shape)
        'full': '9999px', // Para botones tipo píldora
      },
      boxShadow: {
        // Sombras difusas y elegantes (sin el offset duro)
        'chunky': '0 4px 15px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.05)',
        'chunky-lg': '0 10px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.03)',
        'chunky-active': 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
        'floating': '0 20px 40px -10px rgba(0,0,0,0.2)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%) translateX(-50%)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateX(-50%)', opacity: '1' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in': 'bounceIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
