# Чудо-Остров — мобильный paywall

Экран paywall для условной детской игры: два тарифа, выбор, тестовая покупка,
запись в БД и понятные состояния загрузки / ошибки / успеха.

| Что | Где |
| --- | --- |
| Макет в Figma | https://www.figma.com/design/TPUBCT5Hwmr8mGZKwbShKT/%D0%A7%D1%83%D0%B4%D0%BE-%D0%9E%D1%81%D1%82%D1%80%D0%BE%D0%B2 |
| Живой сервис | https://kids-paywall-one.vercel.app |
| Репозиторий | https://github.com/kirillzhakin/kids-paywall |

**Стек:** Nuxt 4 (SSR) + TypeScript · frontend и backend в одном проекте ·
SQLite локально / Postgres (Neon) в продакшене · деплой на Vercel.

## Как запустить локально

```bash
pnpm install          # Node ^22.21 || ^24.11 || >=26
pnpm dev              # http://localhost:3000
```

База не нужна, чтобы посмотреть экран: первый `POST /api/purchase` сам создаст
файл `.data/paywall.sqlite` и таблицу. Тестовая покупка денег не списывает.

```bash
pnpm build && node .output/server/index.mjs   # прод-сборка локально
pnpm typecheck     # типы
pnpm test:api      # e2e по всем server routes
pnpm test:postgres # Postgres-адаптер против мока HTTP-эндпоинта Neon
pnpm test:svg      # структура макета + сверка цен с /api/offers
pnpm test:figma    # сборка экранов Figma-плагином (мок Plugin API)
pnpm shots         # скриншоты 360/375/390/430 + метрики вёрстки
```

> Если локально Node < 22.12, запускайте с
> `NODE_OPTIONS=--experimental-require-module` — требование Nuxt 4.6
> (в `scripts/dev-server.mjs` флаг уже выставлен).

## Где что лежит

| Слой | Путь | Что внутри |
| --- | --- | --- |
| Frontend | `app/pages/index.vue` | экран paywall, сборка состояний |
| | `app/components/Paywall*.vue` | topbar, hero, выгоды, карточка тарифа, CTA, скелетон, баннер ошибки, экран успеха, лист «Мои покупки», тост |
| | `app/composables/usePaywall.ts` | состояние экрана: тарифы, выбор, фазы `loading/ready/error/success`, покупка, восстановление |
| | `app/assets/css/main.css` | дизайн-токены: палитра, радиусы, тени, типографика |
| Server routes | `server/api/offers.get.ts` | `GET /api/offers` — каталог тарифов |
| | `server/api/purchase.post.ts` | `POST /api/purchase` — тестовая покупка |
| | `server/api/restore.post.ts` | `POST /api/restore` — «Восстановить покупки» |
| | `server/api/purchases.get.ts` | `GET /api/purchases?deviceId=…` — история |
| | `server/api/health.get.ts` | `GET /api/health` — какой драйвер БД используется |
| База | `server/utils/purchases.ts` | два адаптера за одним интерфейсом: SQLite и Postgres |
| | `server/data/offers.ts` | каталог тарифов и форматирование цен |
| Общее | `shared/types/paywall.ts` | контракт API: один тип для сервера и клиента |
| Дизайн | `design/svg/00-overview.svg` | макет: 4 экрана одним листом (импорт в Figma без плагина) |
| | `design/figma-plugin/` | плагин, собирающий экраны с auto-layout внутри Figma |
| | `design/screenshots/` | PNG 360/375/390/430 + `metrics.json` с размерами |

### Работа с БД

Один интерфейс `PurchasesStore`, два адаптера, выбор автоматический:

* **нет `NUXT_DATABASE_URL`** → SQLite (`better-sqlite3`), файл
  `.data/paywall.sqlite`, таблица создаётся при первом обращении;
* **есть `NUXT_DATABASE_URL`** → Postgres через `@neondatabase/serverless`
  (HTTP-драйвер, без TCP-пула — то, что нужно serverless-функциям).

