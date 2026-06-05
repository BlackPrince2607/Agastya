/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        md: {
          background: '#141315',
          surface: '#141315',
          'on-background': '#f2eef5',
          'on-surface-variant': '#ddd6e3',
          'on-primary-container': '#c8bdd8',
          primary: '#d3beeb',
          'on-primary': '#38294d',
        },
        cosmic: {
          void: '#05020a',
          abyss: '#0a0714',
          night: '#0f0a22',
          nebula: '#1a1035',
          haze: '#2d2160',
        },
        stitch: {
          signal: '#00CED1',
          magenta: '#e879f9',
          violet: '#8b5cf6',
          obsidian: '#080612',
        },
        mist: '#e8e4ff',
        ion: '#7c6cff',
      },
      fontFamily: {
        display: ['System'],
        inter: ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'noto-serif': ['NotoSerif_700Bold'],
        'noto-serif-md': ['NotoSerif_500Medium'],
        'space-grotesk': ['SpaceGrotesk_600SemiBold'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(124,108,255,0.38)',
        'glow-teal': '0 0 45px rgba(0,206,209,0.35)',
        'glow-sm': '0 0 22px rgba(99,102,241,0.28)',
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
