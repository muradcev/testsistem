import axios from 'axios'

// Railway'de VITE_API_URL env var kullanılır, yoksa relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API functions
export const dashboardApi = {
  getStats: () => api.get('/admin/dashboard'),
  getAppStats: () => api.get('/admin/app-stats'),
  getWeeklyStats: () => api.get('/admin/dashboard/weekly'),
  getRecentActivities: () => api.get('/admin/dashboard/activities'),
  getSystemStatus: () => api.get('/admin/dashboard/system-status'),
  getPendingSummary: () => api.get('/admin/dashboard/pending'),
  getLocationStats: () => api.get('/admin/dashboard/location-stats'),
}

export const driversApi = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/drivers', { params }),
  getById: (id: string) => api.get(`/admin/drivers/${id}`),
  getLocations: (id: string, params?: { start_date?: string; end_date?: string }) =>
    api.get(`/admin/drivers/${id}/locations`, { params }),
  getTrips: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/admin/drivers/${id}/trips`, { params }),
  getStops: (id: string) => api.get(`/admin/drivers/${id}/stops`),
  updateStatus: (id: string, isActive: boolean) =>
    api.put(`/admin/drivers/${id}/status`, { is_active: isActive }),
  updateFeatures: (id: string, features: {
    location_tracking_enabled?: boolean;
    background_location_enabled?: boolean;
    notifications_enabled?: boolean;
    surveys_enabled?: boolean;
    questions_enabled?: boolean;
    contacts_enabled?: boolean;
    call_log_enabled?: boolean;
  }) => api.put(`/admin/drivers/${id}/features`, features),
  delete: (id: string) => api.delete(`/admin/drivers/${id}`),
}

export const locationsApi = {
  getLive: () => api.get('/admin/locations/live'),
}

export const surveysApi = {
  getAll: () => api.get('/admin/surveys'),
  create: (data: any) => api.post('/admin/surveys', data),
  update: (id: string, data: any) => api.put(`/admin/surveys/${id}`, data),
  delete: (id: string) => api.delete(`/admin/surveys/${id}`),
  getResponses: (id: string) => api.get(`/admin/surveys/${id}/responses`),
}

export const settingsApi = {
  getAll: () => api.get('/admin/settings'),
  update: (settings: Record<string, string>) =>
    api.put('/admin/settings', { settings }),
}

export const notificationsApi = {
  send: (data: { driver_id: string; title: string; body: string }) =>
    api.post('/admin/notifications/send', data),
  broadcast: (data: { title: string; body: string }) =>
    api.post('/admin/notifications/broadcast', data),
}

export const reportsApi = {
  getRoutes: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/admin/reports/routes', { params }),
  getStops: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/admin/reports/stops', { params }),
}

// Questions (Akıllı Soru Sistemi)
export const questionsApi = {
  // Driver Questions
  create: (data: {
    driver_id: string
    question_text: string
    question_type: string
    options?: string[]
    follow_up_questions?: Array<{
      condition: Record<string, unknown>
      question: string
      type: string
      options?: string[]
    }>
    context_type?: string
    context_data?: Record<string, unknown>
    related_trip_id?: string
    priority?: number
    expires_at?: string
    scheduled_for?: string
    send_immediately?: boolean
  }) => api.post('/admin/questions', data),
  // Toplu soru oluşturma
  createBulk: (data: {
    driver_ids: string[]
    question_text: string
    question_type: string
    options?: string[]
    follow_up_questions?: Array<{
      condition: Record<string, unknown>
      question: string
      type: string
      options?: string[]
    }>
    context_type?: string
    context_data?: Record<string, unknown>
    priority?: number
    expires_at?: string
    scheduled_for?: string
    send_immediately?: boolean
  }) => api.post('/admin/questions/bulk', data),
  // Filtreye göre toplu soru oluşturma
  createBulkFiltered: (data: {
    filter: {
      on_trip?: boolean
      idle_hours_min?: number
      province?: string
      has_vehicle?: boolean
      has_trailer?: boolean
      recent_trip_hours?: number
      all_drivers?: boolean
    }
    question_text: string
    question_type: string
    options?: string[]
    follow_up_questions?: Array<{
      condition: Record<string, unknown>
      question: string
      type: string
      options?: string[]
    }>
    context_type?: string
    context_data?: Record<string, unknown>
    priority?: number
    expires_at?: string
    scheduled_for?: string
    send_immediately?: boolean
  }) => api.post('/admin/questions/bulk-filtered', data),
  getById: (id: string) => api.get(`/admin/questions/${id}`),
  update: (id: string, data: {
    question_text?: string
    question_type?: string
    options?: string[]
    follow_up_questions?: Array<{
      condition: Record<string, unknown>
      question: string
      type: string
      options?: string[]
    }>
    priority?: number
    expires_at?: string
    scheduled_for?: string
  }) => api.put(`/admin/questions/${id}`, data),
  delete: (id: string) => api.delete(`/admin/questions/${id}`),
  getPendingApproval: () => api.get('/admin/questions/pending-approval'),
  approve: (id: string, approved: boolean, rejection_reason?: string) =>
    api.post(`/admin/questions/${id}/approve`, { approved, rejection_reason }),
  send: (id: string) => api.post(`/admin/questions/${id}/send`),
  getDriverQuestions: (driverId: string, status?: string) =>
    api.get(`/admin/drivers/${driverId}/questions`, { params: { status } }),
  getDriverContext: (driverId: string) =>
    api.get(`/admin/drivers/${driverId}/context`),
  getStats: () => api.get('/admin/questions/stats'),
  getDriversOnTrip: () => api.get('/admin/questions/drivers-on-trip'),
  getIdleDrivers: () => api.get('/admin/questions/idle-drivers'),
}

// Question Rules
export const questionRulesApi = {
  getAll: () => api.get('/admin/question-rules'),
  getById: (id: string) => api.get(`/admin/question-rules/${id}`),
  create: (data: {
    name: string
    description?: string
    trigger_condition: string
    condition_config?: Record<string, unknown>
    question_template: string
    question_type: string
    options_template?: unknown
    follow_up_template?: unknown
    is_active?: boolean
    requires_approval?: boolean
    auto_approve_confidence?: number
    priority?: number
    cooldown_hours?: number
  }) => api.post('/admin/question-rules', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/admin/question-rules/${id}`, data),
  delete: (id: string) => api.delete(`/admin/question-rules/${id}`),
}