Схема: `purchases(id, device_id, offer_id, plan_title, amount_minor, currency,
status, provider, created_at)` — минимум, который просили: `offerId`, дата/время
и условный id устройства. Подробности — в [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

Как убедиться, что запись реально в БД (в интерфейсе технических подписей нет —
экран рассчитан на ребёнка и родителя):

```bash
curl -s https://<домен>/api/health          # ждём "driver":"postgres"
curl -s -X POST https://<домен>/api/purchase -H 'content-type: application/json' \
  -d '{"offerId":"yearly","deviceId":"dev_check_001"}'
curl -s "https://<домен>/api/purchases?deviceId=dev_check_001"   # строка читается обратно
```

## Почему Vercel + Neon

* **Vercel** — server routes работают «из коробки», Nuxt поддерживается
  официально, есть бесплатный тариф и превью на каждый коммит. Сервис не
  статический: `POST /api/purchase` пишет в БД на реальном домене.
* **Neon (Postgres)** — бесплатный serverless Postgres, работает по HTTP,
  поэтому не нужен пул соединений, а данные переживают перезапуск функций.
  SQLite на Vercel не подходит: файловая система функций эфемерная. Он оставлен
  фолбэком для локальной разработки и деградирует в память, а не в 500 —
  поэтому `/api/health` стоит смотреть сразу после деплоя.
* **Регион функций** подобран под базу (`regions` в `vercel.json`): база в
  `us-east-2`, функции в `cle1`. Иначе каждый запрос делает лишний «прыжок»
  между континентами — это было измеримо: запрос к БД ускорился с 0.70–0.92 s
  до 0.51–0.59 s.

Пошаговая инструкция по деплою — в [DEPLOY.md](./DEPLOY.md).

## Дизайн и pixel perfect

Эталонный фрейм **390 × 844**, mobile-first, проверено на 360 / 375 / 390 / 430.
Отступы, типографика и тап-зоны — в [docs/DESIGN.md](./docs/DESIGN.md),
точные координаты блоков — в `design/screenshots/metrics.json`. Визуальная
спека со всеми состояниями — в [docs/VISUAL-SPEC.md](./docs/VISUAL-SPEC.md).

## AI-инструменты и что проверено руками

**Чем пользовался.** Писал код в паре с AI-ассистентом (эта сессия): каркас
Nuxt, компоненты, server routes, адаптеры БД, Figma-плагин и SVG-макет, скрипты
скриншотов и тестов. AI же помогал разбирать ошибки сборки и деплоя.

**Что проверял сам, а не «на слово»:**

* **Ошибки, которые AI принёс и которые я поймал тестами:** мёртвая зависимость
  `neon` (это CLI, а не драйвер — нужен `@neondatabase/serverless`); неверный
  путь импорта `../types/paywall` в `server/data/offers.ts`; `oxc-walker`
  требует Node ≥ 22.12 для `require(ESM)`.
* **Три бага собственного Figma-плагина**, найденные тестом и скриншотами:
  фон-плашка перекрывала контент, `resize()` подставлял дефолтные 100 px вместо
  заданной высоты, повторный запуск оставлял вложенные слои.
* **Ошибка в SVG-макете:** первый импорт в Figma дал только формы, без текста.
  После перехода на одно имя шрифта текст появился; точную причину подтвердить
  не удалось, поэтому в [design/README.md](./design/README.md) описано то, что
  реально проверено тестом шрифтов, а не догадка.
* `pnpm typecheck` — 0 ошибок; `pnpm test:api` — 26 проверок (покупка → запись
  → чтение → restore → 400-е пути → SSR-разметка);
  `pnpm test:postgres` — проверено, что все значения идут bind-параметрами,
  bigint парсится, `created_at` нормализуется в ISO.
* Вёрстка — реальным Chrome через Playwright на четырёх ширинах:
  `horizontalOverflow: false`, карточки одной высоты, тап-зоны CTA 54 px.
  Расхождение живого деплоя с локальными метриками — 0.00 px по всем блокам.
* Прод: `pnpm build` + `NITRO_PRESET=vercel`, затем на живом сервисе
  `driver: postgres` и **8 из 8** параллельных запросов читают одну и ту же
  запись (на in-memory фолбэке было 6 из 8).

**Границы честности:** реальный платёжный SDK не подключался, «покупка» —
тестовая операция, секретов в репозитории нет. Ссылки на Figma, Vercel и GitHub
создавались в ваших аккаунтах; подводные камни — в [design/README.md](./design/README.md)
и [DEPLOY.md](./DEPLOY.md).

## Что бы сделал следующим шагом (если было бы ещё 2 часа)

1. **Идемпотентность покупок** — ключ идемпотентности и
   `UNIQUE(device_id, offer_id, period)`: сейчас от двойного тапа защищает
   только троттлинг в памяти инстанса, а он не переживает масштабирование.
2. **Аналитика воронки** — события `paywall_view`, `offer_select`,
   `purchase_start`, `purchase_success`, `restore_click` и дашборд конверсии
   по тарифам, чтобы решение о ценах принималось по данным.
3. **A/B двух порядков тарифов** — годовой вперёд против месячного.
4. **Скриншот-регрессия в CI** — `pnpm shots` + сравнение с эталонами, чтобы
   вёрстка не «поехала» после правок.
5. **Реальный стор-флоу** — вебхук платёжного провайдера вместо синхронного
   ответа, `restore` по чеку магазина и отдельная таблица `entitlements`.
