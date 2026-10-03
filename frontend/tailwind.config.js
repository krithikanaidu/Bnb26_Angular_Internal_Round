/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand accents
        'hot-pink': '#EE2B6C',
        'brand-orange': '#E85A2B',
        'soft-pink': '#F4B1D6',
        'blush': '#FCDDF0',
        'cream': '#F0E8D8',
        'ink': '#141414',
        'folder-blue': '#6EC6F5',
        'folder-blue-deep': '#4AA8E8',
        'olive': '#A5A12A',
        'sticker-yellow': '#FFD23F',
        'sticker-purple': '#8E2DA8',
        // Status dots
        'status-green': '#2DC653',
        'status-red': '#E5383B',
        'status-purple': '#A855F7',
        'status-orange': '#FF8A1F',
      },
      fontFamily: {
        display: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        script: ['"Pinyon Script"', 'cursive'],
        serif: ['"Bodoni Moda"', 'Georgia', 'serif'],
        italic: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'folder': '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
        'folder-hover': '0 20px 50px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)',
        'dialog': '0 24px 60px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.12)',
        'sticker': '0 4px 12px rgba(0,0,0,0.15)',
        'paper': '0 2px 8px rgba(0,0,0,0.06)',
      },
      animation: {
        'bob': 'bob 4s ease-in-out infinite',
        'bob-slow': 'bob 6s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'draw-on': 'draw-on 1.2s ease-out forwards',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'tilt': 'tilt 5s ease-in-out infinite',
        'drift': 'drift 30s linear infinite',
      },
      keyframes: {
        'bob': {
          '0%,100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(2deg)' },
        },
        'pulse-dot': {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.3)', opacity: '0.7' },
        },
        'draw-on': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.8) rotate(-3deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'tilt': {
          '0%,100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'drift': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
