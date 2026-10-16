# Мини-учебник по Nuxt на этом приложении

Этот текст — не пересказ документации, а разбор **рабочего проекта**: как устроен
paywall «Чудо-Остров», почему в нём приняты те или иные решения и какие приёмы
Nuxt 4 в нём использованы. Все примеры — из настоящего кода, ссылки на файлы
кликабельны.

Проект: [github.com/kirillzhakin/kids-paywall](https://github.com/kirillzhakin/kids-paywall) ·
живой сервис: [kids-paywall-one.vercel.app](https://kids-paywall-one.vercel.app)

---

## Часть I. Как работает система

### 1. Что вообще делает приложение

Пользователь открывает в webview экран paywall. Ему показывают два тарифа,
он выбирает один и нажимает кнопку. Приложение отправляет запрос на сервер,
сервер записывает «покупку» в базу и возвращает подтверждение. Экран
переключается в состояние успеха.

Два ключевых слова в этом описании — **экран** и **покупка**. Экран живёт
в браузере, покупка — на сервере. Всё остальное в проекте — способ надёжно
связать одно с другим.

### 2. Слои и кто за что отвечает

```
        браузер / webview                        сервер (Node)                 база
┌──────────────────────────────┐   HTTP   ┌────────────────────────┐   SQL   ┌──────────┐
│  app/pages/index.vue         │ ───────► │  server/api/*.ts       │ ──────► │ SQLite   │
│      использует              │ ◄─────── │      использует        │ ◄────── │ Postgres │
│  app/composables/usePaywall  │   JSON   │  server/utils/         │         │ (Neon)   │
│  app/components/Paywall*     │          │      purchases.ts      │         └──────────┘
└──────────────────────────────┘          └────────────────────────┘
              ▲                                       ▲
              └────────── shared/types/paywall.ts ────┘
                        (один контракт на двоих)
```

* **`app/`** — всё, что исполняется в браузере: Vue-компоненты, состояние,
  стили. Это «фронтенд».
* **`server/`** — всё, что исполняется в Node: обработчики HTTP-запросов и
  работа с базой. Это «бэкенд». Отдельного сервиса нет: Nitro (сервер Nuxt)
  собирает эти файлы в один серверный бандл.
* **`shared/`** — типы, которые импортируют обе стороны. Если поменять поле в
  `shared/types/paywall.ts`, `pnpm typecheck` упадёт сразу в обоих местах.

### 3. Жизнь одного запроса: полный путь покупки

Разберём, что происходит после нажатия «Открыть за 1 790 ₽».

**Шаг 1. Клик по кнопке.** Компонент
[`PaywallCta.vue`](../app/components/PaywallCta.vue) эмитит событие `purchase`,
страница [`index.vue`](../app/pages/index.vue) вызывает `purchase()` из
composable.

**Шаг 2. Composable собирает запрос** ([`usePaywall.ts`](../app/composables/usePaywall.ts)):

```ts
const data = await fetcher<PurchaseResponse>('/api/purchase', {
  method: 'POST',
  body: { offerId: offer.id, deviceId: getDeviceId() },
})
```

Здесь `fetcher` — это `useRequestFetch()`, а `deviceId` — идентификатор
устройства из `localStorage` ([`app/utils/device.ts`](../app/utils/device.ts)).
Именно он играет роль «условного пользователя»: по нему потом находится покупка
при восстановлении.

**Шаг 3. Nitro принимает запрос.** Файл
[`server/api/purchase.post.ts`](../server/api/purchase.post.ts) — имя файла
`purchase.post.ts` означает «обработчик POST /api/purchase». Nuxt сам построил
этот маршрут по имени файла, никакой регистрации роутов нет.

**Шаг 4. Валидация.** Обработчик проверяет, что такой тариф существует:

```ts
const offer = findOffer(offerId)
if (!offer || !offer.active) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Unknown offer',
    message: 'Такого тарифа нет. Обновите экран и попробуйте снова.',
  })
}
```

`createError` — стандартный способ отдать ошибку: Nuxt превратит её в
JSON-ответ с кодом 400, а поле `message` доедет до клиента.

**Шаг 5. Защита от двойного тапа.**

```ts
if (tooSoon(`purchase:${deviceId}`)) {
  throw createError({ statusCode: 429, /* ... */ })
}
```

`tooSoon` — утилита из [`server/utils/paywall.ts`](../server/utils/paywall.ts),
которая помнит время последнего вызова по ключу. В webview двойной тап — обычное
дело, и без такой защиты в базе оказались бы две покупки.

**Шаг 6. Запись в базу.** Обработчик получает хранилище и вставляет строку:

```ts
const store = await usePurchasesStore()
await delay(650)                              // имитация ответа платёжного провайдера
const purchase = await store.insert({ id: newId(), deviceId, /* ... */ })
```

Ключевая идея: обработчик **не знает**, куда именно пишет. Он работает с
интерфейсом `PurchasesStore`, а конкретную реализацию выбирает фабрика
(об этом — в главе «Слой хранения»).

**Шаг 7. Ответ клиенту.** Обработчик возвращает объект, Nuxt сериализует его
в JSON:

```ts
return { ok: true, purchase, entitlement: entitlementFrom([purchase]) }
```

**Шаг 8. Экран переключается в успех.** Composable складывает результат в
состояние, а компоненты реагируют на изменение:

```ts
lastPurchase.value = data.purchase
entitlement.value = data.entitlement
phase.value = 'success'      // ← index.vue покажет PaywallSuccess вместо тарифов
```

Обрати внимание: никакой ручной работы с DOM. Мы поменяли одну переменную,
а Vue перерисовал экран. Это и есть реактивность.

### 4. Четыре способа получить данные с сервера

В проекте намеренно показаны разные приёмы — их полезно различать.

| Способ | Где | Зачем |
| --- | --- | --- |
| `useRequestFetch()` + `$fetch` | `loadOffers`, `purchase`, `restore` | универсально: работает и на сервере, и в браузере |
| `$fetch` напрямую | `openHistory` в `index.vue` | простой клиентский запрос |
| Прямая вставка в базу минуя API | `scripts/test-postgres.mjs` | тест адаптера без запуска сервера |
| Чтение из базы через API | `GET /api/purchases` | проверка, что запись реально сохранилась |

### 5. Состояние экрана как конечный автомат

Самая полезная идея проекта: у экрана есть **ровно одна переменная**, которая
определяет, что показать. В [`usePaywall.ts`](../app/composables/usePaywall.ts):

```ts
export type PaywallPhase = 'loading' | 'ready' | 'error' | 'success'
const phase = useState<PaywallPhase>('paywall:phase', () => 'loading')
```

А в [`index.vue`](../app/pages/index.vue) компоненты включаются по этой фазе:

```vue
<PaywallSuccess v-if="phase === 'success' && successDetails" :details="successDetails" />
<template v-else>
  <PaywallHero />
  <PaywallFeatures v-if="unlocks.length && phase !== 'error'" :items="unlocks" />
  <PaywallErrorBanner v-if="phase === 'error'" :message="errorMessage" @retry="loadOffers()" />
  <!-- ... -->
</template>
```

Почему это важно. Если бы мы хранили отдельные флаги (`isLoading`, `isError`,
`isSuccess`), рано или поздно получилось бы невозможное сочетание: «загрузка
идёт и одновременно ошибка». Одна переменная-фаза такое исключает
конструктивно. Это стандартный приём, и в Nuxt он работает точно так же, как в
любом Vue-приложении.

### 6. Что происходит при деплое

```
pnpm build
   ├─ клиентский бандл  → .output/public       (JS, CSS, шрифты)
   └─ серверный бандл   → .output/server       (Node-сервер)
                             │
        NITRO_PRESET=vercel  ▼
        .vercel/output/functions/
            ├─ api/purchase.func    ← отдельная serverless-функция
            ├─ api/offers.func
            ├─ api/health.func
            └─ __fallback.func      ← SSR-страница
```

Важная деталь: **серверные функции в облаке не имеют своей файловой системы**.
Она есть, но временная: следующий запрос может прийти на другой инстанс, где
файла нет. Поэтому в продакшене база — внешняя (Postgres), а локальный SQLite
оставлен только для разработки. Подробнее — в главе «Слой хранения».

---

## Часть II. Nuxt: разбор приёмов

### 7. Структура проекта: четыре каталога и их роли

Nuxt 4 использует каталог `app/` для клиентской части. Полная карта проекта:

```
kids-paywall/
├─ app/                     ← исполняется в браузере (Vue)
│  ├─ app.vue               ← корневой компонент
│  ├─ pages/index.vue       ← страница, маршрут «/» строится из имени файла
│  ├─ components/Paywall*.vue  ← компоненты, подключаются автоматически
│  ├─ composables/usePaywall.ts ← переиспользуемая логика состояния
│  ├─ plugins/paywall.client.ts ← код, исполняемый при старте приложения
│  ├─ utils/device.ts       ← вспомогательные функции
│  └─ assets/css/main.css   ← стили и дизайн-токены
├─ server/                  ← исполняется в Node (Nitro)
│  ├─ api/*.ts              ← HTTP-обработчики, маршруты из имён файлов
│  ├─ data/offers.ts        ← каталог тарифов
│  └─ utils/*.ts            ← утилиты сервера, подключаются автоматически
├─ shared/types/paywall.ts  ← типы, общие для клиента и сервера
├─ public/                  ← статика как есть (favicon)
├─ scripts/                 ← вспомогательные скрипты: тесты, скриншоты
├─ nuxt.config.ts           ← конфигурация
└─ vercel.json              ← настройки деплоя
```

Главное правило: **путь файла — это его роль**. `server/api/purchase.post.ts`
не нужно нигде регистрировать, Nuxt найдёт его сам. Тот же принцип у страниц и
компонентов.

### 8. Автоимпорты и как не запутаться

В коде нет ни одной строки вида `import { ref } from 'vue'` или
`import { defineEventHandler } from 'h3'`. Nuxt импортирует это сам. Работает
для:

* функций Vue (`ref`, `computed`, `watch`),
* функций Nuxt (`useState`, `useFetch`, `navigateTo`, `defineNuxtConfig`),
* **ваших** файлов из `app/composables/`, `app/utils/`, `server/utils/`,
* **ваших** компонентов из `app/components/`.

Когда это мешает, легко запутаться, откуда взялась функция. Практический приём:
если что-то непонятно, ищите имя в `.nuxt/imports.d.ts` — Nuxt генерирует файл
со списком всех автоимпортов.

Иногда автоимпорт конфликтует. В этом проекте так вышло с утилитой `delay`:
она не подхватилась в `server/api/offers.get.ts` и обработчик падал с ошибкой
`delay is not defined`. Решение — явный импорт:

```ts
import { delay } from '../utils/paywall'
```

Вывод: автоимпорты удобны, но явный импорт — это страховка, и он никогда не
лишний.

### 9. SSR, гидрация и почему это важно для webview

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  ssr: true,
  // ...
})
```

При `ssr: true` сервер отдаёт браузеру **готовый HTML**: пользователь видит
разметку ещё до загрузки JavaScript. Затем Vue «оживляет» страницу —
это называется **гидрацией**.

Почему в этом проекте SSR, а не чистая статика:

1. Первый экран появляется мгновенно — критично для webview.
2. Server routes существуют только при живом сервере. Если включить
   `ssr: false` вместе со статической генерацией, `POST /api/purchase`
   работать не будет.

Есть и обратная сторона: код выполняется **дважды** — на сервере и в браузере.
Отсюда правило: не трогать `window` и `localStorage` вне клиента. В
[`usePaywall.ts`](../app/composables/usePaywall.ts) это видно явно:

```ts
function readDemoFlag(): 'ok' | 'error' | 'slow' | 'success' {
  if (import.meta.server) return 'ok'          // ← на сервере window нет
  const value = new URLSearchParams(window.location.search).get('demo')
  // ...
}
```

`import.meta.server` и `import.meta.client` — флаги Nuxt, которые позволяют
писать такой код без `typeof window !== 'undefined'`.

### 10. Реактивность: что и когда использовать

В Nuxt доступны все инструменты Vue плюс один собственный. Разберём по коду.

**`ref` — локальное состояние компонента.** Например, открыт ли лист истории:

```ts
const sheetOpen = ref(false)
```

**`computed` — производное значение.** Выбранный тариф не хранится отдельно,
он вычисляется из списка и id:

```ts
const selectedOffer = computed<Offer | null>(
  () => offers.value.find(offer => offer.id === selectedOfferId.value) ?? null,
)
```

Это лучше, чем хранить выбранный объект целиком: невозможно получить
рассинхрон «id один, объект другой».

**`useState` — состояние, общее для сервера и клиента.** Главный инструмент
Nuxt. Вот как объявлено состояние экрана:

```ts
const offers = useState<Offer[]>('paywall:offers', () => [])
const phase = useState<PaywallPhase>('paywall:phase', () => 'loading')
```

Первый аргумент — **уникальный ключ**, второй — функция начального значения.
Ключ важен: он связывает состояние между вызовами composable в разных
компонентах. Именно поэтому `usePaywall()` можно вызвать и на странице, и в
`PaywallToast.vue`, и обе стороны будут смотреть на одни и те же данные.

Отличие от `ref`: `useState` переживает переход между сервером и клиентом —
значения, установленные при SSR, попадают в HTML и подхватываются на клиенте.

**Когда что выбирать:**

| Нужно | Инструмент |
| --- | --- |
| Локальный флаг внутри одного компонента | `ref` |
| Значение, вычисляемое из других | `computed` |
| Данные, нужные нескольким компонентам | `useState` |
| Данные с сервера, которые надо кешировать по ключу | `useAsyncData` / `useFetch` |

В этом проекте `useFetch` не понадобился: загрузка идёт по действию
пользователя, а не при создании компонента, и состояние живёт в composable.

### 11. Server routes: маршруты из имён файлов

Правило простое: имя файла = путь, суффикс = HTTP-метод.

| Файл | Маршрут |
| --- | --- |
| `server/api/offers.get.ts` | `GET /api/offers` |
| `server/api/purchase.post.ts` | `POST /api/purchase` |
| `server/api/purchases.get.ts` | `GET /api/purchases` |
| `server/api/restore.post.ts` | `POST /api/restore` |
| `server/api/health.get.ts` | `GET /api/health` |

Скелет обработчика:

```ts
export default defineEventHandler(async (event): Promise<PurchaseResponse> => {
  const body = await readBody<PurchaseBody>(event)
  // ... работа ...
  return { ok: true, purchase, entitlement }
})
```

`event` — объект запроса: из него читают тело (`readBody`), query-параметры
(`getQuery`), заголовки (`getHeader`) и в него пишут ответ (`setHeader`).
Тип возвращаемого значения указывается явно — так `pnpm typecheck` проверяет,
что сервер и клиент договорились о форме ответа.

Обратите внимание на защиту от битого тела запроса:

```ts
const body = await readBody<PurchaseBody>(event).catch(() => ({}) as PurchaseBody)
```

Если клиент пришлёт мусор, `readBody` бросит исключение, а мы превратим это в
пустой объект — и дальше сработает обычная валидация с понятной ошибкой 400,
а не невнятная ошибка 500.

### 12. Слой хранения: интерфейс, три реализации, ленивая инициализация

Это самая интересная часть проекта с точки зрения архитектуры. Полный файл —
[`server/utils/purchases.ts`](../server/utils/purchases.ts).

**Интерфейс.** Сначала описываем, **что** нужно от хранилища, без деталей:

```ts
export interface PurchasesStore {
  readonly driver: 'sqlite' | 'postgres' | 'memory'
  readonly location: string
  listByDevice(deviceId: string, limit: number): Promise<PurchaseRecord[]>
  insert(row: NewPurchase): Promise<PurchaseRecord>
  findLatestByDevice(deviceId: string): Promise<PurchaseRecord | null>
}
```

Обработчики API работают только с этим интерфейсом. Они не знают про SQLite и
Postgres — и это главное: чтобы добавить новую базу, достаточно ещё одной
реализации, менять обработчики не нужно.

**Реализация 1 — SQLite** (локальная разработка):

```ts
async function createSqliteStore(file: string): Promise<PurchasesStore> {
  const { default: Database } = await import('better-sqlite3')
  const absolute = resolve(process.cwd(), file)
  mkdirSync(dirname(absolute), { recursive: true })
  const db = new Database(absolute)
  db.exec(CREATE_TABLE_SQLITE)          // CREATE TABLE IF NOT EXISTS
  // ...
}
```

Обратите внимание: `import` именно динамический (`await import(...)`), внутри
функции. Так нативный модуль не попадает в клиентский бандл и загружается
только когда действительно нужен.

**Реализация 2 — Postgres** (продакшен):

```ts
async function createPostgresStore(connectionString: string): Promise<PurchasesStore> {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(connectionString)
  await sql.query(CREATE_TABLE_POSTGRES)
  // ...
  async insert(row) {
    const rows = await sql.query(
      `INSERT INTO purchases (id, device_id, ...) VALUES ($1, $2, ...) RETURNING ...`,
      [row.id, row.deviceId, /* ... */],
    )
    return rowToPurchase(rows[0])
  },
}
```

Два принципиальных момента:

1. **Только bind-параметры** (`$1`, `$2`), никакой склейки строк. Это защита от
   SQL-инъекций, и это проверяется тестом.
2. **Нормализация данных на выходе.** `amount_minor` в Postgres — это `bigint`,
   и драйвер отдаёт его строкой. Функция `rowToPurchase` приводит типы:

```ts
const toMinor = (value: unknown): number => {
  if (typeof value === 'number') return value
  return Number.parseInt(String(value), 10)
}
```

А дата запрашивается уже в ISO-формате, чтобы не зависеть от того, как драйвер
сериализует `timestamptz`:

```sql
to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
```

**Реализация 3 — память** (аварийный фолбэк). Если SQLite недоступен, сервер
не должен падать с 500 — он продолжает работать, но данные не сохраняются.
Ключевая деталь: этот факт **видно снаружи** через `/api/health`.

**Фабрика и ленивая инициализация.** Самый тонкий момент файла:

```ts
let storePromise: Promise<PurchasesStore> | null = null

