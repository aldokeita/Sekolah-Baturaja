package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalidPath      = errors.New("path tidak valid")
	ErrInvalidMime      = errors.New("tipe file tidak diizinkan")
	ErrInvalidExt       = errors.New("ekstensi file tidak diizinkan")
	ErrFileTooLarge     = errors.New("ukuran file melebihi batas")
	ErrSignatureExpired = errors.New("link sudah kedaluwarsa")
)

// Bucket adalah direktori root di dalam UploadDir.
const (
	BucketAvatars       = "avatars"
	BucketWebsiteAssets = "website-assets"
	BucketMusic         = "music-files"
	// BucketDocuments menampung arsip dokumen resmi (scan ijazah, akta, KK,
	// SK). Privat: hanya bisa diakses lewat signed URL, sama seperti avatars,
	// karena isinya data pribadi.
	BucketDocuments = "documents"
)

var allowedMIME = map[string]map[string]bool{
	BucketAvatars:       {"image/jpeg": true, "image/png": true, "image/webp": true},
	BucketWebsiteAssets: {"image/jpeg": true, "image/png": true, "image/webp": true, "application/pdf": true},
	BucketMusic:         {"audio/mpeg": true, "audio/wav": true, "audio/ogg": true},
	BucketDocuments:     {"application/pdf": true, "image/jpeg": true, "image/png": true, "image/webp": true},
}

/* allowedExt mengunci EKSTENSI berkas, bukan hanya tipenya.
 *
 * Tanpa ini, penyaringan MIME saja tidak cukup: nama berkas ikut menentukan
 * bagaimana peramban memperlakukan isinya saat berkas itu diambil kembali, dan
 * ServeFile dulu menyusun Content-Type dari ekstensi. Satu berkas bernama
 * ".html" atau ".svg" karena itu dijalankan sebagai halaman di alamat API —
 * dan pada susunan satu domain, alamat API sama dengan alamat situs, tempat
 * kunci sesi pengguna disimpan.
 *
 * Peta ini juga yang dipakai ServeFile untuk menentukan Content-Type, sehingga
 * tipe yang disajikan tidak pernah berasal dari kiriman pengguna. */
var allowedExt = map[string]map[string]string{
	BucketAvatars: {
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
	},
	BucketWebsiteAssets: {
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
		".pdf": "application/pdf",
	},
	BucketMusic: {
		".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
	},
	BucketDocuments: {
		".pdf": "application/pdf",
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
	},
}

/* normalizeSniffedMIME menyamakan sebutan yang dipakai http.DetectContentType
 * dengan sebutan pada allowedMIME. Keduanya tidak selalu memakai nama yang sama
 * untuk format yang sama — WAV dikenali sebagai "audio/wave" dan OGG sebagai
 * "application/ogg" — sehingga tanpa penyamaan ini berkas yang sah ikut
 * tertolak. */
func normalizeSniffedMIME(sniffed string) string {
	if i := strings.IndexByte(sniffed, ';'); i >= 0 {
		sniffed = strings.TrimSpace(sniffed[:i])
	}
	switch sniffed {
	case "audio/wave", "audio/x-wav":
		return "audio/wav"
	case "application/ogg", "audio/x-ogg":
		return "audio/ogg"
	case "audio/mp3":
		return "audio/mpeg"
	}
	return sniffed
}

// ExtensionAllowed melaporkan apakah ekstensi path boleh masuk ke bucket ini.
// Dipakai handler untuk menolak lebih awal, sebelum berkasnya dibaca.
func ExtensionAllowed(bucket, path string) bool {
	table := allowedExt[bucket]
	if table == nil {
		return true
	}
	_, ok := table[strings.ToLower(filepath.Ext(path))]
	return ok
}

// privateBuckets wajib signed URL untuk dibaca. Bucket lain dilayani langsung.
var privateBuckets = map[string]bool{
	BucketAvatars:   true,
	BucketDocuments: true,
}

// IsPrivateBucket dipakai handler untuk menolak route privat yang diarahkan ke
// bucket publik, sehingga daftar bucket privat hanya hidup di satu tempat.
func IsPrivateBucket(bucket string) bool { return privateBuckets[bucket] }

type Store struct {
	root     string // e.g. /app/uploads
	signKey  []byte
	maxBytes int64
}

func New(uploadDir, signSecret string, maxBytes int64) *Store {
	return &Store{root: uploadDir, signKey: []byte(signSecret), maxBytes: maxBytes}
}

