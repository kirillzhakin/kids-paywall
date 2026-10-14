# Чудо-Остров — мобильный paywall

Экран paywall для условной детской игры: два тарифа, выбор, тестовая покупка,
сохранение в БД и понятные состояния загрузки / ошибки / успеха.

**Репозиторий:** https://github.com/kirillzhakin/kids-paywall

**Стек:** Nuxt 4 (SSR) + TypeScript · frontend и backend в одном проекте ·
SQLite локально / Postgres (Neon) в продакшене · деплой на Vercel.

---

## Быстрый старт

```bash
pnpm install          # нужен Node ^22.21 || ^24.11 || >=26
pnpm dev              # http://localhost:3000
```

Первый запрос к `POST /api/purchase` сам создаст таблицу и файл
`.data/paywall.sqlite`. База не нужна, чтобы просто посмотреть экран.

```bash
pnpm build && node .output/server/index.mjs   # прод-сборка локально
pnpm typecheck                                # проверка типов
pnpm test:api                                 # e2e по всем server routes
pnpm test:postgres                            # тест Postgres-адаптера (мок Neon)
pnpm test:figma                               # смоук-тест Figma-плагина
pnpm shots                                    # скриншоты + метрики вёрстки
pnpm db:recent                                # последние записи в БД
```

> Если локально стоит Node < 22.12, запускайте с
> `NODE_OPTIONS=--experimental-require-module` — это требование Nuxt 4.6
> (в `scripts/dev-server.mjs` флаг уже выставлен).

## Где что лежит

| Слой | Путь | Что внутри |
| --- | --- | --- |
| Frontend | `app/pages/index.vue` | экран paywall, сборка состояний |
| | `app/components/Paywall*.vue` | topbar, hero, список выгод, карточка тарифа, CTA, скелетон, баннер ошибки, экран успеха, лист «Мои покупки», тост |
| | `app/composables/usePaywall.ts` | состояние экрана: тарифы, выбор, фазы `loading / ready / error / success`, покупка, восстановление |
| | `app/assets/css/main.css` | дизайн-токены (палитра, радиусы, тени, типографика) |
| Server routes | `server/api/offers.get.ts` | `GET /api/offers` — каталог тарифов |
| | `server/api/purchase.post.ts` | `POST /api/purchase` — тестовая покупка |
| | `server/api/restore.post.ts` | `POST /api/restore` — «Восстановить покупки» |
| | `server/api/purchases.get.ts` | `GET /api/purchases?deviceId=…` — история |
| | `server/api/health.get.ts` | `GET /api/health` — какой драйвер БД реально используется |
| БД | `server/utils/purchases.ts` | два адаптера за одним интерфейсом: SQLite и Postgres |
| | `server/data/offers.ts` | сам каталог тарифов и форматирование цен |
| Общее | `shared/types/paywall.ts` | контракт API, один тип и для сервера, и для клиента |
| Дизайн | `design/README.md`, `design/figma-plugin/` | плагин, собирающий макет в Figma |
| | `design/screenshots/` | эталонные PNG 360/375/390/430 + `metrics.json` с размерами |

### Server routes

```
GET  /api/offers                  → { offers[], unlocks[], defaultOfferId }
POST /api/purchase  { offerId }   → { purchase, entitlement }   // пишет строку в БД
POST /api/restore   { deviceId }  → { entitlement, purchases[] }
GET  /api/purchases?deviceId=…    → { purchases[] }             // чтение из БД
GET  /api/health                  → { driver, location }        // sqlite | postgres | memory
```

### Работа с БД

Один интерфейс `PurchasesStore`, два адаптера, выбор автоматический:

* **нет `NUXT_DATABASE_URL`** → SQLite (`better-sqlite3`), файл `.data/paywall.sqlite`,
  таблица создаётся при первом обращении;
* **есть `NUXT_DATABASE_URL`** → Postgres через `@neondatabase/serverless`
  (HTTP-драйвер, без TCP-пула — то, что нужно serverless-функциям).

Схема намеренно простая — ровно то, что просили в задании:

```sql
CREATE TABLE purchases (
  id           TEXT PRIMARY KEY,     -- pur_…
  device_id    TEXT NOT NULL,        -- условный id пользователя/устройства
  offer_id     TEXT NOT NULL,        -- yearly | monthly
  plan_title   TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,      -- копейки
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'succeeded',
  provider     TEXT NOT NULL,        -- test-provider
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Деплой: Vercel + Neon

* **Vercel** — server routes работают «из коробки», Nuxt поддерживается
  официально, есть бесплатный тариф и превью на каждый коммит.
* **Neon (Postgres)** — бесплатный serverless Postgres, работает по HTTP, поэтому
  не нужен пул соединений; данные переживают перезапуск функций. SQLite на
  Vercel не подходит: файловая система функций эфемерная (в коде он оставлен
  фолбэком для локальной разработки и деградирует в память, а не в 500).

Регион функций выбирается рядом с базой (`regions` в `vercel.json`): в проекте
база в `us-east-2`, поэтому функции переведены в `cle1` — иначе каждый запрос
делает лишний «прыжок» между континентами. Подробнее — в [DEPLOY.md](./DEPLOY.md).

Пошаговая инструкция — в [DEPLOY.md](./DEPLOY.md). Коротко:

1. Push в GitHub → **Import Project** в Vercel (framework определяется сам).
2. Создать базу на [neon.tech](https://neon.tech), скопировать connection string.
3. В Vercel → Settings → Environment Variables добавить
   `NUXT_DATABASE_URL = postgresql://…?sslmode=require`.