export function usePurchasesStore(): Promise<PurchasesStore> {
  if (!storePromise) {
    const config = useRuntimeConfig()
    const connectionString = String(config.databaseUrl || process.env.DATABASE_URL || '').trim()

    storePromise = connectionString
      ? createPostgresStore(connectionString)
      : createSqliteStore(config.sqlitePath).catch(() => createMemoryStore())

    // Не кешировать неудачную инициализацию
    storePromise.catch(() => {
      storePromise = null
    })
  }
  return storePromise
}
```

Здесь три решения, каждое из которых стоило отдельной мысли:

* **хранится промис, а не готовое хранилище** — два одновременных запроса не
  создадут две базы: второй дождётся того же промиса;
* **инициализация ленивая** — модуль импортируется при старте сервера, но база
  подключается только при первом обращении;
* **ошибка не кешируется** — если Postgres был временно недоступен, следующая
  попытка снова попробует подключиться, а не будет вечно возвращать ошибку.

### 13. Конфигурация и секреты

[`nuxt.config.ts`](../nuxt.config.ts):

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    databaseUrl: '',                        // ← только сервер, приватно
    sqlitePath: '.data/paywall.sqlite',
    public: {
      appName: 'Чудо-Остров',               // ← доступно и в браузере
    },
  },
})
```