// Survey Templates
export const surveyTemplatesApi = {
  getAll: (activeOnly?: boolean) =>
    api.get('/admin/survey-templates', { params: { active: activeOnly } }),
  getById: (id: string) => api.get(`/admin/survey-templates/${id}`),
  create: (data: {
    name: string
    description?: string
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    is_active?: boolean
    is_required?: boolean
    priority?: number
    icon?: string
    color?: string
  }) => api.post('/admin/survey-templates', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/admin/survey-templates/${id}`, data),
  delete: (id: string) => api.delete(`/admin/survey-templates/${id}`),
  addQuestion: (
    templateId: string,
    data: {
      question_text: string
      question_type: string
      options?: unknown
      is_required?: boolean
      order_num?: number
      show_condition?: unknown
      validation?: unknown
    }
  ) => api.post(`/admin/survey-templates/${templateId}/questions`, data),
  updateQuestion: (
    templateId: string,
    questionId: string,
    data: Record<string, unknown>
  ) =>
    api.put(
      `/admin/survey-templates/${templateId}/questions/${questionId}`,
      data
    ),
  deleteQuestion: (templateId: string, questionId: string) =>
    api.delete(`/admin/survey-templates/${templateId}/questions/${questionId}`),
}

// Notification Templates
export const notificationTemplatesApi = {
  getAll: (activeOnly?: boolean) =>
    api.get('/admin/notification-templates', { params: { active: activeOnly } }),
  getById: (id: string) => api.get(`/admin/notification-templates/${id}`),
  create: (data: {
    name: string
    title: string
    body: string
    category: string
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    target_audience?: string
    target_provinces?: string[]
    scheduled_at?: string
    repeat_type?: string
    repeat_config?: Record<string, unknown>
    is_active?: boolean
  }) => api.post('/admin/notification-templates', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/admin/notification-templates/${id}`, data),
  delete: (id: string) => api.delete(`/admin/notification-templates/${id}`),
}

// Trigger Types
export const triggerTypesApi = {
  getAll: () => api.get('/admin/trigger-types'),
}

// Driver Homes (Şoför Ev Adresleri)
export const driverHomesApi = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/driver-homes', { params }),
  getByDriver: (driverId: string) =>
    api.get(`/admin/drivers/${driverId}/homes`),
  create: (driverId: string, data: {
    name: string
    latitude: number
    longitude: number
    address?: string
    province?: string
    district?: string
    radius?: number
  }) => api.post(`/admin/drivers/${driverId}/homes`, data),
  update: (homeId: string, data: {
    name?: string
    latitude?: number
    longitude?: number
    address?: string
    province?: string
    district?: string
    radius?: number
    is_active?: boolean
  }) => api.put(`/admin/driver-homes/${homeId}`, data),
  delete: (homeId: string) => api.delete(`/admin/driver-homes/${homeId}`),
}

// Stops API (Durak Yönetimi)
export const stopsApi = {
  getAll: (params?: { limit?: number; offset?: number; location_type?: string }) =>
    api.get('/admin/stops', { params }),
  getUncategorized: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/stops/uncategorized', { params }),
  updateType: (stopId: string, locationType: string) =>
    api.put(`/admin/stops/${stopId}`, { location_type: locationType }),
  getLocationTypes: () => api.get('/admin/stops/location-types'),
  detectForDriver: (driverId: string, params?: { start_date?: string; end_date?: string }) =>
    api.post(`/admin/stops/detect/${driverId}`, null, { params }),
  detectAll: (params?: { start_date?: string; end_date?: string }) =>
    api.post('/admin/stops/detect-all', null, { params }),
}
