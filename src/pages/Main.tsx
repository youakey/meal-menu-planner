import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChefHat, Package, ScrollText } from 'lucide-react'
import { Layout } from '../components/Layout'
import { fetchDishes, fetchIngredientProducts, fetchMenuEntries } from '../lib/api'

export function MainPage() {
  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })
  const ingredientsQ = useQuery({ queryKey: ['ingredient_products'], queryFn: fetchIngredientProducts })
  const menuQ = useQuery({ queryKey: ['menu_entries'], queryFn: fetchMenuEntries })

  return (
    <Layout title="Кулинарная мастерская">
      <div className="glass-card shine p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="section-subtitle">Новая схема работы</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-amber-50 md:text-4xl">
            Сначала база ингредиентов, потом блюда, затем меню недели.
          </h1>
          <p className="mt-4 text-sm leading-7 text-amber-100/70 md:text-base">
            Теперь ингредиенты живут отдельно. Вы один раз заносите их в базу с количеством и ценой,
            а при создании блюда просто выбираете нужные позиции из готового списка.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/ingredients" className="btn-primary">
              Открыть ингредиенты
            </Link>
            <Link to="/catalog" className="btn-secondary">
              Открыть блюда
            </Link>
            <Link to="/menu" className="btn-secondary">
              Перейти в меню
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <StatCard icon={<Package size={18} />} label="Ингредиенты" value={ingredientsQ.data?.length ?? 0} />
        <StatCard icon={<ChefHat size={18} />} label="Блюда" value={dishesQ.data?.length ?? 0} />
        <StatCard icon={<BookOpen size={18} />} label="Записи меню" value={menuQ.data?.length ?? 0} />
        <StatCard icon={<ScrollText size={18} />} label="Этап" value="Готово" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <FeatureCard
          title="1. База ингредиентов"
          desc="Добавляйте муку, яйца, молоко, масло и любые другие позиции с упаковкой и ценой."
          href="/ingredients"
        />
        <FeatureCard
          title="2. Сборка блюда"
          desc="Откройте блюдо и подберите ингредиенты из базы. Укажите количество на порцию."
          href="/catalog"
        />
        <FeatureCard
          title="3. Итоги и покупки"
          desc="Система посчитает общий расход ингредиентов и ориентировочную стоимость."
          href="/summary"
        />
      </div>
    </Layout>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3 text-amber-100/70">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">{icon}</div>
        <div className="text-sm">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold text-amber-50">{value}</div>
    </div>
  )
}

function FeatureCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link to={href} className="glass-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/20">
      <div className="text-lg font-semibold text-amber-50">{title}</div>
      <div className="mt-3 text-sm leading-7 text-amber-100/65">{desc}</div>
      <div className="mt-5 text-sm font-medium text-amber-200">Открыть →</div>
    </Link>
  )
}
