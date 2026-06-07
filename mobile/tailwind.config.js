/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Azul Confiança — primária (substitui o laranja)
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Verde Missão — acento de conclusão
        accent: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          900: '#064E3B',
        },
        // Ardósia — neutros (mesmo set do frontend web)
        slate2: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Mantemos `primary` por retrocompat de classes existentes
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
      },
      // Hermes/RN exige nome exato da fonte por peso — não há fallback chain.
      // Use `font-display` (semibold padrão) + utilitários `font-display-{peso}`
      // para títulos; `font-sans` para corpo.
      fontFamily: {
        // `font-display` mantém o default Bold (alinhado ao chain antigo) para
        // não regredir telas já parcialmente migradas que combinam
        // `font-display` + `font-bold`/`font-extrabold` (RN ignora fontWeight
        // com famílias custom, então o peso é dado pela própria fontFamily).
        'display':            ['PlusJakartaSans_700Bold'],
        'display-medium':     ['PlusJakartaSans_500Medium'],
        'display-semibold':   ['PlusJakartaSans_600SemiBold'],
        'display-bold':       ['PlusJakartaSans_700Bold'],
        'display-extrabold':  ['PlusJakartaSans_800ExtraBold'],
        'sans':               ['DMSans_400Regular'],
        'sans-medium':        ['DMSans_500Medium'],
        'sans-semibold':      ['DMSans_600SemiBold'],
      },
    },
  },
  plugins: [],
}
