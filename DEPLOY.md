# Деплой: GitHub → Vercel + Neon

Ниже — точная последовательность. Всё, что нужно с моей стороны, уже в репозитории:
`vercel.json`, прод-сборка проверена с `NITRO_PRESET=vercel`, server routes
собираются в отдельные функции.

## 1. GitHub

```bash
cd kids-paywall
git add .
git commit -m "feat: mobile paywall (Nuxt 4 + server routes + Postgres)"
```

Создайте **пустой** репозиторий на GitHub (без README и .gitignore), затем:

```bash
git remote add origin git@github.com:<ваш-логин>/kids-paywall.git
git branch -M main
git push -u origin main
```

Если SSH-ключ не привязан к GitHub, используйте HTTPS-адрес и personal access token.

## 2. Neon (Postgres)

1. [neon.tech](https://neon.tech) → **New Project** (регион — поближе к вам,
   например `eu-central-1`; в `vercel.json` выставлен регион функций `fra1`).
2. В **Connection string** выберите вариант `psql`/`Node.js` и скопируйте строку вида
   `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Таблицу создавать вручную не нужно: адаптер выполнит
   `CREATE TABLE IF NOT EXISTS purchases` при первом обращении.

## 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → выберите репозиторий.
2. Framework Preset определится как **Nuxt.js**, build command — `pnpm run build`.
   Менять ничего не нужно.
3. **Environment Variables** → добавьте:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `NUXT_DATABASE_URL` | строка подключения из Neon | Production, Preview, Development |

   Nitro сам положит её в `runtimeConfig.databaseUrl`. Обычный `DATABASE_URL`
   тоже поддерживается как фолбэк.
4. **Deploy**. Первая сборка занимает ~1–2 минуты.

## 4. Проверка, что всё живо

```bash
# 1. какой драйвер БД реально используется — ждём "postgres"
curl -s https://<ваш-домен>/api/health

# 2. тарифы отдаёт server route
curl -s https://<ваш-домен>/api/offers | head -c 300

# 3. тестовая покупка пишется в БД
curl -s -X POST https://<ваш-домен>/api/purchase \
  -H 'content-type: application/json' \
  -d '{"offerId":"yearly","deviceId":"dev_check_001"}'

# 4. запись читается обратно
curl -s "https://<ваш-домен>/api/purchases?deviceId=dev_check_001"
```

В шаге 1 должно быть `"driver":"postgres"`. Если там `sqlite` или `memory` —
переменная не подхватилась: проверьте имя и сделайте **Redeploy**
(переменные применяются только к новой сборке).

Дополнительно в UI: откройте экран, нажмите **«Мои покупки»** — строки читаются
из базы, это видно прямо на экране.

## Замечания по окружению

* **Node на Vercel** должен быть ≥ 22.12 (в `package.json` стоит
  `"engines": { "node": "^22.21.0 || ^24.11.0 || >=26.0.0" }`); Vercel возьмёт
  версию из этого поля.
* **SQLite в продакшене не используется.** Пакет `better-sqlite3` объявлен как
  `optionalDependencies`, в serverless-окружении он может отсутствовать — тогда
  адаптер молча уходит в in-memory режим, а `/api/health` честно покажет
  `"driver":"memory"`. Именно поэтому в проде нужен `NUXT_DATABASE_URL`.
* **Локальная разработка** базы не требует: `pnpm dev` поднимет SQLite
  в `.data/paywall.sqlite`.
* **Секретов в репозитории нет**: `.env` в `.gitignore`, платёжный SDK не
  подключался, «покупка» — тестовая операция.
