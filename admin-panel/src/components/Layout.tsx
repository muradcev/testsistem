import { useState } from 'react'
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
  Bars3Icon,
  XMarkIcon,
  BugAntIcon,
  MapPinIcon,
  FireIcon,
  DocumentTextIcon,
  PhoneIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Şoförler', href: '/drivers', icon: UserGroupIcon },
  { name: 'Son Konumlar', href: '/driver-locations', icon: MapPinIcon },
  { name: 'Canlı Harita', href: '/live-map', icon: MapIcon },
  { name: 'Isı Haritası', href: '/heat-map', icon: FireIcon },
  { name: 'Durak Yönetimi', href: '/stops', icon: TruckIcon },
  { name: 'Arama Geçmişi', href: '/call-logs', icon: PhoneIcon },
  { name: 'Rehber', href: '/contacts', icon: BookOpenIcon },
  { name: 'Analitik', href: '/analytics', icon: ChartBarIcon },
  { name: 'Raporlar', href: '/reports', icon: DocumentChartBarIcon },
  { name: 'Hata Takip', href: '/error-monitoring', icon: BugAntIcon },
  { name: 'Anketler', href: '/surveys', icon: ClipboardDocumentListIcon },
  { name: 'Akıllı Sorular', href: '/questions', icon: QuestionMarkCircleIcon },
  { name: 'Bildirim Şablonları', href: '/notification-templates', icon: BellAlertIcon },
  { name: 'Uygulama Ayarları', href: '/app-config', icon: AdjustmentsHorizontalIcon },
  { name: 'Sistem Ayarları', href: '/settings', icon: Cog6ToothIcon },
  { name: 'Audit Logları', href: '/audit-logs', icon: DocumentTextIcon },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <TruckIcon className="h-7 w-7 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">TestSistem</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <div className="flex items-center gap-2">
            <TruckIcon className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">TestSistem</span>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-6 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={closeSidebar}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium mb-1',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
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
      <div className="lg:pl-64">
        <main className="p-4 lg:p-6 pt-18 lg:pt-6">
          <div className="lg:hidden h-14" /> {/* Spacer for mobile header */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
