package handler

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

type GuruHandler struct {
	db *pgxpool.Pool
}

func NewGuruHandler(db *pgxpool.Pool) *GuruHandler {
	return &GuruHandler{db: db}
}

func (h *GuruHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public
	r.Get("/count", h.Count)

	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Get("/by-rfid/{rfid}", h.ByRFID)
	r.Get("/{id}", h.Detail)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Post("/change-category", h.ChangeCategory)

	return r
}

// guruSafeColumns lists every guru column EXCEPT password — used in SELECT to
// prevent bcrypt hashes from leaking to the client.
const guruSafeColumns = `g.id, g.nama, g.email, g.no_hp, g.alamat, g.foto_url,
	g.rfid_tag, g.jabatan, g.roles, g.is_notulen, g.jenis_kelamin,
	g.tanggal_lahir, g.status_guru, g.status, g.nuptk, g.created_at, g.updated_at,
	g.deleted_at, g.created_by, g.updated_by, g.avatar_path`

// Columns a client may set/update on guru.
var guruEditable = map[string]bool{
	"nama": true, "email": true, "no_hp": true, "alamat": true, "foto_url": true,
	"avatar_path": true, "rfid_tag": true, "jabatan": true, "roles": true,
	"is_notulen": true, "jenis_kelamin": true, "tanggal_lahir": true,
	"status_guru": true, "status": true, "password": true,
	// Panel Data Guru sudah lama punya field "NUPTK", tetapi menuliskannya ke
	// `nomor_induk_qiroati` — kolom yang tidak pernah ada pada tabel `guru`.
	// Allowlist ini menyaringnya habis, jadi apa pun yang diketik admin hilang
	// tanpa pesan dan kolomnya selamanya tampil "-". Kolom `nuptk` dibuat oleh
	// migrasi 20260815000500 dan sekarang benar-benar tersimpan.
	"nuptk": true,
}

// guruCreatable is guruEditable plus id, which Create supplies itself from the
// auth.users insert (clients never choose it).
var guruCreatable = func() map[string]bool {
	m := map[string]bool{"id": true}
	for k, v := range guruEditable {
		m[k] = v
	}
	return m
}()

// asString reads a JSON-decoded value as a string, returning "" for nil or any
// non-string type.
func asString(v any) string {
	s, _ := v.(string)
	return s
}

// hideSuperadmin reports whether guru rows belonging to a superadmin must be
// filtered out for this requester.
//
// Kenapa perlu: aplikasi ini template yang dijual. Akun superadmin adalah milik
// penjual dan ikut terkirim di setiap salinan, tapi pembeli tidak boleh
// mengetahuinya — kalau tampil di panel Guru, pembeli akan melihat "Pemilik
// Template" sebagai staf sekolahnya, bisa menonaktifkannya, dan tahu alamat
// email mana yang harus ditebak sandinya.
func hideSuperadmin(role string) bool {
	return role != middleware.RoleSuperadmin
}

// isSuperadminRow reports whether the guru id belongs to a superadmin profile.
func (h *GuruHandler) isSuperadminRow(ctx context.Context, id string) bool {
	var target string
	err := h.db.QueryRow(ctx,
		`SELECT COALESCE(role::text, '') FROM user_profiles WHERE id = $1`, id).Scan(&target)
	if err != nil {
		// Tidak ada profil berarti bukan superadmin; galat lain jangan sampai
		// membuka akses, jadi anggap tersembunyi.
		return !errors.Is(err, pgx.ErrNoRows)
	}
	return target == middleware.RoleSuperadmin
}

