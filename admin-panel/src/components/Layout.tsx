import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  HomeIcon,
  UserGroupIcon,
  MapIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  TruckIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  QuestionMarkCircleIcon,
  BellAlertIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Şoförler', href: '/drivers', icon: UserGroupIcon },
  { name: 'Canlı Harita', href: '/live-map', icon: MapIcon },
  { name: 'Analitik', href: '/analytics', icon: ChartBarIcon },
  { name: 'Raporlar', href: '/reports', icon: DocumentChartBarIcon },
  { name: 'Anketler', href: '/surveys', icon: ClipboardDocumentListIcon },
  { name: 'Akıllı Sorular', href: '/questions', icon: QuestionMarkCircleIcon },
  { name: 'Bildirim Şablonları', href: '/notification-templates', icon: BellAlertIcon },
  { name: 'Uygulama Ayarları', href: '/app-config', icon: AdjustmentsHorizontalIcon },
  { name: 'Sistem Ayarları', href: '/settings', icon: Cog6ToothIcon },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <TruckIcon className="h-8 w-8 text-primary-600" />
          <span className="text-xl font-bold text-gray-900">TestSistem</span>
        </div>

        <nav className="mt-6 px-3">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium mb-1',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
