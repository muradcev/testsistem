import { useState, useMemo } from 'react'
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
  MapPinIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Modal,
  EmptyState,
  LoadingSpinner,
  StatCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SearchInput,
  Select,
} from '../components/ui'
import { turkeyProvinces } from '../data/turkeyLocations'
import clsx from 'clsx'

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
  { id: 'yes_no', name: 'Evet/Hayir' },
  { id: 'multiple_choice', name: 'Coktan Secmeli' },
  { id: 'text', name: 'Metin' },
  { id: 'number', name: 'Sayi' },
  { id: 'price', name: 'Fiyat (TL)' },
  { id: 'province', name: 'Il Secimi' },
  { id: 'province_district', name: 'Il-Ilce Secimi' },
]

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  draft: { label: 'Taslak', variant: 'default' },
  pending_approval: { label: 'Onay Bekliyor', variant: 'warning' },
  approved: { label: 'Onaylandi', variant: 'info' },
  sent: { label: 'Gonderildi', variant: 'success' },
  answered: { label: 'Cevaplandi', variant: 'success' },
  expired: { label: 'Suresi Doldu', variant: 'error' },
  rejected: { label: 'Reddedildi', variant: 'error' },
}

const turkeyRegions: Record<string, string[]> = {
  'Tumu': [],
  'Marmara': ['Istanbul', 'Kocaeli', 'Bursa', 'Balikesir', 'Canakkale', 'Edirne', 'Kirklareli', 'Tekirdag', 'Sakarya', 'Yalova', 'Bilecik'],
  'Ege': ['Izmir', 'Aydin', 'Denizli', 'Mugla', 'Manisa', 'Afyonkarahisar', 'Kutahya', 'Usak'],
  'Akdeniz': ['Antalya', 'Adana', 'Mersin', 'Hatay', 'Kahramanmaras', 'Osmaniye', 'Burdur', 'Isparta'],
  'Ic Anadolu': ['Ankara', 'Konya', 'Kayseri', 'Eskisehir', 'Sivas', 'Yozgat', 'Kirikkale', 'Aksaray', 'Nigde', 'Nevsehir', 'Kirsehir', 'Karaman', 'Cankiri'],
  'Karadeniz': ['Samsun', 'Trabzon', 'Ordu', 'Giresun', 'Rize', 'Artvin', 'Gumushane', 'Bayburt', 'Tokat', 'Amasya', 'Corum', 'Sinop', 'Kastamonu', 'Bartin', 'Karabuk', 'Zonguldak', 'Bolu', 'Duzce'],
  'Dogu Anadolu': ['Erzurum', 'Van', 'Malatya', 'Elazig', 'Agri', 'Kars', 'Igdir', 'Ardahan', 'Mus', 'Bitlis', 'Bingol', 'Tunceli', 'Erzincan'],
  'Guneydogu Anadolu': ['Gaziantep', 'Diyarbakir', 'Sanliurfa', 'Mardin', 'Batman', 'Siirt', 'Sirnak', 'Adiyaman', 'Kilis'],
}