`runtimeConfig` — способ передать приложению настройки, которые могут
отличаться в разных окружениях. Всё, что **не** внутри `public`, доступно только
на сервере: строка подключения к базе никогда не попадёт в браузерный бандл.

Значения подставляются переменными окружения. Nitro по умолчанию ищет
`NUXT_DATABASE_URL` для `runtimeConfig.databaseUrl` — на Vercel мы задаём именно
её. В коде есть и вторая страховка:

```ts
const connectionString = String(config.databaseUrl || process.env.DATABASE_URL || '').trim()
```

Правило безопасности: **секреты живут только в переменных окружения** и никогда
в репозитории. В проекте есть `.env.example` с пустыми значениями и
документацией — и нет `.env` (он в `.gitignore`).

### 14. Компоненты: props вниз, события вверх

Правило Vue, которое в проекте соблюдается строго: **данные передаются вниз
через `props`, а изменения — вверх через события**. Компонент не лезет в
глобальное состояние сам.

Карточка тарифа ([`PaywallOfferCard.vue`](../app/components/PaywallOfferCard.vue)):

```ts
defineProps<{
  offer: Offer
  active: boolean
  disabled?: boolean
}>()

defineEmits<{ select: [] }>()
```

Она ничего не знает о `usePaywall` — ей передали данные, она показала. Нажатие
сообщает наружу:

