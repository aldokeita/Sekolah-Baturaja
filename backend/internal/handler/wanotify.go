package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

// WaNotifyHandler mengelola antrean notifikasi WhatsApp untuk admin:
// melihat log pengiriman, mengulang pesan gagal, menguji gateway, dan
// broadcast pengumuman ke daftar nomor yang dipilih frontend.
//
// Semua endpoint admin-only. Pengiriman sesungguhnya dikerjakan pekerja
// latar belakang di internal/wanotify; handler di sini hanya menulis ke
// wa_outbox sehingga responsnya cepat dan gateway yang mati tidak ikut
// menggagalkan permintaan admin.
type WaNotifyHandler struct {
	db *pgxpool.Pool
}

func NewWaNotifyHandler(db *pgxpool.Pool) *WaNotifyHandler {
	return &WaNotifyHandler{db: db}
}

func (h *WaNotifyHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Statik sebelum param: /test dan /broadcast tidak boleh tertelan /{id}.
	r.Post("/test", h.TestSend)
	r.Post("/broadcast", h.Broadcast)
	r.Post("/{id}/retry", h.Retry)
	r.Get("/", h.List)

	return r
}

const waOutboxColumns = `id, purpose, ref_id, santri_id::text, target_phone, message,
	       status, attempts, last_error, sent_at::text, created_at::text`

// List GET /api/wa?status=&search=&page=&limit= (admin only)
func (h *WaNotifyHandler) List(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	limit, offset := paginate(r)
	query := "SELECT " + waOutboxColumns + " FROM wa_outbox"
	args := []any{}

	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" WHERE status = $%d", len(args))
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		args = append(args, "%"+search+"%")
		if len(args) == 1 {
			query += " WHERE target_phone ILIKE $1 OR message ILIKE $1"
		} else {
			query += fmt.Sprintf(" AND (target_phone ILIKE $%[1]d OR message ILIKE $%[1]d)", len(args))
		}
	}

	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "gagal mengambil log notifikasi", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca log notifikasi", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

// Retry POST /api/wa/{id}/retry (admin only)
// Mengembalikan pesan gagal/perlu-kirim ke antrean: attempts di-nol-kan agar
// mendapat lima percobaan baru dengan jeda backoff dari awal.
func (h *WaNotifyHandler) Retry(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		jsonError(w, "id wajib diisi", http.StatusBadRequest)
		return
	}

	ct, err := h.db.Exec(r.Context(), `
		UPDATE wa_outbox
		   SET status = 'pending', attempts = 0,
		       next_attempt_at = now(), last_error = NULL
		 WHERE id = $1 AND status <> 'sent'
	`, id)
	if err != nil {
		jsonError(w, "gagal menjadwalkan ulang pesan", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "pesan tidak ditemukan atau sudah terkirim", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{"id": id, "status": "pending"}})
}

// TestSend POST /api/wa/test (admin only)
// Body: {target, message} — kirim satu pesan uji ke nomor sendiri sebelum
// dipakai sungguhan, supaya salah token/nomor ketahuan tanpa menyentuh murid.
func (h *WaNotifyHandler) TestSend(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		Target  string `json:"target"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Target) == "" || strings.TrimSpace(body.Message) == "" {
		jsonError(w, "target dan message wajib diisi", http.StatusBadRequest)
		return
	}

	ref := fmt.Sprintf("test-%d", time.Now().UnixNano())
	if _, err := h.db.Exec(r.Context(), `
		INSERT INTO wa_outbox (purpose, ref_id, target_phone, message, created_by)
		VALUES ('test', $1, $2, $3, $4)
	`, ref, strings.TrimSpace(body.Target), body.Message, actorID(r)); err != nil {
		jsonError(w, "gagal mengantre pesan uji", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, map[string]any{"recorded": true, "ref_id": ref})
}

// Broadcast POST /api/wa/broadcast (admin only)
// Body: {recipients:[{nama,no_hp}], message} — penerima diselesaikan oleh
// frontend dari panel data yang sudah ada (kelas/ekskul), backend hanya
// menerima daftar jadi. Batas 500 penerima per permintaan menjaga durasi.
func (h *WaNotifyHandler) Broadcast(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		Recipients []struct {
			Nama string `json:"nama"`
			NoHp string `json:"no_hp"`
		} `json:"recipients"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Message) == "" {
		jsonError(w, "message wajib diisi", http.StatusBadRequest)
		return
	}
	if len(body.Recipients) == 0 {
		jsonError(w, "recipients kosong", http.StatusBadRequest)
		return
	}
	if len(body.Recipients) > 500 {
		jsonError(w, "maksimal 500 penerima per permintaan", http.StatusBadRequest)
		return
	}

	stamp := time.Now().UnixNano()
	queued := 0
	for i, rcpt := range body.Recipients {
		phone := strings.TrimSpace(rcpt.NoHp)
		if phone == "" {
			continue // lewati senyap: baris data tanpa nomor bukan kegagalan
		}
		ref := fmt.Sprintf("bc-%d-%d", stamp, i)
		if _, err := h.db.Exec(r.Context(), `
			INSERT INTO wa_outbox (purpose, ref_id, target_phone, message, created_by)
			VALUES ('broadcast', $1, $2, $3, $4)
		`, ref, phone, body.Message, actorID(r)); err != nil {
			jsonError(w, fmt.Sprintf("gagal mengantre pesan untuk %s", rcpt.Nama), http.StatusInternalServerError)
			return
		}
		queued++
	}
	jsonCreated(w, map[string]any{"queued": queued})
}
