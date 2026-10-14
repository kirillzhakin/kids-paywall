import type { Offer } from '../../shared/types/paywall'

/**
 * The single source of truth for tariffs.
 *
 * In a real product this would be an admin panel / pricing service row set;
 * here it is a static catalogue served by GET /api/offers. All prices are
 * test values — no real payment provider is involved.
 */

const YEARLY_PRICE_MINOR = 179_000 // 1 790 ₽
const MONTHLY_PRICE_MINOR = 39_900 // 399 ₽

/** 1 790 ₽ vs 12 × 399 ₽ = 4 788 ₽ → −63%. */
const yearlyDiscount = Math.round(
  (1 - YEARLY_PRICE_MINOR / (MONTHLY_PRICE_MINOR * 12)) * 100,
)

export const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

/**
 * Russian currency formatting inserts non-breaking spaces (1 790 ₽).
 * The design uses plain spaces, so normalise them here — one consistent
 * string is used by both the API payload and the UI.
 */
export const formatRub = (minor: number): string =>
  rub.format(minor / 100).replace(/\u00a0/g, ' ')

/** What the full access unlocks — shown once, below the cards. */
export const unlocks: string[] = [
  'Все 120 уровней и 6 островов',
  'Без рекламы и ожидания энергии',
  'Ежедневные задания и боссы',
  'Игра без интернета',
]

export const offers: Offer[] = [
  {
    id: 'yearly',
    plan: 'yearly',
    name: 'Год',
    title: 'Полный доступ',
    description: 'Оплата раз в год, списаний больше не будет',
    priceMinor: YEARLY_PRICE_MINOR,
    currency: 'RUB',
    periodLabel: 'раз в год',
    priceLabel: formatRub(YEARLY_PRICE_MINOR),
    comparePriceLabel: formatRub(MONTHLY_PRICE_MINOR * 12),
    discountPercent: yearlyDiscount,
    badge: `Выгодно −${yearlyDiscount}%`,
    highlights: ['2 месяца в подарок', 'Цена не изменится весь год'],
    ctaTitle: `Открыть за ${formatRub(YEARLY_PRICE_MINOR)}`,
    ctaSubtitle: 'Полный доступ на год',
    ctaPriceLabel: `${formatRub(YEARLY_PRICE_MINOR)} / год`,
    active: true,
    sortOrder: 1,
  },
  {
    id: 'monthly',
    plan: 'monthly',
    name: 'Месяц',
    title: 'Полный доступ',
    description: 'Оплата каждый месяц, отмена в один тап',
    priceMinor: MONTHLY_PRICE_MINOR,
    currency: 'RUB',
    periodLabel: 'каждый месяц',
    priceLabel: formatRub(MONTHLY_PRICE_MINOR),
    comparePriceLabel: null,
    discountPercent: 0,
    badge: null,
    highlights: ['Отмена в любой момент', 'Сначала попробуйте месяц'],
    ctaTitle: `Открыть за ${formatRub(MONTHLY_PRICE_MINOR)}`,
    ctaSubtitle: 'Полный доступ на месяц',
    ctaPriceLabel: `${formatRub(MONTHLY_PRICE_MINOR)} / мес`,
    active: true,
    sortOrder: 2,
  },
]

export const defaultOfferId = 'yearly'

export const findOffer = (id: string | undefined | null): Offer | undefined =>
  offers.find(offer => offer.id === id)
