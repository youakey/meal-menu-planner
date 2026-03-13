import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [mode, setMode] = React.useState<'login' | 'signup'>('login')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (session) navigate('/main', { replace: true })
  }, [session, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim() || !password) {
      toast.push('Заполните почту и пароль.', 'error')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error

        toast.push('Вход выполнен.', 'success')
        navigate('/main', { replace: true })
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error

        toast.push('Аккаунт создан. Теперь войдите.', 'success')
        setMode('login')
      }
    } catch (err: any) {
      toast.push(err?.message ?? 'Ошибка авторизации.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 text-amber-50">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-3xl font-semibold text-amber-50">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </div>
          <div className="mt-2 text-sm leading-7 text-amber-100/65">
            {mode === 'login'
              ? 'Войдите, чтобы управлять своим меню и каталогом блюд.'
              : 'Создайте аккаунт, чтобы хранить данные в своем профиле.'}
          </div>
        </div>

        <form onSubmit={onSubmit} className="glass-card p-6 md:p-8">
          <label className="block text-sm font-medium text-amber-100/75">Почта</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input mt-2 w-full"
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label className="mt-4 block text-sm font-medium text-amber-100/75">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input mt-2 w-full"
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-amber-100/65">
            <button
              type="button"
              className="transition-colors hover:text-amber-50 underline underline-offset-4"
              onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
            >
              {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
            </button>

            <a
              className="transition-colors hover:text-amber-50 underline underline-offset-4"
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              title="Supabase"
            >
              Supabase
            </a>
          </div>
        </form>

        <div className="mt-4 text-xs leading-6 text-amber-100/45">
          Примечание: для работы приложения нужны переменные окружения
          {' '}
          <span className="text-amber-100/60">VITE_SUPABASE_URL</span>
          {' '}
          и
          {' '}
          <span className="text-amber-100/60">VITE_SUPABASE_ANON_KEY</span>.
        </div>
      </div>
    </div>
  )
}