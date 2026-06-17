import { defineConfig, presetAttributify, presetIcons, presetUno, presetWebFonts } from 'unocss'

export default defineConfig({
  shortcuts: {
    'console-card': 'rounded-[var(--theme-radius-lg)] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[var(--theme-shadow-sm)]',
    'console-panel': 'console-card p-5',
    'console-muted': 'text-[var(--theme-text-muted)]',
    'cartoon-card': 'console-card transition-colors duration-160',
    'cartoon-btn': 'rounded-[var(--theme-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2 font-semibold text-[var(--theme-text)] transition-colors duration-160 hover:bg-[var(--theme-surface-soft)]',
    'farm-gradient': 'bg-[var(--theme-gradient)]',
    'farm-gradient-warm': 'bg-[var(--theme-gradient)]',
    'soil-bg': 'bg-[var(--theme-surface-soft)]',
    'grass-bg': 'bg-[var(--theme-surface-soft)]',
    'sky-bg': 'bg-[var(--theme-surface-soft)]',
    'farm-card': 'console-card p-4',
    'farm-panel': 'console-card p-5',
    'farm-input': 'rounded-[var(--theme-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2.5 text-[var(--theme-text)] outline-none transition-all focus:border-[var(--theme-primary)] focus:ring-3 focus:ring-[var(--theme-primary)]/15',
    'farm-badge': 'inline-flex items-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--theme-primary)]',
    'farm-title': 'text-2xl font-semibold text-[var(--theme-text)]',
    'farm-text': 'text-[var(--theme-text)]',
    'wood-frame': 'console-card',
    'grass-land': 'rounded-[var(--theme-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]',
    'soil-land': 'rounded-[var(--theme-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]',
  },
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        'src/**/*.{js,ts}',
      ],
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
      collections: {
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default),
        fas: () => import('@iconify-json/fa-solid/icons.json').then(i => i.default),
        'svg-spinners': () => import('@iconify-json/svg-spinners/icons.json').then(i => i.default),
      },
    }),
    presetWebFonts({
      fonts: {
        sans: 'Nunito',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
        display: 'ZCOOL KuaiLe',
      },
    }),
  ],
})
