package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

type ClassesHandler struct {
	db *pgxpool.Pool
}

func NewClassesHandler(db *pgxpool.Pool) *ClassesHandler {
	return &ClassesHandler{db: db}
}

func (h *ClassesHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Put("/reorder", h.Reorder) // must precede /{id}

	// Global mutation log. Registered before /{id} so "mutations" is not
	// swallowed as a class id.
	r.Get("/mutations", h.AllMutations)
	r.Delete("/mutations/{mutationID}", h.DeleteMutation)

	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", h.Detail)
		r.Put("/", h.Update)
		r.Delete("/", h.Delete)
		r.Get("/mutations", h.Mutations)
	})

	return r
}

// Columns a client may set on create/update.
var classesEditable = map[string]bool{
	"nama_kelas": true, "sesi": true, "id_guru": true, "kategori": true,
	"is_active": true, "sort_order": true, "kapasitas": true,
}

// canSeeRoster reports whether the role may view full class rosters and member
// PII (nama, NIS, foto, jenis kelamin). Staff, teachers, and the wakil kepala
// sekolah yes; a santri must never be able to enumerate every classmate across
// all classes. The class list itself (nama kelas, sesi, wali) is not gated —
// only the attached roster/member data is.
func canSeeRoster(role string) bool {
	return middleware.CanManage(role) || role == "guru" || role == "pentashih"
}

// GET /api/classes
func (h *ClassesHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	limit, offset := paginate(r)

	where := []string{}
	args := []any{}
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if v := r.URL.Query().Get("kategori"); v != "" {
		add("cl.kategori = $%d", v)
	}
	if v := r.URL.Query().Get("is_active"); v != "" {
		active := v == "true" || v == "1"
		add("cl.is_active = $%d", active)
	}
	if v := r.URL.Query().Get("id_guru"); v != "" {
		add("cl.id_guru = $%d", v)
	}

	includeGuru := r.URL.Query().Get("include_guru") == "true"
	// Roster PII is staff/teacher-only. A santri asking for include_santri gets
	// the class list without the roster attached, never a forbidden error, so the
	// student dashboard's class list keeps working.
	includeSantri := r.URL.Query().Get("include_santri") == "true" && canSeeRoster(role)

	selectCols := "cl.*"
	joins := ""
	if includeGuru {
		selectCols = "cl.*, g.nama AS guru_nama, g.no_hp AS guru_no_hp, g.foto_url AS guru_foto_url"
		joins = " LEFT JOIN guru g ON g.id = cl.id_guru"
	}

	query := fmt.Sprintf("SELECT %s FROM classes cl%s", selectCols, joins)
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY cl.sort_order, cl.nama_kelas LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		jsonError(w, "gagal mengambil data kelas", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca data kelas", http.StatusInternalServerError)
		return
	}

	// include_santri attaches each class's active roster. One query for every
	// class in the page, then grouped in memory — the guru dashboard needs the
	// roster inline and a per-class round trip would be N+1.
	if includeSantri && len(items) > 0 {
		classIDs := make([]string, 0, len(items))
		for _, item := range items {
			if id, ok := item["id"].(string); ok {
				classIDs = append(classIDs, id)
			} else if id := asString(item["id"]); id != "" {
				classIDs = append(classIDs, id)
			}
		}
		byClass, err := h.activeSantriByClass(ctx, classIDs)
		if err != nil {
			jsonError(w, "gagal mengambil santri kelas", http.StatusInternalServerError)
			return
		}
		for _, item := range items {
			id := asString(item["id"])
			roster := byClass[id]
			if roster == nil {
				roster = []map[string]any{}
			}
			item["santri"] = roster
		}
	}

	jsonData(w, items)
}

