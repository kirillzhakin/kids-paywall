import type {
  Entitlement,
  Offer,
  OffersResponse,
  PurchaseRecord,
  PurchaseResponse,
  RestoreResponse,
} from '../../shared/types/paywall'

export type PaywallPhase = 'loading' | 'ready' | 'error' | 'success'

export interface SuccessDetails {
  planTitle: string
  amountLabel: string
  purchasedAtLabel: string
  purchaseId: string
  offerId: string
}

const EMPTY_ENTITLEMENT: Entitlement = {
  active: false,
  offerId: null,
  planTitle: null,
  purchasedAt: null,
}

/** Demo switches used for screenshots / manual QA of the error branch. */
function readDemoFlag(): 'ok' | 'error' | 'slow' | 'success' {
  if (import.meta.server) return 'ok'
  const value = new URLSearchParams(window.location.search).get('demo')
  if (value === 'error' || value === 'slow' || value === 'success') return value
  return 'ok'
}

const formatMoney = (minor: number, currency = 'RUB'): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
    .format(minor / 100)
    .replace(/\u00a0/g, ' ')

const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(new Date(iso))

/**
 * Single state container for the paywall screen: offers, selection,
 * entitlement and the loading / error / success phases.
 */
export function usePaywall() {
  // SSR-safe $fetch: during server rendering relative URLs are resolved
  // against the incoming request, on the client it is a plain fetch.
  const fetcher = useRequestFetch()

  const offers = useState<Offer[]>('paywall:offers', () => [])
  const unlocks = useState<string[]>('paywall:unlocks', () => [])
  const selectedOfferId = useState<string>('paywall:selected', () => '')
  const entitlement = useState<Entitlement>('paywall:entitlement', () => ({ ...EMPTY_ENTITLEMENT }))
  const phase = useState<PaywallPhase>('paywall:phase', () => 'loading')
  const isLoadingOffers = useState<boolean>('paywall:loading-offers', () => false)
  const isPurchasing = useState<boolean>('paywall:purchasing', () => false)
  const isRestoring = useState<boolean>('paywall:restoring', () => false)
  const errorMessage = useState<string | null>('paywall:error', () => null)
  const purchaseError = useState<string | null>('paywall:purchase-error', () => null)
  const lastPurchase = useState<PurchaseRecord | null>('paywall:last-purchase', () => null)
  const toast = useState<{ text: string; tone: 'ok' | 'error' } | null>('paywall:toast', () => null)
  const offersLoaded = useState<boolean>('paywall:offers-loaded', () => false)

  const selectedOffer = computed<Offer | null>(
    () => offers.value.find(offer => offer.id === selectedOfferId.value) ?? null,
  )

  const successDetails = computed<SuccessDetails | null>(() => {
    const purchase = lastPurchase.value
    if (!purchase) return null
    return {
      planTitle: purchase.planTitle,
      amountLabel: formatMoney(purchase.amountMinor, purchase.currency),
      purchasedAtLabel: formatDateTime(purchase.createdAt),
      purchaseId: purchase.id,
      offerId: purchase.offerId,
    }
  })

  function showToast(text: string, tone: 'ok' | 'error' = 'ok') {    toast.value = { text, tone }
    if (import.meta.client) {
      window.setTimeout(() => {
        if (toast.value?.text === text) toast.value = null
      }, 2600)
    }
  }

  function select(offerId: string) {
    selectedOfferId.value = offerId
  }

  async function loadOffers(force = false) {
    if (isLoadingOffers.value) return
    if (offersLoaded.value && !force) {
      phase.value = phase.value === 'success' ? 'success' : 'ready'
      return
    }

    isLoadingOffers.value = true
    errorMessage.value = null
    if (phase.value !== 'success') phase.value = 'loading'

    try {
      const demo = readDemoFlag()

      if (demo === 'error') {
        await new Promise(resolve => setTimeout(resolve, 900))
        throw new Error('network')
      }
      if (demo === 'slow') {
        await new Promise(resolve => setTimeout(resolve, 6000))
      }

      const data = await fetcher<OffersResponse>('/api/offers')
      offers.value = data.offers
      unlocks.value = data.unlocks ?? []
      offersLoaded.value = true
      if (!selectedOfferId.value || !data.offers.some(o => o.id === selectedOfferId.value)) {
        selectedOfferId.value = data.defaultOfferId || data.offers[0]?.id || ''
      }
      if (phase.value !== 'success') phase.value = 'ready'
    } catch {
      phase.value = 'error'
      errorMessage.value = 'Не удалось загрузить тарифы. Проверьте соединение.'
    } finally {
      isLoadingOffers.value = false
    }
  }

  async function purchase() {
    const offer = selectedOffer.value
    if (!offer || isPurchasing.value) return

    isPurchasing.value = true
    errorMessage.value = null
    purchaseError.value = null

    try {
      const data = await fetcher<PurchaseResponse>('/api/purchase', {
        method: 'POST',
        body: { offerId: offer.id, deviceId: getDeviceId() },
      })
      lastPurchase.value = data.purchase
      entitlement.value = data.entitlement
      phase.value = 'success'
    } catch (error: unknown) {
      const message =
        (error as { data?: { message?: string } })?.data?.message ??
        'Покупка не прошла. Попробуйте ещё раз.'
      errorMessage.value = message
      purchaseError.value = message
      showToast(message, 'error')
    } finally {
      isPurchasing.value = false
    }
  }

  async function restore() {
    if (isRestoring.value) return
    isRestoring.value = true
    try {
      const data = await fetcher<RestoreResponse>('/api/restore', {
        method: 'POST',
        body: { deviceId: getDeviceId() },
      })
      // Remember the state before the lookup: a second tap on «Восстановить
      // покупки» should not look like a fresh restore.
      const wasActive = entitlement.value.active

      entitlement.value = data.entitlement
      if (data.entitlement.active && data.purchases[0]) {
        lastPurchase.value = data.purchases[0]
        showToast(wasActive ? 'Полный доступ уже активен' : 'Покупки восстановлены', 'ok')
      } else {
        showToast('Покупок на этом устройстве не найдено', 'ok')
      }
    } catch {
      showToast('Не удалось проверить покупки', 'error')
    } finally {
      isRestoring.value = false
    }
  }

  function closeSuccess() {
    phase.value = 'ready'
  }

  return {
    offers,
    unlocks,
    selectedOfferId,
    selectedOffer,
    entitlement,
    phase,
    isLoadingOffers,
    isPurchasing,
    isRestoring,
    errorMessage,
    purchaseError,
    successDetails,
    toast,
    select,
    loadOffers,
    purchase,
    restore,
    closeSuccess,
  }
}
