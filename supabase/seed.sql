-- Optional demo data
-- 1) Create a user via the app (Signup) and copy their UUID from Auth → Users.
-- 2) Replace USER_UUID below and run.

-- replace with your user's uuid
-- \set USER_UUID '00000000-0000-0000-0000-000000000000'

-- Example dish: Борщ красный (3л)
insert into public.dishes (user_id, name, notes)
values
  (:USER_UUID, 'Борщ красный (3л)', 'Пример для теста')
returning id;

-- After insert, manually copy the returned dish id and use below, or run in a transaction with psql.
-- For simplicity in Supabase SQL editor, do it in two steps.

-- Example ingredients (replace DISH_UUID):
-- insert into public.dish_ingredients (dish_id, user_id, ingredient_name, grams_per_portion, price_per_gram)
-- values
--   ('DISH_UUID', :USER_UUID, 'Мясо (суповой набор)', 30, 0.10),
--   ('DISH_UUID', :USER_UUID, 'Свекла', 500, 0.003),
--   ('DISH_UUID', :USER_UUID, 'Картофель', 500, 0.002);