```vue
<div
  class="card"
  :class="{ 'card--active': active }"
  role="radio"
  :aria-checked="active"
  :tabindex="disabled ? -1 : 0"
  @click="!disabled && $emit('select')"
  @keydown.enter.prevent="!disabled && $emit('select')"
  @keydown.space.prevent="!disabled && $emit('select')"
>
```

Обратите внимание на доступность: у карточки есть `role="radio"`,
`:aria-checked` и обработка клавиатуры. Это не «для галочки» — в webview
встречаются разные способы навигации.

Страница связывает компонент с логикой:

```vue
<PaywallOfferCard
  v-for="offer in offers"
  :key="offer.id"
  :offer="offer"
  :active="offer.id === selectedOfferId"
  @select="select(offer.id)"
/>
```

`v-model` используется там, где компонент управляет своим открытием. Лист
истории ([`PaywallPurchasesSheet.vue`](../app/components/PaywallPurchasesSheet.vue)):

```ts
const props = defineProps<{ open: boolean; items: PurchaseRecord[]; loading?: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
const close = () => emit('update:open', false)
```

И на странице:

```vue
<PaywallPurchasesSheet v-model:open="sheetOpen" :items="history" :loading="historyLoading" />
```

Запись `v-model:open` — это короткая форма для «передать `open` и слушать
`update:open`». Такой компонент остаётся управляемым снаружи, но инкапсулирует
разметку и анимацию.

