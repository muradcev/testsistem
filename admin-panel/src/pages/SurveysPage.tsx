import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { surveysApi } from '../services/api'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Survey {
  id: string
  title: string
  description: string
  type: 'yes_no' | 'multiple_choice' | 'scale' | 'price' | 'text'
  options: string[]
  is_active: boolean
  trigger_type: 'manual' | 'location' | 'time' | 'trip_end'
  trigger_config: Record<string, any>
  created_at: string
  response_count: number
}

interface SurveyResponse {
  id: string
  driver_id: string
  driver_name: string
  answer: string
  created_at: string
}

const typeLabels: Record<string, string> = {
  yes_no: 'Evet/Hayır',
  multiple_choice: 'Çoktan Seçmeli',
  scale: 'Ölçek (1-10)',
  price: 'Fiyat',
  text: 'Metin',
}

const triggerLabels: Record<string, string> = {
  manual: 'Manuel',
  location: 'Konum Bazlı',
  time: 'Zamanlı',
  trip_end: 'Sefer Bitişi',
}

export default function SurveysPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showResponsesModal, setShowResponsesModal] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'yes_no' as Survey['type'],
    options: [''],
    is_active: true,
    trigger_type: 'manual' as Survey['trigger_type'],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: () => surveysApi.getAll(),
  })

  const { data: responsesData } = useQuery({
    queryKey: ['survey-responses', selectedSurvey?.id],
    queryFn: () => surveysApi.getResponses(selectedSurvey!.id),
    enabled: !!selectedSurvey && showResponsesModal,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => surveysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      toast.success('Anket oluşturuldu')
      closeModal()
    },
    onError: () => toast.error('Anket oluşturulamadı'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      surveysApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      toast.success('Anket güncellendi')
      closeModal()
    },
    onError: () => toast.error('Anket güncellenemedi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => surveysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      toast.success('Anket silindi')
    },
    onError: () => toast.error('Anket silinemedi'),
  })

  const surveys: Survey[] = data?.data?.surveys || []
  const responses: SurveyResponse[] = responsesData?.data?.responses || []

  const closeModal = () => {
    setShowModal(false)
    setSelectedSurvey(null)
    setFormData({
      title: '',
      description: '',
      type: 'yes_no',
      options: [''],
      is_active: true,
      trigger_type: 'manual',
    })
  }

  const openEditModal = (survey: Survey) => {
    setSelectedSurvey(survey)
    setFormData({
      title: survey.title,
      description: survey.description,
      type: survey.type,
      options: survey.options.length > 0 ? survey.options : [''],
      is_active: survey.is_active,
      trigger_type: survey.trigger_type,
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submitData = {
      ...formData,
      options: formData.type === 'multiple_choice'
        ? formData.options.filter((o) => o.trim() !== '')
        : [],
    }

    if (selectedSurvey) {
      updateMutation.mutate({ id: selectedSurvey.id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Bu anketi silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const addOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }))
  }

  const removeOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }))
  }

  const updateOption = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }))
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
        <h1 className="text-2xl font-bold text-gray-900">Anketler</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="h-5 w-5" />
          Yeni Anket
        </button>
      </div>

      {/* Surveys list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Anket
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tip
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tetikleyici
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Yanıt
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {surveys.map((survey) => (
              <tr key={survey.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{survey.title}</p>
                    <p className="text-sm text-gray-500">{survey.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {typeLabels[survey.type]}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {triggerLabels[survey.trigger_type]}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      survey.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {survey.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {survey.response_count || 0}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedSurvey(survey)
                        setShowResponsesModal(true)
                      }}
                      className="p-1 text-gray-500 hover:text-primary-600"
                      title="Yanıtları Gör"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openEditModal(survey)}
                      className="p-1 text-gray-500 hover:text-primary-600"
                      title="Düzenle"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="Sil"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {surveys.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Henüz anket oluşturulmamış
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={closeModal}
            ></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {selectedSurvey ? 'Anketi Düzenle' : 'Yeni Anket'}
                </h2>
                <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Başlık
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Soru Tipi
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        type: e.target.value as Survey['type'],
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="yes_no">Evet/Hayır</option>
                    <option value="multiple_choice">Çoktan Seçmeli</option>
                    <option value="scale">Ölçek (1-10)</option>
                    <option value="price">Fiyat</option>
                    <option value="text">Metin</option>
                  </select>
                </div>

                {formData.type === 'multiple_choice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seçenekler
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                            placeholder={`Seçenek ${index + 1}`}
                          />
                          {formData.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addOption}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Seçenek Ekle
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tetikleyici
                  </label>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        trigger_type: e.target.value as Survey['trigger_type'],
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="manual">Manuel</option>
                    <option value="location">Konum Bazlı</option>
                    <option value="time">Zamanlı</option>
                    <option value="trip_end">Sefer Bitişi</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Aktif
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Kaydediliyor...'
                      : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Responses Modal */}
      {showResponsesModal && selectedSurvey && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => {
                setShowResponsesModal(false)
                setSelectedSurvey(null)
              }}
            ></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {selectedSurvey.title} - Yanıtlar
                </h2>
                <button
                  onClick={() => {
                    setShowResponsesModal(false)
                    setSelectedSurvey(null)
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {responses.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Şoför
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Yanıt
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Tarih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {responses.map((response) => (
                      <tr key={response.id}>
                        <td className="px-4 py-2 text-sm">
                          {response.driver_name}
                        </td>
                        <td className="px-4 py-2 text-sm">{response.answer}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(response.created_at).toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Henüz yanıt yok
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