// GET /api/guru
func (h *GuruHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	if role == "" {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	limit, offset := paginate(r)

	rows, err := h.db.Query(ctx, `
		SELECT `+guruSafeColumns+` FROM guru g
		LEFT JOIN user_profiles up ON up.id = g.id
		WHERE g.status = 'active'
		  AND (NOT $3::boolean OR up.role IS NULL OR up.role <> 'superadmin')
		ORDER BY g.nama
		LIMIT $1 OFFSET $2
	`, limit, offset, hideSuperadmin(role))
	if err != nil {
		jsonError(w, "gagal mengambil data guru", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca data guru", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

// GET /api/guru/{id}
func (h *GuruHandler) Detail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	if !middleware.CanManage(role) && userID != id {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	// Baris superadmin tidak boleh terbaca pemakai lain, dan jawabannya 404 —
	// bukan 403 — supaya keberadaan akun itu sendiri tidak terungkap.
	if hideSuperadmin(role) && h.isSuperadminRow(ctx, id) {
		jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
		return
	}

	rows, err := h.db.Query(ctx, `SELECT `+guruSafeColumns+` FROM guru g WHERE g.id = $1`, id)
	if err != nil {
		jsonError(w, "gagal mengambil data guru", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectExactlyOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data guru", http.StatusInternalServerError)
		return
	}
	jsonData(w, item)
}

// PUT /api/guru/{id}
func (h *GuruHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	if !middleware.CanManage(role) && userID != id {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	if hideSuperadmin(role) && h.isSuperadminRow(ctx, id) {
		jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	// Non-admins cannot change sensitive fields.
	if !middleware.IsAdmin(role) {
		delete(body, "roles")
		delete(body, "status")
		delete(body, "status_guru")
		delete(body, "jabatan")
		delete(body, "password")
		delete(body, "email")
	}

	if err := hashPasswordField(body); err != nil {
		jsonError(w, "gagal memproses password", http.StatusInternalServerError)
		return
	}

	item, err := updateRow(ctx, h.db, "guru", id, body, guruEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal memperbarui guru: "+err.Error(), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

// POST /api/guru — creates the auth.users row, the user_profiles role row, and
// the guru profile in one transaction. Replaces the Supabase manage-user edge
// function: there is no separate auth service anymore, so the three inserts that
// used to span Supabase Auth + Postgres are now a single local transaction.
func (h *GuruHandler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.IsAdmin(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Role     string         `json:"role"`
		Password string         `json:"password"`
		Profile  map[string]any `json:"profile"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if body.Profile == nil {
		jsonError(w, "profil wajib diisi", http.StatusBadRequest)
		return
	}

	nama := strings.TrimSpace(asString(body.Profile["nama"]))
	if nama == "" {
		jsonError(w, "nama wajib diisi", http.StatusBadRequest)
		return
	}
	email := strings.ToLower(strings.TrimSpace(asString(body.Profile["email"])))
	if email == "" {
		jsonError(w, "email wajib diisi", http.StatusBadRequest)
		return
	}
	if !strings.Contains(email, "@") || !strings.Contains(email[strings.Index(email, "@"):], ".") {
		jsonError(w, "format email tidak valid", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Password) == "" {
		jsonError(w, "password awal wajib diisi", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 6 {
		jsonError(w, "password minimal 6 karakter", http.StatusBadRequest)
		return
	}

	profileRole := "guru"
	switch strings.ToLower(strings.TrimSpace(body.Role)) {
	case "pentashih":
		profileRole = "pentashih"
	case "admin":
		profileRole = "admin"
	case "tata_usaha":
		profileRole = "tata_usaha"
	case "guru", "":
		profileRole = "guru"
	default:
		jsonError(w, "role tidak valid", http.StatusBadRequest)
		return
	}

	profile := map[string]any{}
	for k, v := range body.Profile {
		profile[k] = v
	}
	profile["email"] = email
	profile["password"] = body.Password
	profile["status"] = "active"
	if err := hashPasswordField(profile); err != nil {
		jsonError(w, "gagal memproses password", http.StatusInternalServerError)
		return
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var newID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, email).Scan(&newID); err != nil {
		jsonError(w, "gagal membuat akun: "+err.Error(), http.StatusBadRequest)
		return
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO user_profiles (id, role, display_name, email, status)
		VALUES ($1, $2::public.app_role, $3, $4, 'active')
	`, newID, profileRole, nama, email); err != nil {
		jsonError(w, "gagal membuat profil akun: "+err.Error(), http.StatusBadRequest)
		return
	}

	profile["id"] = newID
	item, err := insertRowTx(ctx, tx, "guru", profile, guruCreatable)
	if err != nil {
		jsonError(w, "gagal membuat guru: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan data", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

// DELETE /api/guru/{id} — soft delete.
func (h *GuruHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	if !middleware.IsAdmin(role) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	// Pembeli tidak boleh menonaktifkan akun penjual, bahkan bila menebak id-nya.
	if hideSuperadmin(role) && h.isSuperadminRow(ctx, id) {
		jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
		return
	}
	ct, err := h.db.Exec(ctx, `UPDATE guru SET status = 'inactive' WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menonaktifkan guru", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "guru tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "status": "inactive"})
}

// GET /api/guru/count — public.
//
// Mengecualikan akun sistem (admin, superadmin) dengan syarat yang sama seperti
// direktori guru publik di content.go. Kalau tidak, angka "jumlah guru" di
// halaman depan tidak akan cocok dengan jumlah kartu guru yang tampil.
func (h *GuruHandler) Count(w http.ResponseWriter, r *http.Request) {
	var total int
	err := h.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM guru g
		LEFT JOIN user_profiles up ON up.id = g.id
		WHERE g.status = 'active'
		  AND g.deleted_at IS NULL
		  AND (up.role IS NULL OR up.role NOT IN ('admin', 'superadmin'))
	`).Scan(&total)
	if err != nil {
		jsonError(w, "gagal menghitung guru", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]int{"total": total})
}

// GET /api/guru/by-rfid/{rfid}
func (h *GuruHandler) ByRFID(w http.ResponseWriter, r *http.Request) {
	role := middleware.RoleFromCtx(r.Context())
	if role == "" {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rfid := chi.URLParam(r, "rfid")
	rows, err := h.db.Query(r.Context(), `
		SELECT `+guruSafeColumns+` FROM guru g
		LEFT JOIN user_profiles up ON up.id = g.id
		WHERE g.rfid_tag = $1 AND g.status = 'active'
		  AND (NOT $2::boolean OR up.role IS NULL OR up.role <> 'superadmin')
	`, rfid, hideSuperadmin(role))
	if err != nil {
		jsonError(w, "gagal mencari guru", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectExactlyOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "guru dengan rfid tersebut tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data guru", http.StatusInternalServerError)
		return
	}
	jsonData(w, item)
}

// normalizeSantriCategory maps the labels the UI sends (TPQ, anak, ptpt, …) onto
// the three values santri.kategori actually stores.
func normalizeSantriCategory(v string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(v)) {
	case "ANAK", "TPQ":
		return "Anak", true
	case "PTPT":
		return "PTPT", true
	case "DEWASA":
		return "Dewasa", true
	default:
		return "", false
	}
}

// POST /api/guru/change-category — move a santri between TPQ/PTPT/Dewasa.
// Port of the change_santri_category plpgsql RPC: switching category also pulls
// the santri out of their current class, so the active membership is closed as
// 'moved' and the exit is recorded in class_mutations. Doing it in one tx keeps
// santri.kategori, the membership row, and the audit trail from drifting apart.
// The RPC read the actor from auth.uid(); here it comes from the JWT.
func (h *GuruHandler) ChangeCategory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	actor := middleware.UserIDFromCtx(ctx)

	var body struct {
		SantriID    string `json:"santri_id"`
		NewCategory string `json:"new_category"`
		Reason      string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if body.SantriID == "" {
		jsonError(w, "santri_id wajib diisi", http.StatusBadRequest)
		return
	}
	target, ok := normalizeSantriCategory(body.NewCategory)
	if !ok {
		jsonError(w, "kategori tujuan harus TPQ, PTPT, atau Dewasa", http.StatusBadRequest)
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" {
		reason = "Migrasi kategori santri"
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Lock the row so two concurrent migrations can't both read the old category.
	var nama string
	var currentCategory, currentClassID *string
	if err := tx.QueryRow(ctx, `
		SELECT nama_lengkap, kategori, current_class_id
		FROM santri WHERE id = $1 FOR UPDATE
	`, body.SantriID).Scan(&nama, &currentCategory, &currentClassID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data santri", http.StatusInternalServerError)
		return
	}

	normalizedCurrent, _ := normalizeSantriCategory(derefString(currentCategory))
	if normalizedCurrent == target {
		jsonData(w, map[string]any{
			"santri_id":     body.SantriID,
			"from_category": derefString(currentCategory),
			"to_category":   target,
			"changed":       false,
			"message":       nama + " sudah berada pada kategori " + target + ".",
		})
		return
	}

	// Prefer the active membership's class; fall back to the denormalized column.
	var fromClassID *string
	if err := tx.QueryRow(ctx, `
		SELECT class_id FROM class_memberships
		WHERE santri_id = $1 AND status = 'active'
		ORDER BY created_at DESC LIMIT 1
	`, body.SantriID).Scan(&fromClassID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, "gagal membaca keanggotaan kelas", http.StatusInternalServerError)
		return
	}
	if fromClassID == nil {
		fromClassID = currentClassID
	}

	if _, err := tx.Exec(ctx, `
		UPDATE class_memberships
		SET status = 'moved', end_date = current_date, updated_by = $2
		WHERE santri_id = $1 AND status = 'active'
	`, body.SantriID, actor); err != nil {
		jsonError(w, "gagal menutup keanggotaan kelas", http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(ctx, `
		UPDATE santri
		SET kategori = $2, current_class_id = NULL, order_in_class = NULL, updated_by = $3
		WHERE id = $1
	`, body.SantriID, target, actor); err != nil {
		jsonError(w, "gagal mengubah kategori santri", http.StatusInternalServerError)
		return
	}

	var mutationID *string
	if fromClassID != nil {
		var id string
		if err := tx.QueryRow(ctx, `
			INSERT INTO class_mutations (santri_id, from_class_id, to_class_id, reason, created_by)
			VALUES ($1, $2, NULL, $3, $4) RETURNING id
		`, body.SantriID, *fromClassID, reason, actor).Scan(&id); err != nil {
			jsonError(w, "gagal mencatat mutasi kelas", http.StatusInternalServerError)
			return
		}
		mutationID = &id
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan perubahan kategori", http.StatusInternalServerError)
		return
	}

	jsonData(w, map[string]any{
		"santri_id":     body.SantriID,
		"from_category": derefString(currentCategory),
		"to_category":   target,
		"from_class_id": fromClassID,
		"mutation_id":   mutationID,
		"changed":       true,
		"message":       nama + " berhasil dipindahkan ke kategori " + target + ".",
	})
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// insertJilidHistory records a jilid change. changed_by must be the current user's id.
// Shared by santri and guru handlers.
func insertJilidHistory(ctx context.Context, q querier, santriID string, fromJilid *string, toJilid, changedBy string) error {
	rows, err := q.Query(ctx, `
		INSERT INTO jilid_history (santri_id, from_jilid, to_jilid, changed_by, changed_at)
		VALUES ($1, $2, $3, $4, now())
		RETURNING id
	`, santriID, fromJilid, toJilid, changedBy)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
	}
	return rows.Err()
}

func insertJilidHistoryTx(ctx context.Context, tx pgx.Tx, santriID string, fromJilid *string, toJilid, changedBy string) error {
	return insertJilidHistory(ctx, tx, santriID, fromJilid, toJilid, changedBy)
}

// randomPassword membuat sandi awal acak untuk guru yang diimpor tanpa
// kolom password. Panjang 8 karakter alfanumerik — cukup untuk akun pertama,
// wajib diganti guru sendiri setelah masuk.
func randomPassword(n int) (string, error) {
	const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
	buf := make([]byte, n)
	for i := range buf {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		buf[i] = charset[idx.Int64()]
	}
	return string(buf), nil
}

// POST /api/guru/bulk — impor massal guru dari hasil parse Excel frontend.
//
// Satu savepoint per baris: baris yang rusak dilaporkan lalu dilewati, bukan
// menggagalkan seluruh berkas. Password kosong diganti acak dan dikembalikan
// sekali di respons supaya bisa dibagikan ke guru bersangkutan.
func (h *GuruHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		Rows []struct {
			Nama         string `json:"nama"`
			Email        string `json:"email"`
			Password     string `json:"password"`
			Role         string `json:"role"`
			Jabatan      string `json:"jabatan"`
			NoHp         string `json:"no_hp"`
			JenisKelamin string `json:"jenis_kelamin"`
		} `json:"rows"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<20)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if len(body.Rows) == 0 {
		jsonError(w, "data kosong", http.StatusBadRequest)
		return
	}
	if len(body.Rows) > 1000 {
		jsonError(w, "maksimal 1000 baris per permintaan", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	type failedRow struct {
		Index int    `json:"index"`
		Email string `json:"email"`
		Error string `json:"error"`
	}
	type insertedRow struct {
		Item         map[string]any `json:"item"`
		PasswordAwal string         `json:"password_awal,omitempty"`
	}
	inserted := []insertedRow{}
	failed := []failedRow{}

	for i, row := range body.Rows {
		sp := fmt.Sprintf("bulk_guru_%d", i)
		if _, err := tx.Exec(ctx, "SAVEPOINT "+sp); err != nil {
			jsonError(w, "gagal menyiapkan simpanan baris", http.StatusInternalServerError)
			return
		}

		fail := func(msg string) {
			_, _ = tx.Exec(ctx, "ROLLBACK TO SAVEPOINT "+sp)
			failed = append(failed, failedRow{Index: i, Email: strings.TrimSpace(row.Email), Error: msg})
		}

		nama := strings.TrimSpace(row.Nama)
		email := strings.ToLower(strings.TrimSpace(row.Email))
		if nama == "" || email == "" || !strings.Contains(email, "@") || !strings.Contains(email[strings.Index(email, "@"):], ".") {
			fail("nama dan email wajib diisi dengan format yang benar")
			continue
		}

		password := strings.TrimSpace(row.Password)
		autoPassword := ""
		if password == "" {
			password, err = randomPassword(8)
			if err != nil {
				fail("gagal membuat password acak")
				continue
			}
			autoPassword = password
		}
		if len(password) < 6 {
			fail("password minimal 6 karakter")
			continue
		}

		profileRole := "guru"
		switch strings.ToLower(strings.TrimSpace(row.Role)) {
		case "pentashih":
			profileRole = "pentashih"
		case "admin":
			profileRole = "admin"
		case "tata_usaha":
			profileRole = "tata_usaha"
		case "guru", "":
			profileRole = "guru"
		default:
			fail("role tidak valid (guru/pentashih/tata_usaha/admin)")
			continue
		}

		profile := map[string]any{
			"nama": nama, "email": email, "password": password, "status": "active",
		}
		if j := strings.TrimSpace(row.Jabatan); j != "" {
			profile["jabatan"] = j
		}
		if hp := strings.TrimSpace(row.NoHp); hp != "" {
			profile["no_hp"] = hp
		}
		if jk := strings.TrimSpace(row.JenisKelamin); jk != "" {
			profile["jenis_kelamin"] = jk
		}
		if err := hashPasswordField(profile); err != nil {
			fail("gagal memproses password")
			continue
		}

		var newID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, email,
		).Scan(&newID); err != nil {
			msg := err.Error()
			if strings.Contains(msg, "duplicate key") {
				msg = "email sudah terdaftar"
			}
			fail(msg)
			continue
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO user_profiles (id, role, display_name, email, status)
			VALUES ($1, $2::public.app_role, $3, $4, 'active')
		`, newID, profileRole, nama, email); err != nil {
			fail("gagal membuat profil akun: " + err.Error())
			continue
		}

		profile["id"] = newID
		item, err := insertRowTx(ctx, tx, "guru", profile, guruCreatable)
		if err != nil {
			fail("gagal menyimpan guru: " + err.Error())
			continue
		}
		_, _ = tx.Exec(ctx, "RELEASE SAVEPOINT "+sp)
		inserted = append(inserted, insertedRow{Item: item, PasswordAwal: autoPassword})
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan data", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, map[string]any{"inserted": inserted, "failed": failed})
}
