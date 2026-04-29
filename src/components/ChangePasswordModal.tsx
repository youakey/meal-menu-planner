import React from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<{ password?: string; confirm?: string }>({})

  function validate(): boolean {
    const next: typeof errors = {}
    if (password.length < 8) next.password = 'Минимум 8 символов.'
    if (password !== confirm) next.confirm = 'Пароли не совпадают.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.push(error.message, 'error')
    } else {
      toast.push('Пароль успешно изменён.', 'success')
      handleClose()
    }
  }

  function handleClose() {
    setPassword('')
    setConfirm('')
    setErrors({})
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="glass-card w-full max-w-sm p-6">
        <div className="mb-5 text-lg font-semibold text-amber-50">Смена пароля</div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Новый пароль</label>
            <input
              type="password"
              className="glass-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Не менее 8 символов"
            />
            {errors.password && (
              <div className="mt-1 text-xs text-rose-400">{errors.password}</div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-amber-100/70">Подтвердите пароль</label>
            <input
              type="password"
              className="glass-input w-full"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Повторите пароль"
            />
            {errors.confirm && (
              <div className="mt-1 text-xs text-rose-400">{errors.confirm}</div>
            )}
          </div>

          <div className="mt-2 flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={handleClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
