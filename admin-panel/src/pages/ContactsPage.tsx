import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  ChevronRightIcon,
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

interface DriverWithContacts {
  id: string
  name: string
  surname: string
  phone: string
  contactCount: number
}

const contactTypeLabels: Record<string, string> = {
  customer: 'Müşteri',
  broker: 'Komisyoncu',
  colleague: 'Meslektaşı',
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
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'driver' | 'contact'; id: string; name: string } | null>(null)

  // Fetch all contacts (for search and stats)
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['all-contacts', search],
    queryFn: () => contactsApi.getAll({ limit: 1000, offset: 0, search: search || undefined }),
  })

  const allContacts: Contact[] = contactsData?.data?.contacts || []
  const stats: ContactStats | null = contactsData?.data?.stats || null

  // Group contacts by driver
  const driverGroups = useMemo(() => {
    const groups: Record<string, { driver: DriverWithContacts; contacts: Contact[] }> = {}

    allContacts.forEach((contact) => {
      if (!groups[contact.driver_id]) {
        groups[contact.driver_id] = {
          driver: {
            id: contact.driver_id,
            name: contact.driver_name.split(' ')[0] || '',
            surname: contact.driver_name.split(' ').slice(1).join(' ') || '',
            phone: contact.driver_phone,
            contactCount: 0,
          },
          contacts: [],
        }
      }
      groups[contact.driver_id].contacts.push(contact)
      groups[contact.driver_id].driver.contactCount++
    })

    return Object.values(groups).sort((a, b) => b.driver.contactCount - a.driver.contactCount)
  }, [allContacts])

  // Delete single contact
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => contactsApi.delete(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setShowDeleteModal(false)
      setDeleteTarget(null)
    },
  })

  // Delete all driver contacts
  const deleteDriverContactsMutation = useMutation({
    mutationFn: (driverId: string) => driversApi.deleteContacts(driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] })
      setShowDeleteModal(false)
      setDeleteTarget(null)
      setExpandedDriverId(null)
    },
  })

  const handleSearch = () => {
    setSearch(searchInput)
    setExpandedDriverId(null)
  }

  const toggleDriverExpand = (driverId: string) => {
    setExpandedDriverId(expandedDriverId === driverId ? null : driverId)
  }

  const handleDeleteDriverContacts = (driver: DriverWithContacts) => {
    setDeleteTarget({
      type: 'driver',
      id: driver.id,
      name: `${driver.name} ${driver.surname}`,
    })
    setShowDeleteModal(true)
  }

  const handleDeleteContact = (contact: Contact) => {
    setDeleteTarget({
      type: 'contact',
      id: contact.id,
      name: contact.name,
    })
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    if (deleteTarget.type === 'driver') {
      deleteDriverContactsMutation.mutate(deleteTarget.id)
    } else {
      deleteContactMutation.mutate(deleteTarget.id)
    }
  }

  const isDeleting = deleteContactMutation.isPending || deleteDriverContactsMutation.isPending

  if (contactsLoading) {
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
        <p className="text-gray-500">Şoförlerin rehber kayıtları - Şoföre tıklayarak rehberini görüntüleyin</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Toplam Kişi</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Şoför Sayısı</div>
            <div className="text-2xl font-bold text-primary-600">{stats.total_drivers.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Müşteri</div>
            <div className="text-2xl font-bold text-blue-600">{stats.customer_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Komisyoncu</div>
            <div className="text-2xl font-bold text-orange-600">{stats.broker_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Meslektaşı</div>
            <div className="text-2xl font-bold text-purple-600">{stats.colleague_contacts.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Aile</div>
            <div className="text-2xl font-bold text-green-600">{stats.family_contacts.toLocaleString()}</div>
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
              placeholder="Şoför adı, kişi adı veya telefon numarası ile ara..."
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
                setExpandedDriverId(null)
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Temizle
            </button>
          )}
        </div>
        {search && (
          <div className="mt-2 text-sm text-gray-500">
            "{search}" için {allContacts.length} sonuç bulundu
          </div>
        )}
      </div>

      {/* Driver List with Expandable Contacts */}
      <div className="space-y-3">
        {driverGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <UserGroupIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Rehber kaydı bulunamadı</p>
          </div>
        ) : (
          driverGroups.map(({ driver, contacts }) => (
            <div key={driver.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Driver Header - Clickable */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleDriverExpand(driver.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedDriverId === driver.id ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <TruckIcon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {driver.name} {driver.surname}
                    </div>
                    <div className="text-sm text-gray-500">{driver.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary-600">{driver.contactCount}</div>
                    <div className="text-xs text-gray-500">kişi</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteDriverContacts(driver)
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Tüm rehberi sil"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Expanded Contacts */}
              {expandedDriverId === driver.id && (
                <div className="border-t">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kişi</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Senkronizasyon</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {contacts.map((contact) => {
                          const Icon = contact.contact_type
                            ? contactTypeIcons[contact.contact_type] || UserIcon
                            : UserIcon
                          const phones = Array.isArray(contact.phone_numbers) ? contact.phone_numbers : []
                          return (
                            <tr key={contact.id} className="hover:bg-gray-50">
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
                                  <span className="text-xs text-gray-400">Belirlenmemiş</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {formatTurkeyDate(contact.synced_at)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteContact(contact)}
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {deleteTarget.type === 'driver' ? 'Tüm Rehberi Sil' : 'Kişiyi Sil'}
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              {deleteTarget.type === 'driver' ? (
                <>
                  <span className="font-semibold">{deleteTarget.name}</span> şoförünün tüm rehber kayıtları
                  kalıcı olarak silinecek. Bu işlem geri alınamaz.
                </>
              ) : (
                <>
                  <span className="font-semibold">{deleteTarget.name}</span> kişisi kalıcı olarak silinecek. Bu
                  işlem geri alınamaz.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteTarget(null)
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                İptal
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
                    {deleteTarget.type === 'driver' ? 'Tümünü Sil' : 'Sil'}
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
