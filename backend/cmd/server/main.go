package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nakliyeo-mobil/internal/api"
	"nakliyeo-mobil/internal/middleware"
	"nakliyeo-mobil/internal/repository"
	"nakliyeo-mobil/internal/service"
	"nakliyeo-mobil/internal/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func init() {
	// Initialize Sentry early
	if err := middleware.InitSentry(); err != nil {
		log.Printf("[WARN] Failed to initialize Sentry: %v", err)
	}
}

func main() {
	// .env dosyasını yükle
	if err := godotenv.Load(); err != nil {
		fmt.Println("[INFO] No .env file found, using environment variables")
		os.Stdout.Sync()
	}

	// Veritabanı bağlantısı
	db, err := repository.NewPostgresDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Redis bağlantısı
	redis, err := repository.NewRedisClient(os.Getenv("REDIS_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redis.Close()

	// Repository'ler
	driverRepo := repository.NewDriverRepository(db)
	vehicleRepo := repository.NewVehicleRepository(db)
	trailerRepo := repository.NewTrailerRepository(db)
	locationRepo := repository.NewLocationRepository(db)
	tripRepo := repository.NewTripRepository(db)
	stopRepo := repository.NewStopRepository(db)
	surveyRepo := repository.NewSurveyRepository(db)
	adminRepo := repository.NewAdminRepository(db)
	settingsRepo := repository.NewSettingsRepository(db)
	cargoRepo := repository.NewCargoRepository(db)
	analyticsRepo := repository.NewAnalyticsRepository(db)
	questionsRepo := repository.NewQuestionsRepository(db)

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

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "time": time.Now()})
	})

	// Static files for APK download
	router.Static("/downloads", "./static/downloads")

	// API routes
	apiGroup := router.Group("/api/v1")
	{
		// Public routes (auth)
		authHandler := api.NewAuthHandler(authService)
		apiGroup.POST("/auth/register", authHandler.Register)
		apiGroup.POST("/auth/login", authHandler.Login)
		apiGroup.POST("/auth/send-otp", authHandler.SendOTP)
		apiGroup.POST("/auth/verify-otp", authHandler.VerifyOTP)
		apiGroup.POST("/auth/refresh", authHandler.RefreshToken)

		// Admin auth
		apiGroup.POST("/admin/auth/login", authHandler.AdminLogin)

		// Lokasyon verileri (public)
		apiGroup.GET("/locations/provinces", api.GetProvinces)
		apiGroup.GET("/locations/districts/:province", api.GetDistricts)
		apiGroup.GET("/locations/neighborhoods/:province/:district", api.GetNeighborhoods)

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
			locationHandler := api.NewLocationHandler(locationService, tripService, driverService, wsHub)
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
		}

		// Protected admin routes
		adminGroup := apiGroup.Group("/admin")
		adminGroup.Use(middleware.AuthMiddleware("admin"))
		{
			// Dashboard
			adminHandler := api.NewAdminHandler(adminService, driverService, locationService, tripService, surveyService, vehicleService, trailerService)
			adminGroup.GET("/dashboard", adminHandler.GetDashboard)
			adminGroup.GET("/app-stats", adminHandler.GetDriverAppStats)

			// Drivers
			adminGroup.GET("/drivers", adminHandler.GetDrivers)
			adminGroup.GET("/drivers/:id", adminHandler.GetDriverDetail)
			adminGroup.GET("/drivers/:id/locations", adminHandler.GetDriverLocations)
			adminGroup.GET("/drivers/:id/trips", adminHandler.GetDriverTrips)
			adminGroup.GET("/drivers/:id/stops", adminHandler.GetDriverStops)

			// Real-time locations
			adminGroup.GET("/locations/live", adminHandler.GetLiveLocations)

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

			// Stops (Durak Yönetimi)
			stopDetectionService := service.NewStopDetectionService(locationRepo, stopRepo, driverRepo)
			stopHandler := api.NewStopHandler(stopDetectionService, stopRepo, driverRepo)
			adminGroup.GET("/stops", stopHandler.GetStops)
			adminGroup.GET("/stops/uncategorized", stopHandler.GetUncategorizedStops)
			adminGroup.PUT("/stops/:id", stopHandler.UpdateStopType)
			adminGroup.GET("/stops/location-types", stopHandler.GetLocationTypes)
			adminGroup.POST("/stops/detect/:driver_id", stopHandler.DetectStopsForDriver)
			adminGroup.POST("/stops/detect-all", stopHandler.DetectStopsForAllDrivers)

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
			adminGroup.GET("/questions/drivers-on-trip", questionsHandler.GetDriversOnTrip)
			adminGroup.GET("/questions/idle-drivers", questionsHandler.GetIdleDrivers)
			adminGroup.GET("/trigger-types", questionsHandler.GetTriggerTypes)
		}

		// Public app config (mobil uygulama için)
		publicConfigHandler := api.NewConfigHandler(cargoRepo, settingsRepo)
		apiGroup.GET("/config/app", publicConfigHandler.GetAppConfig)
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
		fmt.Printf("=== Server starting on port %s ===\n", port)
		os.Stdout.Sync()
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("Shutting down server...")
	os.Stdout.Sync()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	// Flush Sentry events before exit
	middleware.FlushSentry()

	fmt.Println("Server exited properly")
	os.Stdout.Sync()
}
