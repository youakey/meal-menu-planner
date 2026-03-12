import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Plus, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { deleteDish, fetchDishes, upsertDish } from '../lib/api'

export function CatalogPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [toDelete, setToDelete] = React.useState<{ id: string; name: string } | null>(null)

  const dishesQ = useQuery({ queryKey: ['dishes'], queryFn: fetchDishes })

  const createMut = useMutation({
    mutationFn: () => upsertDish({ name: 'Новое блюдо', notes: null }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['dishes'] })
      toast.push('Блюдо создано. Теперь добавьте ингредиенты из базы.', 'success')
      navigate(`/catalog/${d.id}`)
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка создания блюда.', 'error'),
  })

  const delMut = useMutation({
    mutationFn: deleteDish,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dishes'] })
      toast.push('Блюдо удалено.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления блюда.', 'error'),
  })

  const dishes = dishesQ.data ?? []
  const filtered = dishes.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Layout title="Каталог блюд">
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-subtitle">Блюда собираются из базы ингредиентов</div>
            <div className="section-title mt-1">Ваши рецепты</div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск блюда…"
              className="glass-input min-w-[260px]"
            />
            <button onClick={() => createMut.mutate()} className="btn-primary">
              <Plus size={16} />
              Добавить блюдо
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="glass-card p-6 text-sm text-amber-100/60">
            Пока нет блюд. Начните с добавления первого рецепта.
          </div>
        )}

        {filtered.map((d) => (
          <div
            key={d.id}
            className="glass-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-amber-200">
                  <ChefHat size={18} />
                </div>
                <div>
                  <Link to={`/catalog/${d.id}`} className="text-lg font-semibold text-amber-50 hover:text-amber-200">
                    {d.name}
                  </Link>
                  {d.notes && <div className="mt-2 text-sm text-amber-100/60">{d.notes}</div>}
                </div>
              </div>

              <button className="btn-danger px-3 py-2" onClick={() => setToDelete({ id: d.id, name: d.name })}>
                <Trash2 size={16} />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="text-xs text-amber-100/45">Откройте блюдо, чтобы выбрать ингредиенты из базы.</div>
              <Link to={`/catalog/${d.id}`} className="btn-secondary px-3 py-2">
                Редактировать
              </Link>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Удалить блюдо?"
        description={toDelete ? `Блюдо «${toDelete.name}» будет удалено.` : ''}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) delMut.mutate(toDelete.id)
        }}
      />
    </Layout>
  )
}
