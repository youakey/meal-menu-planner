# Meal Menu Planner (Меню и ингредиенты)

Веб‑приложение для планирования меню на неделю (Пн–Пт) с подсчетом общего количества ингредиентов (граммы) и стоимости по выбранным блюдам и порциям.

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS
- Auth + DB: Supabase (Postgres + RLS)
- Deploy: GitHub Pages (через GitHub Actions)
- Роутинг: HashRouter (чтобы GH Pages не ломал SPA‑роуты)

## 1) Быстрый старт локально

### Требования
- Node.js 18+ (лучше 20)
- Аккаунт Supabase

### Шаги
1. Склонируйте репозиторий.
2. Установите зависимости:

```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

4. Вставьте в `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

5. Запустите dev‑сервер:

```bash
npm run dev
```

Откройте адрес из консоли (обычно `http://localhost:5173`).

---

## 2) Настройка Supabase

### 2.1 Создать проект
1. Создайте проект в Supabase.
2. В **Authentication → Providers** убедитесь, что включен Email.
3. В **Project Settings → API** скопируйте:
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`

### 2.2 Создать таблицы и RLS
1. Откройте **SQL Editor**.
2. Выполните скрипт `supabase/schema.sql`.
3. Проверьте:
   - Tables: `profiles`, `dishes`, `dish_ingredients`, `menu_entries`
   - RLS включен
   - Policies созданы

### 2.3 Проверка
1. Запустите приложение локально.
2. Зарегистрируйте пользователя.
3. Создайте блюдо, добавьте ингредиенты.
4. Заполните меню → откройте «Итоги».

### (Опционально) Демо‑данные
Скрипт `supabase/seed.sql` содержит пример. Для него нужно:
- создать пользователя,
- вставить UUID пользователя,
- затем добавить ингредиенты (см. комментарии).

---

## 3) Деплой на GitHub Pages

### 3.1 Создать репозиторий и запушить код
```bash
git init
git add .
git commit -m "Initial commit"
# создайте репо на GitHub, затем:
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git branch -M main
git push -u origin main
```

### 3.2 Добавить секреты окружения в GitHub
1. Откройте GitHub repo → **Settings → Secrets and variables → Actions**.
2. Добавьте secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### 3.3 Включить GitHub Pages
1. Repo → **Settings → Pages**.
2. Source: **GitHub Actions**.

### 3.4 Дождаться workflow
В репозитории уже есть workflow: `.github/workflows/deploy.yml`.
При пуше в `main` он:
- соберет Vite,
- задеплоит `dist` на Pages.

Откройте вкладку **Actions** и дождитесь успешного деплоя. После этого GitHub покажет URL страницы.

---

## 4) Важные детали

### Почему HashRouter
GitHub Pages отдает только статические файлы и по умолчанию не умеет отдавать `index.html` для любых SPA‑путей. HashRouter решает это: URL будет вида `/#/menu`.

### Про цены
В базе хранится `price_per_gram`. В UI можно вводить:
- цену за 1 г
- или цену за 100 г / 1 кг — приложение конвертирует в цену за грамм.

---

## 5) Troubleshooting

**Ошибка: Supabase env vars are missing**
- Проверьте `.env` и значения `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

**Вижу пустые списки или 401**
- Проверьте, что выполнили `supabase/schema.sql`.
- Проверьте, что RLS политики созданы.
- Проверьте, что вы вошли в аккаунт.

**GitHub Pages задеплоил, но приложение не работает**
- Проверьте, что GitHub secrets заданы.
- Откройте Actions → лог сборки: переменные окружения должны быть доступны на шаге Build.

---

## 6) Структура проекта

- `src/pages` — страницы (Login, Main, Menu, Catalog, DishEdit, Settings, Summary)
- `src/components` — UI компоненты (Layout, Toast, ConfirmDialog, DishPicker)
- `src/lib` — Supabase клиент, API, типы, утилиты, расчеты
- `supabase/` — SQL схема и (опционально) seed

---

## Лицензия
MIT (по умолчанию; при необходимости измените).