### 15. Стили: дизайн-токены и mobile-first

Все значения дизайна собраны в одном месте —
[`app/assets/css/main.css`](../app/assets/css/main.css):

```css
:root {
  --c-brand: #6a45ff;
  --c-ink: #1e1a2e;
  --c-line: #e9e5f5;
  --r-lg: 22px;
  --pad: 20px;
  --tap: 48px;
  --sh-card: 0 2px 10px rgba(30, 26, 46, 0.05);
}
```

Компоненты используют только переменные:

```css
.card {
  border-radius: var(--r-lg);
  border: 1.5px solid var(--c-line);
  box-shadow: var(--sh-card);
}
```

Зачем: чтобы поменять цвет во всём приложении, достаточно одной строки. И чтобы
макет в Figma и вёрстка говорили на одном языке — в `docs/DESIGN.md` те же
имена токенов.

Стили компонентов **scoped** (`<style scoped>`): класс `.card` не протечёт в
другие компоненты. Это избавляет от войны имён в большом проекте.

**Mobile-first** — базовые стили пишутся для узкого экрана, расширения
добавляются медиазапросами:

```css
/* база: телефон */
.paywall__scroll { padding: 4px var(--pad) 18px; }

/* расширение: только если экран шире */
@media (min-width: 480px) {
  .stage__screen { border-radius: 34px; }
}
```

