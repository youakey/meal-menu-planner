import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useToast } from './Toast'
import { SaveButton } from './SaveButton'
import { CalendarRangePicker, CalendarMultiPicker } from './CalendarPicker'
import {
  deleteMenuEventMealType,
  fetchMenuEventDays,
  fetchMenuEventFolders,
  fetchMenuEventMealTypes,
  replaceMenuEventDays,
  upsertMenuEvent,
  upsertMenuEventFolder,
  upsertMenuEventMealType,
} from '../lib/api'
import { useSavedState } from '../lib/hooks/useSavedState'
import type { MenuEvent, MenuEventType } from '../lib/types'

const DEFAULT_MEAL_TYPES = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch', label: 'Обед' },
  { key: 'dinner', label: 'Ужин' },
  { key: 'late_snack', label: 'Полдник' },
]

function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function EventFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean
  onClose: () => void
  initial: MenuEvent | null
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const saveState = useSavedState()

  const [event, setEvent] = React.useState<MenuEvent | null>(initial)
  const [name, setName] = React.useState(initial?.name ?? '')
  const [folderId, setFolderId] = React.useState<string>(initial?.folder_id ?? '')
  const [newFolderName, setNewFolderName] = React.useState('')
  const [eventType, setEventType] = React.useState<MenuEventType>(initial?.event_type ?? 'weekly')
  const [guestCount, setGuestCount] = React.useState(initial?.guest_count ?? '')
  const [range, setRange] = React.useState<DateRange | undefined>(undefined)
  const [multiDates, setMultiDates] = React.useState<Date[]>([])
  const [newMealTypeLabel, setNewMealTypeLabel] = React.useState('')

  const foldersQ = useQuery({ queryKey: ['menu_event_folders'], queryFn: fetchMenuEventFolders, enabled: open })
  const daysQ = useQuery({
    queryKey: ['menu_event_days', event?.id],
    queryFn: () => fetchMenuEventDays(event!.id),
    enabled: open && !!event?.id,
  })
  const mealTypesQ = useQuery({
    queryKey: ['menu_event_meal_types', event?.id],
    queryFn: () => fetchMenuEventMealTypes(event!.id),
    enabled: open && !!event?.id,
  })

  React.useEffect(() => {
    if (!open) return
    setEvent(initial)
    setName(initial?.name ?? '')
    setFolderId(initial?.folder_id ?? '')
    setEventType(initial?.event_type ?? 'weekly')
    setGuestCount(initial?.guest_count ?? '')
    setNewFolderName('')
    setNewMealTypeLabel('')
    saveState.markIdle()
  }, [open, initial?.id])

  React.useEffect(() => {
    const rows = daysQ.data
    if (!rows || !rows.length) {
      setRange(undefined)
      setMultiDates([])
      return
    }
    const dated = rows.filter((r) => r.calendar_date)
    if (dated.length) {
      const dates = dated.map((r) => new Date(r.calendar_date as string)).sort((a, b) => a.getTime() - b.getTime())
      setMultiDates(dates)
      setRange({ from: dates[0], to: dates[dates.length - 1] })
    }
  }, [daysQ.data])

  const createFolderMut = useMutation({
    mutationFn: (folderName: string) => upsertMenuEventFolder({ name: folderName }),
    onSuccess: (folder) => {
      qc.invalidateQueries({ queryKey: ['menu_event_folders'] })
      setFolderId(folder.id)
      setNewFolderName('')
      toast.push('Папка создана.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка создания папки.', 'error'),
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Введите название мероприятия.')

      const saved = await upsertMenuEvent({
        id: event?.id,
        name: name.trim(),
        is_default: initial?.is_default ?? false,
        folder_id: folderId || null,
        event_type: eventType,
        guest_count: guestCount.trim() || null,
      })

      let days: Array<{ day_index: number; calendar_date: string | null }> = []
      if (eventType === 'weekly') {
        if (range?.from && range?.to) {
          const dates: Date[] = []
          const cur = new Date(range.from)
          while (cur <= range.to) {
            dates.push(new Date(cur))
            cur.setDate(cur.getDate() + 1)
          }
          days = dates.map((d, idx) => ({ day_index: idx + 1, calendar_date: toISODate(d) }))
        } else {
          days = [1, 2, 3, 4, 5, 6, 7].map((idx) => ({ day_index: idx, calendar_date: null }))
        }
      } else {
        const sorted = [...multiDates].sort((a, b) => a.getTime() - b.getTime())
        days = sorted.map((d, idx) => ({ day_index: idx + 1, calendar_date: toISODate(d) }))
      }
      await replaceMenuEventDays(saved.id, days)

      const isNew = !event?.id
      if (isNew) {
        await Promise.all(
          DEFAULT_MEAL_TYPES.map((m, idx) =>
            upsertMenuEventMealType({ event_id: saved.id, key: m.key, label: m.label, sort_order: idx })
          )
        )
      }

      return saved
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['menu_events'] })
      qc.invalidateQueries({ queryKey: ['menu_event_days', saved.id] })
      qc.invalidateQueries({ queryKey: ['menu_event_meal_types', saved.id] })
      setEvent(saved)
      toast.push('Мероприятие сохранено.', 'success')
      saveState.markSaved()
    },
    onError: (e: any) => {
      toast.push(e?.message ?? 'Ошибка сохранения мероприятия.', 'error')
      saveState.markIdle()
    },
  })

  const addMealTypeMut = useMutation({
    mutationFn: async () => {
      if (!event?.id) throw new Error('Сначала сохраните мероприятие.')
      if (!newMealTypeLabel.trim()) throw new Error('Введите название приёма пищи.')
      const sortOrder = mealTypesQ.data?.length ?? 0
      const key = `custom_${crypto.randomUUID().slice(0, 8)}`
      return upsertMenuEventMealType({ event_id: event.id, key, label: newMealTypeLabel.trim(), sort_order: sortOrder })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_event_meal_types', event?.id] })
      setNewMealTypeLabel('')
      toast.push('Приём пищи добавлен.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка добавления.', 'error'),
  })

  const renameMealTypeMut = useMutation({
    mutationFn: (input: { id: string; event_id: string; key: string; label: string; sort_order: number }) =>
      upsertMenuEventMealType(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_event_meal_types', event?.id] }),
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка переименования.', 'error'),
  })

  const deleteMealTypeMut = useMutation({
    mutationFn: deleteMenuEventMealType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_event_meal_types', event?.id] })
      toast.push('Приём пищи удалён. Связанные позиции меню перестанут отображаться.', 'success')
    },
    onError: (e: any) => toast.push(e?.message ?? 'Ошибка удаления.', 'error'),
  })

  if (!open) return null

  const folders = foldersQ.data ?? []
  const mealTypes = mealTypesQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="section-title">{event?.id ? 'Редактирование мероприятия' : 'Новое мероприятие'}</div>
          <button onClick={onClose} className="btn-secondary px-3 py-2">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Название</label>
            <input
              className="glass-input w-full"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                saveState.markIdle()
              }}
              placeholder="Например: Малорита 06-09.07.26"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-amber-100/70">Папка</label>
              <select
                className="glass-input w-full"
                value={folderId}
                onChange={(e) => {
                  setFolderId(e.target.value)
                  saveState.markIdle()
                }}
              >
                <option value="" className="bg-[#18161b]">
                  Без папки
                </option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#18161b]">
                    {f.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <input
                  className="glass-input w-full"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Новая папка…"
                />
                <button
                  type="button"
                  className="btn-secondary px-3"
                  disabled={!newFolderName.trim() || createFolderMut.isPending}
                  onClick={() => createFolderMut.mutate(newFolderName.trim())}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-amber-100/70">Количество гостей</label>
              <input
                className="glass-input w-full"
                value={guestCount}
                onChange={(e) => {
                  setGuestCount(e.target.value)
                  saveState.markIdle()
                }}
                placeholder="Например: 145(170)"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Тип мероприятия</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={eventType === 'weekly' ? 'btn-primary px-4 py-2.5' : 'btn-secondary px-4 py-2.5'}
                onClick={() => {
                  setEventType('weekly')
                  saveState.markIdle()
                }}
              >
                По дням недели
              </button>
              <button
                type="button"
                className={eventType === 'custom' ? 'btn-primary px-4 py-2.5' : 'btn-secondary px-4 py-2.5'}
                onClick={() => {
                  setEventType('custom')
                  saveState.markIdle()
                }}
              >
                Простое меню (произвольные дни)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-amber-100/70">
              {eventType === 'weekly' ? 'Диапазон дат (необязательно)' : 'Выберите даты'}
            </label>
            {eventType === 'weekly' ? (
              <CalendarRangePicker
                value={range}
                onChange={(r) => {
                  setRange(r)
                  saveState.markIdle()
                }}
              />
            ) : (
              <CalendarMultiPicker
                value={multiDates}
                onChange={(dates) => {
                  setMultiDates(dates ?? [])
                  saveState.markIdle()
                }}
              />
            )}
            <div className="mt-2 text-xs text-amber-100/45">
              {eventType === 'weekly' && !range?.from
                ? 'Если диапазон не выбран — мероприятие использует обычные 7 дней недели.'
                : null}
            </div>
          </div>

          {event?.id && (
            <div>
              <label className="mb-2 block text-sm text-amber-100/70">Приёмы пищи</label>
              <div className="grid gap-2">
                {mealTypes.map((mt) => (
                  <div key={mt.id} className="flex items-center gap-2">
                    <input
                      className="glass-input w-full"
                      defaultValue={mt.label}
                      onBlur={(e) => {
                        const next = e.target.value.trim()
                        if (next && next !== mt.label) {
                          renameMealTypeMut.mutate({
                            id: mt.id,
                            event_id: mt.event_id,
                            key: mt.key,
                            label: next,
                            sort_order: mt.sort_order,
                          })
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-danger px-3 py-3"
                      onClick={() => deleteMealTypeMut.mutate(mt.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    className="glass-input w-full"
                    value={newMealTypeLabel}
                    onChange={(e) => setNewMealTypeLabel(e.target.value)}
                    placeholder="Новый приём пищи…"
                  />
                  <button
                    type="button"
                    className="btn-secondary px-3 py-3"
                    disabled={!newMealTypeLabel.trim() || addMealTypeMut.isPending}
                    onClick={() => addMealTypeMut.mutate()}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Закрыть
          </button>
          <SaveButton
            status={saveState.status}
            onClick={() => {
              saveState.markSaving()
              saveMut.mutate()
            }}
          >
            {event?.id ? 'Сохранить изменения' : 'Создать мероприятие'}
          </SaveButton>
        </div>
      </div>
    </div>
  )
}

// re-exported for callers that need to format a selected calendar date consistently
export function formatEventDate(iso: string): string {
  return format(new Date(iso), 'dd.MM.yy', { locale: ru })
}
