package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/auth"
	"lpq-backend/internal/middleware"
)

type SantriHandler struct {
	db *pgxpool.Pool
}

func NewSantriHandler(db *pgxpool.Pool) *SantriHandler {
	return &SantriHandler{db: db}
}

func (h *SantriHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public
	r.Get("/count", h.Count)

	r.Get("/", h.List)
	// by-rfid before /{id} so "by-rfid" is not read as an id.
	r.Get("/by-rfid/{rfid}", h.ByRFID)
	// classmates before /{id} for the same reason.
	r.Get("/classmates", h.Classmates)
	r.Get("/{id}", h.Detail)
	r.Post("/", h.Create)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Post("/bulk", h.BulkCreate)
	r.Put("/{id}/jilid", h.UpdateJilid)
	r.Put("/{id}/order", h.UpdateOrder)
	r.Post("/move-class", h.MoveClass)
	r.Post("/promote-class", h.PromoteClass)
	r.Get("/promotion-runs", h.PromotionRuns)
	r.Post("/{id}/archive", h.Archive)
	r.Post("/{id}/restore", h.Restore)
	r.Get("/{id}/transfer-destinations", h.TransferDestinations)

	return r
}

// Columns a client may set on create.
var santriInsertable = map[string]bool{
	"nomor_induk": true, "nama_lengkap": true, "nama_panggilan": true,
	"kategori": true, "jenis_kelamin": true, "tanggal_lahir": true, "tempat_lahir": true,
	"alamat": true, "no_hp_ortu": true, "foto_url": true, "avatar_path": true,
	"rfid_tag": true, "current_class_id": true, "sesi_mengaji": true, "jilid": true,
	"tanggal_pendaftaran": true, "nama_ayah": true, "nama_ibu": true, "no_kk": true,
	"no_nik": true, "berkas_foto": true, "berkas_akta": true, "berkas_kk": true,
	"berkas_form": true, "link_qiroati": true, "default_spp_amount": true,
	"pekerjaan_ayah": true, "pekerjaan_ibu": true, "alamat_ortu": true,
	"nisn": true, "nis": true, "angkatan": true,
	"status": true, "points": true, "order_in_class": true, "password": true,
	"email": true,
}

// santriCreatable is santriInsertable plus id, which insertSantriTx sets itself
// from the freshly created auth.users row. id stays out of santriInsertable so
// the shared Update path can never rewrite a primary key.
var santriCreatable = func() map[string]bool {
	m := make(map[string]bool, len(santriInsertable)+1)
	for k, v := range santriInsertable {
		m[k] = v
	}
	m["id"] = true
	return m
}()

// Fields a santri may edit on their own record.
// Di tingkat paket, bukan di dalam handler: pola ini tetap dan tidak perlu
// dikompilasi ulang setiap permintaan masuk.
var tahunAjaranPattern = regexp.MustCompile(`^[0-9]{4}/[0-9]{4}$`)

var santriSelfEditable = map[string]bool{
	"nama_panggilan": true, "no_hp_ortu": true, "alamat": true,
}

