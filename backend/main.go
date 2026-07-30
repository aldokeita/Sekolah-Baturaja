package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"lpq-backend/internal/config"
	"lpq-backend/internal/db"
	"lpq-backend/internal/handler"
	"lpq-backend/internal/middleware"
	"lpq-backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	store := storage.New(cfg.UploadDir, cfg.JWTSecret, cfg.MaxUploadBytes)

	// Init all handlers
	authHandler := handler.NewAuthHandler(pool, cfg)
	fileHandler := handler.NewFileHandler(store, cfg)
	santriHandler := handler.NewSantriHandler(pool)
	guruHandler := handler.NewGuruHandler(pool)
	classesHandler := handler.NewClassesHandler(pool)
	attendanceHandler := handler.NewAttendanceHandler(pool)
	paymentHandler := handler.NewPaymentHandler(pool)
	contentHandler := handler.NewContentHandler(pool)
	configHandler := handler.NewAppConfigHandler(pool)
	academicHandler := handler.NewAcademicHandler(pool)
	mmqHandler := handler.NewMMQHandler(pool)
	gamificationHandler := handler.NewGamificationHandler(pool)
	mediaPlayerHandler := handler.NewMediaPlayerHandler(pool)
	forumHandler := handler.NewForumHandler(pool)
	loginLogsHandler := handler.NewLoginLogsHandler(pool, cfg)
	whatsappHandler := handler.NewWhatsAppHandler(pool)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(corsMiddleware)

	// ── Public: auth ─────────────────────────────────────────────────────────
	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)
	// ── Public: static file serving ──────────────────────────────────────────
	r.Get("/files/website-assets/*", fileHandler.ServePublic)
	r.Get("/files/music-files/*", fileHandler.ServePublic)
	r.Get("/files/avatars/*", fileHandler.ServePrivate) // signed URL required

	// ── Public: counts (homepage stats) ──────────────────────────────────────
	r.Get("/api/santri/count", santriHandler.Count)
	r.Get("/api/guru/count", guruHandler.Count)

	// ── Public: website content (news, announcements, feedback) ──────────────
	// Admin write endpoints inside this handler check role themselves.
	// ponytail: no separate public gamification-config route — those keys
	// (gatcha_config, level_config, tv_config) are website_content rows already
	// readable via GET /api/content/website?keys=..., so a dedicated route is
	// redundant. Add one only if the payload shape needs to diverge.
	r.Mount("/api/content", contentHandler.Routes())

	// ── Public: login attempt recorder ───────────────────────────────────────
	// Deliberately outside the RequireAuth group: a FAILED login has no token
	// yet, so the frontend calls this without an Authorization header (see
	// recordLoginAttempt in src/lib/loginSecurityAdapters.js). The handler
	// validates the Bearer token itself when one IS present and takes the user
	// id / role from the claims — never from the request body. The list and
	// delete endpoints are admin-only and mounted in the protected group below.
	r.Post("/api/auth/login-attempt", loginLogsHandler.RecordAttempt)

	// ── Protected: require valid JWT ─────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(cfg.JWTSecret))

		// File operations
		r.Post("/api/upload/avatar", fileHandler.UploadAvatar)
		r.Post("/api/upload/asset", fileHandler.UploadAsset)
		r.Post("/api/upload/music", fileHandler.UploadMusic)
		r.Delete("/api/files", fileHandler.DeleteFile)
		r.Get("/api/files/signed", fileHandler.SignedURL)

		// Auth — me endpoint (requires valid JWT)
		r.Get("/api/auth/me", authHandler.Me)
		r.Post("/api/auth/verify-password", authHandler.VerifyPassword)

		// Domains
		r.Mount("/api/santri", santriHandler.Routes())
		r.Mount("/api/guru", guruHandler.Routes())
		r.Mount("/api/classes", classesHandler.Routes())
		r.Mount("/api/attendance", attendanceHandler.Routes())
		r.Mount("/api/payments", paymentHandler.Routes())
		r.Mount("/api/academic", academicHandler.Routes())
		r.Mount("/api/mmq", mmqHandler.Routes())
		r.Mount("/api/config", configHandler.Routes())

		// Forum — authenticated only. The handler derives author identity from
		// the JWT, so it must sit inside this group; mounting it publicly would
		// leave posts with no verifiable author.
		r.Mount("/api/forum", forumHandler.Routes())

		// Gamification (leaderboard + points public config above, mutations here)
		r.Mount("/api/gamification", gamificationHandler.Routes())

		// Login activity log — admin only. The public POST recorder is
		// registered above, outside this group.
		r.Mount("/api/login-logs", loginLogsHandler.Routes())

		// WhatsApp per-jilid group links. Reads are admin+guru (guru opens
		// JilidChangeModal from GuruDashboard); writes are admin only.
		r.Mount("/api/whatsapp", whatsappHandler.Routes())

		// Media player — two separate top-level paths in the frontend adapter
		// (mediaPlayerAdapters.js), so they mount separately rather than under a
		// shared prefix.
		r.Mount("/api/music-files", mediaPlayerHandler.MusicRoutes())
		r.Mount("/api/media-player-settings", mediaPlayerHandler.SettingsRoutes())
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("server running on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down...")
	ctx2, cancel2 := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel2()
	if err := srv.Shutdown(ctx2); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := os.Getenv("CORS_ORIGIN")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
