// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // The paywall is server-rendered, prices come from a live server route.
  ssr: true,

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Чудо-Остров — полный доступ',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
        },
        { name: 'theme-color', content: '#f4f1ff' },
        {
          name: 'description',
          content: 'Paywall детской игры: два тарифа, тестовая покупка и запись в базу данных.',
        },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    // Postgres (Neon) connection string; the DATABASE_URL env var overrides it.
    databaseUrl: '',
    // Local development database file (SQLite).
    sqlitePath: '.data/paywall.sqlite',
    public: {
      appName: 'Чудо-Остров',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