// GET /api/santri
func (h *SantriHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	limit, offset := paginate(r)

	where := []string{}
	args := []any{}
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if status := r.URL.Query().Get("status"); status != "" {
		add("s.status = $%d", status)
	}
	if kategori := r.URL.Query().Get("kategori"); kategori != "" {
		add("s.kategori ILIKE $%d", kategori)
	}
	// kategori_in accepts a comma list and matches case-insensitively, which is
	// what the santri tabs need ("Anak,TPQ" and friends live in the data as
	// mixed case).
	if list := strings.TrimSpace(r.URL.Query().Get("kategori_in")); list != "" {
		add("lower(s.kategori) = ANY($%d)", lowerAll(strings.Split(list, ",")))
	}
	if jilid := r.URL.Query().Get("jilid"); jilid != "" {
		add("s.jilid = $%d", jilid)
	}
	switch r.URL.Query().Get("rfid") {
	case "assigned":
		where = append(where, "(s.rfid_tag IS NOT NULL AND s.rfid_tag <> '')")
	case "unassigned":
		where = append(where, "(s.rfid_tag IS NULL OR s.rfid_tag = '')")
	}
	if excl := r.URL.Query().Get("exclude_kategori"); excl != "" {
		add("(s.kategori IS NULL OR s.kategori <> $%d)", excl)
	}
	if classID := r.URL.Query().Get("class_id"); classID != "" {
		add("s.current_class_id = $%d", classID)
	}
	if ids := strings.TrimSpace(r.URL.Query().Get("class_ids")); ids != "" {
		add("s.current_class_id = ANY($%d)", strings.Split(ids, ","))
	}
	if sesi := strings.TrimSpace(r.URL.Query().Get("sesi")); sesi != "" {
		add("s.sesi_mengaji = ANY($%d)", strings.Split(sesi, ","))
	}
	if r.URL.Query().Get("active_only") == "true" {
		where = append(where,
			"(s.status IS NULL OR s.status ILIKE 'aktif' OR s.status ILIKE 'active')")
	}
	// Archived santri keep their row with deleted_at set. They stay hidden unless
	// the caller opts in, so the archive dialog is the only screen that sees them.
	if r.URL.Query().Get("not_deleted") == "true" ||
		r.URL.Query().Get("include_archived") != "true" {
		where = append(where, "s.deleted_at IS NULL")
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		args = append(args, "%"+search+"%")
		i := len(args)
		where = append(where, fmt.Sprintf(
			"(s.nama_lengkap ILIKE $%d OR s.nisn ILIKE $%d OR s.nis ILIKE $%d OR s.nomor_induk ILIKE $%d "+
				"OR s.nama_panggilan ILIKE $%d OR s.nama_ayah ILIKE $%d "+
				"OR s.rfid_tag ILIKE $%d)", i, i, i, i, i, i, i))
	}

	/* Authz scoping.
	 *
	 * Cabang akses-penuh memakai CanManage, BUKAN daftar peran yang ditulis satu
	 * per satu. Daftar manual di sini dulu hanya memuat "admin", sehingga
	 * `tata_usaha` dan `superadmin` jatuh ke `default` dan menerima 403 — padahal
	 * Data Murid justru pekerjaan utama tata usaha, dan tabnya tetap ditampilkan
	 * kepada mereka. Keduanya ditambahkan migrasi yang lebih baru dan switch ini
	 * tidak pernah ikut diperbarui.
	 *
	 * Dengan CanManage, peran pengelola baru tidak bisa lagi terkunci diam-diam. */
	switch {
	case middleware.CanManage(role):
		// admin, superadmin, tata_usaha — akses penuh
	case role == "pentashih":
		// Pentashih review santri lintas kelas, jadi aksesnya baca-penuh —
		// sama dengan policy santri_pentashih_select di migrasi
		// 20260725000100_pentashih_full_read_access_rls.sql.
	case role == "guru":
		// Dua jalur sah seorang guru sampai ke satu murid: menjadi wali kelasnya,
		// atau mengajar di kelasnya menurut `jadwal_pelajaran`. Sebelumnya hanya
		// jalur wali kelas yang dihitung, sehingga guru mata pelajaran dapat
		// menilai dan memberi materi untuk sebuah kelas tetapi tidak dapat membuka
		// data muridnya sendiri — daftar kelasnya tampil kosong.
		//
		// Ini melebarkan hak BACA saja. Penyuntingan data master murid tetap milik
		// admin; lihat pemeriksaan terpisah pada Update dan MoveClass.
		args = append(args, userID)
		i := len(args)
		where = append(where, fmt.Sprintf(
			"(s.current_class_id IN (SELECT id FROM classes WHERE id_guru = $%d) "+
				"OR s.current_class_id IN (SELECT class_id FROM jadwal_pelajaran WHERE guru_id = $%d) "+
				"OR s.id IN (SELECT cm.santri_id FROM class_memberships cm "+
				"WHERE cm.status = 'active' AND ("+
				"cm.class_id IN (SELECT id FROM classes WHERE id_guru = $%d) "+
				"OR cm.class_id IN (SELECT class_id FROM jadwal_pelajaran WHERE guru_id = $%d))))",
			i, i, i, i))
	case role == "santri":
		add("s.id = $%d", userID)
	default:
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	// Total row count for the same filters, so the client can paginate.
	var total int
	if err := h.db.QueryRow(ctx,
		"SELECT count(*) FROM santri s"+whereSQL, args...).Scan(&total); err != nil {
		jsonError(w, "gagal menghitung data santri", http.StatusInternalServerError)
		return
	}

	// Sort column comes from a whitelist — never interpolate a raw query value
	// into ORDER BY.
	orderBy := " ORDER BY s.order_in_class NULLS LAST, s.nama_lengkap"
	switch r.URL.Query().Get("order") {
	case "nama":
		orderBy = " ORDER BY s.nama_lengkap"
	case "nama_lengkap", "tanggal_pendaftaran", "jenis_kelamin", "jilid", "sesi_mengaji", "points":
		dir := "ASC"
		if strings.EqualFold(r.URL.Query().Get("direction"), "desc") {
			dir = "DESC"
		}
		orderBy = fmt.Sprintf(" ORDER BY s.%s %s NULLS LAST",
			r.URL.Query().Get("order"), dir)
	}
	query := "SELECT s.* FROM santri s" + whereSQL + orderBy
	args = append(args, limit, offset)
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		jsonError(w, "gagal mengambil data santri", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca data santri", http.StatusInternalServerError)
		return
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonData(w, items)
}

/* GET /api/santri/classmates
 *
 * Daftar teman sekelas milik murid yang sedang masuk, beserta status kehadiran
 * hari ini. Endpoint terpisah karena GET /api/santri memang mengunci seorang
 * murid pada barisnya sendiri (lihat cabang `role == "santri"` di List) — dan
 * pengunciannya benar: baris santri lengkap memuat alamat, nomor telepon orang
 * tua, dan tarif SPP, yang tidak boleh terbaca teman sekelasnya.
 *
 * Jadi yang dikembalikan di sini hanya kolom yang memang tampil di panel
 * "Teman Sekelas & Kehadiran Hari Ini": nama, foto, tingkat mengaji, dan status
 * hari ini. `nama_panggilan` sengaja TIDAK dikirim — itu username login murid.
 */
func (h *SantriHandler) Classmates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	if role != "santri" || userID == "" {
		// Peran pengelola sudah punya roster penuh lewat List; tidak perlu jalur
		// kedua yang harus dijaga terpisah.
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var classID *string
	err := h.db.QueryRow(ctx,
		`SELECT current_class_id::text FROM santri WHERE id = $1`, userID).Scan(&classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca kelas murid", http.StatusInternalServerError)
		return
	}
	if classID == nil || *classID == "" {
		// Belum ditempatkan di kelas mana pun — bukan error, memang belum ada teman.
		jsonData(w, []any{})
		return
	}

	/* DISTINCT ON: satu murid bisa punya beberapa baris absensi dalam sehari,
	 * satu per mata pelajaran. Yang dipakai adalah check-in paling awal, sehingga
	 * statusnya "Terlambat" ketika ia memang datang terlambat pagi itu, bukan
	 * "Hadir" karena jam pelajaran berikutnya tercatat lagi.
	 *
	 * Rosternya dibaca dari current_class_id MAUPUN class_memberships aktif, sama
	 * seperti pemeriksaan hak akses guru di List — keduanya dipakai di kode ini. */
	rows, err := h.db.Query(ctx, `
		SELECT * FROM (
			SELECT DISTINCT ON (s.id)
			       s.id::text AS id,
			       s.nama_lengkap,
			       s.avatar_path,
			       s.foto_url,
			       s.jilid,
			       s.order_in_class,
			       a.status AS status_hari_ini
			FROM santri s
			LEFT JOIN attendance a
			       ON a.user_id = s.id AND a.attendance_date = CURRENT_DATE
			WHERE s.deleted_at IS NULL
			  AND (s.status IS NULL OR s.status ILIKE 'aktif' OR s.status ILIKE 'active')
			  AND (s.current_class_id = $1
			       OR s.id IN (SELECT santri_id FROM class_memberships
			                   WHERE class_id = $1 AND status = 'active'))
			ORDER BY s.id, a.check_in_timestamp NULLS LAST
		) t
		ORDER BY t.order_in_class NULLS LAST, t.nama_lengkap
	`, *classID)
	if err != nil {
		jsonError(w, "gagal mengambil teman sekelas", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca teman sekelas", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

// GET /api/santri/{id}
func (h *SantriHandler) Detail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	if role == "santri" && userID != id {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	/* `class_start_date` adalah tanggal murid masuk kelas yang sekarang. Kolomnya
	 * sudah lama ditulis saat mutasi, tapi tidak pernah dikembalikan ke mana pun,
	 * sehingga rekap kehadiran tidak punya cara mengetahui sejak kapan murid itu
	 * ada di kelasnya. Akibatnya rekap menyisir sebulan penuh dan menghitung
	 * setiap hari sebelum murid tiba sebagai tidak hadir — murid pindahan langsung
	 * terbaca bolos hampir sebulan.
	 *
	 * Diambil dari keanggotaan yang berstatus aktif, bukan yang paling awal:
	 * pemilik template memutuskan rekap dihitung sejak tanggal PINDAH, bukan sejak
	 * pertama kali murid masuk sekolah. */
	rows, err := h.db.Query(ctx, `
		SELECT s.*,
		       c.id AS class_id, c.nama_kelas AS class_nama, c.sesi AS class_sesi,
		       c.kategori AS class_kategori, c.id_guru AS class_id_guru,
		       g.nama AS class_guru_nama,
		       cm.start_date AS class_start_date
		FROM santri s
		LEFT JOIN classes c ON c.id = s.current_class_id
		LEFT JOIN guru g ON g.id = c.id_guru
		LEFT JOIN LATERAL (
			SELECT start_date
			FROM class_memberships
			WHERE santri_id = s.id AND class_id = s.current_class_id AND status = 'active'
			ORDER BY start_date DESC
			LIMIT 1
		) cm ON TRUE
		WHERE s.id = $1
	`, id)
	if err != nil {
		jsonError(w, "gagal mengambil data santri", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectExactlyOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data santri", http.StatusInternalServerError)
		return
	}

	// Guru may only read santri from a class they hold — as wali kelas or through
	// their teaching schedule.
	if role == "guru" && !h.guruTeachesSantri(ctx, userID, id) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	jsonData(w, item)
}

// POST /api/santri
func (h *SantriHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	item, err := h.insertSantri(r.Context(), body)
	if err != nil {
		jsonError(w, "gagal membuat santri: "+err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

// POST /api/santri/bulk
func (h *SantriHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body []map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if len(body) == 0 {
		jsonError(w, "data kosong", http.StatusBadRequest)
		return
	}
	if len(body) > 1000 {
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

	/* Impor Excel butuh laporan PER BARIS, bukan gagal-semua: satu NISN ganda
	 * tidak boleh membatalkan 499 baris lain yang benar. Savepoint per baris
	 * membuat baris rusak dibatalkan sendirian lalu dilewati, sementara seluruh
	 * proses tetap satu transaksi yang sama. */
	created := make([]map[string]any, 0, len(body))
	failed := make([]map[string]any, 0)
	for i, rec := range body {
		sp := fmt.Sprintf("bulk_santri_%d", i)
		if _, err := tx.Exec(ctx, "SAVEPOINT "+sp); err != nil {
			jsonError(w, "gagal menyiapkan simpanan baris", http.StatusInternalServerError)
			return
		}

		// insertSantriTx also creates the auth.users + user_profiles rows that
		// santri.id references, defaults the password to nis/nisn/nomor_induk,
		// and hashes it.
		item, err := insertSantriTx(ctx, tx, rec)
		if err != nil {
			_, _ = tx.Exec(ctx, "ROLLBACK TO SAVEPOINT "+sp)
			failed = append(failed, map[string]any{"index": i, "error": err.Error()})
			continue
		}
		_, _ = tx.Exec(ctx, "RELEASE SAVEPOINT "+sp)
		created = append(created, item)
	}
	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan data", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, map[string]any{"inserted": created, "failed": failed})
}

// PUT /api/santri/{id}
func (h *SantriHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	/* Sama seperti List: cabang akses-penuh memakai CanManage, bukan daftar peran
	 * manual. Daftar lama hanya memuat "admin", jadi tata usaha TIDAK BISA
	 * menyunting satu pun data murid — padahal itu pekerjaan intinya. */
	allowed := santriInsertable
	switch {
	case middleware.CanManage(role):
		// full field access
	case role == "santri":
		if userID != id {
			jsonError(w, "forbidden", http.StatusForbidden)
			return
		}
		allowed = santriSelfEditable
	default:
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := hashPasswordField(body); err != nil {
		jsonError(w, "gagal memproses password", http.StatusInternalServerError)
		return
	}

	item, err := updateRow(ctx, h.db, "santri", id, body, allowed)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal memperbarui santri: "+err.Error(), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

// DELETE /api/santri/{id} — soft delete.
func (h *SantriHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	ct, err := h.db.Exec(r.Context(), `UPDATE santri SET status = 'Nonaktif' WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menonaktifkan santri", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "status": "Nonaktif"})
}

// GET /api/santri/count — public.
func (h *SantriHandler) Count(w http.ResponseWriter, r *http.Request) {
	var total int
	err := h.db.QueryRow(r.Context(),
		`SELECT COUNT(*)
		 FROM santri
		 WHERE deleted_at IS NULL
		   AND lower(trim(COALESCE(status, ''))) IN ('aktif', 'active')`).Scan(&total)
	if err != nil {
		jsonError(w, "gagal menghitung santri", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]int{"total": total})
}

// PUT /api/santri/{id}/jilid
func (h *SantriHandler) UpdateJilid(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	if !middleware.CanManage(role) && role != "guru" {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	userID := middleware.UserIDFromCtx(ctx)

	var body struct {
		Jilid string `json:"jilid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Jilid) == "" {
		jsonError(w, "jilid wajib diisi", http.StatusBadRequest)
		return
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var fromJilid *string
	err = tx.QueryRow(ctx, `SELECT jilid FROM santri WHERE id = $1`, id).Scan(&fromJilid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca jilid saat ini", http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE santri SET jilid = $1 WHERE id = $2`, body.Jilid, id); err != nil {
		jsonError(w, "gagal memperbarui jilid", http.StatusInternalServerError)
		return
	}
	if err := insertJilidHistoryTx(ctx, tx, id, fromJilid, body.Jilid, userID); err != nil {
		jsonError(w, "gagal mencatat riwayat jilid", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan perubahan", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]any{"id": id, "jilid": body.Jilid})
}

// PUT /api/santri/{id}/order
func (h *SantriHandler) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	var body struct {
		OrderInClass int `json:"order_in_class"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	ct, err := h.db.Exec(r.Context(),
		`UPDATE santri SET order_in_class = $1 WHERE id = $2`, body.OrderInClass, id)
	if err != nil {
		jsonError(w, "gagal memperbarui urutan", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "order_in_class": body.OrderInClass})
}

// POST /api/santri/move-class
func (h *SantriHandler) MoveClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	if !middleware.CanManage(role) && role != "guru" {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	userID := middleware.UserIDFromCtx(ctx)

	var body struct {
		SantriID      string `json:"santri_id"`
		TargetClassID string `json:"target_class_id"`
		Reason        string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if body.SantriID == "" || body.TargetClassID == "" {
		jsonError(w, "santri_id dan target_class_id wajib diisi", http.StatusBadRequest)
		return
	}
	if role == "guru" && !h.guruOwnsSantri(ctx, userID, body.SantriID) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var fromClass *string
	err = tx.QueryRow(ctx, `SELECT current_class_id FROM santri WHERE id = $1`, body.SantriID).Scan(&fromClass)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca kelas saat ini", http.StatusInternalServerError)
		return
	}

	// Tolak pindah ke kelas yang sama — tidak ada mutasi nyata dan hanya
	// mengotori riwayat.
	if fromClass != nil && *fromClass == body.TargetClassID {
		jsonError(w, "santri sudah berada di kelas tujuan", http.StatusBadRequest)
		return
	}

	// Pastikan kelas tujuan benar-benar ada, supaya galat FK tidak muncul sebagai
	// 500 yang membingungkan.
	var targetExists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM classes WHERE id = $1)`, body.TargetClassID).Scan(&targetExists); err != nil {
		jsonError(w, "gagal memeriksa kelas tujuan", http.StatusInternalServerError)
		return
	}
	if !targetExists {
		jsonError(w, "kelas tujuan tidak ditemukan", http.StatusBadRequest)
		return
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO class_mutations (santri_id, from_class_id, to_class_id, reason, created_by, mutation_date)
		VALUES ($1, $2, $3, $4, $5, now())
	`, body.SantriID, fromClass, body.TargetClassID, body.Reason, userID); err != nil {
		jsonError(w, "gagal mencatat mutasi kelas", http.StatusInternalServerError)
		return
	}
	if _, err := tx.Exec(ctx,
		`UPDATE santri SET current_class_id = $1 WHERE id = $2`,
		body.TargetClassID, body.SantriID); err != nil {
		jsonError(w, "gagal memindahkan santri", http.StatusInternalServerError)
		return
	}

	// Jaga class_memberships tetap sinkron dengan current_class_id — Detail kelas
	// membaca daftar anggota dari sini, jadi kalau tidak diperbarui rosternya
	// akan berbeda dari daftar utama. Tutup keanggotaan aktif lama (unique index
	// one_active_per_santri hanya mengizinkan satu yang aktif), lalu buka yang
	// baru di kelas tujuan.
	if _, err := tx.Exec(ctx, `
		UPDATE class_memberships
		SET status = 'moved', end_date = CURRENT_DATE, updated_by = $2
		WHERE santri_id = $1 AND status = 'active'
	`, body.SantriID, userID); err != nil {
		jsonError(w, "gagal menutup keanggotaan lama", http.StatusInternalServerError)
		return
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO class_memberships (santri_id, class_id, start_date, status, created_by, updated_by)
		VALUES ($1, $2, CURRENT_DATE, 'active', $3, $3)
	`, body.SantriID, body.TargetClassID, userID); err != nil {
		jsonError(w, "gagal membuat keanggotaan baru", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan mutasi", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]any{
		"santri_id":     body.SantriID,
		"from_class_id": fromClass,
		"to_class_id":   body.TargetClassID,
	})
}

// PromoteClass POST /api/santri/promote-class — kenaikan kelas satu tahun ajaran
// untuk BANYAK rombel sekaligus.
//
// Sebelum ini sekolah hanya punya `move-class` yang memindahkan satu murid, jadi
// menaikkan enam rombel berarti ratusan kali buka-ubah-simpan setiap awal tahun.
//
// Petanya DIKIRIM PEMANGGIL, tidak diturunkan di sini. Sekolah berbeda-beda
// kebijakannya: ada yang mempertahankan rombel (2B ke 3B), ada yang mengacak
// ulang setiap tahun supaya kelasnya seimbang, ada yang menggabung dua rombel
// jadi satu. Panel di aplikasi mengusulkan peta berdasarkan `classes.tingkat`
// lalu admin menyetujui atau mengubahnya; backend menjalankan apa yang disetujui.
// Menebak kebijakan di sini berarti memaksakan satu cara ke semua sekolah.
//
// Menulis dengan pola yang SAMA dengan MoveClass — catat di class_mutations,
// perbarui current_class_id, tutup keanggotaan lama lalu buka yang baru. Jangan
// dibuat jalur kedua: detail kelas membaca rosternya dari class_memberships, dan
// dua cara menulis berarti dua cara untuk tidak sinkron.
//
// Semuanya dalam SATU transaksi. Kenaikan kelas setengah jalan lebih buruk
// daripada gagal seluruhnya: sebagian murid pindah, sebagian tidak, dan tidak
// ada yang tahu batasnya di mana.
func (h *SantriHandler) PromoteClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	userID := middleware.UserIDFromCtx(ctx)

	var body struct {
		TahunAjaranAsal   string `json:"tahun_ajaran_asal"`
		TahunAjaranTujuan string `json:"tahun_ajaran_tujuan"`
		Peta              []struct {
			FromClassID string `json:"from_class_id"`
			ToClassID   string `json:"to_class_id"`
		} `json:"peta"`
		LulusClassIDs    []string `json:"lulus_class_ids"`
		TinggalSantriIDs []string `json:"tinggal_santri_ids"`
		Catatan          string   `json:"catatan"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	if !tahunAjaranPattern.MatchString(body.TahunAjaranAsal) || !tahunAjaranPattern.MatchString(body.TahunAjaranTujuan) {
		jsonError(w, "tahun ajaran harus berformat 2026/2027", http.StatusBadRequest)
		return
	}
	if len(body.Peta) == 0 && len(body.LulusClassIDs) == 0 {
		jsonError(w, "tidak ada rombel yang dinaikkan maupun dilulusdkan", http.StatusBadRequest)
		return
	}
	if body.TinggalSantriIDs == nil {
		body.TinggalSantriIDs = []string{}
	}

	// Dicek lebih dulu supaya pesannya jelas. Batasan unik di
	// class_promotion_runs tetap menjadi pengaman sesungguhnya bila dua admin
	// menekan tombolnya pada saat yang sama.
	var sudahPernah bool
	if err := h.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM class_promotion_runs WHERE tahun_ajaran_asal = $1)`,
		body.TahunAjaranAsal).Scan(&sudahPernah); err != nil {
		jsonError(w, "gagal memeriksa riwayat kenaikan kelas", http.StatusInternalServerError)
		return
	}
	if sudahPernah {
		jsonError(w, "kenaikan kelas tahun ajaran "+body.TahunAjaranAsal+" sudah pernah dijalankan", http.StatusConflict)
		return
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Murid aktif di sebuah rombel, kecuali yang ditandai tinggal kelas.
	muridDi := func(classID string) ([]string, error) {
		rows, err := tx.Query(ctx, `
			SELECT s.id::text
			FROM santri s
			WHERE s.current_class_id = $1
			  AND s.deleted_at IS NULL
			  AND (s.status IS NULL OR s.status ILIKE 'aktif' OR s.status ILIKE 'active')
			  AND NOT (s.id = ANY($2::uuid[]))
			ORDER BY s.order_in_class NULLS LAST, s.nama_lengkap
		`, classID, body.TinggalSantriIDs)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			ids = append(ids, id)
		}
		return ids, rows.Err()
	}

	/* SELURUH roster asal dibaca LEBIH DULU, sebelum satu pun tulisan.
	 *
	 * Ini bukan penghematan, ini pembetulan cacat. Versi pertama membaca dan
	 * memindahkan per rombel secara berurutan, dan murid Kelas 1A yang baru
	 * dipindahkan ke 2A langsung ikut terbawa saat langkah 2A ke 3A memb aca
	 * rombelnya. Efeknya beranting: pada uji dengan 15 murid, hasilnya 33 kali
	 * naik dan 14 murid lulus — murid kelas satu pun ikut dinyatakan lulus.
	 *
	 * Karena `current_class_id` hanya satu, membaca semuanya di awal juga
	 * menjamin tiap murid muncul di tepat satu daftar asal. */
	rosterAsal := make(map[string][]string, len(body.Peta)+len(body.LulusClassIDs))
	bacaRoster := func(classID string) bool {
		if _, sudah := rosterAsal[classID]; sudah {
			return true
		}
		ids, err := muridDi(classID)
		if err != nil {
			jsonError(w, "gagal membaca murid rombel asal", http.StatusInternalServerError)
			return false
		}
		rosterAsal[classID] = ids
		return true
	}
	for _, langkah := range body.Peta {
		if langkah.FromClassID != "" && !bacaRoster(langkah.FromClassID) {
			return
		}
	}
	for _, classID := range body.LulusClassIDs {
		if classID != "" && !bacaRoster(classID) {
			return
		}
	}

	alasan := "Kenaikan kelas " + body.TahunAjaranAsal + " ke " + body.TahunAjaranTujuan
	jumlahNaik, jumlahLulus := 0, 0
	rincian := make([]map[string]any, 0, len(body.Peta)+len(body.LulusClassIDs))

	for _, langkah := range body.Peta {
		if langkah.FromClassID == "" || langkah.ToClassID == "" {
			jsonError(w, "peta kenaikan memuat rombel kosong", http.StatusBadRequest)
			return
		}
		if langkah.FromClassID == langkah.ToClassID {
			jsonError(w, "rombel asal dan tujuan tidak boleh sama", http.StatusBadRequest)
			return
		}
		var tujuanAda bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM classes WHERE id = $1)`, langkah.ToClassID).Scan(&tujuanAda); err != nil {
			jsonError(w, "gagal memeriksa rombel tujuan", http.StatusInternalServerError)
			return
		}
		if !tujuanAda {
			jsonError(w, "rombel tujuan tidak ditemukan", http.StatusBadRequest)
			return
		}

		ids := rosterAsal[langkah.FromClassID]
		if len(ids) == 0 {
			rincian = append(rincian, map[string]any{"from_class_id": langkah.FromClassID, "to_class_id": langkah.ToClassID, "jumlah": 0})
			continue
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO class_mutations (santri_id, from_class_id, to_class_id, reason, created_by, mutation_date)
			SELECT id::uuid, $2, $3, $4, $5, now() FROM unnest($1::uuid[]) AS id
		`, ids, langkah.FromClassID, langkah.ToClassID, alasan, userID); err != nil {
			jsonError(w, "gagal mencatat mutasi kenaikan kelas", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships SET status = 'moved', end_date = CURRENT_DATE, updated_by = $2
			WHERE santri_id = ANY($1::uuid[]) AND status = 'active'
		`, ids, userID); err != nil {
			jsonError(w, "gagal menutup keanggotaan lama", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO class_memberships (santri_id, class_id, start_date, status, created_by, updated_by)
			SELECT id::uuid, $2, CURRENT_DATE, 'active', $3, $3 FROM unnest($1::uuid[]) AS id
		`, ids, langkah.ToClassID, userID); err != nil {
			jsonError(w, "gagal membuat keanggotaan baru", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `
			UPDATE santri SET current_class_id = $2, updated_by = $3, updated_at = now()
			WHERE id = ANY($1::uuid[])
		`, ids, langkah.ToClassID, userID); err != nil {
			jsonError(w, "gagal memindahkan murid", http.StatusInternalServerError)
			return
		}

		jumlahNaik += len(ids)
		rincian = append(rincian, map[string]any{"from_class_id": langkah.FromClassID, "to_class_id": langkah.ToClassID, "jumlah": len(ids)})
	}

	// Rombel yang lulus. Kelasnya DIKOSONGKAN, bukan dibiarkan: murid yang lulus
	// tetapi masih tercatat di Kelas 6A akan muncul di roster rombel itu bersama
	// murid baru tahun depan.
	for _, classID := range body.LulusClassIDs {
		if classID == "" {
			continue
		}
		ids := rosterAsal[classID]
		if len(ids) == 0 {
			rincian = append(rincian, map[string]any{"from_class_id": classID, "lulus": 0})
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO class_mutations (santri_id, from_class_id, to_class_id, reason, created_by, mutation_date)
			SELECT id::uuid, $2, NULL, $3, $4, now() FROM unnest($1::uuid[]) AS id
		`, ids, classID, "Lulus "+body.TahunAjaranAsal, userID); err != nil {
			jsonError(w, "gagal mencatat kelulusan", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships SET status = 'graduated', end_date = CURRENT_DATE, updated_by = $2
			WHERE santri_id = ANY($1::uuid[]) AND status = 'active'
		`, ids, userID); err != nil {
			jsonError(w, "gagal menutup keanggotaan murid lulus", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `
			UPDATE santri SET status = 'Lulus', current_class_id = NULL, updated_by = $2, updated_at = now()
			WHERE id = ANY($1::uuid[])
		`, ids, userID); err != nil {
			jsonError(w, "gagal menandai murid lulus", http.StatusInternalServerError)
			return
		}
		jumlahLulus += len(ids)
		rincian = append(rincian, map[string]any{"from_class_id": classID, "lulus": len(ids)})
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO class_promotion_runs
			(tahun_ajaran_asal, tahun_ajaran_tujuan, jumlah_naik, jumlah_tinggal, jumlah_lulus, catatan, dijalankan_oleh)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, body.TahunAjaranAsal, body.TahunAjaranTujuan, jumlahNaik, len(body.TinggalSantriIDs), jumlahLulus,
		nullIfBlank(body.Catatan), userID); err != nil {
		jsonError(w, "gagal mencatat kenaikan kelas", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan kenaikan kelas", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]any{
		"tahun_ajaran_asal":   body.TahunAjaranAsal,
		"tahun_ajaran_tujuan": body.TahunAjaranTujuan,
		"jumlah_naik":         jumlahNaik,
		"jumlah_tinggal":      len(body.TinggalSantriIDs),
		"jumlah_lulus":        jumlahLulus,
		"rincian":             rincian,
	})
}

// PromotionRuns GET /api/santri/promotion-runs — riwayat kenaikan kelas, supaya
// panel tahu tahun ajaran mana yang sudah dijalankan.
func (h *SantriHandler) PromotionRuns(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	rows, err := h.db.Query(ctx, `
		SELECT row_to_json(t) FROM (
			SELECT r.*, g.nama AS dijalankan_oleh_nama
			FROM class_promotion_runs r
			LEFT JOIN guru g ON g.id = r.dijalankan_oleh
			ORDER BY r.dijalankan_pada DESC
		) t
	`)
	if err != nil {
		jsonError(w, "gagal membaca riwayat kenaikan kelas", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := make([]json.RawMessage, 0)
	for rows.Next() {
		var raw json.RawMessage
		if err := rows.Scan(&raw); err != nil {
			jsonError(w, "gagal membaca riwayat kenaikan kelas", http.StatusInternalServerError)
			return
		}
		out = append(out, raw)
	}
	jsonData(w, out)
}

func nullIfBlank(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (h *SantriHandler) insertSantri(ctx context.Context, body map[string]any) (map[string]any, error) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	item, err := insertSantriTx(ctx, tx, body)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return item, nil
}

// insertSantriTx creates the auth.users row, the user_profiles role row, and the
// santri profile. santri.id is a FK onto auth.users(id), so the identity row has
// to exist first — this is the local replacement for what Supabase Auth used to
// do out-of-band in the manage-user edge function.
func insertSantriTx(ctx context.Context, tx pgx.Tx, body map[string]any) (map[string]any, error) {
	profile := make(map[string]any, len(body)+1)
	for k, v := range body {
		profile[k] = v
	}

	// Sandi awal murid = nomor induknya, supaya akun baru langsung bisa dipakai.
	//
	// NIS DIDAHULUKAN atas NISN, atas keputusan pemilik. NIS adalah nomor internal
	// sekolah yang pendek — itu yang dihafal murid dan yang dibagikan sekolah;
	// NISN sepuluh angka lebih sering hanya dipakai untuk urusan Dapodik.
	// Urutan ini HARUS sama dengan impor Excel dan formulir tambah murid di
	// src/components/dashboard/admin/SantriManagement.jsx. Kalau salah satu
	// digeser sendiri, murid yang masuk lewat jalur berbeda akan mendapat sandi
	// berbeda, dan tidak ada satu pun pesan galat yang memberi tahu.
	if _, ok := profile["password"]; !ok {
		for _, key := range []string{"nis", "nisn", "nomor_induk"} {
			if v := strings.TrimSpace(asString(profile[key])); v != "" {
				profile["password"] = v
				break
			}
		}
	}
	if err := hashPasswordField(profile); err != nil {
		return nil, err
	}

	email := strings.ToLower(strings.TrimSpace(asString(profile["email"])))
	var emailArg any
	if email != "" {
		emailArg = email
	}

	var newID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, emailArg).Scan(&newID); err != nil {
		return nil, err
	}

	displayName := strings.TrimSpace(asString(profile["nama_lengkap"]))
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_profiles (id, role, display_name, email, status)
		VALUES ($1, 'santri'::public.app_role, $2, $3, 'active')
	`, newID, displayName, emailArg); err != nil {
		return nil, err
	}

	profile["id"] = newID
	return insertRowTx(ctx, tx, "santri", profile, santriCreatable)
}

// guruTeachesSantri dipakai jalur BACA: guru berhak melihat murid bila ia wali
// kelasnya ATAU mengajar di kelasnya menurut `jadwal_pelajaran`.
//
// Sengaja terpisah dari guruOwnsSantri. Yang terakhir menjaga pemindahan kelas,
// dan pemindahan murid tetap wewenang wali kelas serta admin — menyatukan
// keduanya akan membuat setiap guru mata pelajaran ikut dapat memindahkan murid
// antar kelas hanya karena mengajar satu jam di sana.
func (h *SantriHandler) guruTeachesSantri(ctx context.Context, guruID, santriID string) bool {
	return guruTeachesSantri(ctx, h.db, guruID, santriID)
}

// guruTeachesSantri sebagai fungsi paket, supaya handler lain memakai aturan yang
// SAMA dan bukan salinannya. Absensi memerlukannya untuk menjaga /recap, dan dua
// salinan aturan "guru mana boleh melihat murid mana" akan berselisih begitu salah
// satunya disunting.
func guruTeachesSantri(ctx context.Context, db *pgxpool.Pool, guruID, santriID string) bool {
	var exists bool
	err := db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM santri s
			WHERE s.id = $1 AND (
				s.current_class_id IN (SELECT id FROM classes WHERE id_guru = $2)
				OR s.current_class_id IN (SELECT class_id FROM jadwal_pelajaran WHERE guru_id = $2)
			)
		) OR EXISTS (
			SELECT 1 FROM class_memberships cm
			WHERE cm.santri_id = $1 AND cm.status = 'active' AND (
				cm.class_id IN (SELECT id FROM classes WHERE id_guru = $2)
				OR cm.class_id IN (SELECT class_id FROM jadwal_pelajaran WHERE guru_id = $2)
			)
		)
	`, santriID, guruID).Scan(&exists)
	return err == nil && exists
}

// guruOwnsSantri menjaga jalur TULIS: hanya wali kelas. Jangan dilebarkan ke
// jadwal mengajar — lihat catatan pada guruTeachesSantri.
func (h *SantriHandler) guruOwnsSantri(ctx context.Context, guruID, santriID string) bool {
	var exists bool
	err := h.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM santri s
			WHERE s.id = $1 AND (
				s.current_class_id IN (SELECT id FROM classes WHERE id_guru = $2)
				OR s.id IN (SELECT cm.santri_id FROM class_memberships cm
					JOIN classes c ON c.id = cm.class_id
					WHERE c.id_guru = $2 AND cm.status = 'active')
			)
		)
	`, santriID, guruID).Scan(&exists)
	return err == nil && exists
}

// GET /api/santri/by-rfid/{rfid} — kiosk scan lookup.
// CanManage dan guru: boleh lookup RFID siapapun (untuk absensi kelas).
// Santri: hanya boleh lookup RFID miliknya sendiri.
func (h *SantriHandler) ByRFID(w http.ResponseWriter, r *http.Request) {
	role := middleware.RoleFromCtx(r.Context())
	if role == "" {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rfid := chi.URLParam(r, "rfid")
	rows, err := h.db.Query(r.Context(), `
		SELECT s.*,
		       c.id AS class_id, c.nama_kelas AS class_nama, c.sesi AS class_sesi,
		       c.kategori AS class_kategori, c.id_guru AS class_id_guru,
		       c.is_active AS class_is_active,
		       g.nama AS class_guru_nama
		FROM santri s
		LEFT JOIN classes c ON c.id = s.current_class_id
		LEFT JOIN guru g ON g.id = c.id_guru
		WHERE s.rfid_tag = $1
	`, rfid)
	if err != nil {
		jsonError(w, "gagal mencari santri", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectExactlyOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri dengan rfid tersebut tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data santri", http.StatusInternalServerError)
		return
	}
	if role == "santri" {
		userID := middleware.UserIDFromCtx(r.Context())
		if fmt.Sprintf("%v", item["id"]) != userID {
			jsonError(w, "forbidden", http.StatusForbidden)
			return
		}
	}
	jsonData(w, item)
}

// POST /api/santri/{id}/archive — port of set_santri_archive_state(archived=true).
// Archiving never deletes: class, attendance, payment, hafalan, character, and
// mutation rows all stay, only the account is deactivated.
func (h *SantriHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.setArchiveState(w, r, true)
}

// POST /api/santri/{id}/restore — port of set_santri_archive_state(archived=false).
func (h *SantriHandler) Restore(w http.ResponseWriter, r *http.Request) {
	h.setArchiveState(w, r, false)
}

func (h *SantriHandler) setArchiveState(w http.ResponseWriter, r *http.Request, archived bool) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	actor := middleware.UserIDFromCtx(ctx)

	var body struct {
		Reason string `json:"reason"`
	}
	// Restore sends no body; an unreadable body is not an error here.
	json.NewDecoder(r.Body).Decode(&body)
	reason := strings.TrimSpace(body.Reason)

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	status := "Aktif"
	profileStatus := "active"
	var reasonArg, archivedBy any
	if archived {
		status = "Nonaktif"
		profileStatus = "inactive"
		if reason != "" {
			reasonArg = reason
		}
		archivedBy = actor
	}

	var currentClassID *string
	err = tx.QueryRow(ctx, `
		UPDATE santri SET
			status = $2,
			deleted_at = CASE WHEN $3 THEN COALESCE(deleted_at, now()) ELSE NULL END,
			archive_reason = $4,
			archived_by = $5,
			updated_by = $6,
			updated_at = now()
		WHERE id = $1
		RETURNING current_class_id
	`, id, status, archived, reasonArg, archivedBy, actor).Scan(&currentClassID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "data santri tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal memperbarui status santri", http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(ctx, `
		UPDATE user_profiles
		SET status = $2::account_status, updated_by = $3, updated_at = now()
		WHERE id = $1
	`, id, profileStatus, actor); err != nil {
		jsonError(w, "gagal memperbarui akun santri", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan perubahan arsip", http.StatusInternalServerError)
		return
	}

	jsonData(w, map[string]any{
		"santri_id":        id,
		"archived":         archived,
		"account_status":   status,
		"current_class_id": currentClassID,
	})
}

// GET /api/santri/{id}/transfer-destinations — port of
// list_guru_transfer_destinations. Guru may only ask about santri in their own
// class; destinations are limited to active classes of the same kategori.
func (h *SantriHandler) TransferDestinations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)
	id := chi.URLParam(r, "id")

	if !middleware.CanManage(role) && role != "guru" {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	if role == "guru" && !h.guruOwnsSantri(ctx, userID, id) {
		jsonError(w, "santri ini tidak berada di kelas Anda", http.StatusForbidden)
		return
	}

	var kategori *string
	err := h.db.QueryRow(ctx, `
		SELECT kategori FROM santri
		WHERE id = $1 AND lower(COALESCE(status, '')) IN ('aktif', 'active')
	`, id).Scan(&kategori)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "santri aktif tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data santri", http.StatusInternalServerError)
		return
	}

	rows, err := h.db.Query(ctx, `
		SELECT c.id, c.nama_kelas, c.id_guru, g.nama AS guru_nama,
		       c.sesi, c.kategori, c.sort_order
		FROM classes c
		LEFT JOIN guru g ON g.id = c.id_guru
		WHERE c.is_active IS TRUE
		  AND c.deleted_at IS NULL
		  AND lower(COALESCE(c.kategori, '')) = lower(COALESCE($1, ''))
		ORDER BY c.sort_order ASC NULLS LAST, c.nama_kelas ASC
	`, kategori)
	if err != nil {
		jsonError(w, "gagal mengambil kelas tujuan", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca kelas tujuan", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

// ---- shared helpers (package handler) ----

var errNoFields = errors.New("no updatable fields")

// lowerAll trims and lowercases each entry so a comma-separated filter can be
// matched case-insensitively against lower(column) = ANY(...).
func lowerAll(values []string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		if t := strings.TrimSpace(v); t != "" {
			out = append(out, strings.ToLower(t))
		}
	}
	return out
}

// hashPasswordField bcrypts body["password"] in place so a plaintext value can
// never reach the DB via insertRow/updateRow. An empty or blank password is
// dropped entirely — callers that want to clear a login send password: null.
func hashPasswordField(body map[string]any) error {
	raw, ok := body["password"]
	if !ok {
		return nil
	}
	plain, ok := raw.(string)
	if !ok || strings.TrimSpace(plain) == "" {
		// null (clear login) stays as-is; blank string is meaningless — drop it.
		if raw != nil {
			delete(body, "password")
		}
		return nil
	}
	hashed, err := auth.HashPassword(plain)
	if err != nil {
		return err
	}
	body["password"] = hashed
	return nil
}

// paginate reads page (default 0) and limit (default 50, max 200) and returns
// limit + offset. jsonData lives in academic.go; parsePagination in attendance.go.
func paginate(r *http.Request) (limit, offset int) {
	limit = 50
	page := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > 200 {
		limit = 200
	}
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			page = n
		}
	}
	return limit, page * limit
}

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// rowToMap is pgx.RowToMap plus uuid normalization. Use it everywhere instead of
// pgx.RowToMap directly.
//
// pgx decodes a uuid column into [16]byte when the destination is `any`, which is
// what RowToMap uses. encoding/json then renders that as a 16-number array, so
// every id came back as "id":[209,15,90,...] instead of "id":"d10f5aca-...". The
// responses were still HTTP 200, which is why this survived: the frontend takes
// those ids straight into request URLs (DELETE /api/login-logs/{id}), so the reads
// looked healthy while the ids were unusable.
//
// Fixing it here rather than on the connection is deliberate. Swapping pgx's uuid
// codec for TextCodec also flips the *parameter* wire format, which breaks every
// `uuid = ANY($1)` query with "improper binary format in array element 1" — the
// text[] no longer matches uuid[]. Normalizing the decoded map leaves parameter
// encoding untouched.
func rowToMap(row pgx.CollectableRow) (map[string]any, error) {
	m, err := pgx.RowToMap(row)
	if err != nil {
		return nil, err
	}
	for k, v := range m {
		if b, ok := v.([16]byte); ok {
			m[k] = uuidString(b)
		}
	}
	return m, nil
}

// uuidString formats raw uuid bytes as 8-4-4-4-12 hex.
func uuidString(b [16]byte) string {
	const hexDigits = "0123456789abcdef"
	out := make([]byte, 0, 36)
	for i, c := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			out = append(out, '-')
		}
		out = append(out, hexDigits[c>>4], hexDigits[c&0x0f])
	}
	return string(out)
}

// insertRow builds a whitelisted INSERT ... RETURNING * and returns the row as a map.
func insertRow(ctx context.Context, q querier, table string, data map[string]any, allowed map[string]bool) (map[string]any, error) {
	sqlStr, args, err := buildInsert(table, data, allowed)
	if err != nil {
		return nil, err
	}
	rows, err := q.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectExactlyOneRow(rows, rowToMap)
}

func insertRowTx(ctx context.Context, tx pgx.Tx, table string, data map[string]any, allowed map[string]bool) (map[string]any, error) {
	return insertRow(ctx, tx, table, data, allowed)
}

func buildInsert(table string, data map[string]any, allowed map[string]bool) (string, []any, error) {
	cols := make([]string, 0, len(data))
	for k := range data {
		if allowed[k] {
			cols = append(cols, k)
		}
	}
	if len(cols) == 0 {
		return "", nil, errNoFields
	}
	sort.Strings(cols)
	placeholders := make([]string, len(cols))
	args := make([]any, len(cols))
	for i, c := range cols {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = data[c]
	}
	sqlStr := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) RETURNING *",
		table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
	return sqlStr, args, nil
}

// updateRow builds a whitelisted partial UPDATE ... RETURNING * and returns the row as a map.
func updateRow(ctx context.Context, q querier, table, id string, data map[string]any, allowed map[string]bool) (map[string]any, error) {
	cols := make([]string, 0, len(data))
	for k := range data {
		if allowed[k] {
			cols = append(cols, k)
		}
	}
	if len(cols) == 0 {
		return nil, errNoFields
	}
	sort.Strings(cols)
	sets := make([]string, len(cols))
	args := make([]any, 0, len(cols)+1)
	for i, c := range cols {
		sets[i] = fmt.Sprintf("%s = $%d", c, i+1)
		args = append(args, data[c])
	}
	args = append(args, id)
	sqlStr := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d RETURNING *",
		table, strings.Join(sets, ", "), len(args))
	rows, err := q.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectExactlyOneRow(rows, rowToMap)
}
