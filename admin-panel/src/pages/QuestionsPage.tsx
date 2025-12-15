import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionsApi, driversApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  UserIcon,
  TruckIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  status: string
  province?: string
}

interface DriverOnTrip {
  driver_id: string
  name: string
  surname: string
  trip_id: string
  trip_duration_minutes: number
  current_speed?: number
}

interface IdleDriver {
  driver_id: string
  name: string
  surname: string
  idle_hours?: number
  home_province?: string
}

interface Question {
  id: string
  driver_id: string
  question_text: string
  question_type: string
  options?: string[]
  follow_up_questions?: unknown[]
  source_type: string
  status: string
  context_type?: string
  priority: number
  created_at: string
  sent_at?: string
  answered_at?: string
  driver_name?: string
  driver_surname?: string
  driver_phone?: string
  driver_province?: string
  ai_confidence?: number
  ai_reasoning?: string
  answer?: {
    answer_value: string
    answer_text?: string
    created_at: string
  }
}

interface AnsweredQuestion {
  id: string
  driver_id: string
  question_text: string
  question_type: string
  options?: string[]
  source_type: string
  status: string
  context_type?: string
  priority: number
  sent_at?: string
  created_at: string
  driver_name: string
  driver_surname: string
  driver_phone: string
  driver_province: string
  answer_id: string
  answer_value: string
  answer_type: string
  follow_up_answers?: unknown[]
  answered_at: string
  answer_latitude?: number
  answer_longitude?: number
}

interface FollowUpQuestion {
  condition: { answer: string }
  question: string
  type: string
  options?: string[]
}

const questionTypes = [
  { id: 'yes_no', name: 'Evet/Hayır' },
  { id: 'multiple_choice', name: 'Çoktan Seçmeli' },
  { id: 'text', name: 'Metin' },
  { id: 'number', name: 'Sayı' },
  { id: 'price', name: 'Fiyat (TL)' },
]

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-800' },
  pending_approval: { label: 'Onay Bekliyor', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Gönderildi', color: 'bg-green-100 text-green-800' },
  answered: { label: 'Cevaplandı', color: 'bg-purple-100 text-purple-800' },
  expired: { label: 'Süresi Doldu', color: 'bg-red-100 text-red-800' },
  rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-800' },
}

// Türkiye bölgeleri
const turkeyRegions: Record<string, string[]> = {
  'Tümü': [],
  'Marmara': ['İstanbul', 'Kocaeli', 'Bursa', 'Balıkesir', 'Çanakkale', 'Edirne', 'Kırklareli', 'Tekirdağ', 'Sakarya', 'Yalova', 'Bilecik'],
  'Ege': ['İzmir', 'Aydın', 'Denizli', 'Muğla', 'Manisa', 'Afyonkarahisar', 'Kütahya', 'Uşak'],
  'Akdeniz': ['Antalya', 'Adana', 'Mersin', 'Hatay', 'Kahramanmaraş', 'Osmaniye', 'Burdur', 'Isparta'],
  'İç Anadolu': ['Ankara', 'Konya', 'Kayseri', 'Eskişehir', 'Sivas', 'Yozgat', 'Kırıkkale', 'Aksaray', 'Niğde', 'Nevşehir', 'Kırşehir', 'Karaman', 'Çankırı'],
  'Karadeniz': ['Samsun', 'Trabzon', 'Ordu', 'Giresun', 'Rize', 'Artvin', 'Gümüşhane', 'Bayburt', 'Tokat', 'Amasya', 'Çorum', 'Sinop', 'Kastamonu', 'Bartın', 'Karabük', 'Zonguldak', 'Bolu', 'Düzce'],
  'Doğu Anadolu': ['Erzurum', 'Van', 'Malatya', 'Elazığ', 'Ağrı', 'Kars', 'Iğdır', 'Ardahan', 'Muş', 'Bitlis', 'Bingöl', 'Tunceli', 'Erzincan'],
  'Güneydoğu Anadolu': ['Gaziantep', 'Diyarbakır', 'Şanlıurfa', 'Mardin', 'Batman', 'Siirt', 'Şırnak', 'Adıyaman', 'Kilis'],
}

