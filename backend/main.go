package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"lpq-backend/internal/config"
	"lpq-backend/internal/db"
	"lpq-backend/internal/handler"
	"lpq-backend/internal/middleware"
	"lpq-backend/internal/storage"
	"lpq-backend/internal/wanotify"
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

	// Pekerja notifikasi WhatsApp hanya menyala bila token gateway di-set lewat
	// environment; tanpa token seluruh fitur WA diam dan aplikasi berperilaku
	// seperti sebelumnya.
	waClient := wanotify.NewClient(os.Getenv("WA_GATEWAY_URL"), os.Getenv("WA_GATEWAY_TOKEN"))
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	wanotify.StartWorker(workerCtx, pool, waClient)

	store := storage.New(cfg.UploadDir, cfg.JWTSecret, cfg.MaxUploadBytes)

	// Init all handlers
	authHandler := handler.NewAuthHandler(pool, cfg)
	fileHandler := handler.NewFileHandler(store, cfg)
	santriHandler := handler.NewSantriHandler(pool)
	guruHandler := handler.NewGuruHandler(pool)
	classesHandler := handler.NewClassesHandler(pool)
	attendanceHandler := handler.NewAttendanceHandler(pool)
	paymentHandler := handler.NewPaymentHandler(pool)
	contentHandler := handler.NewContentHandler(pool, store)
	configHandler := handler.NewAppConfigHandler(pool)
	academicHandler := handler.NewAcademicHandler(pool)
	scheduleHandler := handler.NewScheduleHandler(pool)
	nilaiHandler := handler.NewNilaiHandler(pool)
	raporHandler := handler.NewRaporHandler(pool)
	kelasKontenHandler := handler.NewKelasKontenHandler(pool)
	kontakWaliHandler := handler.NewKontakWaliHandler(pool)
	mmqHandler := handler.NewMMQHandler(pool)
	gamificationHandler := handler.NewGamificationHandler(pool)
	mediaPlayerHandler := handler.NewMediaPlayerHandler(pool)
	loginLogsHandler := handler.NewLoginLogsHandler(pool, cfg)
	whatsappHandler := handler.NewWhatsAppHandler(pool)
	ppdbHandler := handler.NewPpdbHandler(pool)
	backupHandler := handler.NewBackupHandler(pool)
	waNotifyHandler := handler.NewWaNotifyHandler(pool)
	suratHandler := handler.NewSuratHandler(pool)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(securityHeaders)
	r.Use(corsMiddleware)

	// ── Public: auth ─────────────────────────────────────────────────────────
	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)
	// ── Public: static file serving ──────────────────────────────────────────
	r.Get("/files/website-assets/*", fileHandler.ServePublic)
	r.Get("/files/music-files/*", fileHandler.ServePublic)
	r.Get("/files/avatars/*", fileHandler.ServePrivate)   // signed URL required
	r.Get("/files/documents/*", fileHandler.ServePrivate) // signed URL required

	// ── Public: counts (homepage stats) ──────────────────────────────────────
	r.Get("/api/santri/count", santriHandler.Count)
	r.Get("/api/guru/count", guruHandler.Count)
	r.Get("/api/classes/count", classesHandler.Count)

	// ── Public: kalender akademik (hanya event is_public = true) ─────────────
	// Situs sekolah menampilkan agenda/hari libur tanpa login. Endpoint ini
	// memfilter is_public sendiri, jadi aman di luar RequireAuth.
	r.Get("/api/public/calendar", attendanceHandler.PublicCalendar)

	// ── Public: website content (news, announcements, feedback) ──────────────
	// Admin write endpoints inside this handler check role themselves via
	// CanManage(RoleFromCtx(...)), so this mount needs OptionalAuth to put the
	// role in the context. Plain RequireAuth would lock out the public reads;
	// no middleware at all leaves the role empty and rejects admin too.
	// ponytail: no separate public gamification-config route — those keys
	// (gatcha_config, level_config, tv_config) are website_content rows already
	// readable via GET /api/content/website?keys=..., so a dedicated route is
	// redundant. Add one only if the payload shape needs to diverge.
	r.Group(func(r chi.Router) {
		r.Use(middleware.OptionalAuth(cfg.JWTSecret))
		r.Mount("/api/content", contentHandler.Routes())

		// PPDB: POST-nya formulir pendaftaran publik (orang tua tidak punya akun),
		// sisanya back-office. Alasan mount-nya sama dengan /api/content di atas —
		// tiap handler memeriksa perannya sendiri lewat CanManage.
		r.Mount("/api/ppdb", ppdbHandler.Routes())
	})

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
		r.Post("/api/upload/document", fileHandler.UploadDocument)
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
		r.Mount("/api/schedule", scheduleHandler.Routes())
		r.Mount("/api/nilai", nilaiHandler.Routes())
		r.Mount("/api/rapor", raporHandler.Routes())
		r.Mount("/api/kelas-konten", kelasKontenHandler.Routes())
		r.Mount("/api/kontak-wali", kontakWaliHandler.Routes())
		r.Mount("/api/mmq", mmqHandler.Routes())
		r.Mount("/api/config", configHandler.Routes())

		// Agenda surat keluar sekolah. Penomorannya ditentukan server; hak akses
		// diperiksa di dalam handler (admin + tata usaha menulis, kepala sekolah
		// membaca).
		r.Mount("/api/surat", suratHandler.Routes())

		/* Forum DICABUT atas keputusan pemilik.
		 *
		 * Halaman publiknya hilang saat pindah ke template SDN Baturaja, tetapi
		 * rute, handler, dan adapternya tetap hidup — sehingga setiap pemegang
		 * akun, termasuk murid, bisa membuat topik dan balasan lewat API padahal
		 * TIDAK ADA satu layar pun tempat isinya bisa dibaca, dimoderasi, atau
		 * dihapus.
		 *
		 * Tabel `forum_topics` dan `forum_replies` sengaja dibiarkan di basis
		 * data supaya tidak ada baris yang hilang; handler-nya masih ada di
		 * internal/handler/forum.go bila kelak dibutuhkan. Yang dicabut hanya
		 * pintunya. */

		// Gamification (leaderboard + points public config above, mutations here)
		r.Mount("/api/gamification", gamificationHandler.Routes())

		// Login activity log — admin only. The public POST recorder is
		// registered above, outside this group.
		r.Mount("/api/login-logs", loginLogsHandler.Routes())

		// WhatsApp per-jilid group links. Reads are admin+guru (guru opens
		// JilidChangeModal from GuruDashboard); writes are admin only.
		r.Mount("/api/whatsapp", whatsappHandler.Routes())
	r.Mount("/api/wa", waNotifyHandler.Routes())

		// Backup & restore — admin only (diperiksa di dalam handler).
		r.Mount("/api/backup", backupHandler.Routes())

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

