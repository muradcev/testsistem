import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
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
  SignalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RectangleStackIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  CalculatorIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

interface NavGroup {
  name: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  items: NavItem[]
  defaultOpen?: boolean
}

const navigationGroups: NavGroup[] = [
  {
    name: 'Şoför Yönetimi',
    icon: UserGroupIcon,
    defaultOpen: true,
    items: [
      { name: 'Tüm Şoförler', href: '/drivers', icon: UserGroupIcon },
      { name: 'Son Konumlar', href: '/driver-locations', icon: MapPinIcon },
    ],
  },
  {
    name: 'Konum Takip',
    icon: MapIcon,
    defaultOpen: true,
    items: [
      { name: 'Canlı Harita', href: '/live-map', icon: MapIcon },
      { name: 'Canlı Takip', href: '/live-tracking', icon: SignalIcon },
      { name: 'Konum Takibi', href: '/location-tracking', icon: MapPinIcon },
      { name: 'Isı Haritası', href: '/heat-map', icon: FireIcon },
      { name: 'Durak Yönetimi', href: '/stops', icon: TruckIcon },
      { name: 'Harita Görünümü', href: '/map-view', icon: GlobeAltIcon },
      { name: 'Geofence Bölgeleri', href: '/geofences', icon: MapPinIcon },
    ],
  },
  {
    name: 'İletişim',
    icon: PhoneIcon,
    items: [
      { name: 'Duyurular', href: '/announcements', icon: MegaphoneIcon },
      { name: 'Akıllı Sorular', href: '/questions', icon: QuestionMarkCircleIcon },
      { name: 'Soru Tasarımcısı', href: '/question-designer', icon: RectangleStackIcon },
      { name: 'Anketler', href: '/surveys', icon: ClipboardDocumentListIcon },
      { name: 'Arama Geçmişi', href: '/call-logs', icon: PhoneIcon },
      { name: 'Rehber', href: '/contacts', icon: BookOpenIcon },
      { name: 'Bildirim Şablonları', href: '/notification-templates', icon: BellAlertIcon },
    ],
  },
  {
    name: 'Analitik & Raporlar',
    icon: ChartBarIcon,
    items: [
      { name: 'Analitik', href: '/analytics', icon: ChartBarIcon },
      { name: 'Fiyat Raporları', href: '/transport-records', icon: CurrencyDollarIcon },
      { name: 'Mesafe Hesaplama', href: '/distance-calculator', icon: CalculatorIcon },
      { name: 'Raporlar', href: '/reports', icon: DocumentChartBarIcon },
      { name: 'Hata Takip', href: '/error-monitoring', icon: BugAntIcon },
    ],
  },
  {
    name: 'Ayarlar',
    icon: Cog6ToothIcon,
    items: [
      { name: 'Uygulama Ayarları', href: '/app-config', icon: AdjustmentsHorizontalIcon },
      { name: 'Sistem Ayarları', href: '/settings', icon: Cog6ToothIcon },
      { name: 'Audit Logları', href: '/audit-logs', icon: DocumentTextIcon },
      { name: 'Uygulama Logları', href: '/app-logs', icon: CommandLineIcon },
    ],
  },
]

function NavGroupComponent({
  group,
  isOpen,
  onToggle,
  onItemClick
}: {
  group: NavGroup
  isOpen: boolean
  onToggle: () => void
  onItemClick: () => void
}) {
  const location = useLocation()
  const isAnyActive = group.items.some(item => location.pathname === item.href)

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          isAnyActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <div className="flex items-center gap-3">
          <group.icon className={clsx(
            'h-5 w-5',
            isAnyActive ? 'text-primary-600' : 'text-gray-400'
          )} />
          <span>{group.name}</span>
        </div>
        {isOpen ? (
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>

      <div className={clsx(
        'overflow-hidden transition-all duration-200',
        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="ml-4 pl-4 border-l border-gray-200 mt-1 space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onItemClick}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                  isActive
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Initialize open groups based on current path and defaultOpen
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    navigationGroups.forEach(group => {
      const isAnyActive = group.items.some(item => location.pathname === item.href)
      initial[group.name] = group.defaultOpen || isAnyActive
    })
    return initial
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <TruckIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Nakliyeo
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 border-r border-gray-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <TruckIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Nakliyeo
              </span>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Dashboard Link */}
        <div className="px-3 pt-4 pb-2">
          <NavLink
            to="/dashboard"
            onClick={closeSidebar}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-700 hover:bg-gray-100'
              )
            }
          >
            <HomeIcon className="h-5 w-5" />
            <span>Dashboard</span>
          </NavLink>
        </div>

        {/* Navigation Groups */}
        <nav className="px-3 pt-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <div className="space-y-1">
            {navigationGroups.map((group) => (
              <NavGroupComponent
                key={group.name}
                group={group}
                isOpen={openGroups[group.name] || false}
                onToggle={() => toggleGroup(group.name)}
                onItemClick={closeSidebar}
              />
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gradient-to-t from-white to-transparent">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        <main className="p-4 lg:p-6 pt-18 lg:pt-6 min-h-screen">
          <div className="lg:hidden h-14" /> {/* Spacer for mobile header */}
          <Outlet />
        </main>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  )
}
