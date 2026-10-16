Запуск локально. pnpm install && pnpm dev — база не требуется, SQLite создаётся сама при первой покупке.

Где что лежит. Таблица из 14 строк: frontend (app/pages/index.vue, app/components/Paywall*.vue, app/composables/usePaywall.ts), server routes (5 файлов в server/api/), работа с БД (server/utils/purchases.ts, server/data/offers.ts).

Платформа и БД. Vercel + Neon Postgres: server routes из коробки, бесплатный HTTP-Postgres без пула соединений. Отдельно объяснено, почему SQLite на Vercel не годится (эфемерная ФС) и почему регион функций подобран под базу — с цифрами: запрос к БД ускорился с 0.70–0.92 s до 0.51–0.59 s.

Следующие 2 часа. Идемпотентность покупок (UNIQUE(device_id, offer_id, period) — сейчас защита только в памяти инстанса), аналитика воронки, A/B порядка тарифов, скриншот-регрессия в CI, реальный стор-флоу через вебхук.