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
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.push('Вход выполнен.', 'success')
        navigate('/main', { replace: true })
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
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
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-3xl font-semibold">{mode === 'login' ? 'Вход' : 'Регистрация'}</div>
          <div className="mt-2 text-slate-600">
            {mode === 'login'
              ? 'Войдите, чтобы управлять своим меню и каталогом блюд.'
              : 'Создайте аккаунт, чтобы хранить данные в своем профиле.'}
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white shadow-soft p-6">
          <label className="block text-sm font-medium">Почта</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-300"
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label className="block text-sm font-medium mt-4">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-300"
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          <div className="mt-4 text-sm text-slate-600 flex items-center justify-between">
            <button
              type="button"
              className="underline"
              onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
            >
              {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
            </button>
            <a
              className="underline"
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              title="Supabase"
            >
              Supabase
            </a>
          </div>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          Примечание: для работы приложения нужны переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
        </div>
      </div>
    </div>
  )
}
