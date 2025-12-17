import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { contactsApi, driversApi } from '../services/api'
import {
  UserGroupIcon,
  PhoneIcon,
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  TruckIcon,
  HomeIcon,
  TrashIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { formatTurkeyDate } from '../utils/dateUtils'

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

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
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

export default function ContactsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null)
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null)
  const limit = 50

  // Fetch drivers for filter dropdown
  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => driversApi.getAll({ limit: 500, offset: 0 }),
  })

  const drivers: Driver[] = driversData?.data?.drivers || []

  // Fetch contacts
  const { data, isLoading } = useQuery({
    queryKey: ['all-contacts', page, search, selectedDriverId],
    queryFn: () =>
      contactsApi.getAll({
        limit,
        offset: page * limit,
        search: search || undefined,
        driver_id: selectedDriverId || undefined,
      }),
  })

  const contacts: Contact[] = data?.data?.contacts || []
  const total = data?.data?.total || 0
  const stats: ContactStats | null = data?.data?.stats || null
  const totalPages = Math.ceil(total / limit)

  // Delete single contact
  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => contactsApi.delete(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setShowDeleteModal(false)
      setSingleDeleteId(null)
      setDeleteTarget(null)
    },
  })

  // Bulk delete contacts
  const bulkDeleteMutation = useMutation({
    mutationFn: (contactIds: string[]) => contactsApi.bulkDelete(contactIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setSelectedContacts(new Set())
      setShowDeleteModal(false)
      setDeleteTarget(null)
    },
  })

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(0)
    setSelectedContacts(new Set())
  }

  const handleDriverFilter = (driverId: string) => {
    setSelectedDriverId(driverId)
    setPage(0)
    setSelectedContacts(new Set())
  }

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts)
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId)
    } else {
      newSelection.add(contactId)
    }
    setSelectedContacts(newSelection)
  }

  const toggleAllContacts = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)))
    }
  }

  const handleSingleDelete = (contactId: string) => {
    setSingleDeleteId(contactId)
    setDeleteTarget('single')
    setShowDeleteModal(true)
  }

  const handleBulkDelete = () => {
    setDeleteTarget('bulk')
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (deleteTarget === 'single' && singleDeleteId) {
      deleteMutation.mutate(singleDeleteId)
    } else if (deleteTarget === 'bulk') {
      bulkDeleteMutation.mutate(Array.from(selectedContacts))
    }
  }

  const isDeleting = deleteMutation.isPending || bulkDeleteMutation.isPending

  // Pagination helpers
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      if (page > 2) pages.push('...')

      const start = Math.max(1, page - 1)
      const end = Math.min(totalPages - 2, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)

      if (page < totalPages - 3) pages.push('...')
      pages.push(totalPages - 1)
    }

    return pages
  }, [page, totalPages])

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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rehber</h1>
          <p className="text-gray-500">Tum soforlerin rehber kayitlari</p>
        </div>
        {selectedContacts.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <TrashIcon className="h-5 w-5" />
            Secilenleri Sil ({selectedContacts.size})
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Toplam Kisi</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Sofor Sayisi</div>
            <div className="text-2xl font-bold text-primary-600">{stats.total_drivers.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Musteri</div>
            <div className="text-2xl font-bold text-blue-600">{stats.customer_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Komisyoncu</div>
            <div className="text-2xl font-bold text-orange-600">{stats.broker_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Meslektasi</div>
            <div className="text-2xl font-bold text-purple-600">{stats.colleague_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Aile</div>
            <div className="text-2xl font-bold text-green-600">{stats.family_contacts.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Driver Filter */}
          <div className="relative">
            <select
              value={selectedDriverId}
              onChange={(e) => handleDriverFilter(e.target.value)}
              className="appearance-none w-full md:w-64 pl-4 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">Tum Soforler</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} {driver.surname} - {driver.phone}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="flex gap-2 flex-1">
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
            {(search || selectedDriverId) && (
              <button
                onClick={() => {
                  setSearch('')
                  setSearchInput('')
                  setSelectedDriverId('')
                  setPage(0)
                  setSelectedContacts(new Set())
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Temizle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                    onChange={toggleAllContacts}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sofor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kisi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Senkronizasyon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Islemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => {
                const Icon = contact.contact_type ? contactTypeIcons[contact.contact_type] || UserIcon : UserIcon
                const phones = Array.isArray(contact.phone_numbers) ? contact.phone_numbers : []
                const isSelected = selectedContacts.has(contact.id)
                return (
                  <tr key={contact.id} className={clsx('hover:bg-gray-50', isSelected && 'bg-primary-50')}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleContactSelection(contact.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
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
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                            contactTypeColors[contact.contact_type]
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {contactTypeLabels[contact.contact_type] || contact.contact_type}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Belirlenmemis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatTurkeyDate(contact.synced_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleSingleDelete(contact.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Sil"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
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
            <div className="text-sm text-gray-500">
              Toplam {total.toLocaleString()} kisi
              {selectedContacts.size > 0 && (
                <span className="ml-2 text-primary-600">({selectedContacts.size} secili)</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Ilk
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Onceki
              </button>

              {pageNumbers.map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={clsx(
                      'px-3 py-1 border rounded text-sm',
                      p === page ? 'bg-primary-600 text-white border-primary-600' : 'hover:bg-gray-50'
                    )}
                  >
                    {p + 1}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-2 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Sonraki
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page === totalPages - 1}
                className="px-2 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Son
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {deleteTarget === 'bulk' ? 'Secili Kisileri Sil' : 'Kisiyi Sil'}
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              {deleteTarget === 'bulk'
                ? `${selectedContacts.size} kisi kalici olarak silinecek. Bu islem geri alinamaz.`
                : 'Bu kisi kalici olarak silinecek. Bu islem geri alinamaz.'}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSingleDeleteId(null)
                  setDeleteTarget(null)
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Iptal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Siliniyor...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    Sil
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