/* securityHeaders memasang penjagaan sisi peramban pada SETIAP jawaban API.
 *
 * Sebelumnya tidak ada satu pun. Yang paling menentukan adalah nosniff: tanpa
 * itu peramban boleh mengabaikan Content-Type yang dikirim server dan menebak
 * sendiri dari isi berkas, sehingga penyaringan tipe di storage.go bisa
 * dilangkahi begitu saja.
 *
 * CSP di sini sengaja ketat sampai melarang segalanya. Yang dilayani proses ini
 * hanya JSON dan berkas media — tidak ada halaman HTML miliknya sendiri, tidak
 * ada skrip yang perlu jalan di alamatnya. Situsnya sendiri disajikan Caddy atau
 * Nginx dari `dist/`, dan CSP ini tidak menyentuhnya.
 *
 * X-Frame-Options DENY menutup peluang alamat API dipasang di dalam kerangka
 * situs orang lain. */
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy",
			"default-src 'none'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'none'")
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		next.ServeHTTP(w, r)
	})
}

// corsMiddleware allows one or more origins. CORS_ORIGIN accepts a
// comma-separated list so a dev machine can serve the frontend on a fallback
// port (Vite moves to 3001 when 3000 is taken) without the browser silently
// blocking every POST after a successful preflight.
func corsMiddleware(next http.Handler) http.Handler {
	allowed := func() []string {
		raw := strings.TrimSpace(os.Getenv("CORS_ORIGIN"))
		if raw == "" {
			return nil
		}
		parts := strings.Split(raw, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		return out
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := "*"
		if len(allowed) > 0 {
			reqOrigin := r.Header.Get("Origin")
			// Echo the caller's origin when it is on the allow-list; otherwise
			// fall back to the first entry so misconfigured callers get a clear
			// CORS failure rather than a wildcard that leaks the API.
			origin = allowed[0]
			for _, a := range allowed {
				if a == reqOrigin {
					origin = reqOrigin
					w.Header().Set("Vary", "Origin")
					break
				}
			}
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		// Tanpa baris ini browser menyembunyikan X-Total-Count dari JavaScript,
		// meski servernya mengirim. Setiap panel berhalaman lalu membaca total 0,
		// sehingga tombol "Berikutnya" mati dan baris di halaman kedua dan
		// seterusnya tidak pernah bisa dibuka.
		w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