4. Deploy, затем проверить `GET /api/health` — там должен быть `"driver":"postgres"`.

### Как убедиться, что покупка реально записалась в БД

В интерфейсе намеренно нет технических подписей — экран рассчитан на ребёнка и
родителя. Проверять запись нужно со стороны API (это и есть доказательство
работоспособности server routes):

```bash
# 1. какой драйвер БД используется: ждём "postgres" на Vercel, "sqlite" локально
curl -s https://<домен>/api/health

# 2. тестовая покупка
curl -s -X POST https://<домен>/api/purchase \
  -H 'content-type: application/json' \
  -d '{"offerId":"yearly","deviceId":"dev_check_001"}'

# 3. запись читается обратно из базы
curl -s "https://<домен>/api/purchases?deviceId=dev_check_001"
```

В браузере то же самое видно без технических деталей: кнопка **«Мои покупки»**
показывает историю с тарифом, датой и суммой, а **«Восстановить покупки»**
подтверждает доступ тостом. Автоматически всё это проверяет `pnpm test:api`
(26 assertions, включая запись и чтение строки из БД).

## Дизайн и pixel perfect

* Эталонный фрейм — **390 × 844**, mobile-first, проверено на 360 / 375 / 390 / 430.
* `design/screenshots/metrics.json` — точные координаты и размеры блоков,
  `docs/DESIGN.md` — таблица отступов, типографики и цветов.
* Макет в Figma собирается плагином из `design/figma-plugin/` (инструкция в
  `design/README.md`): он переносит в файл ту же геометрию и токены, что и вёрстка.

## AI-инструменты и что проверено руками

**Чем пользовался.** Писал код в паре с AI-ассистентом (эта сессия):
каркас Nuxt, компоненты, server routes, адаптеры БД, Figma-плагин, скрипты
скриншотов и тестов. AI же помогал разбирать ошибки сборки.

**Что проверял сам, а не «на слово»:**

* **Ошибки, которые AI принёс и которые я поймал тестами:**
  зависимость `neon` (это CLI, а не драйвер — нужен `@neondatabase/serverless`);
  неверный путь импорта `../types/paywall` в `server/data/offers.ts`;
  `oxc-walker` требует Node ≥ 22.12 для `require(ESM)`.
* `pnpm typecheck` — 0 ошибок.
* `pnpm test:api` — 26 проверок: оба тарифа, формат цен, скидка, покупка,
  чтение из БД, восстановление, 400 на неизвестный тариф, 400 на пустое тело,
  `health`, SSR-разметка.
* `pnpm test:postgres` — Postgres-адаптер против мока HTTP-эндпоинта Neon:
  проверено, что все значения идут bind-параметрами (никакой интерполяции),
  bigint приходит строкой и парсится, `created_at` нормализуется в ISO.
* Вёрстка — реальным Chrome через Playwright на четырёх ширинах:
  `horizontalOverflow: false`, карточки одной высоты, тап-зоны CTA 54 px и
  ссылок 32 px. Скриншоты состояний смотрел глазами, по ним же правил
  переносы заголовка на 360 px.
* `pnpm build` в прод-режиме + `NITRO_PRESET=vercel`: SSR и server routes
  работают, в `.vercel/output/functions/api` лежат отдельные функции.
* Figma-плагин — `pnpm test:figma` (мок Plugin API): 337 слоёв, 127 текстовых.

**Границы честности:** живые ссылки на Figma, Vercel и GitHub требуют аккаунтов —
их создаёте вы (шаги в [DEPLOY.md](./DEPLOY.md) и `design/README.md`).
Реальный платёжный SDK не подключался: «покупка» — тестовая операция, секретов
в репозитории нет.

## Что бы сделал следующим шагом (если было бы ещё 2 часа)

1. **Аналитика воронки** — события `paywall_view`, `offer_select`, `purchase_start`,
   `purchase_success`, `restore_click` и дашборд конверсии по тарифам.
2. **Идемпотентность покупок** — ключ идемпотентности + `UNIQUE(device_id, offer_id, period)`,
   чтобы двойной тап или повторный запрос не создавал вторую запись.
3. **A/B двух экранов** — вариант с годовым тарифом вперёд против месячного,
   чтобы увидеть влияние на выбор.
4. **Скриншот-регрессия в CI** — `pnpm shots` + сравнение с эталонами, чтобы
   вёрстка не «поехала» после правок.
5. **Реальный стор-флоу** — вебхук от платёжного провайдера вместо синхронного
   ответа, `restore` по чеку магазина и отдельная таблица `entitlements`.
