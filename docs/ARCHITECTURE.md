# Архитектура

Nuxt 4 в режиме SSR: Vue-приложение и Nitro-сервер живут в одном проекте и
собираются одной командой. Отдельного backend-сервиса нет.

```
браузер / webview
      │  HTML + гидрация
      ▼
app/pages/index.vue ──► app/composables/usePaywall.ts ──► $fetch
      │                                                      │
      │                                              server/api/*.ts   (Nitro)
      │                                                      │
      │                                          server/utils/purchases.ts
      │                                                      │
      │                        ┌─────────────────────────────┴──────────────┐
      ▼                        ▼                                            ▼
  компоненты            SQLite (локально)                      Postgres / Neon (прод)
```

## Контракт API

Один тип на сервер и клиент — `shared/types/paywall.ts`. Это исключает
рассинхрон: если поле переименовано, падает `pnpm typecheck`, а не прод.

| Метод | Путь | Ответ |
| --- | --- | --- |
| `GET` | `/api/offers` | `{ offers[], unlocks[], defaultOfferId, currency, fetchedAt }` |
| `POST` | `/api/purchase` | `{ ok, purchase, entitlement }` — пишет строку в БД |
| `POST` | `/api/restore` | `{ ok, entitlement, purchases[] }` |
| `GET` | `/api/purchases?deviceId=` | `{ purchases[] }` |
| `GET` | `/api/health` | `{ ok, driver, location, time }` |

`/api/health` — намеренно публичный: он показывает, какой адаптер БД реально
используется (`sqlite` / `postgres` / `memory`). Это единственный честный способ
убедиться, что прод пишет в постоянную базу, а не в память инстанса.

Ошибки: неизвестный тариф → `400` с русским текстом, слишком частые запросы →
`429` (защита от двойного тапа в webview).

## Слой хранения

`server/utils/purchases.ts` — один интерфейс, три реализации:

```ts
interface PurchasesStore {
  driver: 'sqlite' | 'postgres' | 'memory'
  location: string
  listByDevice(deviceId: string, limit: number): Promise<PurchaseRecord[]>
  insert(row: NewPurchase): Promise<PurchaseRecord>
  findLatestByDevice(deviceId: string): Promise<PurchaseRecord | null>
}
```

* **SQLite** (`better-sqlite3`) — когда `NUXT_DATABASE_URL` пуст. Файл
  `.data/paywall.sqlite`, таблица создаётся через `CREATE TABLE IF NOT EXISTS`
  при первом обращении. Нужен для локальной разработки и тестов.
* **Postgres** (`@neondatabase/serverless`) — когда переменная задана. Драйвер
  ходит по HTTP, поэтому в serverless не нужен пул TCP-соединений.
* **memory** — аварийный фолбэк: если SQLite недоступен (например, нативный
  модуль не собрался в чужом окружении), сервер продолжает отвечать, а не
  отдаёт 500. Данные при этом не переживают перезапуск — именно поэтому
  `/api/health` показывает `driver`.

### Схема

```sql
CREATE TABLE purchases (
  id           TEXT PRIMARY KEY,      -- pur_<base36>
  device_id    TEXT NOT NULL,         -- условный id пользователя/устройства
  offer_id     TEXT NOT NULL,         -- yearly | monthly
  plan_title   TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,       -- копейки, целое число
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'succeeded',
  provider     TEXT NOT NULL,         -- test-provider
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_device_created ON purchases (device_id, created_at DESC);
```

В Postgres `created_at` возвращается через
`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`:
это избавляет от зависимости от того, как драйвер сериализует `timestamptz`, и
гарантирует ISO-8601 в ответе. `amount_minor` приходит из Postgres строкой
(bigint) и приводится к числу в `rowToPurchase`.

Все значения передаются bind-параметрами (`$1…$7`), интерполяции строк в SQL нет
— это проверяет `pnpm test:postgres`.

## Состояния экрана

`app/composables/usePaywall.ts` держит одну машину состояний:

| Фаза | Что на экране |
| --- | --- |
| `loading` | skeleton-карточки тарифов, CTA заблокирована |
| `ready` | тарифы, выбранный по умолчанию годовой, активная CTA |
| `error` | баннер с причиной и кнопкой «Повторить», CTA заблокирована |
| `success` | подтверждение доступа, чек, ссылка на историю |

Ошибка покупки — отдельное состояние (`purchaseError`): она показывается под
кнопкой и не ломает список тарифов. Для скриншотов и ручной проверки есть
переключатель `?demo=slow|error` (панель «Состояния» на десктопе).

## Ключевые решения и их причины

* **Права и восстановление без авторизации.** Задание просит минимум — поэтому
  вместо аккаунтов используется `deviceId` в `localStorage`, а «Восстановить
  покупки» ищет записи по нему. В реальном продукте здесь был бы чек магазина
  или вебхук провайдера.
* **Цены живут только на сервере.** `server/data/offers.ts` — единственный
  источник; клиент получает уже отформатированные строки (`1 790 ₽`). SVG-макет
  читает те же константы, поэтому макет и приложение не могут разойтись.
* **Никаких технических подписей в UI.** Имена таблиц и путей API убраны с
  экрана: проверять запись в БД нужно через `/api/health`, `/api/purchases` и
  `pnpm test:api`, а не через интерфейс для ребёнка.
* **Троттлинг в памяти.** Защита от двойного тапа реализована через `Map` в
  процессе — этого достаточно для тестового задания, но при масштабировании
  нужен ключ идемпотентности в БД (см. «следующие шаги» в README).
