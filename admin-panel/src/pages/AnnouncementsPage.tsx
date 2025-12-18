import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { announcementsApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  MegaphoneIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  PhotoIcon,
  LinkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface Announcement {
  id: string
  title: string
  content: string
  image_url?: string
  link_url?: string
  link_text?: string
  type: string
  priority: number
  is_active: boolean
  is_dismissable: boolean
  start_at?: string
  end_at?: string
  target_type: string
  target_data?: string
  created_at: string
  updated_at: string
}

const announcementTypes = [
  { id: 'info', name: 'Bilgi', color: 'bg-blue-100 text-blue-800', icon: 'bg-blue-500' },
  { id: 'warning', name: 'Uyari', color: 'bg-yellow-100 text-yellow-800', icon: 'bg-yellow-500' },
  { id: 'success', name: 'Basari', color: 'bg-green-100 text-green-800', icon: 'bg-green-500' },
  { id: 'promotion', name: 'Promosyon', color: 'bg-purple-100 text-purple-800', icon: 'bg-purple-500' },
]

const targetTypes = [
  { id: 'all', name: 'Tum Soforler' },
  { id: 'province', name: 'Belirli Iller' },
  { id: 'specific_drivers', name: 'Belirli Soforler' },
]

export default function AnnouncementsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [filterType, setFilterType] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', filterType, filterActive],
    queryFn: () => announcementsApi.getAll({
      limit: 50,
      type: filterType || undefined,
      is_active: filterActive === '' ? undefined : filterActive === 'true',
    }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['announcements-stats'],
    queryFn: () => announcementsApi.getStats(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements-stats'] })
      toast.success('Duyuru silindi')
    },
    onError: () => toast.error('Silinemedi'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements-stats'] })
      toast.success('Durum guncellendi')
    },
    onError: () => toast.error('Guncellenemedi'),
  })

  const announcements = (data?.data?.announcements || []) as Announcement[]
  const stats = statsData?.data || { total: 0, active: 0, by_type: {} }

  const getTypeInfo = (typeId: string) => {
    return announcementTypes.find(t => t.id === typeId) || announcementTypes[0]
  }

  const getTargetName = (targetId: string) => {
    return targetTypes.find(t => t.id === targetId)?.name || targetId
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Bu duyuruyu silmek istediginize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Duyurular</h1>
          <p className="text-sm text-gray-500">Mobil uygulamada gorunecek duyuru ve icerikler</p>
        </div>
        <button
          onClick={() => {
            setEditingAnnouncement(null)
            setShowModal(true)
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 w-full sm:w-auto"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Yeni Duyuru</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Toplam</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Aktif</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pasif</p>
          <p className="text-2xl font-bold text-gray-400">{stats.total - stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Son 7 Gun Kapanma</p>
          <p className="text-2xl font-bold text-orange-600">{stats.dismissals_last_7_days || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tumu</option>
            {announcementTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tumu</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {announcements.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            Henuz duyuru olusturulmamis
          </div>
        ) : (
          announcements.map((announcement) => {
            const typeInfo = getTypeInfo(announcement.type)
            return (
              <div
                key={announcement.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  announcement.is_active ? 'border-green-500' : 'border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-3 w-3 rounded-full ${typeInfo.icon}`}></div>
                      <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.color}`}>
                        {typeInfo.name}
                      </span>
                      {!announcement.is_dismissable && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                          Kapatilamaz
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{announcement.content}</p>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {announcement.image_url && (
                        <span className="flex items-center gap-1">
                          <PhotoIcon className="h-4 w-4" />
                          Resim
                        </span>
                      )}
                      {announcement.link_url && (
                        <span className="flex items-center gap-1">
                          <LinkIcon className="h-4 w-4" />
                          {announcement.link_text || 'Link'}
                        </span>
                      )}
                      <span>Hedef: {getTargetName(announcement.target_type)}</span>
                      <span>Oncelik: {announcement.priority}</span>
                    </div>

                    {(announcement.start_at || announcement.end_at) && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <ClockIcon className="h-4 w-4" />
                        {announcement.start_at && `Baslangic: ${formatDate(announcement.start_at)}`}
                        {announcement.start_at && announcement.end_at && ' - '}
                        {announcement.end_at && `Bitis: ${formatDate(announcement.end_at)}`}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 ml-2">
                    <button
                      onClick={() => handleToggle(announcement.id)}
                      className={`p-2 rounded hover:bg-gray-100 ${
                        announcement.is_active ? 'text-green-600' : 'text-gray-400'
                      }`}
                      title={announcement.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                    >
                      {announcement.is_active ? (
                        <EyeIcon className="h-5 w-5" />
                      ) : (
                        <EyeSlashIcon className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AnnouncementModal
          announcement={editingAnnouncement}
          onClose={() => {
            setShowModal(false)
            setEditingAnnouncement(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] })
            queryClient.invalidateQueries({ queryKey: ['announcements-stats'] })
            setShowModal(false)
            setEditingAnnouncement(null)
          }}
        />
      )}
    </div>
  )
}

function AnnouncementModal({
  announcement,
  onClose,
  onSuccess,
}: {
  announcement: Announcement | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: announcement?.title || '',
    content: announcement?.content || '',
    image_url: announcement?.image_url || '',
    link_url: announcement?.link_url || '',
    link_text: announcement?.link_text || '',
    type: announcement?.type || 'info',
    priority: announcement?.priority || 0,
    is_dismissable: announcement?.is_dismissable ?? true,
    start_at: announcement?.start_at ? announcement.start_at.slice(0, 16) : '',
    end_at: announcement?.end_at ? announcement.end_at.slice(0, 16) : '',
    target_type: announcement?.target_type || 'all',
    target_data: announcement?.target_data || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Baslik ve icerik zorunlu')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...formData,
        image_url: formData.image_url || undefined,
        link_url: formData.link_url || undefined,
        link_text: formData.link_text || undefined,
        start_at: formData.start_at ? new Date(formData.start_at).toISOString() : undefined,
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : undefined,
        target_data: formData.target_data || undefined,
      }

      if (announcement) {
        await announcementsApi.update(announcement.id, payload)
        toast.success('Duyuru guncellendi')
      } else {
        await announcementsApi.create(payload)
        toast.success('Duyuru olusturuldu')
      }
      onSuccess()
    } catch {
      toast.error('Islem basarisiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-2xl w-full sm:mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b flex items-center gap-3">
          <MegaphoneIcon className="h-6 w-6 text-primary-600" />
          <h2 className="text-lg sm:text-xl font-semibold">
            {announcement ? 'Duyuruyu Duzenle' : 'Yeni Duyuru'}
          </h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Baslik *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Duyuru basligi"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icerik *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Duyuru icerigi..."
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tip
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {announcementTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Oncelik (yuksek = once)
              </label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Image & Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resim URL
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link URL
              </label>
              <input
                type="url"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="https://..."
              />
            </div>
          </div>

          {formData.link_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link Metni
              </label>
              <input
                type="text"
                value={formData.link_text}
                onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Detaylar icin tiklayin"
              />
            </div>
          )}

          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hedef Kitle
            </label>
            <select
              value={formData.target_type}
              onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {targetTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {formData.target_type !== 'all' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hedef Verisi (JSON: ["Istanbul","Ankara"] veya UUID listesi)
              </label>
              <input
                type="text"
                value={formData.target_data}
                onChange={(e) => setFormData({ ...formData, target_data: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder='["Istanbul","Ankara"]'
              />
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Baslangic Tarihi
              </label>
              <input
                type="datetime-local"
                value={formData.start_at}
                onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitis Tarihi
              </label>
              <input
                type="datetime-local"
                value={formData.end_at}
                onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Dismissable */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_dismissable"
              checked={formData.is_dismissable}
              onChange={(e) => setFormData({ ...formData, is_dismissable: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="is_dismissable" className="text-sm text-gray-700">
              Kullanici kapatabilir
            </label>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 w-full sm:w-auto"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <MegaphoneIcon className="h-5 w-5" />
            )}
            {announcement ? 'Guncelle' : 'Olustur'}
          </button>
        </div>
      </div>
    </div>
  )
}
