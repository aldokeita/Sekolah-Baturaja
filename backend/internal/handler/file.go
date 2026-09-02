package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"lpq-backend/internal/config"
	"lpq-backend/internal/middleware"
	"lpq-backend/internal/storage"
)

type FileHandler struct {
	store *storage.Store
	cfg   *config.Config
}

func NewFileHandler(store *storage.Store, cfg *config.Config) *FileHandler {
	return &FileHandler{store: store, cfg: cfg}
}

func (h *FileHandler) ServePublic(w http.ResponseWriter, r *http.Request) {
	bucket, path := splitBucketPath(r.URL.Path, "/files/")
	h.store.ServeFile(w, r, bucket, path)
}

// ServePrivate melayani bucket yang wajib signed URL. Bucket diambil dari URL
// (bukan dipatok ke satu nilai) supaya satu handler cukup untuk avatars dan
// documents; bucket publik ditolak agar route ini tidak bisa dipakai untuk
// melewati pemeriksaan tanda tangan.
func (h *FileHandler) ServePrivate(w http.ResponseWriter, r *http.Request) {
	bucket, path := splitBucketPath(r.URL.Path, "/files/")
	if !storage.IsPrivateBucket(bucket) {
		http.NotFound(w, r)
		return
	}
	h.store.ServeFile(w, r, bucket, path)
}

func (h *FileHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	h.handleUpload(w, r, storage.BucketAvatars)
}

func (h *FileHandler) UploadAsset(w http.ResponseWriter, r *http.Request) {
	h.handleUpload(w, r, storage.BucketWebsiteAssets)
}

func (h *FileHandler) UploadMusic(w http.ResponseWriter, r *http.Request) {
	h.handleUpload(w, r, storage.BucketMusic)
}

// UploadDocument menerima arsip dokumen resmi (PDF atau hasil scan). Staf saja
// — authorizeFileWrite menjatuhkannya ke cabang CanManage.
func (h *FileHandler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	h.handleUpload(w, r, storage.BucketDocuments)
}

// ownsAvatarPath reports whether the caller may write or delete the avatar at
// path. Avatar paths are "<guru|santri>/<ownerId>/profile.webp", so ownership is
// derivable from the path itself — no DB lookup needed. Admin may touch any file.
//
// The folder segment is checked against the role as well: without it a santri
// could pass "guru/<their-own-uuid>/..." and write into the guru tree. ".." is
// rejected outright so a traversal can never be read as an ownerId match.
func ownsAvatarPath(role, userID, path string) bool {
	if middleware.CanManage(role) {
		return true
	}
	if role == "" || userID == "" || strings.Contains(path, "..") {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(parts) < 2 {
		return false
	}
	folder, ownerID := parts[0], parts[1]
	switch folder {
	case "santri":
		if role != "santri" {
			return false
		}
	case "guru":
		// guru bucket covers guru, admin, and pentashih accounts.
		if role == "santri" {
			return false
		}
	default:
		return false
	}
	return ownerID == userID
}

// authorizeFileWrite gates uploads and deletes. Avatars are self-service —
// anyone may manage their own. Every other bucket stays admin-only.
func authorizeFileWrite(r *http.Request, bucket, path string) (ok bool, message string) {
	role := middleware.RoleFromCtx(r.Context())
	if bucket == storage.BucketAvatars {
		if ownsAvatarPath(role, middleware.UserIDFromCtx(r.Context()), path) {
			return true, ""
		}
		return false, "hanya pemilik atau admin yang dapat mengubah foto profil ini"
	}
	if middleware.CanManage(role) {
		return true, ""
	}
	return false, "hanya admin yang dapat mengubah file ini"
}

func (h *FileHandler) handleUpload(w http.ResponseWriter, r *http.Request, bucket string) {
	r.Body = http.MaxBytesReader(w, r.Body, h.cfg.MaxUploadBytes)
	if err := r.ParseMultipartForm(h.cfg.MaxUploadBytes); err != nil {
		jsonError(w, "file terlalu besar", http.StatusRequestEntityTooLarge)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file tidak ditemukan di form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	mimeType := header.Header.Get("Content-Type")
	path := r.FormValue("path")
	if path == "" {
		jsonError(w, "path wajib diisi", http.StatusBadRequest)
		return
	}
	// Authorize after path is known — the path is what ownership is derived from.
	if ok, msg := authorizeFileWrite(r, bucket, path); !ok {
		jsonError(w, msg, http.StatusForbidden)
		return
	}

	// Baca sebagian untuk deteksi MIME lebih akurat
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	detected := http.DetectContentType(buf[:n])
	if mimeType == "" {
		mimeType = detected
	}
	// Rewind tidak mungkin pada multipart — gabung buf dan sisa file
	combined := io.MultiReader(bytes.NewReader(buf[:n]), file)

	if err := h.store.Save(bucket, path, combined, mimeType, header.Size); err != nil {
		switch err {
		case storage.ErrInvalidPath:
			jsonError(w, "path tidak valid", http.StatusBadRequest)
		case storage.ErrInvalidMime:
			jsonError(w, "tipe file tidak diizinkan", http.StatusUnsupportedMediaType)
		case storage.ErrFileTooLarge:
			jsonError(w, "file terlalu besar", http.StatusRequestEntityTooLarge)
		default:
			jsonError(w, "gagal menyimpan file", http.StatusInternalServerError)
		}
		return
	}

	publicPath := h.store.PublicPath(bucket, path)
	jsonOK(w, map[string]string{"path": path, "url": publicPath})
}

func (h *FileHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	bucket := r.URL.Query().Get("bucket")
	path := r.URL.Query().Get("path")
	if bucket == "" || path == "" {
		jsonError(w, "bucket dan path wajib diisi", http.StatusBadRequest)
		return
	}
	if ok, msg := authorizeFileWrite(r, bucket, path); !ok {
		jsonError(w, msg, http.StatusForbidden)
		return
	}
	if err := h.store.Delete(bucket, path); err != nil {
		jsonError(w, "gagal menghapus file", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FileHandler) SignedURL(w http.ResponseWriter, r *http.Request) {
	bucket := r.URL.Query().Get("bucket")
	path := r.URL.Query().Get("path")
	if bucket == "" || path == "" {
		jsonError(w, "bucket dan path wajib diisi", http.StatusBadRequest)
		return
	}
	// r.URL.Scheme selalu kosong pada request sisi server — hanya r.Host yang
	// terisi. Menyusunnya langsung menghasilkan "://localhost:8080", yang oleh
	// browser dibaca sebagai alamat relatif sehingga seluruh foto gagal dimuat.
	// Guard lama membandingkan hasilnya dengan "://", jadi tidak pernah kena
	// karena r.Host tidak kosong.
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	// Di belakang reverse proxy (Nginx, Caddy) TLS diakhiri di proxy, jadi
	// skema aslinya hanya diketahui dari header ini.
	if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		scheme = forwarded
	}
	baseURL := scheme + "://" + r.Host
	if r.Host == "" {
		baseURL = "http://localhost:" + h.cfg.Port
	}
	url := h.store.SignedURL(bucket, path, time.Hour, baseURL)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"signed_url": url})
}

func splitBucketPath(urlPath, prefix string) (bucket, path string) {
	trimmed := strings.TrimPrefix(urlPath, prefix)
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) == 2 {
		return parts[0], filepath.Clean(parts[1])
	}
	return trimmed, ""
}
