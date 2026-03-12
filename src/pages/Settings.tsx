import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ChefHat, Package, Plus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { upsertDish } from '../lib/api'

export function SettingsPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const createDishMut = useMutation({
    mutationFn: () => upsertDish({ name: 'Новое блюдо', notes: null }),
    onSuccess: (dish) => {
      toast.push('Блюдо создано.', 'success')
      navigate(`/catalog/${dish.id}`)
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка создания блюда.', 'error'),
  })

  return (
    <Layout title="Настройки">
      <div className="space-y-6">
        <div className="glass-card p-6 md:p-8">
          <div className="section-subtitle">Навигация и быстрые действия</div>
          <div className="section-title mt-1">Управление планировщиком</div>

          <div className="mt-4 max-w-3xl text-sm leading-7 text-amber-100/65">
            Здесь вы управляете каталогом: добавляете блюда, редактируете ингредиенты, настраиваете базу продуктов и переходите к нужным разделам без лишних кликов.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => createDishMut.mutate()} className="btn-primary">
              <Plus size={16} />
              Добавить блюдо
            </button>

            <Link to="/catalog" className="btn-secondary">
              Открыть каталог
            </Link>
          </div>
        </div>

        <div className="glass-card p-6 md:p-8">
          <div className="section-subtitle">Быстрый доступ</div>
          <div className="section-title mt-1">Основные разделы</div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link
              to="/ingredients"
              className="rounded-3xl border border-white/10 bg-black/10 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-amber-200">
                  <Package size={18} />
                </div>
                <div className="text-lg font-semibold text-amber-50">База ингредиентов</div>
              </div>
              <div className="mt-3 text-sm leading-7 text-amber-100/60">
                Добавляйте и редактируйте ингредиенты, упаковки, единицы измерения и стоимость.
              </div>
              <div className="mt-4 text-sm font-medium text-amber-200">Редактировать ингредиенты →</div>
            </Link>

            <Link
              to="/catalog"
              className="rounded-3xl border border-white/10 bg-black/10 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-amber-200">
                  <ChefHat size={18} />
                </div>
                <div className="text-lg font-semibold text-amber-50">Каталог блюд</div>
              </div>
              <div className="mt-3 text-sm leading-7 text-amber-100/60">
                Собирайте блюда из готовой базы ингредиентов и задавайте количество на порцию.
              </div>
              <div className="mt-4 text-sm font-medium text-amber-200">Открыть каталог →</div>
            </Link>
          </div>
        </div>

        <div className="text-sm text-amber-100/45">
          Подсказка: если где-то еще остается светлая тема, значит на этой странице еще живут старые классы `bg-white`, `text-slate-*` или `border-slate-*`. Их нужно заменить на ваши новые `glass-*` и amber-стили.
        </div>
      </div>
    </Layout>
  )
}
