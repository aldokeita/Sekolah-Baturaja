package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"lpq-backend/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BackupHandler menangani backup/restore database (admin saja).
type BackupHandler struct {
	db *pgxpool.Pool
}

func NewBackupHandler(db *pgxpool.Pool) *BackupHandler {
	return &BackupHandler{db: db}
}

func (h *BackupHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/table/{name}", h.BackupTable)
	r.Post("/restore", h.RestoreTable)
	return r
}

// backupConflictCol memetakan nama tabel ke kolom PK-nya.
// Juga berfungsi sebagai allowlist — tabel di luar map ini ditolak.
var backupConflictCol = map[string]string{
	"guru":                             "id",
	"classes":                          "id",
	"santri":                           "id",
	"class_memberships":                "id",
	"class_mutations":                  "id",
	"jilid_history":                    "id",
	"attendance":                       "id",
	"academic_calendar":                "id",
	"academic_calendar_month_settings": "id",
	"payments":                         "id",
	"expenses":                         "id",
	"website_content":                  "key",
	"login_logs":                       "id",
}

// validColPattern: hanya nama kolom yang aman untuk disisiplan ke SQL.
var validColPattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// BackupTable GET /api/backup/table/{name}
// Mengembalikan seluruh isi tabel sebagai array JSON (admin only).
// row_to_json mengonversi UUID, timestamptz, dan jsonb secara native di sisi
// Postgres — tidak perlu konversi tipe di Go.
func (h *BackupHandler) BackupTable(w http.ResponseWriter, r *http.Request) {
	role := middleware.RoleFromCtx(r.Context())
	if !middleware.IsAdmin(role) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	name := chi.URLParam(r, "name")
	if _, ok := backupConflictCol[name]; !ok {
		jsonError(w, "tabel tidak diizinkan", http.StatusBadRequest)
		return
	}

	rows, err := h.db.Query(
		r.Context(),
		fmt.Sprintf(`SELECT row_to_json(t.*) FROM (SELECT * FROM %s) t`, name),
	)
	if err != nil {
		jsonError(w, "gagal membaca tabel", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	result := make([]json.RawMessage, 0)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			jsonError(w, "gagal membaca baris", http.StatusInternalServerError)
			return
		}
		result = append(result, json.RawMessage(raw))
	}
	if err := rows.Err(); err != nil {
		jsonError(w, "gagal iterasi baris", http.StatusInternalServerError)
		return
	}

	jsonOK(w, result)
}

// RestoreTable POST /api/backup/restore
// Upsert satu batch baris ke satu tabel (admin only).
// Body: {"table": "santri", "rows": [...]}
// Tiap baris diproses satu per satu; baris yang gagal dilewati agar tabel
// lain tetap dapat dipulihkan.
func (h *BackupHandler) RestoreTable(w http.ResponseWriter, r *http.Request) {
	role := middleware.RoleFromCtx(r.Context())
	if !middleware.IsAdmin(role) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Table string           `json:"table"`
		Rows  []map[string]any `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "body tidak valid", http.StatusBadRequest)
		return
	}

	conflictCol, ok := backupConflictCol[body.Table]
	if !ok {
		jsonError(w, "tabel tidak diizinkan", http.StatusBadRequest)
		return
	}
	if len(body.Rows) == 0 {
		jsonOK(w, map[string]any{"restored": 0, "skipped": 0})
		return
	}

	restored, skipped := 0, 0
	var firstErr string

	for _, row := range body.Rows {
		if err := upsertBackupRow(r.Context(), h.db, body.Table, conflictCol, row); err != nil {
			skipped++
			if firstErr == "" {
				firstErr = err.Error()
			}
			continue
		}
		restored++
	}

	resp := map[string]any{"restored": restored, "skipped": skipped}
	if firstErr != "" {
		resp["first_error"] = firstErr
	}
	jsonOK(w, resp)
}

// upsertBackupRow membangun dan menjalankan INSERT ... ON CONFLICT DO UPDATE
// secara dinamis berdasarkan kunci yang ada di `row`.
func upsertBackupRow(ctx context.Context, db *pgxpool.Pool, table, conflictCol string, row map[string]any) error {
	if len(row) == 0 {
		return nil
	}

	// Urutkan untuk menghasilkan SQL yang deterministik (mudah di-log).
	keys := make([]string, 0, len(row))
	for k := range row {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	cols := make([]string, 0, len(keys))
	vals := make([]any, 0, len(keys))
	placeholders := make([]string, 0, len(keys))
	updates := make([]string, 0, len(keys))

	for i, k := range keys {
		if !validColPattern.MatchString(k) {
			return fmt.Errorf("nama kolom tidak valid: %q", k)
		}
		cols = append(cols, `"`+k+`"`)
		vals = append(vals, prepareBackupValue(row[k]))
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		if k != conflictCol {
			updates = append(updates, fmt.Sprintf(`"%s" = EXCLUDED."%s"`, k, k))
		}
	}

	var sql string
	if len(updates) > 0 {
		sql = fmt.Sprintf(
			`INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (%s) DO UPDATE SET %s`,
			table,
			strings.Join(cols, ", "),
			strings.Join(placeholders, ", "),
			conflictCol,
			strings.Join(updates, ", "),
		)
	} else {
		sql = fmt.Sprintf(
			`INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (%s) DO NOTHING`,
			table,
			strings.Join(cols, ", "),
			strings.Join(placeholders, ", "),
			conflictCol,
		)
	}

	_, err := db.Exec(ctx, sql, vals...)
	return err
}

// prepareBackupValue mengonversi nilai dari JSON decode ke bentuk yang bisa
// diterima pgx. Khusus map dan slice (JSONB): di-marshal kembali ke JSON string
// supaya Postgres bisa meng-upsert kolom jsonb.
func prepareBackupValue(v any) any {
	switch v.(type) {
	case map[string]any, []any:
		b, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		return string(b)
	default:
		return v
	}
}