// activeSantriByClass returns the active roster for each of the given classes,
// keyed by class id. Reads santri.current_class_id rather than class_memberships
// because that is the column the santri list/filter endpoints treat as
// authoritative; keeping both readers on one source avoids a roster that
// disagrees with the class filter.
func (h *ClassesHandler) activeSantriByClass(ctx context.Context, classIDs []string) (map[string][]map[string]any, error) {
	if len(classIDs) == 0 {
		return map[string][]map[string]any{}, nil
	}
	rows, err := h.db.Query(ctx, `
		SELECT id, nama_lengkap, nama_panggilan, nomor_induk_qiroati, foto_url,
		       avatar_path, jilid, sesi_mengaji, kategori, points, jenis_kelamin,
		       order_in_class, current_class_id
		FROM santri
		WHERE current_class_id = ANY($1)
		  AND deleted_at IS NULL
		  AND (status IS NULL OR status ILIKE 'aktif' OR status ILIKE 'active')
		ORDER BY order_in_class NULLS LAST, nama_lengkap
	`, classIDs)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		return nil, err
	}
	byClass := make(map[string][]map[string]any, len(classIDs))
	for _, s := range list {
		cid := asString(s["current_class_id"])
		byClass[cid] = append(byClass[cid], s)
	}
	return byClass, nil
}

// GET /api/classes/{id}
func (h *ClassesHandler) Detail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	role := middleware.RoleFromCtx(ctx)

	// Class + guru info.
	classRows, err := h.db.Query(ctx, `
		SELECT cl.*, g.nama AS guru_nama, g.no_hp AS guru_no_hp, g.foto_url AS guru_foto_url
		FROM classes cl
		LEFT JOIN guru g ON g.id = cl.id_guru
		WHERE cl.id = $1
	`, id)
	if err != nil {
		jsonError(w, "gagal mengambil data kelas", http.StatusInternalServerError)
		return
	}
	class, err := pgx.CollectExactlyOneRow(classRows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "kelas tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca data kelas", http.StatusInternalServerError)
		return
	}

	// Roster PII is staff/teacher-only; a santri gets the class info without the
	// member list rather than a forbidden error.
	if canSeeRoster(role) {
		memberRows, err := h.db.Query(ctx, `
			SELECT cm.id, cm.santri_id, cm.order_in_class, cm.status,
			       s.nama_lengkap, s.nama_panggilan, s.nomor_induk_qiroati, s.foto_url
			FROM class_memberships cm
			JOIN santri s ON s.id = cm.santri_id
			WHERE cm.class_id = $1 AND cm.status = 'active'
			ORDER BY cm.order_in_class NULLS LAST, s.nama_lengkap
		`, id)
		if err != nil {
			jsonError(w, "gagal mengambil anggota kelas", http.StatusInternalServerError)
			return
		}
		members, err := pgx.CollectRows(memberRows, rowToMap)
		if err != nil {
			jsonError(w, "gagal membaca anggota kelas", http.StatusInternalServerError)
			return
		}
		class["members"] = members
	} else {
		class["members"] = []map[string]any{}
	}
	jsonData(w, class)
}

