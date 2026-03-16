import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChefHat,
  LogOut,
  Package,
  ScrollText,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { cn } from '../lib/utils'

const linkBase =
  'group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-300'

export function Layout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()

  async function onLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen text-amber-50">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(251,146,60,0.18),transparent_22%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.16),transparent_20%)]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#120f12]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/30 to-orange-500/20 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
              <Sparkles size={20} className="text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] uppercase tracking-[0.28em] text-amber-200/60">
                Menu Atelier
              </div>
              <div className="truncate text-base font-semibold text-amber-50 md:text-lg">{title}</div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 xl:flex">
            <TopLink to="/main" label="Главная" icon={<Sparkles size={16} />} />
            <TopLink to="/ingredients" label="Ингредиенты" icon={<Package size={16} />} />
            <TopLink to="/catalog" label="Блюда" icon={<ChefHat size={16} />} />
            <TopLink to="/menu" label="Меню" icon={<BookOpen size={16} />} />
            <TopLink to="/cart" label="Корзина" icon={<ShoppingCart size={16} />} />
            <TopLink to="/summary" label="Итоги" icon={<ScrollText size={16} />} />
          </nav>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-amber-50 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 md:px-4 md:py-2.5"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:py-8">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-24 text-xs text-amber-100/50">
        Данные хранятся в вашем аккаунте Supabase. Только вы имеете доступ к своему меню,
        блюдам, корзине и базе ингредиентов.
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#120f12]/85 backdrop-blur-xl xl:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-6 gap-1 px-2 py-2">
          <MobileLink to="/main" label="Главная" />
          <MobileLink to="/ingredients" label="Ингр." />
          <MobileLink to="/catalog" label="Блюда" />
          <MobileLink to="/menu" label="Меню" />
          <MobileLink to="/cart" label="Корзина" />
          <MobileLink to="/summary" label="Итоги" />
        </div>
      </div>
      <div className="h-16 xl:hidden" />
    </div>
  )
}

function TopLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          linkBase,
          isActive
            ? 'bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.12)]'
            : 'text-amber-100/70 hover:-translate-y-0.5 hover:bg-white/5 hover:text-amber-50'
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function MobileLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'rounded-xl px-2 py-2 text-center text-[10px] transition-all duration-300',
          isActive
            ? 'bg-amber-400/20 text-amber-50'
            : 'text-amber-100/60 hover:bg-white/5 hover:text-amber-50'
        )
      }
    >
      {label}
    </NavLink>
  )
}