export default function QuestionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'bulk' | 'drivers'>('pending')
  const [selectedDriver, setSelectedDriver] = useState<Driver | DriverOnTrip | IdleDriver | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [selectedDriversForBulk, setSelectedDriversForBulk] = useState<string[]>([])

  // Onay bekleyen sorular
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-questions'],
    queryFn: () => questionsApi.getPendingApproval(),
    enabled: activeTab === 'pending',
  })

  // Seferdeki şoförler
  const { data: driversOnTripData } = useQuery({
    queryKey: ['drivers-on-trip'],
    queryFn: () => questionsApi.getDriversOnTrip(),
    enabled: activeTab === 'drivers',
  })

  // Beklemedeki şoförler
  const { data: idleDriversData } = useQuery({
    queryKey: ['idle-drivers'],
    queryFn: () => questionsApi.getIdleDrivers(),
    enabled: activeTab === 'drivers',
  })

  // Tüm şoförler
  const { data: allDriversData } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: () => driversApi.getAll({ limit: 100 }),
    enabled: activeTab === 'bulk',
  })

  // İstatistikler
  const { data: statsData } = useQuery({
    queryKey: ['question-stats'],
    queryFn: () => questionsApi.getStats(),
  })

  // Cevaplanan sorular
  const { data: answeredData, isLoading: answeredLoading } = useQuery({
    queryKey: ['answered-questions'],
    queryFn: () => questionsApi.getAnswered(50, 0),
    enabled: activeTab === 'history',
  })

  // Onaylama mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      questionsApi.approve(id, approved, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      queryClient.invalidateQueries({ queryKey: ['question-stats'] })
      toast.success('İşlem başarılı')
    },
    onError: () => toast.error('İşlem başarısız'),
  })

  // Gönderme mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => questionsApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      toast.success('Soru gönderildi')
    },
    onError: () => toast.error('Gönderilemedi'),
  })

  // Silme mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      queryClient.invalidateQueries({ queryKey: ['question-stats'] })
      toast.success('Soru silindi')
    },
    onError: () => toast.error('Silinemedi - Sadece taslak durumundaki sorular silinebilir'),
  })

  // Güncelleme mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      questionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      toast.success('Soru güncellendi')
      setShowEditModal(false)
      setEditingQuestion(null)
    },
    onError: () => toast.error('Güncellenemedi'),
  })

  // Toplu soru oluşturma mutation
  const bulkCreateMutation = useMutation({
    mutationFn: (data: {
      driver_ids: string[]
      question_text: string
      question_type: string
      options?: string[]
      send_immediately?: boolean
    }) => questionsApi.createBulk(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      queryClient.invalidateQueries({ queryKey: ['question-stats'] })
      const count = response?.data?.created_count || selectedDriversForBulk.length
      toast.success(`${count} şoföre soru gönderildi`)
      setSelectedDriversForBulk([])
    },
    onError: () => toast.error('Toplu soru gönderilemedi'),
  })

  const pendingQuestions = (pendingData?.data?.questions || []) as Question[]
  const answeredQuestions = (answeredData?.data?.questions || []) as AnsweredQuestion[]
  const driversOnTrip = (driversOnTripData?.data?.drivers || []) as DriverOnTrip[]
  const idleDrivers = (idleDriversData?.data?.drivers || []) as IdleDriver[]
  const allDrivers = (allDriversData?.data?.drivers || []) as Driver[]
  const stats = statsData?.data?.stats || {}

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Akıllı Soru Sistemi</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-xs sm:text-sm self-start sm:self-auto"
        >
          <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          Yeni Soru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Onay Bekleyen</p>
              <p className="text-lg sm:text-2xl font-bold">{stats.pending_approval || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Cevap Oranı</p>
              <p className="text-lg sm:text-2xl font-bold">{stats.answer_rate?.toFixed(1) || 0}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
              <TruckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Seferde</p>
              <p className="text-lg sm:text-2xl font-bold">{driversOnTrip.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Beklemede</p>
              <p className="text-lg sm:text-2xl font-bold">{idleDrivers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClockIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Onay Bekleyenler</span>
              <span className="sm:hidden">Onay</span>
              ({pendingQuestions.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Soru Geçmişi</span>
              <span className="sm:hidden">Geçmiş</span>
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === 'bulk'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Toplu Gönder</span>
              <span className="sm:hidden">Toplu</span>
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === 'drivers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TruckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Şoför Durumları</span>
              <span className="sm:hidden">Şoförler</span>
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-6">
          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-3 sm:space-y-4">
              {pendingLoading ? (
                <div className="flex justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : pendingQuestions.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">
                  Onay bekleyen soru bulunmuyor
                </div>
              ) : (
                pendingQuestions.map((question) => (
                  <div key={question.id} className="border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${statusLabels[question.status]?.color}`}>
                            {statusLabels[question.status]?.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {question.source_type === 'ai_generated' ? '🤖 AI' :
                             question.source_type === 'rule_based' ? '📋 Kural' : '✍️ Manuel'}
                          </span>
                          <span className="text-xs bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded hidden sm:inline">
                            {questionTypes.find(t => t.id === question.question_type)?.name || question.question_type}
                          </span>
                          {question.ai_confidence && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded hidden sm:inline">
                              %{(question.ai_confidence * 100).toFixed(0)}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 text-sm sm:text-lg">{question.question_text}</p>
                        {question.options && question.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {question.options.map((opt, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs sm:text-sm text-gray-500 mt-2">
                          👤 {question.driver_name} {question.driver_surname}
                          {question.driver_province && ` | 📍 ${question.driver_province}`}
                        </p>
                        {question.ai_reasoning && (
                          <p className="text-xs text-gray-400 mt-1 italic bg-gray-50 p-2 rounded hidden sm:block">
                            💡 {question.ai_reasoning}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 sm:mt-2">
                          {new Date(question.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <div className="flex sm:flex-col gap-1 sm:ml-4">
                        {/* Düzenleme - sadece düzenlenebilir durumlar için */}
                        {['draft', 'pending_approval', 'approved'].includes(question.status) && (
                          <button
                            onClick={() => {
                              setEditingQuestion(question)
                              setShowEditModal(true)
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Düzenle"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        )}
                        {/* Silme - sadece draft için */}
                        {question.status === 'draft' && (
                          <button
                            onClick={() => {
                              if (confirm('Bu soruyu silmek istediğinize emin misiniz?')) {
                                deleteMutation.mutate(question.id)
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Sil"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                        {/* Onaylama butonları */}
                        {question.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate({ id: question.id, approved: true })}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Onayla"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Red sebebi:')
                                if (reason) {
                                  approveMutation.mutate({ id: question.id, approved: false, reason })
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Reddet"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        {/* Gönderme - onaylanmış için */}
                        {question.status === 'approved' && (
                          <button
                            onClick={() => sendMutation.mutate(question.id)}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                            title="Şimdi Gönder"
                          >
                            <PaperAirplaneIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Drivers Tab */}
          {activeTab === 'drivers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* On Trip */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TruckIcon className="h-5 w-5 text-orange-500" />
                  Seferde Olan Şoförler
                </h3>
                <div className="space-y-2">
                  {driversOnTrip.length === 0 ? (
                    <p className="text-gray-500 text-sm">Seferde şoför yok</p>
                  ) : (
                    driversOnTrip.map((driver) => (
                      <div
                        key={driver.driver_id}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{driver.name} {driver.surname}</p>
                          <p className="text-xs text-gray-500">
                            Sefer süresi: {Math.round(driver.trip_duration_minutes)} dk
                            {driver.current_speed && ` | Hız: ${driver.current_speed.toFixed(0)} km/s`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedDriver(driver)
                            setShowCreateModal(true)
                          }}
                          className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                        >
                          Soru Sor
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Idle */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-blue-500" />
                  Beklemede Olan Şoförler
                </h3>
                <div className="space-y-2">
                  {idleDrivers.length === 0 ? (
                    <p className="text-gray-500 text-sm">Beklemede şoför yok</p>
                  ) : (
                    idleDrivers.map((driver) => (
                      <div
                        key={driver.driver_id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{driver.name} {driver.surname}</p>
                          <p className="text-xs text-gray-500">
                            {driver.idle_hours ? `${driver.idle_hours.toFixed(1)} saat beklemede` : 'Konum yok'}
                            {driver.home_province && ` | ${driver.home_province}`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedDriver(driver)
                            setShowCreateModal(true)
                          }}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                        >
                          Soru Sor
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-500" />
                Cevaplanan Sorular ({answeredQuestions.length})
              </h3>

              {answeredLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : answeredQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>Henüz cevaplanan soru yok</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {answeredQuestions.map((q) => (
                    <div key={q.answer_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                              ✓ Cevaplandı
                            </span>
                            <span className="text-xs text-gray-500">
                              {q.source_type === 'manual_bulk' ? '📢 Toplu' : '✍️ Tekil'}
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {questionTypes.find(t => t.id === q.question_type)?.name || q.question_type}
                            </span>
                          </div>

                          <p className="font-medium text-gray-900 mb-2">{q.question_text}</p>

                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                            <p className="text-sm text-gray-600 mb-1">Cevap:</p>
                            <p className="font-semibold text-green-700">
                              {q.answer_value === 'true' ? '✅ Evet' :
                               q.answer_value === 'false' ? '❌ Hayır' :
                               q.answer_value}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            <span>👤 {q.driver_name} {q.driver_surname}</span>
                            {q.driver_province && <span>📍 {q.driver_province}</span>}
                            <span>📱 {q.driver_phone}</span>
                          </div>

                          <p className="text-xs text-gray-400 mt-2">
                            Cevaplandı: {new Date(q.answered_at).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bulk Send Tab */}
          {activeTab === 'bulk' && (
            <BulkQuestionSender
              allDrivers={allDrivers}
              selectedDrivers={selectedDriversForBulk}
              setSelectedDrivers={setSelectedDriversForBulk}
              onSend={bulkCreateMutation.mutate}
              isLoading={bulkCreateMutation.isPending}
              turkeyRegions={turkeyRegions}
            />
          )}
        </div>
      </div>

      {/* Create Question Modal */}
      {showCreateModal && (
        <CreateQuestionModal
          driver={selectedDriver}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedDriver(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
            setShowCreateModal(false)
            setSelectedDriver(null)
          }}
        />
      )}

      {/* Edit Question Modal */}
      {showEditModal && editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => {
            setShowEditModal(false)
            setEditingQuestion(null)
          }}
          onSave={(data) => updateMutation.mutate({ id: editingQuestion.id, data })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  )
}

// Create Question Modal Component
function CreateQuestionModal({
  driver,
  onClose,
  onSuccess,
}: {
  driver: Driver | DriverOnTrip | IdleDriver | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState('yes_no')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [followUps, setFollowUps] = useState<FollowUpQuestion[]>([])
  const [sendImmediately, setSendImmediately] = useState(true)
  const [loading, setLoading] = useState(false)

  // Preset questions for quick selection
  const presetQuestions = [
    { text: 'Şu an yükünüz var mı?', type: 'yes_no', followUps: [
      { condition: { answer: 'yes' }, question: 'Yükünüz nereye?', type: 'text' },
      { condition: { answer: 'no' }, question: 'Yük arıyor musunuz?', type: 'yes_no' },
    ]},
    { text: 'Müsait misiniz?', type: 'yes_no', followUps: [
      { condition: { answer: 'yes' }, question: 'Hangi bölgeden yük almak istersiniz?', type: 'text' },
    ]},
    { text: 'Son seferiniz için ne kadar ücret aldınız?', type: 'price', followUps: [] },
    { text: 'Yol durumu nasıl?', type: 'multiple_choice', options: ['Açık', 'Yoğun', 'Çok Yoğun', 'Kapalı'], followUps: [] },
  ]

  const getDriverId = (): string | null => {
    if (!driver) return null
    if ('id' in driver) return driver.id
    if ('driver_id' in driver) return driver.driver_id
    return null
  }

  const getDriverName = (): string => {
    if (!driver) return ''
    return `${driver.name} ${driver.surname}`
  }

  const handleSubmit = async () => {
    const driverId = getDriverId()
    if (!driverId || !questionText) {
      toast.error('Şoför ve soru metni gerekli')
      return
    }

    setLoading(true)
    try {
      await questionsApi.create({
        driver_id: driverId,
        question_text: questionText,
        question_type: questionType,
        options: questionType === 'multiple_choice' ? options.filter(o => o) : undefined,
        follow_up_questions: followUps.length > 0 ? followUps : undefined,
        send_immediately: sendImmediately,
        priority: 50,
      })
      toast.success('Soru oluşturuldu')
      onSuccess()
    } catch {
      toast.error('Soru oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  const selectPreset = (preset: typeof presetQuestions[0]) => {
    setQuestionText(preset.text)
    setQuestionType(preset.type)
    if (preset.options) {
      setOptions(preset.options)
    }
    setFollowUps(preset.followUps as FollowUpQuestion[])
  }

  const addFollowUp = () => {
    setFollowUps([...followUps, { condition: { answer: 'yes' }, question: '', type: 'text' }])
  }

  const removeFollowUp = (index: number) => {
    setFollowUps(followUps.filter((_, i) => i !== index))
  }

  const updateFollowUp = (index: number, field: string, value: string) => {
    const updated = [...followUps]
    if (field === 'condition') {
      updated[index].condition = { answer: value }
    } else if (field === 'question') {
      updated[index].question = value
    } else if (field === 'type') {
      updated[index].type = value
    }
    setFollowUps(updated)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Yeni Soru Oluştur
            {driver && <span className="text-gray-500 text-base ml-2">- {getDriverName()}</span>}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Preset Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hazır Sorular
            </label>
            <div className="flex flex-wrap gap-2">
              {presetQuestions.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => selectPreset(preset)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200"
                >
                  {preset.text.substring(0, 30)}...
                </button>
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soru Metni *
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Sorunuzu yazın..."
            />
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soru Tipi
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {questionTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Options for multiple choice */}
          {questionType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seçenekler
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options]
                        newOpts[idx] = e.target.value
                        setOptions(newOpts)
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                      placeholder={`Seçenek ${idx + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setOptions([...options, ''])}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Seçenek Ekle
                </button>
              </div>
            </div>
          )}

          {/* Follow-up Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Takip Soruları (Koşullu)
              </label>
              <button
                onClick={addFollowUp}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Takip Sorusu Ekle
              </button>
            </div>
            {followUps.length > 0 && (
              <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                {followUps.map((fu, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3 bg-white rounded border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Eğer cevap</span>
                      <select
                        value={fu.condition.answer}
                        onChange={(e) => updateFollowUp(idx, 'condition', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="yes">Evet</option>
                        <option value="no">Hayır</option>
                      </select>
                      <span className="text-sm text-gray-500">ise:</span>
                      <button
                        onClick={() => removeFollowUp(idx)}
                        className="ml-auto text-red-600 text-sm"
                      >
                        Kaldır
                      </button>
                    </div>
                    <input
                      type="text"
                      value={fu.question}
                      onChange={(e) => updateFollowUp(idx, 'question', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="Takip sorusu..."
                    />
                    <select
                      value={fu.type}
                      onChange={(e) => updateFollowUp(idx, 'type', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {questionTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send Immediately */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendImmediately"
              checked={sendImmediately}
              onChange={(e) => setSendImmediately(e.target.checked)}
              className="rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="sendImmediately" className="text-sm text-gray-700">
              Hemen gönder (onay bekleme)
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
            disabled={loading || !questionText || !getDriverId()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <PaperAirplaneIcon className="h-5 w-5" />
            )}
            {sendImmediately ? 'Gönder' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Edit Question Modal Component
function EditQuestionModal({
  question,
  onClose,
  onSave,
  isLoading,
}: {
  question: Question
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  isLoading: boolean
}) {
  const [questionText, setQuestionText] = useState(question.question_text)
  const [questionType, setQuestionType] = useState(question.question_type)
  const [options, setOptions] = useState<string[]>(question.options || ['', ''])
  const [priority, setPriority] = useState(question.priority)

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      question_text: questionText,
      question_type: questionType,
      priority,
    }
    if (questionType === 'multiple_choice') {
      data.options = options.filter(o => o)
    }
    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Soru Düzenle</h2>
          <span className={`px-2 py-1 rounded text-xs ${statusLabels[question.status]?.color}`}>
            {statusLabels[question.status]?.label}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soru Metni
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soru Tipi
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {questionTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {questionType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seçenekler
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options]
                        newOpts[idx] = e.target.value
                        setOptions(newOpts)
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                      placeholder={`Seçenek ${idx + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setOptions([...options, ''])}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Seçenek Ekle
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Öncelik (1-100)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            <p><strong>Şoför:</strong> {question.driver_name} {question.driver_surname}</p>
            <p><strong>Oluşturulma:</strong> {new Date(question.created_at).toLocaleString('tr-TR')}</p>
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
            disabled={isLoading || !questionText}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <CheckCircleIcon className="h-5 w-5" />
            )}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// Bulk Question Sender Component
function BulkQuestionSender({
  allDrivers,
  selectedDrivers,
  setSelectedDrivers,
  onSend,
  isLoading,
  turkeyRegions,
}: {
  allDrivers: Driver[]
  selectedDrivers: string[]
  setSelectedDrivers: (ids: string[]) => void
  onSend: (data: { driver_ids: string[]; question_text: string; question_type: string; options?: string[]; send_immediately?: boolean }) => void
  isLoading: boolean
  turkeyRegions: Record<string, string[]>
}) {
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState('yes_no')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [filterRegion, setFilterRegion] = useState('Tümü')
  const [sendImmediately, setSendImmediately] = useState(true)

  // Bölgeye göre filtrelenmiş şoförler
  const filteredDrivers = allDrivers.filter(driver => {
    if (filterRegion === 'Tümü') return true
    const regionProvinces = turkeyRegions[filterRegion] || []
    return driver.province && regionProvinces.includes(driver.province)
  })

  const toggleDriver = (id: string) => {
    if (selectedDrivers.includes(id)) {
      setSelectedDrivers(selectedDrivers.filter(d => d !== id))
    } else {
      setSelectedDrivers([...selectedDrivers, id])
    }
  }

  const selectAll = () => {
    setSelectedDrivers(filteredDrivers.map(d => d.id))
  }

  const deselectAll = () => {
    setSelectedDrivers([])
  }

  const handleSubmit = () => {
    if (selectedDrivers.length === 0 || !questionText) {
      return
    }
    onSend({
      driver_ids: selectedDrivers,
      question_text: questionText,
      question_type: questionType,
      options: questionType === 'multiple_choice' ? options.filter(o => o) : undefined,
      send_immediately: sendImmediately,
    })
    setQuestionText('')
  }

  // Hazır sorular
  const presetQuestions = [
    { text: 'Şu an müsait misiniz?', type: 'yes_no' },
    { text: 'Yükünüz var mı?', type: 'yes_no' },
    { text: 'Hangi bölgeden yük almak istersiniz?', type: 'text' },
    { text: 'Yol durumu nasıl?', type: 'multiple_choice', options: ['Açık', 'Yoğun', 'Çok Yoğun', 'Kapalı'] },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary-500" />
            Toplu Soru Gönder
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Birden fazla şoföre aynı anda soru gönderin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
            {selectedDrivers.length} şoför seçili
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol: Şoför Seçimi */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Şoför Seçin</h4>
            <div className="flex items-center gap-2">
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {Object.keys(turkeyRegions).map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={selectAll}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              Tümünü Seç ({filteredDrivers.length})
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={deselectAll}
              className="text-xs text-gray-600 hover:text-gray-700"
            >
              Seçimi Temizle
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredDrivers.map((driver) => (
              <label
                key={driver.id}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                  selectedDrivers.includes(driver.id) ? 'bg-primary-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDrivers.includes(driver.id)}
                  onChange={() => toggleDriver(driver.id)}
                  className="rounded border-gray-300 text-primary-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{driver.name} {driver.surname}</p>
                  <p className="text-xs text-gray-500">
                    {driver.phone} {driver.province && `| ${driver.province}`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Sağ: Soru Oluşturma */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-4">Soru</h4>

          {/* Hazır Sorular */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">Hazır Sorular</label>
            <div className="flex flex-wrap gap-2">
              {presetQuestions.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestionText(preset.text)
                    setQuestionType(preset.type)
                    if (preset.options) setOptions(preset.options)
                  }}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                >
                  {preset.text.substring(0, 25)}...
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Soru Metni *
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Sorunuzu yazın..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Soru Tipi
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {questionTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            {questionType === 'multiple_choice' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seçenekler
                </label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options]
                        newOpts[idx] = e.target.value
                        setOptions(newOpts)
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
                      placeholder={`Seçenek ${idx + 1}`}
                    />
                  ))}
                  <button
                    onClick={() => setOptions([...options, ''])}
                    className="text-xs text-primary-600"
                  >
                    + Seçenek Ekle
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bulkSendImmediately"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
                className="rounded border-gray-300 text-primary-600"
              />
              <label htmlFor="bulkSendImmediately" className="text-sm text-gray-700">
                Hemen gönder
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || selectedDrivers.length === 0 || !questionText}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
              {selectedDrivers.length} Şoföre Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