Эталон — 390 × 844. Проверка на 360 px сразу выявила проблему: заголовок
«Выберите тариф» переносился на две строки и ломал иерархию. Поэтому в CSS
появились `white-space: nowrap` и `clamp()` для размеров шрифта:

```css
.hero__title { font-size: clamp(22px, 6.6vw, 27px); }
```

### 16. Плагины: код при старте приложения

[`app/plugins/paywall.client.ts`](../app/plugins/paywall.client.ts) загружает
тарифы сразу при открытии экрана:

```ts
export default defineNuxtPlugin({
  name: 'paywall-bootstrap',
  enforce: 'pre',
  setup() {
    const { loadOffers } = usePaywall()
    loadOffers()
  },
})
```

Суффикс `.client` в имени файла означает «исполнять только в браузере» — на
сервере этот файл пропускается. Обратите внимание на объявление через
**объект**, а не через функцию: так Nuxt может прочитать метаданные плагина
статически и не тратит время на разбор кода.

### 17. Проверка качества: четыре уровня

В проекте нет «веры на слово» — каждый слой проверяется своим инструментом.

| Уровень | Команда | Что проверяет |
| --- | --- | --- |
| Типы | `pnpm typecheck` | контракт между клиентом и сервером |
| API | `pnpm test:api` | реальные запросы к запущенному серверу |
| База | `pnpm test:postgres` | адаптер Postgres на моке HTTP-эндпоинта |
| Вёрстка | `pnpm shots` | геометрия в реальном Chrome на четырёх ширинах |

Как устроен `test:api` — это полезный приём. Скрипт сам поднимает dev-сервер,
ждёт готовности и прогоняет проверки:

