# Проект Menu Atelier (CookPlanner): инструкции для Claude

## Технологический стек
- **Frontend:** React (Vite) + TypeScript, hash-роутинг (`react-router-dom`, `HashRouter`)
- **Стили:** Tailwind CSS — только Tailwind-классы, дизайн-система: тёмная тема, скругления, жёлто-оранжевые градиентные акценты (`btn-primary`, `.glass-card`, `.glass-input` в `src/styles/index.css`)
- **Данные:** TanStack React Query поверх Supabase-клиента (`src/lib/supabaseClient.ts`), все запросы централизованы в `src/lib/api.ts`
- **Backend/Auth:** Supabase (Postgres + RLS + Auth)
- **Экспорт документов:** `docx` (библиотека `docx`, `src/lib/docxExport.ts`) — PDF-библиотек в проекте нет
- **Календарь:** `react-day-picker` + `date-fns` (обёртка `src/components/CalendarPicker.tsx`)
- **Deployment:** GitHub Pages через GitHub Actions (`.github/workflows/deploy.yml`) — воркфлоу сам делает `npm install` + `npm run build` и деплоит `dist/`; закоммиченная в репозиторий папка `dist/` — не источник правды для продакшена, а просто артефакт локальной сборки.

## Структура проекта
- `src/pages/` — экраны: `Main`, `Catalog` (блюда), `DishEdit`, `ingredients`, `Menu`, `Cart`, `Summary`, `Login`.
- `src/components/` — переиспользуемые UI-блоки: `Layout`, `Toast` (тосты), `ConfirmDialog`, `SaveButton` (см. ниже), `EventFormModal` (форма мероприятия), `CalendarPicker` (обёртка над react-day-picker), `ChangePasswordModal`, `ProtectedRoute`.
- `src/lib/` — `api.ts` (все Supabase-запросы), `calculations.ts` (расчёт стоимости), `docxExport.ts` (экспорт в DOCX), `types.ts` (доменные типы), `utils.ts` (форматирование, поиск), `supabaseClient.ts`, `auth.tsx`.
- `src/lib/hooks/useSavedState.ts` — хук состояния "Сохранено" для кнопок (см. ниже).
- `src/hooks/useScrollDirection.ts` — направление скролла (для шторки в `DishEdit`).
- `supabase/schema.sql` — актуальная схема БД для новых окружений (источник истины наравне с живой БД).
- `supabase/migrations/*.sql` — аддитивные миграции поверх базовой схемы, пронумерованы по порядку применения.

## Архитектура данных
Ингредиенты → Блюда (состоят из ингредиентов) → Меню (мероприятия, состоящие из блюд и/или отдельных ингредиентов по дням и приёмам пищи). Все расчёты стоимости идут через `src/lib/calculations.ts` — не дублировать формулы конвертации единиц/стоимости в компонентах.

### Таблицы Supabase (все с RLS на `user_id = auth.uid()`, кроме дочерних таблиц мероприятия — там RLS через `exists (... menu_events ... user_id = auth.uid())`)
- `profiles` — профиль пользователя.
- `dishes` — блюда (`name`, `notes`).
- `ingredient_products` — каталог ингредиентов (`kind`, `package_amount/unit/price`).
- `dish_ingredients` — состав блюда (`quantity_per_portion`, `usage_unit`), join `dishes` ↔ `ingredient_products`.
- `menu_events` — мероприятия: `name`, `notes`, `is_default`, `folder_id` (→ `menu_event_folders`), `event_type` (`'weekly' | 'custom'`), `guest_count` (текст, поддерживает формат вроде `145(170)`).
- `menu_event_folders` — папки для группировки мероприятий.
- `menu_event_days` — дни мероприятия: `day_index` (1..N, то же значение хранится в `menu_entries.weekday`), `calendar_date` (nullable — заполнено для дат, выбранных через календарь; null для дефолтных недельных дней Пн-Вс).
- `menu_event_meal_types` — приёмы пищи мероприятия: `key` (произвольный slug, не enum), `label`, `sort_order`. У каждого мероприятия свой набор — при создании автоматически сеются 4 стандартных (Завтрак/Обед/Ужин/Полдник), дальше пользователь может переименовать/удалить/добавить свои.
- `menu_entries` — позиция меню: `event_id`, `weekday` (= `day_index` из `menu_event_days`), `meal_type` (свободный текст — валидируется в приложении по `menu_event_meal_types.key`, **без** CHECK-constraint в БД), `item_type` (`'dish' | 'ingredient'`), `dish_id`/`ingredient_id`, `portions`, `variant_name`.
- `cart_items` — корзина покупок (по блюдам и/или ингредиентам, с привязкой к `menu_entries` через `source_menu_entry_id`).

