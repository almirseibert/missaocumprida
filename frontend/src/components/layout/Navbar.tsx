'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Home, ClipboardList, Calendar, User, LogOut, Rss, Menu, X, ChevronDown, FileText, Wallet, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useNotifications } from '@/hooks/useNotifications'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/utils'
import toast from 'react-hot-toast'

const navItems = [
  { href: '/home', label: 'Início', icon: Home },
  { href: '/meus-pedidos', label: 'Meus Pedidos', icon: ClipboardList, roles: ['CLIENT', 'BOTH'] },
  { href: '/feed', label: 'Feed de Pedidos', icon: Rss, roles: ['PROVIDER', 'BOTH', 'ADMIN'] },
  { href: '/minhas-propostas', label: 'Minhas Propostas', icon: FileText, roles: ['PROVIDER', 'BOTH'] },
  { href: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/carteira', label: 'Carteira', icon: Wallet, roles: ['PROVIDER', 'BOTH', 'ADMIN'] },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const { notifications, unread, markRead, markAllRead } = useNotifications()

  const handleLogout = async () => {
    await logout()
    toast.success('Até logo!')
    router.replace('/login')
  }

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true
    if (!user) return false
    return item.roles.includes(user.role)
  })

  function handleNotifClick(n: { id: string; type: string; data?: Record<string, string>; read: boolean }) {
    if (!n.read) markRead(n.id)
    setNotifOpen(false)
    // Navigate to the relevant page
    if (n.data?.schedule_id) router.push(`/agendamentos/${n.data.schedule_id}`)
    else if (n.data?.order_id) router.push(`/feed`)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">✅</span>
            <span className="font-bold text-gray-900 hidden sm:block">Missão Cumprida</span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: notification bell + user menu */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 flex flex-col max-h-[420px]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <span className="font-semibold text-gray-800 text-sm">Notificações</span>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline">
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Nenhuma notificação</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={cn(
                              'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                              !n.read && 'bg-blue-50 hover:bg-blue-50/80'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                              <div className={!n.read ? '' : 'ml-4'}>
                                <p className="text-sm font-medium text-gray-800 leading-tight">{n.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Avatar name={user.name} avatar={user.avatar} size="sm" />
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                      <Link
                        href="/perfil"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="w-4 h-4" />
                        Meu Perfil
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-10 bg-white pt-16">
          <nav className="p-4 flex flex-col gap-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <hr className="my-2 border-gray-100" />
            <Link
              href="/perfil"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-100"
            >
              <User className="w-5 h-5" />
              Meu Perfil
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </nav>
        </div>
      )}
    </>
  )
}