/* Save menyimpan file ke disk. Path harus relative dan aman.
 *
 * `mimeType` WAJIB hasil pembacaan isi berkas (http.DetectContentType), bukan
 * header Content-Type kiriman klien. Header itu ditulis oleh pengirim dan tidak
 * dibuktikan apa pun: cukup mengaku "image/png" untuk menyelipkan isi apa saja
 * melewati penyaringan. */
func (s *Store) Save(bucket, path string, r io.Reader, mimeType string, size int64) error {
	if err := s.validatePath(path); err != nil {
		return err
	}
	if !ExtensionAllowed(bucket, path) {
		return ErrInvalidExt
	}
	if allowed := allowedMIME[bucket]; allowed != nil {
		sniffed := normalizeSniffedMIME(mimeType)
		if !allowed[sniffed] {
			/* Berkas audio adalah satu-satunya kelonggaran: MP3 tanpa tag ID3 di
			 * awalnya tidak punya penanda yang bisa dikenali, sehingga terbaca
			 * "application/octet-stream". Ekstensinya sudah lolos allowedExt di
			 * atas, bucket ini hanya bisa diisi staf, dan berkas audio tidak
			 * dijalankan peramban — jadi ekstensi cukup untuk kasus ini saja. */
			audioFallback := bucket == BucketMusic && sniffed == "application/octet-stream"
			if !audioFallback {
				return ErrInvalidMime
			}
		}
	}
	if size > s.maxBytes {
		return ErrFileTooLarge
	}
	dest := filepath.Join(s.root, bucket, path)
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, io.LimitReader(r, s.maxBytes+1))
	return err
}

// Delete menghapus file dari disk.
func (s *Store) Delete(bucket, path string) error {
	if err := s.validatePath(path); err != nil {
		return err
	}
	return os.Remove(filepath.Join(s.root, bucket, path))
}

// SignedURL membuat URL bertanda-tangan yang kedaluwarsa setelah ttl.
func (s *Store) SignedURL(bucket, path string, ttl time.Duration, baseURL string) string {
	exp := strconv.FormatInt(time.Now().Add(ttl).Unix(), 10)
	sig := s.sign(bucket, path, exp)
	return fmt.Sprintf("%s/files/%s/%s?exp=%s&sig=%s", baseURL, bucket, path, exp, sig)
}

// VerifySignedURL memvalidasi signature dan expiry dari request.
func (s *Store) VerifySignedURL(r *http.Request, bucket, path string) error {
	exp := r.URL.Query().Get("exp")
	sig := r.URL.Query().Get("sig")
	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || time.Now().Unix() > expUnix {
		return ErrSignatureExpired
	}
	expected := s.sign(bucket, path, exp)
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return errors.New("signature tidak valid")
	}
	return nil
}

// PublicPath mengembalikan path yang bisa diakses publik (tanpa tanda tangan).
func (s *Store) PublicPath(bucket, path string) string {
	return fmt.Sprintf("/files/%s/%s", bucket, path)
}

// ServeFile adalah handler untuk melayani file publik dan privat.
// Privat (avatars): wajib signature. Publik (website-assets, music): langsung serve.
func (s *Store) ServeFile(w http.ResponseWriter, r *http.Request, bucket, path string) {
	if privateBuckets[bucket] {
		if err := s.VerifySignedURL(r, bucket, path); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
	}
	full := filepath.Join(s.root, bucket, path)
	if err := s.validatePath(path); err != nil {
		http.NotFound(w, r)
		return
	}
	/* Content-Type diambil dari peta allowedExt milik bucket ini, BUKAN dari
	 * mime.TypeByExtension. Yang lama menjawab untuk ekstensi apa pun yang
	 * dikenal sistem — termasuk text/html dan image/svg+xml — sehingga sebuah
	 * berkas yang lolos masuk lebih dulu akan disajikan sebagai halaman yang
	 * dijalankan peramban. Berkas lama yang ekstensinya di luar daftar disajikan
	 * sebagai octet-stream: terunduh, tidak dijalankan.
	 *
	 * nosniff menutup sisanya. Tanpa itu peramban boleh mengabaikan Content-Type
	 * dan menebak sendiri dari isi berkas. */
	ext := strings.ToLower(filepath.Ext(path))
	contentType := "application/octet-stream"
	if table := allowedExt[bucket]; table != nil {
		if ct, ok := table[ext]; ok {
			contentType = ct
		}
	} else if ct := mime.TypeByExtension(ext); ct != "" {
		contentType = ct
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, full)
}

func (s *Store) sign(bucket, path, exp string) string {
	h := hmac.New(sha256.New, s.signKey)
	h.Write([]byte(bucket + ":" + path + ":" + exp))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Store) validatePath(path string) error {
	clean := filepath.Clean(path)
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return ErrInvalidPath
	}
	return nil
}