// POST /api/classes
func (h *ClassesHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	item, err := insertRow(r.Context(), h.db, "classes", body, classesEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang valid", http.StatusBadRequest)
			return
		}
		jsonError(w, "gagal membuat kelas: "+err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

// PUT /api/classes/{id}
func (h *ClassesHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	item, err := updateRow(r.Context(), h.db, "classes", id, body, classesEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "kelas tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal memperbarui kelas: "+err.Error(), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

// DELETE /api/classes/{id} — soft delete.
func (h *ClassesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	ct, err := h.db.Exec(r.Context(), `UPDATE classes SET is_active = false WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menonaktifkan kelas", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "kelas tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "is_active": false})
}

// PUT /api/classes/reorder — bulk update sort_order.
// Body: [{"id": "...", "sort_order": N}, ...]
func (h *ClassesHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	var body []struct {
		ID        string `json:"id"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if len(body) == 0 {
		jsonError(w, "data kosong", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	for _, item := range body {
		if item.ID == "" {
			continue
		}
		if _, err := tx.Exec(ctx,
			`UPDATE classes SET sort_order = $1 WHERE id = $2`, item.SortOrder, item.ID); err != nil {
			jsonError(w, "gagal memperbarui urutan kelas: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan perubahan urutan", http.StatusInternalServerError)
		return
	}
	jsonData(w, map[string]any{"updated": len(body)})
}

// GET /api/classes/{id}/mutations
func (h *ClassesHandler) Mutations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Transfer history + reasons are back-office data, same as AllMutations.
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "id")
	limit, offset := paginate(r)

	q := mutationLogQuery +
		"\n\tWHERE cm.from_class_id = $1 OR cm.to_class_id = $1" +
		fmt.Sprintf(mutationLogOrder, 2, 3)
	rows, err := h.db.Query(ctx, q, id, limit, offset)
	if err != nil {
		jsonError(w, "gagal mengambil riwayat mutasi", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca riwayat mutasi", http.StatusInternalServerError)
		return
	}
	jsonData(w, nestMutationRows(items))
}

// mutationLogQuery selects the whole mutation log with the santri and both
// classes joined. The admin history dialog reads nested objects
// (m.santri.nama_lengkap, m.from_class.guru.nama), so the flat aliases are
// regrouped in nestMutationRows below.
const mutationLogQuery = `
	SELECT cm.id, cm.santri_id, cm.from_class_id, cm.to_class_id,
	       cm.mutation_date, cm.reason, cm.created_at,
	       s.nama_lengkap AS santri_nama, s.foto_url AS santri_foto_url,
	       s.avatar_path AS santri_avatar_path,
	       fc.nama_kelas AS from_class_nama, fc.sesi AS from_class_sesi,
	       fg.nama AS from_class_guru,
	       tc.nama_kelas AS to_class_nama, tc.sesi AS to_class_sesi,
	       tg.nama AS to_class_guru
	FROM class_mutations cm
	LEFT JOIN santri s ON s.id = cm.santri_id
	LEFT JOIN classes fc ON fc.id = cm.from_class_id
	LEFT JOIN guru fg ON fg.id = fc.id_guru
	LEFT JOIN classes tc ON tc.id = cm.to_class_id
	LEFT JOIN guru tg ON tg.id = tc.id_guru`

// mutationLogOrder is appended after any WHERE clause. Callers bind limit and
// offset last so the placeholder numbers stay stable.
const mutationLogOrder = `
	ORDER BY cm.mutation_date DESC, cm.created_at DESC
	LIMIT $%d OFFSET $%d`

// GET /api/classes/mutations — full mutation log (admin only).
func (h *ClassesHandler) AllMutations(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	limit, offset := paginate(r)

	q := mutationLogQuery + fmt.Sprintf(mutationLogOrder, 1, 2)
	rows, err := h.db.Query(r.Context(), q, limit, offset)
	if err != nil {
		jsonError(w, "gagal mengambil riwayat mutasi", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca riwayat mutasi", http.StatusInternalServerError)
		return
	}
	jsonData(w, nestMutationRows(items))
}

func nestMutationRows(items []map[string]any) []map[string]any {
	for _, row := range items {
		row["santri"] = map[string]any{
			"id":           row["santri_id"],
			"nama_lengkap": row["santri_nama"],
			"foto_url":     row["santri_foto_url"],
			"avatar_path":  row["santri_avatar_path"],
		}
		row["from_class"] = nestMutationClass(row["from_class_nama"], row["from_class_sesi"], row["from_class_guru"])
		row["to_class"] = nestMutationClass(row["to_class_nama"], row["to_class_sesi"], row["to_class_guru"])
		for _, k := range []string{
			"santri_nama", "santri_foto_url", "santri_avatar_path",
			"from_class_nama", "from_class_sesi", "from_class_guru",
			"to_class_nama", "to_class_sesi", "to_class_guru",
		} {
			delete(row, k)
		}
	}
	return items
}

// nestMutationClass returns nil when the side has no class, so the UI's
// `m.from_class?.nama_kelas || 'Luar Kelas'` fallback still fires.
func nestMutationClass(nama, sesi, guru any) any {
	if nama == nil {
		return nil
	}
	return map[string]any{
		"nama_kelas": nama,
		"sesi":       sesi,
		"guru":       map[string]any{"nama": guru},
	}
}

// DELETE /api/classes/mutations/{mutationID} — remove one log entry (admin only).
func (h *ClassesHandler) DeleteMutation(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	id := chi.URLParam(r, "mutationID")
	ct, err := h.db.Exec(r.Context(), `DELETE FROM class_mutations WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menghapus riwayat mutasi", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "riwayat mutasi tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "deleted": true})
}