```js
const { baseUrl, stop } = await startServer({ port: 3211, cwd: process.cwd() })

const purchase = await api('/api/purchase', {
  method: 'POST',
  body: JSON.stringify({ offerId: 'yearly', deviceId }),
})
check('запись создана', Boolean(purchase.body.purchase?.id))
check('сумма в копейках', purchase.body.purchase.amountMinor === 179000)

stop()   // в finally — сервер не останется висеть
```

Самое ценное здесь — проверки **побочных эффектов**: тест не просто смотрит на
ответ, а идёт следом в `GET /api/purchases` и убеждается, что строка легла в
базу. Ответ может быть красивым, а записи при этом не будет.

Как тестировать то, чего нет. У проекта две внешние зависимости, которых нет в
CI: Figma и Neon. Обе заменили моками на уровне протокола:

* `pnpm test:postgres` подменяет `globalThis.fetch` и отвечает как HTTP-эндпоинт
  Neon — в формате `{ queries: [{ query, params }] }`. Тест проверяет, что
  параметры действительно переданы отдельно, а не вклеены в SQL.
* `pnpm test:figma` подменяет Plugin API Figma и **считает геометрию
  auto-layout**: размеры фреймов, положение блоков.

Именно этот приём окупился: мок поймал три реальных бага плагина, которые
иначе всплыли бы только у пользователя в Figma — например, что `resize()`
подставлял дефолтную высоту 100 px вместо заданной.

### 18. Деплой и почему in-memory ломается в облаке

Nitro умеет собирать приложение под разные платформы. Для Vercel достаточно
переменной:

```bash
NITRO_PRESET=vercel pnpm build
```

Результат — каталог `.vercel/output`, где каждая server route становится
отдельной serverless-функцией. Это Build Output API, и он же означает главное
ограничение: **у функций нет постоянной файловой системы**.

Практический вывод для любого похожего проекта: если данные должны жить дольше
одного запроса, нужна внешняя база. В этом проекте выбор сделан явно, и он
проверяется:

```bash
curl -s https://kids-paywall-one.vercel.app/api/health
# {"ok":true,"driver":"postgres","location":"neon:postgres"}
```

Обратите внимание на `driver` в ответе. Это не украшение: без такого поля
невозможно отличить «работает» от «работает, но данные теряются». Ошибку
in-memory режима я поймал именно так — сделав покупку и отправив 8 параллельных
чтений: **6 инстансов видели запись, 2 — нет**. После подключения Postgres стало
8 из 8.

Второй урок деплоя — регионы. Функции стояли в `fra1` (Франкфурт), а база в
`us-east-2` (Огайо). Каждый запрос летал через Атлантику. После перевода функций
в `cle1` время запроса к базе упало с 0.70–0.92 s до 0.51–0.59 s. Правило
простое: **регион функций ставьте рядом с базой**.

### 19. Чек-лист: как построить такое же приложение

1. `pnpm dlx nuxi@latest init .` — создать проект.
2. Типы в `shared/` — сначала описать контракт, потом писать код.
3. Данные — в `server/data/`, обработчики — в `server/api/`, имена файлов
   задают маршруты.
4. Хранилище — за интерфейсом, реализации через `await import()`, выбор по
   переменной окружения. Обязательно поле `driver` в диагностическом эндпоинте.
5. Состояние экрана — одна переменная-фаза плюс `useState` для общих данных.
6. Секреты — только в `runtimeConfig` и переменных окружения.
7. Стили — дизайн-токены в `:root`, mobile-first, `scoped`.
8. Тесты — на типы, на API с проверкой побочных эффектов, на внешние сервисы
   через моки протокола.
9. Деплой — внешняя база, регион рядом с ней, проверка через health-эндпоинт.

---

## Что почитать дальше

* [Документация Nuxt](https://nuxt.com/docs) — начните с разделов «Directory
  structure» и «Server».
* [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — краткая выжимка по этому проекту
  без учебной части.
* Исходники: [`usePaywall.ts`](../app/composables/usePaywall.ts) →
  [`purchase.post.ts`](../server/api/purchase.post.ts) →
  [`purchases.ts`](../server/utils/purchases.ts) — читайте в этом порядке, это
  путь одного запроса.
