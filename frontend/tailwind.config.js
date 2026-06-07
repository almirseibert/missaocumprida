/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
          700: '#1D4ED8', // PRINCIPAL
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Verde Missão — acento de conclusão
        accent: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          500: '#10B981',
          600: '#059669', // PRINCIPAL
          700: '#047857',
          900: '#064E3B',
        },
        // Ardósia — neutros
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
      },
      fontFamily: {
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-body)',    'DM Sans',           'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1E40AF 0%, #047857 100%)',
        'logo-gradient':  'linear-gradient(135deg, #1D4ED8 0%, #059669 100%)',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        'elv-1': '0 1px 4px rgba(0,0,0,.06)',
        'elv-2': '0 4px 16px rgba(0,0,0,.08)',
        'elv-3': '0 8px 32px rgba(0,0,0,.12)',
        'elv-4': '0 16px 48px rgba(0,0,0,.16)',
        'brand-soft': '0 4px 16px rgba(29,78,216,.12)',
      },
    },
  },
  plugins: [],
}
