import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationTemplatesApi, triggerTypesApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  BellIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

interface NotificationTemplate {
  id: string
  name: string
  title: string
  body: string
  category: string
  trigger_type?: string
  target_audience: string
  target_provinces?: string[]
  scheduled_at?: string
  repeat_type?: string
  is_active: boolean
  sent_count: number
  read_count: number
  created_at: string
}

interface TriggerType {
  id: string
  name: string
  description?: string
}

const categories = [
  { id: 'announcement', name: 'Duyuru', color: 'bg-blue-100 text-blue-800' },
  { id: 'alert', name: 'Uyarı', color: 'bg-red-100 text-red-800' },
  { id: 'reminder', name: 'Hatırlatma', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'promotion', name: 'Promosyon', color: 'bg-green-100 text-green-800' },
  { id: 'system', name: 'Sistem', color: 'bg-gray-100 text-gray-800' },
]

const audiences = [
  { id: 'all', name: 'Tüm Şoförler' },
  { id: 'active', name: 'Aktif Şoförler' },
  { id: 'inactive', name: 'Pasif Şoförler' },
  { id: 'on_trip', name: 'Seferde Olanlar' },
  { id: 'at_home', name: 'Evde Olanlar' },
  { id: 'new', name: 'Yeni Kayıtlar' },
]

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationTemplatesApi.getAll(),
  })

  const { data: triggerTypesData } = useQuery({
    queryKey: ['trigger-types'],
    queryFn: () => triggerTypesApi.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] })
      toast.success('Şablon silindi')
    },
    onError: () => toast.error('Silinemedi'),
  })

  const templates = (data?.data?.templates || []) as NotificationTemplate[]
  const triggerTypes = (triggerTypesData?.data?.trigger_types || []) as TriggerType[]

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || categories[0]
  }

  const getAudienceName = (audienceId: string) => {
    return audiences.find(a => a.id === audienceId)?.name || audienceId
  }

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template)
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Bu şablonu silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bildirim Şablonları</h1>
        <button
          onClick={() => {
            setEditingTemplate(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="h-5 w-5" />
          Yeni Şablon
        </button>
      </div>

      {/* Template List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500">
            Henüz şablon oluşturulmamış
          </div>
        ) : (
          templates.map((template) => {
            const categoryInfo = getCategoryInfo(template.category)
            return (
              <div
                key={template.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                  template.is_active ? 'border-green-500' : 'border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <BellIcon className="h-5 w-5 text-gray-400" />
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs ${categoryInfo.color}`}>
                        {categoryInfo.name}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">{template.title}</p>
                    <p className="text-sm text-gray-500 mb-2">{template.body}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      <span>Hedef: {getAudienceName(template.target_audience)}</span>
                      <span>|</span>
                      <span>Gönderim: {template.sent_count}</span>
                      <span>|</span>
                      <span>Okunma: {template.read_count}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
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
        <TemplateModal
          template={editingTemplate}
          triggerTypes={triggerTypes}
          onClose={() => {
            setShowModal(false)
            setEditingTemplate(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['notification-templates'] })
            setShowModal(false)
            setEditingTemplate(null)
          }}
        />
      )}
    </div>
  )
}

function TemplateModal({
  template,
  triggerTypes,
  onClose,
  onSuccess,
}: {
  template: NotificationTemplate | null
  triggerTypes: TriggerType[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    title: template?.title || '',
    body: template?.body || '',
    category: template?.category || 'announcement',
    trigger_type: template?.trigger_type || 'manual',
    target_audience: template?.target_audience || 'all',
    is_active: template?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name || !formData.title || !formData.body) {
      toast.error('Tüm alanları doldurun')
      return
    }

    setLoading(true)
    try {
      if (template) {
        await notificationTemplatesApi.update(template.id, formData)
        toast.success('Şablon güncellendi')
      } else {
        await notificationTemplatesApi.create(formData)
        toast.success('Şablon oluşturuldu')
      }
      onSuccess()
    } catch {
      toast.error('İşlem başarısız')
    } finally {
      setLoading(false)
    }
  }

  const templateVariables = [
    '{{driver_name}}',
    '{{trip_count}}',
    '{{total_distance}}',
    '{{province}}',
    '{{diesel_price}}',
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            {template ? 'Şablonu Düzenle' : 'Yeni Bildirim Şablonu'}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Şablon Adı *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Örn: Haftalık Özet"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bildirim Başlığı *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Bildirimde görünecek başlık"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bildirim İçeriği *
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Bildirim içeriği..."
            />
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">Kullanılabilir değişkenler:</p>
              <div className="flex flex-wrap gap-1">
                {templateVariables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({ ...formData, body: formData.body + v })}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Trigger Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tetikleyici
              </label>
              <select
                value={formData.trigger_type}
                onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="manual">Manuel</option>
                <option value="scheduled">Zamanlı</option>
                <option value="event">Olay Bazlı</option>
                {triggerTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hedef Kitle
            </label>
            <select
              value={formData.target_audience}
              onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {audiences.map((aud) => (
                <option key={aud.id} value={aud.id}>{aud.name}</option>
              ))}
            </select>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Aktif
            </label>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <PaperAirplaneIcon className="h-5 w-5" />
            )}
            {template ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}
