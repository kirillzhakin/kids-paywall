/**
 * Warm the tariff catalogue as soon as the paywall is opened.
 *
 * Declared as a plain object (no setup function) on purpose: Nuxt's plugin
 * metadata parser skips files without a callable second argument, which keeps
 * the dev server free of the `oxc-walker` fallback warning.
 */
export default defineNuxtPlugin({
  name: 'paywall-bootstrap',
  enforce: 'pre',
  setup() {
    const { loadOffers } = usePaywall()
    loadOffers()
  },
})
