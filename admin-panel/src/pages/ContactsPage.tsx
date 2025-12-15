import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { contactsApi } from '../services/api'
import {
  UserGroupIcon,
  PhoneIcon,
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  TruckIcon,
  HomeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface Contact {
  id: string
  driver_id: string
  driver_name: string
  driver_phone: string
  contact_id: string | null
  name: string
  phone_numbers: string[]
  contact_type: string | null
  synced_at: string
}

interface ContactStats {
  total_contacts: number
  total_drivers: number
  customer_contacts: number
  broker_contacts: number
  colleague_contacts: number
  family_contacts: number
}

const contactTypeLabels: Record<string, string> = {
  customer: 'Musteri',
  broker: 'Komisyoncu',
  colleague: 'Meslektasi',
  family: 'Aile',
}

const contactTypeIcons: Record<string, typeof UserIcon> = {
  customer: BuildingOfficeIcon,
  broker: TruckIcon,
  colleague: UserGroupIcon,
  family: HomeIcon,
}

const contactTypeColors: Record<string, string> = {
  customer: 'text-blue-600 bg-blue-100',
  broker: 'text-orange-600 bg-orange-100',
  colleague: 'text-purple-600 bg-purple-100',
  family: 'text-green-600 bg-green-100',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ContactsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['all-contacts', page, search],
    queryFn: () => contactsApi.getAll({ limit, offset: page * limit, search: search || undefined }),
  })

  const contacts: Contact[] = data?.data?.contacts || []
  const total = data?.data?.total || 0
  const stats: ContactStats | null = data?.data?.stats || null
  const totalPages = Math.ceil(total / limit)

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rehber</h1>
        <p className="text-gray-500">Tum soforlerin rehber kayitlari</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Toplam Kisi</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_contacts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Sofor Sayisi</div>
            <div className="text-2xl font-bold text-primary-600">{stats.total_drivers}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Musteri</div>
            <div className="text-2xl font-bold text-blue-600">{stats.customer_contacts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Komisyoncu</div>
            <div className="text-2xl font-bold text-orange-600">{stats.broker_contacts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Meslektasi</div>
            <div className="text-2xl font-bold text-purple-600">{stats.colleague_contacts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Aile</div>
            <div className="text-2xl font-bold text-green-600">{stats.family_contacts}</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Isim veya telefon numarasi ile ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Ara
          </button>
          {search && (
            <button
              onClick={() => {
                setSearch('')
                setSearchInput('')
                setPage(0)
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sofor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kisi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Senkronizasyon</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => {
                const Icon = contact.contact_type ? contactTypeIcons[contact.contact_type] || UserIcon : UserIcon
                const phones = Array.isArray(contact.phone_numbers) ? contact.phone_numbers : []
                return (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/drivers/${contact.driver_id}`} className="flex items-center hover:text-primary-600">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <TruckIcon className="h-4 w-4 text-primary-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{contact.driver_name}</div>
                          <div className="text-xs text-gray-500">{contact.driver_phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {phones.slice(0, 2).map((phone, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-sm text-gray-600">
                            <PhoneIcon className="h-3 w-3" />
                            {phone}
                          </div>
                        ))}
                        {phones.length > 2 && (
                          <div className="text-xs text-gray-400">+{phones.length - 2} daha</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {contact.contact_type ? (
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', contactTypeColors[contact.contact_type])}>
                          <Icon className="h-3 w-3" />
                          {contactTypeLabels[contact.contact_type] || contact.contact_type}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Belirlenmemis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(contact.synced_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <UserGroupIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Kisi bulunamadi</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-500">Toplam {total} kisi</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Onceki
              </button>
              <span className="px-3 py-1 text-sm">
                Sayfa {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