### Конвенция миграций
- Новые изменения схемы — **только аддитивные** (`create table if not exists`, `add column if not exists`, ослабление/добавление constraint без удаления данных). Никогда не удалять/не изменять деструктивно существующие колонки без явного подтверждения пользователя — база продовая (реальные пользовательские данные).
- Каждое изменение схемы — отдельный файл в `supabase/migrations/NNNN_description.sql`, и синхронно отражается в `supabase/schema.sql`, чтобы файл описывал актуальное состояние для развёртывания с нуля.
- Перед миграцией, трогающей существующие таблицы, — бэкап (дамп/экспорт через Supabase Dashboard) соответствующих таблиц.
- Миграции применяются вручную через Supabase SQL Editor (в проекте нет Supabase CLI/service-role доступа для автоматического прогона).

## Правила кодирования
- Функциональные компоненты + TypeScript.
- Только Tailwind CSS для стилей.
- Всегда фильтровать/проверять `user_id` при прямых запросах к Supabase (хотя RLS и так защищает на уровне БД).
- Переиспользовать существующие хелперы расчёта стоимости (`src/lib/calculations.ts`) и пагинации (`fetchAllPages` в `src/lib/api.ts`) вместо дублирования логики.
- **Безопасность данных:** менять структуру существующих таблиц Supabase можно только аддитивно и с подтверждением — база содержит реальные пользовательские данные (ингредиенты, блюда, меню), которые нельзя терять.

### Паттерн "Сохранено" для форм
Для любой кнопки, сохраняющей форму (в отличие от кнопок навигации/добавления/удаления), использовать связку `useSavedState()` (`src/lib/hooks/useSavedState.ts`) + `<SaveButton>` (`src/components/SaveButton.tsx`): `markSaving()` перед мутацией, `markSaved()` в `onSuccess` (кнопка на 1.5с показывает серый фон и текст "Сохранено"), `markIdle()` при любом изменении поля формы после успешного сохранения. Не создавать новый ad-hoc паттерн для каждой формы.

### Дропдауны с абсолютным позиционированием
Карточки интерфейса (`.glass-card`) используют `backdrop-blur`, который делает предка containing block не только для стекового контекста, но и для `position: fixed` у потомков — обычный `position: absolute`/`fixed` дропдаун внутри такой карточки не сможет отрендериться поверх соседних карточек. Для выпадающих списков внутри `.glass-card` использовать `ReactDOM.createPortal` в `document.body` с вычисленной через `getBoundingClientRect()` позицией (см. `useDropdownAnchorStyle` в `src/pages/Menu.tsx`) — это единственный надёжный способ.

### Модель мероприятия в разделе "Меню"
Мероприятие (`menu_events`) не привязано жёстко к неделе Пн-Вс: `event_type = 'weekly'` — дни выбираются календарным диапазоном (или остаются дефолтными 7 днями, если диапазон не задан), `event_type = 'custom'` — произвольный набор несмежных дат. Дни и приёмы пищи всегда живут в дочерних таблицах (`menu_event_days`, `menu_event_meal_types`), а не в хардкоде компонента — при добавлении новой логики в `Menu.tsx` использовать их, а не константы вида `[1,2,3,4,5,6,7]`.

Выбранное мероприятие/день/режим (просмотр/редактирование) на странице "Меню" хранятся в query-параметрах URL (`?event=&day=&mode=`), а не в локальном `useState` — это единственный способ пережить размонтирование страницы при переходе на другую вкладку и обратно.

## Специфические задачи (Current Focus)
На момент этой версии файла все ранее запланированные пункты (смена пароля, шторка в `DishEdit`, оптимизация рендеров, универсальное меню блюдо/ингредиент, папки/календарь/гости/кастомные приёмы пищи, новый формат экспорта, пересчёт порций в сводке, персистентность навигации) реализованы. Актуальный список задач вести отдельно (issue-трекер или сообщение задачи), не хранить здесь устаревший чеклист.

## Команды проекта
- `npm run dev` — запуск локально
- `npm run build` — `tsc --noEmit` + сборка (`vite build`); использовать как основную проверку перед коммитом, отдельного `lint`-скрипта в проекте нет
- `npm run preview` — предпросмотр собранного `dist/`
