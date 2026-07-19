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
        // Remap 2.0 "Verde Missão": verde-esmeralda é a cor de AÇÃO (CTA único,
        // link ativo, preço). Azul fica reservado a confiança (selo Pro, links
        // institucionais, banners de segurança) via escala `trust`.
        brand: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669', // PRINCIPAL — CTA
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Azul Confiança — institucional (selo Verificado Pro, TrustBanner)
        trust: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // PRINCIPAL — selo/link
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // `accent` aponta para a mesma escala verde (retrocompat)
        accent: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Papel quente + tinta (fundos e texto do mockup Verde Missão)
        paper:  '#F8F7F4',
        sunken: '#F1EFEA',
        line:   '#E7E5E0',
        ink:    '#101828',
        soft:   '#475467',
        mute:   '#98A2B3',
        star:   '#F59E0B',
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
        // Gradientes verde-dominantes do Verde Missão (azul só como apoio)
        'brand-gradient': 'linear-gradient(135deg, #047857 0%, #059669 60%, #10B981 100%)',
        'logo-gradient':  'linear-gradient(135deg, #059669 0%, #2563EB 100%)',
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
        'brand-soft': '0 4px 16px rgba(5,150,105,.14)',
      },
    },
  },
  plugins: [],
}
