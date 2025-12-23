package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nakliyeo-mobil/internal/api"
	"nakliyeo-mobil/internal/logger"
	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/repository"
	"nakliyeo-mobil/internal/service"
	"nakliyeo-mobil/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func init() {
	// Initialize logger
	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}
	prettyPrint := os.Getenv("GIN_MODE") != "release"
	logger.Init(logLevel, prettyPrint)

	// Initialize Sentry early
	if err := middleware.InitSentry(); err != nil {
		logger.Warn("Failed to initialize Sentry: " + err.Error())
	}
}

func main() {
	// .env dosyasını yükle
	if err := godotenv.Load(); err != nil {
		logger.Info("No .env file found, using environment variables")
	}

	// Veritabanı bağlantısı
	db, err := repository.NewPostgresDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		logger.Fatal("Failed to connect to database", err)
	}
	defer db.Close()

	// Redis bağlantısı
	redis, err := repository.NewRedisClient(os.Getenv("REDIS_URL"))
	if err != nil {
		logger.Fatal("Failed to connect to Redis", err)
	}
	defer redis.Close()

	// DB Logger başlat (backend loglarını veritabanına yazar)
	logger.InitDBLogger(db.Pool)
	defer logger.StopDBLogger()
	logger.LogSystemEvent("Backend started", "info", map[string]interface{}{
		"version": "1.0.55",
	})

	// Repository'ler
	driverRepo := repository.NewDriverRepository(db)
	vehicleRepo := repository.NewVehicleRepository(db)
	trailerRepo := repository.NewTrailerRepository(db)
	locationRepo := repository.NewLocationRepository(db)
	tripRepo := repository.NewTripRepository(db)
	stopRepo := repository.NewStopRepository(db)
	hotspotRepo := repository.NewHotspotRepository(db)
	// Ensure hotspot table exists
	if err := hotspotRepo.EnsureTableExists(context.Background()); err != nil {
		logger.Log.Warn().Err(err).Msg("Could not ensure hotspot table exists")
	}
	surveyRepo := repository.NewSurveyRepository(db)
	adminRepo := repository.NewAdminRepository(db)
	settingsRepo := repository.NewSettingsRepository(db)
	cargoRepo := repository.NewCargoRepository(db)
	analyticsRepo := repository.NewAnalyticsRepository(db)
	questionsRepo := repository.NewQuestionsRepository(db)
	driverHomeRepo := repository.NewDriverHomeRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	announcementRepo := repository.NewAnnouncementRepository(db)
	questionFlowTemplateRepo := repository.NewQuestionFlowTemplateRepository(db)
	transportRepo := repository.NewTransportRepository(db)
	appLogRepo := repository.NewAppLogRepository(db)

	// Service'ler
	authService := service.NewAuthService(driverRepo, adminRepo, settingsRepo)
	driverService := service.NewDriverService(driverRepo)
	vehicleService := service.NewVehicleService(vehicleRepo)
	trailerService := service.NewTrailerService(trailerRepo)
	locationService := service.NewLocationService(locationRepo, redis)
	tripService := service.NewTripService(tripRepo, stopRepo, locationRepo)
	surveyService := service.NewSurveyService(surveyRepo)
	adminService := service.NewAdminService(adminRepo, settingsRepo)
	notificationService := service.NewNotificationService(os.Getenv("FCM_CREDENTIALS"))
	routingService := service.NewRoutingServiceWithRedis(os.Getenv("OSRM_URL"), redis.Client)
	transportService := service.NewTransportService(transportRepo, routingService)
	geocodingService := service.NewGeocodingService()
	// SMS servisi kaldırıldı

	// WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Otomatik soru üretme servisi
	questionGenerator := service.NewQuestionGeneratorService(questionsRepo, driverRepo, notificationService)
	questionGenerator.Start(5 * time.Minute) // Her 5 dakikada bir kontrol et
	defer questionGenerator.Stop()

	// Otomatik bildirim zamanlayıcı servisi
	notificationScheduler := service.NewNotificationSchedulerService(questionsRepo, driverRepo, notificationService)
	notificationScheduler.Start(1 * time.Minute) // Her dakika kontrol et
	defer notificationScheduler.Stop()

	// Gin router
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()

	// Sentry middleware (must be first)
	router.Use(middleware.SentryMiddleware())
	router.Use(middleware.SentryRecoveryMiddleware())

	// CORS middleware
	router.Use(middleware.CORSMiddleware())

	// Rate limiting middleware (genel)
	router.Use(middleware.RateLimitMiddleware())

	// Logging middleware
	router.Use(middleware.LoggingMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "time": time.Now()})
	})

	// Static files for APK download
	router.Static("/downloads", "./static/downloads")

	// API routes
	apiGroup := router.Group("/api/v1")
	{
		// Public routes (auth) - Strict rate limiting
		authRateLimit := middleware.StrictRateLimitMiddleware(10, time.Minute) // 10 req/min
		authHandler := api.NewAuthHandler(authService)
		apiGroup.POST("/auth/register", authRateLimit, authHandler.Register)
		apiGroup.POST("/auth/login", authRateLimit, authHandler.Login)
		apiGroup.POST("/auth/check-phone", authRateLimit, authHandler.CheckPhoneExists)
		apiGroup.POST("/auth/send-otp", authRateLimit, authHandler.SendOTP)
		apiGroup.POST("/auth/verify-otp", authRateLimit, authHandler.VerifyOTP)
		apiGroup.POST("/auth/refresh", authHandler.RefreshToken)

		// Admin auth
		apiGroup.POST("/admin/auth/login", authRateLimit, authHandler.AdminLogin)

		// Lokasyon verileri (public)
		apiGroup.GET("/locations/provinces", api.GetProvinces)
		apiGroup.GET("/locations/districts/:province", api.GetDistricts)
		apiGroup.GET("/locations/neighborhoods/:province/:district", api.GetNeighborhoods)

		// Trip Handler (shared between driver and admin)
		tripHandler := api.NewTripHandler(db.Pool)

		// Protected driver routes
		driverGroup := apiGroup.Group("/driver")
		driverGroup.Use(middleware.AuthMiddleware("driver"))
		{
			// Profile
			driverHandler := api.NewDriverHandler(driverService)
			driverGroup.GET("/profile", driverHandler.GetProfile)
			driverGroup.PUT("/profile", driverHandler.UpdateProfile)
			driverGroup.PUT("/fcm-token", driverHandler.UpdateFCMToken)
			driverGroup.POST("/device-info", driverHandler.UpdateDeviceInfo)
			driverGroup.POST("/heartbeat", driverHandler.Heartbeat)

			// Call Logs & Contacts Sync
			driverGroup.POST("/call-logs", driverHandler.SyncCallLogs)
			driverGroup.POST("/contacts", driverHandler.SyncContacts)

			// Vehicles
			vehicleHandler := api.NewVehicleHandler(vehicleService)
			driverGroup.GET("/vehicles", vehicleHandler.GetAll)
			driverGroup.POST("/vehicles", vehicleHandler.Create)
			driverGroup.PUT("/vehicles/:id", vehicleHandler.Update)
			driverGroup.DELETE("/vehicles/:id", vehicleHandler.Delete)

			// Trailers
			trailerHandler := api.NewTrailerHandler(trailerService)
			driverGroup.GET("/trailers", trailerHandler.GetAll)
			driverGroup.POST("/trailers", trailerHandler.Create)
			driverGroup.PUT("/trailers/:id", trailerHandler.Update)
			driverGroup.DELETE("/trailers/:id", trailerHandler.Delete)

			// Location
			locationHandler := api.NewLocationHandler(locationService, tripService, driverService, geocodingService, wsHub)
			driverGroup.POST("/location", locationHandler.SaveLocation)
			driverGroup.POST("/location/batch", locationHandler.SaveBatchLocations)

			// Surveys
			surveyHandler := api.NewSurveyHandler(surveyService)
			driverGroup.GET("/surveys/pending", surveyHandler.GetPendingSurveys)
			driverGroup.POST("/surveys/:id/respond", surveyHandler.SubmitResponse)

			// Questions (Akıllı Soru Sistemi - Şoför tarafı)
			driverQuestionsHandler := api.NewQuestionsHandler(questionsRepo, driverRepo, notificationService)
			driverGroup.GET("/questions/pending", driverQuestionsHandler.GetPendingQuestionsForDriver)
			driverGroup.POST("/questions/:id/answer", driverQuestionsHandler.AnswerQuestion)

			// Announcements (Duyurular - Şoför tarafı)
			driverAnnouncementHandler := api.NewAnnouncementHandler(announcementRepo, driverRepo, auditRepo)
			driverGroup.GET("/announcements", driverAnnouncementHandler.GetActiveAnnouncements)
			driverGroup.POST("/announcements/:id/dismiss", driverAnnouncementHandler.DismissAnnouncement)

			// Trip Events & Geofencing (Akıllı Sefer Algılama)
			driverGroup.POST("/trip-events", tripHandler.SaveTripEvent)
			driverGroup.GET("/geofences", tripHandler.GetGeofences)
			driverGroup.POST("/geofence-events", tripHandler.SaveGeofenceEvent)

			// Driver Homes (Ev Adresleri - Mobil uygulama için)
			driverHomeHandlerForDriver := api.NewDriverHomeHandler(driverHomeRepo, driverRepo)
			driverGroup.GET("/homes", driverHomeHandlerForDriver.GetMyHomes)

			// App Logs (Uygulama Logları - Şoför tarafı)
			appLogHandler := api.NewAppLogHandler(appLogRepo)
			driverGroup.POST("/logs/batch", appLogHandler.SaveBatchLogs)
		}

		// Protected admin routes
		adminGroup := apiGroup.Group("/admin")
		adminGroup.Use(middleware.AuthMiddleware("admin"))
		adminGroup.Use(middleware.AuditMiddleware(auditRepo))
		{
			// Dashboard
			adminHandler := api.NewAdminHandler(adminService, driverService, locationService, tripService, surveyService, vehicleService, trailerService)
			adminGroup.GET("/dashboard", adminHandler.GetDashboard)
			adminGroup.GET("/dashboard/weekly", adminHandler.GetWeeklyStats)
			adminGroup.GET("/app-stats", adminHandler.GetDriverAppStats)

			// Drivers
			adminGroup.GET("/drivers", adminHandler.GetDrivers)
			adminGroup.GET("/drivers/:id", adminHandler.GetDriverDetail)
			adminGroup.GET("/drivers/:id/locations", adminHandler.GetDriverLocations)
			adminGroup.GET("/drivers/:id/trips", adminHandler.GetDriverTrips)
			adminGroup.GET("/drivers/:id/stops", adminHandler.GetDriverStops)
			adminGroup.PUT("/drivers/:id/status", adminHandler.UpdateDriverStatus)
			adminGroup.PUT("/drivers/:id/features", adminHandler.UpdateDriverFeatures)
			adminGroup.PUT("/drivers/:id/home", adminHandler.UpdateDriverHomeLocation)
			adminGroup.DELETE("/drivers/:id", adminHandler.DeleteDriver)

			// Driver Call Logs
			adminGroup.GET("/drivers/:id/call-logs", adminHandler.GetDriverCallLogs)
			adminGroup.DELETE("/drivers/:id/call-logs", adminHandler.DeleteDriverCallLogs)

			// Driver Contacts
			adminGroup.GET("/drivers/:id/contacts", adminHandler.GetDriverContacts)
			adminGroup.DELETE("/drivers/:id/contacts", adminHandler.DeleteDriverContacts)

			// Driver Responses (Survey & Question)
			adminGroup.GET("/drivers/:id/responses", adminHandler.GetDriverResponses)
			adminGroup.DELETE("/drivers/:id/survey-responses", adminHandler.DeleteDriverSurveyResponses)
			adminGroup.DELETE("/drivers/:id/question-responses", adminHandler.DeleteDriverQuestionResponses)

			// All Call Logs & Contacts (tüm şoförler için)
			adminGroup.GET("/call-logs", adminHandler.GetAllCallLogs)
			adminGroup.GET("/contacts", adminHandler.GetAllContacts)
			adminGroup.DELETE("/contacts/:contactId", adminHandler.DeleteContact)
			adminGroup.POST("/contacts/bulk-delete", adminHandler.DeleteContactsBulk)

			// Real-time locations
			adminGroup.GET("/locations/live", adminHandler.GetLiveLocations)

			// Location Admin (Konum Takibi sayfası için)
			adminLocationHandler := api.NewLocationHandler(locationService, tripService, driverService, geocodingService, wsHub)
			adminGroup.GET("/locations/admin", adminLocationHandler.GetLocationsForAdmin)

			// Surveys
			adminSurveyHandler := api.NewAdminSurveyHandler(surveyService)
			adminGroup.GET("/surveys", adminSurveyHandler.GetAll)
			adminGroup.POST("/surveys", adminSurveyHandler.Create)
			adminGroup.PUT("/surveys/:id", adminSurveyHandler.Update)
			adminGroup.DELETE("/surveys/:id", adminSurveyHandler.Delete)
			adminGroup.GET("/surveys/:id/responses", adminSurveyHandler.GetResponses)

			// Notifications
			notificationHandler := api.NewNotificationHandler(notificationService, driverService)
			adminGroup.POST("/notifications/send", notificationHandler.SendNotification)
			adminGroup.POST("/notifications/broadcast", notificationHandler.BroadcastNotification)
			adminGroup.POST("/notifications/validate-apps", notificationHandler.ValidateAppInstallations)
			adminGroup.POST("/notifications/request-location", notificationHandler.RequestDriverLocation)
			adminGroup.POST("/notifications/request-call-sync", notificationHandler.RequestCallLogSync)
			adminGroup.POST("/notifications/request-contact-sync", notificationHandler.RequestContactSync)

			// Settings
			settingsHandler := api.NewSettingsHandler(adminService)
			adminGroup.GET("/settings", settingsHandler.GetAll)
			adminGroup.PUT("/settings", settingsHandler.Update)

			// Reports
			reportHandler := api.NewReportHandler(tripService, locationService, surveyService)
			adminGroup.GET("/reports/routes", reportHandler.GetRouteAnalysis)
			adminGroup.GET("/reports/stops", reportHandler.GetStopAnalysis)
			adminGroup.GET("/reports/surveys", reportHandler.GetSurveyAnalysis)

			// Config (dinamik ayarlar)
			configHandler := api.NewConfigHandler(cargoRepo, settingsRepo)
			adminGroup.GET("/config/cargo-types", configHandler.GetCargoTypes)
			adminGroup.POST("/config/cargo-types", configHandler.CreateCargoType)
			adminGroup.PUT("/config/cargo-types/:id", configHandler.UpdateCargoType)
			adminGroup.DELETE("/config/cargo-types/:id", configHandler.DeleteCargoType)

			adminGroup.GET("/config/vehicle-brands", configHandler.GetVehicleBrands)
			adminGroup.POST("/config/vehicle-brands", configHandler.CreateVehicleBrand)
			adminGroup.PUT("/config/vehicle-brands/:id", configHandler.UpdateVehicleBrand)
			adminGroup.DELETE("/config/vehicle-brands/:id", configHandler.DeleteVehicleBrand)
			adminGroup.POST("/config/vehicle-brands/:brand_id/models", configHandler.CreateVehicleModel)
			adminGroup.PUT("/config/vehicle-models/:id", configHandler.UpdateVehicleModel)
			adminGroup.DELETE("/config/vehicle-models/:id", configHandler.DeleteVehicleModel)

			adminGroup.GET("/config/trailer-types", configHandler.GetTrailerTypes)
			adminGroup.POST("/config/trailer-types", configHandler.CreateTrailerType)
			adminGroup.PUT("/config/trailer-types/:id", configHandler.UpdateTrailerType)
			adminGroup.DELETE("/config/trailer-types/:id", configHandler.DeleteTrailerType)

			// Mobil uygulama konfigürasyonu
			adminGroup.GET("/config/mobile", configHandler.GetMobileConfig)
			adminGroup.PUT("/config/mobile", configHandler.UpdateMobileConfig)

			// Analytics
			analyticsHandler := api.NewAnalyticsHandler(analyticsRepo, cargoRepo)
			analyticsGeneratorService := service.NewAnalyticsGeneratorService(db.Pool, stopRepo, locationRepo, analyticsRepo)
			analyticsHandler.SetGeneratorService(analyticsGeneratorService)
			adminGroup.GET("/analytics/hotspots", analyticsHandler.GetHotspots)
			adminGroup.GET("/analytics/hotspots/:id", analyticsHandler.GetHotspot)
			adminGroup.POST("/analytics/hotspots", analyticsHandler.CreateHotspot)
			adminGroup.PUT("/analytics/hotspots/:id", analyticsHandler.UpdateHotspot)
			adminGroup.DELETE("/analytics/hotspots/:id", analyticsHandler.DeleteHotspot)
			adminGroup.POST("/analytics/hotspots/detect", analyticsHandler.DetectHotspots)
			adminGroup.GET("/analytics/hotspots/nearby", analyticsHandler.GetNearbyHotspots)

			adminGroup.GET("/analytics/routes", analyticsHandler.GetRouteSegments)
			adminGroup.GET("/analytics/route-segments", analyticsHandler.GetRouteSegments) // Alias
			adminGroup.GET("/analytics/price-matrix", analyticsHandler.GetPriceMatrix)
			adminGroup.GET("/analytics/daily-stats", analyticsHandler.GetDailyStats)
			adminGroup.POST("/analytics/daily-stats/generate", analyticsHandler.GenerateDailyStats)
			adminGroup.GET("/analytics/province-stats", analyticsHandler.GetProvinceStats)
			adminGroup.GET("/analytics/heatmap", analyticsHandler.GetRouteHeatmap)
			adminGroup.GET("/analytics/route-heatmap", analyticsHandler.GetRouteHeatmap) // Alias

			adminGroup.GET("/analytics/drivers/:driver_id/routes", analyticsHandler.GetDriverRoutes)
			adminGroup.GET("/analytics/trips/:trip_id/details", analyticsHandler.GetTripDetails)

			adminGroup.GET("/analytics/price-surveys", analyticsHandler.GetPriceSurveys)
			adminGroup.PUT("/analytics/price-surveys/:id/verify", analyticsHandler.VerifyPriceSurvey)

			// Analytics Generation (yeni endpointler)
			adminGroup.POST("/analytics/generate", analyticsHandler.GenerateAllAnalytics)
			adminGroup.POST("/analytics/generate/hotspots", analyticsHandler.GenerateHotspots)
			adminGroup.POST("/analytics/generate/route-segments", analyticsHandler.GenerateRouteSegments)
			adminGroup.GET("/analytics/location-heatmap", analyticsHandler.GetLocationHeatmap)
			adminGroup.GET("/analytics/stop-heatmap", analyticsHandler.GetStopHeatmap)

			// Stops (Durak Yönetimi)
			stopDetectionService := service.NewStopDetectionService(locationRepo, stopRepo, driverRepo)
			stopHandler := api.NewStopHandler(stopDetectionService, stopRepo, driverRepo)
			stopHandler.SetHotspotRepository(hotspotRepo)
			adminGroup.GET("/stops", stopHandler.GetStops)
			adminGroup.GET("/stops/uncategorized", stopHandler.GetUncategorizedStops)
			adminGroup.GET("/stops/location-types", stopHandler.GetLocationTypes)
			adminGroup.GET("/stops/:id", stopHandler.GetStopByID)
			adminGroup.POST("/stops", stopHandler.CreateStop)
			adminGroup.PUT("/stops/:id", stopHandler.UpdateStopType)
			adminGroup.DELETE("/stops/:id", stopHandler.DeleteStop)
			adminGroup.POST("/stops/bulk-delete", stopHandler.BulkDeleteStops)
			adminGroup.PUT("/stops/bulk-update", stopHandler.BulkUpdateStopType)
			adminGroup.POST("/stops/detect/:driver_id", stopHandler.DetectStopsForDriver)
			adminGroup.POST("/stops/detect-all", stopHandler.DetectStopsForAllDrivers)

			// Driver Homes (Şoför Ev Adresleri)
			driverHomeHandler := api.NewDriverHomeHandler(driverHomeRepo, driverRepo)
			driverHomeHandler.SetStopRepository(stopRepo)
			adminGroup.GET("/driver-homes", driverHomeHandler.GetAllDriverHomes)
			adminGroup.GET("/drivers/:id/homes", driverHomeHandler.GetDriverHomes)
			adminGroup.POST("/drivers/:id/homes", driverHomeHandler.CreateDriverHome)
			adminGroup.PUT("/driver-homes/:id", driverHomeHandler.UpdateDriverHome)
			adminGroup.DELETE("/driver-homes/:id", driverHomeHandler.DeleteDriverHome)
			adminGroup.POST("/driver-homes/from-stop", driverHomeHandler.SetHomeFromStop)

			// Geofence Zones (Bölge Yönetimi)
			adminGroup.GET("/geofences", tripHandler.AdminGetGeofences)
			adminGroup.POST("/geofences", tripHandler.AdminCreateGeofence)
			adminGroup.PUT("/geofences/:id", tripHandler.AdminUpdateGeofence)
			adminGroup.DELETE("/geofences/:id", tripHandler.AdminDeleteGeofence)

			// Questions (Akıllı Soru Sistemi)
			questionsHandler := api.NewQuestionsHandler(questionsRepo, driverRepo, notificationService)

			// Driver Questions
			adminGroup.POST("/questions", questionsHandler.CreateQuestion)
			adminGroup.POST("/questions/bulk", questionsHandler.CreateBulkQuestions)
			adminGroup.POST("/questions/bulk-filtered", questionsHandler.CreateFilteredBulkQuestions)
			adminGroup.GET("/questions/:id", questionsHandler.GetQuestion)
			adminGroup.PUT("/questions/:id", questionsHandler.UpdateQuestion)
			adminGroup.DELETE("/questions/:id", questionsHandler.DeleteQuestion)
			adminGroup.GET("/questions/pending-approval", questionsHandler.GetPendingApprovalQuestions)
			adminGroup.POST("/questions/:id/approve", questionsHandler.ApproveQuestion)
			adminGroup.POST("/questions/:id/send", questionsHandler.SendQuestion)
			adminGroup.GET("/drivers/:id/questions", questionsHandler.GetDriverQuestions)
			adminGroup.GET("/drivers/:id/context", questionsHandler.GetDriverContext)

			// Question Rules
			adminGroup.GET("/question-rules", questionsHandler.GetRules)
			adminGroup.GET("/question-rules/:id", questionsHandler.GetRule)
			adminGroup.POST("/question-rules", questionsHandler.CreateRule)
			adminGroup.PUT("/question-rules/:id", questionsHandler.UpdateRule)
			adminGroup.DELETE("/question-rules/:id", questionsHandler.DeleteRule)

			// Survey Templates
			adminGroup.GET("/survey-templates", questionsHandler.GetSurveyTemplates)
			adminGroup.GET("/survey-templates/:id", questionsHandler.GetSurveyTemplate)
			adminGroup.POST("/survey-templates", questionsHandler.CreateSurveyTemplate)
			adminGroup.PUT("/survey-templates/:id", questionsHandler.UpdateSurveyTemplate)
			adminGroup.DELETE("/survey-templates/:id", questionsHandler.DeleteSurveyTemplate)
			adminGroup.POST("/survey-templates/:id/questions", questionsHandler.AddTemplateQuestion)
			adminGroup.PUT("/survey-templates/:id/questions/:question_id", questionsHandler.UpdateTemplateQuestion)
			adminGroup.DELETE("/survey-templates/:id/questions/:question_id", questionsHandler.DeleteTemplateQuestion)

			// Notification Templates
			adminGroup.GET("/notification-templates", questionsHandler.GetNotificationTemplates)
			adminGroup.GET("/notification-templates/:id", questionsHandler.GetNotificationTemplate)
			adminGroup.POST("/notification-templates", questionsHandler.CreateNotificationTemplate)
			adminGroup.PUT("/notification-templates/:id", questionsHandler.UpdateNotificationTemplate)
			adminGroup.DELETE("/notification-templates/:id", questionsHandler.DeleteNotificationTemplate)

			// Context & Stats
			adminGroup.GET("/questions/stats", questionsHandler.GetQuestionStats)
			adminGroup.GET("/questions/answered", questionsHandler.GetAnsweredQuestions)
			adminGroup.GET("/questions/drivers-on-trip", questionsHandler.GetDriversOnTrip)
			adminGroup.GET("/questions/idle-drivers", questionsHandler.GetIdleDrivers)
			adminGroup.GET("/trigger-types", questionsHandler.GetTriggerTypes)

			// Audit Logs
			auditHandler := api.NewAuditHandler(auditRepo)
			adminGroup.GET("/audit-logs", auditHandler.GetAuditLogs)
			adminGroup.GET("/audit-logs/stats", auditHandler.GetAuditStats)
			adminGroup.DELETE("/audit-logs/cleanup", auditHandler.CleanupOldLogs)

			// App Logs (Uygulama Logları - Admin tarafı)
			adminAppLogHandler := api.NewAppLogHandler(appLogRepo)
			adminGroup.GET("/app-logs", adminAppLogHandler.GetLogs)
			adminGroup.GET("/app-logs/stats", adminAppLogHandler.GetLogStats)
			adminGroup.GET("/app-logs/errors", adminAppLogHandler.GetErrors)
			adminGroup.GET("/app-logs/critical", adminAppLogHandler.GetCritical)
			adminGroup.GET("/drivers/:id/app-logs", adminAppLogHandler.GetDriverLogs)
			adminGroup.DELETE("/app-logs/cleanup", adminAppLogHandler.DeleteOldLogs)

			// Announcements (Duyurular - Admin tarafı)
			announcementHandler := api.NewAnnouncementHandler(announcementRepo, driverRepo, auditRepo)
			adminGroup.GET("/announcements", announcementHandler.GetAnnouncements)
			adminGroup.GET("/announcements/stats", announcementHandler.GetAnnouncementStats)
			adminGroup.POST("/announcements", announcementHandler.CreateAnnouncement)
			adminGroup.GET("/announcements/:id", announcementHandler.GetAnnouncementByID)
			adminGroup.PUT("/announcements/:id", announcementHandler.UpdateAnnouncement)
			adminGroup.DELETE("/announcements/:id", announcementHandler.DeleteAnnouncement)
			adminGroup.POST("/announcements/:id/toggle", announcementHandler.ToggleAnnouncementActive)

			// Question Flow Templates (Soru Akis Sablonlari - Admin tarafı)
			questionFlowTemplateHandler := api.NewQuestionFlowTemplateHandler(questionFlowTemplateRepo, auditRepo)
			adminGroup.GET("/question-templates", questionFlowTemplateHandler.GetTemplates)
			adminGroup.GET("/question-templates/stats", questionFlowTemplateHandler.GetStats)
			adminGroup.GET("/question-templates/categories", questionFlowTemplateHandler.GetCategories)
			adminGroup.POST("/question-templates", questionFlowTemplateHandler.CreateTemplate)
			adminGroup.GET("/question-templates/:id", questionFlowTemplateHandler.GetTemplateByID)
			adminGroup.PUT("/question-templates/:id", questionFlowTemplateHandler.UpdateTemplate)
			adminGroup.DELETE("/question-templates/:id", questionFlowTemplateHandler.DeleteTemplate)
			adminGroup.POST("/question-templates/:id/duplicate", questionFlowTemplateHandler.DuplicateTemplate)
			adminGroup.POST("/question-templates/:id/use", questionFlowTemplateHandler.IncrementUsage)

			// Transport Records (Taşıma Kayıtları / Fiyat Raporları)
			transportHandler := api.NewTransportHandler(transportService)
			adminGroup.GET("/transport-records", transportHandler.GetAll)
			adminGroup.GET("/transport-records/stats", transportHandler.GetStats)
			adminGroup.GET("/transport-records/trailer-types", transportHandler.GetTrailerTypes)
			adminGroup.GET("/transport-records/prices", transportHandler.GetPricesByRoute)
			adminGroup.POST("/transport-records", transportHandler.Create)
			adminGroup.GET("/transport-records/:id", transportHandler.GetByID)
			adminGroup.PUT("/transport-records/:id", transportHandler.Update)
			adminGroup.DELETE("/transport-records/:id", transportHandler.Delete)
		}

		// Public app config (mobil uygulama için)
		publicConfigHandler := api.NewConfigHandler(cargoRepo, settingsRepo)
		apiGroup.GET("/config/app", publicConfigHandler.GetAppConfig)

		// Routing (OSRM - Karayolu Mesafe Hesaplama)
		routingHandler := api.NewRoutingHandler(routingService)
		adminGroup.GET("/routing/distance", routingHandler.GetRouteDistance)
		adminGroup.GET("/routing/distance-fallback", routingHandler.GetRouteDistanceWithFallback)
		adminGroup.GET("/routing/status", routingHandler.CheckOSRMStatus)
		adminGroup.GET("/routing/cache-stats", routingHandler.GetCacheStats)
		adminGroup.DELETE("/routing/cache", routingHandler.ClearCache)
		adminGroup.POST("/routing/batch", routingHandler.GetBatchDistances)
		adminGroup.POST("/routing/province-matrix", routingHandler.GetProvinceDistanceMatrix)
		adminGroup.POST("/routing/route-geometry", routingHandler.GetRouteGeometry)
	}

	// WebSocket endpoint
	router.GET("/ws", func(c *gin.Context) {
		websocket.HandleWebSocket(wsHub, c.Writer, c.Request)
	})

	// Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		logger.Log.Info().Str("port", port).Msg("Server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", err)
	}

	// Flush Sentry events before exit
	middleware.FlushSentry()

	logger.Info("Server exited properly")
}