export default function QuestionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedDriver, setSelectedDriver] = useState<Driver | DriverOnTrip | IdleDriver | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [selectedDriversForBulk, setSelectedDriversForBulk] = useState<string[]>([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilterDriver, setHistoryFilterDriver] = useState('all')
  const [historyFilterDate, setHistoryFilterDate] = useState('all')

  // Queries
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-questions'],
    queryFn: () => questionsApi.getPendingApproval(),
    enabled: activeTab === 'pending',
  })

  const { data: driversOnTripData } = useQuery({
    queryKey: ['drivers-on-trip'],
    queryFn: () => questionsApi.getDriversOnTrip(),
    enabled: activeTab === 'drivers',
  })

  const { data: idleDriversData } = useQuery({
    queryKey: ['idle-drivers'],
    queryFn: () => questionsApi.getIdleDrivers(),
    enabled: activeTab === 'drivers',
  })

  const { data: allDriversData } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: () => driversApi.getAll({ limit: 100 }),
    enabled: activeTab === 'bulk',
  })

  const { data: statsData } = useQuery({
    queryKey: ['question-stats'],
    queryFn: () => questionsApi.getStats(),
  })

  const { data: answeredData, isLoading: answeredLoading } = useQuery({
    queryKey: ['answered-questions'],
    queryFn: () => questionsApi.getAnswered(100, 0),
    enabled: activeTab === 'history',
  })

  const { data: scheduledData } = useQuery({
    queryKey: ['scheduled-questions'],
    queryFn: () => questionsApi.getPendingApproval(),
    enabled: activeTab === 'scheduled',
  })

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      questionsApi.approve(id, approved, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      queryClient.invalidateQueries({ queryKey: ['question-stats'] })
      toast.success('Islem basarili')
    },
    onError: () => toast.error('Islem basarisiz'),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => questionsApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      toast.success('Soru gonderildi')
    },
    onError: () => toast.error('Gonderilemedi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      queryClient.invalidateQueries({ queryKey: ['question-stats'] })
      toast.success('Soru silindi')
    },
    onError: () => toast.error('Silinemedi'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      questionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questions'] })
      toast.success('Soru guncellendi')
      setShowEditModal(false)
      setEditingQuestion(null)
    },
    onError: () => toast.error('Guncellenemedi'),
  })

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
      toast.success(`${count} sofore soru gonderildi`)
      setSelectedDriversForBulk([])
    },
    onError: () => toast.error('Toplu soru gonderilemedi'),
  })

  // Data
  const pendingQuestions = (pendingData?.data?.questions || []) as Question[]
  const answeredQuestions = (answeredData?.data?.questions || []) as AnsweredQuestion[]
  const scheduledQuestions = ((scheduledData?.data?.questions || []) as Question[]).filter(q => q.status === 'approved')
  const driversOnTrip = (driversOnTripData?.data?.drivers || []) as DriverOnTrip[]
  const idleDrivers = (idleDriversData?.data?.drivers || []) as IdleDriver[]
  const allDrivers = (allDriversData?.data?.drivers || []) as Driver[]
  const stats = statsData?.data?.stats || {}

  // Filtered history
  const filteredAnsweredQuestions = useMemo(() => {
    return answeredQuestions.filter(q => {
      if (historySearch) {
        const search = historySearch.toLowerCase()
        if (!q.question_text.toLowerCase().includes(search) &&
            !q.driver_name.toLowerCase().includes(search) &&
            !q.driver_surname.toLowerCase().includes(search) &&
            !q.answer_value.toLowerCase().includes(search)) {
          return false
        }
      }
      if (historyFilterDriver !== 'all' && q.driver_id !== historyFilterDriver) return false
      if (historyFilterDate !== 'all') {
        const answerDate = new Date(q.answered_at)
        const now = new Date()
        if (historyFilterDate === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          if (answerDate < today) return false
        } else if (historyFilterDate === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (answerDate < weekAgo) return false
        } else if (historyFilterDate === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (answerDate < monthAgo) return false
        }
      }
      return true
    })
  }, [answeredQuestions, historySearch, historyFilterDriver, historyFilterDate])

  const uniqueDriversInHistory = useMemo(() => {
    return Array.from(
      new Map(answeredQuestions.map(q => [q.driver_id, { id: q.driver_id, name: q.driver_name, surname: q.driver_surname }])).values()
    )
  }, [answeredQuestions])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Akilli Soru Sistemi"
        subtitle="Soforlere soru gonderin ve cevaplari yonetin"
        icon={QuestionMarkCircleIcon}
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <PlusIcon className="h-5 w-5" />
            Yeni Soru
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Onay Bekleyen"
          value={stats.pending_approval || 0}
          icon={ClockIcon}
          color="yellow"
        />
        <StatCard
          title="Cevap Orani"
          value={`%${stats.answer_rate?.toFixed(1) || 0}`}
          icon={ChartBarIcon}
          color="green"
        />
        <StatCard
          title="Seferde"
          value={driversOnTrip.length}
          icon={TruckIcon}
          color="orange"
        />
        <StatCard
          title="Beklemede"
          value={idleDrivers.length}
          icon={UserIcon}
          color="blue"
        />
      </div>

      {/* Main Content */}
      <Card>
        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="border-b">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="pending" className="gap-2">
                <ClockIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Onay Bekleyenler</span>
                <span className="sm:hidden">Onay</span>
                <Badge variant="warning" size="sm">{pendingQuestions.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Soru Gecmisi</span>
                <span className="sm:hidden">Gecmis</span>
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <UsersIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Toplu Gonder</span>
                <span className="sm:hidden">Toplu</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-2">
                <ClockIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Zamanlanmis</span>
                <span className="sm:hidden">Zamanlı</span>
                <Badge variant="info" size="sm">{scheduledQuestions.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="gap-2">
                <TruckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Sofor Durumlari</span>
                <span className="sm:hidden">Soforler</span>
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="p-6">
            {/* Pending Tab */}
            <TabsContent value="pending">
              {pendingLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : pendingQuestions.length === 0 ? (
                <EmptyState
                  icon={CheckCircleIcon}
                  title="Onay bekleyen soru yok"
                  description="Tum sorular islenilmis durumda"
                />
              ) : (
                <div className="space-y-4">
                  {pendingQuestions.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      onApprove={() => approveMutation.mutate({ id: question.id, approved: true })}
                      onReject={() => {
                        const reason = prompt('Red sebebi:')
                        if (reason) approveMutation.mutate({ id: question.id, approved: false, reason })
                      }}
                      onSend={() => sendMutation.mutate(question.id)}
                      onEdit={() => {
                        setEditingQuestion(question)
                        setShowEditModal(true)
                      }}
                      onDelete={() => {
                        if (confirm('Bu soruyu silmek istediginize emin misiniz?')) {
                          deleteMutation.mutate(question.id)
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <CheckCircleIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-700">{answeredQuestions.length}</p>
                        <p className="text-xs text-green-600">Toplam Cevap</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <UsersIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-700">{uniqueDriversInHistory.length}</p>
                        <p className="text-xs text-blue-600">Cevaplayan Sofor</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <ClockIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-700">
                          {answeredQuestions.filter(q => {
                            const d = new Date(q.answered_at)
                            const today = new Date()
                            return d.toDateString() === today.toDateString()
                          }).length}
                        </p>
                        <p className="text-xs text-purple-600">Bugunki Cevap</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                        <ChartBarIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-700">
                          {answeredQuestions.length > 0 ?
                            Math.round((answeredQuestions.filter(q => q.answer_value === 'true').length / answeredQuestions.filter(q => q.question_type === 'yes_no').length) * 100) || 0
                            : 0}%
                        </p>
                        <p className="text-xs text-orange-600">Evet Orani</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <SearchInput
                        value={historySearch}
                        onChange={setHistorySearch}
                        placeholder="Soru, cevap veya sofor ara..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Select
                        value={historyFilterDriver}
                        onChange={setHistoryFilterDriver}
                        options={[
                          { value: 'all', label: 'Tum Soforler' },
                          ...uniqueDriversInHistory.map(d => ({
                            value: d.id,
                            label: `${d.name} ${d.surname}`
                          }))
                        ]}
                        className="w-48"
                      />
                      <Select
                        value={historyFilterDate}
                        onChange={setHistoryFilterDate}
                        options={[
                          { value: 'all', label: 'Tum Zamanlar' },
                          { value: 'today', label: 'Bugun' },
                          { value: 'week', label: 'Son 7 Gun' },
                          { value: 'month', label: 'Son 30 Gun' },
                        ]}
                        className="w-40"
                      />
                      {(historySearch || historyFilterDriver !== 'all' || historyFilterDate !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setHistorySearch('')
                            setHistoryFilterDriver('all')
                            setHistoryFilterDate('all')
                          }}
                        >
                          Temizle
                        </Button>
                      )}
                    </div>
                  </div>
                  {filteredAnsweredQuestions.length !== answeredQuestions.length && (
                    <p className="text-sm text-gray-500 mt-3">
                      {filteredAnsweredQuestions.length} / {answeredQuestions.length} sonuc gosteriliyor
                    </p>
                  )}
                </div>

                {answeredLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : filteredAnsweredQuestions.length === 0 ? (
                  <EmptyState
                    icon={ChatBubbleLeftRightIcon}
                    title="Cevaplanan soru bulunamadi"
                    description={historySearch || historyFilterDriver !== 'all' || historyFilterDate !== 'all'
                      ? "Filtreleri degistirmeyi deneyin"
                      : "Henuz cevaplanan soru yok"}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredAnsweredQuestions.map((q) => (
                      <AnsweredQuestionCard key={q.answer_id} question={q} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Bulk Tab */}
            <TabsContent value="bulk">
              <BulkQuestionSender
                allDrivers={allDrivers}
                selectedDrivers={selectedDriversForBulk}
                setSelectedDrivers={setSelectedDriversForBulk}
                onSend={bulkCreateMutation.mutate}
                isLoading={bulkCreateMutation.isPending}
                turkeyRegions={turkeyRegions}
              />
            </TabsContent>

            {/* Scheduled Tab */}
            <TabsContent value="scheduled">
              {scheduledQuestions.length === 0 ? (
                <EmptyState
                  icon={ClockIcon}
                  title="Zamanlanmis soru yok"
                  description="Onaylanan sorular burada gorunecek"
                />
              ) : (
                <div className="space-y-4">
                  {scheduledQuestions.map((q) => (
                    <Card key={q.id} className="border-blue-200 bg-blue-50/50">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="info">Gonderilecek</Badge>
                              <Badge variant="default" size="sm">
                                {questionTypes.find(t => t.id === q.question_type)?.name || q.question_type}
                              </Badge>
                            </div>
                            <p className="font-medium text-gray-900 mb-2">{q.question_text}</p>
                            <p className="text-sm text-gray-500">
                              {q.driver_name} {q.driver_surname}
                              {q.driver_province && ` | ${q.driver_province}`}
                            </p>
                          </div>
                          <Button
                            onClick={() => sendMutation.mutate(q.id)}
                            disabled={sendMutation.isPending}
                            className="gap-2"
                          >
                            <PaperAirplaneIcon className="h-4 w-4" />
                            Simdi Gonder
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Drivers Tab */}
            <TabsContent value="drivers">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* On Trip */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <TruckIcon className="h-5 w-5" />
                      Seferde Olan Soforler ({driversOnTrip.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto">
                    {driversOnTrip.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">Seferde sofor yok</p>
                    ) : (
                      <div className="space-y-2">
                        {driversOnTrip.map((driver) => (
                          <div
                            key={driver.driver_id}
                            className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{driver.name} {driver.surname}</p>
                              <p className="text-xs text-gray-500">
                                Sefer: {Math.round(driver.trip_duration_minutes)} dk
                                {driver.current_speed && ` | ${driver.current_speed.toFixed(0)} km/s`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDriver(driver)
                                setShowCreateModal(true)
                              }}
                            >
                              Soru Sor
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Idle */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                      <ClockIcon className="h-5 w-5" />
                      Beklemede Olan Soforler ({idleDrivers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-y-auto">
                    {idleDrivers.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">Beklemede sofor yok</p>
                    ) : (
                      <div className="space-y-2">
                        {idleDrivers.map((driver) => (
                          <div
                            key={driver.driver_id}
                            className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{driver.name} {driver.surname}</p>
                              <p className="text-xs text-gray-500">
                                {driver.idle_hours ? `${driver.idle_hours.toFixed(1)} saat` : '-'}
                                {driver.home_province && ` | ${driver.home_province}`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDriver(driver)
                                setShowCreateModal(true)
                              }}
                            >
                              Soru Sor
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

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

// Question Card Component
function QuestionCard({
  question,
  onApprove,
  onReject,
  onSend,
  onEdit,
  onDelete,
}: {
  question: Question
  onApprove: () => void
  onReject: () => void
  onSend: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant={statusConfig[question.status]?.variant || 'default'} dot>
                {statusConfig[question.status]?.label || question.status}
              </Badge>
              <Badge variant="default" size="sm">
                {question.source_type === 'ai_generated' ? 'AI' :
                 question.source_type === 'rule_based' ? 'Kural' : 'Manuel'}
              </Badge>
              <Badge variant="default" size="sm">
                {questionTypes.find(t => t.id === question.question_type)?.name || question.question_type}
              </Badge>
              {question.ai_confidence && (
                <Badge variant="info" size="sm">
                  %{(question.ai_confidence * 100).toFixed(0)} guven
                </Badge>
              )}
            </div>

            <p className="font-medium text-gray-900 text-lg mb-2">{question.question_text}</p>

            {question.options && question.options.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {question.options.map((opt, idx) => (
                  <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {opt}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <UserIcon className="h-4 w-4" />
                {question.driver_name} {question.driver_surname}
              </span>
              {question.driver_province && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4" />
                  {question.driver_province}
                </span>
              )}
            </div>

            {question.ai_reasoning && (
              <p className="text-xs text-gray-400 mt-2 italic bg-gray-50 p-2 rounded">
                {question.ai_reasoning}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-2">
              {new Date(question.created_at).toLocaleString('tr-TR')}
            </p>
          </div>

          <div className="flex lg:flex-col gap-2">
            {['draft', 'pending_approval', 'approved'].includes(question.status) && (
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1">
                <PencilIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Duzenle</span>
              </Button>
            )}
            {question.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={onDelete} className="gap-1 text-red-600 hover:bg-red-50">
                <TrashIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Sil</span>
              </Button>
            )}
            {question.status === 'pending_approval' && (
              <>
                <Button size="sm" onClick={onApprove} className="gap-1 bg-green-600 hover:bg-green-700">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Onayla</span>
                </Button>
                <Button size="sm" variant="outline" onClick={onReject} className="gap-1 text-red-600 hover:bg-red-50">
                  <XCircleIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Reddet</span>
                </Button>
              </>
            )}
            {question.status === 'approved' && (
              <Button size="sm" onClick={onSend} className="gap-1">
                <PaperAirplaneIcon className="h-4 w-4" />
                <span className="hidden lg:inline">Gonder</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Answered Question Card - Enhanced
function AnsweredQuestionCard({ question }: { question: AnsweredQuestion }) {
  const isYesNo = question.question_type === 'yes_no'
  const isYes = question.answer_value === 'true'
  const isNo = question.answer_value === 'false'
  const isProvince = question.question_type === 'province' || question.question_type === 'province_district'

  // Calculate time ago
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} dk once`
    if (diffHours < 24) return `${diffHours} saat once`
    if (diffDays < 7) return `${diffDays} gun once`
    return date.toLocaleDateString('tr-TR')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all overflow-hidden">
      <div className="flex">
        {/* Left color bar based on answer */}
        <div className={clsx(
          'w-1.5 flex-shrink-0',
          isYesNo && isYes && 'bg-green-500',
          isYesNo && isNo && 'bg-red-500',
          !isYesNo && 'bg-blue-500'
        )} />

        <div className="flex-1 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {question.driver_name} {question.driver_surname}
                  </p>
                  <p className="text-xs text-gray-500">{question.driver_phone}</p>
                </div>
              </div>
              {question.driver_province && (
                <Badge variant="default" size="sm" className="bg-gray-100">
                  <MapPinIcon className="h-3 w-3 mr-1" />
                  {question.driver_province}
                </Badge>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">{getTimeAgo(question.answered_at)}</p>
              <p className="text-xs text-gray-400">{new Date(question.answered_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Question */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700">{question.question_text}</p>
            </div>
          </div>

          {/* Answer */}
          <div className={clsx(
            'rounded-lg p-3 flex items-center gap-3',
            isYesNo && isYes && 'bg-green-50 border border-green-200',
            isYesNo && isNo && 'bg-red-50 border border-red-200',
            isProvince && 'bg-blue-50 border border-blue-200',
            !isYesNo && !isProvince && 'bg-gray-50 border border-gray-200'
          )}>
            {isYesNo ? (
              <>
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isYes ? 'bg-green-500' : 'bg-red-500'
                )}>
                  {isYes ? (
                    <CheckCircleIcon className="h-6 w-6 text-white" />
                  ) : (
                    <XCircleIcon className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Cevap</p>
                  <p className={clsx(
                    'text-lg font-bold',
                    isYes ? 'text-green-700' : 'text-red-700'
                  )}>
                    {isYes ? 'EVET' : 'HAYIR'}
                  </p>
                </div>
              </>
            ) : isProvince ? (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Cevap (Il)</p>
                  <p className="text-lg font-bold text-blue-700">{question.answer_value}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Cevap</p>
                  <p className="font-semibold text-gray-800 break-words">{question.answer_value}</p>
                </div>
              </>
            )}
          </div>

          {/* Footer badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="default" size="sm" className="bg-gray-100 text-gray-600">
              {questionTypes.find(t => t.id === question.question_type)?.name || question.question_type}
            </Badge>
            <Badge variant="default" size="sm" className="bg-gray-100 text-gray-600">
              {question.source_type === 'manual_bulk' ? 'Toplu Soru' : question.source_type === 'manual' ? 'Manuel' : 'Otomatik'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

// Create Question Modal
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
  const followUps: FollowUpQuestion[] = [] // Follow-up feature placeholder
  const [sendImmediately, setSendImmediately] = useState(true)
  const [loading, setLoading] = useState(false)

  const presetQuestions = [
    { text: 'Su an yukunuz var mi?', type: 'yes_no' },
    { text: 'Musait misiniz?', type: 'yes_no' },
    { text: 'Son seferiniz icin ne kadar ucret aldiniz?', type: 'price' },
    { text: 'Yol durumu nasil?', type: 'multiple_choice', options: ['Acik', 'Yogun', 'Cok Yogun', 'Kapali'] },
    { text: 'Yukunuz hangi ile gidecek?', type: 'province' },
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
      toast.error('Sofor ve soru metni gerekli')
      return
    }

    let questionOptions: string[] | undefined = undefined
    if (questionType === 'multiple_choice') {
      questionOptions = options.filter(o => o)
    } else if (questionType === 'province' || questionType === 'province_district') {
      questionOptions = turkeyProvinces
    }

    setLoading(true)
    try {
      await questionsApi.create({
        driver_id: driverId,
        question_text: questionText,
        question_type: questionType,
        options: questionOptions,
        follow_up_questions: followUps.length > 0 ? followUps : undefined,
        send_immediately: sendImmediately,
        priority: 50,
      })
      toast.success('Soru olusturuldu')
      onSuccess()
    } catch {
      toast.error('Soru olusturulamadi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Yeni Soru Olustur" size="lg">
      <div className="space-y-6">
        {driver && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-900">{getDriverName()}</p>
            <p className="text-sm text-gray-500">Bu sofore soru gonderilecek</p>
          </div>
        )}

        {/* Preset Questions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hazir Sorular</label>
          <div className="flex flex-wrap gap-2">
            {presetQuestions.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuestionText(preset.text)
                  setQuestionType(preset.type)
                  if (preset.options) setOptions(preset.options)
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                {preset.text}
              </button>
            ))}
          </div>
        </div>

        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni *</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Sorunuzu yazin..."
          />
        </div>

        {/* Question Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {questionTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        {/* Options for multiple choice */}
        {questionType === 'multiple_choice' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secenekler</label>
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
                    placeholder={`Secenek ${idx + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                    >
                      Sil
                    </Button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOptions([...options, ''])}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Secenek Ekle
              </button>
            </div>
          </div>
        )}

        {/* Province info */}
        {questionType === 'province' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPinIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Il Secimi</p>
                <p className="text-xs text-blue-600 mt-1">Sofor, 81 ilden birini secebilecek</p>
              </div>
            </div>
          </div>
        )}

        {/* Send Immediately */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="sendImmediately"
            checked={sendImmediately}
            onChange={(e) => setSendImmediately(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="sendImmediately" className="text-sm text-gray-700">
            Hemen gonder (onay bekleme)
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Iptal</Button>
        <Button onClick={handleSubmit} disabled={loading || !questionText || !getDriverId()}>
          {loading ? <LoadingSpinner size="sm" /> : sendImmediately ? 'Gonder' : 'Olustur'}
        </Button>
      </div>
    </Modal>
  )
}

// Edit Question Modal
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
    <Modal isOpen onClose={onClose} title="Soru Duzenle">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Secenekler</label>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder={`Secenek ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Oncelik (1-100)</label>
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
          <p><strong>Sofor:</strong> {question.driver_name} {question.driver_surname}</p>
          <p><strong>Olusturulma:</strong> {new Date(question.created_at).toLocaleString('tr-TR')}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Iptal</Button>
        <Button onClick={handleSubmit} disabled={isLoading || !questionText}>
          {isLoading ? <LoadingSpinner size="sm" /> : 'Kaydet'}
        </Button>
      </div>
    </Modal>
  )
}

// Bulk Question Sender
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
  const [filterRegion, setFilterRegion] = useState('Tumu')
  const [sendImmediately, setSendImmediately] = useState(true)
  const [driverSearch, setDriverSearch] = useState('')

  const filteredDrivers = useMemo(() => {
    return allDrivers.filter(driver => {
      if (driverSearch) {
        const search = driverSearch.toLowerCase()
        if (!driver.name.toLowerCase().includes(search) &&
            !driver.surname.toLowerCase().includes(search) &&
            !driver.phone.includes(search)) {
          return false
        }
      }
      if (filterRegion !== 'Tumu') {
        const regionProvinces = turkeyRegions[filterRegion] || []
        if (!driver.province || !regionProvinces.includes(driver.province)) return false
      }
      return true
    })
  }, [allDrivers, driverSearch, filterRegion, turkeyRegions])

  const toggleDriver = (id: string) => {
    if (selectedDrivers.includes(id)) {
      setSelectedDrivers(selectedDrivers.filter(d => d !== id))
    } else {
      setSelectedDrivers([...selectedDrivers, id])
    }
  }

  const selectAll = () => setSelectedDrivers(filteredDrivers.map(d => d.id))
  const deselectAll = () => setSelectedDrivers([])

  const handleSubmit = () => {
    if (selectedDrivers.length === 0 || !questionText) return

    let questionOptions: string[] | undefined = undefined
    if (questionType === 'multiple_choice') {
      questionOptions = options.filter(o => o)
    } else if (questionType === 'province' || questionType === 'province_district') {
      questionOptions = turkeyProvinces
    }

    onSend({
      driver_ids: selectedDrivers,
      question_text: questionText,
      question_type: questionType,
      options: questionOptions,
      send_immediately: sendImmediately,
    })
    setQuestionText('')
  }

  const presetQuestions = [
    { text: 'Su an musait misiniz?', type: 'yes_no' },
    { text: 'Yukunuz var mi?', type: 'yes_no' },
    { text: 'Yukunuz hangi ile gidecek?', type: 'province' },
    { text: 'Yol durumu nasil?', type: 'multiple_choice', options: ['Acik', 'Yogun', 'Cok Yogun', 'Kapali'] },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Driver Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sofor Sec</span>
            <Badge variant="info">{selectedDrivers.length} secili</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <SearchInput
                value={driverSearch}
                onChange={setDriverSearch}
                placeholder="Sofor ara..."
                className="flex-1"
              />
              <Select
                value={filterRegion}
                onChange={setFilterRegion}
                options={Object.keys(turkeyRegions).map(r => ({ value: r, label: r }))}
                className="w-36"
              />
            </div>

            <div className="flex gap-2 text-sm">
              <button onClick={selectAll} className="text-primary-600 hover:text-primary-700">
                Tumunu Sec ({filteredDrivers.length})
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAll} className="text-gray-600 hover:text-gray-700">
                Secimi Temizle
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredDrivers.map((driver) => (
                <label
                  key={driver.id}
                  className={clsx(
                    'flex items-center gap-3 p-2 rounded cursor-pointer transition-colors',
                    selectedDrivers.includes(driver.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedDrivers.includes(driver.id)}
                    onChange={() => toggleDriver(driver.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {driver.name} {driver.surname}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {driver.phone} {driver.province && `| ${driver.province}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Form */}
      <Card>
        <CardHeader>
          <CardTitle>Soru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Presets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hazir Sorular</label>
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
                    {preset.text}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni *</label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Sorunuzu yazin..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
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
                    placeholder={`Secenek ${idx + 1}`}
                  />
                ))}
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
                Hemen gonder
              </label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading || selectedDrivers.length === 0 || !questionText}
              className="w-full"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : `${selectedDrivers.length} Sofore Gonder`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
